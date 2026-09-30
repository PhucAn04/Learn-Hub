import { useEffect, useRef, useState, RefObject } from 'react';
import { BodyPoseModel, BodyPoseResult, Ml5Module } from '@/types/ml5';

export function useMl5BodyPose(
  videoRef: RefObject<HTMLVideoElement | null>,
  cameraActive: boolean,
  options: {
    modelType?: 'MoveNet' | 'BlazePose';
    flipHorizontal?: boolean;
    enableSmoothing?: boolean;
  } = {}
) {
  const { modelType = 'BlazePose', flipHorizontal = true, enableSmoothing = true } = options;
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  
  const bodyPoseRef = useRef<BodyPoseModel | null>(null);
  const posesRef = useRef<BodyPoseResult[]>([]);

  useEffect(() => {
    if (!cameraActive) {
      queueMicrotask(() => {
        setModelStatus('loading');
      });
      return;
    }

    let cancelled = false;
    posesRef.current = [];

    const initBodyPose = async () => {
      try {
        const ml5Loader = await import('@/lib/ml5-loader');
        const ml5 = (await ml5Loader.loadMl5()) as unknown as Ml5Module;
        if (cancelled) return;

        // ml5.bodyPose takes options object first if needed, default is MoveNet
        const bodyPoseModel = ml5.bodyPose(
          modelType,
          { flipHorizontal, enableSmoothing }, 
          () => {
            if (cancelled) return;
            setModelStatus('ready');
            
            if (videoRef.current) {
              bodyPoseModel.detectStart(videoRef.current, (results) => {
                if (cancelled) return;
                posesRef.current = results || [];
              });
            }
          }
        );

        bodyPoseRef.current = bodyPoseModel;
      } catch (err) {
        console.error('Failed to load ml5 bodyPose:', err);
        setModelStatus('error');
      }
    };

    initBodyPose();

    return () => {
      cancelled = true;
      try {
        bodyPoseRef.current?.detectStop?.();
      } catch {}
      bodyPoseRef.current = null;
    };
  }, [cameraActive, modelType, flipHorizontal, enableSmoothing, videoRef]);

  return {
    posesRef,
    modelStatus,
    setModelStatus,
  };
}
