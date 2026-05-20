import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: number;
  accent?: 'green' | 'blue' | 'amber' | 'red';
  suffix?: string;
}

const accentMap = {
  green: { color: 'text-state-success', bg: 'bg-state-success/10' },
  blue: { color: 'text-accent-secondary', bg: 'bg-accent-secondary/10' },
  amber: { color: 'text-state-warning', bg: 'bg-state-warning/10' },
  red: { color: 'text-state-error', bg: 'bg-state-error/10' },
};

export function StatCard({ label, value, icon, trend, accent = 'green', suffix }: StatCardProps) {
  const ac = accentMap[accent];
  return (
    <div className="card p-5 group flex flex-col justify-between min-h-[140px] relative overflow-hidden bg-base-800">
      <div className="flex items-start justify-between mb-2 relative z-10">
        <p className="text-[13px] font-medium text-content-secondary tracking-wide">{label}</p>
        {icon && (
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", ac.bg, ac.color)}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2 relative z-10 mt-auto">
        <span className="text-3xl font-bold text-content-primary tracking-tight animate-count_up">
          {value}
        </span>
        {suffix && <span className="text-content-muted text-sm font-medium">{suffix}</span>}
      </div>
      
      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1.5 mt-3 text-[13px] font-medium relative z-10', trend >= 0 ? 'text-state-success' : 'text-state-error')}>
          {trend >= 0 ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
          <span>{Math.abs(trend)}% <span className="text-content-muted font-normal">vs last week</span></span>
        </div>
      )}
    </div>
  );
}
