import { loadTf } from './tf-loader';
import { StoredSample } from './knn-classifier';

export class TfTrainer {
  private model: any = null; // tf.LayersModel
  private classNames: string[] = [];
  private tf: any = null;

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
    onProgress?: (epoch: number, progress: number, loss: number, acc: number) => void
  ) {
    await this.init();
    if (samples.length === 0) throw new Error('Không có dữ liệu huấn luyện');

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
      optimizer: this.tf.train.adam(0.005),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    // 3. Chuẩn bị dữ liệu Tensor
    const xs = this.tf.tensor2d(samples.map(s => s.features));
    
    // One-hot encoding cho Labels
    const labels = samples.map(s => this.classNames.indexOf(s.label));
    const ys = this.tf.oneHot(this.tf.tensor1d(labels, 'int32'), numClasses);

    // 4. Bắt đầu Train
    const epochs = 50;
    await this.model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(32, samples.length),
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch: number, logs?: any) => {
          if (onProgress && logs) {
            const progress = Math.round(((epoch + 1) / epochs) * 100);
            onProgress(epoch + 1, progress, logs.loss, logs.acc || logs.accuracy);
          }
        }
      }
    });

    // Dọn dẹp RAM
    xs.dispose();
    ys.dispose();
  }

  /**
   * Dự đoán nhãn từ tọa độ mới
   */
  async predict(features: number[]): Promise<{ label: string, confidence: number }> {
    await this.init();
    if (!this.model || this.classNames.length === 0) {
      return { label: 'Chưa huấn luyện', confidence: 0 };
    }

    return this.tf.tidy(() => {
      const input = this.tf.tensor2d([features]);
      const prediction = this.model!.predict(input);
      const scores = prediction.dataSync();
      
      let maxScore = -1;
      let maxIndex = 0;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > maxScore) {
          maxScore = scores[i];
          maxIndex = i;
        }
      }

      return {
        label: this.classNames[maxIndex],
        confidence: Math.round(maxScore * 100)
      };
    });
  }

  isTrained(): boolean {
    return this.model !== null;
  }
}
