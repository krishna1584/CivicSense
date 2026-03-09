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
  green: { color: '#00FF94', var: '#00FF94' },
  blue: { color: '#3B82F6', var: '#3B82F6' },
  amber: { color: '#F59E0B', var: '#F59E0B' },
  red: { color: '#EF4444', var: '#EF4444' },
};

export function StatCard({ label, value, icon, trend, accent = 'green', suffix }: StatCardProps) {
  const ac = accentMap[accent];
  return (
    <div
      className="stat-card"
      style={{ '--accent': ac.var } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="label-micro">{label}</p>
        {icon && <span className="text-[#9CA3AF] opacity-60">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span
          className="text-3xl font-bold animate-count_up"
          style={{ color: ac.color }}
        >
          {value}
        </span>
        {suffix && <span className="text-[#9CA3AF] text-sm mb-1">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1 mt-2 text-xs', trend >= 0 ? 'text-[#00FF94]' : 'text-[#EF4444]')}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{Math.abs(trend)}% this week</span>
        </div>
      )}
    </div>
  );
}
