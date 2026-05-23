'use client';

import { useState, useEffect } from 'react';
import { Bell, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import { usersApi } from '@/lib/api';

const formatMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

interface TopBarProps {
  title: string;
  sub?: string;
  darkMode?: boolean;
  toggleDark?: () => void;
  actions?: React.ReactNode;
}

export function TopBar({ title, sub, darkMode: controlledDarkMode, toggleDark: controlledToggleDark, actions }: TopBarProps) {
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const [localDarkMode, setLocalDarkMode] = useState(true);

  const isDarkMode = controlledDarkMode !== undefined ? controlledDarkMode : localDarkMode;
  const handleToggleDark = controlledToggleDark || (() => setLocalDarkMode(v => !v));

  const avatarUrl = user?.avatar_url ? formatMediaUrl(user.avatar_url) : '';
  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'AU';
  const displayName = user?.name || 'Admin User';
  const displayRole = user?.role ? user.role.replace('_', ' ') : 'Admin';

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-white/5 h-14 flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-base text-white leading-tight truncate">{title}</h1>
        {sub && <p className="text-[10px] text-[#9CA3AF] truncate">{sub}</p>}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}

      <button onClick={handleToggleDark} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0">
        {isDarkMode ? <Sun size={14} className="text-[#9CA3AF]" /> : <Moon size={14} className="text-[#9CA3AF]" />}
      </button>
      
      {user && (
        <Link 
          href="/notifications" 
          className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          title="View Notifications"
        >
          <Bell size={14} className="text-[#9CA3AF]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>
      )}

      {user && (
        <Link href="/profile" className="flex items-center gap-2.5 cursor-pointer group shrink-0">
          <div className="w-8 h-8 rounded-full bg-accent-secondary/10 border border-accent-secondary/20 flex items-center justify-center text-xs font-bold text-accent-secondary overflow-hidden group-hover:border-accent-secondary/40 transition-all duration-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-[#F5F7FA] group-hover:text-accent-secondary transition-colors duration-200 leading-tight truncate max-w-[120px]">{displayName}</div>
            <div className="text-[10px] text-content-muted capitalize truncate max-w-[120px]">{displayRole}</div>
          </div>
        </Link>
      )}
    </header>
  );
}
