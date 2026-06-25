import { useCallback, useEffect, useRef, useState } from 'react';

export function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotReadableError') {
      return 'Camera đang được ứng dụng hoặc tab khác sử dụng. Hãy tắt camera ở nơi khác rồi bấm thử lại.';
    }
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      return 'Trình duyệt chưa được cấp quyền camera. Hãy cho phép camera rồi bấm thử lại.';
    }
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      return 'Không tìm thấy camera phù hợp trên thiết bị này.';
    }
  }
  return 'Không thể mở camera lúc này. Hãy kiểm tra camera rồi bấm thử lại.';
}

interface UseCameraOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

export function useCamera(options: UseCameraOptions = {}) {
  const { width = 480, height = 360, facingMode = 'user' } = options;

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraRetryKey, setCameraRetryKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);

    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const retryCamera = useCallback(() => {
    stopCamera();
    setCameraRetryKey((key) => key + 1);
  }, [stopCamera]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const startWebcam = async (attempt = 0) => {
      if (!active) return;
      setCameraError('');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width, height, facingMode },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current
              ?.play()
              .then(() => {
                if (!active) return;
                setCameraActive(true);
              })
              .catch(() => {
                if (!active) return;
                setCameraError('Camera đã mở nhưng chưa phát được hình. Hãy bấm thử lại.');
              });
          };
        }
      } catch (err) {
        if (!active) return;

        // Automatically retry NotReadableError once after a delay
        if (err instanceof DOMException && err.name === 'NotReadableError' && attempt < 1) {
          retryTimer = setTimeout(() => startWebcam(attempt + 1), 700);
          return;
        }

        setCameraError(getCameraErrorMessage(err));
      }
    };

    startWebcam();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      stopCamera();
    };
  }, [cameraRetryKey, width, height, facingMode, stopCamera]);

  return {
    videoRef,
    canvasRef,
    cameraActive,
    cameraError,
    retryCamera,
    stopCamera,
  };
}
