import { IssueStatus } from '@/types';
import { clsx } from 'clsx';

/** The one place issue status colours and names are defined. */
export const STATUS_META: Record<IssueStatus, { label: string; badge: string; dot: string }> = {
  reported: { label: 'Reported', badge: 'text-content-secondary bg-base-850 border-border-subtle', dot: 'bg-content-muted' },
  acknowledged: { label: 'Acknowledged', badge: 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/20', dot: 'bg-accent-secondary' },
  in_progress: { label: 'In Progress', badge: 'text-state-warning bg-state-warning/10 border-state-warning/20', dot: 'bg-state-warning' },
  pending_verification: { label: 'Pending Verification', badge: 'text-accent-primary bg-accent-primary/10 border-accent-primary/20', dot: 'bg-accent-primary' },
  resolved: { label: 'Resolved', badge: 'text-state-success bg-state-success/10 border-state-success/20', dot: 'bg-state-success' },
  rejected: { label: 'Rejected', badge: 'text-state-error bg-state-error/10 border-state-error/20', dot: 'bg-state-error' },
};

export const STATUS_ORDER: IssueStatus[] = ['reported', 'acknowledged', 'in_progress', 'pending_verification', 'resolved', 'rejected'];

const fallback = { label: 'Unknown', badge: 'text-content-muted bg-base-850 border-border-subtle', dot: 'bg-content-muted' };

interface StatusBadgeProps {
  status: IssueStatus | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const meta = STATUS_META[status as IssueStatus] ?? fallback;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap',
      meta.badge,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    )}>
      {showDot && <span className={clsx('badge-dot', meta.dot)} />}
      {meta.label}
    </span>
  );
}

export default StatusBadge;
