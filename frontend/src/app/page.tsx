// Trigger Vercel Build (Cloud Deployment Sync)
'use client';
import Link from 'next/link';
import { ArrowRight, MapPin, TrendingUp, Shield, Zap, BarChart3, Globe, Hexagon } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { authApi, issuesApi } from '@/lib/api';

const features = [
  { icon: MapPin, title: 'Location-Based Reporting', desc: 'Report issues with your GPS coordinates and a clear location description.' },
  { icon: TrendingUp, title: 'Real-Time Tracking', desc: 'Live status updates via WebSocket. Watch your issue move from Reported to Resolved.' },
  { icon: Shield, title: 'Transparent Audit Trail', desc: 'Every status change is recorded on the issue\'s public timeline, from report to verified fix.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'City-level KPIs: resolution rates, workload, and citizen satisfaction by department.' },
  { icon: Globe, title: 'Community Engagement', desc: 'Upvote, follow, and comment. Civic impact measured by real community data.' },
  { icon: Zap, title: 'Admin Command Center', desc: 'Bulk actions, audit logs, and department assignment workflows.' },
];

interface PublicStats { total: number; resolved: number; resolutionRate: number | null; avgResolutionHours: number | null }

const formatHours = (hours: number | null | undefined) => {
  if (hours === null || hours === undefined) return '—';
  return hours < 1 ? '<1h' : hours < 48 ? `${Math.round(hours)}h` : `${(hours / 24).toFixed(1)}d`;
};

export default function LandingPage() {
  const { user, setUser, isLoading } = useAuthStore();
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    issuesApi.publicStats().then(res => setPublicStats(res.data)).catch(() => {});
  }, []);

  // Live figures from the database; a dash means there's no data yet.
  const stats = [
    { label: 'Issues Reported', value: publicStats ? publicStats.total.toLocaleString() : '—' },
    { label: 'Issues Resolved', value: publicStats ? publicStats.resolved.toLocaleString() : '—' },
    { label: 'Resolution Rate', value: publicStats?.resolutionRate != null ? `${publicStats.resolutionRate}%` : '—' },
    { label: 'Avg Time to Fix', value: formatHours(publicStats?.avgResolutionHours) },
  ];

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { }
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-base-950">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center group-hover:bg-accent-primary/25 transition-colors">
              <Hexagon size={16} className="text-accent-primary" />
            </div>
            <span className="hidden min-[360px]:inline font-bold text-lg text-content-primary">Civic<span className="text-accent-secondary">Sense</span></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 [&>a]:whitespace-nowrap [&>button]:whitespace-nowrap">
            <Link href="/explore" className="hidden sm:inline text-content-muted hover:text-content-primary text-sm transition-colors">Explore</Link>
            {isLoading ? (
              <div className="w-24 h-8 rounded-lg bg-base-800 animate-pulse" />
            ) : user ? (
              <>
                <Link href={user.role === 'admin' || user.role === 'department_staff' ? '/admin' : '/dashboard'} className="btn-primary text-sm py-2 px-4">
                  Dashboard
                </Link>
                <button onClick={handleLogout} className="hidden sm:inline-flex btn-secondary text-sm py-2 px-4">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm py-2 px-3 sm:px-4">Sign In</Link>
                <Link href="/register" className="btn-primary text-sm py-2 px-3 sm:px-4">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-100" />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-hero-glow-alt" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent-primary/10 border border-accent-primary/20 rounded-full px-4 py-1.5 mb-8">
            <span className="text-accent-primary text-xs font-medium uppercase tracking-widest">Open civic issue tracker</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black mb-6 leading-[1.05] tracking-tight">
            <span className="text-gradient">Empower Your City.</span>
            <br />
            <span className="text-accent-secondary">In Real Time.</span>
          </h1>

          <p className="text-lg sm:text-xl text-content-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Report public infrastructure issues, track government response, and demand transparency—all in one civic intelligence platform.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {isLoading ? (
              <div className="w-44 h-12 rounded-xl bg-base-800 animate-pulse" />
            ) : user ? (
              <Link href={user.role === 'admin' || user.role === 'department_staff' ? '/admin' : '/dashboard'} className="btn-primary flex items-center gap-2 text-base py-3 px-8">
                Go to Dashboard
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link href="/report" className="btn-primary flex items-center gap-2 text-base py-3 px-8">
                Report an Issue
                <ArrowRight size={18} />
              </Link>
            )}
            <Link href="/explore" className="btn-secondary flex items-center gap-2 text-base py-3 px-8">
              Explore Issues
            </Link>
          </div>

          <p className="mt-6 text-sm text-content-muted">
            <Link href="/report/anonymous" className="text-accent-secondary font-semibold hover:underline">Report anonymously, no account needed</Link>
            <span className="mx-2">·</span>
            <Link href="/track" className="hover:text-content-primary hover:underline">Track an anonymous report</Link>
          </p>
        </div>
      </section>

      <section className="py-10 border-y border-border-subtle bg-base-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-accent-secondary mb-1">{s.value}</div>
              <div className="label-micro">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="label-micro mb-3 text-accent-primary">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Built for Civic Accountability</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card card-hover p-6">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-accent-primary" />
                  </div>
                  <h3 className="font-semibold text-content-primary mb-2">{f.title}</h3>
                  <p className="text-content-secondary text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center card p-6 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-accent-primary/[0.03] rounded-2xl" />
          <div className="relative">
            {isLoading ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="h-10 w-64 bg-base-800 rounded-lg animate-pulse" />
                <div className="h-4 w-full max-w-96 bg-base-800 rounded-lg animate-pulse" />
                <div className="h-12 w-48 bg-base-800 rounded-xl animate-pulse mt-4" />
              </div>
            ) : user ? (
              <>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gradient break-words">Welcome back, {user.name}!</h2>
                <p className="text-content-secondary mb-8">Access your personalized dashboard to track issues and browse notifications.</p>
                <Link href={user.role === 'admin' || user.role === 'department_staff' ? '/admin' : '/dashboard'} className="btn-primary inline-flex items-center gap-2 text-base py-3 px-10">
                  Go to Dashboard
                  <ArrowRight size={18} />
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gradient">Ready to Make Your Voice Count?</h2>
                <p className="text-content-secondary mb-8">Report what you see, follow it to the fix, and confirm when it's done.</p>
                <Link href="/register" className="btn-primary inline-flex items-center gap-2 text-base py-3 px-10">
                  Start Reporting Free
                  <ArrowRight size={18} />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-border-subtle py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-bold text-content-primary">Civic<span className="text-accent-secondary">Sense</span></span>
          <p className="text-content-muted text-sm">© 2026 CivicSense. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
