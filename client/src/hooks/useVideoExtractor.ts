import { useState, useCallback } from 'react';

export interface ExtractedFrame {
  canvas: HTMLCanvasElement;
  thumbnailBase64: string;
  timestamp: number;
}

/**
 * Hook trích xuất frames từ video file hoặc Blob.
 * - Seek video element đến từng timestamp
 * - Draw frame vào canvas (giữ nguyên resolution gốc, tối đa 1280x720)
 * - Tạo thumbnail 240×240 JPEG
 * - Cancelable
 */
export function useVideoExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const extractFrames = useCallback(async (
    source: File | Blob,
    framesPerSecond: number = 2,
    maxFrames: number = 60
  ): Promise<ExtractedFrame[]> => {
    return new Promise((resolve, reject) => {
      setIsExtracting(true);
      setProgress({ current: 0, total: 0 });

      const video = document.createElement('video');
      video.autoplay = false;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = URL.createObjectURL(source);

      const frames: ExtractedFrame[] = [];

      video.onloadedmetadata = () => {
        const duration = video.duration;
        const interval = 1 / framesPerSecond;
        const estimatedFrames = Math.min(Math.floor(duration / interval), maxFrames);
        setProgress({ current: 0, total: estimatedFrames });

        let currentTime = 0;

        video.onseeked = () => {
          // Draw at high resolution (cap at 1280x720 for performance)
          const maxW = 1280;
          const maxH = 720;
          let w = video.videoWidth;
          let h = video.videoHeight;

          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          if (h > maxH) {
            w = Math.round(w * (maxH / h));
            h = maxH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);

            // Create high quality thumbnail (240x240 center-crop)
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 240;
            thumbCanvas.height = 240;
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              const minDim = Math.min(w, h);
              const sx = (w - minDim) / 2;
              const sy = (h - minDim) / 2;
              thumbCtx.drawImage(canvas, sx, sy, minDim, minDim, 0, 0, 240, 240);

              frames.push({
                canvas,
                thumbnailBase64: thumbCanvas.toDataURL('image/jpeg', 0.85),
                timestamp: currentTime,
              });
            }

            setProgress({ current: frames.length, total: estimatedFrames });
          }

          currentTime += interval;
          if (currentTime <= duration && frames.length < maxFrames) {
            video.currentTime = currentTime;
          } else {
            // Done extracting
            URL.revokeObjectURL(video.src);
            setIsExtracting(false);
            resolve(frames);
          }
        };

        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          setIsExtracting(false);
          reject(new Error('Không thể đọc video'));
        };

        // Start seeking
        video.currentTime = currentTime;
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        setIsExtracting(false);
        reject(new Error('Không thể tải video'));
      };
    });
  }, []);

  return { isExtracting, progress, extractFrames };
}
