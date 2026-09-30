import { useEffect, useRef, useState, RefObject } from 'react';
import { HandPoseModel, HandResult, Ml5Module } from '@/types/ml5';

export function useMl5Handpose(
  videoRef: RefObject<HTMLVideoElement | null>,
  cameraActive: boolean,
  options: {
    maxHands?: number;
    flipHorizontal?: boolean;
  } = {}
) {
  const { maxHands = 1, flipHorizontal = true } = options;
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const handposeRef = useRef<HandPoseModel | null>(null);
  const handsRef = useRef<HandResult[]>([]);

  useEffect(() => {
    if (!cameraActive) {
      queueMicrotask(() => {
        setModelStatus('loading');
      });
      return;
    }

    let cancelled = false;
    handsRef.current = [];

    const initHandpose = async () => {
      try {
        const ml5Loader = await import('@/lib/ml5-loader');
        const ml5 = (await ml5Loader.loadMl5()) as unknown as Ml5Module;
        if (cancelled) return;

        const handPoseModel = ml5.handPose({
          maxHands,
          flipHorizontal,
          runtime: 'tfjs',
          modelType: 'full',
        }, () => {
          if (cancelled) return;
          setModelStatus('ready');
          
          if (videoRef.current) {
            handPoseModel.detectStart(videoRef.current, (results) => {
              if (cancelled) return;
              handsRef.current = results || [];
            });
          }
        });

        handposeRef.current = handPoseModel;
      } catch (err) {
        console.error('Failed to load ml5 handpose:', err);
        setModelStatus('error');
      }
    };

    initHandpose();

    return () => {
      cancelled = true;
      try {
        handposeRef.current?.detectStop?.();
      } catch {}
      handposeRef.current = null;
    };
  }, [cameraActive, maxHands, flipHorizontal, videoRef]);

  return {
    handsRef,
    modelStatus,
    setModelStatus,
  };
}
