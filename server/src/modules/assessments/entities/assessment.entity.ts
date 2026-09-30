import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  challengeType!: string;

  @Column({ type: 'json' })
  modelChain!: {
    modelId: string;
    version: number;
    testScore: number;
    sampleCount: number;
    classSummary: Record<string, number>;
  }[];

  @Column({ type: 'int', default: 0 })
  dataCurationScore!: number;

  @Column({ type: 'int', default: 0 })
  debuggingScore!: number;

  @Column({ type: 'int', default: 0 })
  improvementScore!: number;

  @Column({ type: 'int', default: 0 })
  overallScore!: number;

  @Column({ type: 'json', nullable: true })
  narrative?: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
