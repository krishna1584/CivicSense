import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
console.log('🌐 Frontend API_BASE:', API_BASE);

const PUBLIC_PATHS = ['/', '/login', '/register'];

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Auto refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        return api(original);
      } catch {
        if (typeof window !== 'undefined') {
          const isPublic = PUBLIC_PATHS.includes(window.location.pathname);
          if (!isPublic) window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) => api.post('/api/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

// Issues
export const issuesApi = {
  list: (params?: Record<string, unknown>) => api.get('/api/issues', { params }),
  get: (id: string) => api.get(`/api/issues/${id}`),
  create: (data: FormData) => api.post('/api/issues', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id: string, data: { status: string; comment?: string; rejection_reason?: string }) =>
    api.patch(`/api/issues/${id}/status`, data),
  history: (id: string) => api.get(`/api/issues/${id}/history`),
  categories: () => api.get('/api/issues/categories/all'),
  trending: (lat: number, lng: number) => api.get('/api/issues/trending/nearby', { params: { lat, lng } }),
};

// Comments
export const commentsApi = {
  list: (issueId: string, params?: Record<string, unknown>) => api.get(`/api/issues/${issueId}/comments`, { params }),
  create: (issueId: string, data: { content: string; parent_id?: string }) =>
    api.post(`/api/issues/${issueId}/comments`, data),
  update: (issueId: string, commentId: string, data: { content: string }) => 
    api.patch(`/api/issues/${issueId}/comments/${commentId}`, data),
  delete: (issueId: string, commentId: string) => api.delete(`/api/issues/${issueId}/comments/${commentId}`),
};

// Votes & Follows
export const engagementApi = {
  vote: (issueId: string, vote_type: 'upvote' | 'downvote') => api.post(`/api/issues/${issueId}/votes`, { vote_type }),
  follow: (issueId: string) => api.post(`/api/issues/${issueId}/follow`),
};

// Users
export const usersApi = {
  dashboard: () => api.get('/api/users/me/dashboard'),
  myIssues: (params?: Record<string, unknown>) => api.get('/api/users/me/issues', { params }),
  notifications: () => api.get('/api/users/me/notifications'),
  profile: (id: string) => api.get(`/api/users/${id}/profile`),
};

// Admin
export const adminApi = {
  dashboard: () => api.get('/api/admin/dashboard'),
  issues: (params?: Record<string, unknown>) => api.get('/api/admin/issues', { params }),
  bulkStatus: (issueIds: string[], status: string, comment?: string) =>
    api.patch('/api/admin/issues/bulk-status', { issueIds, status, comment }),
  assign: (id: string, data: { assigned_to?: string; department?: string }) =>
    api.patch(`/api/admin/issues/${id}/assign`, data),
  analytics: (period?: number) => api.get('/api/admin/analytics', { params: { period } }),
  users: (params?: Record<string, unknown>) => api.get('/api/admin/users', { params }),
};

export default api;
