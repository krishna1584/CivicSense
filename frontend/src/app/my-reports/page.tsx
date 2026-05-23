'use client';
import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usersApi } from '@/lib/api';
import { Issue, IssueStatus } from '@/types';
import {
  FileText, Loader2, AlertTriangle, RefreshCw, Plus, Search,
  MapPin, ThumbsUp, MessageSquare, Clock, X, ChevronDown,
  TrendingUp, CheckCircle2, LayoutGrid, List
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

// ── Status config ──────────────────────────────────────────────────────────────
type DisplayStatus = 'All' | IssueStatus;

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bg: string; dot: string }> = {
  reported:     { label: 'Reported',     color: '#A1A1AA', bg: 'rgba(161,161,170,0.08)', dot: '#A1A1AA' },
  acknowledged: { label: 'Acknowledged', color: '#3B82F6', bg: 'rgb(59 130 246 / 0.08)',  dot: '#3B82F6' },
  in_progress:  { label: 'In Progress',  color: '#F59E0B', bg: 'rgb(245 158 11 / 0.08)',  dot: '#F59E0B' },
  resolved:     { label: 'Resolved',     color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  dot: '#4ADE80' },
  rejected:     { label: 'Rejected',     color: '#FB7185', bg: 'rgba(251,113,133,0.08)', dot: '#FB7185' },
  pending_verification: { label: 'Pending Verification', color: '#6366F1', bg: 'rgb(99 102 241 / 0.08)', dot: '#6366F1' },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  low:      { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)' },
  medium:   { color: '#F59E0B', bg: 'rgb(245 158 11 / 0.08)' },
  high:     { color: '#FB7185', bg: 'rgba(251,113,133,0.08)' },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
};

function StatusBadge({ status }: { status: IssueStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.reported;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: cfg.color, background: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
      style={{ color: cfg.color, background: cfg.bg }}>
      {severity}
    </span>
  );
}

