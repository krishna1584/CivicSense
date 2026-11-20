import Link from 'next/link';
import { Compass } from 'lucide-react';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="min-h-screen bg-base-950 flex items-center justify-center px-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto mb-5">
          <Compass size={26} className="text-accent-primary" />
        </div>
        <h1 className="text-2xl font-bold text-content-primary mb-2">Page not found</h1>
        <p className="text-content-secondary text-sm mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary text-sm">Go home</Link>
          <Link href="/explore" className="btn-secondary text-sm">Explore issues</Link>
        </div>
      </div>
    </main>
  );
}
