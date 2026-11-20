'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import {
  LayoutDashboard, List, BarChart2, Settings, Zap, Bell,
  Moon, Sun, TrendingUp, TrendingDown, AlertTriangle, Clock,
  ThumbsUp, MessageSquare, Search, Filter, ChevronDown,
  Download, Eye, CheckCircle2, XCircle, Loader2, Users,
  Activity, ArrowUpRight, MapPin, ChevronRight, X, ClipboardList, Camera, ExternalLink,
  Inbox, Star
} from 'lucide-react';
import { adminApi, issuesApi, usersApi, commentsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { StatusBadge, STATUS_META } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatCard } from '@/components/ui/StatCard';
import { StarRating } from '@/components/ui/StarRating';
import { toast, apiErrorMessage } from '@/lib/toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Rejected' | 'Pending Verification';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type AdminView = 'dashboard' | 'issues' | 'analytics' | 'users' | 'logs' | 'settings';

interface Issue {
  id: number;
  title: string;
  category: string;
  severity: Severity;
  status: Status;
  department: string;
  upvotes: number;
  comments: number;
  created_at: string;
  image: string;
}

// Mock data removed in favor of dynamic API endpoints

// ─── Chart colours come from the theme so they follow light/dark mode ─────────
const STATUS_CHART_COLOR: Record<string, string> = {
  reported: 'rgb(var(--content-muted))',
  acknowledged: 'rgb(var(--accent-secondary))',
  in_progress: 'rgb(var(--state-warning))',
  pending_verification: 'rgb(var(--accent-primary))',
  resolved: 'rgb(var(--state-success))',
  rejected: 'rgb(var(--state-error))',
};

