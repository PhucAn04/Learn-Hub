/**
 * Load ml5.js via CDN script tag instead of npm to avoid heavy
 * TensorFlow peer-dependency conflicts.
 *
 * Usage (drop-in replacement for `await import('ml5')`):
 *   const ml5 = await loadMl5();
 */

import { Ml5Module } from '@/types/ml5';

const ML5_CDN_URL = 'https://unpkg.com/ml5@1.0.1/dist/ml5.min.js';

type Ml5Window = Window & typeof globalThis & {
  ml5?: Ml5Module;
};

let ml5Promise: Promise<Ml5Module> | null = null;

export function loadMl5(): Promise<Ml5Module> {
  if (ml5Promise) return ml5Promise;

  ml5Promise = new Promise((resolve, reject) => {
    // Already loaded (e.g. another component already triggered this)
    const win = typeof window !== 'undefined' ? (window as Ml5Window) : null;
    if (win && win.ml5) {
      resolve(win.ml5);
      return;
    }

    const script = document.createElement('script');
    script.src = ML5_CDN_URL;
    script.async = true;

    script.onload = () => {
      const w = window as Ml5Window;
      if (w.ml5) {
        resolve(w.ml5);
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
