'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Star, FileText, ThumbsUp, CheckCircle2, Loader2,
  ArrowLeft, Calendar, Award, AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

const formatMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

interface PublicUser {
  id: string;
  name: string;
  avatar_url: string | null;
  trust_score: number;
  role: string;
  created_at: string;
}

interface PublicStats {
  total_issues: string;
  resolved_issues: string;
  total_upvotes_received: string;
}

interface PublicSatisfaction {
  avg_satisfaction: string | null;
  satisfaction_reviews: string;
}

interface PublicIssue {
  id: string;
  title: string;
  status: string;
  severity: string;
  upvote_count: number;
  created_at: string;
  category_name?: string;
  category_icon?: string;
}

const ROLE_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  admin: 'Administrator',
  department_staff: 'Department Staff',
};

const TRUST_TIER = (score: number) => {
  if (score >= 80) return { label: 'Trusted Reporter', color: 'text-state-success', bg: 'bg-state-success/10', icon: '🏆' };
  if (score >= 50) return { label: 'Active Reporter', color: 'text-accent-secondary', bg: 'bg-accent-secondary/10', icon: '⭐' };
  if (score >= 20) return { label: 'Contributor', color: 'text-accent-primary', bg: 'bg-accent-primary/10', icon: '📋' };
  return { label: 'New Member', color: 'text-content-muted', bg: 'bg-base-850', icon: '🌱' };
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params?.id as string;
  const { user: currentUser } = useAuthStore();

  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [satisfaction, setSatisfaction] = useState<PublicSatisfaction | null>(null);
  const [issues, setIssues] = useState<PublicIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If the viewer is the owner, redirect to /profile
  useEffect(() => {
    if (currentUser && currentUser.id === profileId) {
      router.replace('/profile');
    }
  }, [currentUser, profileId, router]);

  useEffect(() => {
    if (!profileId) return;
    // Don't fetch if we're going to redirect
    if (currentUser && currentUser.id === profileId) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileRes, userIssuesRes] = await Promise.all([
          usersApi.profile(profileId),
          usersApi.userIssues(profileId),
        ]);

        setProfileUser(profileRes.data.user);
        setStats(profileRes.data.stats);
        setSatisfaction(profileRes.data.satisfaction || null);
        setIssues(userIssuesRes.data.issues || []);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError('User not found.');
        } else {
          setError('Failed to load profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, currentUser]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-content-muted text-sm animate-pulse">Loading profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !profileUser) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <AlertTriangle size={36} className="text-state-error" />
          <p className="text-content-secondary font-semibold">{error || 'User not found'}</p>
          <Link href="/explore" className="text-accent-secondary hover:underline text-sm">
            Back to Explore
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tier = TRUST_TIER(profileUser.trust_score || 0);
  const initials = profileUser.name
    ? profileUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';
  const avatarUrl = profileUser.avatar_url ? formatMediaUrl(profileUser.avatar_url) : '';
  const totalIssues = parseInt(stats?.total_issues || '0');
  const resolvedIssues = parseInt(stats?.resolved_issues || '0');
  const totalUpvotes = parseInt(stats?.total_upvotes_received || '0');
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
  const avgSatisfaction = satisfaction?.avg_satisfaction ? parseFloat(satisfaction.avg_satisfaction) : null;
  const satisfactionReviews = parseInt(satisfaction?.satisfaction_reviews || '0');

  return (
    <AppLayout>
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-content-muted hover:text-content-primary transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="card p-8 mb-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-accent-primary/8 rounded-full blur-3xl -z-10" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-accent-secondary/8 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-base-950 border-2 border-border-subtle shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profileUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center text-3xl font-extrabold text-accent-primary">
                  {initials}
                </div>
              )}
            </div>
            {/* Trust tier badge */}
            <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.color} ${tier.bg} border border-current/20 whitespace-nowrap shadow-sm`}>
              {tier.icon} {tier.label}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-content-primary mb-1">{profileUser.name}</h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
              <span className="label-micro text-content-secondary bg-base-850 border border-border-subtle px-3 py-1 rounded-lg">
                {ROLE_LABEL[profileUser.role] || profileUser.role}
              </span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-content-muted text-sm mb-5">
              <Calendar size={14} />
              <span>Joined {format(new Date(profileUser.created_at), 'MMMM yyyy')}</span>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 border-t border-border-subtle/40 pt-4">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-state-warning" />
                <span className="text-content-primary font-bold">{profileUser.trust_score}</span>
                <span className="text-content-muted text-sm">Trust Score</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-accent-secondary" />
                <span className="text-content-primary font-bold">{totalIssues}</span>
                <span className="text-content-muted text-sm">Issues</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-state-success" />
                <span className="text-content-primary font-bold">{resolvedIssues}</span>
                <span className="text-content-muted text-sm">Resolved</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp size={16} className="text-accent-primary" />
                <span className="text-content-primary font-bold">{totalUpvotes}</span>
                <span className="text-content-muted text-sm">Upvotes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Issues Reported', value: totalIssues, icon: FileText, color: 'text-accent-secondary', bg: 'bg-accent-secondary/10' },
          { label: 'Issues Resolved', value: resolvedIssues, icon: CheckCircle2, color: 'text-state-success', bg: 'bg-state-success/10' },
          { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: Award, color: 'text-accent-primary', bg: 'bg-accent-primary/10' },
          { label: 'Community Upvotes', value: totalUpvotes, icon: ThumbsUp, color: 'text-state-warning', bg: 'bg-state-warning/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5 text-center hover:border-border-subtle transition-colors">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <div className={`text-2xl font-black mb-1 ${color}`}>{value}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted">{label}</div>
          </div>
        ))}
        {/* Satisfaction card */}
        <div className="card p-5 text-center hover:border-border-subtle transition-colors">
          <div className="w-10 h-10 rounded-xl bg-state-warning/10 flex items-center justify-center mx-auto mb-3">
            <Star size={18} className="text-state-warning fill-state-warning" />
          </div>
          {avgSatisfaction !== null ? (
            <>
              <div className="text-2xl font-black mb-1 text-state-warning">{avgSatisfaction.toFixed(1)}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted">Satisfaction</div>
              <div className="text-[10px] text-content-muted mt-0.5">{satisfactionReviews} review{satisfactionReviews !== 1 ? 's' : ''}</div>
            </>
          ) : (
            <>
              <div className="text-lg font-black mb-1 text-content-muted">—</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted">Satisfaction</div>
              <div className="text-[10px] text-content-muted mt-0.5">No reviews yet</div>
            </>
          )}
        </div>
      </div>

      {/* Resolution rate progress bar */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-content-primary flex items-center gap-2">
            <Award size={16} className="text-accent-primary" />
            Resolution Effectiveness
          </h2>
          <span className="text-sm font-bold text-accent-primary">{resolutionRate}%</span>
        </div>
        <div className="w-full bg-base-900 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-700"
            style={{ width: `${resolutionRate}%` }}
          />
        </div>
        <p className="text-xs text-content-muted mt-2">
          {resolvedIssues} out of {totalIssues} reported issues have been resolved
        </p>
      </div>

      {/* Public Issues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-content-primary flex items-center gap-2">
            <FileText size={16} className="text-accent-secondary" />
            Public Reports
            <span className="text-[11px] font-bold text-content-muted bg-base-850 border border-border-subtle px-2 py-0.5 rounded-md">
              {totalIssues}
            </span>
          </h2>
        </div>

        {issues.length === 0 ? (
          <div className="card p-10 text-center border-dashed">
            <div className="w-14 h-14 rounded-full bg-base-800 border border-border-subtle flex items-center justify-center mx-auto mb-4">
              <FileText size={22} className="text-content-muted" />
            </div>
            <p className="text-content-primary font-semibold mb-1">No public issues</p>
            <p className="text-content-muted text-sm">This user hasn't reported any public issues yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-base-900">
                  <th className="py-3 px-4 text-left label-micro">Issue</th>
                  <th className="py-3 px-4 text-left label-micro">Status</th>
                  <th className="py-3 px-4 text-left label-micro hidden sm:table-cell">Upvotes</th>
                  <th className="py-3 px-4 text-left label-micro hidden md:table-cell">Reported</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-border-subtle/50 hover:bg-base-850 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/issues/${issue.id}`}
                        className="text-content-primary hover:text-accent-secondary transition-colors font-medium truncate max-w-xs block"
                      >
                        {issue.category_icon && <span className="mr-1.5">{issue.category_icon}</span>}
                        {issue.title}
                      </Link>
                      {issue.category_name && (
                        <span className="text-[11px] text-content-muted">{issue.category_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={issue.status as any} size="sm" />
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-accent-primary font-bold flex items-center gap-1.5">
                        <ThumbsUp size={12} />
                        {issue.upvote_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-content-muted text-xs hidden md:table-cell">
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
