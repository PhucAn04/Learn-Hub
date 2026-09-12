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
import { StoredSample, evaluateAgainstGolden, analyzeDataBalance, classifyKNNDetailed, classifyKNN, resolveClassMatch } from '@/lib/knn-classifier';
import { buildConfusionMatrix } from '@/lib/confusion-matrix';
import { evaluateStudentDatasetPhase } from '@/lib/teacher-validator';
import { evaluateStudentImagesWithTeacher, evaluateStudentImagesWithReference } from '@/lib/knn-teacher-classifier';
import { TEACHER_REFERENCE_DATASET } from '@/lib/teacher-reference-dataset';
import { DynamicDatasetSample, evaluateAgainstDynamic } from '@/lib/teacher-dynamic-dataset';
import { TfTrainer } from '@/lib/tf-trainer';
import { api } from '@/lib/api';

interface EvalConfig {
  challengeType: string;
  classes: { id: string; label: string }[];
  goldenDataset: { features: number[]; expectedLabel: string }[];
  dynamicDataset?: DynamicDatasetSample[];
  teacherSamples?: StoredSample[];
  k?: number;
}

/**
 * Compare two labels that may differ by emoji suffix.
 * Resolves both labels to class IDs via resolveClassMatch, then compares IDs.
 * Falls back to substring matching if neither resolves.
 */
