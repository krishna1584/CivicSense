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
      .then(res => setPublicSettings(res.data))
      .catch(() => {});
  }, []);

  const alertCfg = {
    info: { bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/25', text: 'text-accent-secondary', icon: Info },
    warning: { bg: 'bg-state-warning/10', border: 'border-state-warning/25', text: 'text-state-warning', icon: AlertTriangle },
    critical: { bg: 'bg-state-error/10', border: 'border-state-error/25', text: 'text-state-error', icon: ShieldAlert },
  };

  const activeAlert = publicSettings?.enableAlertBanner && publicSettings?.alertBannerText;
  const cfg = (activeAlert && publicSettings) ? alertCfg[publicSettings.alertBannerType || 'warning'] : null;
  const AlertIcon = cfg?.icon;

  return (
    <div className="flex h-screen overflow-hidden bg-base-950">
      <Suspense fallback={<aside className="fixed left-0 top-0 h-screen w-64 bg-base-900 border-r border-border-subtle flex flex-col z-50 animate-pulse" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 ml-64 h-screen relative flex flex-col overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[500px] bg-hero-gradient pointer-events-none opacity-40" />

        {cfg && AlertIcon && (
          <div className={`relative z-40 w-full px-6 py-3 border-b ${cfg.bg} ${cfg.border} ${cfg.text} backdrop-blur-md flex items-center gap-3}`}>
            <AlertIcon size={16} className="shrink-0" />
            <span className="text-xs font-semibold leading-relaxed tracking-wide">
              <span className="uppercase font-extrabold mr-1.5">[Notice]</span>
              {publicSettings?.alertBannerText}
            </span>
          </div>
        )}

        <TopBar title={title} sub={sub} actions={headerActions} />

        <div className="flex-1 overflow-y-auto page-container relative z-10 animate-fade_in">
          {children}
        </div>
      </main>
    </div>
  );
}
