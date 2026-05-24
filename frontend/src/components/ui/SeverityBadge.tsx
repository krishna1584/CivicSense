import { Severity } from '@/types';
import { clsx } from 'clsx';

const severityConfig: Record<Severity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-state-success bg-state-success/10 border-state-success/20' },
  medium: { label: 'Medium', color: 'text-state-warning bg-state-warning/10 border-state-warning/20' },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20' },
  critical: { label: 'Critical', color: 'text-state-error bg-state-error/10 border-state-error/30' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  return (
    <span className={clsx('inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cfg.color)}>
      {cfg.label}
    </span>
  );
}
