import { Severity } from '@/types';
import { clsx } from 'clsx';

const severityConfig: Record<Severity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  medium: { label: 'Medium', color: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20' },
  high: { label: 'High', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  critical: { label: 'Critical', color: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30 shadow-glow-red' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  return (
    <span className={clsx('inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', cfg.color)}>
      {cfg.label}
    </span>
  );
}
