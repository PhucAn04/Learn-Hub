/**
 * MobileNet Feature Extractor
 *
 * Trích xuất vector đặc trưng 1024 chiều từ ảnh bất kỳ bằng MobileNet v2 pre-trained.
 * Dùng cho bài toán phân loại ảnh mở (chó/mèo, táo/lê, ...) — không cần landmark.
 *
 * Kiến trúc:
 *   Ảnh gốc → resize 224×224 → MobileNet v2 (frozen) → feature vector (1024D)
 *   → TfTrainer MLP (1024→128→64→N softmax) → prediction
 *
 * Usage:
 *   const extractor = MobileNetExtractor.getInstance();
 *   await extractor.load();
 *   const features = extractor.extractFeatures(canvasOrImage);
 */

import { loadTf } from './tf-loader';
import { TFStatic } from '@/types/models';

// MobileNet v2 from TensorFlow.js Hub — ~7MB, cached by browser
const MOBILENET_URL =
  'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/3/default/1';

/** Kích thước ảnh input mà MobileNet yêu cầu */
const INPUT_SIZE = 224;

/** Số chiều feature vector output */
export const MOBILENET_FEATURE_DIM = 1280;

class MobileNetExtractor {
  private static instance: MobileNetExtractor | null = null;

  private tf: TFStatic | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  private _status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): MobileNetExtractor {
    if (!MobileNetExtractor.instance) {
      MobileNetExtractor.instance = new MobileNetExtractor();
    }
    return MobileNetExtractor.instance;
  }

  get status() {
    return this._status;
  }

  /**
   * Tải MobileNet v2 từ TFHub. Idempotent — gọi nhiều lần an toàn.
   */
  async load(): Promise<void> {
    if (this._status === 'ready') return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoad();
    return this.loadPromise;
  }

  private async _doLoad(): Promise<void> {
    try {
      this._status = 'loading';

      // Load TensorFlow.js qua CDN (cùng pattern với tf-trainer.ts)
      this.tf = await loadTf();

      // Load MobileNet v2 từ TFHub
      // tf.loadGraphModel hỗ trợ TFHub URL trực tiếp
      this.model = await (this.tf as unknown as {
        loadGraphModel: (url: string, options?: { fromTFHub?: boolean }) => Promise<unknown>;
      }).loadGraphModel(MOBILENET_URL, { fromTFHub: true });

      this._status = 'ready';
    } catch (err) {
      console.error('Failed to load MobileNet:', err);
      this._status = 'error';
      this.loadPromise = null;
      throw err;
    }
  }

  /**
   * Trích xuất feature vector 1024D từ ảnh.
   *
   * @param source - HTMLCanvasElement, HTMLVideoElement, hoặc HTMLImageElement
   * @returns number[] với 1024 phần tử (đã normalize L2)
   */
  extractFeatures(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): number[] {
    if (!this.tf || !this.model || this._status !== 'ready') {
      throw new Error('MobileNet chưa sẵn sàng. Gọi load() trước.');
    }

    const tf = this.tf as unknown as TFStaticExtended;

    return tf.tidy(() => {
      // 1. Chuyển source thành tensor 3D [h, w, 3]
      let imgTensor = tf.browser.fromPixels(source);

      // 2. Resize về 224×224
      imgTensor = tf.image.resizeBilinear(imgTensor, [INPUT_SIZE, INPUT_SIZE]);

      // 3. Normalize pixel values từ [0, 255] → [0, 1]
      const normalized = tf.div(imgTensor, 255.0);

      // 4. Expand dims để thành batch [1, 224, 224, 3]
      const batched = tf.expandDims(normalized, 0);

      // 5. Chạy qua MobileNet → output shape [1, 1024]
      const output = this.model.predict(batched);

      // 6. Lấy dữ liệu ra mảng JS
      const rawFeatures = Array.from(output.dataSync()) as number[];

      // 7. L2 normalization để features ổn định cho KNN/MLP
      const norm = Math.sqrt(rawFeatures.reduce((sum, v) => sum + v * v, 0)) || 1;
      return rawFeatures.map(v => v / norm);
    });
  }

  /**
   * Trích xuất features từ video frame hiện tại.
   * Tiện lợi: tự vẽ frame lên canvas tạm rồi trích xuất.
   */
  extractFeaturesFromVideo(video: HTMLVideoElement): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || INPUT_SIZE;
    canvas.height = video.videoHeight || INPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create canvas context');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return this.extractFeatures(canvas);
  }

  /**
   * Trích xuất features từ base64 image string.
   * Trả về Promise vì cần đợi Image load.
   */
  async extractFeaturesFromBase64(base64: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          resolve(this.extractFeatures(img));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image from base64'));
      img.src = base64;
    });
  }

  /**
   * Giải phóng tài nguyên (model + tensor cache)
   */
  dispose(): void {
    if (this.model && typeof this.model.dispose === 'function') {
      this.model.dispose();
    }
    this.model = null;
    this._status = 'idle';
    this.loadPromise = null;
  }
}

/**
 * Extended TF.js interface cho các hàm image processing
 * (không có trong TFStatic type gốc vì project load TF.js qua CDN)
 */
interface TFStaticExtended extends TFStatic {
  browser: {
    fromPixels(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): TFTensorExt;
  };
  image: {
    resizeBilinear(image: TFTensorExt, size: [number, number]): TFTensorExt;
  };
  div(a: TFTensorExt, b: number): TFTensorExt;
  expandDims(input: TFTensorExt, axis: number): TFTensorExt;
}

interface TFTensorExt {
  dataSync(): Float32Array | Int32Array | Uint8Array;
  dispose(): void;
}

export default MobileNetExtractor;
