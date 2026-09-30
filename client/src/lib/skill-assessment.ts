/**
 * Skill Assessment Calculator
 * Tính điểm kỹ năng tổng kết dựa trên chuỗi model versions + action logs.
 */

export interface ModelChainItem {
  modelId: string;
  version: number;
  testScore: number;
  sampleCount: number;
  classSummary: Record<string, number>;
  balanceRatio?: number;
  qualityScore?: number;
}

export interface ActionLogItem {
  action: string;
  details?: {
    samplesAdded?: number;
    samplesDeleted?: number;
    targetLabel?: string;
    wasWeakestLabel?: boolean;
  };
}

export interface SkillAssessmentResult {
  dataCurationScore: number;
  debuggingScore: number;
  improvementScore: number;
  overallScore: number;
  narrative: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };
}

function computeBalanceRatio(classSummary: Record<string, number>): number {
  const values = Object.values(classSummary);
  if (values.length < 2) return 1;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max > 0 ? min / max : 0;
}

export function computeAssessment(
  modelChain: ModelChainItem[],
  actionLogs: ActionLogItem[]
): SkillAssessmentResult {
  if (modelChain.length === 0) {
    return {
      dataCurationScore: 0,
      debuggingScore: 0,
      improvementScore: 0,
      overallScore: 0,
      narrative: { summary: 'Chưa có dữ liệu.', strengths: [], improvements: [] },
    };
  }

  const lastModel = modelChain[modelChain.length - 1];
  const firstModel = modelChain[0];

  // 1. Data Curation Score (0-100)
  const balanceRatio = lastModel.balanceRatio ?? computeBalanceRatio(lastModel.classSummary);
  const balanceScore = Math.round(balanceRatio * 100);
  const qualityScore = lastModel.qualityScore ?? 50;
  const classCount = Object.keys(lastModel.classSummary).length;
  const expectedMin = classCount * 10;
  const volumeScore = Math.min(100, Math.round((lastModel.sampleCount / Math.max(expectedMin, 1)) * 100));
  const dataCurationScore = Math.round((balanceScore * 40 + qualityScore * 40 + volumeScore * 20) / 100);

  // 2. Debugging Score (0-100)
  const modifyActions = actionLogs.filter(log =>
    ['ADD_SAMPLES', 'DELETE_SAMPLES'].includes(log.action)
  );
  const targetedActions = modifyActions.filter(log => log.details?.wasWeakestLabel === true);
  const debuggingScore = modifyActions.length > 0
    ? Math.round((targetedActions.length / modifyActions.length) * 100)
    : 0;

  // 3. Improvement Score (0-100)
  let improvementScore = 0;
  if (modelChain.length > 1) {
    const delta = lastModel.testScore - firstModel.testScore;
    improvementScore = delta > 0 ? Math.min(100, Math.round(delta * 2)) : 0;
  }

  // 4. Overall
  let overallScore = Math.round(
    dataCurationScore * 0.30 +
    debuggingScore * 0.35 +
    improvementScore * 0.35
  );

  // Edge case: First-Try Mastery bonus
  if (firstModel.testScore >= 85 && modelChain.length === 1) {
    overallScore = Math.max(overallScore, Math.round(firstModel.testScore));
  }

  // 5. Narrative
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (balanceScore >= 80) strengths.push('Cân bằng dữ liệu tốt');
  else improvements.push('Nên cân bằng số lượng ảnh giữa các nhãn');

  if (qualityScore >= 70) strengths.push('Chất lượng ảnh tốt');
  else improvements.push('Nên chụp ảnh rõ nét và đủ sáng hơn');

  if (debuggingScore >= 70) strengths.push('Biết sửa đúng nhãn yếu nhất');
  if (improvementScore >= 50) strengths.push(`AI cải thiện ${lastModel.testScore - firstModel.testScore}% qua ${modelChain.length} lần train`);

  if (modelChain.length === 1 && firstModel.testScore < 70) {
    improvements.push('Nên thử train lại sau khi xem Phiếu Đánh Giá để cải thiện AI');
  }

  let summary = '';
  if (modelChain.length === 1) {
    summary = `Bé đã hoàn thành với điểm AI ${lastModel.testScore}% ngay lần đầu.`;
  } else {
    summary = `Bé đã cải thiện AI từ ${firstModel.testScore}% lên ${lastModel.testScore}% qua ${modelChain.length} lần huấn luyện.`;
  }

  return {
    dataCurationScore,
    debuggingScore,
    improvementScore,
    overallScore,
    narrative: { summary, strengths, improvements },
  };
}
