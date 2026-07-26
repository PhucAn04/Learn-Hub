export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function calculateROI(
  keypoints: { x: number; y: number }[],
  canvasWidth: number,
  canvasHeight: number,
  paddingPercent: number = 0.1
): ROI | undefined {
  if (!keypoints || keypoints.length === 0) return undefined;

  let minX = 1, minY = 1, maxX = 0, maxY = 0;

  for (const kp of keypoints) {
    if (kp.x < minX) minX = kp.x;
    if (kp.y < minY) minY = kp.y;
    if (kp.x > maxX) maxX = kp.x;
    if (kp.y > maxY) maxY = kp.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const padX = width * paddingPercent;
  const padY = height * paddingPercent;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(1, maxX + padX);
  maxY = Math.min(1, maxY + padY);

  return {
    x: Math.floor(minX * canvasWidth),
    y: Math.floor(minY * canvasHeight),
    w: Math.floor((maxX - minX) * canvasWidth),
    h: Math.floor((maxY - minY) * canvasHeight),
  };
}

import { SampleQualityMeta } from './knn-classifier';

/**
 * Tính độ sáng trung bình của ảnh từ Canvas.
 * Chuyển mỗi pixel sang grayscale rồi lấy trung bình.
 * Nếu có roi, chỉ tính toán trong khu vực roi.
 * @returns Giá trị 0-255 (0 = đen hoàn toàn, 255 = trắng hoàn toàn)
 */
export function analyzeBrightness(canvas: HTMLCanvasElement, roi?: ROI): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 128;

  const x = roi ? Math.max(0, Math.floor(roi.x)) : 0;
  const y = roi ? Math.max(0, Math.floor(roi.y)) : 0;
  const w = roi ? Math.min(canvas.width - x, Math.floor(roi.w)) : canvas.width;
  const h = roi ? Math.min(canvas.height - y, Math.floor(roi.h)) : canvas.height;

  if (w <= 0 || h <= 0) return 128;

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data; // [R, G, B, A, ...]

  let sum = 0;

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
 * Nếu truyền roi, chỉ tính trên các pixel trong roi (Bounding Box của tay/cơ thể).
 * @returns Điểm số Variance.
 */
export function analyzeBlur(canvas: HTMLCanvasElement, roi?: ROI, brightness: number = 128): { variance: number; maxLaplacian: number; isBlurry: boolean; edgeRatio: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { variance: 0, maxLaplacian: 0, isBlurry: true, edgeRatio: 0 };

  const x = roi ? Math.max(0, Math.floor(roi.x)) : 0;
  const y = roi ? Math.max(0, Math.floor(roi.y)) : 0;
  const w = roi ? Math.min(canvas.width - x, Math.floor(roi.w)) : canvas.width;
  const h = roi ? Math.min(canvas.height - y, Math.floor(roi.h)) : canvas.height;

  // Tránh lỗi khi bounding box quá nhỏ hoặc ảo
  if (w < 3 || h < 3) return { variance: 0, maxLaplacian: 0, isBlurry: true, edgeRatio: 0 };

  // Lấy ảnh của vùng ROI
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  // Chuyển đổi sang grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let validPixels = 0;
  let maxLaplacian = 0;

  const step = 2; // Sample every 2nd pixel to save CPU

  for (let row = 1; row < h - 1; row += step) {
    for (let col = 1; col < w - 1; col += step) {
      const idx = row * w + col;

      let laplacian =
        - gray[idx - w]     // top
        - gray[idx - 1]     // left
        + 4 * gray[idx]     // center
        - gray[idx + 1]     // right
        - gray[idx + w];    // bottom

      const absLap = Math.abs(laplacian);
      if (absLap > maxLaplacian) {
        maxLaplacian = absLap;
      }

      // KHÔNG triệt tiêu nhiễu (noise suppression) nữa!
      // Bề mặt da nét có rất nhiều micro-texture (lỗ chân lông, nhiễu camera). 
      // Khi ảnh mờ (motion blur), các micro-texture này bị san phẳng thành Laplacian = 0.
      // Việc giữ lại các giá trị nhỏ này giúp Variance của ảnh NÉT lớn hơn hẳn ảnh MỜ.
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      validPixels++;
    }
  }

  if (validPixels === 0) return { variance: 0, maxLaplacian: 0, isBlurry: true, edgeRatio: 0 };

  const mean = laplacianSum / validPixels;
  const variance = Math.max(0, (laplacianSqSum / validPixels) - (mean * mean));
  
  // Dynamic Threshold
  // Tinh chỉnh theo dữ liệu thực tế (ảnh rung nhẹ có variance ~288-306)
  const THRESH_SHARP_ROI = brightness > 80 ? 320 : 150;
  
  const isBlurry = variance < THRESH_SHARP_ROI || maxLaplacian < 80;

  return { variance, maxLaplacian, isBlurry, edgeRatio: 0 };
}

/**
 * Đánh giá tổng thể chất lượng ảnh trong một vùng ROI.
 */
export function assessQuality(canvas: HTMLCanvasElement, roi?: ROI): SampleQualityMeta {
  const brightness = analyzeBrightness(canvas, roi);
  const blurResult = analyzeBlur(canvas, roi, brightness);

  const quality = {
    brightness,
    blurScore: blurResult.variance,
    isDark: brightness < 60,
    isBright: brightness > 200,
    isBlurry: blurResult.isBlurry, 
  };

  console.log(`[Quality FINAL] Bright: ${brightness.toFixed(1)} | Var: ${blurResult.variance.toFixed(1)} | MaxLap: ${blurResult.maxLaplacian.toFixed(1)} => isBlurry: ${quality.isBlurry}`);
  
  return quality;
}
