import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ default: 'teach' })
  challengeType: string;

  @Column({ type: 'float', default: 0 })
  accuracy: number;

  @Column({ type: 'json', nullable: true })
  dataset: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  reflectionAnswer: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
