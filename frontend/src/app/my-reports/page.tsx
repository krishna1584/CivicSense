'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { IssueCard } from '@/components/ui/IssueCard';
import { usersApi } from '@/lib/api';
import { Issue } from '@/types';
import { FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function MyReportsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.myIssues({ limit: 50 })
      .then((res) => {
        setIssues(res.data.issues);
        setTotal(res.data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <FileText size={26} className="text-[#00FF94]" /> My Reports
          </h1>
          <p className="text-[#9CA3AF] mt-1">{total} issues reported</p>
        </div>
        <Link href="/report" className="btn-primary">+ New Report</Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="text-[#00FF94] animate-spin" />
        </div>
      ) : issues.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[#9CA3AF] text-lg mb-4">You haven&apos;t reported any issues yet.</p>
          <Link href="/report" className="btn-primary inline-flex">Report Your First Issue</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      )}
    </AppLayout>
  );
}
