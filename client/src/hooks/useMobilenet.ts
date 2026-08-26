/**
 * useMobilenet — React hook quản lý MobileNet lifecycle
 *
 * Tương tự useMl5Handpose / useMl5BodyPose nhưng cho MobileNet feature extraction.
 * Dùng cho chế độ phân loại ảnh tự do (Free-Label Image Classification).
 *
 * Usage:
 *   const { modelStatus, extractFeatures, extractFeaturesFromVideo } = useMobilenet();
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import MobileNetExtractor from '@/lib/mobilenet-extractor';

export function useMobilenet() {
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const extractorRef = useRef<MobileNetExtractor | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const extractor = MobileNetExtractor.getInstance();
        extractorRef.current = extractor;

        await extractor.load();

        if (!cancelled) {
          setModelStatus('ready');
        }
      } catch (err) {
        console.error('Failed to load MobileNet:', err);
        if (!cancelled) {
          setModelStatus('error');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      // Không dispose singleton vì có thể được tái sử dụng bởi component khác
    };
  }, []);

  /**
   * Trích xuất feature vector 1024D từ canvas hoặc image element.
   */
  const extractFeatures = useCallback(
    (source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): number[] | null => {
      if (!extractorRef.current || modelStatus !== 'ready') return null;
      try {
        return extractorRef.current.extractFeatures(source);
      } catch (err) {
        console.error('Feature extraction failed:', err);
        return null;
      }
    },
    [modelStatus]
  );

  /**
   * Trích xuất features từ video frame hiện tại.
   */
  const extractFeaturesFromVideo = useCallback(
    (video: HTMLVideoElement): number[] | null => {
      if (!extractorRef.current || modelStatus !== 'ready') return null;
      try {
        return extractorRef.current.extractFeaturesFromVideo(video);
      } catch (err) {
        console.error('Video feature extraction failed:', err);
        return null;
      }
    },
    [modelStatus]
  );

  /**
   * Trích xuất features từ base64 string.
   */
  const extractFeaturesFromBase64 = useCallback(
    async (base64: string): Promise<number[] | null> => {
      if (!extractorRef.current || modelStatus !== 'ready') return null;
      try {
        return await extractorRef.current.extractFeaturesFromBase64(base64);
      } catch (err) {
        console.error('Base64 feature extraction failed:', err);
        return null;
      }
    },
    [modelStatus]
  );

  return {
    modelStatus,
    extractFeatures,
    extractFeaturesFromVideo,
    extractFeaturesFromBase64,
  };
}
