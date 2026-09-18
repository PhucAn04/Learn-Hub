import { StoredSample, classifyKNN } from './knn-classifier';
import { cosineSimilarity } from './reference-embeddings';
import { TfTrainer } from './tf-trainer';

export interface ImageCorrectnessIssue {
  studentSample: StoredSample;
  studentClassLabel: string;
  predictedClassLabel: string;
  confidence: number;
  nearestTeacherSample?: StoredSample;
  reason: string;
}

export interface ImageQualityIssue {
  classId: string;
  classLabel: string;
  total: number;
  darkCount: number;
  blurryCount: number;
  badSamples: StoredSample[];
}

export interface ImageValidationResult {
  hasTeacherTemplate: boolean;
  teacherSampleCount: number;
  teacherAccuracyScore: number | null; // Tỷ lệ % ảnh mẫu của GV mà AI của bé đoán đúng
  studentAccuracyScore: number;       // Tỷ lệ % ảnh của bé khớp chuẩn với mẫu GV
  correctnessIssues: ImageCorrectnessIssue[];
  qualityIssues: ImageQualityIssue[];
  balanceIssues: { id: string; label: string; count: number }[];
  isBalanced: boolean;
  hasIssues: boolean;
  summaryMessage: string;
}

/**
 * Xác thực dữ liệu ảnh / hành động của học sinh với bộ template của Giáo viên (hoặc Reference Dataset).
 * Hoàn toàn độc lập, không làm ảnh hưởng hay thay đổi logic của các bài teach trước.
 */
