/**
 * Load TensorFlow.js via CDN script tag instead of npm to avoid heavy
 * peer-dependency conflicts and vulnerabilities.
 *
 * Usage:
 *   const tf = await loadTf();
 */

import { TFStatic } from '@/types/models';

declare global {
  interface Window {
    tf?: TFStatic;
  }
}

const TF_CDN_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';

let tfPromise: Promise<TFStatic> | null = null;

export function loadTf(): Promise<TFStatic> {
  if (tfPromise) return tfPromise;

  tfPromise = new Promise((resolve, reject) => {
    // Already loaded
    if (typeof window !== 'undefined' && window.tf) {
      resolve(window.tf);
      return;
    }

    const script = document.createElement('script');
    script.src = TF_CDN_URL;
    script.async = true;

    script.onload = () => {
      if (window.tf) {
        resolve(window.tf);
      } else {
        reject(new Error('tf script loaded but tf global not found'));
      }
    };

    script.onerror = () => {
      tfPromise = null; // allow retry
      reject(new Error('Failed to load tf from CDN'));
    };

    document.head.appendChild(script);
  });

  return tfPromise;
}

