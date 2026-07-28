import { StoredSample, classifyKNN, classifyKNNDetailed, analyzeDataBalance } from './knn-classifier';
import { TfTrainer } from './tf-trainer';

export interface Hyperparameters {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  k?: number;
}

export interface TrainingProgressCallback {
  (epoch: number, progress: number, loss: number, acc: number): void;
}

export interface TrainingResult {
  accuracy: number;
  logs?: { epoch: number; loss: number; acc: number }[];
  autoParamsUsed?: Hyperparameters;
}

export interface HybridPredictionResult {
  label: string; // Tên nhãn dự đoán từ Neural Network
  confidence: number; // Độ tin cậy từ Neural Network (%)
  confidences?: Record<string, number>;
  // Các chỉ số hỗ trợ từ KNN Shadow Engine (chạy ngầm)
  nearestMatchThumbnail?: string; // Bức ảnh mẫu có khoảng cách gần nhất để giải thích cho bé
  knnSuggestedLabel?: string; // Nhãn KNN dự đoán ngầm để so sánh độ tin cậy
  knnMinDistance?: number; // Khoảng cách hình học Euclid
  isPotentialOutlier?: boolean; // Cảnh báo nếu hình ảnh quá lạ so với các mẫu đã chụp
}

export interface IClassifier {
  algorithm: 'knn' | 'mlp';
  train(
    samples: StoredSample[],
    options?: Hyperparameters,
    onProgress?: TrainingProgressCallback
  ): Promise<TrainingResult>;
  predict(features: number[]): Promise<HybridPredictionResult>;
  isTrained(): boolean;
}

/**
 * Tự động tính toán các Siêu tham số (Auto-Hyperparameter Tuning) 
 * dựa trên quy mô dữ liệu của bé mà không bắt bé phải nhập thủ công.
 */
export function calculateAutoHyperparameters(sampleCount: number): Required<Hyperparameters> {
  if (sampleCount < 15) {
    return { epochs: 35, learningRate: 0.008, batchSize: 8, k: 3 };
  } else if (sampleCount < 50) {
    return { epochs: 50, learningRate: 0.005, batchSize: 16, k: 3 };
  } else {
    return { epochs: 65, learningRate: 0.003, batchSize: 32, k: 5 };
  }
}

/**
 * Phân tích sức khỏe bộ dữ liệu (Data Health Check) ngầm 
 * để cảnh báo lệch nhãn hoặc ảnh mờ/lỗi cho bé.
 */
export function analyzeDatasetHealth(samples: StoredSample[]) {
  const balance = analyzeDataBalance(samples);
  const totalSamples = samples.length;
  
  let healthScore = 100;
  const warnings: string[] = [];

  if (balance.isImbalanced) {
    healthScore -= 25;
    warnings.push(balance.message);
  }

  if (totalSamples < 6) {
    healthScore -= 30;
    warnings.push('⚠️ Tập dữ liệu còn ít mẫu, bé hãy chụp thêm mỗi nhãn ít nhất 3-5 ảnh nhé!');
  }

  return {
    healthScore: Math.max(0, healthScore),
    isImbalanced: balance.isImbalanced,
    warnings,
    counts: balance.counts,
  };
}

export class KnnClassifierAdapter implements IClassifier {
  algorithm: 'knn' | 'mlp' = 'knn';
  private samples: StoredSample[] = [];
  private k: number = 3;

  async train(
    samples: StoredSample[],
    options?: Hyperparameters
  ): Promise<TrainingResult> {
    this.samples = samples;
    this.k = options?.k ?? 3;
    return { accuracy: 100 };
  }

  async predict(features: number[]): Promise<HybridPredictionResult> {
    if (this.samples.length === 0) {
      return { label: 'Chưa huấn luyện', confidence: 0 };
    }
    const result = classifyKNNDetailed(features, this.samples, this.k);
    return {
      label: result.label,
      confidence: result.confidence,
      nearestMatchThumbnail: result.nearest?.[0]?.thumbnail,
      knnSuggestedLabel: result.label,
      knnMinDistance: result.nearest?.[0]?.distance,
    };
  }

  isTrained(): boolean {
    return this.samples.length > 0;
  }
}

export class NeuralNetworkClassifierAdapter implements IClassifier {
  algorithm: 'knn' | 'mlp' = 'mlp';
  private trainer: TfTrainer;
  private cachedSamples: StoredSample[] = [];

  constructor() {
    this.trainer = new TfTrainer();
  }

  async train(
    samples: StoredSample[],
    options?: Hyperparameters,
    onProgress?: TrainingProgressCallback
  ): Promise<TrainingResult> {
    this.cachedSamples = samples;
    
    // Tự động tính toán hyperparameters nếu không được truyền vào
    const autoParams = calculateAutoHyperparameters(samples.length);
    const finalParams = {
      epochs: options?.epochs ?? autoParams.epochs,
      batchSize: options?.batchSize ?? autoParams.batchSize,
      learningRate: options?.learningRate ?? autoParams.learningRate,
    };

    const logs = await this.trainer.train(samples, onProgress, finalParams);
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : { acc: 0 };

    return {
      accuracy: Math.round(lastLog.acc * 100),
      logs,
      autoParamsUsed: finalParams,
    };
  }

  async predict(features: number[]): Promise<HybridPredictionResult> {
    const nnResult = await this.trainer.predict(features);
    return this.attachKNNShadowInfo(features, nnResult);
  }

  predictSync(features: number[]): HybridPredictionResult {
    const nnResult = this.trainer.predictSync(features);
    return this.attachKNNShadowInfo(features, nnResult);
  }

  /**
   * Chạy ngầm KNN Shadow Engine để lấy nearestMatch & thông tin giải thích cho Neural Network
   */
  private attachKNNShadowInfo(
    features: number[], 
    nnResult: { label: string; confidence: number; confidences?: Record<string, number> }
  ): HybridPredictionResult {
    if (this.cachedSamples.length === 0) {
      return nnResult;
    }

    // Chạy ngầm KNN phân tích khoảng cách
    const knnResult = classifyKNNDetailed(features, this.cachedSamples, 3);
    const nearest = knnResult.nearest?.[0];

    // Ngưỡng phát hiện Outlier (ảnh bất thường) dựa trên khoảng cách Euclidean
    const isPotentialOutlier = nearest ? nearest.distance > 0.85 : false;

    return {
      ...nnResult,
      nearestMatchThumbnail: nearest?.thumbnail,
      knnSuggestedLabel: knnResult.label,
      knnMinDistance: nearest?.distance,
      isPotentialOutlier,
    };
  }

  isTrained(): boolean {
    return this.trainer.isTrained();
  }
}
