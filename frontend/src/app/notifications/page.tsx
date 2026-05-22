'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usersApi } from '@/lib/api';
import { Notification } from '@/types';
import { useNotificationStore } from '@/lib/store';
import { Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { clsx } from 'clsx';

const TYPE_COLORS: Record<string, string> = {
  status_update: 'bg-[#00aaef]/10 border-l-[#00aaef]',
  new_comment: 'bg-[#3B82F6]/10 border-l-[#3B82F6]',
  resolved: 'bg-[#00aaef]/10 border-l-[#00aaef]',
  rejected: 'bg-[#EF4444]/10 border-l-[#EF4444]',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { setUnreadCount } = useNotificationStore();

  useEffect(() => {
    usersApi.notifications()
      .then((res) => {
        setNotifications(res.data.notifications);
        setUnreadCount(0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setUnreadCount]);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
          <Bell size={26} className="text-[#00aaef]" /> Notifications
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="text-[#00aaef] animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center text-[#9CA3AF]">No notifications yet.</div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {notifications.map((notif) => (
            <div key={notif.id}
              className={clsx('card p-4 border-l-2 animate-slide_in', TYPE_COLORS[notif.type] || 'bg-[#0B0F14] border-l-white/10')}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-white text-sm leading-relaxed">{notif.message}</p>
                <span className="text-[#9CA3AF] text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                </span>
              </div>
              {notif.issue_id && (
                <Link href={`/issues/${notif.issue_id}`} className="text-[#00aaef] text-xs mt-2 inline-block hover:underline">
                  View Issue →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
