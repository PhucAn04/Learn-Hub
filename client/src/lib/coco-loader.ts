import { loadTf } from './tf-loader';

declare global {
  interface Window {
    cocoSsd?: any;
  }
}

const COCO_CDN_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';

let cocoPromise: Promise<any> | null = null;

export async function loadCocoSsd(): Promise<any> {
  if (cocoPromise) return cocoPromise;

  await loadTf();

  cocoPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.cocoSsd) {
      resolve(window.cocoSsd);
      return;
    }

    const script = document.createElement('script');
    script.src = COCO_CDN_URL;
    script.async = true;

    script.onload = () => {
      if (window.cocoSsd) {
        resolve(window.cocoSsd);
      } else {
        reject(new Error('cocoSsd script loaded but global not found'));
      }
    };

    script.onerror = () => {
      cocoPromise = null;
      reject(new Error('Failed to load cocoSsd from CDN'));
    };

    document.head.appendChild(script);
  });

  return cocoPromise;
}
