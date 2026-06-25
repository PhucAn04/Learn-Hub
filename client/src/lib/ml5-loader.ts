/**
 * Load ml5.js via CDN script tag instead of npm to avoid heavy
 * TensorFlow peer-dependency conflicts.
 *
 * Usage (drop-in replacement for `await import('ml5')`):
 *   const ml5 = await loadMl5();
 */

const ML5_CDN_URL = 'https://unpkg.com/ml5@1.0.1/dist/ml5.min.js';

let ml5Promise: Promise<any> | null = null;

export function loadMl5(): Promise<any> {
  if (ml5Promise) return ml5Promise;

  ml5Promise = new Promise((resolve, reject) => {
    // Already loaded (e.g. another component already triggered this)
    if (typeof window !== 'undefined' && (window as any).ml5) {
      resolve((window as any).ml5);
      return;
    }

    const script = document.createElement('script');
    script.src = ML5_CDN_URL;
    script.async = true;

    script.onload = () => {
      if ((window as any).ml5) {
        resolve((window as any).ml5);
      } else {
        reject(new Error('ml5 script loaded but ml5 global not found'));
      }
    };

    script.onerror = () => {
      ml5Promise = null; // allow retry
      reject(new Error('Failed to load ml5 from CDN'));
    };

    document.head.appendChild(script);
  });

  return ml5Promise;
}
