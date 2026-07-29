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

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const kp of keypoints) {
    if (kp.x < minX) minX = kp.x;
    if (kp.y < minY) minY = kp.y;
    if (kp.x > maxX) maxX = kp.x;
    if (kp.y > maxY) maxY = kp.y;
  }

  // Check if coordinates are normalized (0-1) or absolute pixels
  const isNormalized = maxX <= 1 && maxY <= 1;

  if (isNormalized) {
    minX *= canvasWidth;
    maxX *= canvasWidth;
    minY *= canvasHeight;
    maxY *= canvasHeight;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const padX = width * paddingPercent;
  const padY = height * paddingPercent;

  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(canvasWidth, maxX + padX);
  maxY = Math.min(canvasHeight, maxY + padY);

  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    w: Math.floor(maxX - minX),
    h: Math.floor(maxY - minY),
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
export function analyzeBlur(canvas: HTMLCanvasElement, roi?: ROI, brightness: number = 128): { variance: number; maxLaplacian: number; isBlurry: boolean; sharpnessRatio: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

  const x = roi ? Math.max(0, Math.floor(roi.x)) : 0;
  const y = roi ? Math.max(0, Math.floor(roi.y)) : 0;
  const w = roi ? Math.min(canvas.width - x, Math.floor(roi.w)) : canvas.width;
  const h = roi ? Math.min(canvas.height - y, Math.floor(roi.h)) : canvas.height;

  // Tránh lỗi khi bounding box quá nhỏ hoặc ảo
  if (w < 3 || h < 3) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

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
  let activePixels = 0;
  let strongPixels = 0;
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

      // Nâng mức nhiễu lên 10 để loại bỏ hoàn toàn các dao động siêu nhỏ của phông nền
      if (absLap > 10) {
        laplacianSum += laplacian;
        laplacianSqSum += laplacian * laplacian;
        activePixels++;
        
        // Đếm số lượng pixel có độ nét cao (cạnh cứng)
        if (absLap > 50) {
          strongPixels++;
        }
      }
    }
  }

  if (activePixels === 0) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

  const mean = laplacianSum / activePixels;
  const variance = Math.max(0, (laplacianSqSum / activePixels) - (mean * mean));
  
  // Tỉ lệ cạnh sắc (Sharpness Ratio):
  // Motion blur làm viền bị nhòe rộng ra -> activePixels tăng mạnh nhưng strongPixels giảm -> Tỉ lệ cực thấp!
  // Ảnh nét có viền mảnh và gắt -> Tỉ lệ cao. (Không phụ thuộc vào kích thước ngón tay to hay nhỏ)
  const sharpnessRatio = (strongPixels / activePixels) * 100;
  
  // Căn chỉnh lại dựa trên tập mẫu mới:
  // Ảnh cực mờ: ActiveVar ~ 837 - 893
  // Ảnh rõ nét: ActiveVar ~ 898 - 962 (trở lên)
  let isBlurry = true;
  if (variance >= 950) {
    isBlurry = false; // Mức an toàn để chắc chắn là ảnh nét (ví dụ 962.9)
  } else if (variance >= 850 && sharpnessRatio >= 10) {
    isBlurry = false; // Nới lỏng cho ảnh có Variance lấp lửng nhưng có độ sắc nét tốt
  }

  return { variance, maxLaplacian, isBlurry, sharpnessRatio };
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
    isDark: brightness < 40,
    isBright: brightness > 220,
    isBlurry: blurResult.isBlurry, 
  };

  console.log(`[Quality FINAL] Bright: ${brightness.toFixed(1)} | ActiveVar: ${blurResult.variance.toFixed(1)} | Sharp%: ${blurResult.sharpnessRatio.toFixed(1)} => isBlurry: ${quality.isBlurry}`);
  
  return quality;
}
