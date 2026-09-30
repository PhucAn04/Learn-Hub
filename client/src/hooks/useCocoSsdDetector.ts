import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import { loadCocoSsd } from '@/lib/coco-loader';

export type DetectionResult = {
  bbox: [number, number, number, number];
  class: string;
  score: number;
};

export function useCocoSsdDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  cameraActive: boolean
) {
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [detectorDebug, setDetectorDebug] = useState('Đang khởi động');

  const detectorModelRef = useRef<any>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const detectorDebugRef = useRef('Đang khởi động');

  const waitForVideoFrame = useCallback((video: HTMLVideoElement) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener('loadeddata', done);
        video.removeEventListener('canplay', done);
        resolve();
      };
      video.addEventListener('loadeddata', done, { once: true });
      video.addEventListener('canplay', done, { once: true });
      window.setTimeout(done, 1200);
    });
  }, []);

  const updateDebug = useCallback((val: string) => {
    detectorDebugRef.current = val;
    setDetectorDebug(val);
  }, []);

  useEffect(() => {
    if (!cameraActive) {
      queueMicrotask(() => {
        setModelStatus('loading');
        updateDebug('Đang khởi động');
      });
      return;
    }

    let cancelled = false;

    const initDetector = async () => {
      try {
        const cocoSsd = await loadCocoSsd();
        if (cancelled) return;

        const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (cancelled) return;
        
        detectorModelRef.current = model;
        setModelStatus('ready');
        updateDebug('COCO-SSD sẵn sàng');

        const detectFrame = async () => {
          if (cancelled || !videoRef.current || !detectorModelRef.current) return;
          try {
            if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const predictions = await detectorModelRef.current.detect(videoRef.current);
              if (!cancelled) {
                setResults(predictions);
                if (predictions.length > 0) {
                  updateDebug(`Nhận diện: ${predictions[0].class}`);
                }
              }
            }
          } catch (err) {
            console.error('Detection error:', err);
          }
          if (!cancelled) {
            requestRef.current = requestAnimationFrame(detectFrame);
          }
        };

        if (videoRef.current) {
          await waitForVideoFrame(videoRef.current);
          if (!cancelled) {
            detectFrame();
          }
        }
      } catch (err) {
        console.error('Failed to load coco-ssd:', err);
        setModelStatus('error');
      }
    };

    initDetector();

    return () => {
      cancelled = true;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      detectorModelRef.current = null;
      setResults([]);
    };
  }, [cameraActive, videoRef, waitForVideoFrame, updateDebug]);

  return {
    results,
    modelStatus,
    detectorDebug,
  };
}
