import { StoredSample } from '../knn-classifier';

/**
 * ---------------------------------------------------------------------------
 * MACHINE LEARNING ABSTRACTION LAYER (LỚP TRỪU TƯỢNG HÓA AI)
 * ---------------------------------------------------------------------------
 * LƯU Ý QUAN TRỌNG TỪ KIẾN TRÚC SƯ HỆ THỐNG:
 * File interface này được định nghĩa nhằm mục đích ĐẶT NỀN MÓNG (Blueprint)
 * cho tương lai. Hiện tại, dự án đang sử dụng trực tiếp `TfTrainer` và 
 * `knn-classifier` ở rất sâu trong các Component UI (TeachPanel, BodyTeachPanel).
 * 
 * Nếu áp dụng ngay Interface này vào codebase hiện tại sẽ đòi hỏi phải đập đi
 * xây lại toàn bộ hệ thống State của các Panel, rủi ro làm gãy luồng học tập.
 * Do đó, chúng ta lưu trữ thiết kế này ở đây như một bản lề. Khi nâng cấp 
 * hoàn toàn lên Server-side training hoặc có nhu cầu "cắm" các Model phức tạp
 * (như SVM, Random Forest, hay các mô hình PyTorch qua API) vào hệ thống, 
 * Developer chỉ cần implement interface này (Strategy Pattern).
 */

export interface ModelArtifacts {
  jsonBlob: Blob;
  weightsBlob: Blob;
}

export interface TrainingOptions {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  hiddenLayers?: number[]; // Cho phép tùy chỉnh kiến trúc mạng (VD: [128, 64])
  augmentData?: boolean;   // Liên kết với tính năng Data Augmentation
}

export interface PredictionResult {
  label: string;
  confidence: number;
}

/**
 * Interface chuẩn hóa cho mọi thuật toán AI trong Learn-Hub
 */
export interface IClassifier {
  /**
   * Tên thuật toán (VD: 'KNN', 'MLP', 'CNN')
   */
  readonly algorithmName: string;

  /**
   * Khởi tạo bộ máy AI (Tải engine TensorFlow.js, hoặc load thư viện)
   */
  init(): Promise<void>;

  /**
   * Huấn luyện mô hình với tập dữ liệu
   */
  train(
    samples: StoredSample[],
    onProgress?: (epoch: number, progress: number, loss: number, acc: number) => void,
    options?: TrainingOptions
  ): Promise<{ epoch: number; loss: number; acc: number }[]>;

  /**
   * Dự đoán nhãn của một vector đặc trưng đầu vào
   */
  predict(features: number[]): Promise<PredictionResult>;

  /**
   * Xuất mô hình dưới dạng Blob để lưu trữ lên Cloud/Drive
   */
  saveToBlobs(): Promise<ModelArtifacts | null>;

  /**
   * Phục hồi mô hình đã train từ URL lưu trữ
   */
  loadFromUrl(modelUrl: string): Promise<void>;
}
