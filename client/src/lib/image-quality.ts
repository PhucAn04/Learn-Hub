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
export function analyzeBlur(
  canvas: HTMLCanvasElement, 
  roi?: ROI, 
  brightness: number = 128,
  keypoints?: {x: number, y: number}[]
): { variance: number; maxLaplacian: number; isBlurry: boolean; sharpnessRatio: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

  const x = roi ? Math.max(0, Math.floor(roi.x)) : 0;
  const y = roi ? Math.max(0, Math.floor(roi.y)) : 0;
  const w = roi ? Math.min(canvas.width - x, Math.floor(roi.w)) : canvas.width;
  const h = roi ? Math.min(canvas.height - y, Math.floor(roi.h)) : canvas.height;

  if (w < 3 || h < 3) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
  }

  const step = 2;
  const marginX = Math.floor(w * 0.15);
  const marginY = Math.floor(h * 0.15);
  const startY = Math.max(step, marginY);
  const endY = Math.min(h - step, h - marginY);
  const startX = Math.max(step, marginX);
  const endX = Math.min(w - step, w - marginX);

  // Tạo Keypoint Mask (Distance Map) nếu có keypoints
  const hasKeypoints = keypoints && keypoints.length > 0;
  const kpPixels: {kx: number, ky: number}[] = [];
  
  if (hasKeypoints) {
    // Determine if normalized
    let maxX = 0;
    for (const kp of keypoints!) if (kp.x > maxX) maxX = kp.x;
    const isNormalized = maxX <= 1;

    for (const kp of keypoints!) {
      const absX = isNormalized ? kp.x * canvas.width : kp.x;
      const absY = isNormalized ? kp.y * canvas.height : kp.y;
      const relX = Math.floor(absX - x);
      const relY = Math.floor(absY - y);
      kpPixels.push({kx: relX, ky: relY});
    }
  }

  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let activePixels = 0;
  let strongPixels = 0;
  let maxLaplacian = 0;

  const noiseFloor = brightness < 60 ? 20 : 12;
  const strongEdge = noiseFloor * 3;
  
  // Tính bán kính ảnh hưởng của skeleton
  const radius = Math.max(10, Math.floor(Math.min(w, h) * 0.1));
  const radiusSq = radius * radius;

  for (let row = startY; row < endY; row += step) {
    for (let col = startX; col < endX; col += step) {
      
      // Nếu có keypoints, chỉ tính điểm ảnh nếu nó nằm gần (trong bán kính) một keypoint bất kỳ
      if (hasKeypoints) {
        let isNearSkeleton = false;
        for (const kp of kpPixels) {
          const dx = col - kp.kx;
          const dy = row - kp.ky;
          if (dx*dx + dy*dy <= radiusSq) {
            isNearSkeleton = true;
            break;
          }
        }
        if (!isNearSkeleton) continue;
      }

      const idx = row * w + col;
      
      const laplacian =
        - gray[idx - w * step]
        - gray[idx - step]
        + 4 * gray[idx]
        - gray[idx + step]
        - gray[idx + w * step];

      const absLap = Math.abs(laplacian);
      if (absLap > maxLaplacian) {
        maxLaplacian = absLap;
      }
      
      if (absLap > noiseFloor) {
        laplacianSum += laplacian;
        laplacianSqSum += laplacian * laplacian;
        activePixels++;
        
        if (absLap > strongEdge) {
          strongPixels++;
        }
      }
    }
  }

  if (activePixels === 0) return { variance: 0, maxLaplacian: 0, isBlurry: true, sharpnessRatio: 0 };

  const mean = laplacianSum / activePixels;
  const variance = Math.max(0, (laplacianSqSum / activePixels) - (mean * mean));
  const sharpnessRatio = (strongPixels / activePixels) * 100;
  
  // 3. THRESHOLDS
  // Variance = chỉ số chính, ổn định cho cả nền trơn và nền có đồ vật.
  // MaxLaplacian = xác nhận có edge thật (phân biệt ảnh nét vs ảnh mờ toàn phần).
  // SharpnessRatio = % pixel edge mạnh — KHÔNG đáng tin trên nền trơn (tường)
  //   vì ROI chứa chủ yếu pixel đồng nhất → tỷ lệ strongPixels luôn thấp.
  //   → Dùng làm bonus, KHÔNG phải yêu cầu bắt buộc.
  const brightnessFactor = brightness < 100 ? Math.min(2.0, 100 / Math.max(brightness, 20)) : 1;
  
  // Resolution scaling: Ngưỡng tự điều chỉnh theo kích thước ảnh thực tế.
  const actualPixels = w * h;
  const resolutionScale = actualPixels > 307200 ? Math.sqrt(307200 / actualPixels) : 1;

  const minVarianceThreshold = (200 / brightnessFactor) * resolutionScale;
  const minMaxLapThreshold = 22 * resolutionScale;

  let isBlurry = true;
  
  // Bộ lọc motion blur: MaxLap cực cao + Sharp% thấp = motion streak
  // (viền tay quét nhanh tạo 1 edge cực mạnh, nhưng phần còn lại mờ nhòe)
  const isMotionArtifact = maxLaplacian > 55 * resolutionScale && sharpnessRatio < 6.0;
  
  if (isMotionArtifact) {
    // Phát hiện motion blur → giữ isBlurry = true
  }
  // Điều kiện 1: Variance tốt + MaxLaplacian xác nhận có edge thật
  // → Hoạt động cho CẢ nền trơn và nền có đồ vật
  else if (variance >= minVarianceThreshold && maxLaplacian >= minMaxLapThreshold) {
    isBlurry = false;
  }
  // Điều kiện 2: Variance hơi thấp nhưng MaxLap cao (edge rõ, low-light fallback)
  else if (maxLaplacian >= 45 * resolutionScale && variance >= minVarianceThreshold * 0.6) {
    isBlurry = false;
  }

  return { variance, maxLaplacian, isBlurry, sharpnessRatio };
}

/**
 * Đánh giá tổng thể chất lượng ảnh trong một vùng ROI.
 */
export function assessQuality(
  canvas: HTMLCanvasElement, 
  roi?: ROI, 
  keypoints?: {x: number, y: number}[]
): SampleQualityMeta {
  const brightness = analyzeBrightness(canvas, roi);
  const blurResult = analyzeBlur(canvas, roi, brightness, keypoints);

  const quality = {
    brightness,
    blurScore: blurResult.variance,
    isDark: brightness < 40,
    isBright: brightness > 220,
    isBlurry: blurResult.isBlurry, 
  };

  console.log(`[Quality V4] Bright: ${brightness.toFixed(1)} | ActiveVar: ${blurResult.variance.toFixed(1)} | Sharp%: ${blurResult.sharpnessRatio.toFixed(1)} | MaxLap: ${blurResult.maxLaplacian.toFixed(1)} => isBlurry: ${quality.isBlurry}`);
  
  return quality;
}
