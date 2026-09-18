import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Dataset } from '../../datasets/entities/dataset.entity';

@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  datasetId!: string;

  @Column({ default: 'knn' })
  algorithm!: string; // 'knn' | 'mlp' | 'custom_nn'

  @Column({ type: 'float', default: 0 })
  testScore!: number;

  @Column({ type: 'text', nullable: true })
  modelArtifactUrl?: string; // path hoặc URL lưu file weights model.json

  @Column({ type: 'json', nullable: true })
  hyperparameters?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    k?: number;
  };

  @Column({ type: 'json', nullable: true })
  trainingLogs?: { epoch: number; loss: number; acc: number }[];

  @Column({ type: 'text', nullable: true })
  teacherFeedback?: string;

  // ── MỚI: Version Chain ──
  @Column({ default: 1 })
  version!: number;

  @Column({ type: 'uuid', nullable: true })
  parentModelId?: string;

  @ManyToOne(() => Model, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentModelId' })
  parentModel?: Model;

  // ── MỚI: Evaluation (gộp tất cả kết quả đánh giá) ──
  @Column({ type: 'json', nullable: true })
  evaluation?: {
    goldenAccuracy: number;
    goldenCorrectCount: number;
    goldenTotalCount: number;
    confusionMatrix: {
      labels: string[];
      matrix: number[][];
      perClassAccuracy: Record<string, number>;
      weakestLabel: string;
      strongestLabel: string;
      misclassifications: {
        trueLabel: string;
        predictedLabel: string;
        count: number;
        percentage: number;
      }[];
    };
    crossCheck: {
      hasTeacherTemplate: boolean;
      totalSamples: number;
      conflictCount: number;
      agreementRate: number;
    };
    datasetHealth: {
      sampleCount: number;
      classSummary: Record<string, number>;
      balanceRatio: number;
      isImbalanced: boolean;
      phase: 'PHASE_A' | 'PHASE_B';
      qualityScore: number;
      blurrySampleCount: number;
      darkSampleCount: number;
    };
    evaluatedAt: string;
    evaluationVersion: string;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Dataset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'datasetId' })
  dataset!: Dataset;
}
