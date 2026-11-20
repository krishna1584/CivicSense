import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Explore Issues' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
