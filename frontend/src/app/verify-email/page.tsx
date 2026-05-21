'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Zap, AlertCircle, Loader2, Mail, CheckCircle2, ArrowRight } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Redirect if verified
  useEffect(() => {
    if (user?.is_verified) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Handle countdown
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
    if (!targetEmail) {
      setError('Email address is missing.');
      return;
    }
    try {
      await authApi.sendOtp({ email: targetEmail });
      setCountdown(60);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resend OTP.');
    }
  };

  const handleVerification = async (code: string) => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    const targetEmail = emailParam || user?.email;
    if (!targetEmail) {
      setError('Email address is missing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp({ email: targetEmail, code });
      if (res.data.user) {
        setUser(res.data.user);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(res.data.user?.role === 'admin' ? '/admin' : '/dashboard');
      }, 5000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      // Focus last filled
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      if (pasted.length === 6) {
        handleVerification(pasted);
      }
      return;
    }

    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (value && index === 5) {
      handleVerification(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleVerification(otp.join(''));
  };

  const targetEmail = emailParam || user?.email || 'your email';

  return (
    <div className="min-h-screen bg-[#05070A] flex flex-col items-center justify-center pt-24 pb-16 px-4 relative overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 bg-[#05070A]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#00aaef]/20 flex items-center justify-center group-hover:bg-[#00aaef]/30 transition-colors">
              <Zap size={16} className="text-[#00aaef]" />
            </div>
            <span className="font-bold text-lg text-white">Civic<span className="text-[#00aaef]">Sense</span></span>
          </Link>
          {user ? (
            <button onClick={() => { authApi.logout().then(() => { setUser(null); router.push('/login'); }) }} className="text-sm text-[#9CA3AF] hover:text-white transition-colors">
              Log out
            </button>
          ) : (
            <Link href="/login" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">
              Back to Login
            </Link>
          )}
        </div>
      </nav>

      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle, #00aaef 0%, transparent 70%)',
            top: '-200px', left: '-100px',
            animation: mounted ? 'float1 8s ease-in-out infinite' : 'none',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #61C0FF 0%, transparent 70%)',
            bottom: '-100px', right: '20%',
            animation: mounted ? 'float2 10s ease-in-out infinite' : 'none',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(97,192,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(97,192,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Form wrapper */}
      <div
        className="w-full max-w-[460px] relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'rgba(11, 15, 20, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {success ? (
            <div className="py-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={32} className="text-[#22C55E]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
              <p className="text-[#9CA3AF] mb-6">Redirecting you to dashboard...</p>
              <Loader2 size={24} className="animate-spin text-[#61C0FF]" />
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-[#00aaef]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Mail size={24} className="text-[#00aaef]" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Verify your email</h2>
              <p className="text-[#9CA3AF] text-sm mb-8 leading-relaxed">
                We sent a 6-digit code to <span className="text-white font-medium">{targetEmail}</span>.
                Enter it below to confirm your address.
              </p>

              {error && (
                <div
                  className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm text-left"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#F87171',
                  }}
                >
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex items-center justify-center gap-2.5 mb-8">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={e => handleChange(idx, e.target.value)}
                      onKeyDown={e => handleKeyDown(idx, e)}
                      className="w-12 h-14 rounded-xl text-center text-xl font-bold text-white outline-none transition-all duration-200"
                      style={{
                        background: '#0E131A',
                        border: `1px solid ${digit ? 'rgba(97,192,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        boxShadow: digit ? '0 0 0 2px rgba(97,192,255,0.08)' : 'none',
                      }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join('').length !== 6}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200"
                  style={{
                    background: (loading || otp.join('').length !== 6) ? 'rgba(97,192,255,0.2)' : 'linear-gradient(135deg, #00aaef 0%, #61C0FF 100%)',
                    color: (loading || otp.join('').length !== 6) ? 'rgba(255,255,255,0.5)' : '#05070A',
                    boxShadow: (loading || otp.join('').length !== 6) ? 'none' : '0 4px 24px rgba(0,170,239,0.25)',
                    transform: loading ? 'scale(0.99)' : 'scale(1)',
                    cursor: (loading || otp.join('').length !== 6) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Verifying...</>
                  ) : (
                    <>Verify Email <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="mt-8 text-sm">
                <span className="text-[#6B7280]">Didn't receive the code? </span>
                {countdown > 0 ? (
                  <span className="text-[#9CA3AF]">Resend in {countdown}s</span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="text-[#61C0FF] hover:text-[#00aaef] font-medium transition-colors"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 20px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, -30px); }
        }
      `}</style>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05070A]" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
