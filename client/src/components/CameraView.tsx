'use client';

import { RefObject } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { playClickSound } from '@/lib/audio';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  modelStatus: 'loading' | 'ready' | 'error';
  cameraError?: string;
  loadingText?: string;
  hudText?: string;
  theme?: 'blue' | 'pink' | 'emerald';
  onRetry?: () => void;
}

const themeStyles = {
  blue: {
    loaderText: 'text-blue-400',
    loaderSpinner: 'text-blue-500',
    retryBtn: 'bg-blue-500 hover:bg-blue-600',
    errorIcon: 'text-blue-300',
    errorText: 'text-blue-50',
  },
  pink: {
    loaderText: 'text-pink-400',
    loaderSpinner: 'text-pink-500',
    retryBtn: 'bg-pink-500 hover:bg-pink-600',
    errorIcon: 'text-pink-300',
    errorText: 'text-pink-50',
  },
  emerald: {
    loaderText: 'text-emerald-400',
    loaderSpinner: 'text-emerald-500',
    retryBtn: 'bg-emerald-500 hover:bg-emerald-600',
    errorIcon: 'text-emerald-300',
    errorText: 'text-emerald-50',
  },
};

export default function CameraView({
  videoRef,
  canvasRef,
  modelStatus,
  cameraError = '',
  loadingText = 'ĐANG KHỞI ĐỘNG CAMERA AI...',
  hudText,
  theme = 'blue',
  onRetry,
}: CameraViewProps) {
  const styles = themeStyles[theme];

  return (
    <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden shadow-inner">
      {modelStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm text-white">
          <Loader2 className={`w-12 h-12 animate-spin mb-4 ${styles.loaderSpinner}`} />
          <span className={`font-black text-lg ${styles.loaderText}`}>{loadingText}</span>
        </div>
      )}

      {modelStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-gray-900/90 px-6 text-center text-white">
          <Camera className={`h-12 w-12 ${styles.errorIcon}`} />
          <p className={`text-sm font-bold leading-relaxed ${styles.errorText}`}>
            {cameraError || 'Không thể mở camera. Hãy kiểm tra camera rồi thử lại.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onRetry();
              }}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white shadow-md transition ${styles.retryBtn}`}
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại camera
            </button>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10"
      />

      {/* Status HUD overlay */}
      {modelStatus === 'ready' && hudText && (
        <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4 text-green-400" />
          <span>{hudText}</span>
        </div>
      )}
    </div>
  );
}
