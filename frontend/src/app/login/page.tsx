'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Eye, EyeOff, Loader2, AlertCircle, Hexagon, ArrowRight,
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
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(form);
      setUser(res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } };
      const status = e?.response?.status;
      if (status === 401) setError('Invalid email or password.');
      else if (status === 403) setError('Your account has been deactivated.');
      else if (status === 429) setError('Too many attempts. Please wait.');
      else setError(e?.response?.data?.error || 'Login failed.');
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
            <span className="text-sm text-content-muted hidden sm:inline">New to CivicSense?</span>
            <Link href="/register" className="btn-secondary text-xs py-1.5 px-3.5">
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, rgb(var(--accent-secondary)) 0%, transparent 70%)', top: '-200px', left: '-100px' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(122,90,245,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(122,90,245,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-slide_up">
        <div className="rounded-2xl p-8 bg-base-900/90 backdrop-blur-xl border border-border-subtle shadow-card">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-content-primary tracking-tight">Welcome back</h2>
            <p className="text-content-muted text-sm mt-1">Sign in to your CivicSense account</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm bg-state-error/10 border border-state-error/20 text-state-error">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="login-email" className="label-micro block mb-2">Email Address</label>
              <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com"
                value={form.email} onChange={handleChange('email')} required className="input-dark" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="label-micro">Password</label>
                <button type="button" className="text-xs text-accent-secondary hover:text-accent-secondary/80 transition-colors" tabIndex={-1}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Enter your password" value={form.password} onChange={handleChange('password')} required className="input-dark pr-12" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors p-1">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 btn-accent disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-xs text-content-muted">or</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          <p className="text-center text-sm text-content-muted">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-accent-secondary hover:text-accent-secondary/80 transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
