import { BodyKeypoint } from '@/types/ml5';

/**
 * Lấy trung điểm của hông để làm gốc tọa độ (origin)
 */
function getHipCenter(keypoints: BodyKeypoint[]): { x: number; y: number } | null {
  const kpMap = new Map(keypoints.map(kp => [kp.name, kp]));
  const leftHip = kpMap.get('left_hip');
  const rightHip = kpMap.get('right_hip');

  if (leftHip && rightHip) {
    return {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
  }
  
  // Fallback: use first point if hips not found
  if (keypoints.length > 0) {
    return { x: keypoints[0].x, y: keypoints[0].y };
  }
  
  return null;
}

/**
 * Chuẩn hóa body keypoints (tương tự normalizeHandKeypoints):
 * 1. Đưa trung điểm hông (hip center) về (0,0)
 * 2. Chia cho bounding box max dimension để scale invariance
 * 3. Flatten thành array 1D
 */
export function normalizeBodyKeypoints(keypoints: BodyKeypoint[]): number[] {
  // MoveNet có 17 keypoints -> 34 features
  if (!keypoints || keypoints.length < 17) {
    return new Array(34).fill(0);
  }

  const origin = getHipCenter(keypoints);
  if (!origin) return new Array(34).fill(0);

  // Translate to origin
  const translated = keypoints.map(kp => ({
    x: kp.x - origin.x,
    y: kp.y - origin.y
  }));

  // Find max distance from origin for scaling
  let maxDist = 0.0001;
  translated.forEach(kp => {
    const dist = Math.sqrt(kp.x * kp.x + kp.y * kp.y);
    if (dist > maxDist) maxDist = dist;
  });

  // Scale and flatten
  const features: number[] = [];
  translated.forEach(kp => {
    features.push(kp.x / maxDist);
    features.push(kp.y / maxDist);
  });

  // Pad to 34 if necessary (in case some keypoints are missing, though ml5 usually returns full array)
  while (features.length < 34) {
    features.push(0);
  }

  return features.slice(0, 34);
}

/**
 * Hàm tính góc giữa 3 điểm (p1, p2, p3) - p2 là đỉnh góc
 */
export function calculateAngle(p1: BodyKeypoint, p2: BodyKeypoint, p3: BodyKeypoint): number {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}
