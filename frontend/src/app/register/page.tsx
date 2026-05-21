'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Eye, EyeOff, Loader2, AlertCircle, Zap, ArrowRight,
  Check, X, CheckCircle2
} from 'lucide-react';


/* ── Password strength ─────────────────────────────────── */
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
  empty:  { label: '',       color: 'rgba(255,255,255,0.06)', bars: 0 },
  weak:   { label: 'Weak',   color: '#EF4444', bars: 1 },
  fair:   { label: 'Fair',   color: '#F59E0B', bars: 2 },
  good:   { label: 'Good',   color: '#3B82F6', bars: 3 },
  strong: { label: 'Strong', color: '#10B981', bars: 4 },
};

const REQUIREMENT_LABELS: Record<string, string> = {
  length:    'At least 8 characters',
  uppercase: 'One uppercase letter',
  lowercase: 'One lowercase letter',
  number:    'One number',
  special:   'One special character',
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
    if (!form.name.trim() || form.name.trim().length < 2)
      return 'Full name must be at least 2 characters.';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Please enter a valid email address.';
    if (form.password.length < 8)
      return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm)
      return 'Passwords do not match.';
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
      if (status === 409) setError('This email is already registered. Try signing in instead.');
      else if (status === 429) setError('Too many attempts. Please wait a moment.');
      else setError(e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#9CA3AF] hidden sm:inline">Already have an account?</span>
            <Link href="/login" className="btn-outline text-xs py-1.5 px-3.5 border border-white/10 hover:bg-white/5 transition-all rounded-lg">
              Sign In
            </Link>
          </div>
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
        {/* Grid */}
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
        className="w-full max-w-[440px] relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Success overlay */}
        {success && (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl py-16 px-8 text-center"
            style={{
              background: 'rgba(11,15,20,0.9)',
              border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 0 60px rgba(16,185,129,0.08)',
            }}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">Account created!</p>
              <p className="text-[#6B7280] text-sm mt-1">Redirecting to verification…</p>
            </div>
          </div>
        )}

        {!success && (
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(11, 15, 20, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white tracking-tight">Create your account</h2>
              <p className="text-[#6B7280] text-sm mt-1">Join the civic movement — it&apos;s free.</p>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm"
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

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-[11px] font-medium uppercase tracking-[1.5px] mb-2"
                  style={{ color: focusedField === 'name' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
                >
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Citizen"
                  value={form.name}
                  onChange={handleChange('name')}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  required
                  minLength={2}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-[#4B5563] text-sm outline-none transition-all duration-200"
                  style={{
                    background: '#0E131A',
                    border: `1px solid ${focusedField === 'name' ? 'rgba(97,192,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: focusedField === 'name' ? '0 0 0 3px rgba(97,192,255,0.08)' : 'none',
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-[11px] font-medium uppercase tracking-[1.5px] mb-2"
                  style={{ color: focusedField === 'email' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
                >
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange('email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-[#4B5563] text-sm outline-none transition-all duration-200"
                  style={{
                    background: '#0E131A',
                    border: `1px solid ${focusedField === 'email' ? 'rgba(97,192,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(97,192,255,0.08)' : 'none',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-[11px] font-medium uppercase tracking-[1.5px] mb-2"
                  style={{ color: focusedField === 'password' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={handleChange('password')}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    minLength={8}
                    className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder-[#4B5563] text-sm outline-none transition-all duration-200"
                    style={{
                      background: '#0E131A',
                      border: `1px solid ${focusedField === 'password' ? 'rgba(97,192,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(97,192,255,0.08)' : 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#9CA3AF] transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength bars */}
                {form.password.length > 0 && (
                  <div className="mt-3">
                    <div className="flex gap-1.5 mb-2">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            background: i < cfg.bars ? cfg.color : 'rgba(255,255,255,0.06)',
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-xs text-[#4B5563]">{strength.score}/5 checks</span>
                    </div>

                    {/* Requirements */}
                    <div className="mt-3 grid grid-cols-1 gap-1.5">
                      {Object.entries(strength.checks).map(([key, met]) => (
                        <div key={key} className="flex items-center gap-2">
                          {met
                            ? <Check size={12} className="text-emerald-400 flex-shrink-0" />
                            : <X size={12} className="text-[#4B5563] flex-shrink-0" />
                          }
                          <span className="text-xs" style={{ color: met ? '#6EE7B7' : '#6B7280' }}>
                            {REQUIREMENT_LABELS[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="reg-confirm"
                  className="block text-[11px] font-medium uppercase tracking-[1.5px] mb-2"
                  style={{ color: focusedField === 'confirm' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={handleChange('confirm')}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder-[#4B5563] text-sm outline-none transition-all duration-200"
                    style={{
                      background: '#0E131A',
                      border: `1px solid ${
                        passwordMismatch
                          ? 'rgba(239,68,68,0.4)'
                          : passwordsMatch
                          ? 'rgba(16,185,129,0.4)'
                          : focusedField === 'confirm'
                          ? 'rgba(97,192,255,0.4)'
                          : 'rgba(255,255,255,0.06)'
                      }`,
                      boxShadow: focusedField === 'confirm' ? '0 0 0 3px rgba(97,192,255,0.08)' : 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#9CA3AF] transition-colors p-1"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordsMatch && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5">
                    <Check size={11} /> Passwords match
                  </p>
                )}
                {passwordMismatch && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                    <X size={11} /> Passwords don&apos;t match
                  </p>
                )}
              </div>

              {/* Terms */}
              <p className="text-xs text-[#4B5563] leading-relaxed pt-1">
                By creating an account you agree to our{' '}
                <span className="text-[#61C0FF] cursor-pointer hover:underline">Terms of Service</span>{' '}
                and{' '}
                <span className="text-[#61C0FF] cursor-pointer hover:underline">Privacy Policy</span>.
              </p>

              {/* Submit */}
              <button
                id="register-submit"
                type="submit"
                disabled={loading || passwordMismatch}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200"
                style={{
                  background:
                    loading || passwordMismatch
                      ? 'rgba(97,192,255,0.3)'
                      : 'linear-gradient(135deg, #00aaef 0%, #61C0FF 100%)',
                  color: loading || passwordMismatch ? 'rgba(5,7,10,0.5)' : '#05070A',
                  boxShadow: loading || passwordMismatch ? 'none' : '0 4px 24px rgba(0,170,239,0.25)',
                  cursor: passwordMismatch ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                ) : (
                  <>Create Account <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-[#4B5563]">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <p className="text-center text-sm" style={{ color: '#6B7280' }}>
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold transition-colors"
                style={{ color: '#61C0FF' }}
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
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
