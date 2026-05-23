'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Eye, EyeOff, Loader2, AlertCircle, Hexagon, ArrowRight, Check, X, CheckCircle2 } from 'lucide-react';

type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

function getStrength(pw: string): { level: StrengthLevel; score: number; checks: Record<string, boolean> } {
  const checks = {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  if (pw.length === 0) return { level: 'empty', score: 0, checks };
  if (score <= 1) return { level: 'weak', score, checks };
  if (score === 2) return { level: 'fair', score, checks };
  if (score === 3 || score === 4) return { level: 'good', score, checks };
  return { level: 'strong', score, checks };
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bars: number }> = {
  empty:  { label: '', color: 'rgb(var(--border-subtle))', bars: 0 },
  weak:   { label: 'Weak', color: '#FB7185', bars: 1 },
  fair:   { label: 'Fair', color: '#FBBF24', bars: 2 },
  good:   { label: 'Good', color: '#3B82F6', bars: 3 },
  strong: { label: 'Strong', color: '#4ADE80', bars: 4 },
};

const REQUIREMENT_LABELS: Record<string, string> = {
  length: 'At least 8 characters',
  uppercase: 'One uppercase letter',
  lowercase: 'One lowercase letter',
  number: 'One number',
  special: 'One special character',
};

export default function RegisterPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (user) {
      router.push(user.role === 'admin' || user.role === 'department_staff' ? '/admin' : '/dashboard');
    }
  }, [user, router]);

  const strength = useMemo(() => getStrength(form.password), [form.password]);
  const cfg = STRENGTH_CONFIG[strength.level];

  const passwordsMatch = form.confirm.length > 0 && form.password === form.confirm;
  const passwordMismatch = form.confirm.length > 0 && form.password !== form.confirm;

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (error) setError('');
  };

  const validate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) return 'Full name must be at least 2 characters.';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      const res = await authApi.register({ name: form.name.trim(), email: form.email, password: form.password });
      setUser(res.data.user);
      setSuccess(true);
      setTimeout(() => router.push('/verify-email?email=' + encodeURIComponent(form.email)), 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { message: string }[] }; status?: number } };
      const status = e?.response?.status;
      if (status === 409) setError('This email is already registered.');
      else if (status === 429) setError('Too many attempts. Please wait.');
      else setError(e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || 'Registration failed.');
    } finally { setLoading(false); }
  };

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
          <div className="flex items-center gap-4">
            <span className="text-sm text-content-muted hidden sm:inline">Already have an account?</span>
            <Link href="/login" className="btn-secondary text-xs py-1.5 px-3.5">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, rgb(var(--accent-secondary)) 0%, transparent 70%)', top: '-200px', left: '-100px' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(122,90,245,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(122,90,245,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="w-full max-w-[440px] relative z-10 animate-slide_up">
        {success && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl py-16 px-8 text-center bg-base-900/90 backdrop-blur-xl border border-state-success/30 shadow-card">
            <div className="w-16 h-16 rounded-full bg-state-success/15 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-state-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-content-primary">Account created!</p>
              <p className="text-content-muted text-sm mt-1">Redirecting to verification...</p>
            </div>
          </div>
        )}

        {!success && (
          <div className="rounded-2xl p-8 bg-base-900/90 backdrop-blur-xl border border-border-subtle shadow-card">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-content-primary tracking-tight">Create your account</h2>
              <p className="text-content-muted text-sm mt-1">Join the civic movement — it&apos;s free.</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm bg-state-error/10 border border-state-error/20 text-state-error">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="reg-name" className="label-micro block mb-2">Full Name</label>
                <input id="reg-name" type="text" autoComplete="name" placeholder="Jane Citizen"
                  value={form.name} onChange={handleChange('name')} required minLength={2} className="input-dark" />
              </div>

              <div>
                <label htmlFor="reg-email" className="label-micro block mb-2">Email Address</label>
                <input id="reg-email" type="email" autoComplete="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange('email')} required className="input-dark" />
              </div>

              <div>
                <label htmlFor="reg-password" className="label-micro block mb-2">Password</label>
                <div className="relative">
                  <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                    placeholder="Min. 8 characters" value={form.password} onChange={handleChange('password')} required minLength={8} className="input-dark pr-12" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors p-1">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {form.password.length > 0 && (
                  <div className="mt-3">
                    <div className="flex gap-1.5 mb-2">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i < cfg.bars ? cfg.color : 'rgb(var(--border-subtle))' }} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-xs text-content-muted">{strength.score}/5 checks</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-1.5">
                      {Object.entries(strength.checks).map(([key, met]) => (
                        <div key={key} className="flex items-center gap-2">
                          {met ? <Check size={12} className="text-state-success flex-shrink-0" /> : <X size={12} className="text-content-muted flex-shrink-0" />}
                          <span className="text-xs" style={{ color: met ? '#22C55E' : '#94A3B8' }}>{REQUIREMENT_LABELS[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm" className="label-micro block mb-2">Confirm Password</label>
                <div className="relative">
                  <input id="reg-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
                    placeholder="Repeat your password" value={form.confirm} onChange={handleChange('confirm')} required className="input-dark pr-12" />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors p-1">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordsMatch && <p className="text-xs text-state-success mt-1.5 flex items-center gap-1.5"><Check size={11} /> Passwords match</p>}
                {passwordMismatch && <p className="text-xs text-state-error mt-1.5 flex items-center gap-1.5"><X size={11} /> Passwords don&apos;t match</p>}
              </div>

              <p className="text-xs text-content-muted leading-relaxed pt-1">
                By creating an account you agree to our{' '}
                <span className="text-accent-secondary cursor-pointer hover:underline">Terms of Service</span> and{' '}
                <span className="text-accent-secondary cursor-pointer hover:underline">Privacy Policy</span>.
              </p>

              <button type="submit" disabled={loading || passwordMismatch}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 btn-accent disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-xs text-content-muted">or</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            <p className="text-center text-sm text-content-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-accent-secondary hover:text-accent-secondary/80 transition-colors">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
