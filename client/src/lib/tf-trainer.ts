import { loadTf } from './tf-loader';
import { StoredSample } from './knn-classifier';
import { TFLayersModel, TFStatic } from '@/types/models';

export class TfTrainer {
  private model: TFLayersModel | null = null;
  private classNames: string[] = [];
  private tf: TFStatic | null = null;

  async init() {
    if (!this.tf) {
      this.tf = await loadTf();
    }
  }

  /**
   * Huấn luyện mạng Neural Network với đầu vào là mảng tọa độ (Landmarks)
   */
  async train(
    samples: StoredSample[],
    onProgress?: (epoch: number, progress: number, loss: number, acc: number) => void,
    options?: { epochs?: number; batchSize?: number; learningRate?: number }
  ): Promise<{ epoch: number; loss: number; acc: number }[]> {
    await this.init();
    if (!this.tf) throw new Error('TensorFlow.js failed to load');
    if (samples.length === 0) throw new Error('Không có dữ liệu huấn luyện');

    const epochs = options?.epochs ?? 50;
    const learningRate = options?.learningRate ?? 0.005;
    const batchSize = Math.min(options?.batchSize ?? 32, samples.length);

    // 1. Xác định các nhãn (classes) duy nhất
    this.classNames = Array.from(new Set(samples.map(s => s.label))).sort();
    const numClasses = this.classNames.length;
    if (numClasses < 2) throw new Error('Cần ít nhất 2 nhãn để huấn luyện AI');

    const inputShape = samples[0].features.length; // vd: 42 (2 tay), 936 (mặt)

    // 2. Khởi tạo mô hình (Sequential MLP)
    this.model = this.tf.sequential();
    this.model.add(this.tf.layers.dense({ units: 128, activation: 'relu', inputShape: [inputShape] }));
    this.model.add(this.tf.layers.dropout({ rate: 0.2 }));
    this.model.add(this.tf.layers.dense({ units: 64, activation: 'relu' }));
    this.model.add(this.tf.layers.dense({ units: numClasses, activation: 'softmax' }));

    this.model.compile({
      optimizer: this.tf.train.adam(learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    // 3. Chuẩn bị dữ liệu Tensor
    const xs = this.tf.tensor2d(samples.map(s => s.features));
    
    // One-hot encoding cho Labels
    const labels = samples.map(s => this.classNames.indexOf(s.label));
    const ys = this.tf.oneHot(this.tf.tensor1d(labels, 'int32'), numClasses);

    // 4. Bắt đầu Train & lưu log
    const logsHistory: { epoch: number; loss: number; acc: number }[] = [];

    await this.model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (logs) {
            const accVal = logs.acc ?? logs.accuracy ?? 0;
            logsHistory.push({ epoch: epoch + 1, loss: logs.loss, acc: accVal });
            if (onProgress) {
              const progress = Math.round(((epoch + 1) / epochs) * 100);
              onProgress(epoch + 1, progress, logs.loss, accVal);
            }
          }
        }
      }
    });

    // Dọn dẹp RAM
    xs.dispose();
    ys.dispose();

    return logsHistory;
  }

  /**
   * Dự đoán nhãn từ tọa độ mới
   */
  async predict(features: number[]): Promise<{ label: string, confidence: number, confidences?: Record<string, number> }> {
    await this.init();
    if (!this.tf) throw new Error('TensorFlow.js failed to load');
    return this.predictSync(features);
  }

  /**
   * Dự đoán đồng bộ (không await), dùng trong vòng lặp requestAnimationFrame
   */
  predictSync(features: number[]): { label: string, confidence: number, confidences?: Record<string, number> } {
    if (!this.model || this.classNames.length === 0 || !this.tf) {
      return { label: 'Chưa huấn luyện', confidence: 0 };
    }

    const tf = this.tf;
    return tf.tidy(() => {
      const input = tf.tensor2d([features]);
      const prediction = this.model!.predict(input);
      const scores = prediction.dataSync();
      
      let maxScore = -1;
      let maxIndex = 0;
      const confidences: Record<string, number> = {};
      
      for (let i = 0; i < scores.length; i++) {
        confidences[this.classNames[i]] = scores[i];
        if (scores[i] > maxScore) {
          maxScore = scores[i];
          maxIndex = i;
        }
      }

      return {
        label: this.classNames[maxIndex],
        confidence: Math.round(maxScore * 100),
        confidences
      };
    });
  }

  isTrained(): boolean {
    return this.model !== null;
  }
}
