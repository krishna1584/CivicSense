import { Loader2 } from 'lucide-react';
import { Category } from '@/types';
import { ReportForm, SEVERITY_OPTIONS, SeverityValue } from './types';

interface Props {
  form: ReportForm;
  categories: Category[];
  catLoading: boolean;
  onChange: (field: keyof ReportForm, value: string | boolean) => void;
}

export function StepDetails({ form, categories, catLoading, onChange }: Props) {
  return (
    <div className="space-y-5 animate-fade_in">
      {/* Title */}
      <div className="card p-5">
        <label className="label-micro block mb-2">Issue Title *</label>
        <input
          className="input-dark"
          placeholder="e.g. Large pothole on Main Street near the bus stop"
          value={form.title}
          onChange={e => onChange('title', e.target.value)}
          maxLength={255}
        />
        <p className="text-content-muted text-xs mt-1.5">{form.title.length}/255</p>
      </div>

      {/* Description */}
      <div className="card p-5">
        <label className="label-micro block mb-2">Detailed Description *</label>
        <textarea
          className="input-dark resize-none"
          rows={5}
          placeholder="Describe the issue in detail — size, duration, hazard level, people affected…"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          maxLength={5000}
        />
        <p className="text-content-muted text-xs mt-1.5">{form.description.length}/5000</p>
      </div>

      {/* Category + Severity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="card p-5">
          <label className="label-micro block mb-3">Category *</label>
          {catLoading ? (
            <div className="flex items-center gap-2 text-content-muted text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange('category_id', c.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                    style={{
                      background: form.category_id === c.id ? 'rgb(var(--accent-primary) / 0.12)' : 'rgb(var(--base-850))',
                      border:     form.category_id === c.id ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgb(var(--border-subtle))',
                      color:      form.category_id === c.id ? 'rgb(var(--accent-primary))' : 'rgb(var(--content-muted))',
                    }}
                >
                  <span>{c.icon}</span>
                  <span className="truncate text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Severity */}
        <div className="card p-5">
          <label className="label-micro block mb-3">Severity *</label>
          <div className="space-y-2">
            {SEVERITY_OPTIONS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange('severity', s.value)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: form.severity === s.value ? s.bg     : 'rgb(var(--base-850))',
                    border:     form.severity === s.value ? `1px solid ${s.border}` : '1px solid rgb(var(--border-subtle))',
                    color:      form.severity === s.value ? s.color  : 'rgb(var(--content-muted))',
                  }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Anonymous */}
      <div className="card p-4 flex items-center gap-3">
        <input
          type="checkbox"
          id="anon"
          checked={form.is_anonymous}
          onChange={e => onChange('is_anonymous', e.target.checked)}
          className="w-4 h-4 accent-blue-500 rounded"
        />
        <label htmlFor="anon" className="text-sm text-content-secondary cursor-pointer">
          Submit anonymously — your name won&apos;t appear publicly
        </label>
      </div>
    </div>
  );
}
