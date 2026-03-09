import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

export const metadata: Metadata = {
  title: 'CivicSense – Citizen Issue Reporting Platform',
  description: 'Report, track, and monitor civic issues with real-time transparency.',
  keywords: ['civic', 'issue reporting', 'government', 'transparency'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#05070A] text-white antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
