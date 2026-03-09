'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Zap, Loader2, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(form);
      setUser(res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070A] flex items-center justify-center px-4 bg-grid">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00FF94]/20 flex items-center justify-center">
              <Zap size={20} className="text-[#00FF94]" />
            </div>
            <span className="font-bold text-xl">Civic<span className="text-[#00FF94]">Sense</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-gradient">Welcome back</h1>
          <p className="text-[#9CA3AF] mt-1 text-sm">Sign in to your account</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 flex items-center gap-2 text-[#EF4444] text-sm mb-5">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-micro block mb-1.5">Email Address</label>
              <input type="email" className="input-dark" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Password</label>
              <input type="password" className="input-dark" placeholder="••••••••"
                value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-[#9CA3AF] text-sm mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#00FF94] hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
