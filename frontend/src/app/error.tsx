'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-base-950 flex items-center justify-center px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-state-error/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={26} className="text-state-error" />
        </div>
        <h1 className="text-2xl font-bold text-content-primary mb-2">Something went wrong</h1>
        <p className="text-content-secondary text-sm mb-6">This page hit an unexpected error. Trying again usually fixes it.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary text-sm">Try again</button>
          <Link href="/" className="btn-secondary text-sm">Go home</Link>
        </div>
      </div>
    </main>
  );
}
