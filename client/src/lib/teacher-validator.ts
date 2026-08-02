import { StoredSample, classifyKNN, classifyKNNDetailed, analyzeDataBalance, countExtendedFingers, HandKeypoint } from './knn-classifier';
import { TfTrainer } from './tf-trainer';

export type DatasetPhase = 'PHASE_A' | 'PHASE_B';

export interface DatasetQualityResult {
  phase: DatasetPhase;
  isDatasetPerfect: boolean; // true for Phase B, false for Phase A
  reasons: string[];
  balanceInfo: ReturnType<typeof analyzeDataBalance>;
  hasEnoughSamples: boolean;
  hasNoQualityIssues: boolean;
}

export interface CrossCheckResult {
  isAnomaly: boolean;          // High distance or low confidence
  isOOD: boolean;              // Out of Distribution (e.g. 3 fingers when dataset only has 1 & 2)
  isConflict: boolean;         // Teacher predicts class A, Student predicts class B
  studentLabel: string;
  studentConfidence: number;
  teacherLabel?: string;
  teacherConfidence?: number;
  message?: string;
}

/**
 * Evaluates student dataset quality to determine if it meets Phase B (Perfect/Diligent) or Phase A (Basic/Lazy).
 * 
 * Phase A: Has minimum samples (>=3 per class), no severe quality issues (dark/blurry <= 50%), BUT imbalanced (e.g., 10 vs 20).
 * Phase B: Satisfies Phase A AND has a balanced distribution across all classes.
 */
export function evaluateStudentDatasetPhase(
  studentSamples: StoredSample[],
  classes: { id: string; label: string }[],
  minSamplesPhaseA: number = 3,
  minSamplesPhaseB: number = 10
): DatasetQualityResult {
  const reasons: string[] = [];

  // Count samples per class
  const counts: Record<string, number> = {};
  classes.forEach(c => (counts[c.id] = 0));
  studentSamples.forEach(s => {
    const classId = s.sourceId || classes.find(c => c.label === s.label)?.id;
    if (classId && counts[classId] !== undefined) {
      counts[classId]++;
    }
  });

  // Check minimum samples for Phase A (>= 3)
  const missingPhaseA = classes.filter(c => counts[c.id] < minSamplesPhaseA);
  const hasEnoughPhaseA = missingPhaseA.length === 0;

  // Check minimum samples for Phase B (>= 10)
  const missingPhaseB = classes.filter(c => counts[c.id] < minSamplesPhaseB);
  const hasEnoughPhaseB = missingPhaseB.length === 0;

  if (!hasEnoughPhaseA) {
    reasons.push(`Cần ít nhất ${minSamplesPhaseA} ảnh cho mỗi nhãn (hiện thiếu ở nhãn: ${missingPhaseA.map(c => c.label).join(', ')})`);
  } else if (!hasEnoughPhaseB) {
    reasons.push(`Để bộ dữ liệu thật sự hoàn thiện, cần ít nhất ${minSamplesPhaseB} ảnh cho mỗi nhãn (hiện thiếu ở nhãn: ${missingPhaseB.map(c => c.label).join(', ')})`);
  }

  // Check image quality issues
  let severeQualityCount = 0;
  const withQuality = studentSamples.filter(s => s.quality);
  if (withQuality.length > 0) {
    const badSamples = withQuality.filter(s => s.quality!.isDark || s.quality!.isBlurry);
    if (badSamples.length > withQuality.length * 0.5 && badSamples.length >= 3) {
      severeQualityCount = badSamples.length;
      reasons.push(`Có ${badSamples.length}/${withQuality.length} ảnh bị mờ hoặc tối.`);
    }
  }
  const hasNoQualityIssues = severeQualityCount === 0;

  // Check data balance
  const balanceInfo = analyzeDataBalance(studentSamples);
  const isBalanced = !balanceInfo.isImbalanced;

  if (balanceInfo.isImbalanced) {
    reasons.push(balanceInfo.message);
  }

  // Determine Phase:
  // Phase B requires: >= 10 samples per class + no severe quality issues + balanced data.
  // Phase A: satisfies basic minimums (>= 3 samples per class + valid quality).
  const isDatasetPerfect = hasEnoughPhaseB && hasNoQualityIssues && isBalanced;
  const phase: DatasetPhase = isDatasetPerfect ? 'PHASE_B' : 'PHASE_A';

  return {
    phase,
    isDatasetPerfect,
    reasons,
    balanceInfo,
    hasEnoughSamples: hasEnoughPhaseA,
    hasNoQualityIssues,
  };
}

/**
 * Cross-checks live features against both Student dataset and Teacher template (when available).
 * OOD threshold for normalized hand landmark Euclidean distance is typically ~0.65 - 0.75.
 */
