/**
 * KNN Teacher Classifier — Distance-weighted KNN cho Teacher evaluation
 *
 * File nay TACH BIET voi knn-classifier.ts (Vote-based cho Student).
 * Dung Distance-weighted confidence de danh gia chat che hon khi be nop bai.
 *
 * Luong su dung:
 *   - Co Teacher Samples → evaluateStudentImagesWithTeacher()
 *   - Khong co Teacher  → evaluateStudentImagesWithReference() (dung TEACHER_REFERENCE_DATASET)
 */

import type { StoredSample } from './knn-classifier';
import { TEACHER_REFERENCE_DATASET } from './teacher-reference-dataset';

export interface StudentImageAuditItem {
  id: string;
  expectedLabel: string;
  predictedLabel: string;
  isMatch: boolean;
  confidence: number;
  distanceToTeacher?: number; // Added to help soften the confidence
  evaluationSource: 'teacher' | 'golden' | 'self';
  thumbnail?: string;
}

/**
 * KNN Classification voi Distance-weighted confidence.
 * Thay vi dem so phieu (vote-based), tinh trong so dua tren khoang cach:
 *   - Hang xom gan → trong so lon → tieng noi lon hon
 *   - Hang xom xa  → trong so nho → tieng noi nho hon
 * 
 * Cong thuc: weight = 1 / (distance + EPSILON)
 * Confidence = (tong trong so cua nhan thang) / (tong trong so tat ca) * 100
 */
function classifyKNNTeacher(
  newFeatures: number[],
  samples: { label: string; features: number[] }[],
  k: number = 3
) {
  if (!samples || samples.length === 0) {
    return { label: 'Chưa có dữ liệu', confidence: 0, confidences: {} as Record<string, number>, nearest: [] as { label: string; distance: number }[], counts: {} as Record<string, number>, avgDistance: 0 };
  }

  // Tinh khoang cach Euclid den tat ca mau
  const distances = samples.map(sample => {
    let sumSq = 0;
    for (let i = 0; i < newFeatures.length; i++) {
      const diff = sample.features[i] - newFeatures[i];
      sumSq += diff * diff;
    }
    return {
      label: sample.label,
      distance: Math.sqrt(sumSq),
    };
  });

  // Sap xep theo khoang cach tang dan
  distances.sort((a, b) => a.distance - b.distance);

  // Lay K hang xom gan nhat
  const actualK = Math.min(k, distances.length);
  const nearest = distances.slice(0, actualK);

  // Dem so phieu (van can de xac dinh nhan thang)
  const counts: Record<string, number> = {};
  nearest.forEach(n => {
    counts[n.label] = (counts[n.label] || 0) + 1;
  });

  // Tim nhan co nhieu phieu nhat
  let bestLabel = 'unknown';
  let maxCount = 0;
  for (const label in counts) {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
      bestLabel = label;
    }
  }

  // Distance-weighted confidence
  const EPSILON = 0.0001;
  let totalWeight = 0;
  const labelWeights: Record<string, number> = {};

  nearest.forEach(n => {
    const weight = 1 / (n.distance + EPSILON);
    totalWeight += weight;
    labelWeights[n.label] = (labelWeights[n.label] || 0) + weight;
  });

  const confidences: Record<string, number> = {};
  for (const label in labelWeights) {
    confidences[label] = totalWeight > 0 ? (labelWeights[label] / totalWeight) * 100 : 0;
  }
  const confidence = confidences[bestLabel] ? Math.round(confidences[bestLabel]) : 0;

  // Khoang cach trung binh cua nhan thang
  const winningNeighbors = nearest.filter(n => n.label === bestLabel);
  const avgDistance = winningNeighbors.length > 0
    ? winningNeighbors.reduce((sum, n) => sum + n.distance, 0) / winningNeighbors.length
    : 0;

  return {
    label: bestLabel,
    confidence,
    confidences, // Return confidences for all labels
    nearest,
    counts,
    avgDistance,
  };
}

