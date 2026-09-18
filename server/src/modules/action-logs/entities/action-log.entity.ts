import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('action_logs')
export class ActionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  modelId!: string;

  @Column()
  action!: string; // 'ADD_SAMPLES' | 'DELETE_SAMPLES' | 'RETRAIN'

  @Column({ type: 'json', nullable: true })
  details?: {
    samplesAdded?: number;
    samplesDeleted?: number;
    targetLabel?: string;
    wasWeakestLabel?: boolean;
    triggerSource?: string;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
