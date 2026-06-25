const API_BASE_URL = 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
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
    return request<{ user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(username: string, email: string, password?: string, avatar?: string) {
    return request<{ user: any; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, avatar }),
    });
  },

  async getProfile() {
    return request<any>('/auth/profile', {
      method: 'GET',
    });
  },

  async saveProgress(challengeType: string, score: number) {
    return request<any>('/progress', {
      method: 'POST',
      body: JSON.stringify({ challengeType, score }),
    });
  },

  async getLeaderboard(challengeType: string) {
    return request<any[]>(`/progress/leaderboard/${challengeType}`, {
      method: 'GET',
    });
  },

  async getUserStats() {
    return request<Record<string, number>>('/progress/stats', {
      method: 'GET',
    });
  },
};
