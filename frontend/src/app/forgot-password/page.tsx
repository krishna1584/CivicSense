'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { AlertCircle, CheckCircle2, Hexagon, Loader2 } from 'lucide-react';

type Step = 'email' | 'reset' | 'done';

const errorMessage = (err: unknown, fallback: string) => {
  const e = err as { response?: { status?: number; data?: { error?: string; errors?: { message: string }[] } } };
  if (e?.response?.status === 429) return 'Too many attempts. Please wait.';
  return e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || fallback;
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setStep('reset');
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { setError('Please enter the 6-digit code.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ email: email.trim(), code: code.trim(), password });
      setStep('done');
    } catch (err) {
      setError(errorMessage(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-950 flex flex-col items-center justify-center pt-24 pb-16 px-4">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center">
              <Hexagon size={16} className="text-accent-primary" />
            </div>
            <span className="font-bold text-lg text-content-primary">Civic<span className="text-accent-secondary">Sense</span></span>
          </Link>
          <Link href="/login" className="text-sm text-content-muted hover:text-content-primary transition-colors">Back to Login</Link>
        </div>
      </nav>

      <div className="w-full max-w-[420px] animate-slide_up">
        <div className="rounded-2xl p-6 sm:p-8 bg-base-900/90 border border-border-subtle shadow-card">
          {step === 'done' ? (
            <div className="py-6 flex flex-col items-center text-center">
              <CheckCircle2 size={36} className="text-state-success mb-4" />
              <h2 className="text-2xl font-bold text-content-primary mb-2">Password updated</h2>
              <p className="text-content-muted text-sm mb-6">You can now sign in with your new password.</p>
              <Link href="/login" className="btn-accent w-full">Go to Sign In</Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-content-primary tracking-tight">Reset your password</h2>
                <p className="text-content-muted text-sm mt-1">
                  {step === 'email'
                    ? "Enter your email and we'll send you a 6-digit code."
                    : `If ${email} is registered, a code is on its way. It expires in 10 minutes.`}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm bg-state-error/10 border border-state-error/20 text-state-error">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {step === 'email' ? (
                <form onSubmit={handleRequestCode} noValidate className="space-y-5">
                  <div>
                    <label htmlFor="reset-email" className="label-micro block mb-2">Email Address</label>
                    <input id="reset-email" type="email" autoComplete="email" placeholder="you@example.com"
                      value={email} onChange={e => setEmail(e.target.value)} className="input-dark" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full gap-2.5 py-3.5 text-sm btn-accent disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleReset} noValidate className="space-y-5">
                  <div>
                    <label htmlFor="reset-code" className="label-micro block mb-2">6-Digit Code</label>
                    <input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                      value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="input-dark" />
                  </div>
                  <div>
                    <label htmlFor="reset-password" className="label-micro block mb-2">New Password</label>
                    <input id="reset-password" type="password" autoComplete="new-password" placeholder="Min. 8 characters"
                      value={password} onChange={e => setPassword(e.target.value)} className="input-dark" />
                  </div>
                  <div>
                    <label htmlFor="reset-confirm" className="label-micro block mb-2">Confirm New Password</label>
                    <input id="reset-confirm" type="password" autoComplete="new-password"
                      value={confirm} onChange={e => setConfirm(e.target.value)} className="input-dark" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full gap-2.5 py-3.5 text-sm btn-accent disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : 'Update Password'}
                  </button>
                  <button type="button" onClick={() => { setStep('email'); setError(''); }}
                    className="w-full text-sm text-content-muted hover:text-content-primary transition-colors">
                    Use a different email or send a new code
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
