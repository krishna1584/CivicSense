import { Issue } from '@/types';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { MapPin, MessageSquare, ThumbsUp, Clock, Users, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

/** First photo the reporter attached (not the staff's resolution proof). */
export const coverImage = (issue: Issue) =>
  issue.media?.find((m) => m.type === 'image' && !m.is_resolution)?.url;

const ago = (date: string) => formatDistanceToNow(new Date(date), { addSuffix: true });

function Rating({ issue }: { issue: Issue }) {
  const rating = parseFloat(String(issue.avg_rating ?? 0));
  if (issue.status !== 'resolved' || !rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-state-warning">
      <Star size={11} className="fill-state-warning" /> {rating.toFixed(1)}
      {issue.review_count !== undefined && <span className="font-normal opacity-75">({issue.review_count})</span>}
    </span>
  );
}

/** The issue card used everywhere issues are listed in a grid. */
export function IssueCard({ issue, showReporter = false }: { issue: Issue; showReporter?: boolean }) {
  const image = coverImage(issue);
  return (
    <Link href={`/issues/${issue.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
      <article className="card card-hover overflow-hidden flex flex-col h-full group">
        {image && (
          <div className="relative h-40 bg-base-850 overflow-hidden">
            <img src={image} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-content-secondary min-w-0">
              <span className="text-base leading-none">{issue.category_icon || '📋'}</span>
              <span className="truncate">{issue.category_name || 'Issue'}</span>
            </span>
            <SeverityBadge severity={issue.severity} />
          </div>

          <h3 className="font-semibold text-content-primary group-hover:text-accent-secondary transition-colors line-clamp-2 mb-2 leading-snug">
            {issue.title}
          </h3>

          {issue.description && (
            <p className="text-content-secondary text-sm line-clamp-2 mb-3 leading-relaxed">{issue.description}</p>
          )}

          {issue.address && (
            <p className="flex items-start gap-1.5 text-content-muted text-[13px] mb-3">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span className="line-clamp-1">{issue.address}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-3 mt-auto">
            <StatusBadge status={issue.status} size="sm" />
            {issue.department && <span className="text-[11px] font-semibold text-accent-secondary">{issue.department}</span>}
            <Rating issue={issue} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle text-content-muted text-[12px] font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1" aria-label={`${issue.upvote_count ?? 0} upvotes`}><ThumbsUp size={13} />{issue.upvote_count ?? 0}</span>
              <span className="flex items-center gap-1" aria-label={`${issue.comment_count ?? 0} comments`}><MessageSquare size={13} />{issue.comment_count ?? 0}</span>
              <span className="flex items-center gap-1" aria-label={`${issue.follow_count ?? 0} followers`}><Users size={13} />{issue.follow_count ?? 0}</span>
            </div>
            <span className="flex items-center gap-1"><Clock size={12} />{ago(issue.created_at)}</span>
          </div>

          {showReporter && !issue.is_anonymous && issue.reporter_name && (
            <p className="text-[11px] text-content-muted mt-2">by {issue.reporter_name}</p>
          )}
        </div>
      </article>
    </Link>
  );
}

/** The compact one-line version used in list view. */
export function IssueRow({ issue }: { issue: Issue }) {
  const image = coverImage(issue);
  return (
    <Link href={`/issues/${issue.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
      <article className="card card-hover flex items-center gap-4 p-4 group">
        {image ? (
          <img src={image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 bg-base-850" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-base-850 border border-border-subtle flex items-center justify-center text-xl shrink-0">
            {issue.category_icon || '📋'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-content-muted uppercase tracking-wider font-medium truncate">{issue.category_name}</p>
          <h3 className="font-semibold text-content-primary text-sm group-hover:text-accent-secondary transition-colors truncate">{issue.title}</h3>
          {issue.address && (
            <p className="text-content-muted text-xs flex items-center gap-1 mt-0.5 min-w-0">
              <MapPin size={10} className="shrink-0" /><span className="truncate">{issue.address}</span>
            </p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} size="sm" />
        </div>
        <div className="hidden lg:flex items-center gap-3 text-content-muted text-xs shrink-0">
          <span className="flex items-center gap-1"><ThumbsUp size={11} />{issue.upvote_count ?? 0}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} />{issue.comment_count ?? 0}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{ago(issue.created_at)}</span>
        </div>
      </article>
    </Link>
  );
}
