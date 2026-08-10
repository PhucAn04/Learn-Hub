import { StoredSample } from './knn-classifier';
import type {
  AuthResponse,
  UserProfile,
  DatasetResponse,
  DatasetFileResponse,
  ModelResponse,
  SubmissionResponse,
  SubmissionDataset,
  CustomClass,
  LeaderboardEntry,
} from '@/types/models';

const API_BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  },

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  },

  clearToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  },

  async login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(username: string, email: string, password?: string, avatar?: string) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, avatar }),
    });
  },

  async getProfile() {
    return request<UserProfile>('/auth/profile', {
      method: 'GET',
    });
  },

  async saveProgress(challengeType: string, score: number) {
    return request<{ id: string; challengeType: string; score: number }>('/progress', {
      method: 'POST',
      body: JSON.stringify({ challengeType, score }),
    });
  },

  async getLeaderboard(challengeType: string) {
    return request<LeaderboardEntry[]>(`/progress/leaderboard/${challengeType}`, {
      method: 'GET',
    });
  },

  async getUserStats() {
    return request<Record<string, number>>('/progress/stats', {
      method: 'GET',
    });
  },

  async submitAssignment(accuracy: number, dataset: SubmissionDataset, reflectionAnswer: string, challengeType: string = 'teach') {
    return request<SubmissionResponse>('/submissions', {
      method: 'POST',
      body: JSON.stringify({ accuracy, dataset, reflectionAnswer, challengeType }),
    });
  },

  async getSubmissions() {
    return request<SubmissionResponse[]>('/submissions', {
      method: 'GET',
    });
  },

  // ── Dataset Management ──

  async createDataset(
    challengeType: string, 
    samples: StoredSample[], 
    testScore: number, 
    reflectionAnswer?: string,
    isTemplate?: boolean,
    teacherNotes?: string,
    isPublished?: boolean,
    dataSourceType?: string,
    customClasses?: CustomClass[]
  ) {
    return request<{ dataset: DatasetResponse; model: ModelResponse }>('/datasets', {
      method: 'POST',
      body: JSON.stringify({ 
        challengeType, 
        samples, 
        testScore, 
        reflectionAnswer,
        isTemplate,
        teacherNotes,
        isPublished,
        dataSourceType,
        customClasses
      }),
    });
  },

  async getTemplates(challengeType?: string) {
    const query = challengeType ? `?challengeType=${encodeURIComponent(challengeType)}` : '';
    return request<DatasetResponse[]>(`/datasets/templates${query}`, {
      method: 'GET',
    });
  },

  async getMyDatasets(challengeType: string) {
    return request<DatasetResponse[]>(`/datasets/my?challengeType=${encodeURIComponent(challengeType)}`, {
      method: 'GET',
    });
  },

  async getDatasetsByChallenge(challengeType: string) {
    return request<DatasetResponse[]>(`/datasets/by-challenge/${encodeURIComponent(challengeType)}`, {
      method: 'GET',
    });
  },

  async getDatasetFile(datasetId: string) {
    const data = await request<unknown>(`/datasets/${datasetId}/file`, {
      method: 'GET',
    });
    if (Array.isArray(data)) {
      return { samples: data } as DatasetFileResponse;
    }
    return data as DatasetFileResponse;
  },

  async getDatasetById(datasetId: string) {
    return request<DatasetResponse>(`/datasets/${datasetId}`, {
      method: 'GET',
    });
  },

  // ── Model Management ──

  async getMyModels(challengeType?: string) {
    const query = challengeType ? `?challengeType=${encodeURIComponent(challengeType)}` : '';
    return request<ModelResponse[]>(`/models/my${query}`, {
      method: 'GET',
    });
  },

  async getModelById(modelId: string) {
    return request<ModelResponse>(`/models/${modelId}`, {
      method: 'GET',
    });
  },

  async updateModelArtifacts(
    modelId: string,
    data: {
      algorithm?: string;
      modelArtifactUrl?: string;
      testScore?: number;
      hyperparameters?: {
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        k?: number;
      };
      trainingLogs?: { epoch: number; loss: number; acc: number }[];
      version?: number;
      parentModelId?: string;
      evaluation?: Record<string, unknown>;
    }
  ) {
    return request<ModelResponse>(`/models/${modelId}/artifacts`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async uploadModelArtifactsFiles(modelId: string, formData: FormData) {
    return request<ModelResponse>(`/models/${modelId}/artifacts/upload`, {
      method: 'PATCH',
      body: formData,
    });
  },

  async addTeacherFeedback(modelId: string, feedback: string) {
    return request<ModelResponse>(`/models/${modelId}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    });
  },

  async togglePublish(datasetId: string, isPublished: boolean) {
    return request<DatasetResponse>(`/datasets/${datasetId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished }),
    });
  },

  // ── Model Chain (Version Tracking) ──

  async getModelChain(challengeType: string) {
    return request<ModelResponse[]>(`/models/chain/${encodeURIComponent(challengeType)}`, {
      method: 'GET',
    });
  },

  // ── Action Logs ──

  async createActionLogs(
    modelId: string,
    logs: {
      action: string;
      details?: {
        samplesAdded?: number;
        samplesDeleted?: number;
        targetLabel?: string;
        wasWeakestLabel?: boolean;
        triggerSource?: string;
      };
    }[]
  ) {
    return request<unknown>('/action-logs', {
      method: 'POST',
      body: JSON.stringify({ modelId, logs }),
    });
  },

  async getActionLogsByModel(modelId: string) {
    return request<{ id: string; action: string; details?: Record<string, unknown>; createdAt: string }[]>(
      `/action-logs/model/${modelId}`,
      { method: 'GET' }
    );
  },

  // ── Assessments (Skill Scores) ──

  async upsertAssessment(data: {
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
  }) {
    return request<unknown>('/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyAssessments() {
    return request<unknown[]>('/assessments/my', { method: 'GET' });
  },

  async getAllAssessments() {
    return request<unknown[]>('/assessments/all', { method: 'GET' });
  },

  async getAssessmentsByUser(userId: string) {
    return request<unknown[]>(`/assessments/user/${userId}`, { method: 'GET' });
  },
};

