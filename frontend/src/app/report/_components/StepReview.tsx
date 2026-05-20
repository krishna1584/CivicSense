import { Category } from '@/types';
import { ReportForm, SEVERITY_OPTIONS } from './types';

interface Props {
  form: ReportForm;
  categories: Category[];
  files: File[];
  userName: string;
}

const ROW = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
    <span className="text-[#6B7280] text-sm flex-shrink-0">{label}</span>
    <span className="text-white text-sm text-right font-medium">{value}</span>
  </div>
);

export function StepReview({ form, categories, files, userName }: Props) {
  const category = categories.find(c => c.id === form.category_id);
  const severity = SEVERITY_OPTIONS.find(s => s.value === form.severity)!;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="card p-5 space-y-0">
        <h3 className="font-semibold text-white mb-1">Review Your Report</h3>
        <p className="text-[#6B7280] text-xs mb-4">Please verify everything looks correct before submitting.</p>

        <ROW label="Title"     value={form.title} />
        <ROW label="Category"  value={category ? `${category.icon} ${category.name}` : '—'} />
        <ROW
          label="Severity"
          value={severity.label}
        />
        <ROW
          label="Location"
          value={form.address || (form.latitude ? `${form.latitude}, ${form.longitude}` : 'Not set')}
        />
        <ROW label="Anonymous" value={form.is_anonymous ? 'Yes' : 'No'} />
        <ROW label="Evidence"  value={files.length > 0 ? `${files.length} file(s)` : 'None'} />
        <ROW label="Reported by" value={form.is_anonymous ? 'Anonymous' : userName} />
      </div>

      <div className="card p-5">
        <h4 className="label-micro text-[#61C0FF] mb-2">Description</h4>
        <p className="text-[#D1D5DB] text-sm leading-relaxed">{form.description}</p>
      </div>

      <div
        className="rounded-xl p-4 text-xs text-[#6B7280]"
        style={{ background: 'rgba(97,192,255,0.04)', border: '1px solid rgba(97,192,255,0.1)' }}
      >
        By submitting this report you confirm the information is accurate to the best of your knowledge.
      </div>
    </div>
  );
}
