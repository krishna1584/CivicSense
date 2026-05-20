import { STEPS } from './types';
import { clsx } from 'clsx';

interface Props {
  current: number;
  onBack: (step: number) => void;
}

export function StepIndicator({ current, onBack }: Props) {
  return (
    <div className="flex items-center gap-0 mb-10 w-full max-w-3xl mx-auto">
      {STEPS.map((label, i) => {
        const isPast = i < current;
        const isCurrent = i === current;
        const isFuture = i > current;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => isPast && onBack(i)}
              className={clsx(
                "flex items-center gap-3 group outline-none",
                isPast ? "cursor-pointer" : "cursor-default"
              )}
            >
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  isCurrent || isPast ? "bg-accent-primary text-white" : "bg-base-850 text-content-muted border border-border-subtle",
                  isCurrent && "ring-4 ring-accent-primary/20 shadow-glow-primary"
                )}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <span
                className={clsx(
                  "text-sm font-medium hidden sm:block transition-colors duration-300",
                  isCurrent ? "text-content-primary" : isPast ? "text-content-secondary" : "text-content-muted"
                )}
              >
                {label}
              </span>
            </button>

            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  "flex-1 h-px mx-4 transition-colors duration-300",
                  isPast ? "bg-accent-primary" : "bg-border-subtle"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
