import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: 'green' | 'blue' | 'amber' | 'red';
  suffix?: string;
  sub?: string;
  onClick?: () => void;
}

const accentMap = {
  green: 'text-state-success bg-state-success/10',
  blue: 'text-accent-secondary bg-accent-secondary/10',
  amber: 'text-state-warning bg-state-warning/10',
  red: 'text-state-error bg-state-error/10',
};

export function StatCard({ label, value, icon, accent = 'green', suffix, sub, onClick }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'card p-5 flex flex-col justify-between min-h-[120px] text-left w-full',
        onClick && 'card-hover cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13px] font-medium text-content-secondary">{label}</p>
        {icon && <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', accentMap[accent])}>{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2 mt-auto">
        <span className="text-3xl font-bold text-content-primary tracking-tight">{value}</span>
        {suffix && <span className="text-content-muted text-sm font-medium">{suffix}</span>}
      </div>
      {sub && <p className="text-xs text-content-muted mt-2">{sub}</p>}
    </Wrapper>
  );
}
