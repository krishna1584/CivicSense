'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Hexagon, Zap } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1400));
    setLoading(false);
    setError('Invalid credentials. Please try again.');
  };

  const handleDemo = async () => {
    setError('');
    setDemoLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setDemoLoading(false);
  };

  return (
    <div className="min-h-screen bg-base-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(122,90,245,0.06) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

      <div className="flex flex-col items-center mb-8 animate-fade_in">
        <div className="w-16 h-16 rounded-2xl bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center mb-4 shadow-glow-primary">
          <Shield size={28} className="text-accent-primary" />
        </div>
        <span className="text-2xl font-black tracking-tight text-content-primary">
          Civic<span className="text-accent-primary">Sense</span>
        </span>
        <span className="text-[11px] text-content-muted uppercase tracking-[3px] mt-1 font-medium">Admin Portal</span>
      </div>

      <div className="w-full max-w-sm animate-slide_up">
        <div className="rounded-2xl p-7 border border-border-subtle bg-base-900/90 backdrop-blur-xl shadow-card">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-content-primary mb-1">Access Command Center</h1>
            <p className="text-sm text-content-muted">Sign in to your CivicSense account</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-state-error/10 border border-state-error/20 mb-5">
              <AlertCircle size={14} className="text-state-error shrink-0" />
              <p className="text-xs text-state-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-micro block mb-2">Email</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} className="input-dark" autoComplete="email" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-micro">Password</label>
                <button type="button" className="text-xs text-accent-primary hover:text-accent-primary/80 transition-colors font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} className="input-dark pr-12" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors p-1">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-base-950 bg-accent-primary hover:bg-accent-primary_hover transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-primary">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="divider my-5 text-content-muted text-[10px] uppercase tracking-wider font-semibold flex items-center gap-3">
            <span className="flex-1 h-px bg-border-subtle" />
            Quick demo access
            <span className="flex-1 h-px bg-border-subtle" />
          </div>

          <button onClick={handleDemo} disabled={demoLoading}
            className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold text-content-primary border border-border-subtle bg-base-850 hover:bg-base-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {demoLoading
              ? <Loader2 size={15} className="animate-spin text-content-muted" />
              : <><Zap size={14} className="text-accent-primary" /> Sign In as Admin (Demo)</>
            }
          </button>

          <p className="text-center text-sm text-content-muted mt-5">
            Don't have an account?{' '}
            <Link href="/register" className="text-accent-primary hover:text-accent-primary/80 font-semibold transition-colors">Sign up</Link>
          </p>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-content-muted">© 2026 CivicSense. All rights reserved.</p>
    </div>
  );
}
