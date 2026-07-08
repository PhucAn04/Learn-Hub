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
  classSummary: any; // { 'Vui vẻ': 5, 'Buồn bã': 3, ... }

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Model, (model) => model.dataset)
  models: Model[];
}

