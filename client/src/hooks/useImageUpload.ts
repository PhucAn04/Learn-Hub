import { useState, useCallback } from 'react';

export interface ProcessedImage {
  id: string;
  originalFile: File;
  canvas: HTMLCanvasElement;
  thumbnailBase64: string;
  width: number;
  height: number;
}

export function useImageUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const processImages = useCallback(async (files: FileList | File[], maxWidth = 1280, maxHeight = 720): Promise<ProcessedImage[]> => {
    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });

    const results: ProcessedImage[] = [];
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const processed = await processSingleImage(file, maxWidth, maxHeight);
        results.push(processed);
      } catch (err) {
        console.error('Failed to process image:', file.name, err);
      }
      setProgress({ current: i + 1, total: files.length });
    }

    setIsProcessing(false);
    return results;
  }, []);

  return {
    isProcessing,
    progress,
    processImages
  };
}

/**
 * Reads a file, resizes it using canvas, and returns a ProcessedImage
 */
async function processSingleImage(file: File, maxWidth: number, maxHeight: number): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions (keep aspect ratio)
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get 2d context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Generate a small thumbnail (e.g. 240px wide) for UI
        const thumbCanvas = document.createElement('canvas');
        const thumbWidth = 240;
        const thumbHeight = Math.round(height * (thumbWidth / width));
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
        }
        
        const thumbnailBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85);

        resolve({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          originalFile: file,
          canvas,
          thumbnailBase64,
          width,
          height
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
