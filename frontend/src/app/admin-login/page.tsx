'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Zap } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    // TODO: wire to backend auth
    await new Promise(r => setTimeout(r, 1400));
    setLoading(false);
    setError('Invalid credentials. Please try again.');
  };

  const handleDemo = async () => {
    setError('');
    setDemoLoading(true);
    // TODO: wire to backend demo login
    await new Promise(r => setTimeout(r, 1000));
    setDemoLoading(false);
    // router.push('/admin')
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bgPulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        .login-card { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .logo-wrap  { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
        .glow-green { box-shadow: 0 0 40px rgba(0,255,148,0.25), 0 0 80px rgba(0,255,148,0.08); }
        .btn-signin {
          background: linear-gradient(135deg, #00FF94 0%, #00d97e 100%);
          color: #05070A;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .btn-signin:hover:not(:disabled) {
          box-shadow: 0 0 24px rgba(0,255,148,0.5);
          transform: translateY(-1px);
        }
        .btn-signin:active:not(:disabled) { transform: translateY(0); }
        .btn-signin:disabled { opacity: 0.6; cursor: not-allowed; }
        .input-field {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          border-radius: 12px;
          padding: 12px 16px;
          width: 100%;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .input-field::placeholder { color: #4B5563; }
        .input-field:focus {
          border-color: rgba(0,255,148,0.35);
          box-shadow: 0 0 0 3px rgba(0,255,148,0.08);
        }
        .divider {
          display: flex; align-items: center; gap: 12px;
          color: #374151; font-size: 10px; letter-spacing: 2px;
          text-transform: uppercase; font-weight: 600;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1;
          height: 1px; background: rgba(255,255,255,0.06);
        }
      `}</style>

      <div className="min-h-screen bg-[#05070A] flex flex-col items-center justify-center px-4 relative overflow-hidden">

        {/* Background grid */}
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />

        {/* Radial glow behind card */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(0,255,148,0.06) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            animation: 'bgPulse 4s ease-in-out infinite',
          }}
        />

        {/* Logo */}
        <div className="logo-wrap flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#00FF94]/15 border border-[#00FF94]/25 flex items-center justify-center mb-4 glow-green">
            <Shield size={28} className="text-[#00FF94]" />
          </div>
          <span className="text-2xl font-black tracking-tight">
            Civic<span className="text-[#00FF94]">Sense</span>
          </span>
          <span className="text-[11px] text-[#4B5563] uppercase tracking-[3px] mt-1 font-medium">Admin Portal</span>
        </div>

        {/* Card */}
        <div className="login-card w-full max-w-sm">
          <div
            className="rounded-2xl p-7 border border-white/[0.07]"
            style={{ background: 'rgba(11,15,20,0.92)', backdropFilter: 'blur(20px)' }}
          >
            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-lg font-bold text-white mb-1">Access Command Center</h1>
              <p className="text-sm text-[#6B7280]">Sign in to your CivicSense account</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 mb-5">
                <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
                <p className="text-xs text-[#EF4444]">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#9CA3AF] mb-2">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#9CA3AF]">Password</label>
                  <button type="button" className="text-xs text-[#00FF94] hover:text-[#00d97e] transition-colors font-medium">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#9CA3AF] transition-colors p-1"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Sign In */}
              <button
                type="submit"
                disabled={loading}
                className="btn-signin w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm mt-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="divider my-5">Quick demo access</div>

            {/* Demo button */}
            <button
              onClick={handleDemo}
              disabled={demoLoading}
              className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {demoLoading
                ? <Loader2 size={15} className="animate-spin text-[#9CA3AF]" />
                : <>
                    <Zap size={14} className="text-[#00FF94]" />
                    Sign In as Admin (Demo)
                  </>
              }
            </button>

            {/* Register */}
            <p className="text-center text-sm text-[#6B7280] mt-5">
              Don't have an account?{' '}
              <Link href="/register" className="text-[#00FF94] hover:text-[#00d97e] font-semibold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-[11px] text-[#374151]">© 2026 CivicSense. All rights reserved.</p>
      </div>
    </>
  );
}
