import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Model } from '../../models/entities/model.entity';

@Entity('datasets')
export class Dataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ default: 'teach' })
  challengeType: string;

  @Column({ type: 'text', nullable: true })
  dataFileUrl: string; // path to the JSON file on disk

  @Column({ type: 'int', default: 0 })
  sampleCount: number;

  @Column({ type: 'json', nullable: true })
  classSummary: Record<string, number>; // { 'Vui vẻ': 5, 'Buồn bã': 3, ... }

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ type: 'text', nullable: true })
  teacherNotes: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  dataSourceType: string; // 'camera', 'upload', 'video'

  @Column({ nullable: true })
  googleDriveFolderUrl?: string;

  @Column({ type: 'json', nullable: true })
  customClasses?: { id: string; label: string; emoji?: string }[]; // [{id: 'class_1', label: 'Bước 1', emoji: '✨'}]

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Model, (model) => model.dataset)
  models: Model[];
}