function labelsMatch(a: string, b: string, classes?: { id: string; label: string }[]): boolean {
  if (a === b) return true;
  if (classes && classes.length > 0) {
    const aId = resolveClassMatch(a, classes)?.id;
    const bId = resolveClassMatch(b, classes)?.id;
    if (aId && bId) return aId === bId;
  }
  // Fallback: one label is a substring of the other (handles emoji suffix)
  return a.includes(b) || b.includes(a);
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

      const classIdToLabel = new Map(config.classes.map(c => [c.id, c.label]));

      const getEvaluationDataset = () => {
        if (config.challengeType === 'teach') {
          return TEACHER_REFERENCE_DATASET.map(g => ({ ...g, expectedLabel: g.expectedLabel }));
        }
        if (config.challengeType === 'teach-two-hands') {
          return config.goldenDataset.map(g => {
            let mapped = g.expectedLabel;
            if (g.expectedLabel === '1 Ngón Tay ☝️') {
              mapped = config.classes[0]?.label || mapped;
            } else if (g.expectedLabel === '2 Ngón Tay ✌️') {
              mapped = config.classes[1]?.label || mapped;
            }
            return { ...g, expectedLabel: mapped };
          });
        }
        return config.goldenDataset.map(g => ({
          ...g,
          expectedLabel: classIdToLabel.get(g.expectedLabel) || g.expectedLabel,
        }));
      };

      const evaluationDataset = getEvaluationDataset();

      // 0b. Train một NN từ Teacher dataset để validate ảnh của bé cho Khung 2
      let teacherNnPredict: ((features: number[]) => Promise<{ label: string; confidence: number; confidences?: Record<string, number> }>) | null = null;
      try {
        const teacherEvalTrainer = new TfTrainer();
        const teacherTrainSamples = hasTeacher 
          ? config.teacherSamples!
          : evaluationDataset.map(g => ({ features: g.features, label: g.expectedLabel } as StoredSample));
        const uniqueTeacherLabels = new Set(teacherTrainSamples.map(s => s.label));
        if (uniqueTeacherLabels.size >= 2) {
          await teacherEvalTrainer.train(teacherTrainSamples, undefined, { epochs: 50 });
          teacherNnPredict = (features: number[]) => teacherEvalTrainer.predict(features);
        }
      } catch { /* fallback */ }

      // 1. Golden Evaluation — đánh giá chất lượng Model AI của bé
      const goldenResult = evaluateAgainstGolden(samples, evaluationDataset, k);

      // Bổ sung NN softmax confidence cho Golden Test (thay vì vote count)
      if (nnPredict) {
        let nnCorrectCount = 0;
        for (let i = 0; i < goldenResult.results.length; i++) {
          try {
            const goldenSample = evaluationDataset[i];
            if (goldenSample) {
              const nnPred = await nnPredict(goldenSample.features);
              // Ghi đè confidence bằng NN softmax (% thật, không phải vote count)
              goldenResult.results[i].confidence = nnPred.confidence;

              if (config.challengeType !== 'teach') {
                const predictedLabel = config.classes.find(c => c.id === nnPred.label)?.label || nnPred.label;
                const expectedClassId = config.classes.find(c => c.label === goldenSample.expectedLabel)?.id || goldenSample.expectedLabel;
                const isCorrectMatch = labelsMatch(predictedLabel, goldenSample.expectedLabel, config.classes) || labelsMatch(nnPred.label, expectedClassId, config.classes);
                goldenResult.results[i].isCorrect = isCorrectMatch;
                if (isCorrectMatch) nnCorrectCount++;
              }
            }
          } catch { /* fallback giữ KNN confidence */ }
        }
        
        if (config.challengeType !== 'teach' && goldenResult.results.length > 0) {
          goldenResult.accuracy = Math.round((nnCorrectCount / goldenResult.results.length) * 100);
          goldenResult.correctCount = nnCorrectCount;
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
        // Tầng 2: Đánh giá bằng Golden/Reference Dataset (Distance-weighted, K=5)
        studentImageAudit = evaluateStudentImagesWithReference(
          samples, config.classes, teacherK, evaluationDataset
        );
      }



      // 3b-2. Model Confidence Per Image (Khung 1: "Mô hình tự tin")
      // Chạy từng ảnh qua NN bé → softmax → "Mô hình tự tin: X%"
      // 3b-2. Model Confidence Per Image (Khung: Mô Hình AI Đánh Giá Từng Ảnh)
      const modelConfidencePerImage: NonNullable<ModelEvaluation['sampleEvidence']>['modelConfidencePerImage'] = [];
      if (nnPredict) {
        if (hasTeacher) {
          // Có teacher thì dùng bộ mẫu của GV đưa qua model của bé
          for (const img of config.teacherSamples!) {
            try {
              const expectedLabel = img.label || '?';
              
              // Detect Teacher styles that the student never captured (OOD)
              // Bằng cách tìm khoảng cách KNN nhỏ nhất từ ảnh GV đến các ảnh cùng nhãn của bé
              let isUnlearnedStyle = false;
              let distanceToStudent = 0;
              const studentSamplesOfClass = samples.filter(s => {
                const sLabel = config.classes.find(c => c.id === s.sourceId)?.label || s.label;
                return labelsMatch(sLabel, expectedLabel, config.classes);
              });
              
              if (studentSamplesOfClass.length > 0) {
                const knn = classifyKNN(img.features, studentSamplesOfClass, 1);
                distanceToStudent = knn.minDistance;
                if (knn.minDistance > 0.65) {
                  isUnlearnedStyle = true;
                }
              }

              const nnPred = await nnPredict(img.features);
              const predictedLabel = config.classes.find(c => c.id === nnPred.label)?.label || nnPred.label;
              const isCorrect = labelsMatch(predictedLabel, expectedLabel, config.classes) || labelsMatch(nnPred.label, expectedLabel, config.classes);
              
              // Cho unlearned style: lấy confidence cho NHÃN ĐÚNG (expectedLabel)
              // thay vì confidence cho nhãn model đoán (predictedLabel)
              // → Vì model chưa học kiểu này, confidence cho nhãn đúng sẽ rất thấp (~10-30%)
              let displayConfidence = nnPred.confidence;
              if (isUnlearnedStyle && nnPred.confidences) {
                // Tìm class ID tương ứng với expectedLabel
                const expectedClassId = config.classes.find(c => c.label === expectedLabel)?.id;
                const rawScore = expectedClassId 
                  ? (nnPred.confidences[expectedClassId] ?? nnPred.confidences[expectedLabel] ?? 0)
                  : (nnPred.confidences[expectedLabel] ?? 0);
                displayConfidence = Math.round(rawScore * 100);
              }

              modelConfidencePerImage.push({
                expectedLabel, predictedLabel,
                isCorrect: isUnlearnedStyle ? false : isCorrect,
                confidence: displayConfidence,
                thumbnail: img.thumbnail || img.rawThumbnail,
                isUnlearnedStyle,
                distanceToStudent,
              });
            } catch { /* skip */ }
          }
        } else {
          // Validate model của bé bằng Golden Dataset trước
          const refSamples = evaluationDataset.map((g, i) => ({
            features: g.features,
            label: g.expectedLabel,
            thumbnail: undefined,
            id: `ref-${i}`
          } as StoredSample));

          let correctCount = 0;
          const goldenConfResults: typeof modelConfidencePerImage = [];
          for (const ref of refSamples) {
            try {
              const pred = await nnPredict(ref.features);
              const predictedLabel = config.classes.find(c => c.id === pred.label)?.label || pred.label;
              const expectedClassId = config.classes.find(c => c.label === ref.label)?.id || ref.label;
              const isCorrect = labelsMatch(predictedLabel, ref.label, config.classes) || labelsMatch(pred.label, expectedClassId, config.classes);
              if (isCorrect) correctCount++;
              
              goldenConfResults.push({
                expectedLabel: ref.label, predictedLabel, isCorrect,
                confidence: pred.confidence,
                thumbnail: undefined,
              });
            } catch { /* skip */ }
          }

          const accuracy = refSamples.length > 0 ? correctCount / refSamples.length : 0;
          const PASS_THRESHOLD = 0.6; // Đạt 60% trên bộ chuẩn

          // Luôn luôn check cross lại bộ ảnh của bé (không bao giờ hiển thị ảnh Golden lên UI)
          // Dùng chính model của bé (nnPredict) để đánh giá lại ảnh của bé, đúng với mô tả trên UI "Mô hình AI mà bé đã huấn luyện"
          const evalPredict = nnPredict;
          for (const img of samples) {
            try {
              const pred = await evalPredict(img.features);
              const expectedLabel = img.label || '?';
              const predictedLabel = config.classes.find(c => c.id === pred.label)?.label || pred.label;
              const isCorrect = labelsMatch(predictedLabel, expectedLabel, config.classes) || labelsMatch(pred.label, expectedLabel, config.classes);

              modelConfidencePerImage.push({
                expectedLabel, predictedLabel, isCorrect,
                confidence: pred.confidence,
                thumbnail: img.thumbnail || img.rawThumbnail,
              });
            } catch { /* skip */ }
          }
        }
      }

      // 3c. Robust Self Cross-Check — phạt ảnh sai nhãn (chỉ để tính robustMislabeledCount)
      // Golden test đánh giá "model predict đúng không" nhưng không phạt ảnh sai nhãn
      // vì ảnh đúng chiếm đa số → model vẫn predict đúng.
      // Self cross-check với adaptive K phá cluster ảnh sai bảo vệ nhau.
      // 3c. Đếm số ảnh sai nhãn để trừ điểm công bằng (mislabelPenalty)
      // Lấy trực tiếp từ các ảnh bị AI đánh dấu sai (aiFeedback.isMisclassified)
      // kết hợp với cross-check chuẩn xác
      const feedbackMislabeledCount = samples.filter(s => s.aiFeedback?.isMisclassified).length;
      
      let crossCheckMislabeledCount = 0;
      const refDataset = hasTeacher ? config.teacherSamples! : samples;

      samples.forEach((sample, index) => {
        if (sample.quality?.isBlurry || sample.quality?.isDark) return;
        if (sample.aiFeedback?.isMisclassified) {
          crossCheckMislabeledCount++;
          return;
        }

        const refs = hasTeacher ? refDataset : samples.filter((_, i) => i !== index);
        if (refs.length === 0) return;

        const checkK = Math.min(k, refs.length);
        const knn = classifyKNNDetailed(sample.features, refs, checkK);
        const matched = resolveClassMatch(knn.label, config.classes);
        const predictedClassId = matched?.id || knn.label;

        const sampleClassId = sample.sourceId || config.classes.find(c => c.label === sample.label)?.id || sample.label;
        if (predictedClassId !== sampleClassId) {
          crossCheckMislabeledCount++;
        }
      });

      const totalMislabeledCount = Math.max(feedbackMislabeledCount, crossCheckMislabeledCount);

      // Combine golden accuracy with mislabel penalty
      const mislabelPenalty = samples.length > 0 
        ? (totalMislabeledCount / samples.length) 
        : 0;
        
      let adjustedGoldenAccuracy = 100;
      if (config.challengeType === 'teach') {
        adjustedGoldenAccuracy = Math.round(
          goldenResult.accuracy * (1 - mislabelPenalty)
        );
      } else {
        // Đối với teach-gestures và teach-face, Golden Dataset (Kaggle) khác biệt lớn so với webcam
        // dẫn đến điểm goldenResult.accuracy luôn thấp (~50%) dù ảnh bé chụp chuẩn.
        // Điểm đánh giá (sao) sẽ phụ thuộc hoàn toàn vào độ sạch của data bé chụp (mislabelPenalty).
        adjustedGoldenAccuracy = Math.max(0, 100 - Math.round(mislabelPenalty * 100));
      }

      // Dynamic dataset evaluation (for custom labels 3/4/5 ngón)
      let dynamicAccuracy: number | undefined;
      let dynamicCorrect: number | undefined;
      let dynamicTotal: number | undefined;
      if (config.dynamicDataset && config.dynamicDataset.length > 0) {
        const dynamicResult = evaluateAgainstDynamic(samples, config.dynamicDataset, 3);
        dynamicAccuracy = dynamicResult.accuracy;
        dynamicCorrect = dynamicResult.correctCount;
        dynamicTotal = dynamicResult.totalCount;
      }

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
        
        // Filter out Teacher styles that the student never captured (OOD)
        const validTeacherSamples = config.teacherSamples.filter(ts => {
          const expectedLabel = config.classes.find(c => c.id === ts.sourceId)?.label || ts.label;
          const studentSamplesOfClass = samples.filter(s => {
            const sLabel = config.classes.find(c => c.id === s.sourceId)?.label || s.label;
            return labelsMatch(sLabel, expectedLabel, config.classes);
          });
          
          if (studentSamplesOfClass.length > 0) {
            const knn = classifyKNN(ts.features, studentSamplesOfClass, 1);
            if (knn.minDistance > 0.65) return false;
          }
          return true;
        });

        validTeacherSamples.forEach(ts => {
          if (ts.features && ts.features.length > 0) {
            const prediction = classifyKNNDetailed(ts.features, samples, k);
            const expectedLabel = config.classes.find(c => c.id === ts.sourceId)?.label || ts.label;
            const predictedLabel = config.classes.find(c => c.id === prediction.label)?.label || prediction.label;
            
            if (!labelsMatch(predictedLabel, expectedLabel, config.classes) && !labelsMatch(prediction.label, expectedLabel, config.classes)) {
              conflicts++;
            }
          }
        });
        
        crossCheck = {
          hasTeacherTemplate: true,
          totalSamples: validTeacherSamples.length,
          conflictCount: conflicts,
          agreementRate: validTeacherSamples.length > 0
            ? Math.round(((validTeacherSamples.length - conflicts) / validTeacherSamples.length) * 100)
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
        dynamicAccuracy,
        dynamicCorrectCount: dynamicCorrect,
        dynamicTotalCount: dynamicTotal,
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
