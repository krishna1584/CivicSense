import type { Metadata } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Gives each issue its own browser title and share preview (link cards in chat apps).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/api/issues/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return { title: 'Issue' };
    const { issue } = await res.json();
    const description = String(issue.description || '').slice(0, 160);
    const image = issue.media?.find((m: { type: string; is_resolution: boolean }) => m.type === 'image' && !m.is_resolution)?.url;
    return {
      title: issue.title,
      description,
      openGraph: { title: issue.title, description, ...(image && { images: [image] }) },
    };
  } catch {
    return { title: 'Issue' };
  }
}

export default function IssueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