export function crossCheckLiveFeatures(
  liveFeatures: number[],
  studentSamples: StoredSample[],
  teacherSamples: StoredSample[] = [],
  kValue: number = 3,
  threshold: number = 2,
  distanceOodThreshold: number = 0.65,
  rawKeypoints?: HandKeypoint[],
  teacherTrainer?: TfTrainer
): CrossCheckResult {
  const studentResult = classifyKNN(liveFeatures, studentSamples, kValue);

  // Finger count heuristic for hand challenges (Detect fist / 0 fingers or 3+ fingers)
  let isFingerOOD = false;
  if (rawKeypoints && rawKeypoints.length >= 21) {
    const extFingers = countExtendedFingers(rawKeypoints);
    if (extFingers === 0 || extFingers >= 3) {
      isFingerOOD = true;
    }
  }

  if (!teacherSamples || teacherSamples.length === 0) {
    // No teacher template available, perform standard student check
    const isOOD = isFingerOOD || studentResult.minDistance > distanceOodThreshold;
    return {
      isAnomaly: isOOD || studentResult.maxCount < threshold,
      isOOD,
      isConflict: false,
      studentLabel: studentResult.label,
      studentConfidence: studentResult.confidence,
    };
  }

  const teacherResult = classifyKNN(liveFeatures, teacherSamples, kValue);

  // Structural Skeleton Validation against Teacher Model:
  // If Teacher Skeleton Model recognizes the normalized keypoint skeleton as a valid class with high confidence:
  const isTeacherValidPose = teacherResult.confidence >= 60 && teacherResult.minDistance <= 0.65;

  // Check if live pose is far from teacher's known skeleton poses (OOD)
  const isOODToTeacher = isFingerOOD || (!isTeacherValidPose && teacherResult.minDistance > distanceOodThreshold);
  const isOODToStudent = isFingerOOD || (!isTeacherValidPose && studentResult.minDistance > distanceOodThreshold);

  // Check if teacher predicts a different label with high consensus
  const isConflict =
    !isFingerOOD &&
    teacherResult.maxCount >= threshold &&
    studentResult.maxCount >= threshold &&
    teacherResult.label !== studentResult.label;

  let message = '';
  if (isOODToTeacher || isOODToStudent) {
    message = 'Dữ liệu chưa được học! Hình như bé đang thực hiện cử chỉ lạ (ngoài thư viện ảnh của bé)?';
  } else if (isConflict) {
    message = `Khoan đã! Cô thấy đây là "${teacherResult.label}". AI của bé đoán nhầm là "${studentResult.label}"!`;
  }

  return {
    isAnomaly: isOODToTeacher || isOODToStudent || isConflict,
    isOOD: isOODToTeacher || isOODToStudent,
    isConflict,
    studentLabel: studentResult.label,
    studentConfidence: studentResult.confidence,
    teacherLabel: teacherResult.label,
    teacherConfidence: teacherResult.confidence,
    message,
  };
}

/**
 * Validates a list of student samples against a trained Teacher Neural Model (TfTrainer).
 * Runs each student image sample through the Teacher's trained neural network model.
 */
export async function validateStudentSamplesWithTeacherModel(
  studentSamples: StoredSample[],
  teacherSamples: StoredSample[],
  teacherTrainer?: TfTrainer
): Promise<{
  results: {
    studentSample: StoredSample;
    predictedByTeacherModel: string;
    teacherConfidence: number;
    isValid: boolean;
    reason?: string;
  }[];
  accuracyScore: number;
}> {
  if (!teacherSamples || teacherSamples.length === 0 || studentSamples.length === 0) {
    return { results: [], accuracyScore: 100 };
  }

  let trainer = teacherTrainer;
  if (!trainer || typeof trainer.isTrained !== 'function' || !trainer.isTrained()) {
    const { TfTrainer } = await import('./tf-trainer');
    trainer = new TfTrainer();
    await trainer.train(teacherSamples, undefined, { epochs: 25 });
  }

  let correctCount = 0;
  const results = await Promise.all(
    studentSamples.map(async (sample) => {
      const pred = await trainer!.predict(sample.features);
      const studentClassLabel = sample.label;
      const isMatch = pred.label === studentClassLabel && pred.confidence >= 40;
      if (isMatch) correctCount++;

      let reason: string | undefined;
      if (pred.confidence < 40) {
        reason = 'Mô hình Giáo viên không nhận dạng được tư thế này (Tự tin < 40%).';
      } else if (pred.label !== studentClassLabel) {
        reason = `Mô hình Giáo viên đoán tư thế này là "${pred.label}" chứ không phải "${studentClassLabel}".`;
      }

      return {
        studentSample: sample,
        predictedByTeacherModel: pred.label,
        teacherConfidence: pred.confidence,
        isValid: isMatch,
        reason,
      };
    })
  );

  const accuracyScore = Math.round((correctCount / studentSamples.length) * 100);
  return { results, accuracyScore };
}