// ─── Tiny SVG Charts ───────────────────────────────────────────────────────────
function PieChart({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const legend = (
    <div className="space-y-2">
      {slices.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
          <span className="text-content-secondary">{p.label}</span>
          <span className="text-content-primary font-semibold ml-auto pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  );

  const active = slices.filter(s => s.value > 0);
  let cumulative = 0;
  const paths = slices.map(s => {
    const pct = s.value / (total || 1);
    const start = cumulative;
    cumulative += pct;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = cumulative * 2 * Math.PI - Math.PI / 2;
    const r = 80, cx = 100, cy = 100;
    const large = pct > 0.5 ? 1 : 0;
    return { d: `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large},1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`, color: s.color };
  });

  return (
    <div className="flex flex-col min-[400px]:flex-row items-center gap-4 min-[400px]:gap-6">
      <svg viewBox="0 0 200 200" className="w-36 h-36 shrink-0" role="img" aria-label="Issues by status">
        {active.length === 1
          ? <circle cx="100" cy="100" r="80" style={{ fill: active[0].color }} />
          : paths.map((p, i) => <path key={i} d={p.d} style={{ fill: p.color, stroke: 'rgb(var(--base-800))' }} strokeWidth="2" />)}
      </svg>
      {legend}
    </div>
  );
}

function DonutChart({ pct, label }: { pct: number; label: string }) {
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 128 128" className="w-32 h-32 -rotate-90" role="img" aria-label={`${label}: ${pct}%`}>
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" style={{ stroke: 'rgb(var(--base-850))' }} />
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * circ} ${circ}`} style={{ stroke: 'rgb(var(--state-success))', transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-content-primary">{pct}%</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-content-secondary text-center">{label}</div>
    </div>
  );
}

function EmptyPlaceholder({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-border-subtle w-full h-full min-h-[11rem]">
      <div className="w-10 h-10 rounded-xl bg-base-850 flex items-center justify-center border border-border-subtle mb-3">
        <Icon size={18} className="text-content-muted" />
      </div>
      <h4 className="text-sm font-semibold text-content-primary mb-1">{title}</h4>
      <p className="text-xs text-content-muted max-w-[220px] leading-relaxed">{description}</p>
    </div>
  );
}

function FeedPanel({ icon: Icon, iconClass, title, onViewAll, children }: {
  icon: React.ElementType; iconClass: string; title: string; onViewAll?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="card p-5 flex flex-col h-80">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-subtle shrink-0">
        <h3 className="font-semibold text-content-primary text-sm flex items-center gap-1.5">
          <Icon size={15} className={iconClass} /> {title}
        </h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-accent-secondary text-xs hover:underline inline-flex items-center gap-0.5 font-semibold">
            View All <ChevronRight size={11} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">{children}</div>
    </div>
  );
}

function IssueThumb({ issue }: { issue: any }) {
  const image = issue.media?.find((m: any) => !m.is_resolution)?.url;
  return image
    ? <img src={formatMediaUrl(image)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
    : <div className="w-10 h-10 rounded-lg bg-base-850 border border-border-subtle flex items-center justify-center shrink-0">{issue.category_icon || '📋'}</div>;
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: COMMAND CENTER
// ════════════════════════════════════════════════════════════════════════════════
function DashboardView({ setView }: { setView: (v: AdminView) => void }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([adminApi.dashboard(), adminApi.analytics()])
      .then(([dashRes, analyticsRes]) => {
        setData(dashRes.data);
        setAnalyticsData(analyticsRes.data);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loadFailed) {
    return <div className="p-20 text-center text-sm text-state-error">Could not load the Command Center. Please refresh the page.</div>;
  }

  if (loading || !data || !analyticsData) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-accent-secondary" size={32} />
        <span className="text-sm text-content-secondary">Loading the Command Center…</span>
      </div>
    );
  }

  const { overview, byStatus, slaViolations, recentIssues } = data;
  const { categoryTrend, deptSatisfaction = [] } = analyticsData;

  const pieSlices = byStatus.map((s: any) => ({
    value: parseInt(s.count),
    color: STATUS_CHART_COLOR[s.status] || STATUS_CHART_COLOR.reported,
    label: STATUS_META[s.status as keyof typeof STATUS_META]?.label || s.status,
  }));

  // Analytics covers the last 30 days
  const totalIssues = categoryTrend.reduce((acc: number, c: any) => acc + parseInt(c.total), 0);
  const resolvedIssues = categoryTrend.reduce((acc: number, c: any) => acc + parseInt(c.resolved), 0);
  const resolutionRate = totalIssues ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
  const avgHours = overview.avg_resolution_hours === null ? null : parseFloat(overview.avg_resolution_hours);
  const overdue = parseInt(overview.overdue || '0');
  const openUnresolved = () => router.push('/admin?view=issues&filterStatus=Unresolved');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-end gap-2">
        <button className="btn-secondary h-9 px-4 text-xs font-semibold gap-2">
          <Download size={13} /> Export CSV
        </button>
        <button className="btn-secondary h-9 px-4 text-xs font-semibold gap-2">
          <Download size={13} /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={overview.total || '0'} sub="All time" icon={<Activity size={15} />} accent="blue" onClick={() => router.push('/admin?view=issues')} />
        <StatCard label="Open Workload" value={overview.active || '0'} sub="Not yet resolved or rejected" icon={<AlertTriangle size={15} />} accent="amber" onClick={openUnresolved} />
        <StatCard label="Overdue" value={overdue} sub="Open past their SLA deadline" icon={<Clock size={15} />} accent="red" onClick={openUnresolved} />
        <StatCard label="Avg Resolution" value={avgHours === null ? '—' : avgHours < 1 ? '<1h' : avgHours < 48 ? `${Math.round(avgHours)}h` : `${(avgHours / 24).toFixed(1)}d`}
          sub="From report to verified fix" icon={<CheckCircle2 size={15} />} accent="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-content-primary text-sm mb-4">Status Distribution</h3>
          <div className="flex items-center justify-center min-h-44 w-full">
            {pieSlices.some((s: any) => s.value > 0)
              ? <PieChart slices={pieSlices} />
              : <EmptyPlaceholder icon={Activity} title="No reports yet" description="The status breakdown appears once reports come in." />}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-content-primary text-sm mb-4">Resolution Rate <span className="font-normal text-content-muted">· last 30 days</span></h3>
          {totalIssues > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:h-44">
              <DonutChart pct={resolutionRate} label="Resolved" />
              <div className="flex-1 w-full space-y-3">
                {[
                  { label: 'Resolved', val: resolvedIssues, dot: 'bg-state-success' },
                  { label: 'Still open', val: totalIssues - resolvedIssues, dot: 'bg-state-warning' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${r.dot}`} />
                    <span className="text-xs text-content-secondary">{r.label}</span>
                    <span className="text-xs font-bold text-content-primary ml-auto">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPlaceholder icon={CheckCircle2} title="No reports in 30 days" description="The resolution rate appears once reports come in." />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FeedPanel icon={AlertTriangle} iconClass="text-state-error" title="Overdue Issues" onViewAll={openUnresolved}>
          {slaViolations.length > 0 ? slaViolations.slice(0, 5).map((issue: any) => (
            <Link href={`/issues/${issue.id}`} key={issue.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-base-900 border border-border-subtle hover:border-state-error/30 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-content-primary truncate group-hover:text-accent-secondary">{issue.title}</p>
                <p className="text-[11px] text-state-error mt-0.5">Overdue by {formatDistanceToNow(new Date(issue.sla_deadline))}</p>
              </div>
              <SeverityBadge severity={issue.severity} />
            </Link>
          )) : <EmptyPlaceholder icon={CheckCircle2} title="Nothing overdue" description="Every open issue is within its SLA deadline." />}
        </FeedPanel>

        <FeedPanel icon={Inbox} iconClass="text-accent-secondary" title="Incoming Reports" onViewAll={() => setView('issues')}>
          {recentIssues.length > 0 ? recentIssues.slice(0, 4).map((issue: any) => (
            <Link href={`/issues/${issue.id}`} key={issue.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-base-900 border border-border-subtle hover:border-accent-secondary/30 transition-colors group">
              <IssueThumb issue={issue} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-content-primary truncate group-hover:text-accent-secondary">{issue.title}</p>
                <p className="text-[11px] text-content-muted mt-0.5">{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</p>
              </div>
              <StatusBadge status={issue.status} size="sm" showDot={false} />
            </Link>
          )) : <EmptyPlaceholder icon={Inbox} title="No reports yet" description="New citizen reports will appear here." />}
        </FeedPanel>

        <FeedPanel icon={Star} iconClass="text-state-warning" title="Citizen Satisfaction">
          {deptSatisfaction.length > 0 ? deptSatisfaction.map((d: any) => {
            const avg = parseFloat(d.avg_rating || '0');
            const isLow = avg < 3;
            return (
              <div key={d.department} className={`p-2.5 rounded-xl border ${isLow ? 'border-state-error/20 bg-state-error/5' : 'border-border-subtle bg-base-900'}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-xs font-bold text-content-primary truncate flex-1">{d.department}</span>
                  {isLow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-state-error/10 text-state-error font-bold ml-1 shrink-0">Low</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <StarRating rating={Math.round(avg)} size={11} />
                  <span className={`text-xs font-bold ${isLow ? 'text-state-error' : 'text-state-warning'}`}>{avg.toFixed(1)}</span>
                  <span className="text-[11px] text-content-muted ml-auto">{d.review_count} review{parseInt(d.review_count) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          }) : <EmptyPlaceholder icon={Star} title="No ratings yet" description="Department ratings from citizen reviews will appear here." />}
        </FeedPanel>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: ISSUE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════
function IssueManagementView() {
  const router = useRouter();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filterStatus') as Status | 'All' | 'Unresolved';

  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'All' | 'Unresolved'>('All');
  const [filterSev, setFilterSev] = useState<Severity | 'All'>('All');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setFilterStatus(filterParam || 'All');
    setPage(1);
  }, [filterParam]);

  const fetchIssues = () => {
    setLoading(true);
    adminApi.issues({
      page,
      limit: 25,
      search: search || undefined,
      status: filterStatus === 'All' ? undefined : (filterStatus === 'Unresolved' ? 'unresolved' : filterStatus.toLowerCase().replace(' ', '_')),
      severity: filterSev === 'All' ? undefined : filterSev.toLowerCase(),
      moderation: needsReviewOnly ? 'held' : undefined
    }).then(res => {
      setIssues(res.data.issues);
      setTotal(res.data.total);
      setLoading(false);
    }).catch(err => {
      toast.error(apiErrorMessage(err, 'Could not load issues.'));
      setLoading(false);
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchIssues();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [page, search, filterStatus, filterSev, needsReviewOnly]);

  const toggle = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(p => p.length === issues.length ? [] : issues.map(i => i.id));

  const handleBulkAction = async (status: string) => {
    if (!selected.length) return;
    try {
      await adminApi.bulkStatus(selected.map(String), status);
      toast.success(`Updated ${selected.length} issue${selected.length > 1 ? 's' : ''}`);
      setSelected([]);
      fetchIssues();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Bulk update failed.'));
    }
  };

  const totalPages = Math.ceil(total / 25) || 1;
  // Bulk status changes are admin-only on the server, so staff don't see the controls.
  const canBulkEdit = user?.role === 'admin';

  return (
    <div className="p-4 sm:p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-secondary" />
          <input
            type="text" placeholder="Search issues..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-dark pl-9 h-10 text-sm w-full"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary hover:text-content-primary">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Shortcut Filter: Unresolved Only */}
        <button
          onClick={() => {
            setFilterStatus(prev => prev === 'Unresolved' ? 'All' : 'Unresolved');
            setPage(1);
          }}
          aria-pressed={filterStatus === 'Unresolved'}
          className={`h-10 px-4 inline-flex items-center gap-2 rounded-xl text-sm font-semibold border whitespace-nowrap transition-colors ${filterStatus === 'Unresolved' ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary' : 'bg-base-850 border-border-subtle text-content-secondary'}`}
        >
          Unresolved Only
        </button>

        <button
          onClick={() => { setNeedsReviewOnly(v => !v); setPage(1); }}
          className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-all ${needsReviewOnly ? 'border-state-warning/40 bg-state-warning/10 text-state-warning' : 'border-border-subtle bg-base-850 text-content-secondary'}`}
        >
          Needs Review
        </button>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`btn-outline h-10 flex items-center gap-2 text-sm px-4 ${showFilters ? 'border-accent-secondary/40 text-accent-secondary' : ''}`}
        >
          <Filter size={13} /> Filters
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="card p-4 space-y-3" style={{ animation: 'fadeUp 0.2s ease-out' }}>
          <div>
            <p className="label-micro mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {(['All', 'Unresolved', 'Reported', 'Acknowledged', 'In Progress', 'Pending Verification', 'Resolved', 'Rejected'] as (Status | 'All' | 'Unresolved')[]) .map(s => (
                <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === s ? 'border-accent-secondary/40 bg-accent-secondary/10 text-accent-secondary' : 'border-border-subtle text-content-secondary hover:border-border-subtle hover:text-content-primary'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-micro mb-2">Severity</p>
            <div className="flex flex-wrap gap-2">
              {(['All', 'Critical', 'High', 'Medium', 'Low'] as (Severity | 'All')[]).map(s => (
                <button key={s} onClick={() => { setFilterSev(s); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${filterSev === s ? 'border-accent-secondary/40 bg-accent-secondary/10 text-accent-secondary' : 'border-border-subtle text-content-secondary hover:border-border-subtle hover:text-content-primary'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-accent-secondary/10 border border-accent-secondary/20">
          <span className="text-sm text-accent-secondary font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulkAction('acknowledged')} className="btn-outline text-xs py-1 px-3 h-7">Acknowledge</button>
          <button onClick={() => handleBulkAction('in_progress')} className="btn-outline text-xs py-1 px-3 h-7">Mark In Progress</button>
          <button onClick={() => handleBulkAction('rejected')} className="btn-outline text-xs py-1 px-3 h-7">Reject</button>
          <button onClick={() => setSelected([])} className="text-content-secondary hover:text-content-primary transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-base-950/50 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-accent-secondary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left w-10">
                  {canBulkEdit && (
                    <input type="checkbox" checked={selected.length === issues.length && issues.length > 0}
                      onChange={toggleAll} aria-label="Select all issues"
                      className="w-3.5 h-3.5 rounded border-border-subtle/40 bg-transparent accent-accent-secondary cursor-pointer" />
                  )}
                </th>
                {['ID', 'Title', 'Category', 'Severity', 'Status', 'Department'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-micro text-content-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, idx) => (
                <tr
                  key={issue.id}
                  onClick={() => router.push(`/issues/${issue.id}`)}
                  className={`border-b border-border-subtle last:border-0 hover:bg-base-850 transition-colors cursor-pointer group ${selected.includes(issue.id) ? 'bg-accent-secondary/5' : ''}`}
                  style={{ animation: `fadeUp 0.3s ease-out ${idx * 40}ms both` }}
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {canBulkEdit && (
                      <input type="checkbox" checked={selected.includes(issue.id)}
                        onChange={() => toggle(issue.id)} aria-label={`Select ${issue.title}`}
                        className="w-3.5 h-3.5 rounded border-border-subtle/40 bg-transparent accent-accent-secondary cursor-pointer" />
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-content-secondary font-mono" title={String(issue.id)}>#{String(issue.id).slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3.5 max-w-[220px]">
                    <span className="text-sm text-content-primary group-hover:text-accent-secondary transition-colors font-medium truncate block">
                      {issue.title}
                    </span>
                    {issue.moderation_status === 'held' && (
                      <span className="text-[10px] font-semibold text-state-warning">Needs review</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-content-secondary">{issue.category_name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <SeverityBadge severity={issue.severity} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={issue.status} size="sm" />
                  </td>
                  <td className="px-4 py-3.5">
                    {issue.department ? (
                      <span className="text-sm text-content-secondary">{issue.department}</span>
                    ) : (
                      <span className="text-xs text-content-secondary/40 italic">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && issues.length === 0 && (
          <div className="py-16 text-center">
            <Search size={28} className="mx-auto mb-3 opacity-10" />
            <p className="text-content-primary font-semibold mb-1">No issues found</p>
            <p className="text-sm text-content-secondary">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
          <span className="text-xs text-content-secondary">Showing {issues.length} of {total} issues</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let p = i + 1;
              if (totalPages > 5 && page > 3) p = page - 2 + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-accent-secondary/10 text-accent-secondary' : 'text-content-secondary hover:bg-base-850 hover:text-content-primary'}`}>{p}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}



// ════════════════════════════════════════════════════════════════════════════════
// VIEW: USERS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════
function UsersManagementView() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    adminApi.users({ page, limit: 25, search: search || undefined })
      .then(res => {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setLoading(false);
      })
      .catch(err => {
        toast.error(apiErrorMessage(err, 'Could not load users.'));
        setLoading(false);
      });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => fetchUsers(), 500);
    return () => clearTimeout(timeoutId);
  }, [page, search]);

  const openUserModal = (user: any) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditActive(user.is_active);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const closeModal = () => {
    if (editAvatarPreview) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setSelectedUser(null);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setModalLoading(true);
    try {
      const fd = new FormData();
      fd.append('role', editRole);
      fd.append('is_active', String(editActive));
      if (editAvatarFile) {
        fd.append('avatar', editAvatarFile);
      }

      await adminApi.updateUser(selectedUser.id, fd);
      closeModal();
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not update this user.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await adminApi.deleteUser(id);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not delete this user.');
    }
  };

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="p-4 sm:p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-secondary" />
          <input
            type="text" placeholder="Search users by name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-dark pl-9 h-10 text-sm w-full"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary hover:text-content-primary">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-base-950/50 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-accent-secondary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                {['Photo', 'Name', 'Email', 'Role', 'Status', 'Issues', 'Join Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-micro text-content-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.id} className="border-b border-border-subtle last:border-0 hover:bg-base-850 transition-colors" style={{ animation: `fadeUp 0.3s ease-out ${idx * 40}ms both` }}>
                  <td className="px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-base-850 border border-border-subtle flex items-center justify-center shrink-0">
                      {user.avatar_url ? (
                        <img src={formatMediaUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-accent-secondary">{user.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-content-primary">{user.name}</span>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-content-secondary">{user.email}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-1 rounded border ${user.role === 'admin' ? 'border-state-error/30 text-state-error bg-state-error/10' : user.role === 'department_staff' ? 'border-state-success/30 text-state-success bg-state-success/10' : 'border-border-subtle text-content-secondary bg-base-850'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {user.is_active ? <span className="text-xs text-state-success">Active</span> : <span className="text-xs text-state-error">Suspended</span>}
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-content-secondary">{user.issue_count}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-content-secondary">{new Date(user.created_at).toLocaleDateString()}</span></td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-3">
                      <button onClick={() => openUserModal(user)} className="text-accent-secondary hover:text-content-primary transition-colors text-xs">Edit</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-state-error hover:text-content-primary transition-colors text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
          <span className="text-xs text-content-secondary">Showing {users.length} of {total} users</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let p = i + 1;
              if (totalPages > 5 && page > 3) p = page - 2 + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-accent-secondary/10 text-accent-secondary' : 'text-content-secondary hover:bg-base-850 hover:text-content-primary'}`}>{p}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-base-900 border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl p-5" style={{ animation: 'fadeUp 0.2s ease-out' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-content-primary">Edit User</h3>
              <button onClick={closeModal} aria-label="Close" className="text-content-secondary hover:text-content-primary"><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              {/* Profile Photo selector with ambient design */}
              <div className="flex flex-col items-center gap-3 pb-4 border-b border-border-subtle">
                <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-base-850 border border-border-subtle flex items-center justify-center">
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : selectedUser.avatar_url ? (
                    <img src={formatMediaUrl(selectedUser.avatar_url)} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-accent-secondary">{selectedUser.name?.[0]?.toUpperCase()}</span>
                  )}
                  <label className="hover-reveal absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 cursor-pointer text-white text-[10px] font-semibold">
                    <Camera size={16} />
                    Change
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          const file = e.target.files[0];
                          setEditAvatarFile(file);
                          if (editAvatarPreview) {
                            URL.revokeObjectURL(editAvatarPreview);
                          }
                          setEditAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>
                <span className="text-xs text-content-secondary">{selectedUser.name}</span>
              </div>

              <div>
                <label className="label-micro mb-2 block">Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="input-dark h-10 w-full text-sm">
                  <option value="citizen">Citizen</option>
                  <option value="department_staff">Department Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 border border-border-subtle rounded-lg bg-base-900">
                <span className="text-sm font-medium text-content-primary">Account Active</span>
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="w-4 h-4 accent-accent-secondary bg-transparent border-border-subtle/40 rounded cursor-pointer" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeModal} className="btn-outline h-9 px-4 text-sm">Cancel</button>
              <button onClick={handleSaveUser} disabled={modalLoading} className="bg-accent-secondary hover:bg-accent-secondary/90 text-black h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]">
                {modalLoading ? <Loader2 className="animate-spin" size={14} /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════════════
function LogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'issues'>('users');
  const [expandedIssues, setExpandedIssues] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    setLoading(true);
    adminApi.logs({ page, limit: 50, type: activeTab }).then(res => {
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setLoading(false);
    }).catch(err => {
      toast.error(apiErrorMessage(err, 'Could not load audit logs.'));
      setLoading(false);
    });
  }, [page, activeTab]);

  const handleTabChange = (tab: 'users' | 'issues') => {
    setActiveTab(tab);
    setPage(1);
    setExpandedIssues({});
  };

  const toggleIssueExpand = (issueId: string) => {
    setExpandedIssues(prev => ({
      ...prev,
      [issueId]: !prev[issueId]
    }));
  };

  const totalPages = Math.ceil(total / 50) || 1;

  // Group issue logs by issue_id
  const groupedLogs = useMemo(() => {
    if (activeTab !== 'issues') return [];
    const map = new Map<string, { issueId: string; issueTitle: string; items: any[] }>();
    logs.forEach(log => {
      const issueId = log.issue_id || log.entity_id;
      const issueTitle = log.issue_title || 'Issue Details';
      if (!map.has(issueId)) {
        map.set(issueId, { issueId, issueTitle, items: [] });
      }
      map.get(issueId)!.items.push(log);
    });
    return Array.from(map.values());
  }, [logs, activeTab]);

  return (
    <div className="p-4 sm:p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Sleek Tab Switcher Bar */}
      <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-2">
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg ${activeTab === 'users' ? 'bg-accent-secondary text-black shadow-glow-secondary' : 'text-content-secondary hover:text-content-primary hover:bg-base-850'}`}
        >
          User Administration Logs
        </button>
        <button
          onClick={() => handleTabChange('issues')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg ${activeTab === 'issues' ? 'bg-accent-primary text-white shadow-glow-primary' : 'text-content-secondary hover:text-content-primary hover:bg-base-850'}`}
        >
          Issue Activity Logs
        </button>
      </div>

      {activeTab === 'issues' ? (
        <div className="space-y-4 relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-base-950/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
              <Loader2 className="animate-spin text-accent-primary" />
            </div>
          )}
          
          {groupedLogs.map((group, gIdx) => {
            const isExpanded = !!expandedIssues[group.issueId];
            return (
              <div 
                key={group.issueId} 
                className="card bg-base-900 border border-border-subtle overflow-hidden transition-all shadow-md animate-fade_in"
                style={{ animationDelay: `${gIdx * 50}ms` }}
              >
                {/* Expandable Group Header */}
                <div 
                  onClick={() => toggleIssueExpand(group.issueId)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-base-850 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse Chevron Icon */}
                    <span className="text-content-secondary">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    
                    {/* Clickable Issue Redirect (stopped propagation so it doesn't trigger collapse) */}
                    <a 
                      href={`/issues/${group.issueId}`} 
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()} // Prevent expansion trigger
                      className="flex items-center gap-2 text-sm font-bold text-accent-primary hover:text-accent-primary/80 hover:underline transition-all group"
                    >
                      <ExternalLink size={13} className="group-hover:scale-110 transition-transform" />
                      <span>{group.issueTitle}</span>
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-content-secondary bg-base-850 px-2 py-0.5 rounded-md border border-border-subtle font-semibold">
                      {group.items.length} {group.items.length === 1 ? 'log' : 'logs'}
                    </span>
                    <span className="text-[10px] font-mono text-content-secondary bg-base-850 px-2 py-0.5 rounded-md border border-border-subtle">
                      ID: {group.issueId.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Sub-table: Shown only when expanded */}
                {isExpanded && (
                  <div className="border-t border-border-subtle p-4 bg-base-900 animate-fade_in">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border-subtle">
                            {['Timestamp', 'Performed By', 'Status Transition', 'Details / Note'].map(h => (
                              <th key={h} className="px-3 py-2 text-left label-micro text-content-secondary">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(log => {
                            const action = log.old_status 
                              ? `${log.old_status.toUpperCase()} ➔ ${log.new_status.toUpperCase()}`
                              : `REPORTED`;
                            return (
                              <tr key={log.id} className="border-b border-border-subtle last:border-0 hover:bg-base-850 transition-colors">
                                <td className="px-3 py-2.5 text-xs text-content-secondary">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2.5">
                                    <span className="text-xs text-content-primary font-medium block">{log.admin_name}</span>
                                    <span className="text-[9px] text-content-secondary">{log.admin_email}</span>
                                  </td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${action.includes('REJECTED') || action.includes('STILL_BROKEN') ? 'border-state-error/30 text-state-error bg-state-error/10' : 'border-accent-primary/30 text-accent-primary bg-accent-primary/10'}`}>
                                    {action}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-content-primary">{log.details || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {logs.length === 0 && !loading && (
            <div className="card p-10 text-center text-content-secondary text-sm bg-base-800 border border-border-subtle">No issue activity logs found.</div>
          )}

          {/* Pagination footer for issues logs */}
          <div className="card px-4 py-3 border border-border-subtle flex items-center justify-between bg-base-800 shadow-md">
            <span className="text-xs text-content-secondary">Showing {logs.length} of {total} logs</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-accent-primary/10 text-accent-primary' : 'text-content-secondary hover:bg-base-850 hover:text-content-primary'}`}>{p}</button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-base-950/50 backdrop-blur-sm flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-accent-secondary" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Timestamp', 'Performed By', 'Action Type', 'Target Entity', 'Details / Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left label-micro text-content-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className="border-b border-border-subtle last:border-0 hover:bg-base-850 transition-colors" style={{ animation: `fadeUp 0.3s ease-out ${idx * 30}ms both` }}>
                    <td className="px-4 py-3.5"><span className="text-xs text-content-secondary">{new Date(log.created_at).toLocaleString()}</span></td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-content-primary font-medium block">{log.admin_name}</span>
                      <span className="text-[10px] text-content-secondary">{log.admin_email}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-1 rounded border font-mono ${log.action.includes('DELETE') ? 'border-state-error/30 text-state-error bg-state-error/10' : 'border-state-success/30 text-state-success bg-state-success/10'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5"><span className="text-xs text-content-secondary font-mono">{log.entity_type} #{log.entity_id.slice(0, 8)}</span></td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-content-primary block leading-relaxed max-w-[400px] break-words">{log.details ? log.details : '—'}</span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-content-secondary text-sm">No audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
            <span className="text-xs text-content-secondary">Showing {logs.length} of {total} logs</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-accent-secondary/10 text-accent-secondary' : 'text-content-secondary hover:bg-base-850 hover:text-content-primary'}`}>{p}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: SETTINGS (placeholder)
// ════════════════════════════════════════════════════════════════════════════════
function SettingsView() {
  const [settings, setSettings] = useState({
    systemName: '',
    supportEmail: '',
    enableRegistration: true,
    minUpvotesForAutoAcknowledge: 5,
    enableAnonymousReporting: true,
    allowGuestComments: false,
    enableAlertBanner: false,
    alertBannerText: '',
    alertBannerType: 'warning'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getSettings()
      .then(res => {
        setSettings(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load settings');
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const res = await adminApi.updateSettings(settings);
      setSettings(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin text-accent-secondary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6 max-w-4xl" style={{ animation: 'fadeUp 0.35s ease-out' }}>
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-content-primary">System Settings</h2>
          <p className="text-xs text-content-secondary mt-1">Configure global application rules, registration preferences, and municipal broadcasts.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel 1: General Settings */}
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <div className="w-8 h-8 rounded-lg bg-accent-secondary/15 flex items-center justify-center">
              <Settings size={15} className="text-accent-secondary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-primary">General Platform</h3>
              <p className="text-[10px] text-content-secondary">Customize public naming and contacts</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-1.5">Municipality / Platform Name</label>
              <input 
                type="text" 
                value={settings.systemName} 
                onChange={e => setSettings(s => ({ ...s, systemName: e.target.value }))}
                required
                className="w-full h-10 px-3.5 rounded-xl text-xs text-content-primary placeholder:text-content-muted/40 bg-base-900 border border-border-subtle focus:border-accent-secondary/30 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-1.5">Support Contact Email</label>
              <input 
                type="email" 
                value={settings.supportEmail} 
                onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
                required
                className="w-full h-10 px-3.5 rounded-xl text-xs text-content-primary placeholder:text-content-muted/40 bg-base-900 border border-border-subtle focus:border-accent-secondary/30 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Community Rules & Automations */}
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <div className="w-8 h-8 rounded-lg bg-state-success/15 flex items-center justify-center">
              <Zap size={15} className="text-state-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Community & Automation Rules</h3>
              <p className="text-[10px] text-content-secondary">Submission logic and user privileges</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-semibold text-content-secondary uppercase tracking-wider">Auto-Acknowledge Upvote Threshold</label>
                <span className="text-xs font-bold text-state-success bg-state-success/10 px-2 py-0.5 rounded-full">{settings.minUpvotesForAutoAcknowledge} upvotes</span>
              </div>
              <p className="text-[10px] text-content-secondary mb-2 leading-relaxed">Issues receiving this many upvotes will automatically transition to "Acknowledged" status.</p>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={settings.minUpvotesForAutoAcknowledge} 
                onChange={e => setSettings(s => ({ ...s, minUpvotesForAutoAcknowledge: parseInt(e.target.value) }))}
                className="w-full accent-state-success"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-content-primary block">Enable Public Registration</span>
                  <span className="text-[9px] text-content-secondary">Allow new citizens to sign up on the platform</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enableRegistration: !s.enableRegistration }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableRegistration ? 'bg-state-success/20 border-state-success/40' : 'bg-base-850 border-border-subtle'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableRegistration ? 'bg-state-success translate-x-5' : 'bg-content-secondary translate-x-0'} shadow-md`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-content-primary block">Allow Anonymous Reporting</span>
                  <span className="text-[9px] text-content-secondary">Citizens can choose to hide their name on issues</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enableAnonymousReporting: !s.enableAnonymousReporting }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableAnonymousReporting ? 'bg-state-success/20 border-state-success/40' : 'bg-base-850 border-border-subtle'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableAnonymousReporting ? 'bg-state-success translate-x-5' : 'bg-content-secondary translate-x-0'} shadow-md`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-content-primary block">Allow Guest Comments</span>
                  <span className="text-[9px] text-content-secondary">Allow comments from users without verified profiles</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, allowGuestComments: !s.allowGuestComments }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.allowGuestComments ? 'bg-state-success/20 border-state-success/40' : 'bg-base-850 border-border-subtle'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.allowGuestComments ? 'bg-state-success translate-x-5' : 'bg-content-secondary translate-x-0'} shadow-md`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Broadcast Emergency Alert (Span full width) */}
        <div className="card p-6 flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-state-error/15 flex items-center justify-center">
                <AlertTriangle size={15} className="text-state-error" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-content-primary">Emergency Broadcast Alert System</h3>
                <p className="text-[10px] text-content-secondary">Broadcast notices across all citizen dashboard pages</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setSettings(s => ({ ...s, enableAlertBanner: !s.enableAlertBanner }))}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableAlertBanner ? 'bg-state-error/20 border-state-error/40' : 'bg-base-850 border-border-subtle'}`}
            >
              <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableAlertBanner ? 'bg-state-error translate-x-5' : 'bg-content-secondary translate-x-0'} shadow-md`} />
            </button>
          </div>

          <div className={`space-y-4 transition-all duration-300 ${settings.enableAlertBanner ? 'opacity-100 max-h-[500px]' : 'opacity-40 pointer-events-none max-h-[500px]'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-1.5">Broadcast Alert Message</label>
                <textarea 
                  value={settings.alertBannerText}
                  onChange={e => setSettings(s => ({ ...s, alertBannerText: e.target.value }))}
                  required={settings.enableAlertBanner}
                  placeholder="e.g. Due to severe water maintenance, street block 4 will experience low pressure until 5 PM today."
                  rows={3}
                  className="w-full p-3 rounded-xl text-xs text-content-primary placeholder:text-content-muted/40 bg-base-900 border border-border-subtle focus:border-state-error/30 outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-1.5">Severity Type</label>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 'info', label: 'Info', active: 'border-accent-secondary/50 text-accent-secondary bg-accent-secondary/10', dot: 'bg-accent-secondary' },
                    { value: 'warning', label: 'Warning', active: 'border-state-warning/50 text-state-warning bg-state-warning/10', dot: 'bg-state-warning' },
                    { value: 'critical', label: 'Critical', active: 'border-state-error/50 text-state-error bg-state-error/10', dot: 'bg-state-error' }
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={settings.alertBannerType === t.value}
                      onClick={() => setSettings(s => ({ ...s, alertBannerType: t.value }))}
                      className={`h-9 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${settings.alertBannerType === t.value ? t.active : 'border-border-subtle text-content-secondary hover:text-content-primary'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Save Button Footer */}
      <div className="flex justify-end pt-3 gap-3 items-center border-t border-border-subtle">
        {success && (
          <span className="text-xs font-semibold text-state-success flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 size={13} />
            Settings saved successfully!
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="btn-accent h-10 px-6 text-xs gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving Changes...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════════
const VIEW_META: Record<AdminView, { title: string; sub: string }> = {
  dashboard: { title: 'Admin Dashboard',   sub: 'City Command Center – Monitor and manage all issues' },
  issues:    { title: 'Issue Management',  sub: 'Manage and resolve reported issues' },
  analytics: { title: 'Analytics',         sub: 'Insights and performance metrics' },
  users:     { title: 'User Management',   sub: 'Manage registered citizens and staff' },
  logs:      { title: 'Audit Logs',        sub: 'Security trail of all administrative actions' },
  settings:  { title: 'Settings',          sub: 'Platform configuration' },
};

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view') as AdminView;
  const { user, isLoading } = useAuthStore();
  const isStaff = user?.role === 'admin' || user?.role === 'department_staff';

  const [view, setView] = useState<AdminView>('dashboard');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (isLoading || isStaff) return;
    router.replace(user ? '/dashboard' : '/login?redirect=/admin');
  }, [isLoading, isStaff, user, router]);

  useEffect(() => {
    if (viewParam === 'analytics') {
      setView('dashboard');
      router.replace('/admin?view=dashboard');
      return;
    }
    if (viewParam && ['dashboard', 'issues', 'users', 'logs', 'settings'].includes(viewParam)) {
      // Prevent non-admin staff from accessing restricted views
      if (['users', 'logs', 'settings'].includes(viewParam) && user?.role !== 'admin') {
        setView('dashboard');
      } else {
        setView(viewParam);
      }
    } else {
      setView('dashboard');
    }
  }, [viewParam, user, router]);

  const handleSetView = (newView: AdminView) => {
    setView(newView);
    router.push(`/admin?view=${newView}`);
  };

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-base-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex h-dvh overflow-hidden bg-base-950">
        <Sidebar />

        <main className="flex-1 min-w-0 lg:ml-64 h-dvh relative flex flex-col overflow-hidden">
          {/* Subtle background glow effect */}
          <div className="absolute top-0 inset-x-0 h-[500px] bg-hero-gradient pointer-events-none opacity-50" />

          <TopBar
            title={VIEW_META[view].title}
            sub={VIEW_META[view].sub}
            darkMode={darkMode}
            toggleDark={() => setDarkMode(v => !v)}
          />

          <div className="flex-1 overflow-y-auto relative z-10">
            {view === 'dashboard'  && <DashboardView setView={handleSetView} />}
            {view === 'issues'     && <IssueManagementView />}
            {view === 'users'      && <UsersManagementView />}
            {view === 'logs'       && <LogsView />}
            {view === 'settings'   && <SettingsView />}
          </div>
        </main>
      </div>
    </>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
        <div className="text-content-muted font-medium animate-pulse">Loading Command Center...</div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
