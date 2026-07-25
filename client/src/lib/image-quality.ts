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
  // Grid-based Maximum Variance (Giải pháp B)
  // Chia ảnh thành lưới 4x4, tính variance cho từng ô và lấy ô có variance cao nhất.
  // Giúp tìm ra vùng chứa bàn tay mà không bị nhiễu hạt toàn màng hình thổi phồng điểm số.
  const gridX = 4;
  const gridY = 4;
  const blockW = Math.floor(w / gridX);
  const blockH = Math.floor(h / gridY);
  
  let maxVariance = 0;
  const step = 2; // Sample every 2nd pixel

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;

      const startY = Math.max(1, gy * blockH);
      const endY = Math.min(h - 1, (gy + 1) * blockH);
      const startX = Math.max(1, gx * blockW);
      const endX = Math.min(w - 1, (gx + 1) * blockW);

      for (let y = startY; y < endY; y += step) {
        for (let x = startX; x < endX; x += step) {
          const idx = y * w + x;
          let laplacian =
            -gray[idx - w]     // top
            - gray[idx - 1]    // left
            + 4 * gray[idx]    // center
            - gray[idx + 1]    // right
            - gray[idx + w];   // bottom

          // [QUAN TRỌNG] Bộ lọc triệt tiêu nhiễu và viền nhòe
          // Nếu ảnh bị mờ do rung tay, sự chuyển màu ở viền sẽ thoai thoải -> laplacian rất nhỏ (VD: 5-10)
          // Nếu có nhiễu hạt (noise), chênh lệch cũng nhỏ.
          // Ta ép tất cả về 0, để kéo sập điểm variance của ảnh mờ, nhưng vẫn giữ nguyên điểm của viền sắc nét.
          if (Math.abs(laplacian) < 15) {
            laplacian = 0;
          }

          sum += laplacian;
          sumSq += laplacian * laplacian;
          count++;
        }
      }

      if (count > 0) {
        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        if (variance > maxVariance) {
          maxVariance = variance;
        }
      }
    }
  }

  return maxVariance;
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
    // Căn chỉnh theo kết quả thực tế:
    // Nét (sáng 101.8): ~555
    // Mờ (tối 73.4): ~351
    // Dùng dynamic threshold: ảnh tối nhiều nhiễu -> ngưỡng cao hơn (450), ảnh sáng -> ngưỡng thấp hơn (400)
    isBlurry: blurScore < (brightness < 85 ? 450 : 400), 
  };

  console.log(`[Quality Check Grid] Brightness: ${brightness.toFixed(1)} | Blur Max Score: ${blurScore.toFixed(1)} => isBlurry: ${quality.isBlurry}`);
  
  return quality;
}
