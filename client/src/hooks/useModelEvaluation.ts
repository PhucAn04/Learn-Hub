/**
 * useModelEvaluation — Hook gộp toàn bộ evaluation pipeline
 * Chạy sau khi bé nộp bài, trước khi hiển thị ReportCard.
 *
 * Pipeline:
 *   samples + goldenDataset → evaluateAgainstGolden → buildConfusionMatrix → evaluation JSON
 *   samples + classes → evaluateStudentDatasetPhase → datasetHealth
 *   samples + teacherSamples → crossCheck
 *   evaluation JSON → api.updateModelArtifacts (persist to backend)
 */

import { useCallback, useState } from 'react';
import type { ModelEvaluation } from '@/types/models';
import { StoredSample, evaluateAgainstGolden, analyzeDataBalance, classifyKNNDetailed } from '@/lib/knn-classifier';
import { buildConfusionMatrix } from '@/lib/confusion-matrix';
import { evaluateStudentDatasetPhase } from '@/lib/teacher-validator';
import { api } from '@/lib/api';

interface EvalConfig {
  challengeType: string;
  classes: { id: string; label: string }[];
  goldenDataset: { features: number[]; expectedLabel: string }[];
  teacherSamples?: StoredSample[];
  k?: number;
}

export function useModelEvaluation(config: EvalConfig) {
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null);
  const [previousEvaluation, setPreviousEvaluation] = useState<ModelEvaluation | null>(null);
  const [modelVersion, setModelVersion] = useState(1);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const runEvaluation = useCallback(async (
    samples: StoredSample[],
    modelId: string,
  ): Promise<ModelEvaluation | null> => {
    try {
      setIsEvaluating(true);

      const k = config.k || 3;

      // 1. Golden Evaluation
      const goldenResult = evaluateAgainstGolden(samples, config.goldenDataset, k);

      // 2. Confusion Matrix
      const confusionMatrix = buildConfusionMatrix(goldenResult.results);

      // 3. Dataset Phase
      const dsQuality = evaluateStudentDatasetPhase(samples, config.classes, 3, 10);
      const balance = analyzeDataBalance(samples);

      // 3b. Robust Self Cross-Check — phạt ảnh sai nhãn (Golden Dataset logic)
      // Golden test đánh giá "model predict đúng không" nhưng không phạt ảnh sai nhãn
      // vì ảnh đúng chiếm đa số → model vẫn predict đúng.
      // Self cross-check với adaptive K phá cluster ảnh sai bảo vệ nhau.
      let robustMislabeledCount = 0;
      const hasTeacher = config.teacherSamples && config.teacherSamples.length > 0;
      
      if (!hasTeacher) {
        samples.forEach((sample, index) => {
          if (sample.quality?.isBlurry || sample.quality?.isDark) return;
          
          const refs = samples.filter((_, i) => i !== index);
          if (refs.length === 0) return;
          
          const robustK = Math.max(k, Math.ceil(refs.length * 0.5));
          const robustThreshold = Math.ceil(robustK * 0.5);
          
          const knn = classifyKNNDetailed(sample.features, refs, robustK);
          const bestVotes = (knn.counts as Record<string, number>)[knn.label] || 0;
          
          if (bestVotes >= robustThreshold) {
            // AI confident about a label
            const predictedClassId = config.classes.find(c => c.label === knn.label)?.id || knn.label;
            const sampleClassId = sample.sourceId || config.classes.find(c => c.label === sample.label)?.id || sample.label;
            if (predictedClassId !== sampleClassId) {
              robustMislabeledCount++;
            }
          }
          // If not confident (votes < threshold), the sample is ambiguous but not necessarily wrong
        });
      }
      
      // Combine golden accuracy with mislabel penalty
      // Golden accuracy measures model quality; mislabel penalty measures data quality
      const mislabelPenalty = samples.length > 0 
        ? (robustMislabeledCount / samples.length) 
        : 0;
      const adjustedGoldenAccuracy = Math.round(
        goldenResult.accuracy * (1 - mislabelPenalty)
      );

      // 4. Dataset Health stats
      const classSummary: Record<string, number> = {};
      samples.forEach(s => { classSummary[s.label] = (classSummary[s.label] || 0) + 1; });
      
      const blurrySampleCount = samples.filter(s => s.quality?.isBlurry).length;
      const darkSampleCount = samples.filter(s => s.quality?.isDark).length;
      const totalWithQuality = samples.filter(s => s.quality).length;
      const goodQuality = totalWithQuality > 0
        ? samples.filter(s => s.quality && !s.quality.isBlurry && !s.quality.isDark).length
        : samples.length;
      const qualityScore = samples.length > 0
        ? Math.round((goodQuality / samples.length) * 100)
        : 0;

      const balanceRatio = (() => {
        const values = Object.values(classSummary);
        if (values.length < 2) return 1;
        return Math.min(...values) / Math.max(...values);
      })();

      // 5. Cross-Check with teacher template
      let crossCheck = {
        hasTeacherTemplate: false,
        totalSamples: 0,
        conflictCount: 0,
        agreementRate: 0,
      };

      if (config.teacherSamples && config.teacherSamples.length > 0) {
        // Simple cross-check: for each teacher sample, classify against student samples
        let conflicts = 0;
        const teacherSampleLabels = config.teacherSamples;
        teacherSampleLabels.forEach(ts => {
          if (ts.features && ts.features.length > 0) {
            const prediction = classifyKNNDetailed(ts.features, samples, k);
            if (prediction.label !== ts.label) conflicts++;
          }
        });
        crossCheck = {
          hasTeacherTemplate: true,
          totalSamples: teacherSampleLabels.length,
          conflictCount: conflicts,
          agreementRate: teacherSampleLabels.length > 0
            ? Math.round(((teacherSampleLabels.length - conflicts) / teacherSampleLabels.length) * 100)
            : 0,
        };
      }

      // 6. Fetch version chain to determine version number
      let version = 1;
      let prevEval: ModelEvaluation | null = null;
      let parentModelId: string | undefined;

      try {
        const chain = await api.getModelChain(config.challengeType);
        if (chain.length > 0) {
          // Current model should be the latest in the chain
          const existingVersions = chain.filter(m => m.id !== modelId);
          version = existingVersions.length + 1;

          // Get previous model's evaluation for comparison
          if (existingVersions.length > 0) {
            const prevModel = existingVersions[existingVersions.length - 1];
            parentModelId = prevModel.id;
            prevEval = prevModel.evaluation || null;
          }
        }
      } catch {
        // If chain endpoint fails, default to version 1
      }

      // 7. Build evaluation object
      const evalData: ModelEvaluation = {
        goldenAccuracy: adjustedGoldenAccuracy,
        goldenCorrectCount: goldenResult.correctCount,
        goldenTotalCount: goldenResult.totalCount,
        confusionMatrix: {
          labels: confusionMatrix.labels,
          matrix: confusionMatrix.matrix,
          perClassAccuracy: confusionMatrix.perClassAccuracy,
          perClassPrecision: confusionMatrix.perClassPrecision,
          perClassRecall: confusionMatrix.perClassRecall,
          weakestLabel: confusionMatrix.weakestLabel,
          strongestLabel: confusionMatrix.strongestLabel,
          misclassifications: confusionMatrix.misclassifications,
        },
        crossCheck,
        datasetHealth: {
          sampleCount: samples.length,
          classSummary,
          balanceRatio,
          isImbalanced: balance.isImbalanced,
          phase: dsQuality.phase as 'PHASE_A' | 'PHASE_B',
          qualityScore,
          blurrySampleCount,
          darkSampleCount,
        },

        // 7b. Sample Evidence — dẫn chứng cụ thể cho GV
        sampleEvidence: {
          // Ảnh mờ/tối cụ thể (kèm thumbnail)
          qualityIssues: samples
            .filter(s => s.quality?.isBlurry || s.quality?.isDark)
            .map(s => ({
              label: s.label,
              isBlurry: !!s.quality?.isBlurry,
              isDark: !!s.quality?.isDark,
              brightness: s.quality?.brightness,
              blurScore: s.quality?.blurScore,
              thumbnail: s.thumbnail || s.rawThumbnail,
            })),

          // Ảnh bị AI đoán sai nhãn (có aiFeedback.isMisclassified)
          misclassifiedSamples: samples
            .filter(s => s.aiFeedback?.isMisclassified)
            .map(s => ({
              label: s.label,
              predictedLabel: s.aiFeedback?.predictedLabel || '?',
              thumbnail: s.thumbnail || s.rawThumbnail,
            })),

          // Chi tiết từng câu golden test
          goldenTestDetails: goldenResult.results.map(r => ({
            expectedLabel: r.expectedLabel,
            predictedLabel: r.predictedLabel,
            isCorrect: r.isCorrect,
            confidence: r.confidence,
          })),

          // Preview ảnh từng nhãn (tối đa 4 ảnh mẫu)
          classPreviews: Object.entries(classSummary).map(([label, count]) => ({
            label,
            count,
            sampleThumbnails: samples
              .filter(s => s.label === label && (s.thumbnail || s.rawThumbnail))
              .map(s => (s.thumbnail || s.rawThumbnail) as string),
          })),
        },

        evaluatedAt: new Date().toISOString(),
        evaluationVersion: '2.0.0',
      };

      // 8. Persist to backend
      try {
        await api.updateModelArtifacts(modelId, {
          evaluation: evalData as unknown as Record<string, unknown>,
          version,
          parentModelId,
        });
      } catch (e) {
        console.error('Failed to persist evaluation', e);
      }

      // 9. Update state
      setEvaluation(evalData);
      setPreviousEvaluation(prevEval);
      setModelVersion(version);
      setIsEvaluating(false);

      return evalData;
    } catch (err) {
      console.error('Evaluation failed', err);
      setIsEvaluating(false);
      return null;
    }
  }, [config]);

  return {
    evaluation,
    previousEvaluation,
    modelVersion,
    isEvaluating,
    runEvaluation,
  };
}
