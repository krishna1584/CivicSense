'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Zap, Loader2, AlertTriangle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.register(form);
      setUser(res.data.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; errors?: { message: string }[] } } };
      setError(e?.response?.data?.errors?.[0]?.message || e?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070A] flex items-center justify-center px-4 bg-grid">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00aaef]/20 flex items-center justify-center">
              <Zap size={20} className="text-[#00aaef]" />
            </div>
            <span className="font-bold text-xl">Civic<span className="text-[#00aaef]">Sense</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-gradient">Create your account</h1>
          <p className="text-[#9CA3AF] mt-1 text-sm">Join the civic movement</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 flex items-center gap-2 text-[#EF4444] text-sm mb-5">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-micro block mb-1.5">Full Name</label>
              <input type="text" className="input-dark" placeholder="John Citizen"
                value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required minLength={2} />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Email Address</label>
              <input type="email" className="input-dark" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label-micro block mb-1.5">Password</label>
              <input type="password" className="input-dark" placeholder="Min. 8 characters"
                value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-[#9CA3AF] text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-[#00aaef] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
