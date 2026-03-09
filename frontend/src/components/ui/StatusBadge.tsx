import { IssueStatus } from '@/types';
import { clsx } from 'clsx';

const statusConfig: Record<IssueStatus, { label: string; color: string; glow: string; dot: string }> = {
  reported: { label: 'Reported', color: 'text-[#9CA3AF] bg-[#9CA3AF]/10 border-[#9CA3AF]/20', glow: '', dot: 'bg-[#9CA3AF]' },
  acknowledged: { label: 'Acknowledged', color: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20', glow: 'shadow-glow-blue', dot: 'bg-[#3B82F6]' },
  in_progress: { label: 'In Progress', color: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20', glow: 'shadow-glow-amber', dot: 'bg-[#F59E0B]' },
  resolved: { label: 'Resolved', color: 'text-[#00FF94] bg-[#00FF94]/10 border-[#00FF94]/20', glow: 'shadow-glow-green', dot: 'bg-[#00FF94]' },
  rejected: { label: 'Rejected', color: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20', glow: 'shadow-glow-red', dot: 'bg-[#EF4444]' },
};

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-lg border font-medium',
      cfg.color,
      cfg.glow,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
    )}>
      {showDot && <span className={clsx('w-1.5 h-1.5 rounded-full animate-glow_pulse', cfg.dot)} />}
      {cfg.label}
    </span>
  );
}

export default StatusBadge;