function calculateImageAuditConfidence(
  knnConfidences: Record<string, number>,
  expectedLabel: string,
  sample: StoredSample,
  avgDistance: number
): number {
  // Lấy độ tự tin của nhãn mong muốn (thay vì nhãn thắng)
  let score = knnConfidences[expectedLabel] || 0;
  
  // Làm mềm điểm số dựa trên khoảng cách tuyệt đối đến mẫu chuẩn
  // Tránh việc KNN có 5/5 phiếu bầu đều ra 100% (cần linh hoạt 0-100)
  if (score > 0 && avgDistance > 0) {
    const distancePenalty = Math.min(45, avgDistance * 60);
    score -= distancePenalty;
  }
  
  // Trừ điểm nếu ảnh mờ/tối
  if (sample.quality?.isBlurry) {
    score -= 30;
  }
  if (sample.quality?.isDark) {
    score -= 30;
  }
  
  // Đảm bảo score trong khoảng 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Tang 1: Danh gia tung anh hoc sinh bang Teacher Samples (GV chup)
 * Dung khi co teacher samples.
 */
export function evaluateStudentImagesWithTeacher(
  studentSamples: StoredSample[],
  teacherSamples: StoredSample[],
  classes: { id: string; label: string }[],
  k: number = 3
): StudentImageAuditItem[] {
  const audit: StudentImageAuditItem[] = [];

  studentSamples.forEach((sample, index) => {
    const sampleClassId = sample.sourceId || classes.find(c => c.label === sample.label)?.id || sample.label;
    const expectedLabel = classes.find(c => c.id === sampleClassId)?.label || sample.label;

    const knn = classifyKNNTeacher(sample.features, teacherSamples, k);
    const predictedClassId = classes.find(c => c.label === knn.label)?.id || knn.label;
    const predictedLabel = classes.find(c => c.id === predictedClassId)?.label || knn.label;
    const isMatch = predictedClassId === sampleClassId || predictedLabel === expectedLabel;

    const auditConfidence = calculateImageAuditConfidence(knn.confidences, expectedLabel, sample, knn.avgDistance);

    audit.push({
      id: sample.id || `sample-${index}`,
      expectedLabel,
      predictedLabel,
      isMatch,
      confidence: auditConfidence,
      distanceToTeacher: knn.avgDistance,
      evaluationSource: 'teacher',
      thumbnail: sample.thumbnail || sample.rawThumbnail,
    });
  });

  return audit;
}

/**
 * Tang 2: Danh gia tung anh hoc sinh bang Teacher Reference Dataset (Kaggle)
 * Dung khi KHONG co teacher samples — "giao vien ao" tu bo du lieu chuan.
 */
export function evaluateStudentImagesWithReference(
  studentSamples: StoredSample[],
  classes: { id: string; label: string }[],
  k: number = 3
): StudentImageAuditItem[] {
  const audit: StudentImageAuditItem[] = [];

  // Chuyen TEACHER_REFERENCE_DATASET thanh dinh dang tuong thich
  const refSamples = TEACHER_REFERENCE_DATASET.map(ref => ({
    label: ref.expectedLabel,
    features: ref.features,
  }));

  studentSamples.forEach((sample, index) => {
    const sampleClassId = sample.sourceId || classes.find(c => c.label === sample.label)?.id || sample.label;
    const expectedLabel = classes.find(c => c.id === sampleClassId)?.label || sample.label;

    const knn = classifyKNNTeacher(sample.features, refSamples, k);
    const predictedClassId = classes.find(c => c.label === knn.label)?.id || knn.label;
    const predictedLabel = classes.find(c => c.id === predictedClassId)?.label || knn.label;
    const isMatch = predictedClassId === sampleClassId || predictedLabel === expectedLabel;

    const auditConfidence = calculateImageAuditConfidence(knn.confidences, expectedLabel, sample, knn.avgDistance);

    audit.push({
      id: sample.id || `sample-${index}-ref`,
      expectedLabel,
      predictedLabel,
      isMatch,
      confidence: auditConfidence,
      distanceToTeacher: knn.avgDistance,
      evaluationSource: 'golden',
      thumbnail: sample.thumbnail || sample.rawThumbnail,
    });
  });

  return audit;
}
