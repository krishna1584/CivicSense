'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Filter, MapPin, ThumbsUp, MessageSquare,
  Clock, Zap, LayoutGrid, List, ChevronDown,
  TrendingUp, Flame, Sparkles, AlertTriangle,
  Users, Eye, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Rejected';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  category_icon: string;
  status: Status;
  severity: Severity;
  address: string;
  upvote_count: number;
  comment_count: number;
  follow_count: number;
  created_at: string;
  author: string;
  image?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ISSUES: Issue[] = [
  {
    id: '1',
    title: 'Faded stop sign at school crossing',
    description: 'The stop sign at the elementary school crossing is severely faded and barely visible, posing a serious safety hazard for children.',
    category: 'Traffic', category_icon: '🚦',
    status: 'Reported', severity: 'High',
    address: '6 Lincoln Elementary',
    upvote_count: 118, comment_count: 31, follow_count: 44,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 46).toISOString(),
    author: 'Nathan Micheal',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  },
  {
    id: '2',
    title: 'Illegal dumping on vacant lot',
    description: 'Large debris and household waste has been dumped from Street Regency dumpster on vacant lot at 201.',
    category: 'Garbage', category_icon: '🗑️',
    status: 'Acknowledged', severity: 'Medium',
    address: '201 Cedar Street',
    upvote_count: 41, comment_count: 7, follow_count: 19,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 130).toISOString(),
    author: 'Nicole Lee',
    image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&q=80',
  },
  {
    id: '3',
    title: 'Water main leak on Oak Street',
    description: 'Significant water leak detected on Oak Street between 2nd and 3rd blocks. Water is pooling in the street.',
    category: 'Water', category_icon: '💧',
    status: 'In Progress', severity: 'Critical',
    address: 'Oak Street, Block 2',
    upvote_count: 196, comment_count: 38, follow_count: 88,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    author: 'Andy Rodriguez',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80',
  },
  {
    id: '4',
    title: 'Overflowing garbage bins at City Park',
    description: 'Multiple garbage bins at the north entrance of City Park are overflowing. This is attracting pests.',
    category: 'Garbage', category_icon: '🗑️',
    status: 'Rejected', severity: 'Medium',
    address: 'City Park North #6',
    upvote_count: 82, comment_count: 34, follow_count: 27,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    author: 'William Chan',
    image: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=600&q=80',
  },
  {
    id: '5',
    title: 'Broken streetlight on Park Avenue',
    description: 'The streetlight at 122 Park Avenue has been out for over a week, creating a safety hazard for pedestrians at night.',
    category: 'Electricity', category_icon: '⚡',
    status: 'Acknowledged', severity: 'Medium',
    address: '122 Park Avenue',
    upvote_count: 28, comment_count: 6, follow_count: 14,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
    author: 'Isaac Johnson',
    image: 'https://images.unsplash.com/photo-1520052205864-92d242b3a76b?w=600&q=80',
  },
  {
    id: '6',
    title: 'Damaged playground equipment',
    description: 'The swing set at Riverside Park has broken chains creating safety concerns for children. Needs urgent attention.',
    category: 'Parks', category_icon: '🌳',
    status: 'Acknowledged', severity: 'High',
    address: 'Riverside Park, About 1/2',
    upvote_count: 54, comment_count: 15, follow_count: 31,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 310).toISOString(),
    author: 'Diana Kim',
    image: 'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&q=80',
  },
  {
    id: '7',
    title: 'Large pothole on Main Street',
    description: 'There\'s a dangerous pothole near the intersection of Main St and 5th Ave that has caused multiple car incidents.',
    category: 'Roads', category_icon: '🛣️',
    status: 'In Progress', severity: 'High',
    address: 'Main St & 5th Ave',
    upvote_count: 67, comment_count: 22, follow_count: 45,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    author: 'John Doe',
    image: 'https://images.unsplash.com/photo-1515162305285-0293e4b4e81e?w=600&q=80',
  },
  {
    id: '8',
    title: 'Graffiti on community center wall',
    description: 'Large graffiti vandalism on the south wall of the community center. Offensive content visible from the street.',
    category: 'Vandalism', category_icon: '🎨',
    status: 'Resolved', severity: 'Low',
    address: 'Community Center, 413',
    upvote_count: 23, comment_count: 8, follow_count: 11,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 720).toISOString(),
    author: 'Lisa Martinez',
    image: 'https://images.unsplash.com/photo-1533073526757-2c8ca1df9f1c?w=600&q=80',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  Reported:     { label: 'Reported',     color: 'text-[#9CA3AF]',  bg: 'bg-white/5',          dot: 'bg-[#9CA3AF]' },
  Acknowledged: { label: 'Acknowledged', color: 'text-[#61C0FF]',  bg: 'bg-[#61C0FF]/10',     dot: 'bg-[#61C0FF]' },
  'In Progress':{ label: 'In Progress',  color: 'text-[#F59E0B]',  bg: 'bg-[#F59E0B]/10',     dot: 'bg-[#F59E0B]' },
  Resolved:     { label: 'Resolved',     color: 'text-[#00FF94]',  bg: 'bg-[#00FF94]/10',     dot: 'bg-[#00FF94]' },
  Rejected:     { label: 'Rejected',     color: 'text-[#EF4444]',  bg: 'bg-[#EF4444]/10',     dot: 'bg-[#EF4444]' },
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string }> = {
  Critical: { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10' },
  High:     { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
  Medium:   { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/10' },
  Low:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5' },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.color} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${cfg.color} ${cfg.bg}`}>
      {severity}
    </span>
  );
}

function IssueCard({ issue, index }: { issue: Issue; index: number }) {
  return (
    <Link href={`/issues/${issue.id}`}>
      <article
        className="card card-hover group cursor-pointer overflow-hidden flex flex-col"
        style={{ animationDelay: `${index * 60}ms`, animation: 'fadeUp 0.4s ease-out both' }}
      >
        {/* Image */}
        {issue.image && (
          <div className="relative h-44 overflow-hidden bg-[#0E131A]">
            <img
              src={issue.image}
              alt={issue.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
            />
            {/* Status overlay */}
            <div className="absolute top-3 right-3">
              <StatusBadge status={issue.status} />
            </div>
            {/* Gradient fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          {/* Category + Severity */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">{issue.category_icon}</span>
            <span className="label-micro text-[#9CA3AF]">{issue.category}</span>
            <span className="ml-auto">
              <SeverityBadge severity={issue.severity} />
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-white text-[15px] leading-snug group-hover:text-[#61C0FF] transition-colors duration-200 line-clamp-2 mb-2">
            {issue.title}
          </h3>

          {/* Description */}
          <p className="text-[#9CA3AF] text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
            {issue.description}
          </p>

          {/* Location */}
          {issue.address && (
            <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs mb-4">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{issue.address}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-3 text-[#9CA3AF] text-xs">
              <span className="flex items-center gap-1 hover:text-[#61C0FF] transition-colors">
                <ThumbsUp size={11} />
                {issue.upvote_count}
              </span>
              <span className="flex items-center gap-1 hover:text-[#61C0FF] transition-colors">
                <MessageSquare size={11} />
                {issue.comment_count}
              </span>
              <span className="flex items-center gap-1 hover:text-[#61C0FF] transition-colors">
                <Users size={11} />
                {issue.follow_count}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[#9CA3AF] text-[11px]">
              <Clock size={10} />
              <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
            </div>
          </div>

          {/* Author */}
          <div className="mt-2 text-[11px] text-[#9CA3AF]/60">
            by <span className="text-[#9CA3AF]">{issue.author}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function IssueRow({ issue, index }: { issue: Issue; index: number }) {
  return (
    <Link href={`/issues/${issue.id}`}>
      <article
        className="card card-hover group cursor-pointer p-4 flex items-center gap-4"
        style={{ animationDelay: `${index * 40}ms`, animation: 'fadeUp 0.3s ease-out both' }}
      >
        {issue.image && (
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#0E131A]">
            <img src={issue.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{issue.category_icon}</span>
            <span className="label-micro text-[#9CA3AF]">{issue.category}</span>
          </div>
          <h3 className="font-semibold text-white text-sm group-hover:text-[#61C0FF] transition-colors truncate">{issue.title}</h3>
          <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs mt-1">
            <MapPin size={10} />
            <span className="truncate">{issue.address}</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
        </div>
        <div className="hidden lg:flex items-center gap-4 text-[#9CA3AF] text-xs shrink-0 ml-2">
          <span className="flex items-center gap-1"><ThumbsUp size={11} />{issue.upvote_count}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
        </div>
      </article>
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',     icon: LayoutGrid },
  { href: '/report',      label: 'Report Issues', icon: AlertTriangle },
  { href: '/my-reports',  label: 'My Reports',    icon: Eye },
  { href: '/notifications', label: 'Notifications', icon: Zap },
  { href: '/explore',     label: 'Explore',       icon: Search,  active: true },
  { href: '/profile',     label: 'Profile',       icon: Users },
];

function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/5 bg-[#05070A] min-h-screen fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#61C0FF]/20 flex items-center justify-center">
            <Zap size={14} className="text-[#61C0FF]" />
          </div>
          <span className="font-bold text-base">Civic<span className="text-[#61C0FF]">Sense</span></span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href}>
            <div className={`sidebar-item ${active ? 'active' : ''}`}>
              <Icon size={16} />
              <span className="text-sm font-medium">{label}</span>
            </div>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-[#61C0FF]/20 flex items-center justify-center text-xs font-bold text-[#61C0FF]">JD</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">John Doe</div>
            <div className="text-[10px] text-[#9CA3AF] truncate">john@doe.com</div>
          </div>
          {/* <Settings size={13} className="text-[#9CA3AF]" /> */}
        </div>
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = ['Most Recent', 'Most Upvoted', 'Most Commented', 'Near Me'];
const STATUS_FILTERS: (Status | 'All')[] = ['All', 'Reported', 'Acknowledged', 'In Progress', 'Resolved', 'Rejected'];
const CATEGORY_FILTERS = ['All', 'Roads', 'Water', 'Traffic', 'Garbage', 'Electricity', 'Parks', 'Vandalism'];

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Most Recent');
  const [activeStatus, setActiveStatus] = useState<Status | 'All'>('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter logic
  const filtered = MOCK_ISSUES.filter((issue) => {
    const matchSearch =
      !search ||
      issue.title.toLowerCase().includes(search.toLowerCase()) ||
      issue.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = activeStatus === 'All' || issue.status === activeStatus;
    const matchCategory = activeCategory === 'All' || issue.category === activeCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'Most Upvoted') return b.upvote_count - a.upvote_count;
    if (sort === 'Most Commented') return b.comment_count - a.comment_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      {/* Inject keyframe */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-[#05070A] text-white flex">
        <Sidebar />

        {/* Main */}
        <main className="flex-1 md:ml-56 min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-30 glass-panel border-b border-white/5 px-6 h-16 flex items-center justify-between gap-4">
            <div>
              <h1 className="font-bold text-base text-white">Explore Issues</h1>
              <p className="text-[11px] text-[#9CA3AF]">Browse and track community issues</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification */}
              <button className="relative w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Zap size={14} className="text-[#9CA3AF]" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-[9px] font-bold flex items-center justify-center">3</span>
              </button>
              {/* Avatar */}
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-[#61C0FF]/20 flex items-center justify-center text-xs font-bold text-[#61C0FF]">JD</div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-tight">John Doe</div>
                  <div className="text-[10px] text-[#9CA3AF]">0.5 km away</div>
                </div>
              </div>
            </div>
          </header>

          <div className="p-6">
            {/* Search + Controls row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search issues..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-dark pl-9 h-10 text-sm w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="input-dark h-10 text-sm appearance-none pr-8 pl-4 cursor-pointer min-w-[140px]"
                >
                  {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              </div>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`btn-outline h-10 flex items-center gap-2 text-sm px-4 ${showFilters ? 'border-[#61C0FF]/40 text-[#61C0FF]' : ''}`}
              >
                <Filter size={14} />
                Filters
              </button>

              {/* View toggle */}
              <div className="flex gap-1 bg-[#0B0F14] border border-white/5 rounded-xl p-1 h-10">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 rounded-lg transition-all text-sm flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:text-white'}`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 rounded-lg transition-all text-sm flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-[#61C0FF]/10 text-[#61C0FF]' : 'text-[#9CA3AF] hover:text-white'}`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
              <div className="card p-4 mb-5 space-y-4 animate-fade_in">
                {/* Status */}
                <div>
                  <p className="label-micro mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map(s => (
                      <button
                        key={s}
                        onClick={() => setActiveStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          activeStatus === s
                            ? 'border-[#61C0FF]/40 bg-[#61C0FF]/10 text-[#61C0FF]'
                            : 'border-white/5 text-[#9CA3AF] hover:border-white/10 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Category */}
                <div>
                  <p className="label-micro mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_FILTERS.map(c => (
                      <button
                        key={c}
                        onClick={() => setActiveCategory(c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          activeCategory === c
                            ? 'border-[#61C0FF]/40 bg-[#61C0FF]/10 text-[#61C0FF]'
                            : 'border-white/5 text-[#9CA3AF] hover:border-white/10 hover:text-white'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#9CA3AF] text-sm">
                Showing <span className="text-white font-semibold">{sorted.length}</span> of{' '}
                <span className="text-white font-semibold">{MOCK_ISSUES.length}</span> issues
              </p>
              {(activeStatus !== 'All' || activeCategory !== 'All' || search) && (
                <button
                  onClick={() => { setActiveStatus('All'); setActiveCategory('All'); setSearch(''); }}
                  className="text-xs text-[#61C0FF] hover:text-white transition-colors flex items-center gap-1"
                >
                  <X size={11} /> Clear filters
                </button>
              )}
            </div>

            {/* Issue Grid / List */}
            {sorted.length === 0 ? (
              <div className="text-center py-24 text-[#9CA3AF]">
                <Search size={40} className="mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-white mb-1">No issues found</p>
                <p className="text-sm">Try adjusting your filters or search terms</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map((issue, i) => (
                  <IssueCard key={issue.id} issue={issue} index={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((issue, i) => (
                  <IssueRow key={issue.id} issue={issue} index={i} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
