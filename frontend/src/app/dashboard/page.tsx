'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/StatCard';
import { IssueCard } from '@/components/ui/IssueCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Issue, IssueStatus } from '@/types';
import { LayoutDashboard, AlertTriangle, CheckCircle, Clock, ThumbsUp, MessageSquare, Zap } from 'lucide-react';
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
      <div className="flex items-center justify-center h-64">
        <div className="text-[#00FF94] animate-pulse">Loading dashboard...</div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gradient">City Overview</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94] animate-pulse" />
            <span className="text-[#9CA3AF] text-sm">Live Updates Enabled</span>
          </div>
        </div>
        <Link href="/report" className="btn-primary flex items-center gap-2">
          <Zap size={16} />
          Report Issue
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Reported"
          value={Object.values(data?.statusBreakdown || {}).reduce((a, b) => a + parseInt(b || '0'), 0)}
          icon={<LayoutDashboard size={18} />}
          accent="green"
        />
        <StatCard
          label="Resolved"
          value={data?.statusBreakdown?.resolved || 0}
          icon={<CheckCircle size={18} />}
          accent="green"
        />
        <StatCard
          label="Community Votes"
          value={data?.stats.totalVotes || 0}
          icon={<ThumbsUp size={18} />}
          accent="blue"
        />
        <StatCard
          label="Comments Made"
          value={data?.stats.totalComments || 0}
          icon={<MessageSquare size={18} />}
          accent="amber"
        />
      </div>

      {/* Status Breakdown */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Clock size={16} className="text-[#00FF94]" />
          My Issues by Status
        </h2>
        <div className="flex flex-wrap gap-3">
          {statusOrder.map((s) => (
            <div key={s} className="flex items-center gap-2 bg-[#11161D] rounded-xl px-4 py-2">
              <StatusBadge status={s} size="sm" />
              <span className="text-white font-semibold">{data?.statusBreakdown?.[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Issues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#00FF94]" />
            Recent Reports
          </h2>
          <Link href="/my-reports" className="text-[#00FF94] text-sm hover:underline">View all →</Link>
        </div>
        {data?.recentIssues?.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-[#9CA3AF]">No issues reported yet.</p>
            <Link href="/report" className="btn-primary inline-flex mt-4">Report Your First Issue</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.recentIssues?.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
