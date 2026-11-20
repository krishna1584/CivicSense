import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/Toaster';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: {
    default: 'CivicSense – Citizen Issue Reporting',
    template: '%s · CivicSense',
  },
  description: 'Report civic issues, follow them to the fix, and confirm when they are resolved.',
  keywords: ['civic', 'issue reporting', 'government', 'transparency'],
  openGraph: {
    siteName: 'CivicSense',
    type: 'website',
  },
};

// Applies the saved theme before the first paint, so dark mode doesn't flash light.
const themeScript = `try{var t=localStorage.getItem('civicsense-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-base-950 text-content-primary antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
