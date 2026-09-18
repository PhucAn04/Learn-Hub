/**
 * Confusion Matrix Builder
 * Biến kết quả evaluateAgainstGolden() thành ma trận nhầm lẫn chi tiết.
 */

export interface ConfusionMatrixResult {
  labels: string[];
  matrix: number[][];
  perClassAccuracy: Record<string, number>;
  perClassPrecision: Record<string, number>;
  perClassRecall: Record<string, number>;
  weakestLabel: string;
  strongestLabel: string;
  misclassifications: {
    trueLabel: string;
    predictedLabel: string;
    count: number;
    percentage: number;
  }[];
}

export function buildConfusionMatrix(
  results: { expectedLabel: string; predictedLabel: string; isCorrect: boolean }[]
): ConfusionMatrixResult {
  // 1. Collect all labels
  const labelSet = new Set<string>();
  results.forEach(r => {
    labelSet.add(r.expectedLabel);
    labelSet.add(r.predictedLabel);
  });
  const labels = Array.from(labelSet).sort();
  const n = labels.length;
  const labelIndex = new Map(labels.map((l, i) => [l, i]));

  // 2. Build n×n matrix
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  results.forEach(r => {
    const actual = labelIndex.get(r.expectedLabel)!;
    const predicted = labelIndex.get(r.predictedLabel)!;
    if (actual !== undefined && predicted !== undefined) {
      matrix[actual][predicted]++;
    }
  });

  // 3. Per-class metrics
  const perClassAccuracy: Record<string, number> = {};
  const perClassPrecision: Record<string, number> = {};
  const perClassRecall: Record<string, number> = {};

  labels.forEach((label, i) => {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    const colSum = matrix.map(row => row[i]).reduce((a, b) => a + b, 0);
    const tp = matrix[i][i];

    perClassRecall[label] = rowSum > 0 ? Math.round((tp / rowSum) * 100) : 0;
    perClassPrecision[label] = colSum > 0 ? Math.round((tp / colSum) * 100) : 0;
    perClassAccuracy[label] = perClassRecall[label];
  });

  // 4. Find weakest/strongest
  let weakestLabel = labels.length > 0
    ? labels.reduce((a, b) => (perClassAccuracy[a] ?? 0) < (perClassAccuracy[b] ?? 0) ? a : b)
    : '';
  const strongestLabel = labels.length > 0
    ? labels.reduce((a, b) => (perClassAccuracy[a] ?? 0) > (perClassAccuracy[b] ?? 0) ? a : b)
    : '';

  // If the "weakest" label is already 100% accurate, then there is no weak label.
  if (weakestLabel && perClassAccuracy[weakestLabel] === 100) {
    weakestLabel = '';
  }

  // 5. Misclassifications (off-diagonal)
  const misclassifications: ConfusionMatrixResult['misclassifications'] = [];
  labels.forEach((trueLabel, i) => {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    labels.forEach((predLabel, j) => {
      if (i !== j && matrix[i][j] > 0) {
        misclassifications.push({
          trueLabel,
          predictedLabel: predLabel,
          count: matrix[i][j],
          percentage: rowSum > 0 ? Math.round((matrix[i][j] / rowSum) * 100) : 0,
        });
      }
    });
  });
  misclassifications.sort((a, b) => b.count - a.count);

  return {
    labels,
    matrix,
    perClassAccuracy,
    perClassPrecision,
    perClassRecall,
    weakestLabel,
    strongestLabel,
    misclassifications,
  };
}
