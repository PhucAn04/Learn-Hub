/**
 * AI Reference Embeddings & Zero-Shot Cross-Check
 *
 * Sử dụng các vector trọng tâm (Centroid 1280D, L2 normalized)
 * được trích xuất từ MobileNet v2 cho các lớp chuẩn thuộc 5 bộ dataset.
 * Phục vụ cơ chế Zero-Shot Cross-Check:
 * Ngay khi người dùng tải ảnh lên (hoặc chụp camera), hệ thống tính toán
 * độ tương đồng Cosine giữa vector của ảnh và các centroid mẫu.
 * Nếu ảnh có dấu hiệu thuộc nhãn khác (VD: tải ảnh Chó vào nhãn Mèo),
 * hệ thống lập tức kích hoạt cảnh báo sai nhãn.
 */

import { matchLabelToDataset } from './dataset-label-mapping';
import rawCentroids from './reference_centroids.json';
import { loadTf } from './tf-loader';

export interface MisclassificationCheckResult {
  isSuspect: boolean;
  targetKey?: string;
  targetLabelVi?: string;
  suspectedKey?: string;
  suspectedLabelVi?: string;
  similarityTarget?: number; // 0..100 (%)
  similaritySuspect?: number; // 0..100 (%)
  message?: string;
}

/**
 * Tính Cosine Similarity giữa 2 vector đã được L2-normalize
 * (Cosine similarity chính là dot product)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Kho lưu trữ Reference Centroids (1280D) chuẩn
 */
export const REFERENCE_CENTROIDS: Record<string, number[]> = rawCentroids;

/**
 * Danh sách hiển thị tên nhãn tiếng Việt tương ứng với các key centroid (Đầy đủ 26 lớp từ 5 bộ dataset)
 */
export const CENTROID_LABELS_VI: Record<string, string> = {
  // Cats & Dogs (2 lớp)
  dog: 'Chó 🐶',
  cat: 'Mèo 🐱',
  // Rock-Paper-Scissors (3 lớp)
  rock: 'Búa (Đá) ✊',
  paper: 'Bao (Giấy) ✋',
  scissors: 'Kéo ✌️',
  // Plant Village (2 lớp)
  healthy_leaf: 'Lá Khỏe Mạnh 🌿',
  diseased_leaf: 'Lá Có Đốm Bệnh 🍂',
  // Fruit Classification (10 lớp)
  apple: 'Táo 🍎',
  banana: 'Chuối 🍌',
  orange: 'Cam 🍊',
  avocado: 'Bơ 🥑',
  cherry: 'Cherry 🍒',
  kiwi: 'Kiwi 🥝',
  mango: 'Xoài 🥭',
  pineapple: 'Dứa (Thơm) 🍍',
  strawberries: 'Dâu Tây 🍓',
  watermelon: 'Dưa Hấu 🍉',
  // Pest Classification (9 lớp)
  beetle: 'Bọ Cánh Cứng 🪲',
  grasshopper: 'Châu Chấu 🦗',
  armyworm: 'Sâu Keo 🐛',
  aphids: 'Rệp Cây 🐜',
  bollworm: 'Sâu Đục Quả 🐛',
  mites: 'Bọ Ve / Nhện Đỏ 🕷️',
  mosquito: 'Muỗi 🦟',
  sawfly: 'Ong Cắn Lá 🐝',
  stem_borer: 'Sâu Đục Thân 🐛',
};

/**
 * Các kịch bản sư phạm gợi ý nhanh (1-Click Presets)
 * Hệ thống hoàn toàn hỗ trợ giáo viên tự do tùy biến bất kỳ 3 nhãn nào (hoặc N nhãn).
 */
export const LOGICAL_SCENARIOS: string[][] = [
  ['healthy_leaf', 'diseased_leaf', 'beetle'],
  ['dog', 'cat', 'beetle'],
  ['rock', 'paper', 'scissors'],
  ['apple', 'banana', 'orange'],
];


/**
 * Phân loại đặc trưng 1280D với toàn bộ 26 lớp chuẩn qua xác suất Softmax
 * Giúp suy luận Top-K lớp có xác suất cao nhất từ mô hình pre-trained 26 lớp
 */
