'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { issuesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Category } from '@/types';
import { AlertTriangle, CheckCircle2, Loader2, Zap } from 'lucide-react';

import { StepIndicator }  from './_components/StepIndicator';
import { StepDetails }    from './_components/StepDetails';
import { StepLocation }   from './_components/StepLocation';
import { StepEvidence }   from './_components/StepEvidence';
import { StepReview }     from './_components/StepReview';
import { LivePreview }    from './_components/LivePreview';
import { DEFAULT_FORM, ReportForm, STEPS } from './_components/types';

// ── Validation per step ───────────────────────────────────────────────────────
function validateStep(step: number, form: ReportForm): string | null {
  if (step === 0) {
    if (!form.title.trim() || form.title.length < 5)        return 'Title must be at least 5 characters.';
    if (!form.description.trim() || form.description.length < 10) return 'Description must be at least 10 characters.';
    if (!form.category_id)                                  return 'Please select a category.';
  }
  if (step === 1) {
    if (!form.address.trim())                               return 'Please enter a location description.';
    if (!form.latitude || !form.longitude)                  return 'Please set GPS coordinates (use the GPS button or enter them manually).';
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || lat < -90  || lat > 90)  return 'Latitude must be between −90 and 90.';
    if (isNaN(lng) || lng < -180 || lng > 180) return 'Longitude must be between −180 and 180.';
  }
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportIssuePage() {
  const router  = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  const [step,       setStep]       = useState(0);
  const [form,       setForm]       = useState<ReportForm>(DEFAULT_FORM);
  const [files,      setFiles]      = useState<File[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/report');
  }, [user, authLoading, router]);

  // Load categories
  useEffect(() => {
    issuesApi.categories()
      .then(r => { if (r.data.categories?.length) setCategories(r.data.categories); })
      .catch(() => {})
      .finally(() => setCatLoading(false));
  }, []);

  // Derive first image preview URL for the sidebar
  const previewUrl = useMemo(() => {
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!imageFile) return null;
    const url = URL.createObjectURL(imageFile);
    return url;
  }, [files]);

  // Clean up preview URL
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const setField = (field: keyof ReportForm, value: string | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  };

  const handleNext = () => {
    const err = validateStep(step, form);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = (target?: number) => {
    setError('');
    setStep(target !== undefined ? target : s => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title',        form.title);
      fd.append('description',  form.description);
      fd.append('category_id',  form.category_id);
      fd.append('severity',     form.severity);
      fd.append('latitude',     form.latitude);
      fd.append('longitude',    form.longitude);
      fd.append('address',      form.address);
      fd.append('is_anonymous', String(form.is_anonymous));
      files.forEach(f => fd.append('media', f));

      const res = await issuesApi.create(fd);
      setSubmitted(true);
      setTimeout(
        () => router.push(res.data?.issue?.id ? `/issues/${res.data.issue.id}` : '/my-reports'),
        1800
      );
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; errors?: { message: string }[] } } };
      if (e.response?.status === 401) {
        setError('Session expired — please log in again.');
        setTimeout(() => router.push('/login?redirect=/report'), 2000);
      } else {
        setError(
          e.response?.data?.errors?.[0]?.message ||
          e.response?.data?.error ||
          'Failed to submit. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / auth guard ────────────────────────────────────────────────────
  if (authLoading) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    </AppLayout>
  );
  if (!user) return null;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade_in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-state-success/10 border border-state-success/20 shadow-[0_0_40px_rgba(51,209,122,0.15)]">
          <CheckCircle2 size={44} className="text-state-success" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-content-primary mb-3">Report Submitted</h2>
          <p className="text-content-secondary max-w-md">
            Thank you, {user.name}. Your report has been securely filed. Redirecting to issue details...
          </p>
        </div>
      </div>
    </AppLayout>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-10 max-w-3xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-content-primary mb-3 tracking-tight">Report a Civic Issue</h1>
        <p className="text-content-secondary text-base">
          Document a problem in your community to notify the right authorities.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} onBack={handleBack} />

      {/* Error banner */}
      {error && (
        <div className="max-w-5xl mx-auto flex items-start gap-3 rounded-xl p-4 mb-6 text-sm bg-state-error/10 border border-state-error/20 text-state-error animate-fade_in">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-8">
        {/* ── Step content ─────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6 animate-fade_in">
          <div className="bg-base-800 rounded-2xl border border-border-subtle p-6 shadow-card">
            {step === 0 && (
              <StepDetails
                form={form}
                categories={categories}
                catLoading={catLoading}
                onChange={setField}
              />
            )}
            {step === 1 && (
              <StepLocation
                form={form}
                onChange={setField}
                onError={setError}
              />
            )}
            {step === 2 && (
              <StepEvidence
                files={files}
                onFilesChange={setFiles}
              />
            )}
            {step === 3 && (
              <StepReview
                form={form}
                categories={categories}
                files={files}
                userName={user.name}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            {step > 0 && (
              <button
                onClick={() => handleBack()}
                className="btn-secondary flex-1"
              >
                Go Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`btn-accent flex-1 flex items-center justify-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed shadow-none' : ''}`}
              >
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Submitting…</>
                  : <><Zap size={18} fill="currentColor" /> Submit Report</>
                }
              </button>
            )}
          </div>
        </div>

        {/* ── Live preview sidebar ──────────────────────────────────────── */}
        <div className="lg:col-span-2 hidden lg:block animate-fade_in">
          <LivePreview
            form={form}
            categories={categories}
            files={files}
            previewUrl={previewUrl}
            userName={user.name}
          />
        </div>
      </div>
    </AppLayout>
  );
}
