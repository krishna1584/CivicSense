'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Issue } from '@/types';
import { User, Shield, Star, FileText, ThumbsUp, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalVotes: 0, totalComments: 0 });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      usersApi.myIssues({ limit: 20 }),
      usersApi.dashboard(),
    ]).then(([issuesRes, dashRes]) => {
      setIssues(issuesRes.data.issues);
      setStats({
        totalVotes: dashRes.data.stats.totalVotes,
        totalComments: dashRes.data.stats.totalComments,
      });
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#9CA3AF]">Please <Link href="/login" className="text-[#00FF94] hover:underline">sign in</Link> to view your profile.</p>
      </div>
    </AppLayout>
  );

  const ROLE_LABEL: Record<string, string> = { citizen: 'Citizen', admin: 'Administrator', department_staff: 'Department Staff' };

  return (
    <AppLayout>
      {/* Profile Header */}
      <div className="card p-8 mb-6 flex items-start gap-6">
        <div className="w-20 h-20 rounded-2xl bg-[#00FF94]/20 flex items-center justify-center text-[#00FF94] text-3xl font-black flex-shrink-0">
          {user.name[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
            <span className="label-micro text-[#9CA3AF] bg-white/5 border border-white/10 px-3 py-1 rounded-lg">
              {ROLE_LABEL[user.role] || user.role}
            </span>
          </div>
          <p className="text-[#9CA3AF] mb-4">{user.email}</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-[#F59E0B]" />
              <span className="text-white font-semibold">{user.trust_score}</span>
              <span className="text-[#9CA3AF] text-sm">Trust Score</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#3B82F6]" />
              <span className="text-white font-semibold">{issues.length}</span>
              <span className="text-[#9CA3AF] text-sm">Issues Reported</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsUp size={16} className="text-[#00FF94]" />
              <span className="text-white font-semibold">{stats.totalVotes}</span>
              <span className="text-[#9CA3AF] text-sm">Votes Cast</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#9CA3AF]" />
              <span className="text-white font-semibold">{stats.totalComments}</span>
              <span className="text-[#9CA3AF] text-sm">Comments</span>
            </div>
          </div>
        </div>
        {user.role === 'admin' && (
          <Link href="/admin" className="btn-outline flex items-center gap-2 text-sm">
            <Shield size={14} /> Admin Panel
          </Link>
        )}
      </div>

      {/* Recent Issues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FileText size={16} className="text-[#00FF94]" /> Recent Reports
          </h2>
          <Link href="/my-reports" className="text-[#00FF94] text-sm hover:underline">View all →</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-[#00FF94] animate-spin" />
          </div>
        ) : issues.length === 0 ? (
          <div className="card p-8 text-center text-[#9CA3AF]">
            No issues reported yet.{' '}
            <Link href="/report" className="text-[#00FF94] hover:underline">Report one now</Link>.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-[#11161D]">
                  <th className="py-3 px-4 text-left label-micro">Issue</th>
                  <th className="py-3 px-4 text-left label-micro">Status</th>
                  <th className="py-3 px-4 text-left label-micro">Severity</th>
                  <th className="py-3 px-4 text-left label-micro">Upvotes</th>
                  <th className="py-3 px-4 text-left label-micro">Reported</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/issues/${issue.id}`} className="text-white hover:text-[#00FF94] transition-colors truncate max-w-xs block">
                        {issue.category_icon && <span className="mr-1">{issue.category_icon}</span>}
                        {issue.title}
                      </Link>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={issue.status} size="sm" /></td>
                    <td className="py-3 px-4"><SeverityBadge severity={issue.severity} /></td>
                    <td className="py-3 px-4 text-[#00FF94] font-semibold">{issue.upvote_count}</td>
                    <td className="py-3 px-4 text-[#9CA3AF] text-xs">
                      {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
