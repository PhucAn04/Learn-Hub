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
import { evaluateStudentImagesWithTeacher, evaluateStudentImagesWithReference } from '@/lib/knn-teacher-classifier';
import { TEACHER_REFERENCE_DATASET } from '@/lib/teacher-reference-dataset';
import { TfTrainer } from '@/lib/tf-trainer';
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
      const teacherK = 5; // K=5 cho Teacher evaluation (68 mẫu, √68≈8) — chặt chẽ hơn K=3

      const hasTeacher = config.teacherSamples && config.teacherSamples.length > 0;

      // 0. Train một NN nhỏ từ dữ liệu bé để lấy softmax confidence chi tiết
      // NN train rất nhanh (<1s) với ~6-10 samples, cho % thật sự khác nhau từng ảnh
      let nnPredict: ((features: number[]) => Promise<{ label: string; confidence: number; confidences?: Record<string, number> }>) | null = null;
      try {
        const uniqueLabels = new Set(samples.map(s => s.label));
        if (uniqueLabels.size >= 2) {
          const evalTrainer = new TfTrainer();
          await evalTrainer.train(samples, undefined, { epochs: 50 });
          nnPredict = (features: number[]) => evalTrainer.predict(features);
        }
      } catch { /* fallback: dùng KNN confidence */ }

      // 0b. Train một NN từ Teacher dataset để validate ảnh của bé cho Khung 2
      let teacherNnPredict: ((features: number[]) => Promise<{ label: string; confidence: number; confidences?: Record<string, number> }>) | null = null;
      try {
        const teacherEvalTrainer = new TfTrainer();
        const teacherTrainSamples = hasTeacher 
          ? config.teacherSamples!
          : TEACHER_REFERENCE_DATASET.map(g => ({ features: g.features, label: g.expectedLabel } as StoredSample));
        const uniqueTeacherLabels = new Set(teacherTrainSamples.map(s => s.label));
        if (uniqueTeacherLabels.size >= 2) {
          await teacherEvalTrainer.train(teacherTrainSamples, undefined, { epochs: 50 });
          teacherNnPredict = (features: number[]) => teacherEvalTrainer.predict(features);
        }
      } catch { /* fallback */ }

      // 1. Golden Evaluation — đánh giá chất lượng Model AI của bé
      // Dùng NN softmax để lấy "Mô hình tự tin: X%" chi tiết, fallback KNN
      const goldenResult = evaluateAgainstGolden(samples, config.goldenDataset, k);

      // Bổ sung NN softmax confidence cho Golden Test (thay vì vote count)
      if (nnPredict) {
        for (let i = 0; i < goldenResult.results.length; i++) {
          try {
            const goldenSample = config.goldenDataset[i];
            if (goldenSample) {
              const nnPred = await nnPredict(goldenSample.features);
              // Ghi đè confidence bằng NN softmax (% thật, không phải vote count)
              goldenResult.results[i].confidence = nnPred.confidence;
            }
          } catch { /* fallback giữ KNN confidence */ }
        }
      }
      // 2. Confusion Matrix
      const confusionMatrix = buildConfusionMatrix(goldenResult.results);

      // 3. Dataset Phase
      const dsQuality = evaluateStudentDatasetPhase(samples, config.classes, 3, 10);
      const balance = analyzeDataBalance(samples);

      // 3b. Student Image Audit — đánh giá chéo từng ảnh học sinh
      // KNN xác định nhãn đúng/sai (isMatch), NN softmax cho confidence % chi tiết
      // 3 tầng ưu tiên:
      //   Tầng 1: Teacher Samples (GV chụp) — chặt nhất
      //   Tầng 2: Teacher Reference Dataset (Kaggle 68 mẫu) — chuẩn mực, không phụ thuộc bé
      let studentImageAudit: NonNullable<ModelEvaluation['sampleEvidence']>['studentImageAudit'] = [];

      if (hasTeacher) {
        // Tầng 1: Đánh giá bằng Teacher Samples (Distance-weighted, K=5)
        studentImageAudit = evaluateStudentImagesWithTeacher(
          samples, config.teacherSamples!, config.classes, teacherK
        );
      } else {
        // Tầng 2: Đánh giá bằng Teacher Reference Dataset (Distance-weighted, K=5)
        studentImageAudit = evaluateStudentImagesWithReference(
          samples, config.classes, teacherK
        );
      }

      // Bổ sung % validate chính xác từ model của Teacher (Giáo viên)
      if (teacherNnPredict && studentImageAudit && studentImageAudit.length > 0) {
        for (let i = 0; i < samples.length && i < studentImageAudit.length; i++) {
          const sample = samples[i];
          try {
            const nnPred = await teacherNnPredict(sample.features);
            const expectedLabel = studentImageAudit[i].expectedLabel;
            
            // Lấy softmax probability của nhãn bé gán (expected)
            let nnScore = nnPred.confidence;
            if (nnPred.confidences && nnPred.confidences[expectedLabel] !== undefined) {
               nnScore = Math.round(nnPred.confidences[expectedLabel] * 100);
            }
            
            // Trừ điểm ảnh mờ tối
            if (sample.quality?.isBlurry) nnScore -= 30;
            if (sample.quality?.isDark) nnScore -= 30;
            nnScore = Math.max(0, Math.min(100, nnScore));

            studentImageAudit[i].confidence = nnScore;
            // Cập nhật lại dự đoán và isMatch bằng Teacher's NN (chuẩn hơn KNN)
            const predictedLabel = config.classes.find(c => c.id === nnPred.label)?.label || nnPred.label;
            studentImageAudit[i].predictedLabel = predictedLabel;
            const expectedClassId = config.classes.find(c => c.label === expectedLabel)?.id || expectedLabel;
            studentImageAudit[i].isMatch = (predictedLabel === expectedLabel || nnPred.label === expectedClassId);
          } catch { /* fallback giữ KNN confidence */ }
        }
      }

      // 3b-2. Model Confidence Per Image (Khung 1: "Mô hình tự tin")
      // Chạy từng ảnh qua NN bé → softmax → "Mô hình tự tin: X%"
      let modelConfidencePerImage: NonNullable<ModelEvaluation['sampleEvidence']>['modelConfidencePerImage'] = [];
      if (nnPredict) {
        let evalImages: StoredSample[] = [];

        if (hasTeacher) {
          evalImages = config.teacherSamples!;
        } else {
          // Validate model của bé bằng 68 mẫu Kaggle trước
          const refSamples = TEACHER_REFERENCE_DATASET.map((g, i) => ({
            features: g.features,
            label: g.expectedLabel,
            thumbnail: undefined,
            id: `ref-${i}`
          } as StoredSample));

          let correctCount = 0;
          for (const ref of refSamples) {
            try {
              const pred = await nnPredict(ref.features);
              const predictedLabel = config.classes.find(c => c.id === pred.label)?.label || pred.label;
              const expectedClassId = config.classes.find(c => c.label === ref.label)?.id || ref.label;
              if (predictedLabel === ref.label || pred.label === expectedClassId) {
                correctCount++;
              }
            } catch { /* skip */ }
          }

          const accuracy = correctCount / refSamples.length;
          const PASS_THRESHOLD = 0.6; // Đạt 60% trên bộ chuẩn Kaggle được coi là pass

          if (accuracy >= PASS_THRESHOLD) {
            // Nếu pass, lấy chính bộ ảnh của bé để tự check chéo nội bộ
            evalImages = samples;
          } else {
            // Nếu fail, lấy 68 mẫu Kaggle để hiển thị (cho GV thấy model bé fail ở đâu)
            evalImages = refSamples;
          }
        }

        for (const img of evalImages) {
          try {
            const nnPred = await nnPredict(img.features);
            const expectedLabel = img.label || (img as { expectedLabel?: string }).expectedLabel || '?';
            // Map NN predicted class ID → display label
            const predictedLabel = config.classes.find(c => c.id === nnPred.label)?.label || nnPred.label;
            const isCorrect = predictedLabel === expectedLabel || nnPred.label === expectedLabel;

            modelConfidencePerImage.push({
              expectedLabel,
              predictedLabel,
              isCorrect,
              confidence: nnPred.confidence,
              thumbnail: (img as StoredSample).thumbnail || (img as StoredSample).rawThumbnail,
            });
          } catch { /* skip */ }
        }
      }

      // 3c. Robust Self Cross-Check — phạt ảnh sai nhãn (chỉ để tính robustMislabeledCount)
      // Golden test đánh giá "model predict đúng không" nhưng không phạt ảnh sai nhãn
      // vì ảnh đúng chiếm đa số → model vẫn predict đúng.
      // Self cross-check với adaptive K phá cluster ảnh sai bảo vệ nhau.
      let robustMislabeledCount = 0;
      
      if (!hasTeacher) {
        samples.forEach((sample, index) => {
          if (sample.quality?.isBlurry || sample.quality?.isDark) return;
          
          const sampleClassId = sample.sourceId || config.classes.find(c => c.label === sample.label)?.id || sample.label;
          const expectedLabel = config.classes.find(c => c.id === sampleClassId)?.label || sample.label;
          
          const refs = samples.filter((_, i) => i !== index);
          if (refs.length === 0) return;
          
          const robustK = Math.max(k, Math.ceil(refs.length * 0.5));
          const robustThreshold = Math.ceil(robustK * 0.5);
          
          const knn = classifyKNNDetailed(sample.features, refs, robustK);
          const bestVotes = (knn.counts as Record<string, number>)[knn.label] || 0;
          
          if (bestVotes >= robustThreshold) {
            const predictedClassId = config.classes.find(c => c.label === knn.label)?.id || knn.label;
            const sampleClassId2 = sample.sourceId || config.classes.find(c => c.label === sample.label)?.id || sample.label;
            const predictedLabel = config.classes.find(c => c.id === predictedClassId)?.label || knn.label;
            const isMatch = predictedClassId === sampleClassId2 || predictedLabel === expectedLabel;
            
            if (!isMatch) {
              robustMislabeledCount++;
            }
          }
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

          // Phân bổ ảnh từng nhãn kèm thumbnails mẫu (tối đa 4 ảnh/nhãn)
          classPreviews: Object.entries(classSummary).map(([label, count]) => ({
            label,
            count,
            sampleThumbnails: samples
              .filter(s => s.label === label && (s.thumbnail || s.rawThumbnail))
              .map(s => (s.thumbnail || s.rawThumbnail) as string),
          })),
          
          // Đánh giá chi tiết từng ảnh học sinh (từ Teacher/Golden/Self cross-check)
          studentImageAudit,

          // Mô hình bé đánh giá từng ảnh GV — "Mô hình tự tin: X%"
          modelConfidencePerImage
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
