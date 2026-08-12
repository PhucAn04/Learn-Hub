'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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
  
  // Circular buffer lưu centroid history
  const bufferRef = useRef<CentroidPoint[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  // Reset buffer khi active thay đổi
  useEffect(() => {
    if (!active) {
      bufferRef.current = [];
      setResult({ isStable: true, motionScore: 0 });
    }
  }, [active]);

  const tick = useCallback(() => {
    if (!active) return;

    const now = performance.now();
    if (now - lastSampleTimeRef.current < sampleInterval) {
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }
    lastSampleTimeRef.current = now;

    // Lấy keypoints hiện tại
    const keypoints = keypointsGetter();
    if (!keypoints || keypoints.length === 0) {
      // Không có keypoints → không đánh giá được → giữ trạng thái hiện tại
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    // Tính centroid
    const centroid = computeCentroid(keypoints);
    if (!centroid) {
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    // Push vào buffer
    const buffer = bufferRef.current;
    buffer.push({ x: centroid.x, y: centroid.y, timestamp: now });
    
    // Giới hạn kích thước buffer
    while (buffer.length > bufferSize) {
      buffer.shift();
    }

    // Cần ít nhất 3 samples để đánh giá
    if (buffer.length < 3) {
      setResult({ isStable: true, motionScore: 0 });
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    // Tính average displacement giữa các centroid liên tiếp
    let totalDisplacement = 0;
    let pairCount = 0;
    for (let i = 1; i < buffer.length; i++) {
      totalDisplacement += euclideanDistance(buffer[i], buffer[i - 1]);
      pairCount++;
    }
    const avgDisplacement = totalDisplacement / pairCount;

    // Chuẩn hóa theo resolution (baseline = 640px width)
    const videoWidth = videoRef.current?.videoWidth || 640;
    const normalizedDisplacement = avgDisplacement * (640 / videoWidth);

    const isStable = normalizedDisplacement < threshold;

    setResult(prev => {
      // Tránh re-render nếu không đổi
      if (prev.isStable === isStable && Math.abs(prev.motionScore - normalizedDisplacement) < 0.5) {
        return prev;
      }
      return { isStable, motionScore: normalizedDisplacement };
    });

    animFrameRef.current = requestAnimationFrame(tick);
  }, [active, keypointsGetter, videoRef, bufferSize, threshold, sampleInterval]);

  useEffect(() => {
    if (active) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [active, tick]);

  return result;
}