export async function validateStudentWithTeacherTemplate(
  studentSamples: StoredSample[],
  classes: { id: string; label: string; emoji?: string }[],
  teacherSamples: StoredSample[] = [],
  trainer?: TfTrainer | null
): Promise<ImageValidationResult> {
  const hasTeacherTemplate = teacherSamples.length > 0;
  const correctnessIssues: ImageCorrectnessIssue[] = [];
  const qualityIssues: ImageQualityIssue[] = [];

  // 1. Kiểm tra số lượng và độ cân bằng mẫu
  const counts: Record<string, number> = {};
  classes.forEach((c) => { counts[c.id] = 0; });
  studentSamples.forEach((s) => {
    const classId = s.sourceId || classes.find((c) => c.label === s.label)?.id;
    if (classId && counts[classId] !== undefined) {
      counts[classId]++;
    }
  });

  const balanceIssues = classes
    .filter((c) => counts[c.id] < 3)
    .map((c) => ({ id: c.id, label: c.label, count: counts[c.id] || 0 }));

  const countsList = Object.values(counts);
  const minCount = countsList.length > 0 ? Math.min(...countsList) : 0;
  const maxCount = countsList.length > 0 ? Math.max(...countsList) : 0;
  const isBalanced = balanceIssues.length === 0 && (maxCount === 0 || minCount / maxCount >= 0.5);

  // 2. Kiểm tra chất lượng ảnh (quá tối / quá mờ)
  classes.forEach((c) => {
    const classSamples = studentSamples.filter(
      (s) => (s.sourceId || classes.find((cl) => cl.label === s.label)?.id) === c.id
    );
    const withQuality = classSamples.filter((s) => s.quality);
    if (withQuality.length === 0) return;

    const darkOnes = withQuality.filter((s) => s.quality?.isDark);
    const blurryOnes = withQuality.filter((s) => s.quality?.isBlurry);
    const badOnes = withQuality.filter((s) => s.quality?.isDark || s.quality?.isBlurry);

    if (badOnes.length > withQuality.length * 0.4 && badOnes.length >= 2) {
      qualityIssues.push({
        classId: c.id,
        classLabel: c.label,
        total: classSamples.length,
        darkCount: darkOnes.length,
        blurryCount: blurryOnes.length,
        badSamples: badOnes.slice(0, 8),
      });
    }
  });

  // 3. Đối soát tính chính xác (Correctness Cross-Check)
  let correctStudentCount = 0;

  if (hasTeacherTemplate) {
    // Chiều 1: So sánh từng ảnh học sinh với bộ mẫu của Giáo viên
    for (const sample of studentSamples) {
      const studentLabel = sample.label;
      let bestSim = -1;
      let bestTeacherSample: StoredSample | null = null;

      // Tìm ảnh GV có độ tương đồng cosine cao nhất
      for (const tSample of teacherSamples) {
        if (!tSample.features || tSample.features.length === 0) continue;
        const sim = cosineSimilarity(sample.features, tSample.features);
        if (sim > bestSim) {
          bestSim = sim;
          bestTeacherSample = tSample;
        }
      }

      if (bestTeacherSample) {
        const isMatch = bestTeacherSample.label.toLowerCase() === studentLabel.toLowerCase();
        if (isMatch) {
          correctStudentCount++;
        } else if (bestSim >= 0.60) {
          // Giáo viên nhận diện ảnh này giống nhãn khác hơn
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: studentLabel,
            predictedClassLabel: bestTeacherSample.label,
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Theo mẫu của Thầy/Cô, ảnh này giống với "${bestTeacherSample.label}" hơn là "${studentLabel}" (${Math.round(bestSim * 100)}% tương đồng).`,
          });
        } else {
          // Độ tương đồng quá thấp
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: studentLabel,
            predictedClassLabel: 'Ảnh lạ / Không rõ',
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Ảnh này khác biệt khá nhiều so với các mẫu chuẩn của Thầy/Cô.`,
          });
        }
      } else {
        correctStudentCount++;
      }
    }
  } else {
    // Không có template của GV: Dùng Leave-One-Out KNN và Dataset Centroids chuẩn
    studentSamples.forEach((sample, idx) => {
      const studentLabel = sample.label;
      const otherSamples = studentSamples.filter((_, i) => i !== idx);

      // Check với các mẫu khác của bé
      if (otherSamples.length >= 3) {
        const knn = classifyKNN(sample.features, otherSamples, 3);
        const isMatch = knn.label.toLowerCase() === studentLabel.toLowerCase();
        if (isMatch) {
          correctStudentCount++;
        } else if (knn.confidence >= 65) {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: studentLabel,
            predictedClassLabel: knn.label,
            confidence: knn.confidence,
            reason: `So với các ảnh khác bé đã chụp, bức ảnh này giống nhãn "${knn.label}" hơn.`,
          });
        } else {
          correctStudentCount++;
        }
      } else {
        correctStudentCount++;
      }
    });
  }

  const studentAccuracyScore = studentSamples.length > 0
    ? Math.round((correctStudentCount / studentSamples.length) * 100)
    : 100;

  // 4. Chiều 2: Đánh giá mô hình của học sinh trên bộ mẫu Giáo viên (nếu có trainer)
  let teacherAccuracyScore: number | null = null;
  if (hasTeacherTemplate && trainer && trainer.isTrained()) {
    let teacherCorrectCount = 0;
    for (const tSample of teacherSamples) {
      try {
        const pred = await trainer.predict(tSample.features);
        if (pred && pred.label && pred.label.toLowerCase() === tSample.label.toLowerCase()) {
          teacherCorrectCount++;
        }
      } catch {
        // bỏ qua lỗi frame
      }
    }
    teacherAccuracyScore = Math.round((teacherCorrectCount / teacherSamples.length) * 100);
  }

  const hasIssues = correctnessIssues.length > 0 || qualityIssues.length > 0 || balanceIssues.length > 0;

  let summaryMessage = 'Dữ liệu của bé rất tuyệt vời!';
  if (correctnessIssues.length > 0 && qualityIssues.length > 0) {
    summaryMessage = `Phát hiện ${correctnessIssues.length} ảnh nghi ngờ sai nhãn và một số ảnh mờ/tối.`;
  } else if (correctnessIssues.length > 0) {
    summaryMessage = `Phát hiện ${correctnessIssues.length} ảnh có thể bị gán sai nhãn so với bộ mẫu.`;
  } else if (balanceIssues.length > 0) {
    summaryMessage = 'Bé cần chụp thêm ảnh cho các nhãn còn thiếu mẫu nhé.';
  } else if (qualityIssues.length > 0) {
    summaryMessage = 'Có một số ảnh hơi mờ hoặc tối, bé hãy kiểm tra lại nhé.';
  }

  return {
    hasTeacherTemplate,
    teacherSampleCount: teacherSamples.length,
    teacherAccuracyScore,
    studentAccuracyScore,
    correctnessIssues,
    qualityIssues,
    balanceIssues,
    isBalanced,
    hasIssues,
    summaryMessage,
  };
}
