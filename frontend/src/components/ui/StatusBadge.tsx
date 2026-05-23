import { IssueStatus } from '@/types';
import { clsx } from 'clsx';

const statusConfig: Record<IssueStatus, { label: string; color: string; dot: string }> = {
  reported: { label: 'Reported', color: 'text-content-secondary bg-base-850 border-border-subtle', dot: 'bg-content-muted' },
  acknowledged: { label: 'Acknowledged', color: 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/20', dot: 'bg-accent-secondary' },
  in_progress: { label: 'In Progress', color: 'text-state-warning bg-state-warning/10 border-state-warning/20', dot: 'bg-state-warning' },
  resolved: { label: 'Resolved', color: 'text-state-success bg-state-success/10 border-state-success/20', dot: 'bg-state-success' },
  rejected: { label: 'Rejected', color: 'text-state-error bg-state-error/10 border-state-error/20', dot: 'bg-state-error' },
  pending_verification: { label: 'Pending Verification', color: 'text-accent-primary bg-accent-primary/10 border-accent-primary/20', dot: 'bg-accent-primary' },
};

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const fallbackConfig = { label: 'Unknown', color: 'text-content-muted bg-base-850 border-border-subtle', dot: 'bg-content-muted' };

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const cfg = statusConfig[status as IssueStatus] ?? fallbackConfig;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors',
      cfg.color,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    )}>
      {showDot && <span className={clsx('badge-dot', cfg.dot)} />}
      {cfg.label}
    </span>
  );
}

export default StatusBadge;
