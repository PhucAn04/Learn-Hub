import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  username!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false, nullable: true })
  password?: string;

  @Column({ default: '🦁' })
  avatar!: string;

  @Column({ default: 'student' })
  role!: string;

  // ── Google OAuth Fields ──

  @Column({ nullable: true, unique: true })
  googleId?: string;

  @Column({ nullable: true })
  googleAccessToken?: string;

  @Column({ nullable: true })
  googleRefreshToken?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 🛡️ Admin Management Fields 🛡️
  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  deactivatedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt?: Date;

  @Column({ nullable: true })
  roleChangedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  roleChangedAt?: Date;

  // 🔑 Password Reset Fields 🔑
  @Column({ type: 'varchar', nullable: true, select: false })
  resetPasswordToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  resetPasswordExpires?: Date | null;
}
