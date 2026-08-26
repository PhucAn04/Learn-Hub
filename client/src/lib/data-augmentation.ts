import { StoredSample } from './knn-classifier';

/**
 * Data Augmentation (Tăng Cường Dữ Liệu) cho Landmarks.
 * Module này được thiết kế như một tính năng nâng cao (Advanced Feature),
 * tách biệt với luồng huấn luyện cơ bản để phục vụ cho các bài học chuyên sâu
 * về hiện tượng "Học vẹt" (Overfitting) và tính tổng quát hóa (Generalization).
 */

export interface AugmentationOptions {
  /**
   * Số lượng bản sao (bản augmented) cần tạo ra cho mỗi mẫu gốc.
   * Mặc định: 2
   */
  copies?: number;

  /**
   * Mức độ nhiễu (Jitter). Hệ thống sẽ cộng/trừ ngẫu nhiên một giá trị trong
   * khoảng [-jitterRange, jitterRange] vào mỗi tọa độ.
   * Mặc định: 0.01 (1% của màn hình)
   */
  jitterRange?: number;

  /**
   * Mức độ phóng to/thu nhỏ khung xương.
   * Mặc định: 0.05 (Scale ngẫu nhiên từ 0.95 đến 1.05)
   */
  scaleRange?: number;
}

/**
 * Hàm tăng cường dữ liệu: Nhận vào tập mẫu gốc và trả về tập mẫu đã được nhân bản + làm nhiễu.
 * Lưu ý: Trả về cả mẫu gốc và mẫu đã augmented.
 */
export function augmentLandmarks(
  originalSamples: StoredSample[],
  options: AugmentationOptions = {}
): StoredSample[] {
  const {
    copies = 2,
    jitterRange = 0.01,
    scaleRange = 0.05,
  } = options;

  const augmentedDataset: StoredSample[] = [...originalSamples];

  for (const sample of originalSamples) {
    for (let i = 0; i < copies; i++) {
      // Scale factor chung cho toàn bộ khung xương của bản sao này
      const scaleFactor = 1 + (Math.random() * scaleRange * 2 - scaleRange);

      const augmentedFeatures = sample.features.map(val => {
        // Áp dụng scale
        let newVal = val * scaleFactor;
        
        // Áp dụng Jitter (Nhiễu ngẫu nhiên)
        const jitter = Math.random() * jitterRange * 2 - jitterRange;
        newVal += jitter;

        return newVal;
      });

      augmentedDataset.push({
        label: sample.label,
        features: augmentedFeatures,
      });
    }
  }

  return augmentedDataset;
}

/**
 * Ý Tưởng Giáo Dục (Sử dụng sau này):
 * 1. Học sinh ban đầu sẽ chỉ dùng dữ liệu gốc (10-15 ảnh) -> Nhận ra AI đôi khi nhận diện sai nếu bé đứng xa ra.
 * 2. Giáo viên giới thiệu khái niệm "Data Augmentation".
 * 3. Bật tính năng này lên -> Gọi hàm augmentLandmarks() trước khi truyền vào TfTrainer.
 * 4. Học sinh thấy AI nhận diện mượt mà hơn rất nhiều dù không cần chụp thêm ảnh.
 */