export function predictTopClasses(
  features: number[],
  topK = 3,
  temperature = 20.0
): { key: string; labelVi: string; probability: number }[] {
  if (!features || features.length === 0) return [];
  const keys = Object.keys(REFERENCE_CENTROIDS);
  const logits = keys.map((k) => {
    const c = REFERENCE_CENTROIDS[k];
    return c ? cosineSimilarity(features, c) * temperature : -Infinity;
  });
  const maxL = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - maxL));
  const sumExp = exp.reduce((a, b) => a + b, 0) || 1;
  const probs = exp.map((v) => v / sumExp);

  return keys
    .map((k, i) => ({
      key: k,
      labelVi: CENTROID_LABELS_VI[k] || k,
      probability: Math.round(probs[i] * 1000) / 10,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topK);
}

/**
 * Kiểm tra xem ảnh tải lên có bị nghi vấn sai nhãn hay không (Universal Zero-Shot Cross-Check)
 * Thuật toán 2 tầng:
 * - Tầng 1: Context Conflict Check (Kiểm tra xung đột trực tiếp với các nhãn khác trong bài tập hiện tại)
 * - Tầng 2: Global Reference Library Check (Kiểm tra đối chiếu toàn bộ 26 centroid chuẩn từ 5 dataset)
 *   + 1A: Misclassification - Ảnh mang đặc trưng của lớp chuẩn khác trong kho dữ liệu vượt trội hơn nhãn mục tiêu
 *   + 1B: OOD (Out-of-Distribution) - Ảnh chụp người/mặt/phòng/webcam/vật thể lạ không mang đặc trưng của nhãn đã chọn
 *
 * @param sampleFeatures - Vector đặc trưng 1280D của ảnh cần kiểm tra
 * @param activeClassLabel - Tên nhãn hiện tại (VD: "Sâu đục quả", "Chó", "Mèo"...)
 * @param contextClassLabels - Danh sách tất cả các nhãn trong bài tập hiện tại
 * @param deltaThreshold - Ngưỡng chênh lệch cosine để kích hoạt cảnh báo (mặc định 0.025 ~ 2.5%)
 */
export function checkMisclassification(
  sampleFeatures: number[],
  activeClassLabel: string,
  contextClassLabels?: string[],
  deltaThreshold = 0.025
): MisclassificationCheckResult {
  if (!sampleFeatures || sampleFeatures.length === 0 || !activeClassLabel) {
    return { isSuspect: false };
  }

  // 1. Xác định lớp chuẩn của activeClass (nếu có trong từ điển dataset)
  const matchTarget = matchLabelToDataset(activeClassLabel);
  const targetKey = matchTarget.matched && matchTarget.classMapping ? matchTarget.classMapping.key : undefined;
  const targetCentroid = targetKey ? REFERENCE_CENTROIDS[targetKey] : undefined;
  const simTarget = targetCentroid ? cosineSimilarity(sampleFeatures, targetCentroid) : 0;

  // 2. TẦNG 1: CONTEXT CONFLICT CHECK (Ưu tiên cao nhất - Xung đột trong bài tập của giáo viên)
  // Duyệt qua tất cả các nhãn khác đang có mặt trong bài tập hiện tại
  if (contextClassLabels && contextClassLabels.length > 0) {
    for (const ctxLabel of contextClassLabels) {
      if (!ctxLabel || ctxLabel.trim().toLowerCase() === activeClassLabel.trim().toLowerCase()) {
        continue;
      }

      const matchCtx = matchLabelToDataset(ctxLabel);
      const ctxKey = matchCtx.matched && matchCtx.classMapping ? matchCtx.classMapping.key : undefined;

      // Nếu nhãn khác trong bài trùng targetKey thì bỏ qua
      if (targetKey && ctxKey === targetKey) {
        continue;
      }

      if (ctxKey && REFERENCE_CENTROIDS[ctxKey]) {
        const simCtx = cosineSimilarity(sampleFeatures, REFERENCE_CENTROIDS[ctxKey]);
        const ctxDisplayName = CENTROID_LABELS_VI[ctxKey] || matchCtx.classMapping?.labelVi || ctxLabel;
        const targetDisplayName = targetKey
          ? (CENTROID_LABELS_VI[targetKey] || matchTarget.classMapping?.labelVi || activeClassLabel)
          : activeClassLabel;

        // Trường hợp A: Nhãn mục tiêu có centroid chuẩn
        if (targetCentroid && simCtx > simTarget + deltaThreshold) {
          const simTargetPct = Math.round(Math.max(0, simTarget) * 100);
          const simCtxPct = Math.round(Math.max(0, simCtx) * 100);

          return {
            isSuspect: true,
            targetKey,
            targetLabelVi: targetDisplayName,
            suspectedKey: ctxKey,
            suspectedLabelVi: ctxDisplayName,
            similarityTarget: simTargetPct,
            similaritySuspect: simCtxPct,
            message: `⚠️ Nghi vấn sai nhãn: Ảnh có đặc trưng giống ${ctxDisplayName} (${simCtxPct}%), phù hợp với nhãn '${ctxLabel}' đang có trong bài tập hơn là ${targetDisplayName} (${simTargetPct}%)!`,
          };
        }

        // Trường hợp B: Nhãn mục tiêu là nhãn tự do (không có centroid), nhưng ảnh rất giống một nhãn khác trong bài
        if (!targetCentroid && simCtx >= 0.75) {
          const simCtxPct = Math.round(Math.max(0, simCtx) * 100);
          return {
            isSuspect: true,
            suspectedKey: ctxKey,
            suspectedLabelVi: ctxDisplayName,
            similaritySuspect: simCtxPct,
            message: `⚠️ Nghi vấn sai nhãn: Ảnh có đặc trưng rất giống ${ctxDisplayName} (${simCtxPct}%), trong khi bài tập đã có sẵn nhãn '${ctxLabel}'!`,
          };
        }
      }
    }
  }

  // 3. TẦNG 2: GLOBAL REFERENCE LIBRARY CHECK (Kiểm tra đối chiếu toàn bộ 26 lớp chuẩn)
  let bestGlobalKey: string | null = null;
  let maxSimGlobal = -1;

  for (const [cKey, cCentroid] of Object.entries(REFERENCE_CENTROIDS)) {
    if (targetKey && cKey === targetKey) continue;
    const sim = cosineSimilarity(sampleFeatures, cCentroid);
    if (sim > maxSimGlobal) {
      maxSimGlobal = sim;
      bestGlobalKey = cKey;
    }
  }

  // Trường hợp 1: Nhãn mục tiêu là nhãn đã huấn luyện trong dataset (có targetCentroid)
  if (targetCentroid) {
    const targetName = CENTROID_LABELS_VI[targetKey!] || matchTarget.classMapping?.labelVi || activeClassLabel;
    const simTargetPct = Math.round(Math.max(0, simTarget) * 100);

    // 1A. Ảnh khác với tên nhãn (thuộc một lớp chuẩn khác trong dataset vượt trội)
    if (bestGlobalKey && maxSimGlobal > simTarget + deltaThreshold) {
      const suspectName = CENTROID_LABELS_VI[bestGlobalKey] || bestGlobalKey;
      const simGlobalPct = Math.round(Math.max(0, maxSimGlobal) * 100);

      return {
        isSuspect: true,
        targetKey,
        targetLabelVi: targetName,
        suspectedKey: bestGlobalKey,
        suspectedLabelVi: suspectName,
        similarityTarget: simTargetPct,
        similaritySuspect: simGlobalPct,
        message: `⚠️ Nghi vấn sai nhãn: Ảnh có đặc trưng giống ${suspectName} (${simGlobalPct}%) hơn là ${targetName} (${simTargetPct}%).`,
      };
    }

    // 1B. Ảnh lạ (OOD) / Người / Webcam / Đồ vật lạ không thuộc bộ dữ liệu:
    // Kiểm tra phân phối xác suất Softmax và độ tương đồng đặc thù:
    // Khi ảnh chụp người, khuôn mặt, góc phòng, bàn ghế hoặc vật thể lạ không thuộc nhãn,
    // các đặc trưng phân bố phẳng/mờ nhạt trên 26 lớp (xác suất top1 < 16%, xác suất nhãn mục tiêu < 16%),
    // hoặc độ tương đồng quá mờ nhạt (simTarget < 0.44), hoặc không có sự cách biệt rõ ràng (simTarget < 0.55 && targetProb < 18%).
    const topProbs = predictTopClasses(sampleFeatures, 3, 20.0);
    const top1 = topProbs[0];
    const targetProbEntry = topProbs.find((p) => p.key === targetKey);
    const targetProb = targetProbEntry ? targetProbEntry.probability : 0;

    // Nếu mô hình nhận diện chính xác nhãn mục tiêu đứng Top 1 với xác suất tự tin (>= 20%)
    // thì đây chắc chắn là ảnh hợp lệ của nhãn (kể cả khi góc chụp xa hoặc phông nền làm cosine similarity giảm)
    const isTargetDominant = Boolean(top1 && top1.key === targetKey && targetProb >= 20.0);

    const isFlatDistribution = top1 && top1.probability < 16.0;
    const isWeakTarget = targetProb < 16.0;
    const isLowSim = !isTargetDominant && simTarget < 0.44;
    const isAmbiguousOOD = !isTargetDominant && simTarget < 0.55 && targetProb < 18.0;

    if (!isTargetDominant && (isFlatDistribution || isWeakTarget || isLowSim || isAmbiguousOOD)) {
      return {
        isSuspect: true,
        targetKey,
        targetLabelVi: targetName,
        similarityTarget: simTargetPct,
        message: `⚠️ Cảnh báo ảnh lạ: Ảnh không có đặc trưng của nhãn '${targetName}' (độ tương đồng chỉ ${simTargetPct}%) và không thuộc bộ dữ liệu đã học!`,
      };
    }
  }

  // Trường hợp 2: Tên nhãn rất khác biệt (nhãn tự do ngoài bộ dataset, không có targetCentroid)
  if (!targetCentroid) {
    // Nếu ảnh khớp rất mạnh (>= 0.78) với một lớp chuẩn đã biết trong dataset -> cảnh báo nhầm lẫn
    if (bestGlobalKey && maxSimGlobal >= 0.78) {
      const suspectName = CENTROID_LABELS_VI[bestGlobalKey] || bestGlobalKey;
      const simGlobalPct = Math.round(Math.max(0, maxSimGlobal) * 100);

      return {
        isSuspect: true,
        suspectedKey: bestGlobalKey,
        suspectedLabelVi: suspectName,
        similaritySuspect: simGlobalPct,
        message: `⚠️ Nghi vấn sai nhãn: Ảnh có đặc trưng giống ${suspectName} (${simGlobalPct}%), vui lòng kiểm tra lại ảnh cho nhãn '${activeClassLabel}'!`,
      };
    }
    // Trường hợp tên nhãn rất khác biệt và ảnh khác với tập dữ liệu đã huấn luyện -> CHẤP NHẬN
  }

  return {
    isSuspect: false,
    targetKey,
    similarityTarget: targetCentroid ? Math.round(Math.max(0, simTarget) * 100) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClassifierModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifierLoadPromise: Promise<any> | null = null;
let cachedClassNames: string[] | null = null;

/**
 * Tải mô hình TensorFlow.js Neural Network 26 lớp pre-trained (/models/dataset_classifier/model.json)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadDatasetClassifierModel(): Promise<any> {
  if (cachedClassifierModel) return cachedClassifierModel;
  if (classifierLoadPromise) return classifierLoadPromise;

  classifierLoadPromise = (async () => {
    try {
      const tf = await loadTf();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = await (tf as any).loadLayersModel('/models/dataset_classifier/model.json');
      cachedClassifierModel = model;

      try {
        const res = await fetch('/models/dataset_classifier/class_names.json');
        if (res.ok) {
          cachedClassNames = await res.json();
        }
      } catch {
        cachedClassNames = Object.keys(REFERENCE_CENTROIDS);
      }

      return model;
    } catch (err) {
      console.warn('Could not load pre-trained LayersModel, fallback to centroid dot-product:', err);
      return null;
    }
  })();

  return classifierLoadPromise;
}

/**
 * Suy luận xác suất bằng mô hình TensorFlow.js LayersModel nếu đã nạp
 */
export async function predictWithLayersModel(
  features: number[],
  topK = 3
): Promise<{ key: string; labelVi: string; probability: number }[] | null> {
  try {
    const model = await loadDatasetClassifierModel();
    if (!model) return null;

    const tf = await loadTf();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probs = (tf as any).tidy(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputTensor = (tf as any).tensor2d([features]);
      const pred = model.predict(inputTensor);
      return Array.from(pred.dataSync()) as number[];
    });

    const classKeys = cachedClassNames || Object.keys(REFERENCE_CENTROIDS);
    return classKeys
      .map((k, i) => ({
        key: k,
        labelVi: CENTROID_LABELS_VI[k] || k,
        probability: Math.round((probs[i] || 0) * 1000) / 10,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topK);
  } catch (err) {
    console.warn('LayersModel prediction fallback to centroid dot-product:', err);
    return null;
  }
}

