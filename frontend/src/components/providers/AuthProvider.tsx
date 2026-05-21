'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import { authApi, usersApi } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const { setUnreadCount, increment } = useNotificationStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    authApi.me()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      if (user.is_verified === false && !['/verify-email', '/login', '/register', '/'].includes(pathname)) {
        router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
      } else if (user.is_verified && pathname === '/verify-email') {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, pathname, router]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      disconnectSocket();
      return;
    }

    // Fetch initial count
    usersApi.unreadCount()
      .then((res) => {
        setUnreadCount(res.data.unreadCount || 0);
      })
      .catch((err) => {
        console.error('Failed to fetch initial unread notifications count:', err);
      });

    // Setup socket connection
    const socket = getSocket();
    
    const handleNewNotification = () => {
      increment();
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
      disconnectSocket();
    };
  }, [user, setUnreadCount, increment]);

  return <>{children}</>;
}
