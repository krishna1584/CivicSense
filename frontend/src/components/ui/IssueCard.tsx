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
    <Link href={`/issues/${issue.id}`}>
      <div className={clsx(
        'card card-hover p-5 cursor-pointer group transition-all duration-200',
        compact ? 'p-4' : 'p-5'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{issue.category_icon || '📋'}</span>
            <span className="label-micro">{issue.category_name || 'Issue'}</span>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} size="sm" />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white group-hover:text-[#00FF94] transition-colors line-clamp-2 mb-2 text-base">
          {issue.title}
        </h3>

        {!compact && (
          <p className="text-[#9CA3AF] text-sm line-clamp-2 mb-4">
            {issue.description}
          </p>
        )}

        {/* Location */}
        {issue.address && (
          <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs mb-3">
            <MapPin size={12} />
            <span className="truncate">{issue.address}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-4 text-[#9CA3AF] text-xs">
            <span className="flex items-center gap-1">
              <ThumbsUp size={12} />
              {issue.upvote_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {issue.comment_count}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {issue.follow_count}
            </span>
            {issue.distance && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {(issue.distance / 1000).toFixed(1)}km
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[#9CA3AF] text-xs">
            <Clock size={12} />
            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
