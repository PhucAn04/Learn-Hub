import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import { FaceKeypoint, Ml5FaceMeshModel, Ml5Module } from '@/types/ml5';
import { getFaceKeypoints } from '@/lib/face-drawing';

export function useMl5FaceMesh(
  videoRef: RefObject<HTMLVideoElement | null>,
  cameraActive: boolean,
  options: {
    maxFaces?: number;
    flipHorizontal?: boolean;
  } = {}
) {
  const { maxFaces = 4, flipHorizontal = false } = options;
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detectorDebug, setDetectorDebug] = useState('Đang khởi động');

  const faceMeshModelRef = useRef<Ml5FaceMeshModel | null>(null);
  // Changed: store an array of faces, each face is a FaceKeypoint[]
  const allFacesRef = useRef<FaceKeypoint[][]>([]);
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
    allFacesRef.current = [];

    const initFaceMesh = async () => {
      try {
        const ml5Loader = await import('@/lib/ml5-loader');
        const ml5 = (await ml5Loader.loadMl5()) as unknown as Ml5Module;
        if (cancelled) return;

        const model = ml5.faceMesh({
          maxFaces,
          flipHorizontal,
          runtime: 'tfjs',
        }, async () => {
          if (cancelled) return;
          updateDebug('FaceMesh sẵn sàng');
          
          if (videoRef.current) {
            try {
              updateDebug('Đợi frame video');
              await waitForVideoFrame(videoRef.current);
              if (cancelled || !videoRef.current) return;
              
              model.detectStart(videoRef.current, (results) => {
                if (cancelled) return;
                if (Array.isArray(results) && results.length > 0) {
                  // Process ALL detected faces
                  const faces = results.map((result) => getFaceKeypoints(result));
                  allFacesRef.current = faces;
                  updateDebug(`raw:${results.length} mặt — ${faces.map(f => f.length + 'đ').join(', ')}`);
                } else {
                  allFacesRef.current = [];
                  updateDebug(Array.isArray(results) ? 'raw:0' : `raw:${typeof results}`);
                }
              });

              setModelStatus('ready');
              updateDebug('FaceMesh đang quét');
            } catch (err) {
              console.error('FaceMesh detectStart failed:', err);
              setModelStatus('error');
            }
          }
        });

        faceMeshModelRef.current = model;
      } catch (err) {
        console.error('Failed to load faceMesh:', err);
        setModelStatus('error');
      }
    };

    initFaceMesh();

    return () => {
      cancelled = true;
      try {
        faceMeshModelRef.current?.detectStop?.();
      } catch {}
      faceMeshModelRef.current = null;
      allFacesRef.current = [];
    };
  }, [cameraActive, maxFaces, flipHorizontal, videoRef, waitForVideoFrame, updateDebug]);

  return {
    allFacesRef,
    modelStatus,
    setModelStatus,
    detectorDebug,
  };
}
