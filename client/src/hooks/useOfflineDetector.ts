import { useRef, useState, useCallback } from 'react';
import { Ml5Module, HandPoseModel, Ml5FaceMeshModel, BodyPoseModel } from '@/types/ml5';

export type DetectorMode = 'hand' | 'face' | 'body';

type Ml5DetectorInstance = HandPoseModel | Ml5FaceMeshModel | BodyPoseModel;

export function useOfflineDetector(mode: DetectorMode) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Store the model instance so we don't recreate it
  const modelRef = useRef<Ml5DetectorInstance | null>(null);

  const initModel = useCallback(async () => {
    if (modelRef.current || isLoading) return;
    setIsLoading(true);

    try {
      const ml5Loader = await import('@/lib/ml5-loader');
      const ml5 = (await ml5Loader.loadMl5()) as unknown as Ml5Module;
      
      return new Promise<void>((resolve) => {
        if (mode === 'hand') {
          modelRef.current = ml5.handPose({ maxHands: 2, flipHorizontal: false, runtime: 'tfjs', modelType: 'full' }, () => {
            setIsReady(true);
            setIsLoading(false);
            resolve();
          });
        } else if (mode === 'face') {
          modelRef.current = ml5.faceMesh({ maxFaces: 4, flipHorizontal: false, runtime: 'tfjs' }, () => {
            setIsReady(true);
            setIsLoading(false);
            resolve();
          });
        } else if (mode === 'body') {
          modelRef.current = ml5.bodyPose('BlazePose', { flipHorizontal: false, enableSmoothing: false }, () => {
            setIsReady(true);
            setIsLoading(false);
            resolve();
          });
        }
      });
    } catch (err) {
      console.error(`[OfflineDetector] Failed to init ${mode} model:`, err);
      setIsLoading(false);
      throw err;
    }
  }, [mode, isLoading]);

  const detect = useCallback(async (input: HTMLImageElement | HTMLCanvasElement) => {
    if (!modelRef.current) {
      await initModel();
    }
    
    if (!modelRef.current || !modelRef.current.detect) {
      throw new Error(`Model ${mode} does not support single-frame detect or failed to load.`);
    }

    // Call the single-frame detect method
    return modelRef.current.detect(input);
  }, [initModel, mode]);

  return {
    isReady,
    isLoading,
    detect,
    initModel
  };
}
