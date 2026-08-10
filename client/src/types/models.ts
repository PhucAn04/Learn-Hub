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
  algorithm?: string;
  testScore: number;
  modelArtifactUrl?: string;
  hyperparameters?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    k?: number;
  };
  trainingLogs?: { epoch: number; loss: number; acc: number }[];
  teacherFeedback?: string;
  version?: number;
  parentModelId?: string;
  evaluation?: ModelEvaluation;
  createdAt: string;
}

// ── Model Evaluation (stored per model version) ──────────────────────────────

export interface ModelEvaluation {
  goldenAccuracy: number;
  goldenCorrectCount: number;
  goldenTotalCount: number;
  confusionMatrix: {
    labels: string[];
    matrix: number[][];
    perClassAccuracy: Record<string, number>;
    perClassPrecision?: Record<string, number>;
    perClassRecall?: Record<string, number>;
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
  // ── Dẫn Chứng Cụ Thể (cho GV drill-down) ──
  sampleEvidence?: {
    // Ảnh có vấn đề chất lượng (mờ/tối) — kèm thumbnail
    qualityIssues: {
      label: string;
      isBlurry: boolean;
      isDark: boolean;
      brightness?: number;
      blurScore?: number;
      thumbnail?: string;
    }[];
    // Ảnh bị AI dự đoán sai nhãn — kèm thumbnail
    misclassifiedSamples: {
      label: string;
      predictedLabel: string;
      thumbnail?: string;
    }[];
    // Kết quả từng câu hỏi kiểm tra Golden Test
    goldenTestDetails: {
      expectedLabel: string;
      predictedLabel: string;
      isCorrect: boolean;
      confidence: number;
    }[];
    // Phân bổ ảnh từng nhãn kèm thumbnails mẫu (tối đa 4 ảnh/nhãn)
    classPreviews: {
      label: string;
      count: number;
      sampleThumbnails: string[];
    }[];
  };
  evaluatedAt: string;
  evaluationVersion: string;
}

// ── Assessment (skill scores per student per challenge) ──────────────────────

export interface AssessmentResponse {
  id: string;
  userId: string;
  challengeType: string;
  modelChain: {
    modelId: string;
    version: number;
    testScore: number;
    sampleCount: number;
    classSummary: Record<string, number>;
  }[];
  dataCurationScore: number;
  debuggingScore: number;
  improvementScore: number;
  overallScore: number;
  narrative?: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };
  createdAt: string;
  user?: UserProfile;
}

// ── Action Log (student behavior tracking) ───────────────────────────────────

export interface ActionLogResponse {
  id: string;
  userId: string;
  modelId: string;
  action: string;
  details?: {
    samplesAdded?: number;
    samplesDeleted?: number;
    targetLabel?: string;
    wasWeakestLabel?: boolean;
    triggerSource?: string;
  };
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
  save(handler: unknown): Promise<unknown>;
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
  io: {
    withSaveHandler(handler: (artifacts: {
      modelTopology?: unknown;
      format?: string;
      generatedBy?: string;
      convertedBy?: string;
      weightSpecs?: unknown[];
      weightData?: ArrayBuffer;
    }) => Promise<{
      modelArtifactsInfo: {
        dateSaved: Date;
        modelTopologyType: string;
      }
    }>): unknown;
  };
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
