'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { adminApi, anonymousApi, issuesApi } from '@/lib/api';
import { solveChallenge } from '@/lib/proofOfWork';
import { useAuthStore } from '@/lib/store';
import { Category } from '@/types';
import { AlertTriangle, CheckCircle2, Copy, Loader2, ShieldCheck, Zap } from 'lucide-react';

import { StepIndicator } from './StepIndicator';
import { StepDetails } from './StepDetails';
import { StepLocation } from './StepLocation';
import { StepEvidence } from './StepEvidence';
import { StepReview } from './StepReview';
import { LivePreview } from './LivePreview';
import { ANONYMOUS_MAX_SIZE_MB, ANONYMOUS_MEDIA_TYPES, DEFAULT_FORM, ReportForm, STEPS } from './types';

function validateStep(step: number, form: ReportForm, files: File[]): string | null {
  if (step === 0) {
    if (!form.title.trim() || form.title.length < 5) return 'Title must be at least 5 characters.';
    if (!form.description.trim() || form.description.length < 10) return 'Description must be at least 10 characters.';
    if (!form.category_id) return 'Please select a category.';
  }
  if (step === 1) {
    if (!form.address.trim()) return 'Please enter a location description.';
    if (!form.latitude || !form.longitude) return 'Please set GPS coordinates (use the GPS button or enter them manually).';
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
    if (isNaN(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
  }
  if (step === 2 && files.length === 0) {
    return 'Evidence is mandatory. Please upload at least one file showing the issue.';
  }
  return null;
}

function TrackingCodeScreen({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <AppLayout title="Report Submitted">
      <div className="max-w-xl mx-auto py-6 animate-fade_in">
        <div className="card p-5 sm:p-8">
          <CheckCircle2 size={36} className="text-state-success mb-4" />
          <h2 className="text-2xl font-bold text-content-primary mb-2">Save your tracking code</h2>
          <p className="text-content-secondary text-sm mb-5">
            This is the only way to follow your report or confirm a fix. We store no account or email for it,
            so <strong className="text-content-primary">this code cannot be recovered and is shown only once.</strong>
          </p>
          <code className="block break-all bg-base-950 border border-border-subtle rounded-xl p-4 text-sm text-content-primary mb-4">{token}</code>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={copy} className="btn-secondary flex-1 gap-2">
              <Copy size={15} /> {copied ? 'Copied' : 'Copy code'}
            </button>
            <Link href="/track" className="btn-accent flex-1">Go to tracking page</Link>
          </div>
          <p className="text-content-muted text-xs mt-5">
            Your report is reviewed before it appears publicly and is published automatically within 24 hours unless rejected.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

export function ReportWizard({ mode }: { mode: 'account' | 'anonymous' }) {
  const isAnonymous = mode === 'anonymous';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ReportForm>({ ...DEFAULT_FORM, is_anonymous: isAnonymous });
  const [files, setFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [progressLabel, setProgressLabel] = useState('Submitting…');
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [trackingToken, setTrackingToken] = useState('');

  useEffect(() => {
    if (!isAnonymous && !authLoading && !user) router.push('/login?redirect=/report');
  }, [isAnonymous, user, authLoading, router]);

  useEffect(() => {
    issuesApi.categories()
      .then(r => { if (r.data.categories?.length) setCategories(r.data.categories); })
      .catch(() => {})
      .finally(() => setCatLoading(false));
    adminApi.getPublicSettings()
      .then(r => setAllowAnonymous(r.data.enableAnonymousReporting !== false))
      .catch(() => {});
  }, []);

  const previewUrl = useMemo(() => {
    const imageFile = files.find(f => f.type.startsWith('image/'));
    return imageFile ? URL.createObjectURL(imageFile) : null;
  }, [files]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const setField = (field: keyof ReportForm, value: string | boolean) => {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  };

  const handleNext = () => {
    const err = validateStep(step, form, files);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = (target?: number) => {
    setError('');
    setStep(target !== undefined ? target : s => s - 1);
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('category_id', form.category_id);
    fd.append('severity', form.severity);
    fd.append('latitude', form.latitude);
    fd.append('longitude', form.longitude);
    fd.append('address', form.address);
    return fd;
  };

  const trackUpload = (percent: number) => setProgressLabel(percent < 100 ? `Uploading ${percent}%` : 'Submitting…');

  const submitAnonymously = async () => {
    setProgressLabel('Running security check…');
    const { data } = await anonymousApi.challenge();
    const solution = await solveChallenge(data.challenge, data.difficulty);
    const fd = buildFormData();
    fd.append('challenge', data.challenge);
    fd.append('solution', solution);
    files.forEach(f => fd.append('media', f));
    const res = await anonymousApi.submit(fd, trackUpload);
    setTrackingToken(res.data.trackingToken);
  };

  const submitWithAccount = async () => {
    const fd = buildFormData();
    fd.append('is_anonymous', String(form.is_anonymous && allowAnonymous));
    files.forEach(f => fd.append('media', f));
    const res = await issuesApi.create(fd, trackUpload);
    setSubmitted(true);
    setTimeout(() => router.push(res.data?.issue?.id ? `/issues/${res.data.issue.id}` : '/my-reports'), 1800);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setProgressLabel('Submitting…');
    setError('');
    try {
      await (isAnonymous ? submitAnonymously() : submitWithAccount());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; errors?: { message: string }[] } } };
      if (!isAnonymous && e.response?.status === 401) {
        setError('Session expired — please log in again.');
        setTimeout(() => router.push('/login?redirect=/report'), 2000);
      } else {
        setError(e.response?.data?.errors?.[0]?.message || e.response?.data?.error || 'Failed to submit. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = isAnonymous ? 'Report Anonymously' : 'Report Issue';

  if (trackingToken) return <TrackingCodeScreen token={trackingToken} />;

  if (!isAnonymous && authLoading) return (
    <AppLayout title={title}>
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );
  if (!isAnonymous && !user) return null;

  if (isAnonymous && !allowAnonymous) return (
    <AppLayout title={title}>
      <div className="card p-8 text-center text-content-secondary max-w-xl mx-auto">Anonymous reporting is currently disabled.</div>
    </AppLayout>
  );

  if (submitted) return (
    <AppLayout title={title}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade_in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-state-success/10 border border-state-success/20">
          <CheckCircle2 size={44} className="text-state-success" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-content-primary mb-3">Report Submitted</h2>
          <p className="text-content-secondary max-w-md">
            Thank you, {user?.name}. Your report has been filed. Redirecting to issue details...
          </p>
        </div>
      </div>
    </AppLayout>
  );

  const reporterName = isAnonymous ? 'Anonymous' : user?.name || '';

  return (
    <AppLayout
      title={title}
      sub={isAnonymous ? 'No account, name or email is stored with this report' : 'Document a problem in your community to notify the right authorities'}
    >
      <div className="pt-4">
        <StepIndicator current={step} onBack={handleBack} />

        {isAnonymous ? (
          <div className="max-w-5xl mx-auto flex items-start gap-3 rounded-xl p-4 mb-6 text-sm bg-accent-primary/5 border border-accent-primary/20 text-content-secondary">
            <ShieldCheck size={18} className="flex-shrink-0 mt-0.5 text-accent-primary" />
            <span>
              We don&apos;t save an account, email or IP address with this report, and we remove location data from your photos.
              Your internet provider and our hosting service can still see normal network traffic, so avoid details in your text that identify you.
            </span>
          </div>
        ) : (
          <p className="max-w-5xl mx-auto text-sm text-content-muted mb-6">
            Don&apos;t want your account linked to this report?{' '}
            <Link href="/report/anonymous" className="text-accent-secondary font-semibold hover:underline">Report anonymously</Link>
          </p>
        )}

        {error && (
          <div className="max-w-5xl mx-auto flex items-start gap-3 rounded-xl p-4 mb-6 text-sm bg-state-error/10 border border-state-error/20 text-state-error animate-fade_in">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6 animate-fade_in">
            <div>
              {step === 0 && (
                <StepDetails
                  form={form}
                  categories={categories}
                  catLoading={catLoading}
                  allowAnonymous={!isAnonymous && allowAnonymous}
                  onChange={setField}
                />
              )}
              {step === 1 && <StepLocation form={form} onChange={setField} onError={setError} />}
              {step === 2 && (isAnonymous ? (
                <StepEvidence
                  files={files}
                  onFilesChange={setFiles}
                  acceptedTypes={ANONYMOUS_MEDIA_TYPES}
                  maxSizeMb={ANONYMOUS_MAX_SIZE_MB}
                  formatsLabel="JPG, PNG, WEBP photos"
                />
              ) : (
                <StepEvidence files={files} onFilesChange={setFiles} />
              ))}
              {step === 3 && <StepReview form={form} categories={categories} files={files} userName={reporterName} />}
            </div>

            <div className="flex gap-4">
              {step > 0 && <button onClick={() => handleBack()} className="btn-secondary flex-1">Go Back</button>}
              {step < STEPS.length - 1 ? (
                <button onClick={handleNext} className="btn-primary flex-1">Continue</button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`btn-accent flex-1 flex items-center justify-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed shadow-none' : ''}`}
                >
                  {submitting
                    ? <><Loader2 size={18} className="animate-spin" /> {progressLabel}</>
                    : <><Zap size={18} fill="currentColor" /> Submit Report</>}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 hidden lg:block animate-fade_in">
            <LivePreview form={form} categories={categories} files={files} previewUrl={previewUrl} userName={reporterName} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
