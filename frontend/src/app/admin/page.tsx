'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, List, BarChart2, Settings, Zap, Bell,
  Moon, Sun, TrendingUp, TrendingDown, AlertTriangle, Clock,
  ThumbsUp, MessageSquare, Search, Filter, ChevronDown,
  Download, Eye, CheckCircle2, XCircle, Loader2, Users,
  Activity, ArrowUpRight, MapPin, ChevronRight, X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Rejected';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type AdminView = 'dashboard' | 'issues' | 'analytics' | 'settings';

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

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const ALL_ISSUES: Issue[] = [
  { id: 1, title: 'Large pothole on Main Street',         category: 'Roads',       severity: 'High',     status: 'In Progress',  department: 'Public Works',       upvotes: 156, comments: 38, created_at: '5d ago', image: 'https://images.unsplash.com/photo-1515162305285-0293e4b4e81e?w=80&q=70' },
  { id: 2, title: 'Broken streetlight on Park Avenue',    category: 'Streetlights',severity: 'Medium',   status: 'Acknowledged', department: 'Utilities',          upvotes: 28,  comments: 8,  created_at: '3d ago', image: 'https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=80&q=70' },
  { id: 3, title: 'Overflowing garbage bins at City Park',category: 'Garbage',     severity: 'High',     status: 'Reported',     department: '—',                  upvotes: 92,  comments: 24, created_at: '2d ago', image: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=80&q=70' },
  { id: 4, title: 'Water main leak on Oak Street',        category: 'Water',       severity: 'Critical', status: 'In Progress',  department: 'Water Authority',    upvotes: 196, comments: 38, created_at: '1d ago', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=80&q=70' },
  { id: 5, title: 'Damaged playground equipment',         category: 'Parks',       severity: 'High',     status: 'Acknowledged', department: 'Parks & Recreation', upvotes: 54,  comments: 15, created_at: '4d ago', image: 'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=80&q=70' },
  { id: 6, title: 'Graffiti on community center wall',    category: 'Buildings',   severity: 'Medium',   status: 'Resolved',     department: 'Building Maintenance',upvotes: 23, comments: 8,  created_at: '7d ago', image: 'https://images.unsplash.com/photo-1533073526757-2c8ca1df9f1c?w=80&q=70' },
  { id: 7, title: 'Faded stop sign at school crossing',   category: 'Traffic',     severity: 'High',     status: 'Reported',     department: '—',                  upvotes: 118, comments: 31, created_at: '6h ago', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=80&q=70' },
  { id: 8, title: 'Illegal dumping on vacant lot',        category: 'Garbage',     severity: 'Medium',   status: 'Acknowledged', department: 'Sanitation',         upvotes: 41,  comments: 7,  created_at: '2d ago', image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=80&q=70' },
];

// ─── Badge configs ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Status, { color: string; bg: string; dot: string }> = {
  Reported:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5',       dot: 'bg-[#9CA3AF]' },
  Acknowledged:  { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/10',  dot: 'bg-[#61C0FF]' },
  'In Progress': { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10',  dot: 'bg-[#F59E0B]' },
  Resolved:      { color: 'text-[#00FF94]', bg: 'bg-[#00FF94]/10',  dot: 'bg-[#00FF94]' },
  Rejected:      { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10',  dot: 'bg-[#EF4444]' },
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
function BarChart({ data, color = '#61C0FF' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const labels = ['Roads', 'Garbage', 'Parks', 'Traffic', 'Water', 'Lights', 'Buildings'];
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
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
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

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function AdminSidebar({ view, setView }: { view: AdminView; setView: (v: AdminView) => void }) {
  const nav = [
    { key: 'dashboard' as AdminView, label: 'Dashboard',        icon: LayoutDashboard },
    { key: 'issues'    as AdminView, label: 'Issue Management',  icon: List },
    { key: 'analytics' as AdminView, label: 'Analytics',         icon: BarChart2 },
    { key: 'settings'  as AdminView, label: 'Settings',          icon: Settings },
  ];
  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-white/5 bg-[#05070A] fixed left-0 top-0 bottom-0 z-40">
      <div className="h-14 flex items-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#61C0FF]/20 flex items-center justify-center">
            <Zap size={13} className="text-[#61C0FF]" />
          </div>
          <span className="font-bold text-sm">Civic<span className="text-[#61C0FF]">Sense</span></span>
        </div>
      </div>
      <nav className="flex-1 p-2.5 space-y-0.5 pt-4">
        {nav.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)} className={`sidebar-item w-full text-left ${view === key ? 'active' : ''}`}>
            <Icon size={15} />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ title, sub, darkMode, toggleDark }: { title: string; sub: string; darkMode: boolean; toggleDark: () => void }) {
  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-white/5 h-14 flex items-center px-6 gap-4">
      <div className="flex-1">
        <h1 className="font-bold text-base text-white leading-tight">{title}</h1>
        <p className="text-[10px] text-[#9CA3AF]">{sub}</p>
      </div>
      <button onClick={toggleDark} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
        {darkMode ? <Sun size={14} className="text-[#9CA3AF]" /> : <Moon size={14} className="text-[#9CA3AF]" />}
      </button>
      <button className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
        <Bell size={14} className="text-[#9CA3AF]" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-[9px] font-bold flex items-center justify-center">3</span>
      </button>
      <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-[#61C0FF]/20 flex items-center justify-center text-xs font-bold text-[#61C0FF]">AU</div>
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-white leading-tight">Admin User</div>
          <div className="text-[10px] text-[#9CA3AF]">Admin</div>
        </div>
      </div>
    </header>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ════════════════════════════════════════════════════════════════════════════════
function DashboardView({ setView }: { setView: (v: AdminView) => void }) {
  const criticalIssues = ALL_ISSUES.filter(i => i.severity === 'Critical' || (i.severity === 'High' && i.status !== 'Resolved')).slice(0, 3);
  const recentIssues = [...ALL_ISSUES].sort(() => 0).slice(0, 3);

  return (
    <div className="p-6 space-y-6" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Issues"    value="1,247" sub="All time"                  icon={Activity}    color="#61C0FF"  delay={0} />
        <StatCard label="Open Issues"     value="355"   sub="Requires attention"        icon={AlertTriangle} color="#F59E0B" subUp={false} delay={1} />
        <StatCard label="Avg Resolution"  value="4.2d"  sub="↑ 12% from last month"    icon={Clock}       color="#00FF94"  subUp={true}  delay={2} />
        <StatCard label="SLA Breaches"    value="23"    sub="Needs attention"           icon={XCircle}     color="#EF4444"  subUp={false} delay={3} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Issues by Category</h3>
            <span className="label-micro text-[#9CA3AF]">This month</span>
          </div>
          <div className="h-52">
            <BarChart data={[22, 18, 14, 12, 10, 9, 8]} color="#61C0FF" />
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Status Distribution</h3>
            <span className="label-micro text-[#9CA3AF]">Live</span>
          </div>
          <div className="flex items-center justify-center h-52">
            <PieChart slices={[
              { value: 155, color: '#F59E0B', label: 'In progress' },
              { value: 89,  color: '#61C0FF', label: 'Acknowledged' },
              { value: 67,  color: '#9CA3AF', label: 'Reported' },
              { value: 44,  color: '#00FF94', label: 'Resolved' },
            ]} />
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
            {criticalIssues.map(issue => (
              <div key={issue.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0E131A] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <img src={issue.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#61C0FF] transition-colors">{issue.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                    <span className="flex items-center gap-1"><ThumbsUp size={10} />{issue.upvotes}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} />{issue.comments}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{issue.created_at}</span>
                  </div>
                </div>
                <StatusBadge status={issue.status} />
              </div>
            ))}
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
            {recentIssues.map(issue => (
              <div key={issue.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0E131A] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group">
                <img src={issue.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#61C0FF] transition-colors">
                    {issue.title.split(' ').slice(0, 2).join(' ')}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[#9CA3AF] text-xs">
                    <span className="flex items-center gap-1"><ThumbsUp size={10} />{issue.upvotes}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} />{issue.comments}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{issue.created_at}</span>
                  </div>
                </div>
                <StatusBadge status={issue.status} />
              </div>
            ))}
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
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'All'>('All');
  const [filterSev, setFilterSev] = useState<Severity | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const filtered = ALL_ISSUES.filter(i => {
    const s = search.toLowerCase();
    const matchSearch = !s || i.title.toLowerCase().includes(s) || i.category.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'All' || i.status === filterStatus;
    const matchSev = filterSev === 'All' || i.severity === filterSev;
    return matchSearch && matchStatus && matchSev;
  });

  const toggle = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(p => p.length === filtered.length ? [] : filtered.map(i => i.id));

  return (
    <div className="p-6 space-y-5" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text" placeholder="Search issues..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-dark pl-9 h-10 text-sm w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
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
              {(['All', 'Reported', 'Acknowledged', 'In Progress', 'Resolved', 'Rejected'] as (Status | 'All')[]).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
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
                <button key={s} onClick={() => setFilterSev(s)}
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
          {['Acknowledge', 'Mark In Progress', 'Resolve', 'Reject'].map(a => (
            <button key={a} className="btn-outline text-xs py-1 px-3 h-7">{a}</button>
          ))}
          <button onClick={() => setSelected([])} className="text-[#9CA3AF] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-[#61C0FF] cursor-pointer" />
                </th>
                {['ID', 'Title', 'Category', 'Severity', 'Status', 'Department'].map(h => (
                  <th key={h} className="px-4 py-3 text-left label-micro text-[#9CA3AF]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, idx) => (
                <tr
                  key={issue.id}
                  className={`border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer group ${selected.includes(issue.id) ? 'bg-[#61C0FF]/5' : ''}`}
                  style={{ animation: `fadeUp 0.3s ease-out ${idx * 40}ms both` }}
                >
                  <td className="px-4 py-3.5">
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
                    <span className="text-sm text-[#9CA3AF]">{issue.category}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <SevBadge severity={issue.severity} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={issue.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-[#9CA3AF]">{issue.department}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <Search size={28} className="mx-auto mb-3 opacity-10" />
            <p className="text-white font-semibold mb-1">No issues found</p>
            <p className="text-sm text-[#9CA3AF]">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-[#9CA3AF]">Showing {filtered.length} of {ALL_ISSUES.length} issues</span>
          <div className="flex gap-1">
            {[1, 2, 3].map(p => (
              <button key={p} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === 1 ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'}`}>{p}</button>
            ))}
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
  const deptData = [
    { name: 'Public Works',    resolved: 38, pending: 12, days: 3.5 },
    { name: 'Utilities',       resolved: 29, pending: 8,  days: 4.2 },
    { name: 'Sanitation',      resolved: 41, pending: 6,  days: 2.8 },
    { name: 'Water Authority', resolved: 18, pending: 14, days: 5.1 },
    { name: 'Parks & Rec',     resolved: 22, pending: 9,  days: 4.8 },
  ];
  const maxDays = 6;

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
        <StatCard label="Total Issues"    value="1,247" sub="↑ 10% from last week"  icon={Activity}    color="#61C0FF" subUp={true}  />
        <StatCard label="Resolved"        value="892"   sub="↑ 4% resolution rate"  icon={CheckCircle2} color="#00FF94" subUp={true}  />
        <StatCard label="Avg Resolution"  value="4.2d"  sub="↑ 12% faster"         icon={Clock}       color="#61C0FF" subUp={true}  />
        <StatCard label="Resolution Rate" value="71.5%" sub="Above target"          icon={TrendingUp}  color="#00FF94" subUp={true}  />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white text-sm">Resolution Time Trend</h3>
          </div>
          <LineChart data={[5.8, 5.1, 4.9, 4.6, 4.3, 4.2]} color="#61C0FF" />
          <p className="text-[11px] text-[#9CA3AF] mt-2 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#61C0FF] inline-block rounded" /> Avg Days to Resolve
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Issues by Category</h3>
          </div>
          <PieChart slices={[
            { value: 3, color: '#61C0FF', label: 'Garbage' },
            { value: 2, color: '#F59E0B', label: 'Water' },
            { value: 1, color: '#00FF94', label: 'Parks' },
            { value: 1, color: '#EF4444', label: 'Traffic' },
            { value: 1, color: '#8B5CF6', label: 'Buildings' },
            { value: 1, color: '#EC4899', label: 'Streetlights' },
            { value: 1, color: '#06B6D4', label: 'Roads' },
          ]} />
        </div>
      </div>

      {/* Department Performance */}
      <div className="card p-5">
        <h3 className="font-semibold text-white text-sm mb-5">Department Performance</h3>
        <div className="flex items-end gap-3 h-44">
          {deptData.map((d, i) => {
            const total = d.resolved + d.pending;
            const maxTotal = Math.max(...deptData.map(x => x.resolved + x.pending));
            return (
              <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
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
                <span className="text-[9px] text-[#9CA3AF] text-center leading-tight w-full truncate">{d.name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]"><span className="w-3 h-2 rounded-sm bg-[#00FF94] inline-block" />Resolved</span>
          <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]"><span className="w-3 h-2 rounded-sm bg-[#F59E0B88] inline-block" />Pending</span>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* SLA Compliance */}
        <div className="card p-5">
          <h3 className="font-semibold text-white text-sm mb-4">SLA Compliance Rate</h3>
          <div className="flex items-center gap-6">
            <DonutChart pct={92} color="#00FF94" label="On-time resolution rate" />
            <div className="flex-1 space-y-3">
              {[
                { label: 'On Time',  val: 849, color: '#00FF94' },
                { label: 'Breached', val: 43,  color: '#EF4444' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                  <span className="text-xs text-[#9CA3AF]">{r.label}</span>
                  <span className="text-xs font-bold text-white ml-auto">{r.val}</span>
                </div>
              ))}
              <p className="text-[10px] text-[#9CA3AF] pt-1 border-t border-white/5">92.6% on-time resolution rate</p>
            </div>
          </div>
        </div>

        {/* Dept Resolution Times */}
        <div className="card p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Department Resolution Times</h3>
          <div className="space-y-3">
            {deptData.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#9CA3AF]">{d.name}</span>
                  <span className="text-xs font-semibold text-white">{d.days} days</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(d.days / maxDays) * 100}%`,
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
// VIEW: SETTINGS (placeholder)
// ════════════════════════════════════════════════════════════════════════════════
function SettingsView() {
  return (
    <div className="p-6 space-y-4" style={{ animation: 'fadeUp 0.3s ease-out' }}>
      <div className="card p-8 text-center">
        <Settings size={36} className="mx-auto mb-4 opacity-10" />
        <p className="font-semibold text-white mb-1">Settings</p>
        <p className="text-sm text-[#9CA3AF]">Admin configuration panel — coming soon</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════════
const VIEW_META: Record<AdminView, { title: string; sub: string }> = {
  dashboard: { title: 'Admin Dashboard',   sub: 'City Command Center – Monitor and manage all issues' },
  issues:    { title: 'Issue Management',  sub: 'Manage and resolve reported issues' },
  analytics: { title: 'Analytics',         sub: 'Insights and performance metrics' },
  settings:  { title: 'Settings',          sub: 'Platform configuration' },
};

export default function AdminDashboard() {
  const [view, setView] = useState<AdminView>('dashboard');
  const [darkMode, setDarkMode] = useState(true);

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-[#05070A] text-white flex">
        <AdminSidebar view={view} setView={setView} />

        <main className="flex-1 md:ml-52 min-h-screen flex flex-col">
          <TopBar
            title={VIEW_META[view].title}
            sub={VIEW_META[view].sub}
            darkMode={darkMode}
            toggleDark={() => setDarkMode(v => !v)}
          />

          <div className="flex-1 overflow-y-auto">
            {view === 'dashboard'  && <DashboardView setView={setView} />}
            {view === 'issues'     && <IssueManagementView />}
            {view === 'analytics'  && <AnalyticsView />}
            {view === 'settings'   && <SettingsView />}
          </div>
        </main>
      </div>
    </>
  );
}
