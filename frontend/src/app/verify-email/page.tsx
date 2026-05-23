'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Hexagon, AlertCircle, Loader2, Mail, CheckCircle2, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');
  const { user, setUser } = useAuthStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user?.is_verified) router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (countdown > 0 && !success) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, success]);

  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    const targetEmail = emailParam || user?.email;
    if (!targetEmail) { setError('Email address is missing.'); return; }
    try {
      await authApi.sendOtp({ email: targetEmail });
      setCountdown(60);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resend OTP.');
    }
  };

  const handleVerification = async (code: string) => {
    if (code.length !== 6) { setError('Please enter the 6-digit verification code.'); return; }
    const targetEmail = emailParam || user?.email;
    if (!targetEmail) { setError('Email address is missing.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp({ email: targetEmail, code });
      if (res.data.user) setUser(res.data.user);
      setSuccess(true);
      setTimeout(() => router.push(res.data.user?.role === 'admin' ? '/admin' : '/dashboard'), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid verification code.');
    } finally { setLoading(false); }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
      setOtp(newOtp);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
      if (pasted.length === 6) handleVerification(pasted);
      return;
    }
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    else if (value && index === 5) handleVerification(newOtp.join(''));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const targetEmail = emailParam || user?.email || 'your email';

  return (
    <div className="min-h-screen bg-base-950 flex flex-col items-center justify-center pt-24 pb-16 px-4 relative overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center group-hover:bg-accent-primary/25 transition-colors">
              <Hexagon size={16} className="text-accent-primary" />
            </div>
            <span className="font-bold text-lg text-content-primary">Civic<span className="text-accent-secondary">Sense</span></span>
          </Link>
          {user ? (
            <button onClick={() => { authApi.logout().then(() => { setUser(null); router.push('/login'); }) }} className="text-sm text-content-muted hover:text-content-primary transition-colors">
              Log out
            </button>
          ) : (
            <Link href="/login" className="text-sm text-content-muted hover:text-content-primary transition-colors">Back to Login</Link>
          )}
        </div>
      </nav>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, rgb(var(--accent-secondary)) 0%, transparent 70%)', top: '-200px', left: '-100px' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(122,90,245,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(122,90,245,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="w-full max-w-[460px] relative z-10 animate-slide_up">
        <div className="rounded-2xl p-8 text-center bg-base-900/90 backdrop-blur-xl border border-border-subtle shadow-card">
          {success ? (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-state-success/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={32} className="text-state-success" />
              </div>
              <h2 className="text-2xl font-bold text-content-primary mb-2">Email Verified!</h2>
              <p className="text-content-muted mb-6">Redirecting you to dashboard...</p>
              <Loader2 size={24} className="animate-spin text-accent-secondary" />
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Mail size={24} className="text-accent-primary" />
              </div>
              <h2 className="text-2xl font-bold text-content-primary tracking-tight mb-2">Verify your email</h2>
              <p className="text-content-muted text-sm mb-8 leading-relaxed">
                We sent a 6-digit code to <span className="text-content-primary font-medium">{targetEmail}</span>.
                Enter it below to confirm your address.
              </p>

              {error && (
                <div className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm text-left bg-state-error/10 border border-state-error/20 text-state-error">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleVerification(otp.join('')); }}>
                <div className="flex items-center justify-center gap-2.5 mb-8">
                  {otp.map((digit, idx) => (
                    <input key={idx} ref={el => { inputRefs.current[idx] = el; }}
                      type="text" inputMode="numeric" maxLength={6} value={digit}
                      onChange={e => handleChange(idx, e.target.value)}
                      onKeyDown={e => handleKeyDown(idx, e)}
                      className="w-12 h-14 rounded-xl text-center text-xl font-bold text-content-primary outline-none transition-all duration-200 bg-base-950 border border-border-subtle focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/10" />
                  ))}
                </div>

                <button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 btn-accent disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <>Verify Email <ArrowRight size={16} /></>}
                </button>
              </form>

              <div className="mt-8 text-sm">
                <span className="text-content-muted">Didn't receive the code? </span>
                {countdown > 0 ? (
                  <span className="text-content-secondary">Resend in {countdown}s</span>
                ) : (
                  <button onClick={handleResend} className="text-accent-secondary hover:text-accent-secondary/80 font-medium transition-colors">
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-950" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
