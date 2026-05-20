import { MapPin } from 'lucide-react';
import { Category } from '@/types';
import { ReportForm, SEVERITY_OPTIONS } from './types';

interface Props {
  form: ReportForm;
  categories: Category[];
  files: File[];
  previewUrl: string | null;
  userName: string;
}

export function LivePreview({ form, categories, files, previewUrl, userName }: Props) {
  const category = categories.find(c => c.id === form.category_id);
  const severity = SEVERITY_OPTIONS.find(s => s.value === form.severity) ?? SEVERITY_OPTIONS[1];

  return (
    <div className="sticky top-6 space-y-5">
      <p className="label-micro text-content-primary mb-1">Live Preview</p>

      <div className="card p-5 bg-base-800">
        {/* Image preview */}
        {previewUrl && (
          <div className="rounded-xl overflow-hidden h-36 bg-base-950 mb-5 border border-border-subtle">
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Category + severity */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-base-850 border border-border-subtle flex items-center justify-center text-sm">
            {category?.icon || '📋'}
          </div>
          <span className="text-[12px] font-semibold text-content-secondary tracking-wide uppercase">{category?.name || 'Select category'}</span>
          <span
            className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
            style={{ background: severity.bg, color: severity.color, border: `1px solid ${severity.border}` }}
          >
            {form.severity}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-content-primary mb-2 leading-snug text-[15px]">
          {form.title || 'Issue title will appear here…'}
        </h3>

        {/* Description */}
        <p className="text-content-secondary text-[13px] leading-relaxed mb-4 line-clamp-3 min-h-[3rem]">
          {form.description || 'Description preview…'}
        </p>

        {/* Address */}
        {form.address && (
          <div className="flex items-start gap-1.5 text-content-muted text-[12px] mb-4">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{form.address}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border-subtle text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-base-850 border border-border-subtle text-content-secondary font-semibold uppercase tracking-widest text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-content-muted" />
            Reported
          </span>
          <span className="text-content-muted font-medium">
            {form.is_anonymous ? 'Anonymous' : userName}
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="card p-5 bg-base-800 space-y-3">
        <p className="label-micro text-content-primary mb-1">Tips for a good report</p>
        <div className="space-y-2.5">
          {[
            'Be specific about the exact location',
            'Add photos for faster resolution',
            'Choose the right severity level',
            'Mention when you first noticed the issue',
          ].map(tip => (
            <div key={tip} className="flex items-start gap-2.5 text-[13px] text-content-secondary">
              <span className="text-accent-secondary mt-0.5 flex-shrink-0">✓</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
