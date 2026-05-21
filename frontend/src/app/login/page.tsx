'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Eye, EyeOff, Loader2, AlertCircle, Zap, ArrowRight,
  Shield, MapPin, Users
} from 'lucide-react';

const FEATURES = [
  { icon: Shield, title: 'Secure Reporting', desc: 'Your data is encrypted and protected.' },
  { icon: MapPin, title: 'Location-aware', desc: 'Report issues pinned to exact locations.' },
  { icon: Users, title: 'Community-driven', desc: 'Upvote and follow civic issues that matter.' },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (user) {
      router.push(user.role === 'admin' || user.role === 'department_staff' ? '/admin' : '/dashboard');
    }
  }, [user, router]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(form);
      setUser(res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } };
      const status = e?.response?.status;
      if (status === 401) setError('Invalid email or password. Please try again.');
      else if (status === 403) setError('Your account has been deactivated. Contact support.');
      else if (status === 429) setError('Too many attempts. Please wait a moment.');
      else setError(e?.response?.data?.error || 'Login failed. Please try again.');
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
            <span className="text-sm text-[#9CA3AF] hidden sm:inline">New to CivicSense?</span>
            <Link href="/register" className="btn-outline text-xs py-1.5 px-3.5 border border-white/10 hover:bg-white/5 transition-all rounded-lg">
              Create Account
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
        className="w-full max-w-[420px] relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Card */}
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
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
            <p className="text-[#6B7280] text-sm mt-1">Sign in to your CivicSense account</p>
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
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-[11px] font-medium uppercase tracking-[1.5px] mb-2"
                style={{ color: focusedField === 'email' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
              >
                Email Address
              </label>
              <input
                id="login-email"
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
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-medium uppercase tracking-[1.5px]"
                  style={{ color: focusedField === 'password' ? '#61C0FF' : '#9CA3AF', transition: 'color 0.2s' }}
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-[#61C0FF] hover:text-[#00aaef] transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange('password')}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
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
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 mt-2"
              style={{
                background: loading ? 'rgba(97,192,255,0.5)' : 'linear-gradient(135deg, #00aaef 0%, #61C0FF 100%)',
                color: '#05070A',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(0,170,239,0.25)',
                transform: loading ? 'scale(0.99)' : 'scale(1)',
              }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
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
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-semibold transition-colors"
              style={{ color: '#61C0FF' }}
            >
              Create one free
            </Link>
          </p>
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
