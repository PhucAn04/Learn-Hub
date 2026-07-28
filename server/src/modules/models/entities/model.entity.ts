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

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Dataset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'datasetId' })
  dataset!: Dataset;
}
