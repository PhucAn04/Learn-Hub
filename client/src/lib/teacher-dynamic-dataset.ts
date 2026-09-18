/**
 * Teacher Dynamic Dataset — "Golden Dataset động" cho nhãn tuỳ chỉnh
 *
 * File này KHÔNG chứa data cố định (hardcoded) như golden-dataset.ts.
 * Thay vào đó, nó cung cấp:
 *   1. Interface và type cho dynamic dataset entries
 *   2. Hàm buildDynamicDataset() — tạo mảng từ Teacher template samples
 *   3. Hàm evaluateAgainstDynamic() — đánh giá Student dựa trên mảng này
 *
 * NGUỒN DỮ LIỆU: Teacher's template samples (API getTemplates → samples[])
 * MỤC ĐÍCH: Đánh giá Student cho các nhãn custom (3/4/5 Ngón Tay)
 *            mà Golden Dataset tĩnh không cover.
 *
 * LƯU Ý: File này TÁCH BIỆT khỏi golden-dataset.ts vì golden-dataset.ts
 *         được dùng chung bởi cả 'teach' và 'teach-two-hands'.
 *         Thêm nhãn 3/4/5 vào golden-dataset.ts sẽ gây nhiễu KNN cho teach-two-hands.
 */

import { classifyKNN, type StoredSample } from './knn-classifier';

export interface DynamicDatasetSample {
  features: number[];
  expectedLabel: string;
}

/**
 * Build dynamic "golden" dataset từ Teacher template samples.
 * Chỉ lấy samples có nhãn KHÔNG thuộc nhãn cơ bản (1/2 ngón).
 */
export function buildDynamicDataset(
  teacherSamples: { features: number[]; label: string; isValid?: boolean }[],
  baseLabels: string[] = ['1 Ngón Tay ☝️', '2 Ngón Tay ✌️']
): DynamicDatasetSample[] {
  return teacherSamples
    .filter(s => !baseLabels.includes(s.label) && s.isValid !== false)
    .map(s => ({
      features: s.features,
      expectedLabel: s.label,
    }));
}

/**
 * Đánh giá Student samples dựa trên Dynamic Dataset (Teacher's data cho nhãn custom).
 * Dùng KNN tương tự evaluateAgainstGolden() nhưng chạy trên mảng động.
 */
export function evaluateAgainstDynamic(
  studentSamples: StoredSample[],
  dynamicDataset: DynamicDatasetSample[],
  k: number = 3
): { accuracy: number; correctCount: number; totalCount: number } {
  if (dynamicDataset.length === 0) {
    return { accuracy: 100, correctCount: 0, totalCount: 0 };
  }

  // Filter student samples to only include dynamic labels
  const dynamicLabels = [...new Set(dynamicDataset.map(d => d.expectedLabel))];
  const relevantStudentSamples = studentSamples.filter(s => dynamicLabels.includes(s.label));

  if (relevantStudentSamples.length === 0) {
    return { accuracy: 0, correctCount: 0, totalCount: dynamicDataset.length };
  }

  let correctCount = 0;
  dynamicDataset.forEach(testCase => {
    const result = classifyKNN(testCase.features, relevantStudentSamples, k);
    if (result.label === testCase.expectedLabel) {
      correctCount++;
    }
  });

  return {
    accuracy: Math.round((correctCount / dynamicDataset.length) * 100),
    correctCount,
    totalCount: dynamicDataset.length,
  };
}