// ── Issue Card (Grid) ──────────────────────────────────────────────────────────
function IssueCardGrid({ issue }: { issue: Issue }) {
  const statusCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.reported;
  return (
    <Link href={`/issues/${issue.id}`}>
      <article className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300"
        style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgb(59 130 246 / 0.25)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgb(var(--border-subtle))')}
      >
        {/* Top accent */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${statusCfg.dot}, transparent)` }} />

        <div className="p-5">
          {/* Category + Severity */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">{issue.category_icon || '📋'}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-content-secondary">{issue.category_name || 'Issue'}</span>
            </div>
            <SeverityBadge severity={issue.severity} />
          </div>

          {/* Title */}
          <h3 className="font-semibold text-content-primary text-[15px] leading-snug mb-2 line-clamp-2 group-hover:text-accent-primary transition-colors duration-200">
            {issue.title}
          </h3>

          {/* Description */}
          <p className="text-content-secondary text-xs leading-relaxed line-clamp-2 mb-3">{issue.description}</p>

          {/* Location */}
          {issue.address && (
            <div className="flex items-center gap-1.5 text-content-secondary text-xs mb-4">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{issue.address}</span>
            </div>
          )}

          {/* Status + footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
            <StatusBadge status={issue.status} />
            <div className="flex items-center gap-3 text-content-secondary text-xs">
              <span className="flex items-center gap-1"><ThumbsUp size={11} />{issue.upvote_count}</span>
              <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-content-secondary text-[11px] mt-2">
            <Clock size={10} />
            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ── Issue Row (List) ───────────────────────────────────────────────────────────
function IssueRow({ issue }: { issue: Issue }) {
  return (
    <Link href={`/issues/${issue.id}`}>
      <article className="flex items-center gap-4 p-4 rounded-xl cursor-pointer group transition-all duration-200"
        style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgb(59 130 246 / 0.25)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgb(var(--border-subtle))')}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{ background: 'rgb(var(--base-850))', border: '1px solid rgb(var(--border-subtle))' }}>
          {issue.category_icon || '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-content-primary text-sm group-hover:text-accent-primary transition-colors duration-200 truncate">{issue.title}</h3>
          {issue.address && (
            <p className="text-content-secondary text-xs flex items-center gap-1 mt-0.5">
              <MapPin size={10} /><span className="truncate">{issue.address}</span>
            </p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
        </div>
        <div className="hidden lg:flex items-center gap-3 text-content-secondary text-xs flex-shrink-0">
          <span className="flex items-center gap-1"><ThumbsUp size={11} />{issue.upvote_count}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
        </div>
      </article>
    </Link>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-3.5 rounded-xl relative overflow-hidden transition-all duration-200"
      style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="absolute -top-6 -right-6 w-12 h-12 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
      <span className="text-xl font-black relative" style={{ color }}>{value}</span>
      <span className="text-[10px] text-content-secondary uppercase tracking-wider mt-0.5 relative">{label}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
const STATUS_FILTERS: DisplayStatus[] = ['All', 'reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected'];

export default function MyReportsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<DisplayStatus>('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'upvotes' | 'oldest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchIssues = () => {
    setLoading(true); setError(null);
    usersApi.myIssues({ limit: 100 })
      .then(res => { setIssues(res.data.issues ?? []); setTotal(res.data.total ?? 0); })
      .catch(err => setError(err?.response?.data?.error || 'Failed to load your reports.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchIssues(); }, []);

  const filtered = useMemo(() => {
    let result = [...issues];
    if (activeStatus !== 'All') result = result.filter(i => i.status === activeStatus);
    if (search.trim()) result = result.filter(i =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === 'oldest') result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === 'upvotes') result.sort((a, b) => b.upvote_count - a.upvote_count);
    return result;
  }, [issues, activeStatus, search, sort]);

  // Stats
  const stats = useMemo(() => ({
    total: issues.length,
    resolved: issues.filter(i => i.status === 'resolved').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    pending: issues.filter(i => i.status === 'reported' || i.status === 'acknowledged').length,
  }), [issues]);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <FileText size={22} className="text-accent-primary" /> My Reports
          </h1>
          <p className="text-content-secondary text-sm mt-1">{total} issue{total !== 1 ? 's' : ''} submitted</p>
        </div>
        <Link href="/report"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#FFFFFF', boxShadow: '0 4px 20px rgb(99 102 241 / 0.25)' }}>
          <Plus size={16} /> New Report
        </Link>
      </div>

      {/* Stats */}
      {!loading && issues.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatPill label="Total" value={stats.total} color="#3B82F6" />
          <StatPill label="Resolved" value={stats.resolved} color="#4ADE80" />
          <StatPill label="In Progress" value={stats.inProgress} color="#F59E0B" />
          <StatPill label="Pending" value={stats.pending} color="#94A3B8" />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-secondary" />
          <input type="text" placeholder="Search your reports…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-xl text-sm text-content-primary placeholder-content-muted outline-none transition-all duration-200"
            style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary hover:text-content-primary transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Sort */}
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
            className="h-10 pl-3 pr-8 rounded-xl text-sm text-content-primary appearance-none outline-none cursor-pointer min-w-[140px] transition-all duration-200"
            style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}>
            <option value="newest">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="upvotes">Most Upvoted</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary pointer-events-none" />
        </div>
        {/* View toggle */}
        <div className="flex gap-1 h-10 p-1 rounded-xl" style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}>
          {([['grid', LayoutGrid], ['list', List]] as const).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className="px-3 rounded-lg transition-all duration-200"
              style={{ background: viewMode === mode ? 'rgb(59 130 246 / 0.1)' : 'transparent', color: viewMode === mode ? 'rgb(var(--accent-primary))' : 'rgb(var(--content-secondary))' }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_FILTERS.map(s => {
          const count = s === 'All' ? issues.length : issues.filter(i => i.status === s).length;
          const cfg = s !== 'All' ? STATUS_CONFIG[s as IssueStatus] : null;
          const isActive = activeStatus === s;
          return (
            <button key={s} onClick={() => setActiveStatus(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: isActive ? (cfg?.bg || 'rgb(var(--accent-primary) / 0.1)') : 'rgb(var(--base-850))',
                border: isActive ? `1px solid ${cfg?.dot || 'rgb(59 130 246 / 0.4)'}` : '1px solid rgb(var(--border-subtle))',
                color: isActive ? (cfg?.color || '#3B82F6') : 'rgb(var(--content-secondary))',
              }}>
              {cfg && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />}
              {s === 'All' ? 'All' : cfg?.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 size={32} className="animate-spin text-accent-primary" />
          <p className="text-content-secondary text-sm">Loading your reports…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-2xl"
          style={{ background: 'rgba(251,113,133,0.05)', border: '1px solid rgba(251,113,133,0.15)' }}>
          <AlertTriangle size={32} className="text-state-error" />
          <div className="text-center">
            <p className="text-content-primary font-semibold">Failed to load</p>
            <p className="text-content-secondary text-sm mt-1">{error}</p>
          </div>
          <button onClick={fetchIssues}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-accent-primary transition-all duration-200"
            style={{ background: 'rgb(59 130 246 / 0.08)', border: '1px solid rgb(59 130 246 / 0.2)' }}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-2xl"
          style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgb(59 130 246 / 0.08)' }}>
            <FileText size={28} className="text-accent-primary" />
          </div>
          <div className="text-center">
            <p className="text-content-primary font-semibold">No reports yet</p>
            <p className="text-content-secondary text-sm mt-1">Be the first to report a civic issue in your community.</p>
          </div>
          <Link href="/report"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#FFFFFF', boxShadow: '0 4px 20px rgb(99 102 241 / 0.25)' }}>
            <Plus size={15} /> Report Your First Issue
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-2xl"
          style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}>
          <Search size={28} className="text-content-secondary" />
          <div className="text-center">
            <p className="text-content-primary font-semibold text-sm">No matches found</p>
            <p className="text-content-secondary text-xs mt-1">Try adjusting your filters or search terms.</p>
          </div>
          <button onClick={() => { setSearch(''); setActiveStatus('All'); }}
            className="text-xs text-accent-primary flex items-center gap-1 hover:underline">
            <X size={11} /> Clear filters
          </button>
        </div>
      ) : (
        <>
          <p className="text-content-secondary text-xs mb-4">Showing <span className="text-content-primary font-semibold">{filtered.length}</span> of {issues.length} reports</p>
          {viewMode === 'grid' ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(issue => <IssueCardGrid key={issue.id} issue={issue} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(issue => <IssueRow key={issue.id} issue={issue} />)}
            </div>
          )}
        </>
      )}

      {/* Resolution CTA */}
      {!loading && stats.resolved > 0 && (
        <div className="mt-8 p-5 rounded-2xl flex items-center gap-4 transition-all"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <CheckCircle2 size={24} className="text-state-success flex-shrink-0" />
          <div>
            <p className="text-content-primary font-semibold text-sm">
              {stats.resolved} of your report{stats.resolved !== 1 ? 's' : ''} resolved!
            </p>
            <p className="text-content-secondary text-xs mt-0.5">Great work making your community better. Keep it up.</p>
          </div>
          <TrendingUp size={20} className="text-state-success ml-auto flex-shrink-0" />
        </div>
      )}
    </AppLayout>
  );
}
