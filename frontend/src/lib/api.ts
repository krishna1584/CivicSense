import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          const isPublic = PUBLIC_PATHS.includes(window.location.pathname);
          if (!isPublic) window.location.href = '/login';
        }
        return Promise.reject(refreshError);
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
  sendOtp: (data: { email: string }) => api.post('/api/auth/send-otp', data),
  verifyOtp: (data: { email: string; code: string }) => api.post('/api/auth/verify-otp', data),
};

// Issues
export const issuesApi = {
  list: (params?: Record<string, unknown>) => api.get('/api/issues', { params }),
  get: (id: string) => api.get(`/api/issues/${id}`),
  create: (data: FormData) => api.post('/api/issues', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id: string, data: FormData | { status: string; comment?: string; rejection_reason?: string }) => {
    const isFd = data instanceof FormData;
    return api.patch(`/api/issues/${id}/status`, data, {
      headers: isFd ? { 'Content-Type': 'multipart/form-data' } : {}
    });
  },
  verifyResolution: (id: string, data: { approved: boolean; comment?: string }) =>
    api.post(`/api/issues/${id}/verify-resolution`, data),
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
  unreadCount: () => api.get('/api/users/me/notifications/unread-count'),
  profile: (id: string) => api.get(`/api/users/${id}/profile`),
  userIssues: (id: string, params?: Record<string, unknown>) => api.get(`/api/users/${id}/issues`, { params }),
  updateProfile: (data: FormData) => api.patch('/api/users/me', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  updateUser: (id: string, data: FormData | { role?: string; is_active?: boolean }) => {
    const isFd = data instanceof FormData;
    return api.patch(`/api/admin/users/${id}`, data, {
      headers: isFd ? { 'Content-Type': 'multipart/form-data' } : {}
    });
  },
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),
  logs: (params?: Record<string, unknown>) => api.get('/api/admin/logs', { params }),
  deleteComment: (id: string) => api.delete(`/api/admin/comments/${id}`),
  getSettings: () => api.get('/api/admin/settings'),
  updateSettings: (data: Record<string, any>) => api.patch('/api/admin/settings', data),
  getPublicSettings: () => api.get('/api/admin/settings/public'),
};

export default api;

// Reviews
export const reviewsApi = {
  list: (issueId: string) => api.get(`/api/issues/${issueId}/reviews`),
  submit: (issueId: string, data: { rating: number; comment?: string }) =>
    api.post(`/api/issues/${issueId}/reviews`, data),
  hide: (issueId: string, reviewId: string) =>
    api.patch(`/api/issues/${issueId}/reviews/${reviewId}/hide`),
};
