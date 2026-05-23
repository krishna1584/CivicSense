import { Issue } from '@/types';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { MapPin, MessageSquare, ThumbsUp, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { clsx } from 'clsx';

interface IssueCardProps {
  issue: Issue;
  compact?: boolean;
}

export function IssueCard({ issue, compact = false }: IssueCardProps) {
  return (
    <Link href={`/issues/${issue.id}`} className="block h-full outline-none">
      <div className={clsx(
        'card card-hover flex flex-col cursor-pointer group h-full',
        compact ? 'p-4' : 'p-5'
      )}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-base-850 border border-border-subtle flex items-center justify-center text-lg">
              {issue.category_icon || '📋'}
            </div>
            <span className="text-[13px] font-semibold text-content-secondary">{issue.category_name || 'Issue'}</span>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} size="sm" />
          </div>
        </div>

        <h3 className="font-semibold text-content-primary group-hover:text-accent-secondary transition-colors line-clamp-2 mb-2 text-base leading-snug">
          {issue.title}
        </h3>

        {issue.department ? (
          <div className="text-[11px] font-semibold text-accent-secondary/90 mb-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary" />
              {issue.status === 'resolved' ? `Resolved by: ${issue.department}` : `Assigned: ${issue.department}`}
            </div>
            {issue.status === 'resolved' && issue.avg_rating && parseFloat(String(issue.avg_rating)) > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-state-warning bg-state-warning/10 border border-state-warning/20 rounded px-1.5 py-0.5">
                <span>★</span>
                <span>{parseFloat(String(issue.avg_rating)).toFixed(1)}</span>
                {issue.review_count !== undefined && (
                  <span className="text-[9px] text-state-warning/75 font-normal">({issue.review_count})</span>
                )}
              </div>
            )}
          </div>
        ) : (
          issue.status === 'resolved' && issue.avg_rating && parseFloat(String(issue.avg_rating)) > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-state-warning bg-state-warning/10 border border-state-warning/20 rounded px-1.5 py-0.5 mb-3 w-fit">
              <span>★</span>
              <span>{parseFloat(String(issue.avg_rating)).toFixed(1)}</span>
              {issue.review_count !== undefined && (
                <span className="text-[9px] text-state-warning/75 font-normal">({issue.review_count})</span>
              )}
            </div>
          )
        )}

        {!compact && (
          <p className="text-content-secondary text-sm line-clamp-2 mb-4 leading-relaxed">
            {issue.description}
          </p>
        )}

        {issue.address && (
          <div className="flex items-start gap-1.5 text-content-muted text-[13px] mb-4 mt-auto">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <span className="line-clamp-1">{issue.address}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border-subtle/60 mt-auto">
          <div className="flex items-center gap-4 text-content-muted text-[13px] font-medium">
            <span className="flex items-center gap-1.5 hover:text-content-primary transition-colors">
              <ThumbsUp size={14} />
              {issue.upvote_count}
            </span>
            <span className="flex items-center gap-1.5 hover:text-content-primary transition-colors">
              <MessageSquare size={14} />
              {issue.comment_count}
            </span>
            <span className="flex items-center gap-1.5 hover:text-content-primary transition-colors">
              <Users size={14} />
              {issue.follow_count}
            </span>
            {issue.distance !== undefined && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                {(issue.distance / 1000).toFixed(1)}km
              </span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-content-muted text-[12px] font-medium">
            <Clock size={12} />
            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
