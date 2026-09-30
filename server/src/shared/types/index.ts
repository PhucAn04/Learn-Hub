/**
 * Shared type definitions for the Server (NestJS).
 * These interfaces ensure type-safety across Entities, DTOs, and Services.
 */

// ── Custom Class (user-defined class labels for datasets) ────────────────────

export interface CustomClass {
  id: string;
  label: string;
  emoji?: string;
}

// ── Training Sample (individual data point in a dataset) ─────────────────────

export interface TrainingSample {
  id?: string;
  label: string;
  features: number[];
  sourceId?: string;
  thumbnail?: string;
  rawThumbnail?: string;
  isValid?: boolean;
  quality?: {
    brightness: number;
    blurScore: number;
    isDark: boolean;
    isBright: boolean;
    isBlurry: boolean;
  };
  aiFeedback?: {
    isMisclassified: boolean;
    predictedLabel: string;
    nearestMatchThumbnail?: string;
  };
}

// ── Submission Dataset (JSON blob stored in submission.dataset) ───────────────

export interface SubmissionDataset {
  samples?: TrainingSample[];
  classSummary?: Record<string, number>;
  testScore?: number;
  reflectionAnswer?: string;
}

// ── Google OAuth Profile (extracted from passport strategy callback) ──────────

export interface GoogleOAuthProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  googleId: string;
  accessToken: string;
  refreshToken?: string;
}

// ── Leaderboard Entry ─────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  highScore?: number;
  completedAt?: string;
  lastCompletedAt?: string;
}
