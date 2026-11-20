import { Severity } from '@/types';
import { clsx } from 'clsx';

/** The one place severity colours and names are defined. */
export const SEVERITY_META: Record<Severity, { label: string; badge: string; dot: string }> = {
  low: { label: 'Low', badge: 'text-state-success bg-state-success/10 border-state-success/20', dot: 'bg-state-success' },
  medium: { label: 'Medium', badge: 'text-state-warning bg-state-warning/10 border-state-warning/20', dot: 'bg-state-warning' },
  high: { label: 'High', badge: 'text-state-high bg-state-high/10 border-state-high/20', dot: 'bg-state-high' },
  critical: { label: 'Critical', badge: 'text-state-error bg-state-error/10 border-state-error/30', dot: 'bg-state-error' },
};

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const meta = SEVERITY_META[severity as Severity] ?? SEVERITY_META.medium;
  return (
    <span className={clsx('inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap', meta.badge)}>
      {meta.label}
    </span>
  );
}
