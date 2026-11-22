import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/explore', '/report/anonymous', '/track'];
const isPublicPath = (path: string) =>
  PUBLIC_PATHS.includes(path) || path.startsWith('/issues/') || /^\/profile\/[^/]+$/.test(path);

// These endpoints answer 401 for reasons a token refresh cannot fix.
const NO_REFRESH_URLS = ['/auth/refresh', '/auth/login', '/auth/register'];

// Refresh tokens are single-use, so concurrent 401s must share one refresh.
// The Web Lock extends that guarantee across browser tabs where available.
let refreshInFlight: Promise<unknown> | null = null;
const postRefresh = () => axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
const refreshSession = () => {
  if (!refreshInFlight) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const attempt: Promise<unknown> = locks ? locks.request('civicsense-auth-refresh', postRefresh) : postRefresh();
    refreshInFlight = attempt.finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
};

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
    if (error.response?.status === 401 && !original._retry && !NO_REFRESH_URLS.some((url) => original.url?.includes(url))) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch (refreshError) {
        if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
          const { pathname, search } = window.location;
          window.location.href = `/login?redirect=${encodeURIComponent(pathname + search)}`;
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
  skipVerification: () => api.post('/api/auth/skip-verification'),
  forgotPassword: (data: { email: string }) => api.post('/api/auth/forgot-password', data),
  resetPassword: (data: { email: string; code: string; password: string }) => api.post('/api/auth/reset-password', data),
};

// Issues
export const issuesApi = {
  list: (params?: Record<string, unknown>) => api.get('/api/issues', { params }),
  get: (id: string) => api.get(`/api/issues/${id}`),
  create: (data: FormData, onProgress?: (percent: number) => void) => api.post('/api/issues', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total)); },
  }),
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
  publicStats: () => api.get('/api/issues/stats/public'),
  trending: (lat: number, lng: number) => api.get('/api/issues/trending/nearby', { params: { lat, lng } }),
};

// Anonymous reporting: a separate client so login cookies are never sent
const anonymousClient = axios.create({ baseURL: `${API_BASE}/api/anonymous`, withCredentials: false });

export const anonymousApi = {
  challenge: () => anonymousClient.get('/challenge'),
  submit: (data: FormData, onProgress?: (percent: number) => void) => anonymousClient.post('/reports', data, {
    onUploadProgress: (e) => { if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total)); },
  }),
  track: (token: string) => anonymousClient.post('/track', { token }),
  decide: (data: { token: string; approved: boolean; comment?: string }) => anonymousClient.post('/decision', data),
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
  notifications: (params?: { page?: number }) => api.get('/api/users/me/notifications', { params }),
  markNotificationsRead: (ids: string[]) => api.patch('/api/users/me/notifications/read', { ids }),
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
  moderate: (id: string, data: { decision: 'approve' | 'reject'; reason?: string }) =>
    api.patch(`/api/admin/issues/${id}/moderation`, data),
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
