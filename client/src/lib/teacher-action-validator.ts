import { StoredSample, classifyKNN } from './knn-classifier';
import { cosineSimilarity } from './reference-embeddings';
import { TfTrainer } from './tf-trainer';

export interface ActionCorrectnessIssue {
  studentSample: StoredSample;
  studentClassLabel: string;
  sourceType: 'object' | 'gesture';
  predictedClassLabel: string;
  confidence: number;
  nearestTeacherSample?: StoredSample;
  reason: string;
}

export interface ActionPairingIssue {
  classId: string;
  classLabel: string;
  emoji?: string;
  objectCount: number;
  gestureCount: number;
  hasObject: boolean;
  hasGesture: boolean;
  status: 'balanced' | 'missing_gesture' | 'missing_object' | 'low_samples';
  recommendation: string;
}

export interface ActionQualityIssue {
  classId: string;
  classLabel: string;
  total: number;
  darkCount: number;
  blurryCount: number;
  badSamples: StoredSample[];
}

export interface ActionValidationResult {
  hasTeacherTemplate: boolean;
  teacherSampleCount: number;
  teacherObjectCount: number;
  teacherGestureCount: number;

  studentSampleCount: number;
  studentObjectCount: number;
  studentGestureCount: number;

  overallAccuracyScore: number; // Điểm tổng hợp
  objectAccuracyScore: number;  // Độ chuẩn xác ảnh đối tượng
  gestureAccuracyScore: number; // Độ chuẩn xác cử chỉ hành động

  teacherModelAccuracy: number | null; // AI của bé đoán đúng bao nhiêu % mẫu của GV (cả object & gesture)

  correctnessIssues: ActionCorrectnessIssue[];
  pairingIssues: ActionPairingIssue[];
  qualityIssues: ActionQualityIssue[];

  isPairingHealthy: boolean;
  hasIssues: boolean;
  summaryMessage: string;
}

/**
 * Xác thực dữ liệu bài Teach Action (Hành động & Đối tượng) của học sinh:
 * 1. Phân tách đối soát ảnh Đối tượng (Object) vs ảnh Đối tượng GV.
 * 2. Phân tách đối soát Cử chỉ (Gesture) vs Cử chỉ GV.
 * 3. Kiểm tra tính cân bằng Cặp Hành Động - Đối Tượng (Pairing Balance).
 * 4. Kiểm tra chất lượng ảnh (mờ/tối).
 */
