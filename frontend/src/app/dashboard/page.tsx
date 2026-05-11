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

const statusOrder: IssueStatus[] = ['reported', 'acknowledged', 'in_progress', 'resolved', 'rejected'];

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
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-content-muted font-medium animate-pulse">Loading workspace...</div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-state-success relative">
              <span className="absolute inset-0 rounded-full bg-state-success animate-ping opacity-50"></span>
            </span>
            <span className="text-content-muted text-sm font-medium">Live Overview</span>
          </div>
          <h1 className="text-4xl font-bold text-content-primary tracking-tight">Dashboard</h1>
        </div>
        <Link href="/report" className="btn-accent flex items-center gap-2">
          <Plus size={18} strokeWidth={2.5} />
          New Report
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard
          label="Total Reported"
          value={Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + parseInt(b || '0'), 0)}
          icon={<LayoutDashboard size={18} />}
          accent="blue"
        />
        <StatCard
          label="Resolved Issues"
          value={data?.statusBreakdown?.resolved || 0}
          icon={<CheckCircle size={18} />}
          accent="green"
        />
        <StatCard
          label="Community Votes"
          value={data?.stats.totalVotes || 0}
          icon={<ThumbsUp size={18} />}
          accent="amber"
        />
        <StatCard
          label="Comments Made"
          value={data?.stats.totalComments || 0}
          icon={<MessageSquare size={18} />}
          accent="red"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Recent Issues */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-content-primary flex items-center gap-2">
              Recent Reports
            </h2>
            <Link href="/my-reports" className="text-accent-secondary text-sm font-medium hover:text-accent-secondary_hover transition-colors">
              View all →
            </Link>
          </div>
          
          {data?.recentIssues?.length === 0 ? (
            <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed border-border-subtle bg-base-850">
              <div className="w-16 h-16 bg-base-800 rounded-full flex items-center justify-center mb-4 text-content-muted">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-semibold text-content-primary mb-2">No reports found</h3>
              <p className="text-content-muted max-w-sm mb-6">You haven't reported any issues yet. Start by reporting your first observation.</p>
              <Link href="/report" className="btn-secondary">Create a Report</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5 items-stretch">
              {data?.recentIssues?.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>

        <div>
          {/* Status Breakdown Sidebar */}
          <div className="card p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-content-primary mb-6 flex items-center gap-2">
              <Clock size={18} className="text-content-muted" />
              Activity Status
            </h2>
            <div className="space-y-3">
              {statusOrder.map((s) => {
                const count = parseInt(data?.statusBreakdown?.[s] || '0');
                const total = Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + parseInt(b || '0'), 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                
                return (
                  <div key={s} className="group p-3 rounded-xl hover:bg-base-850 transition-colors border border-transparent hover:border-border-subtle cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={s} size="sm" showDot={true} />
                      <span className="text-content-primary font-bold">{count}</span>
                    </div>
                    <div className="w-full bg-base-900 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-accent-primary h-1.5 rounded-full transition-all duration-500 ease-out" 
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
    </AppLayout>
  );
}
