'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { issuesApi } from '@/lib/api';
import { Issue, IssueStatus, Severity } from '@/types';
import {
  Search, Filter, MapPin, ThumbsUp, MessageSquare,
  Clock, LayoutGrid, List, ChevronDown, AlertTriangle,
  Users, X, Loader2, Plus, SlidersHorizontal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ── Config ─────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  reported: { label: 'Reported', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', dot: '#9CA3AF' },
  acknowledged: { label: 'Acknowledged', color: '#61C0FF', bg: 'rgba(97,192,255,0.1)', dot: '#61C0FF' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', dot: '#F59E0B' },
  resolved: { label: 'Resolved', color: '#10B981', bg: 'rgba(16,185,129,0.1)', dot: '#10B981' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', dot: '#EF4444' },
  unresolved: { label: 'Unresolved', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)', dot: '#38BDF8' },
  pending_verification: { label: 'Pending Verification', color: '#A855F7', bg: 'rgba(168,85,247,0.1)', dot: '#A855F7' },
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string }> = {
  low: { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  high: { color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

const STATUS_FILTERS: string[] = ['all', 'unresolved', 'reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected'];
const CATEGORY_FILTERS = ['All', 'Roads', 'Water', 'Traffic', 'Garbage', 'Electricity', 'Parks', 'Vandalism', 'Other'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Most Recent' },
  { value: 'upvotes', label: 'Most Upvoted' },
  { value: 'comments', label: 'Most Commented' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
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

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{ color: cfg.color, background: cfg.bg }}>
      {severity}
    </span>
  );
}

function IssueCardGrid({ issue, idx }: { issue: Issue; idx: number }) {
  return (
    <Link href={`/issues/${issue.id}`}>
      <article
        className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200 flex flex-col h-full"
        style={{
          background: '#0B0F14', border: '1px solid rgba(255,255,255,0.05)',
          animation: `fadeUp 0.35s ease-out ${idx * 50}ms both`,
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(97,192,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
      >
        {/* Image */}
        {issue.media?.[0]?.url && (
          <div className="relative h-44 overflow-hidden bg-[#0E131A]">
            <img src={issue.media[0].url} alt={issue.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100" />
            <div className="absolute top-3 right-3"><StatusBadge status={issue.status} /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          {/* Category + severity */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">{issue.category_icon || '📋'}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">{issue.category_name || 'Issue'}</span>
            <span className="ml-auto"><SeverityBadge severity={issue.severity} /></span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-white text-[15px] leading-snug mb-2 line-clamp-2 group-hover:text-[#61C0FF] transition-colors">
            {issue.title}
          </h3>

          {/* Description */}
          <p className="text-[#6B7280] text-xs leading-relaxed line-clamp-2 mb-3 flex-1">{issue.description}</p>

          {/* Location */}
          {issue.address && (
            <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-4">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{issue.address}</span>
            </div>
          )}

          {!issue.media?.[0]?.url && (
            <div className="mb-3"><StatusBadge status={issue.status} /></div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-3 text-[#6B7280] text-xs">
              <span className="flex items-center gap-1 hover:text-[#61C0FF] transition-colors"><ThumbsUp size={11} />{issue.upvote_count}</span>
              <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count}</span>
              <span className="flex items-center gap-1"><Users size={11} />{issue.follow_count}</span>
            </div>
            <span className="flex items-center gap-1 text-[#6B7280] text-[11px]">
              <Clock size={10} />{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
            </span>
          </div>
          {!issue.is_anonymous && issue.reporter_name && (
            <p className="text-[11px] text-[#6B7280]/60 mt-2">by <span className="text-[#6B7280]">{issue.reporter_name}</span></p>
          )}
        </div>
      </article>
    </Link>
  );
}

function IssueRow({ issue, idx }: { issue: Issue; idx: number }) {
  return (
    <Link href={`/issues/${issue.id}`}>
      <article
        className="flex items-center gap-4 p-4 rounded-xl cursor-pointer group transition-all"
        style={{
          background: '#0B0F14', border: '1px solid rgba(255,255,255,0.05)',
          animation: `fadeUp 0.3s ease-out ${idx * 40}ms both`,
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(97,192,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
      >
        {issue.media?.[0]?.url && (
          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#0E131A]">
            <img src={issue.media[0].url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{issue.category_icon || '📋'}</span>
            <span className="text-[11px] text-[#6B7280] uppercase tracking-wider font-medium">{issue.category_name}</span>
          </div>
          <h3 className="font-semibold text-white text-sm group-hover:text-[#61C0FF] transition-colors truncate">{issue.title}</h3>
          {issue.address && (
            <p className="text-[#6B7280] text-xs flex items-center gap-1 mt-0.5">
              <MapPin size={10} /><span className="truncate">{issue.address}</span>
            </p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
        </div>
        <div className="hidden lg:flex items-center gap-4 text-[#6B7280] text-xs flex-shrink-0">
          <span className="flex items-center gap-1"><ThumbsUp size={11} />{issue.upvote_count}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
        </div>
      </article>
    </Link>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params: Record<string, string> = { sort };
      if (search) params.search = search;
      if (activeStatus !== 'all') params.status = activeStatus;
      if (activeCategory !== 'All') params.category = activeCategory.toLowerCase();

      const res = await issuesApi.list(params);
      const raw: Issue[] = (res.data.issues || []).map((i: Record<string, unknown>) => ({
        ...i,
        address: (i.address as string) || (i.latitude ? `${(i.latitude as number).toFixed(4)}, ${(i.longitude as number).toFixed(4)}` : ''),
        reporter_name: (i.reporter_name as string) || (i.is_anonymous ? undefined : 'Anonymous'),
        media: (i.media as Issue['media']) || [],
      } as Issue));
      setIssues(raw);
      setTotal(res.data.total || raw.length);
    } catch {
      setError('Failed to load issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, sort, activeStatus, activeCategory]);

  useEffect(() => {
    const timer = setTimeout(fetchIssues, 300);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  const hasFilters = activeStatus !== 'all' || activeCategory !== 'All' || !!search;

  const clearFilters = () => {
    setActiveStatus('all'); setActiveCategory('All'); setSearch('');
  };

  return (
    <AppLayout
      title="Explore Map"
      sub="Browse and track civic issues reported by your community"
      headerActions={
        <Link href="/report"
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#00aaef,#61C0FF)', color: '#05070A', boxShadow: '0 4px 16px rgba(0,170,239,0.2)' }}>
          <Plus size={15} /> Report Issue
        </Link>
      }
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Search + Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input type="text" placeholder="Search issues by title, description…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-xl text-sm text-white placeholder-[#4B5563] outline-none"
            style={{ background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)' }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Sort */}
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl text-sm text-white appearance-none outline-none cursor-pointer min-w-[150px]"
            style={{ background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
        </div>
        {/* Shortcut Filter: Unresolved Only */}
        <button
          onClick={() => setActiveStatus(prev => prev === 'unresolved' ? 'all' : 'unresolved')}
          className="h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-semibold transition-all duration-250 active:scale-[0.97]"
          style={{
            background: activeStatus === 'unresolved' ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
            border: activeStatus === 'unresolved' ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.06)',
            color: activeStatus === 'unresolved' ? '#38BDF8' : '#9CA3AF',
            boxShadow: activeStatus === 'unresolved' ? '0 0 15px rgba(56,189,248,0.15)' : 'none',
          }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${activeStatus === 'unresolved' ? 'bg-[#38BDF8] animate-pulse' : 'bg-[#9CA3AF]/40'}`} />
          Unresolved Only
        </button>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(v => !v)}
          className="h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: showFilters ? 'rgba(97,192,255,0.1)' : 'rgba(255,255,255,0.03)',
            border: showFilters ? '1px solid rgba(97,192,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: showFilters ? '#61C0FF' : '#9CA3AF',
          }}>
          <SlidersHorizontal size={14} /> Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-[#61C0FF]" />}
        </button>
        {/* View toggle */}
        <div className="flex gap-1 h-10 p-1 rounded-xl" style={{ background: '#0B0F14', border: '1px solid rgba(255,255,255,0.05)' }}>
          {([['grid', LayoutGrid], ['list', List]] as const).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className="px-3 rounded-lg transition-all"
              style={{ background: viewMode === mode ? 'rgba(97,192,255,0.1)' : 'transparent', color: viewMode === mode ? '#61C0FF' : '#6B7280' }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl p-4 mb-4 space-y-4" style={{ background: '#0B0F14', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Status */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#6B7280] mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(s => {
                const cfg = s !== 'all' ? STATUS_CONFIG[s as IssueStatus] : null;
                const isActive = activeStatus === s;
                return (
                  <button key={s} onClick={() => setActiveStatus(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isActive ? (cfg?.bg || 'rgba(97,192,255,0.1)') : 'rgba(255,255,255,0.03)',
                      border: isActive ? `1px solid ${cfg?.dot || '#61C0FF'}` : '1px solid rgba(255,255,255,0.06)',
                      color: isActive ? (cfg?.color || '#61C0FF') : '#6B7280',
                    }}>
                    {cfg && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />}
                    {s === 'all' ? 'All' : cfg?.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Category */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#6B7280] mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: activeCategory === c ? 'rgba(97,192,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: activeCategory === c ? '1px solid rgba(97,192,255,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    color: activeCategory === c ? '#61C0FF' : '#6B7280',
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results bar */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-[#6B7280] text-sm">
          {loading ? 'Loading…' : <><span className="text-white font-semibold">{issues.length}</span> of {total} issues</>}
        </p>
        {hasFilters && !loading && (
          <button onClick={clearFilters} className="text-xs text-[#61C0FF] flex items-center gap-1 hover:underline">
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {/* Issues */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={36} className="animate-spin text-[#61C0FF]" />
          <p className="text-[#6B7280] text-sm">Loading community issues…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertTriangle size={32} className="text-red-400" />
          <div className="text-center">
            <p className="text-white font-semibold">Failed to load</p>
            <p className="text-[#6B7280] text-sm mt-1">{error}</p>
          </div>
          <button onClick={fetchIssues}
            className="px-4 py-2 rounded-xl text-sm text-[#61C0FF]"
            style={{ background: 'rgba(97,192,255,0.08)', border: '1px solid rgba(97,192,255,0.2)' }}>
            Try Again
          </button>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Search size={36} className="text-[#6B7280] opacity-40" />
          <div className="text-center">
            <p className="text-white font-semibold">No issues found</p>
            <p className="text-[#6B7280] text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-sm text-[#61C0FF] flex items-center gap-1 hover:underline">
              <X size={12} /> Clear all filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {issues.map((issue, i) => <IssueCardGrid key={issue.id} issue={issue} idx={i} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, i) => <IssueRow key={issue.id} issue={issue} idx={i} />)}
        </div>
      )}
    </AppLayout>
  );
}
