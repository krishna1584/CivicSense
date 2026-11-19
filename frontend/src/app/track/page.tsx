'use client';
import { useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Hexagon, Loader2, XCircle } from 'lucide-react';
import { anonymousApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { IssueStatus } from '@/types';

interface TrackedReport {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  address?: string;
  category_name?: string;
  category_icon?: string;
  created_at: string;
  moderation_status: 'held' | 'approved' | 'rejected';
  publish_after?: string | null;
  is_public: boolean;
  rejection_reason?: string | null;
  media: { id: string; url: string; is_resolution: boolean }[];
  history: { id: string; status: IssueStatus; comment?: string; updated_at: string }[];
}

const apiError = (err: unknown, fallback: string) => {
  const e = err as { response?: { status?: number; data?: { error?: string; errors?: { message: string }[] } } };
  if (e?.response?.status === 422) return 'That doesn’t look like a valid tracking code.';
  return e?.response?.data?.error || fallback;
};

export default function TrackReportPage() {
  // Held in memory only, so the code is never written to this device.
  const [token, setToken] = useState('');
  const [report, setReport] = useState<TrackedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const lookup = async () => {
    const res = await anonymousApi.track(token.trim());
    setReport(res.data.issue);
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      await lookup();
    } catch (err) {
      setError(apiError(err, 'Could not load this report.'));
    } finally {
      setLoading(false);
    }
  };

  const decide = async (approved: boolean) => {
    if (!approved && !rejectReason.trim()) { setError('Please say what is still wrong.'); return; }
    setDeciding(true);
    setError('');
    try {
      await anonymousApi.decide({ token: token.trim(), approved, comment: approved ? undefined : rejectReason.trim() });
      setRejecting(false);
      setRejectReason('');
      await lookup();
    } catch (err) {
      setError(apiError(err, 'Could not save your decision.'));
    } finally {
      setDeciding(false);
    }
  };

  const proof = report?.media.filter(m => m.is_resolution) || [];

  return (
    <div className="min-h-screen bg-base-950 pt-24 pb-16 px-4">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center">
              <Hexagon size={16} className="text-accent-primary" />
            </div>
            <span className="font-bold text-lg text-content-primary">Civic<span className="text-accent-secondary">Sense</span></span>
          </Link>
          <Link href="/report/anonymous" className="text-sm text-content-muted hover:text-content-primary transition-colors">Report anonymously</Link>
        </div>
      </nav>

      <div className="max-w-xl mx-auto space-y-5 animate-slide_up">
        <div className="rounded-2xl p-5 sm:p-8 bg-base-900/90 border border-border-subtle shadow-card">
          <h1 className="text-2xl font-bold text-content-primary tracking-tight mb-1">Track an anonymous report</h1>
          <p className="text-content-muted text-sm mb-6">Enter the tracking code you received when you submitted your report.</p>

          <form onSubmit={handleTrack} className="space-y-4">
            <div>
              <label htmlFor="tracking-code" className="label-micro block mb-2">Tracking Code</label>
              <input id="tracking-code" autoComplete="off" spellCheck={false} value={token}
                onChange={e => setToken(e.target.value)} className="input-dark font-mono text-sm" />
            </div>
            <button type="submit" disabled={loading || !token.trim()} className="w-full gap-2 py-3 text-sm btn-accent disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Looking up…</> : 'Track Report'}
            </button>
          </form>

          {error && (
            <div className="flex items-start gap-3 rounded-xl p-3.5 mt-5 text-sm bg-state-error/10 border border-state-error/20 text-state-error">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {report && (
          <div className="rounded-2xl p-5 sm:p-8 bg-base-900/90 border border-border-subtle shadow-card space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={report.status} />
                {report.category_name && <span className="text-xs text-content-muted">{report.category_icon} {report.category_name}</span>}
              </div>
              <h2 className="text-xl font-bold text-content-primary break-words">{report.title}</h2>
              <p className="text-xs text-content-muted mt-1">Submitted {format(new Date(report.created_at), 'MMM d, yyyy')}{report.address ? ` · ${report.address}` : ''}</p>
            </div>

            {report.moderation_status === 'rejected' ? (
              <div className="rounded-xl p-4 text-sm bg-state-error/10 border border-state-error/20 text-content-secondary">
                <strong className="text-state-error block mb-1">Not published</strong>
                Reason given by the reviewer: {report.rejection_reason}
              </div>
            ) : !report.is_public && report.publish_after ? (
              <div className="rounded-xl p-4 text-sm bg-accent-primary/5 border border-accent-primary/20 text-content-secondary">
                Under review. It will be published automatically {formatDistanceToNow(new Date(report.publish_after), { addSuffix: true })} unless rejected.
              </div>
            ) : (
              <Link href={`/issues/${report.id}`} className="text-sm text-accent-secondary font-semibold hover:underline">View public issue page →</Link>
            )}

            {report.status === 'pending_verification' && (
              <div className="rounded-xl p-4 bg-accent-secondary/5 border border-accent-secondary/20 space-y-4">
                <div>
                  <h3 className="font-bold text-content-primary">Was this actually fixed?</h3>
                  <p className="text-sm text-content-secondary mt-1">If you don&apos;t respond within 7 days, this report closes automatically.</p>
                </div>
                {proof.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {proof.map(m => <img key={m.id} src={m.url} alt="Resolution proof" className="w-full aspect-[4/3] object-cover rounded-lg border border-border-subtle" />)}
                  </div>
                )}
                {rejecting && (
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} maxLength={1000}
                    placeholder="What is still wrong?" className="input-dark resize-none text-sm" />
                )}
                <div className="flex flex-wrap gap-3">
                  {rejecting ? (
                    <>
                      <button onClick={() => decide(false)} disabled={deciding} className="btn-accent text-sm gap-2 disabled:opacity-60">
                        {deciding ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Submit
                      </button>
                      <button onClick={() => setRejecting(false)} disabled={deciding} className="btn-secondary text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => decide(true)} disabled={deciding} className="btn-accent text-sm gap-2 disabled:opacity-60">
                        {deciding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Yes, it&apos;s fixed
                      </button>
                      <button onClick={() => setRejecting(true)} disabled={deciding} className="btn-secondary text-sm">No, still broken</button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="label-micro mb-3">Timeline</h3>
              <ul className="space-y-3">
                {report.history.map(h => (
                  <li key={h.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={h.status} size="sm" />
                      <span className="text-xs text-content-muted">{formatDistanceToNow(new Date(h.updated_at), { addSuffix: true })}</span>
                    </div>
                    {h.comment && <p className="text-content-secondary mt-1 break-words">{h.comment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
