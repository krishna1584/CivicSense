'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import {
  LayoutDashboard, List, BarChart2, Settings, Zap, Bell,
  Moon, Sun, TrendingUp, TrendingDown, AlertTriangle, Clock,
  ThumbsUp, MessageSquare, Search, Filter, ChevronDown,
  Download, Eye, CheckCircle2, XCircle, Loader2, Users,
  Activity, ArrowUpRight, MapPin, ChevronRight, X, ClipboardList, Camera, ExternalLink
} from 'lucide-react';
import { adminApi, issuesApi, usersApi, commentsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

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

// ─── Badge configs ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Status, { color: string; bg: string; dot: string }> = {
  Reported:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5',       dot: 'bg-[#9CA3AF]' },
  Acknowledged:  { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/10',  dot: 'bg-[#61C0FF]' },
  'In Progress': { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10',  dot: 'bg-[#F59E0B]' },
  Resolved:      { color: 'text-[#00FF94]', bg: 'bg-[#00FF94]/10',  dot: 'bg-[#00FF94]' },
  Rejected:      { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10',  dot: 'bg-[#EF4444]' },
  'Pending Verification': { color: 'text-[#A855F7]', bg: 'bg-[#A855F7]/10', dot: 'bg-[#A855F7]' },
};
const SEV_CFG: Record<Severity, { color: string; bg: string }> = {
  Critical: { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/15' },
  High:     { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15' },
  Medium:   { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/15' },
  Low:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5' },
};

function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.color} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}
function SevBadge({ severity }: { severity: Severity }) {
  const c = SEV_CFG[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${c.color} ${c.bg}`}>
      {severity}
    </span>
  );
}

// ─── Tiny SVG Charts ───────────────────────────────────────────────────────────
function BarChart({ data, labels = ['Roads', 'Garbage', 'Parks', 'Traffic', 'Water', 'Lights', 'Buildings'], color = '#61C0FF' }: { data: number[]; labels?: string[]; color?: string }) {
  const max = Math.max(...data);
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-end gap-2 pb-2">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{
                height: `${(v / max) * 100}%`,
                background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                animationDelay: `${i * 80}ms`
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {labels.slice(0, data.length).map((l, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-[#9CA3AF] truncate">{l}</div>
        ))}
      </div>
    </div>
  );
}

function PieChart({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  let cumulative = 0;
  const paths = slices.map(s => {
    const pct = s.value / total;
    const start = cumulative;
    cumulative += pct;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const r = 80;
    const cx = 100; const cy = 100;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: s.color, label: s.label, value: s.value };
  });
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-36 h-36 shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity="0.9" stroke="#0B0F14" strokeWidth="2" />
        ))}
      </svg>
      <div className="space-y-2">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-[#9CA3AF]">{p.label}</span>
            <span className="text-white font-semibold ml-auto pl-3">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, color = '#61C0FF' }: { data: number[]; color?: string }) {
  const max = Math.max(...data); const min = Math.min(...data);
  const w = 260; const h = 80; const pad = 10;
  const pts = data.map((v, i) => {
    const divisor = data.length - 1 || 1;
    const x = pad + (i / divisor) * (w - pad * 2);
    const y = pad + ((max - v) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaD = pathD + ` L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lg)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="#0B0F14" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex justify-between px-2 mt-1">
        {months.map(m => <span key={m} className="text-[9px] text-[#9CA3AF]">{m}</span>)}
      </div>
    </div>
  );
}

function DonutChart({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 54; const cx = 64; const cy = 64;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 128 128" className="w-32 h-32 -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2030" strokeWidth="12" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-white">{pct}%</span>
          <span className="text-[10px] text-[#9CA3AF]">rate</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-[#9CA3AF] text-center">{label}</div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subUp, icon: Icon, color, delay = 0 }:
  { label: string; value: string; sub: string; subUp?: boolean; icon: React.ElementType; color: string; delay?: number }) {
  return (
    <div className="stat-card" style={{ '--accent': color } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3">
        <p className="label-micro text-[#9CA3AF]">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className={`flex items-center gap-1 text-xs font-medium ${subUp === undefined ? 'text-[#9CA3AF]' : subUp ? 'text-[#00FF94]' : 'text-[#EF4444]'}`}>
        {subUp !== undefined && (subUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
        {sub}
      </div>
    </div>
  );
}

// Shared TopBar component imported from '@/components/layout/TopBar'

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ════════════════════════════════════════════════════════════════════════════════
function DashboardView({ setView }: { setView: (v: AdminView) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#61C0FF]" /></div>;
  }

  const { overview, byStatus, bySeverity, byCategory, slaViolations, recentIssues } = data;

  const barData = byCategory.map((c: any) => parseInt(c.count)).slice(0, 7);
  const barLabels = byCategory.map((c: any) => c.name).slice(0, 7);

  const pieColors: Record<string, string> = {
    'reported': '#9CA3AF', 'acknowledged': '#61C0FF', 'in_progress': '#F59E0B', 'resolved': '#00FF94', 'rejected': '#EF4444'
  };
  const pieSlices = byStatus.map((s: any) => ({
    value: parseInt(s.count), color: pieColors[s.status] || '#9CA3AF', label: s.status.replace('_', ' ')
  }));

  const criticalIssues = recentIssues.filter((i: any) => i.severity === 'critical' || i.severity === 'high').slice(0, 3);

  return (
    <div className="p-6 space-y-6" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Issues"    value={overview.total || '0'} sub="All time"                  icon={Activity}    color="#61C0FF"  delay={0} />
        <StatCard label="Open Issues"     value={overview.active || '0'} sub="Requires attention"        icon={AlertTriangle} color="#F59E0B" subUp={false} delay={1} />
        <StatCard label="Avg Resolution"  value={`${overview.avg_resolution_hours || '0'}h`}  sub="Resolution time" icon={Clock} color="#00FF94" subUp={true} delay={2} />
        <StatCard label="SLA Breaches"    value={slaViolations?.length?.toString() || '0'} sub="Needs attention" icon={XCircle} color="#EF4444" subUp={false} delay={3} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Issues by Category</h3>
          </div>
          <div className="h-52">
            {barData.length > 0 ? <BarChart data={barData} labels={barLabels} color="#61C0FF" /> : <div className="text-[#9CA3AF] text-sm h-full flex items-center justify-center">No data</div>}
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Status Distribution</h3>
          </div>
          <div className="flex items-center justify-center h-52">
            {pieSlices.length > 0 ? <PieChart slices={pieSlices} /> : <div className="text-[#9CA3AF] text-sm h-full flex items-center justify-center">No data</div>}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Critical Issues */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#EF4444]" />
              Critical Issues
            </h3>
            <button onClick={() => setView('issues')} className="text-[#61C0FF] text-xs hover:underline flex items-center gap-1">
              View All <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-3">
            {criticalIssues.map((issue: any) => (
              <Link href={`/issues/${issue.id}`} key={issue.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0E131A] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <img src={formatMediaUrl(issue.media?.[0]?.url) || 'https://images.unsplash.com/photo-1515162305285-0293e4b4e81e?w=80&q=70'} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#61C0FF] transition-colors">{issue.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                    <span className="flex items-center gap-1"><Clock size={10} />{formatDistanceToNow(new Date(issue.created_at))} ago</span>
                  </div>
                </div>
                <StatusBadge status={issue.status === 'resolved' ? 'Resolved' : issue.status === 'in_progress' ? 'In Progress' : issue.status === 'acknowledged' ? 'Acknowledged' : issue.status === 'rejected' ? 'Rejected' : 'Reported'} />
              </Link>
            ))}
            {criticalIssues.length === 0 && <div className="text-xs text-[#9CA3AF] p-2 text-center">No critical issues</div>}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Clock size={14} className="text-[#61C0FF]" />
              Recent Reports
            </h3>
            <button onClick={() => setView('issues')} className="text-[#61C0FF] text-xs hover:underline flex items-center gap-1">
              View All <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-3">
            {recentIssues.slice(0, 3).map((issue: any) => (
              <Link href={`/issues/${issue.id}`} key={issue.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0E131A] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <img src={formatMediaUrl(issue.media?.[0]?.url) || 'https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=80&q=70'} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#61C0FF] transition-colors">
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                    <span className="flex items-center gap-1"><Clock size={10} />{formatDistanceToNow(new Date(issue.created_at))} ago</span>
                  </div>
                </div>
                <StatusBadge status={issue.status === 'resolved' ? 'Resolved' : issue.status === 'in_progress' ? 'In Progress' : issue.status === 'acknowledged' ? 'Acknowledged' : issue.status === 'rejected' ? 'Rejected' : 'Reported'} />
              </Link>
            ))}
            {recentIssues.length === 0 && <div className="text-xs text-[#9CA3AF] p-2 text-center">No recent issues</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: ISSUE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════
function IssueManagementView() {
  const router = useRouter();
  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'All' | 'Unresolved'>('All');
  const [filterSev, setFilterSev] = useState<Severity | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const fetchIssues = () => {
    setLoading(true);
    adminApi.issues({
      page,
      limit: 25,
      search: search || undefined,
      status: filterStatus === 'All' ? undefined : (filterStatus === 'Unresolved' ? 'unresolved' : filterStatus.toLowerCase().replace(' ', '_')),
      severity: filterSev === 'All' ? undefined : filterSev.toLowerCase()
    }).then(res => {
      setIssues(res.data.issues);
      setTotal(res.data.total);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchIssues();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [page, search, filterStatus, filterSev]);

  const toggle = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(p => p.length === issues.length ? [] : issues.map(i => i.id));

  const handleBulkAction = async (status: string) => {
    if (!selected.length) return;
    try {
      await adminApi.bulkStatus(selected.map(String), status);
      setSelected([]);
      fetchIssues();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / 25) || 1;

  const mapStatus = (s: string): Status => {
    if (s === 'pending_verification') return 'Pending Verification';
    return s === 'resolved' ? 'Resolved' : s === 'in_progress' ? 'In Progress' : s === 'acknowledged' ? 'Acknowledged' : s === 'rejected' ? 'Rejected' : 'Reported';
  };
  const mapSev = (s: string): Severity => s === 'critical' ? 'Critical' : s === 'high' ? 'High' : s === 'medium' ? 'Medium' : 'Low';

  return (
    <div className="p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text" placeholder="Search issues..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-dark pl-9 h-10 text-sm w-full"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">
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
          className="h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-semibold transition-all duration-250 active:scale-[0.97]"
          style={{
            background: filterStatus === 'Unresolved' ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
            border: filterStatus === 'Unresolved' ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.06)',
            color: filterStatus === 'Unresolved' ? '#38BDF8' : '#9CA3AF',
            boxShadow: filterStatus === 'Unresolved' ? '0 0 15px rgba(56,189,248,0.15)' : 'none',
          }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${filterStatus === 'Unresolved' ? 'bg-[#38BDF8] animate-pulse' : 'bg-[#9CA3AF]/40'}`} />
          Unresolved Only
        </button>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`btn-outline h-10 flex items-center gap-2 text-sm px-4 ${showFilters ? 'border-[#61C0FF]/40 text-[#61C0FF]' : ''}`}
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === s ? 'border-[#61C0FF]/40 bg-[#61C0FF]/10 text-[#61C0FF]' : 'border-white/5 text-[#9CA3AF] hover:border-white/10 hover:text-white'}`}>
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${filterSev === s ? 'border-[#61C0FF]/40 bg-[#61C0FF]/10 text-[#61C0FF]' : 'border-white/5 text-[#9CA3AF] hover:border-white/10 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#61C0FF]/10 border border-[#61C0FF]/20">
          <span className="text-sm text-[#61C0FF] font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulkAction('acknowledged')} className="btn-outline text-xs py-1 px-3 h-7">Acknowledge</button>
          <button onClick={() => handleBulkAction('in_progress')} className="btn-outline text-xs py-1 px-3 h-7">Mark In Progress</button>
          <button onClick={() => handleBulkAction('rejected')} className="btn-outline text-xs py-1 px-3 h-7">Reject</button>
          <button onClick={() => setSelected([])} className="text-[#9CA3AF] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-[#05070A]/50 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-[#61C0FF]" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={selected.length === issues.length && issues.length > 0}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-[#61C0FF] cursor-pointer" />
                </th>
                {['ID', 'Title', 'Category', 'Severity', 'Status', 'Department'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-micro text-[#9CA3AF]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, idx) => (
                <tr
                  key={issue.id}
                  onClick={() => router.push(`/issues/${issue.id}`)}
                  className={`border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer group ${selected.includes(issue.id) ? 'bg-[#61C0FF]/5' : ''}`}
                  style={{ animation: `fadeUp 0.3s ease-out ${idx * 40}ms both` }}
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(issue.id)}
                      onChange={() => toggle(issue.id)}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-[#61C0FF] cursor-pointer" />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-[#9CA3AF] font-mono">#{issue.id}</span>
                  </td>
                  <td className="px-4 py-3.5 max-w-[220px]">
                    <span className="text-sm text-white group-hover:text-[#61C0FF] transition-colors font-medium truncate block">
                      {issue.title}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-[#9CA3AF]">{issue.category_name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <SevBadge severity={mapSev(issue.severity)} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={mapStatus(issue.status)} />
                  </td>
                  <td className="px-4 py-3.5">
                    {issue.department ? (
                      <span className="text-sm text-[#9CA3AF]">{issue.department}</span>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]/40 italic">Unassigned</span>
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
            <p className="text-white font-semibold mb-1">No issues found</p>
            <p className="text-sm text-[#9CA3AF]">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-[#9CA3AF]">Showing {issues.length} of {total} issues</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let p = i + 1;
              if (totalPages > 5 && page > 3) p = page - 2 + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'}`}>{p}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: ANALYTICS
// ════════════════════════════════════════════════════════════════════════════════
function AnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.analytics().then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#61C0FF]" /></div>;
  }

  const { resolutionTrend, categoryTrend, departmentPerf, deptSatisfaction = [], catSatisfaction = [] } = data;

  const deptData = departmentPerf.map((d: any) => ({
    name: d.department,
    resolved: parseInt(d.resolved),
    pending: parseInt(d.total) - parseInt(d.resolved),
    days: parseFloat(d.avg_hours) / 24 || 0
  }));
  const maxDays = Math.max(...deptData.map((d: any) => d.days), 6);

  const trendData = resolutionTrend.map((t: any) => parseInt(t.resolved) || 0);

  const pieColors: Record<string, string> = {
    'Garbage': '#61C0FF', 'Water': '#F59E0B', 'Parks': '#00FF94', 'Traffic': '#EF4444', 'Buildings': '#8B5CF6', 'Streetlights': '#EC4899', 'Roads': '#06B6D4'
  };
  const pieSlices = categoryTrend.map((c: any) => ({
    value: parseInt(c.total), color: pieColors[c.name] || '#9CA3AF', label: c.name
  }));

  const totalIssues = categoryTrend.reduce((acc: number, c: any) => acc + parseInt(c.total), 0);
  const resolvedIssues = categoryTrend.reduce((acc: number, c: any) => acc + parseInt(c.resolved), 0);
  const resolutionRate = totalIssues ? Math.round((resolvedIssues / totalIssues) * 100) : 0;
  const avgResolutionHours = departmentPerf.reduce((acc: number, d: any) => acc + parseFloat(d.avg_hours || 0), 0) / (departmentPerf.length || 1);

  return (
    <div className="p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Export row */}
      <div className="flex justify-end gap-2">
        <button className="btn-outline flex items-center gap-2 text-sm h-9 px-4">
          <Download size={13} /> Export CSV
        </button>
        <button className="btn-outline flex items-center gap-2 text-sm h-9 px-4">
          <Download size={13} /> Export PDF
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Issues"    value={totalIssues.toString()} sub="All time"  icon={Activity}    color="#61C0FF" subUp={true}  />
        <StatCard label="Resolved"        value={resolvedIssues.toString()}   sub="Issues resolved"  icon={CheckCircle2} color="#00FF94" subUp={true}  />
        <StatCard label="Avg Resolution"  value={`${(avgResolutionHours / 24).toFixed(1)}d`}  sub="Resolution time"         icon={Clock}       color="#61C0FF" subUp={true}  />
        <StatCard label="Resolution Rate" value={`${resolutionRate}%`} sub="Current rate"          icon={TrendingUp}  color="#00FF94" subUp={true}  />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white text-sm">Resolution Trend (Last 30 Days)</h3>
          </div>
          {trendData.length > 0 ? <LineChart data={trendData} color="#61C0FF" /> : <div className="text-[#9CA3AF] text-sm h-20 flex items-center justify-center">No data</div>}
          <p className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#61C0FF] inline-block rounded" /> Issues Resolved
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Issues by Category</h3>
          </div>
          <div className="h-44 flex items-center justify-center">
            {pieSlices.length > 0 ? <PieChart slices={pieSlices} /> : <div className="text-[#9CA3AF] text-sm h-full flex items-center justify-center">No data</div>}
          </div>
        </div>
      </div>

      {/* Department Performance */}
      <div className="card p-5">
        <h3 className="font-semibold text-white text-sm mb-5">Department Performance</h3>
        {deptData.length > 0 ? (
          <div className="flex items-end gap-3 h-44">
            {deptData.map((d: any, i: number) => {
              const maxTotal = Math.max(...deptData.map((x: any) => x.resolved + x.pending));
              return (
                <div key={d.name || i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-0.5 flex-1">
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${(d.pending / maxTotal) * 100}%`,
                        background: '#F59E0B88',
                        minHeight: 4,
                      }}
                    />
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${(d.resolved / maxTotal) * 100}%`,
                        background: 'linear-gradient(180deg, #00FF94 0%, #00FF9488 100%)',
                        minHeight: 4,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[#9CA3AF] text-center leading-tight w-full truncate">{d.name?.split(' ')[0] || 'Unknown'}</span>
                </div>
              );
            })}
          </div>
        ) : <div className="text-[#9CA3AF] text-sm h-44 flex items-center justify-center">No department data</div>}
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]"><span className="w-3 h-2 rounded-sm bg-[#00FF94] inline-block" />Resolved</span>
          <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]"><span className="w-3 h-2 rounded-sm bg-[#F59E0B88] inline-block" />Pending</span>
        </div>
      </div>

      {/* Department Satisfaction Scorecards */}
      {deptSatisfaction.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[#FBBF24]">★</span>
            <h3 className="font-semibold text-white text-sm">Citizen Satisfaction by Department</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptSatisfaction.map((d: any) => {
              const avg = parseFloat(d.avg_rating || '0');
              const isLow = avg < 3;
              const filled = Math.round(avg);
              return (
                <div key={d.department} className={`p-4 rounded-xl border ${isLow ? 'border-[#EF4444]/20 bg-[#EF4444]/5' : 'border-white/5 bg-white/[0.02]'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-white truncate flex-1">{d.department}</span>
                    {isLow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF4444]/10 text-[#EF4444] font-bold border border-[#EF4444]/20 ml-1 shrink-0">LOW</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    {[1,2,3,4,5].map(n => (
                      <svg key={n} width="14" height="14" viewBox="0 0 24 24" fill={n <= filled ? '#FBBF24' : 'none'} stroke={n <= filled ? '#FBBF24' : '#374151'} strokeWidth="2">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    ))}
                    <span className={`text-sm font-bold ml-1 ${isLow ? 'text-[#EF4444]' : 'text-[#FBBF24]'}`}>{avg.toFixed(1)}</span>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF]">{d.review_count} review{parseInt(d.review_count) !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
          {deptSatisfaction.some((d: any) => parseFloat(d.avg_rating) < 3) && (
            <div className="mt-3 px-3 py-2 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-lg">
              <span className="text-[11px] text-[#EF4444]">⚠ Departments below 3.0 stars need attention — citizens report poor resolution quality.</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* SLA Compliance */}
        <div className="card p-5">
          <h3 className="font-semibold text-white text-sm mb-4">SLA Compliance Rate</h3>
          <div className="flex items-center gap-6">
            <DonutChart pct={Math.round((resolvedIssues / (totalIssues || 1)) * 100) || 0} color="#00FF94" label="Resolution rate" />
            <div className="flex-1 space-y-3">
              {[
                { label: 'Resolved',  val: resolvedIssues, color: '#00FF94' },
                { label: 'Pending', val: totalIssues - resolvedIssues,  color: '#EF4444' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                  <span className="text-xs text-[#9CA3AF]">{r.label}</span>
                  <span className="text-xs font-bold text-white ml-auto">{r.val}</span>
                </div>
              ))}
              <p className="text-[10px] text-[#9CA3AF] pt-1 border-t border-white/5">{Math.round((resolvedIssues / (totalIssues || 1)) * 100) || 0}% resolution rate</p>
            </div>
          </div>
        </div>

        {/* Dept Resolution Times */}
        <div className="card p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Department Resolution Times</h3>
          <div className="space-y-3">
            {deptData.map((d: any) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#9CA3AF]">{d.name || 'Unknown'}</span>
                  <span className="text-xs font-semibold text-white">{d.days.toFixed(1)} days</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(d.days / (maxDays || 1)) * 100}%`,
                      background: d.days <= 3 ? '#00FF94' : d.days <= 4.5 ? '#61C0FF' : '#F59E0B',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 px-3 py-2 bg-[#61C0FF]/5 border border-[#61C0FF]/10 rounded-lg flex items-center justify-center gap-2">
            <span className="text-xs text-[#9CA3AF]">Target SLA</span>
            <span className="text-xs font-bold text-[#61C0FF]">5 days</span>
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
        console.error(err);
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
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await adminApi.deleteUser(id);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text" placeholder="Search users by name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-dark pl-9 h-10 text-sm w-full"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-[#05070A]/50 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-[#61C0FF]" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Photo', 'Name', 'Email', 'Role', 'Status', 'Issues', 'Join Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-micro text-[#9CA3AF]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors" style={{ animation: `fadeUp 0.3s ease-out ${idx * 40}ms both` }}>
                  <td className="px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {user.avatar_url ? (
                        <img src={formatMediaUrl(user.avatar_url)} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-[#61C0FF]">{user.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-white">{user.name}</span>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-[#9CA3AF]">{user.email}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-1 rounded border ${user.role === 'admin' ? 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/10' : user.role === 'department_staff' ? 'border-[#00FF94]/30 text-[#00FF94] bg-[#00FF94]/10' : 'border-white/10 text-[#9CA3AF] bg-white/5'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {user.is_active ? <span className="text-xs text-[#00FF94]">Active</span> : <span className="text-xs text-[#EF4444]">Suspended</span>}
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-[#9CA3AF]">{user.issue_count}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-[#9CA3AF]">{new Date(user.created_at).toLocaleDateString()}</span></td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-3">
                      <button onClick={() => openUserModal(user)} className="text-[#61C0FF] hover:text-white transition-colors text-xs">Edit</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-[#EF4444] hover:text-white transition-colors text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-[#9CA3AF]">Showing {users.length} of {total} users</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let p = i + 1;
              if (totalPages > 5 && page > 3) p = page - 2 + i;
              if (p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'}`}>{p}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0D14] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5" style={{ animation: 'fadeUp 0.2s ease-out' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Edit User</h3>
              <button onClick={closeModal} className="text-[#9CA3AF] hover:text-white"><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              {/* Profile Photo selector with ambient design */}
              <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/5">
                <div className="relative group w-20 h-20 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : selectedUser.avatar_url ? (
                    <img src={formatMediaUrl(selectedUser.avatar_url)} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[#61C0FF]">{selectedUser.name?.[0]?.toUpperCase()}</span>
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 cursor-pointer transition-opacity text-white text-[10px] font-semibold">
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
                <span className="text-xs text-[#9CA3AF]">{selectedUser.name}</span>
              </div>

              <div>
                <label className="label-micro mb-2 block">Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="input-dark h-10 w-full text-sm">
                  <option value="citizen">Citizen</option>
                  <option value="department_staff">Department Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 border border-white/5 rounded-lg bg-white/[0.02]">
                <span className="text-sm font-medium">Account Active</span>
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="w-4 h-4 accent-[#61C0FF] bg-transparent border-white/20 rounded cursor-pointer" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeModal} className="btn-outline h-9 px-4 text-sm">Cancel</button>
              <button onClick={handleSaveUser} disabled={modalLoading} className="bg-[#61C0FF] hover:bg-[#61C0FF]/90 text-black h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]">
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
      console.error(err);
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
    <div className="p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Sleek Tab Switcher Bar */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg ${activeTab === 'users' ? 'bg-[#61C0FF] text-black shadow-glow-secondary' : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.03]'}`}
        >
          User Administration Logs
        </button>
        <button
          onClick={() => handleTabChange('issues')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 rounded-lg ${activeTab === 'issues' ? 'bg-[#A855F7] text-white shadow-glow-primary' : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.03]'}`}
        >
          Issue Activity Logs
        </button>
      </div>

      {activeTab === 'issues' ? (
        <div className="space-y-4 relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-[#05070A]/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
              <Loader2 className="animate-spin text-[#A855F7]" />
            </div>
          )}
          
          {groupedLogs.map((group, gIdx) => {
            const isExpanded = !!expandedIssues[group.issueId];
            return (
              <div 
                key={group.issueId} 
                className="card bg-[#0B121F] border border-white/5 overflow-hidden transition-all shadow-md animate-fade_in"
                style={{ animationDelay: `${gIdx * 50}ms` }}
              >
                {/* Expandable Group Header */}
                <div 
                  onClick={() => toggleIssueExpand(group.issueId)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse Chevron Icon */}
                    <span className="text-[#9CA3AF]">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    
                    {/* Clickable Issue Redirect (stopped propagation so it doesn't trigger collapse) */}
                    <a 
                      href={`/issues/${group.issueId}`} 
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()} // Prevent expansion trigger
                      className="flex items-center gap-2 text-sm font-bold text-[#A855F7] hover:text-[#A855F7]/80 hover:underline transition-all group"
                    >
                      <ExternalLink size={13} className="group-hover:scale-110 transition-transform" />
                      <span>{group.issueTitle}</span>
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#9CA3AF] bg-white/5 px-2 py-0.5 rounded-md border border-white/5 font-semibold">
                      {group.items.length} {group.items.length === 1 ? 'log' : 'logs'}
                    </span>
                    <span className="text-[10px] font-mono text-[#9CA3AF] bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                      ID: {group.issueId.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Sub-table: Shown only when expanded */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-black/20 animate-fade_in">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/5">
                            {['Timestamp', 'Performed By', 'Status Transition', 'Details / Note'].map(h => (
                              <th key={h} className="px-3 py-2 text-left label-micro text-[#9CA3AF]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(log => {
                            const action = log.old_status 
                              ? `${log.old_status.toUpperCase()} ➔ ${log.new_status.toUpperCase()}`
                              : `REPORTED`;
                            return (
                              <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
                                <td className="px-3 py-2.5 text-xs text-[#9CA3AF]">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="px-3 py-2.5">
                                  <span className="text-xs text-white font-medium block">{log.admin_name}</span>
                                  <span className="text-[9px] text-[#9CA3AF]">{log.admin_email}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${action.includes('REJECTED') || action.includes('STILL_BROKEN') ? 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/10' : 'border-[#A855F7]/30 text-[#A855F7] bg-[#A855F7]/10'}`}>
                                    {action}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-[#E5E7EB]">{log.details || '—'}</td>
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
            <div className="card p-10 text-center text-[#9CA3AF] text-sm bg-base-800 border border-white/5">No issue activity logs found.</div>
          )}

          {/* Pagination footer for issues logs */}
          <div className="card px-4 py-3 border border-white/5 flex items-center justify-between bg-base-800 shadow-md">
            <span className="text-xs text-[#9CA3AF]">Showing {logs.length} of {total} logs</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-[#A855F7]/10 text-[#A855F7]' : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'}`}>{p}</button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-[#05070A]/50 backdrop-blur-sm flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-[#61C0FF]" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Timestamp', 'Performed By', 'Action Type', 'Target Entity', 'Details / Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left label-micro text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors" style={{ animation: `fadeUp 0.3s ease-out ${idx * 30}ms both` }}>
                    <td className="px-4 py-3.5"><span className="text-xs text-[#9CA3AF]">{new Date(log.created_at).toLocaleString()}</span></td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-white font-medium block">{log.admin_name}</span>
                      <span className="text-[10px] text-[#9CA3AF]">{log.admin_email}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-1 rounded border font-mono ${log.action.includes('DELETE') ? 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/10' : 'border-[#00FF94]/30 text-[#00FF94] bg-[#00FF94]/10'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5"><span className="text-xs text-[#9CA3AF] font-mono">{log.entity_type} #{log.entity_id.slice(0, 8)}</span></td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-[#E5E7EB] block leading-relaxed max-w-[400px] break-words">{log.details ? log.details : '—'}</span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#9CA3AF] text-sm">No audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-[#9CA3AF]">Showing {logs.length} of {total} logs</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) p = page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'}`}>{p}</button>
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
      .catch(err => {
        console.error(err);
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
      console.error(err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin text-[#61C0FF]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="p-6 space-y-6 max-w-4xl" style={{ animation: 'fadeUp 0.35s ease-out' }}>
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">System Settings</h2>
          <p className="text-xs text-[#9CA3AF] mt-1">Configure global application rules, registration preferences, and municipal broadcasts.</p>
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
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-[#61C0FF]/15 flex items-center justify-center">
              <Settings size={15} className="text-[#61C0FF]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">General Platform</h3>
              <p className="text-[10px] text-[#9CA3AF]">Customize public naming and contacts</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Municipality / Platform Name</label>
              <input 
                type="text" 
                value={settings.systemName} 
                onChange={e => setSettings(s => ({ ...s, systemName: e.target.value }))}
                required
                className="w-full h-10 px-3.5 rounded-xl text-xs text-white placeholder-white/20 bg-[#0E131A] border border-white/5 focus:border-[#61C0FF]/30 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Support Contact Email</label>
              <input 
                type="email" 
                value={settings.supportEmail} 
                onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
                required
                className="w-full h-10 px-3.5 rounded-xl text-xs text-white placeholder-white/20 bg-[#0E131A] border border-white/5 focus:border-[#61C0FF]/30 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Community Rules & Automations */}
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-[#00FF94]/15 flex items-center justify-center">
              <Zap size={15} className="text-[#00FF94]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Community & Automation Rules</h3>
              <p className="text-[10px] text-[#9CA3AF]">Submission logic and user privileges</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Auto-Acknowledge Upvote Threshold</label>
                <span className="text-xs font-bold text-[#00FF94] bg-[#00FF94]/10 px-2 py-0.5 rounded-full">{settings.minUpvotesForAutoAcknowledge} upvotes</span>
              </div>
              <p className="text-[10px] text-[#9CA3AF] mb-2 leading-relaxed">Issues receiving this many upvotes will automatically transition to "Acknowledged" status.</p>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={settings.minUpvotesForAutoAcknowledge} 
                onChange={e => setSettings(s => ({ ...s, minUpvotesForAutoAcknowledge: parseInt(e.target.value) }))}
                className="w-full accent-[#00FF94]"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Enable Public Registration</span>
                  <span className="text-[9px] text-[#9CA3AF]">Allow new citizens to sign up on the platform</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enableRegistration: !s.enableRegistration }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableRegistration ? 'bg-[#00FF94]/20 border-[#00FF94]/40' : 'bg-white/5 border-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableRegistration ? 'bg-[#00FF94] translate-x-5' : 'bg-[#9CA3AF] translate-x-0'} shadow-md`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Allow Anonymous Reporting</span>
                  <span className="text-[9px] text-[#9CA3AF]">Citizens can choose to hide their name on issues</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, enableAnonymousReporting: !s.enableAnonymousReporting }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableAnonymousReporting ? 'bg-[#00FF94]/20 border-[#00FF94]/40' : 'bg-white/5 border-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableAnonymousReporting ? 'bg-[#00FF94] translate-x-5' : 'bg-[#9CA3AF] translate-x-0'} shadow-md`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white block">Allow Guest Comments</span>
                  <span className="text-[9px] text-[#9CA3AF]">Allow comments from users without verified profiles</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, allowGuestComments: !s.allowGuestComments }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.allowGuestComments ? 'bg-[#00FF94]/20 border-[#00FF94]/40' : 'bg-white/5 border-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full transition-transform ${settings.allowGuestComments ? 'bg-[#00FF94] translate-x-5' : 'bg-[#9CA3AF] translate-x-0'} shadow-md`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Broadcast Emergency Alert (Span full width) */}
        <div className="card p-6 flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#EF4444]/15 flex items-center justify-center">
                <AlertTriangle size={15} className="text-[#EF4444]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Emergency Broadcast Alert System</h3>
                <p className="text-[10px] text-[#9CA3AF]">Broadcast notices across all citizen dashboard pages</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setSettings(s => ({ ...s, enableAlertBanner: !s.enableAlertBanner }))}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-[3px] border ${settings.enableAlertBanner ? 'bg-[#EF4444]/20 border-[#EF4444]/40' : 'bg-white/5 border-white/10'}`}
            >
              <span className={`w-4 h-4 rounded-full transition-transform ${settings.enableAlertBanner ? 'bg-[#EF4444] translate-x-5' : 'bg-[#9CA3AF] translate-x-0'} shadow-md`} />
            </button>
          </div>

          <div className={`space-y-4 transition-all duration-300 ${settings.enableAlertBanner ? 'opacity-100 max-h-[500px]' : 'opacity-40 pointer-events-none max-h-[500px]'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Broadcast Alert Message</label>
                <textarea 
                  value={settings.alertBannerText}
                  onChange={e => setSettings(s => ({ ...s, alertBannerText: e.target.value }))}
                  required={settings.enableAlertBanner}
                  placeholder="e.g. Due to severe water maintenance, street block 4 will experience low pressure until 5 PM today."
                  rows={3}
                  className="w-full p-3 rounded-xl text-xs text-white placeholder-white/20 bg-[#0E131A] border border-white/5 focus:border-[#EF4444]/30 outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Severity Type</label>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 'info', label: 'Info (Blue)', border: 'border-[#61C0FF]/25', color: '#61C0FF' },
                    { value: 'warning', label: 'Warning (Amber)', border: 'border-[#F59E0B]/25', color: '#F59E0B' },
                    { value: 'critical', label: 'Critical (Crimson)', border: 'border-[#EF4444]/25', color: '#EF4444' }
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, alertBannerType: t.value }))}
                      className={`h-9 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${settings.alertBannerType === t.value ? 'bg-white/5' : 'bg-transparent border-white/5 opacity-55 hover:opacity-100'}`}
                      style={{ borderColor: settings.alertBannerType === t.value ? t.color : '' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                      <span style={{ color: settings.alertBannerType === t.value ? t.color : '#F5F7FA' }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Save Button Footer */}
      <div className="flex justify-end pt-3 gap-3 items-center border-t border-white/5">
        {success && (
          <span className="text-xs font-semibold text-[#00FF94] flex items-center gap-1.5 animate-pulse">
            <CheckCircle2 size={13} />
            Settings saved successfully!
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-6 rounded-xl text-xs font-bold text-[#05070A] transition-all flex items-center gap-2 select-none"
          style={{ 
            background: saving ? 'rgba(97,192,255,0.2)' : 'linear-gradient(135deg,#00aaef,#61C0FF)',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(0,170,239,0.2)',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin text-[#05070A]" />
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
  const { user } = useAuthStore();

  const [view, setView] = useState<AdminView>('dashboard');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (viewParam && ['dashboard', 'issues', 'analytics', 'users', 'logs', 'settings'].includes(viewParam)) {
      // Prevent non-admin staff from accessing restricted views
      if (['users', 'logs', 'settings'].includes(viewParam) && user?.role !== 'admin') {
        setView('dashboard');
      } else {
        setView(viewParam);
      }
    } else {
      setView('dashboard');
    }
  }, [viewParam, user]);

  const handleSetView = (newView: AdminView) => {
    setView(newView);
    router.push(`/admin?view=${newView}`);
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex min-h-screen bg-base-950">
        <Sidebar />

        <main className="flex-1 ml-64 min-h-screen relative overflow-hidden flex flex-col">
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
            {view === 'analytics'  && <AnalyticsView />}
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
