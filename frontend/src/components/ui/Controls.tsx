'use client';
import { ReactNode } from 'react';
import { ChevronDown, LayoutGrid, List, Search, X } from 'lucide-react';
import { clsx } from 'clsx';

/** A toggleable pill used for filters. `activeClass` lets status chips use their status colour. */
export function FilterChip({ active, onClick, children, activeClass, dotClass }: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  activeClass?: string;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? activeClass || 'bg-accent-secondary/10 border-accent-secondary/35 text-accent-secondary'
          : 'bg-base-850 border-border-subtle text-content-secondary hover:text-content-primary'
      )}
    >
      {dotClass && <span className={clsx('w-1.5 h-1.5 rounded-full', dotClass)} />}
      {children}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-dark h-10 py-0 pl-9 pr-9 text-sm"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function SelectInput({ value, onChange, options, label }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
        className="input-dark h-10 py-0 pl-3 pr-8 text-sm appearance-none cursor-pointer min-w-[150px]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
    </div>
  );
}

export function ViewToggle({ mode, onChange }: { mode: 'grid' | 'list'; onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="flex gap-1 h-10 p-1 rounded-xl bg-base-900 border border-border-subtle" role="group" aria-label="Layout">
      {([['grid', LayoutGrid, 'Grid view'], ['list', List, 'List view']] as const).map(([value, Icon, label]) => (
        <button key={value} type="button" onClick={() => onChange(value)} aria-label={label} aria-pressed={mode === value}
          className={clsx('px-3 rounded-lg transition-colors', mode === value ? 'bg-accent-secondary/10 text-accent-secondary' : 'text-content-secondary hover:text-content-primary')}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
