import { SampleQualityMeta } from './knn-classifier';

/**
 * Tính độ sáng trung bình của ảnh từ Canvas.
 * Chuyển mỗi pixel sang grayscale rồi lấy trung bình.
 * @returns Giá trị 0-255 (0 = đen hoàn toàn, 255 = trắng hoàn toàn)
 */
export function analyzeBrightness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 128;

  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return 128;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data; // [R, G, B, A, R, G, B, A, ...]

  let sum = 0;
  const pixelCount = w * h;

  // Sample every 4th pixel for performance (still accurate enough)
  const step = 4;
  let sampled = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    sum += gray;
    sampled++;
  }

  return sampled > 0 ? sum / sampled : 128;
}

/**
 * Tính độ nét của ảnh bằng Laplacian Variance.
 * Áp dụng kernel Laplacian 3x3 lên ảnh grayscale, rồi tính variance.
 * Variance thấp = ít cạnh = ảnh mờ.
 * @returns Giá trị variance (thường 0-5000+). Dưới ~100 được coi là mờ.
 */
export function analyzeBlur(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 500;

  const w = canvas.width;
  const h = canvas.height;
  if (w < 3 || h < 3) return 500;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Convert to grayscale array
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  // Apply 3x3 Laplacian kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0]
  // Sample every 2nd pixel for performance
  const step = 2;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const idx = y * w + x;
      const laplacian =
        -gray[idx - w]     // top
        - gray[idx - 1]    // left
        + 4 * gray[idx]    // center
        - gray[idx + 1]    // right
        - gray[idx + w];   // bottom

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  if (count === 0) return 500;

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  return Math.max(0, variance);
}

/**
 * Đánh giá tổng thể chất lượng ảnh.
 * Chỉ GẮN TAG metadata, KHÔNG chặn người dùng lưu ảnh.
 */
export function assessQuality(canvas: HTMLCanvasElement): SampleQualityMeta {
  const brightness = analyzeBrightness(canvas);
  const blurScore = analyzeBlur(canvas);

  const quality = {
    brightness,
    blurScore,
    isDark: brightness < 60,
    isBright: brightness > 200,
    isBlurry: blurScore < 305, // Hạ ngưỡng xuống 305 để tinh chỉnh độ nhạy với rung động nhẹ
  };

  console.log(`[Quality Check] Brightness: ${brightness.toFixed(1)} | Blur Score: ${blurScore.toFixed(1)} => isBlurry: ${quality.isBlurry}`);
  
  return quality;
}
