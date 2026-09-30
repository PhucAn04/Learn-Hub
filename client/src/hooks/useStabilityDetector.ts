'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hook theo dõi sự ổn định (stability) của keypoints qua nhiều frame liên tiếp.
 *
 * Mục đích: phát hiện "positional shake" — tay/mặt/body di chuyển giữa các frame
 * dù mỗi frame riêng lẻ vẫn nét (blur detection không bắt được).
 *
 * Thuật toán:
 * 1. Mỗi sampleInterval ms, tính centroid (trung bình x, y) từ keypoints hiện tại
 * 2. Lưu vào circular buffer kích thước bufferSize
 * 3. Tính trung bình khoảng cách Euclidean giữa các centroid liên tiếp
 * 4. Chuẩn hóa theo resolution (640px baseline)
 * 5. isStable = motionScore < threshold
 */

interface StabilityOptions {
  /** Số frame lưu trong buffer (default: 8) */
  bufferSize?: number;
  /** Ngưỡng displacement trung bình (pixels, chuẩn hóa về 640px width). Default: 8 */
  threshold?: number;
  /** Khoảng cách giữa các lần sample (ms). Default: 100 */
  sampleInterval?: number;
}

interface StabilityResult {
  /** Tay/mặt/body đang đứng yên không? */
  isStable: boolean;
  /** Điểm motion trung bình (pixels, chuẩn hóa về 640px width) */
  motionScore: number;
}

interface CentroidPoint {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Tính centroid (trung tâm) của một tập keypoints.
 */
function computeCentroid(keypoints: { x: number; y: number }[]): { x: number; y: number } | null {
  if (!keypoints || keypoints.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const kp of keypoints) {
    if (typeof kp.x === 'number' && typeof kp.y === 'number' && !isNaN(kp.x) && !isNaN(kp.y)) {
      sumX += kp.x;
      sumY += kp.y;
      count++;
    }
  }
  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
}

/**
 * Tính khoảng cách Euclidean giữa hai điểm.
 */
function euclideanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useStabilityDetector(
  keypointsGetter: () => { x: number; y: number }[] | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  options: StabilityOptions = {}
): StabilityResult {
  const {
    bufferSize = 8,
    threshold = 8,
    sampleInterval = 100,
  } = options;

  const [result, setResult] = useState<StabilityResult>({ isStable: true, motionScore: 0 });
  const [prevActive, setPrevActive] = useState(active);
  
  // Circular buffer
  const bufferRef = useRef<CentroidPoint[]>([]);
  const lastSampleTimeRef = useRef<number>(0);

  // Avoid setting state in useEffect for active=false by doing it during render
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active) {
      setResult({ isStable: true, motionScore: 0 });
    }
  }

  // Khắc phục react-hooks/refs: Chỉ thay đổi ref bên trong useEffect
  const latestProps = useRef({ keypointsGetter, videoRef, bufferSize, threshold, sampleInterval });
  useEffect(() => {
    latestProps.current = { keypointsGetter, videoRef, bufferSize, threshold, sampleInterval };
  }, [keypointsGetter, videoRef, bufferSize, threshold, sampleInterval]);

  useEffect(() => {
    if (!active) return;

    bufferRef.current = [];
    lastSampleTimeRef.current = 0;
    
    let animFrame: number;
    
    const tick = () => {
      const props = latestProps.current;
      const now = performance.now();
      
      if (now - lastSampleTimeRef.current < props.sampleInterval) {
        animFrame = requestAnimationFrame(tick);
        return;
      }
      lastSampleTimeRef.current = now;

      // Lấy keypoints hiện tại
      const keypoints = props.keypointsGetter();
      if (!keypoints || keypoints.length === 0) {
        animFrame = requestAnimationFrame(tick);
        return;
      }

      // Tính centroid
      const centroid = computeCentroid(keypoints);
      if (!centroid) {
        animFrame = requestAnimationFrame(tick);
        return;
      }

      const buffer = bufferRef.current;
      buffer.push({ x: centroid.x, y: centroid.y, timestamp: now });
      
      while (buffer.length > props.bufferSize) {
        buffer.shift();
      }

      if (buffer.length < 3) {
        setResult({ isStable: true, motionScore: 0 });
        animFrame = requestAnimationFrame(tick);
        return;
      }

      let totalDisplacement = 0;
      let pairCount = 0;
      for (let i = 1; i < buffer.length; i++) {
        totalDisplacement += euclideanDistance(buffer[i], buffer[i - 1]);
        pairCount++;
      }
      const avgDisplacement = totalDisplacement / pairCount;

      const videoWidth = props.videoRef.current?.videoWidth || 640;
      const isHD = videoWidth >= 1000;

      const normalizedDisplacement = avgDisplacement * (640 / videoWidth);
      const dynamicThreshold = isHD ? props.threshold * 2.5 : props.threshold;
      const isStable = normalizedDisplacement < dynamicThreshold;

      setResult(prev => {
        if (prev.isStable === isStable && Math.abs(prev.motionScore - normalizedDisplacement) < 0.5) {
          return prev;
        }
        return { isStable, motionScore: normalizedDisplacement };
      });

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [active]);

  if (!active) {
    return { isStable: true, motionScore: 0 };
  }

  return result;
}
