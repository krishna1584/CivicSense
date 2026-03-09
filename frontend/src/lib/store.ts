import { create } from 'zustand';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isLoading: true,
  setLoading: (isLoading) => set({ isLoading }),
}));

interface NotificationStore {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  increment: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
}));
