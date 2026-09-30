/**
 * Model Comparison Utility
 * So sánh 2 model versions để thấy delta.
 */

export interface ModelEvaluation {
  goldenAccuracy: number;
  confusionMatrix: {
    labels: string[];
    perClassAccuracy: Record<string, number>;
    weakestLabel: string;
  };
  datasetHealth: {
    sampleCount: number;
    classSummary: Record<string, number>;
    balanceRatio: number;
    qualityScore: number;
    blurrySampleCount: number;
    darkSampleCount: number;
  };
}

export interface VersionComparison {
  accuracyDelta: number;           // e.g., +25
  sampleCountDelta: number;        // e.g., +10
  balanceDelta: number;            // e.g., +0.15
  qualityDelta: number;            // e.g., +20
  perClassDelta: Record<string, number>;  // e.g., { '2 Ngón Tay': +30 }
  dataChanges: {
    label: string;
    before: number;
    after: number;
    delta: number;
  }[];
  improvements: string[];          // Human-readable improvements
  regressions: string[];           // Human-readable regressions
}

export function compareVersions(
  previous: ModelEvaluation,
  current: ModelEvaluation
): VersionComparison {
  const accuracyDelta = current.goldenAccuracy - previous.goldenAccuracy;
  const sampleCountDelta = current.datasetHealth.sampleCount - previous.datasetHealth.sampleCount;
  const balanceDelta = current.datasetHealth.balanceRatio - previous.datasetHealth.balanceRatio;
  const qualityDelta = current.datasetHealth.qualityScore - previous.datasetHealth.qualityScore;

  // Per-class accuracy delta
  const perClassDelta: Record<string, number> = {};
  const allLabels = new Set([
    ...Object.keys(current.confusionMatrix.perClassAccuracy),
    ...Object.keys(previous.confusionMatrix.perClassAccuracy),
  ]);
  allLabels.forEach(label => {
    const cur = current.confusionMatrix.perClassAccuracy[label] ?? 0;
    const prev = previous.confusionMatrix.perClassAccuracy[label] ?? 0;
    perClassDelta[label] = cur - prev;
  });

  // Data changes per label
  const allDataLabels = new Set([
    ...Object.keys(current.datasetHealth.classSummary),
    ...Object.keys(previous.datasetHealth.classSummary),
  ]);
  const dataChanges = Array.from(allDataLabels).map(label => ({
    label,
    before: previous.datasetHealth.classSummary[label] ?? 0,
    after: current.datasetHealth.classSummary[label] ?? 0,
    delta: (current.datasetHealth.classSummary[label] ?? 0) - (previous.datasetHealth.classSummary[label] ?? 0),
  })).filter(c => c.delta !== 0);

  // Human-readable summaries
  const improvements: string[] = [];
  const regressions: string[] = [];

  if (accuracyDelta > 0) improvements.push(`Độ chính xác tăng ${accuracyDelta}%`);
  else if (accuracyDelta < 0) regressions.push(`Độ chính xác giảm ${Math.abs(accuracyDelta)}%`);

  if (balanceDelta > 0.1) improvements.push('Cân bằng dữ liệu tốt hơn');
  if (qualityDelta > 10) improvements.push('Chất lượng ảnh cải thiện');

  const blurryDelta = current.datasetHealth.blurrySampleCount - previous.datasetHealth.blurrySampleCount;
  if (blurryDelta < 0) improvements.push(`Xóa ${Math.abs(blurryDelta)} ảnh mờ`);

  dataChanges.forEach(c => {
    if (c.delta > 0) improvements.push(`Thêm ${c.delta} ảnh "${c.label}"`);
    else if (c.delta < 0) improvements.push(`Xóa ${Math.abs(c.delta)} ảnh "${c.label}"`);
  });

  return {
    accuracyDelta,
    sampleCountDelta,
    balanceDelta,
    qualityDelta,
    perClassDelta,
    dataChanges,
    improvements,
    regressions,
  };
}
