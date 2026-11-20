'use client';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useToastStore } from '@/lib/toast';

const STYLE = {
  success: { icon: CheckCircle2, className: 'border-state-success/30 text-state-success' },
  error: { icon: AlertCircle, className: 'border-state-error/30 text-state-error' },
  info: { icon: Info, className: 'border-accent-primary/30 text-accent-primary' },
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="fixed z-[100] bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { icon: Icon, className } = STYLE[t.kind];
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={clsx('pointer-events-auto flex items-start gap-3 rounded-xl border bg-base-900 shadow-dropdown p-3.5 animate-slide_up', className)}>
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-content-primary">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-content-muted hover:text-content-primary">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
