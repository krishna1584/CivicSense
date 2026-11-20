'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { issuesApi } from '@/lib/api';
import { Category, Issue } from '@/types';
import { IssueCard, IssueRow } from '@/components/ui/IssueCard';
import { STATUS_META, STATUS_ORDER } from '@/components/ui/StatusBadge';
import { FilterChip, SearchInput, SelectInput, ViewToggle } from '@/components/ui/Controls';
import { AlertTriangle, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Most Recent' },
  { value: 'upvotes', label: 'Most Upvoted' },
  { value: 'comments', label: 'Most Commented' },
];

export default function ExplorePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    issuesApi.categories().then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  const fetchIssues = useCallback(async (nextPage = 1) => {
    const isFirstPage = nextPage === 1;
    try {
      if (isFirstPage) setLoading(true); else setLoadingMore(true);
      setError(null);
      const params: Record<string, string> = { sort, page: String(nextPage) };
      if (search) params.search = search;
      if (activeStatus !== 'all') params.status = activeStatus;
      if (activeCategory !== 'all') params.category = activeCategory;

      const res = await issuesApi.list(params);
      const raw: Issue[] = (res.data.issues || []).map((i: Issue) => ({
        ...i,
        address: i.address || (i.latitude ? `${Number(i.latitude).toFixed(4)}, ${Number(i.longitude).toFixed(4)}` : ''),
        media: i.media || [],
      }));
      setIssues((prev) => (isFirstPage ? raw : [...prev, ...raw]));
      setTotal(res.data.total ?? raw.length);
      setPage(nextPage);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      setError('Failed to load issues. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, sort, activeStatus, activeCategory]);

  useEffect(() => {
    const timer = setTimeout(() => fetchIssues(), 300);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  const hasFilters = activeStatus !== 'all' || activeCategory !== 'all' || !!search;
  const clearFilters = () => { setActiveStatus('all'); setActiveCategory('all'); setSearch(''); };
  const unresolvedOnly = activeStatus === 'unresolved';

  return (
    <AppLayout
      title="Explore"
      sub="Browse and track civic issues reported by your community"
      headerActions={
        <Link href="/report" className="hidden sm:inline-flex btn-accent text-sm py-2 px-4 gap-2">
          <Plus size={15} /> Report Issue
        </Link>
      }
    >
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search issues by title or description"
          className="basis-full lg:basis-0 lg:flex-1 lg:min-w-[200px]" />
        <SelectInput value={sort} onChange={setSort} options={SORT_OPTIONS} label="Sort issues" />
        <button
          type="button"
          aria-pressed={unresolvedOnly}
          onClick={() => setActiveStatus(unresolvedOnly ? 'all' : 'unresolved')}
          className={clsx('h-10 px-4 inline-flex items-center gap-2 rounded-xl text-sm font-semibold border whitespace-nowrap transition-colors',
            unresolvedOnly ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary' : 'bg-base-850 border-border-subtle text-content-secondary')}
        >
          Unresolved Only
        </button>
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(v => !v)}
          className={clsx('h-10 px-4 inline-flex items-center gap-2 rounded-xl text-sm font-medium border whitespace-nowrap transition-colors',
            showFilters ? 'bg-accent-secondary/10 border-accent-secondary/30 text-accent-secondary' : 'bg-base-850 border-border-subtle text-content-secondary')}
        >
          <SlidersHorizontal size={14} /> Filters
          {hasFilters && <span className="w-2 h-2 rounded-full bg-accent-primary" aria-label="Filters active" />}
        </button>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {showFilters && (
        <div className="card p-4 mb-4 space-y-4">
          <div>
            <p className="label-micro mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={activeStatus === 'all'} onClick={() => setActiveStatus('all')}>All</FilterChip>
              <FilterChip active={unresolvedOnly} onClick={() => setActiveStatus('unresolved')}>Unresolved</FilterChip>
              {STATUS_ORDER.map(s => (
                <FilterChip key={s} active={activeStatus === s} onClick={() => setActiveStatus(s)}
                  activeClass={STATUS_META[s].badge} dotClass={STATUS_META[s].dot}>
                  {STATUS_META[s].label}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="label-micro mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {[{ slug: 'all', name: 'All' }, ...categories].map(c => (
                <FilterChip key={c.slug} active={activeCategory === c.slug} onClick={() => setActiveCategory(c.slug)}>{c.name}</FilterChip>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <p className="text-content-muted text-sm">
          {loading ? 'Loading…' : error ? null : <><span className="text-content-primary font-semibold">{issues.length}</span> of {total} issues</>}
        </p>
        {hasFilters && !loading && (
          <button onClick={clearFilters} className="text-xs text-accent-primary inline-flex items-center gap-1 hover:underline">
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={36} className="animate-spin text-accent-primary" />
          <p className="text-content-muted text-sm">Loading community issues…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl bg-state-error/5 border border-state-error/15">
          <AlertTriangle size={32} className="text-state-error" />
          <div className="text-center">
            <p className="text-content-primary font-semibold">Failed to load</p>
            <p className="text-content-muted text-sm mt-1">{error}</p>
          </div>
          <button onClick={() => fetchIssues()} className="btn-secondary text-sm">Try Again</button>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Search size={36} className="text-content-muted opacity-40" />
          <div className="text-center">
            <p className="text-content-primary font-semibold">No issues found</p>
            <p className="text-content-muted text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {issues.map(issue => <IssueCard key={issue.id} issue={issue} showReporter />)}
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
        </div>
      )}

      {!loading && !error && page < totalPages && (
        <div className="flex justify-center mt-6">
          <button onClick={() => fetchIssues(page + 1)} disabled={loadingMore} className="btn-secondary text-sm gap-2 disabled:opacity-60">
            {loadingMore && <Loader2 size={14} className="animate-spin" />}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </AppLayout>
  );
}