export async function validateStudentActionWithTeacherTemplate(
  studentSamples: StoredSample[],
  classes: { id: string; label: string; emoji?: string }[],
  teacherSamples: StoredSample[] = [],
  trainer?: TfTrainer | null
): Promise<ActionValidationResult> {
  const hasTeacherTemplate = teacherSamples.length > 0;
  const correctnessIssues: ActionCorrectnessIssue[] = [];
  const qualityIssues: ActionQualityIssue[] = [];

  // Tách biệt các tập dữ liệu theo sourceType
  const studentObjects = studentSamples.filter((s) => s.sourceType === 'object' || !s.sourceType);
  const studentGestures = studentSamples.filter((s) => s.sourceType === 'gesture');

  const teacherObjects = teacherSamples.filter((s) => s.sourceType === 'object' || !s.sourceType);
  const teacherGestures = teacherSamples.filter((s) => s.sourceType === 'gesture');

  // 1. Kiểm tra tính Cân Bằng Cặp (Action - Object Pairing Analysis)
  const pairingIssues: ActionPairingIssue[] = [];
  let isPairingHealthy = true;

  classes.forEach((c) => {
    const classSamples = studentSamples.filter(
      (s) => (s.sourceId || classes.find((cl) => cl.label === s.label)?.id) === c.id
    );
    const objCount = classSamples.filter((s) => s.sourceType === 'object' || !s.sourceType).length;
    const gesCount = classSamples.filter((s) => s.sourceType === 'gesture').length;

    const hasObject = objCount >= 2;
    const hasGesture = gesCount >= 3;

    let status: ActionPairingIssue['status'] = 'balanced';
    let recommendation = 'Đã có đủ cả ảnh đối tượng và cử chỉ hành động! Rất tốt!';

    if (!hasObject && !hasGesture) {
      status = 'low_samples';
      recommendation = 'Nhãn này chưa có đủ dữ liệu. Bé hãy chụp thêm ảnh đối tượng và quay cử chỉ nhé!';
      isPairingHealthy = false;
    } else if (!hasGesture) {
      status = 'missing_gesture';
      recommendation = `Bé mới chỉ có ${objCount} ảnh đối tượng, chưa quay cử chỉ hành động! Hãy quay thêm cử chỉ nhé.`;
      isPairingHealthy = false;
    } else if (!hasObject) {
      status = 'missing_object';
      recommendation = `Bé đã có ${gesCount} khung hình cử chỉ nhưng chưa chụp ảnh vật thể! Hãy chụp thêm ảnh đối tượng.`;
      isPairingHealthy = false;
    }

    pairingIssues.push({
      classId: c.id,
      classLabel: c.label,
      emoji: c.emoji,
      objectCount: objCount,
      gestureCount: gesCount,
      hasObject,
      hasGesture,
      status,
      recommendation,
    });
  });

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

  // 3. Đối Soát Tính Chuẩn Xác (Correctness Cross-Check tách biệt 2 nguồn)
  let correctObjectCount = 0;
  let correctGestureCount = 0;

  // A. Đối soát tập Đối tượng (Object)
  if (teacherObjects.length > 0) {
    // So sánh đối tượng của bé với đối tượng của GV
    for (const sample of studentObjects) {
      let bestSim = -1;
      let bestTeacherSample: StoredSample | null = null;

      for (const tSample of teacherObjects) {
        if (!tSample.features || tSample.features.length === 0) continue;
        const sim = cosineSimilarity(sample.features, tSample.features);
        if (sim > bestSim) {
          bestSim = sim;
          bestTeacherSample = tSample;
        }
      }

      if (bestTeacherSample) {
        const isMatch = bestTeacherSample.label.toLowerCase() === sample.label.toLowerCase();
        if (isMatch) {
          correctObjectCount++;
        } else if (bestSim >= 0.60) {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'object',
            predictedClassLabel: bestTeacherSample.label,
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Ảnh đối tượng này giống vật thể "${bestTeacherSample.label}" của Thầy/Cô hơn (${Math.round(bestSim * 100)}% tương đồng).`,
          });
        } else {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'object',
            predictedClassLabel: 'Vật thể lạ / Chưa rõ',
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Ảnh đối tượng này khác biệt khá nhiều so với các mẫu vật thể chuẩn của Thầy/Cô.`,
          });
        }
      } else {
        correctObjectCount++;
      }
    }
  } else {
    // Không có teacher objects -> Dùng Leave-One-Out KNN trên studentObjects
    studentObjects.forEach((sample, idx) => {
      const otherObjects = studentObjects.filter((_, i) => i !== idx);
      if (otherObjects.length >= 3) {
        const knn = classifyKNN(sample.features, otherObjects, 3);
        const isMatch = knn.label.toLowerCase() === sample.label.toLowerCase();
        if (isMatch) {
          correctObjectCount++;
        } else if (knn.confidence >= 65) {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'object',
            predictedClassLabel: knn.label,
            confidence: knn.confidence,
            reason: `So với các ảnh vật thể khác bé đã chụp, ảnh này giống nhãn "${knn.label}" hơn.`,
          });
        } else {
          correctObjectCount++;
        }
      } else {
        correctObjectCount++;
      }
    });
  }

  // B. Đối soát tập Cử chỉ hành động (Gesture)
  if (teacherGestures.length > 0) {
    // So sánh cử chỉ của bé với cử chỉ của GV
    for (const sample of studentGestures) {
      let bestSim = -1;
      let bestTeacherSample: StoredSample | null = null;

      for (const tSample of teacherGestures) {
        if (!tSample.features || tSample.features.length === 0) continue;
        const sim = cosineSimilarity(sample.features, tSample.features);
        if (sim > bestSim) {
          bestSim = sim;
          bestTeacherSample = tSample;
        }
      }

      if (bestTeacherSample) {
        const isMatch = bestTeacherSample.label.toLowerCase() === sample.label.toLowerCase();
        if (isMatch) {
          correctGestureCount++;
        } else if (bestSim >= 0.60) {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'gesture',
            predictedClassLabel: bestTeacherSample.label,
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Cử chỉ này giống cử chỉ hành động "${bestTeacherSample.label}" của Thầy/Cô hơn (${Math.round(bestSim * 100)}% tương đồng).`,
          });
        } else {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'gesture',
            predictedClassLabel: 'Cử chỉ lạ / Chưa rõ',
            confidence: Math.round(bestSim * 100),
            nearestTeacherSample: bestTeacherSample,
            reason: `Khung hình cử chỉ này khác biệt so với các bài mẫu cử chỉ của Thầy/Cô.`,
          });
        }
      } else {
        correctGestureCount++;
      }
    }
  } else {
    // Không có teacher gestures -> Dùng Leave-One-Out KNN trên studentGestures
    studentGestures.forEach((sample, idx) => {
      const otherGestures = studentGestures.filter((_, i) => i !== idx);
      if (otherGestures.length >= 3) {
        const knn = classifyKNN(sample.features, otherGestures, 3);
        const isMatch = knn.label.toLowerCase() === sample.label.toLowerCase();
        if (isMatch) {
          correctGestureCount++;
        } else if (knn.confidence >= 65) {
          correctnessIssues.push({
            studentSample: sample,
            studentClassLabel: sample.label,
            sourceType: 'gesture',
            predictedClassLabel: knn.label,
            confidence: knn.confidence,
            reason: `Khung hình cử chỉ này giống hành động của nhãn "${knn.label}" hơn.`,
          });
        } else {
          correctGestureCount++;
        }
      } else {
        correctGestureCount++;
      }
    });
  }

  const objectAccuracyScore = studentObjects.length > 0
    ? Math.round((correctObjectCount / studentObjects.length) * 100)
    : 100;

  const gestureAccuracyScore = studentGestures.length > 0
    ? Math.round((correctGestureCount / studentGestures.length) * 100)
    : 100;

  const totalCorrect = correctObjectCount + correctGestureCount;
  const overallAccuracyScore = studentSamples.length > 0
    ? Math.round((totalCorrect / studentSamples.length) * 100)
    : 100;

  // 4. Kiểm tra mô hình của bé trên bộ mẫu của Giáo viên
  let teacherModelAccuracy: number | null = null;
  if (hasTeacherTemplate && trainer && trainer.isTrained()) {
    let teacherCorrectCount = 0;
    for (const tSample of teacherSamples) {
      try {
        const pred = await trainer.predict(tSample.features);
        if (pred && pred.label && pred.label.toLowerCase() === tSample.label.toLowerCase()) {
          teacherCorrectCount++;
        }
      } catch {
        // bỏ qua frame lỗi
      }
    }
    teacherModelAccuracy = Math.round((teacherCorrectCount / teacherSamples.length) * 100);
  }

  const hasIssues = correctnessIssues.length > 0 || !isPairingHealthy || qualityIssues.length > 0;

  let summaryMessage = 'Dữ liệu hành động và đối tượng của bé rất xuất sắc!';
  if (!isPairingHealthy) {
    summaryMessage = 'Bé cần bổ sung thêm cử chỉ hoặc ảnh đối tượng cho các nhãn chưa đủ cặp nhé.';
  } else if (correctnessIssues.length > 0) {
    summaryMessage = `Phát hiện ${correctnessIssues.length} mẫu có thể bị gán nhầm hành động hoặc đối tượng.`;
  } else if (qualityIssues.length > 0) {
    summaryMessage = 'Có một số ảnh bị mờ hoặc tối, bé hãy kiểm tra lại nhé.';
  }

  return {
    hasTeacherTemplate,
    teacherSampleCount: teacherSamples.length,
    teacherObjectCount: teacherObjects.length,
    teacherGestureCount: teacherGestures.length,

    studentSampleCount: studentSamples.length,
    studentObjectCount: studentObjects.length,
    studentGestureCount: studentGestures.length,

    overallAccuracyScore,
    objectAccuracyScore,
    gestureAccuracyScore,

    teacherModelAccuracy,

    correctnessIssues,
    pairingIssues,
    qualityIssues,

    isPairingHealthy,
    hasIssues,
    summaryMessage,
  };
}
