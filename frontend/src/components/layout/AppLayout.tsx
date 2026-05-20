'use client';

import { Suspense, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { adminApi } from '@/lib/api';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  sub?: string;
  headerActions?: React.ReactNode;
}

interface PublicSettings {
  systemName: string;
  enableAlertBanner: boolean;
  alertBannerText: string;
  alertBannerType: 'info' | 'warning' | 'critical';
}

export function AppLayout({ children, title, sub, headerActions }: AppLayoutProps) {
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    adminApi.getPublicSettings()
      .then(res => {
        setPublicSettings(res.data);
      })
      .catch(err => {
        console.error('Failed to load public settings:', err);
      });
  }, []);

  const alertCfg = {
    info: {
      bg: 'rgba(97,192,255,0.08)',
      border: 'border-[#61C0FF]/25',
      text: 'text-[#61C0FF]',
      glow: 'shadow-[0_0_15px_rgba(97,192,255,0.15)]',
      icon: Info
    },
    warning: {
      bg: 'rgba(245,158,11,0.08)',
      border: 'border-[#F59E0B]/25',
      text: 'text-[#F59E0B]',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
      icon: AlertTriangle
    },
    critical: {
      bg: 'rgba(239,68,68,0.08)',
      border: 'border-[#EF4444]/25',
      text: 'text-[#EF4444]',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      icon: ShieldAlert
    }
  };

  const activeAlert = publicSettings?.enableAlertBanner && publicSettings?.alertBannerText;
  const cfg = (activeAlert && publicSettings) ? alertCfg[publicSettings.alertBannerType || 'warning'] : null;
  const AlertIcon = cfg?.icon;

  return (
    <div className="flex min-h-screen bg-base-950">
      <Suspense fallback={<aside className="fixed left-0 top-0 h-screen w-64 bg-base-900 border-r border-border-subtle flex flex-col z-50 animate-pulse" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 ml-64 min-h-screen relative overflow-hidden flex flex-col">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-hero-gradient pointer-events-none opacity-50" />
        
        {/* Dynamic Broadcast Alert Banner */}
        {cfg && AlertIcon && (
          <div className={`relative z-40 w-full px-6 py-3 border-b ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.glow} backdrop-blur-md flex items-center gap-3 transition-all duration-300`}>
            <div className="flex-shrink-0 animate-pulse">
              <AlertIcon size={16} />
            </div>
            <div className="flex-1 text-xs font-semibold leading-relaxed tracking-wide">
              <span className="uppercase font-extrabold mr-1.5">[Broadcast Notice]</span>
              {publicSettings?.alertBannerText}
            </div>
          </div>
        )}

        {title && (
          <TopBar title={title} sub={sub} actions={headerActions} />
        )}
        
        {/* Content area */}
        <div className={title ? "flex-1 overflow-y-auto page-container relative z-10 animate-fade_in" : "page-container relative z-10 animate-fade_in"}>
          {children}
        </div>
      </main>
    </div>
  );
}
