import type { UserProfile } from '@/types/models';

const API_BASE_URL = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
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
        localStorage.removeItem('admin_token');
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const adminApi = {
  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
    }
  },

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_token');
    }
    return null;
  },

  clearToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
    }
  },

  async login(email: string, password: string) {
    return request<{ user: UserProfile; accessToken: string }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getProfile() {
    return request<UserProfile>('/admin/auth/profile', {
      method: 'GET',
    });
  },

  async getStats() {
    return request<{ total: number; activeCount: number; byRole: { student: number; teacher: number }; newToday: number }>('/admin/stats', {
      method: 'GET',
    });
  },

  async getUsers(params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const endpoint = query ? `/admin/users?${query}` : '/admin/users';
    
    return request<{ data: (UserProfile & { isActive: boolean; lastLoginAt?: string })[]; total: number; page: number; limit: number; totalPages: number }>(endpoint, {
      method: 'GET',
    });
  },

  async getUser(id: string) {
    return request<UserProfile & { isActive: boolean; lastLoginAt?: string; deactivatedAt?: string; roleChangedAt?: string }>(`/admin/users/${id}`, {
      method: 'GET',
    });
  },

  async changeRole(id: string, role: string) {
    return request<UserProfile>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async toggleStatus(id: string, isActive: boolean) {
    return request<UserProfile>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async generateResetLink(id: string) {
    return request<{ resetLink: string }>(`/admin/users/${id}/generate-reset-link`, {
      method: 'POST',
    });
  },

  async sendResetEmail(id: string) {
    return request<{ success: boolean }>(`/admin/users/${id}/send-reset-email`, {
      method: 'POST',
    });
  },
};
