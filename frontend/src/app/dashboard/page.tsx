'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/StatCard';
import { IssueCard } from '@/components/ui/IssueCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Issue, IssueStatus } from '@/types';
import { LayoutDashboard, AlertTriangle, CheckCircle, Clock, ThumbsUp, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  recentIssues: Issue[];
  statusBreakdown: Record<IssueStatus | string, string>;
  stats: { totalVotes: number; totalComments: number; unreadNotifications: number };
}

const statusOrder: IssueStatus[] = ['reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.dashboard()
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-accent-primary/30 border-t-accent-primary animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-accent-primary/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-32 rounded-full bg-base-850 animate-pulse"></div>
          <div className="h-3 w-48 rounded-full bg-base-850/60 animate-pulse" style={{ animationDelay: '150ms' }}></div>
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="relative">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -left-20 w-72 h-72 bg-accent-secondary/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-state-success opacity-75 animate-ping"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-state-success"></span>
                </span>
                <span className="text-content-muted text-xs uppercase tracking-widest font-semibold">Live Overview</span>
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-content-primary tracking-tight leading-tight">Dashboard</h1>
                <p className="text-content-secondary mt-1.5 text-base">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
              </div>
            </div>
            <Link
              href="/report"
              className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 bg-accent-primary hover:bg-accent-primary_hover text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 hover:-translate-y-0.5"
            >
              <Plus size={18} strokeWidth={2.5} className="transition-transform duration-200 group-hover:rotate-90" />
              New Report
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
            <div className="transform transition-all duration-200 hover:-translate-y-0.5">
              <StatCard
                label="Total Reported"
                value={Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + parseInt(b || '0'), 0)}
                icon={<LayoutDashboard size={18} />}
                accent="blue"
              />
            </div>
            <div className="transform transition-all duration-200 hover:-translate-y-0.5">
              <StatCard
                label="Resolved Issues"
                value={data?.statusBreakdown?.resolved || 0}
                icon={<CheckCircle size={18} />}
                accent="green"
              />
            </div>
            <div className="transform transition-all duration-200 hover:-translate-y-0.5">
              <StatCard
                label="Community Votes"
                value={data?.stats.totalVotes || 0}
                icon={<ThumbsUp size={18} />}
                accent="amber"
              />
            </div>
            <div className="transform transition-all duration-200 hover:-translate-y-0.5">
              <StatCard
                label="Comments Made"
                value={data?.stats.totalComments || 0}
                icon={<MessageSquare size={18} />}
                accent="red"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-content-primary">Recent Reports</h2>
                  <p className="text-content-muted text-sm mt-0.5">Your latest reported issues</p>
                </div>
                <Link
                  href="/my-reports"
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent-secondary hover:text-accent-secondary_hover transition-colors"
                >
                  View all
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </Link>
              </div>

              {data?.recentIssues?.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-subtle bg-gradient-to-br from-base-900/50 to-base-850/50 p-14 text-center flex flex-col items-center justify-center">
                  <div className="absolute -top-6 -right-6 w-32 h-32 bg-accent-primary/5 rounded-full blur-2xl"></div>
                  <div className="w-20 h-20 rounded-2xl bg-base-800 flex items-center justify-center mb-5 ring-1 ring-border-subtle shadow-inner">
                    <AlertTriangle size={28} className="text-content-muted" />
                  </div>
                  <h3 className="text-xl font-semibold text-content-primary mb-2">No reports yet</h3>
                  <p className="text-content-muted max-w-xs mb-7 leading-relaxed">
                    You haven&apos;t reported any issues. Start by sharing your first observation with the community.
                  </p>
                  <Link
                    href="/report"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-base-800 hover:bg-base-700 text-content-primary font-medium rounded-xl border border-border-subtle transition-all duration-200 hover:border-accent-primary/30"
                  >
                    <Plus size={16} strokeWidth={2} />
                    Create a Report
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5 items-stretch">
                  {data?.recentIssues?.map((issue, idx) => (
                    <div key={issue.id} className="transform transition-all duration-200 hover:-translate-y-0.5">
                      <IssueCard issue={issue} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-6 rounded-2xl bg-gradient-to-b from-base-900 to-base-950 border border-border-subtle p-6 shadow-xl shadow-border-subtle/30">
                <div className="flex items-center gap-3 mb-7 pb-4 border-b border-border-subtle/50">
                  <div className="w-9 h-9 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                    <Clock size={17} className="text-accent-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-content-primary">Activity Status</h2>
                    <p className="text-xs text-content-muted">Issue lifecycle breakdown</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {statusOrder.map((s) => {
                    const count = parseInt(data?.statusBreakdown?.[s] || '0');
                    const total = Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + parseInt(b || '0'), 0);
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                    return (
                      <div
                        key={s}
                        className="group rounded-xl px-3.5 py-3 hover:bg-base-850/80 transition-all duration-200 border border-transparent hover:border-border-subtle/40 cursor-default"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <StatusBadge status={s} size="sm" showDot={true} />
                          <div className="flex items-center gap-2">
                            <span className="text-content-primary font-bold text-sm tabular-nums">{count}</span>
                            <span className="text-content-muted text-xs tabular-nums w-9 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-base-850 rounded-full h-1.5 overflow-hidden ring-1 ring-border-subtle">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-700 ease-out"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
