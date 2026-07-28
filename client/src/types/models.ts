import { StoredSample } from '@/lib/knn-classifier';

// ── Nearest Neighbor (returned by classifyKNNDetailed) ──────────────────────

export interface NearestNeighbor {
  label: string;
  distance: number;
  thumbnail?: string;
  sourceId?: string;
}

// ── Correctness Issue (AI Feedback analysis result) ──────────────────────────

export interface CorrectnessIssue {
  studentSample: StoredSample;
  studentClassLabel: string;
  predictedClassLabel: string;
  votes: number;
  nearest: NearestNeighbor[];
  matchingNearest: NearestNeighbor[];
}

// ── Teacher Template ─────────────────────────────────────────────────────────

export interface TeacherTemplate {
  id?: string;
  challengeType?: string;
  classSummary?: Record<string, number>;
  sampleCount?: number;
  teacherNotes?: string;
  isTemplate?: boolean;
  isPublished?: boolean;
  dataSourceType?: string;
  customClasses?: CustomClass[];
  createdAt?: string;
  samples?: StoredSample[];
  dataset?: {
    samples?: StoredSample[];
  };
  user?: UserProfile;
}

// ── Custom Class (user-defined class labels) ─────────────────────────────────

export interface CustomClass {
  id: string;
  label: string;
  emoji?: string;
}

// ── User Profile (returned by auth endpoints) ────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  googleId?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Dataset (entity returned from server API) ────────────────────────────────

export interface DatasetResponse {
  id: string;
  userId: string;
  challengeType: string;
  dataFileUrl?: string;
  sampleCount: number;
  classSummary?: Record<string, number>;
  isTemplate: boolean;
  teacherNotes?: string;
  isPublished: boolean;
  dataSourceType?: string;
  googleDriveFolderUrl?: string;
  customClasses?: CustomClass[];
  samples?: StoredSample[];
  createdAt: string;
  user?: UserProfile;
  model?: ModelResponse | null;
}

// ── Model (entity returned from server API) ──────────────────────────────────

export interface ModelResponse {
  id: string;
  userId: string;
  datasetId: string;
  testScore: number;
  teacherFeedback?: string;
  createdAt: string;
}

// ── Submission (entity returned from server API) ─────────────────────────────

export interface SubmissionResponse {
  id: string;
  userId: string;
  challengeType: string;
  accuracy: number;
  dataset?: SubmissionDataset;
  reflectionAnswer?: string;
  createdAt: string;
  user?: UserProfile;
}

export interface SubmissionDataset {
  samples?: StoredSample[];
  classSummary?: Record<string, number>;
  testScore?: number;
  reflectionAnswer?: string;
}

// ── Dataset File (the JSON file content returned by getDatasetFile) ──────────

export interface DatasetFileResponse {
  samples?: StoredSample[];
  data?: StoredSample[];
}

// ── Auth Response ────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
}

// ── Progress / Leaderboard ───────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  challengeType: string;
}

// ── TensorFlow.js types (for CDN-loaded tf) ──────────────────────────────────
// These are minimal interfaces to replace `any` when TF.js is loaded via CDN
// and not available as a compile-time dependency.

export interface TFTensor {
  dispose(): void;
  dataSync(): Float32Array;
}

export interface TFLayersModel {
  add(layer: TFTensor | unknown): void;
  compile(config: {
    optimizer: unknown;
    loss: string;
    metrics: string[];
  }): void;
  fit(
    x: TFTensor,
    y: TFTensor,
    config: {
      epochs: number;
      batchSize: number;
      shuffle: boolean;
      callbacks?: {
        onEpochEnd?: (epoch: number, logs?: { loss: number; acc?: number; accuracy?: number }) => void;
      };
    },
  ): Promise<void>;
  predict(input: TFTensor): TFTensor;
}

export interface TFStatic {
  sequential(): TFLayersModel;
  layers: {
    dense(config: { units: number; activation: string; inputShape?: number[] }): unknown;
    dropout(config: { rate: number }): unknown;
  };
  train: {
    adam(learningRate: number): unknown;
  };
  tensor2d(values: number[][]): TFTensor;
  tensor1d(values: number[], dtype?: string): TFTensor;
  oneHot(indices: TFTensor, depth: number): TFTensor;
  tidy<T>(fn: () => T): T;
}

// ── Google OAuth Profile (server-side) ───────────────────────────────────────

export interface GoogleOAuthProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  googleId: string;
  accessToken: string;
  refreshToken?: string;
}
