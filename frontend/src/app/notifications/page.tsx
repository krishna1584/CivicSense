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
  status_update: 'border-l-accent-secondary bg-accent-secondary/5',
  new_comment: 'border-l-accent-primary bg-accent-primary/5',
  resolved: 'border-l-[#22C55E] bg-[#22C55E]/5',
  rejected: 'border-l-[#EF4444] bg-[#EF4444]/5',
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
        <h1 className="text-3xl font-bold text-content-primary flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent-secondary/10">
            <Bell size={20} className="text-accent-secondary" />
          </span>
          Notifications
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="text-accent-secondary animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-base-850 border border-border-subtle rounded-xl p-12 text-center text-content-muted">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {notifications.map((notif) => (
            <div key={notif.id}
              className={clsx(
                'rounded-xl border border-border-subtle border-l-2 p-4 transition-all duration-200 hover:bg-base-800/80 hover:border-border-subtle',
                TYPE_COLORS[notif.type] || 'border-l-accent-secondary bg-base-850'
              )}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-content-primary text-sm leading-relaxed">{notif.message}</p>
                <span className="text-content-muted text-xs whitespace-nowrap shrink-0 mt-0.5">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                </span>
              </div>
              {notif.issue_id && (
                <Link href={`/issues/${notif.issue_id}`} className="text-accent-secondary text-xs mt-3 inline-block hover:text-accent-secondary transition-colors">
                  View Issue &rarr;
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
