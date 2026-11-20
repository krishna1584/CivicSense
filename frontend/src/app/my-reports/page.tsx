'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { usersApi } from '@/lib/api';
import { Issue, IssueStatus } from '@/types';
import { IssueCard, IssueRow } from '@/components/ui/IssueCard';
import { STATUS_META, STATUS_ORDER } from '@/components/ui/StatusBadge';
import { FilterChip, SearchInput, SelectInput, ViewToggle } from '@/components/ui/Controls';
import { FileText, Loader2, AlertTriangle, RefreshCw, Plus, Search, X, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'upvotes', label: 'Most Upvoted' },
];

function StatPill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-5 py-3.5">
      <span className={clsx('text-xl font-black', className)}>{value}</span>
      <span className="text-[10px] text-content-secondary uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

export default function MyReportsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<IssueStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
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
    const query = search.trim().toLowerCase();
    const result = issues.filter(i =>
      (activeStatus === 'all' || i.status === activeStatus) &&
      (!query || i.title.toLowerCase().includes(query) || i.description?.toLowerCase().includes(query))
    );
    const time = (i: Issue) => new Date(i.created_at).getTime();
    if (sort === 'oldest') result.sort((a, b) => time(a) - time(b));
    else if (sort === 'upvotes') result.sort((a, b) => b.upvote_count - a.upvote_count);
    else result.sort((a, b) => time(b) - time(a));
    return result;
  }, [issues, activeStatus, search, sort]);

  const count = (status: IssueStatus) => issues.filter(i => i.status === status).length;
  const resolved = count('resolved');

  return (
    <AppLayout
      title="My Reports"
      sub={`${total} issue${total !== 1 ? 's' : ''} submitted`}
      headerActions={
        <Link href="/report" aria-label="New Report" className="btn-accent text-xs py-2 px-3 sm:px-4 gap-2">
          <Plus size={14} /> <span className="hidden sm:inline">New Report</span>
        </Link>
      }
    >
      <div className="pt-4">
        {!loading && issues.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatPill label="Total" value={issues.length} className="text-accent-primary" />
            <StatPill label="Resolved" value={resolved} className="text-state-success" />
            <StatPill label="In Progress" value={count('in_progress')} className="text-state-warning" />
            <StatPill label="Waiting" value={count('reported') + count('acknowledged') + count('pending_verification')} className="text-content-secondary" />
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search your reports" className="basis-full sm:basis-0 sm:flex-1" />
          <SelectInput value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort reports" />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          <FilterChip active={activeStatus === 'all'} onClick={() => setActiveStatus('all')}>
            All <span className="opacity-60">({issues.length})</span>
          </FilterChip>
          {STATUS_ORDER.map(s => (
            <FilterChip key={s} active={activeStatus === s} onClick={() => setActiveStatus(s)}
              activeClass={STATUS_META[s].badge} dotClass={STATUS_META[s].dot}>
              {STATUS_META[s].label} <span className="opacity-60">({count(s)})</span>
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 size={32} className="animate-spin text-accent-primary" />
            <p className="text-content-secondary text-sm">Loading your reports…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-2xl bg-state-error/5 border border-state-error/15">
            <AlertTriangle size={32} className="text-state-error" />
            <div className="text-center">
              <p className="text-content-primary font-semibold">Failed to load</p>
              <p className="text-content-secondary text-sm mt-1">{error}</p>
            </div>
            <button onClick={fetchIssues} className="btn-secondary text-sm gap-2"><RefreshCw size={14} /> Try Again</button>
          </div>
        ) : issues.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-64 gap-4 p-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-accent-primary/10">
              <FileText size={28} className="text-accent-primary" />
            </div>
            <div className="text-center">
              <p className="text-content-primary font-semibold">No reports yet</p>
              <p className="text-content-secondary text-sm mt-1">Be the first to report a civic issue in your community.</p>
            </div>
            <Link href="/report" className="btn-accent text-sm gap-2"><Plus size={15} /> Report Your First Issue</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 gap-3 p-6">
            <Search size={28} className="text-content-secondary" />
            <div className="text-center">
              <p className="text-content-primary font-semibold text-sm">No matches found</p>
              <p className="text-content-secondary text-xs mt-1">Try adjusting your filters or search terms.</p>
            </div>
            <button onClick={() => { setSearch(''); setActiveStatus('all'); }} className="text-xs text-accent-primary inline-flex items-center gap-1 hover:underline">
              <X size={11} /> Clear filters
            </button>
          </div>
        ) : (
          <>
            <p className="text-content-secondary text-xs mb-4">Showing <span className="text-content-primary font-semibold">{filtered.length}</span> of {issues.length} reports</p>
            {viewMode === 'grid' ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(issue => <IssueRow key={issue.id} issue={issue} />)}
              </div>
            )}
          </>
        )}

        {!loading && resolved > 0 && (
          <div className="mt-8 p-5 rounded-2xl flex items-center gap-4 bg-state-success/5 border border-state-success/15">
            <CheckCircle2 size={24} className="text-state-success shrink-0" />
            <div>
              <p className="text-content-primary font-semibold text-sm">{resolved} of your report{resolved !== 1 ? 's' : ''} resolved</p>
              <p className="text-content-secondary text-xs mt-0.5">Thank you for helping fix your community.</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
