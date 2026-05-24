'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, ThumbsUp, MessageSquare, Eye,
  Clock, Share2, Flag, Send, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle2, XCircle, Loader2,
  RefreshCw, Bell, BellOff, Edit2, Trash2, Camera, Star
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { issuesApi, commentsApi, adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ReviewSection } from './ReviewSection';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Rejected' | 'Pending Verification';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Comment {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  content: string;
  created_at: string;
  isOwn?: boolean;
  canDelete?: boolean;
}

interface Update {
  id: string;
  status: Status;
  note: string;
  author: string;
  created_at: string;
}

// ─── Mock Issue Data ───────────────────────────────────────────────────────────
const MOCK_ISSUE = {
  id: '1',
  title: 'Loading issue details...',
  description: 'Loading issue details...',
  category: 'Loading',
  category_icon: '📌',
  status: 'Reported' as Status,
  severity: 'Medium' as Severity,
  address: 'Loading location...',
  upvote_count: 0,
  comment_count: 0,
  follow_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author: 'Loading',
  author_initials: 'L',
  image: null,
  department: null as string | null,
};

const MOCK_UPDATES: Update[] = [];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { color: string; bg: string; dot: string; icon: React.ElementType }> = {
  Reported: { color: 'text-content-secondary', bg: 'bg-base-850', dot: 'bg-content-muted', icon: AlertTriangle },
  Acknowledged: { color: 'text-accent-secondary', bg: 'bg-accent-secondary/10', dot: 'bg-accent-secondary', icon: Eye },
  'In Progress': { color: 'text-state-warning', bg: 'bg-state-warning/10', dot: 'bg-state-warning', icon: Loader2 },
  Resolved: { color: 'text-state-success', bg: 'bg-state-success/10', dot: 'bg-state-success', icon: CheckCircle2 },
  Rejected: { color: 'text-state-error', bg: 'bg-state-error/10', dot: 'bg-state-error', icon: XCircle },
  'Pending Verification': { color: 'text-accent-secondary', bg: 'bg-accent-secondary/10', dot: 'bg-accent-secondary', icon: Eye },
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  Critical: { color: 'text-state-error', bg: 'bg-state-error/10', border: 'border-state-error/20' },
  High: { color: 'text-state-warning', bg: 'bg-state-warning/10', border: 'border-state-warning/20' },
  Medium: { color: 'text-accent-secondary', bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/20' },
  Low: { color: 'text-content-secondary', bg: 'bg-base-850', border: 'border-border-subtle' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${cfg.color} ${cfg.bg} border border-border-subtle`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <AlertTriangle size={12} strokeWidth={2.5} />
      {severity}
    </span>
  );
}

function CommentBubble({ comment, onEdit, onDelete }: { comment: Comment; onEdit: (id: string, content: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex gap-4 group animate-fade_in">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 mt-1 shadow-sm"
        style={{ background: comment.avatarColor + '15', color: comment.avatarColor, border: `1px solid ${comment.avatarColor}25` }}
      >
        {comment.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[14px] font-semibold text-content-primary">{comment.author}</span>
          {comment.isOwn && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-accent-secondary/20 bg-accent-secondary/10 text-accent-secondary font-bold uppercase tracking-wide">You</span>
          )}
          <span className="text-[12px] text-content-muted flex items-center gap-1.5 ml-auto font-medium">
            <Clock size={12} />
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {(comment.isOwn || comment.canDelete) && (
            <div className="flex gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-base-800 border border-border-subtle px-1.5 py-0.5 rounded-md">
              {comment.isOwn && (
                <button onClick={() => onEdit(comment.id, comment.content)} className="text-content-muted hover:text-accent-secondary transition-colors p-1" title="Edit">
                  <Edit2 size={12} />
                </button>
              )}
              {comment.canDelete && (
                <button onClick={() => onDelete(comment.id)} className="text-content-muted hover:text-state-error transition-colors p-1" title="Delete">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="bg-base-800 border border-border-subtle rounded-2xl rounded-tl-sm px-4 py-3.5 text-[14px] text-content-secondary leading-relaxed whitespace-pre-wrap break-words shadow-sm">
          {comment.content}
        </div>
      </div>
    </div>
  );
}

function UpdateEntry({ update }: { update: Update }) {
  const cfg = STATUS_CONFIG[update.status];
  const Icon = cfg.icon;
  return (
    <div className="flex gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-border-subtle ${cfg.bg}`}>
        <Icon size={16} className={cfg.color} strokeWidth={2.5} />
      </div>
      <div className="flex-1 pb-5 border-b border-border-subtle/50 last:border-0">
        <div className="flex items-center gap-3 mb-2">
          <StatusBadge status={update.status} />
          <span className="text-[12px] text-content-muted ml-auto flex items-center gap-1.5 font-medium">
            <Clock size={12} />
            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
          </span>
        </div>
        {update.note && <p className="text-[14px] text-content-secondary mt-1.5 leading-relaxed">{update.note}</p>}
        <p className="text-[11px] text-content-muted mt-2 font-semibold uppercase tracking-wider">by {update.author}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IssueDetailPage() {
  const params = useParams();
  const issueId = params?.id as string;
  const { user } = useAuthStore();

  const [issue, setIssue] = useState<any>(MOCK_ISSUE);
  const [loading, setLoading] = useState(!!issueId);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'updates' | 'comments' | 'reviews'>('overview');
  const [comments, setComments] = useState<Comment[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Verification states
  const [verifying, setVerifying] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Admin options states
  const [originalStatus, setOriginalStatus] = useState('');
  const [originalDept, setOriginalDept] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDept, setEditDept] = useState('');
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Fetch issue data from API
  useEffect(() => {
    if (!issueId) return;

    const fetchIssue = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await issuesApi.get(issueId);

        const data = response.data.issue;
        if (!data) {
          setError('Issue not found.');
          return;
        }

        const severityMap: Record<string, Severity> = {
          'low': 'Low', 'medium': 'Medium', 'high': 'High', 'critical': 'Critical'
        };
        const statusMap: Record<string, Status> = {
          'reported': 'Reported', 'acknowledged': 'Acknowledged',
          'in_progress': 'In Progress', 'resolved': 'Resolved', 'rejected': 'Rejected',
          'pending_verification': 'Pending Verification'
        };

        let address = data.address;
        if (!address) {
          if (data.latitude && data.longitude) {
            address = `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;
          } else {
            address = 'Location not specified';
          }
        }

        setIssue({
          id: data.id,
          reporter_id: data.is_anonymous ? null : data.user_id,
          title: data.title,
          description: data.description,
          category: data.category_name || 'Uncategorized',
          category_icon: data.category_icon || '📌',
          status: (statusMap[data.status] || 'Reported') as Status,
          severity: (severityMap[data.severity] || 'Medium') as Severity,
          address: address,
          upvote_count: data.upvote_count || 0,
          comment_count: data.comment_count || 0,
          follow_count: data.follow_count || 0,
          created_at: data.created_at,
          updated_at: data.updated_at,
          author: data.is_anonymous ? 'Anonymous' : (data.reporter_name || 'Anonymous'),
          author_initials: (data.reporter_name || 'A').substring(0, 2).toUpperCase(),
          reporter_avatar: data.is_anonymous ? null : (data.reporter_avatar || null),
          media: data.media || [],
          department: data.department || null,
        });
        setUpvoteCount(data.upvote_count || 0);
        setOriginalStatus(data.status);
        setOriginalDept(data.department || '');
        setEditStatus(data.status);
        setEditDept(data.department || '');
        setRejectionReason('');
      } catch (err: unknown) {
        const e = err as { response?: { status: number; data?: { error: string } } };
        if (e?.response?.status === 404) {
          setError('Issue not found.');
        } else {
          setError('Failed to load issue. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchIssue();
  }, [issueId, refreshCount]);

  useEffect(() => {
    if (!issueId || !issue.id || issue.id === '1') return;
    const fetchComments = async () => {
      try {
        const res = await commentsApi.list(issueId);
        const fetchedComments = res.data.comments.map((c: any) => ({
          id: c.id,
          author: c.author_name || 'Anonymous',
          initials: (c.author_name || 'A').substring(0, 2).toUpperCase(),
          avatarColor: '#6366F1', // using primary accent
          content: c.content,
          created_at: c.created_at,
          isOwn: user?.id === c.user_id,
          canDelete: user?.id === c.user_id || user?.id === issue.reporter_id || user?.role === 'admin'
        }));
        setComments(fetchedComments);
      } catch (err) {
        console.error('Failed to fetch comments', err);
      }
    };
    const fetchHistory = async () => {
      try {
        const statusMap: Record<string, Status> = {
          'reported': 'Reported', 'acknowledged': 'Acknowledged',
          'in_progress': 'In Progress', 'resolved': 'Resolved', 'rejected': 'Rejected',
          'pending_verification': 'Pending Verification'
        };
        const res = await issuesApi.history(issueId);
        const history = res.data.history.map((h: any) => ({
          id: h.id,
          status: (statusMap[h.new_status] || 'Reported') as Status,
          note: h.comment || `Status updated to ${statusMap[h.new_status] || h.new_status}.`,
          author: h.updated_by_name || 'System',
          created_at: h.updated_at
        }));
        setUpdates(history);
      } catch (err) {
        console.error('Failed to fetch status history', err);
      }
    };
    fetchComments();
    fetchHistory();
  }, [issueId, issue.id, issue.reporter_id, user, refreshCount]);

  const handleUpvote = () => {
    setUpvoted(v => !v);
    setUpvoteCount(c => upvoted ? c - 1 : c + 1);
  };

  const handleFollow = () => setFollowing(v => !v);

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || !user) return;
    setSubmitting(true);

    try {
      if (editingCommentId) {
        await commentsApi.update(issueId, editingCommentId, { content: text });
        setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: text } : c));
        setEditingCommentId(null);
      } else {
        const res = await commentsApi.create(issueId, { content: text });
        const c = res.data.comment;
        const newComment: Comment = {
          id: c.id,
          author: c.author_name || 'Anonymous',
          initials: (c.author_name || 'A').substring(0, 2).toUpperCase(),
          avatarColor: '#6366F1',
          content: c.content,
          created_at: c.created_at,
          isOwn: true,
          canDelete: true
        };
        setComments(prev => [...prev, newComment]);
        setIssue((prev: any) => ({ ...prev, comment_count: prev.comment_count + 1 }));
      }
      setCommentText('');
    } catch (err) {
      console.error('Failed to save comment', err);
    } finally {
      setSubmitting(false);
      setActiveTab('comments');
    }
  };

  const handleEditComment = (id: string, content: string) => {
    setEditingCommentId(id);
    setCommentText(content);
    setActiveTab('comments');
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await commentsApi.delete(issueId, id);
      setComments(prev => prev.filter(c => c.id !== id));
      setIssue((prev: any) => ({ ...prev, comment_count: Math.max(0, prev.comment_count - 1) }));
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleVerifyAction = async (approved: boolean) => {
    if (!issueId) return;
    if (!approved && !rejectComment.trim()) {
      alert('Please enter a reason for rejection.');
      return;
    }
    setVerifying(true);
    try {
      await issuesApi.verifyResolution(issueId, { 
        approved, 
        comment: !approved ? rejectComment.trim() : undefined 
      });
      setShowRejectInput(false);
      setRejectComment('');
      setRefreshCount(c => c + 1); // Reload triggers!
    } catch (err) {
      console.error('Verification action failed:', err);
      alert('Failed to process action. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveAdminChanges = async () => {
    if (editStatus === 'resolved' && originalStatus !== 'resolved' && originalStatus !== 'pending_verification' && resolutionFiles.length === 0) {
      alert('A resolution proof image is mandatory to mark an issue as resolved.');
      return;
    }

    if (editStatus === 'rejected' && !rejectionReason.trim()) {
      alert('A rejection reason is mandatory to reject an issue.');
      return;
    }

    setAdminSubmitting(true);
    try {
      if (editStatus !== originalStatus) {
        if (editStatus === 'resolved' && resolutionFiles.length > 0) {
          const fd = new FormData();
          fd.append('status', 'resolved');
          resolutionFiles.forEach(file => {
            fd.append('media', file);
          });
          await issuesApi.updateStatus(issueId, fd);
        } else if (editStatus === 'rejected') {
          await issuesApi.updateStatus(issueId, { status: editStatus, rejection_reason: rejectionReason.trim() });
        } else {
          await issuesApi.updateStatus(issueId, { status: editStatus });
        }
      }
      
      if (editDept !== originalDept) {
        await adminApi.assign(issueId, { department: editDept });
      }
      
      setResolutionFiles([]);
      setRejectionReason('');
      setRefreshCount(c => c + 1);
    } catch (err: any) {
      console.error('Failed to save administrative changes:', err);
      alert(err?.response?.data?.error || 'Failed to save changes. Please try again.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const reportedMedia = issue.media?.filter((m: any) => !m.is_resolution) || [];
  const resolutionMedia = issue.media?.filter((m: any) => m.is_resolution) || [];
  const showPurplePanel = issue.status === 'Pending Verification' && user?.id === issue.reporter_id;

  const isResolved = issue.status === 'Resolved';

  const tabs = [
    { key: 'overview', label: 'Overview', count: null },
    { key: 'updates', label: 'Updates', count: updates.length },
    { key: 'comments', label: 'Comments', count: comments.length },
    ...(isResolved ? [{ key: 'reviews', label: 'Reviews', count: null, icon: Star }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-base-950 text-content-primary selection:bg-accent-primary/30 pb-16">
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-content-muted font-medium text-sm animate-pulse">Loading issue details...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm p-8 card border-state-error/20 bg-state-error/10">
            <AlertTriangle size={36} className="text-state-error" />
            <p className="text-[15px] font-semibold">{error}</p>
            <Link href="/explore" className="text-[13px] text-accent-secondary hover:underline mt-2 font-medium">
              Return to Explore
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Top nav bar */}
          <header className="sticky top-0 z-40 glass-panel border-b border-border-subtle px-4 md:px-6 h-14 flex items-center gap-4 shadow-sm animate-fade_in">
            <Link href="/explore" className="flex items-center gap-2 text-[13px] font-semibold text-content-secondary hover:text-content-primary transition-colors">
              <ArrowLeft size={16} />
              Back
            </Link>
            <div className="flex-1" />
            <button
              onClick={handleFollow}
              className={`flex items-center gap-2 text-[13px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 ${following
                  ? 'border-accent-secondary/30 bg-accent-secondary/10 text-accent-secondary'
                  : 'border-border-subtle text-content-secondary hover:text-content-primary hover:bg-base-850'
                }`}
            >
              {following ? <BellOff size={14} /> : <Bell size={14} />}
              <span className="hidden sm:inline">{following ? 'Following' : 'Follow'}</span>
            </button>
            <button className="flex items-center gap-2 text-[13px] font-semibold px-3 py-1.5 rounded-lg border border-border-subtle text-content-secondary hover:text-content-primary hover:bg-base-850 transition-all duration-200">
              <Share2 size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </header>

          <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10 animate-fade_in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-content-muted mb-6 font-medium">
              <Link href="/explore" className="hover:text-content-primary transition-colors">Explore</Link>
              <ChevronRight size={14} className="opacity-50" />
              <span className="text-content-secondary bg-base-850 px-2.5 py-1 rounded-md border border-border-subtle shadow-sm">{issue.category}</span>
            </div>

            {/* Title & Badges */}
            <div className="mb-8 max-w-4xl">
              <h1 className="text-3xl md:text-4xl font-bold mb-5 leading-tight text-content-primary tracking-tight">
                {issue.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={issue.status} />
                <SeverityBadge severity={issue.severity} />
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-base-850 text-content-secondary border border-border-subtle">
                  <span className="text-[13px]">{issue.category_icon}</span> {issue.category}
                </span>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* LEFT — main content */}
              <div className="flex-1 min-w-0">
                {/* 🔍 CITIZEN RESOLUTION VERIFICATION PANEL */}
                {showPurplePanel && (
                  <div className="mb-8 relative overflow-hidden p-6 rounded-2xl bg-accent-secondary/5 border border-accent-secondary/20 shadow-xl animate-fade_in">
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-accent-secondary/10 blur-[50px] pointer-events-none" />
                    
                    <div className="flex items-start gap-4 mb-5 relative z-10">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30 shrink-0">
                        <CheckCircle2 size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-content-primary mb-1">
                          {issue.department ? `Verify ${issue.department} Resolution` : 'Verify Admin Resolution'}
                        </h3>
                        <p className="text-sm text-content-secondary leading-relaxed">
                          {issue.department 
                            ? `The ${issue.department} has marked this issue as resolved. Please review the proof below and approve or reject the resolution.`
                            : 'An administrator has marked this issue as resolved. Please review the proof below and approve or reject the resolution.'}
                        </p>
                      </div>
                    </div>

                    {/* Show Resolution Media inside the card */}
                    {issue.media?.some((m: any) => m.is_resolution) && (
                      <div className="mb-5 relative z-10">
                        <p className="text-[11px] font-bold uppercase text-accent-secondary tracking-wider mb-2.5">Resolution Evidence</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {issue.media.filter((m: any) => m.is_resolution).map((m: any, i: number) => (
                            <div key={i} className="relative rounded-xl overflow-hidden border border-border-subtle bg-base-900 flex items-center justify-center group shadow-inner aspect-[4/3]">
                              {m.type === 'video' ? (
                                <video src={formatMediaUrl(m.url)} controls className="w-full h-full object-contain" />
                              ) : (
                                <img src={formatMediaUrl(m.url)} alt="Resolution proof" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showRejectInput && (
                      <div className="mb-5 relative z-10 animate-fade_in">
                        <label className="block text-[11px] font-bold uppercase text-accent-secondary/80 mb-2">Reason for Rejection</label>
                        <textarea
                          placeholder="Describe why this issue isn't fully fixed yet..."
                          value={rejectComment}
                          onChange={e => setRejectComment(e.target.value)}
                          className="w-full bg-base-900 border border-border-subtle focus:border-accent-secondary/50 rounded-xl p-3.5 text-sm text-content-primary h-24 transition-colors resize-none outline-none placeholder:text-content-muted/50 shadow-inner"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 relative z-10">
                      {showRejectInput ? (
                        <>
                          <button
                            onClick={() => handleVerifyAction(false)}
                            disabled={verifying}
                            className="bg-state-error hover:bg-state-error/90 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            {verifying ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                            Submit Rejection
                          </button>
                          <button
                            onClick={() => { setShowRejectInput(false); setRejectComment(''); }}
                            disabled={verifying}
                            className="text-content-muted hover:text-content-primary text-[13px] font-bold px-4 py-2 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleVerifyAction(true)}
                            disabled={verifying}
                            className="bg-state-success hover:bg-state-success/90 text-black px-5 py-2.5 rounded-xl text-[13px] font-extrabold flex items-center gap-2 active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.2)] hover:shadow-[0_4px_25px_rgba(74,222,128,0.35)] transition-all disabled:opacity-50"
                          >
                            {verifying ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                            Accept & Close Issue
                          </button>
                          <button
                            onClick={() => setShowRejectInput(true)}
                            disabled={verifying}
                            className="bg-transparent border border-accent-secondary/30 text-accent-secondary hover:bg-accent-secondary/10 px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject Resolution
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Media Carousel */}
                {reportedMedia.length > 0 && (
                  <div className="relative mb-8 group rounded-2xl overflow-hidden bg-base-900 border border-border-subtle shadow-card select-none animate-fade_in">
                    {/* Dynamic Evidence Label */}
                    <div className="absolute top-4 left-4 z-10 bg-base-950/80 backdrop-blur-md border border-border-subtle rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-content-secondary flex items-center gap-1.5 shadow-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse" />
                      Reported Evidence
                    </div>

                    {/* Current Media */}
                    <div className="relative w-full h-64 md:h-80 lg:h-[400px] overflow-hidden flex items-center justify-center bg-black">
                      {reportedMedia[activeMediaIndex]?.type === 'video' ? (
                        <video 
                          src={formatMediaUrl(reportedMedia[activeMediaIndex]?.url)} 
                          controls 
                          className="w-full h-full object-contain" 
                        />
                      ) : (
                        <img
                          src={formatMediaUrl(reportedMedia[activeMediaIndex]?.url)}
                          alt={`${issue.title} - ${activeMediaIndex + 1}`}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                        />
                      )}
                    </div>

                    {/* Navigation Arrows */}
                    {reportedMedia.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveMediaIndex(p => (p === 0 ? reportedMedia.length - 1 : p - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-base-950/80 border border-border-subtle backdrop-blur-sm flex items-center justify-center text-content-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-base-850 active:scale-90 shadow-lg"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          onClick={() => setActiveMediaIndex(p => (p === reportedMedia.length - 1 ? 0 : p + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-base-950/80 border border-border-subtle backdrop-blur-sm flex items-center justify-center text-content-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-base-850 active:scale-90 shadow-lg"
                        >
                          <ChevronRight size={18} />
                        </button>

                        {/* Progress Dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-base-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-border-subtle">
                          {reportedMedia.map((_: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setActiveMediaIndex(idx)}
                              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activeMediaIndex ? 'w-4 bg-accent-secondary' : 'bg-content-muted/40 hover:bg-content-muted/70'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 📸 PUBLIC RESOLUTION EVIDENCE SHOWCASE */}
                {resolutionMedia.length > 0 && !showPurplePanel && (
                  <div className="mb-8 relative overflow-hidden rounded-2xl p-6 bg-state-success/5 border border-state-success/20 shadow-card animate-fade_in">
                    <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-state-success/10 blur-[60px] pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-5 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-state-success/15 text-state-success border border-state-success/25 shadow-inner">
                          <CheckCircle2 size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-content-primary leading-none mb-1.5">Official Resolution Proof</h3>
                          <p className="text-[12px] font-semibold text-state-success/80">
                            {issue.department 
                              ? `Verified evidence uploaded by the ${issue.department}` 
                              : 'Verified evidence uploaded by administrator'}
                          </p>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-widest text-state-success bg-state-success/10 border border-state-success/20 px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-state-success animate-pulse" />
                        Resolved Evidence
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                      {resolutionMedia.map((m: any, i: number) => (
                        <div key={i} className="group relative aspect-[16/10] sm:aspect-[4/3] overflow-hidden rounded-xl bg-base-900 border border-border-subtle shadow-inner hover:border-state-success/30 transition-all duration-300">
                          {m.type === 'video' ? (
                            <video src={formatMediaUrl(m.url)} controls className="w-full h-full object-contain bg-black" />
                          ) : (
                            <img src={formatMediaUrl(m.url)} alt="Resolution proof image" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Practical Action Bar */}
                <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border-subtle">
                  <button
                    onClick={handleUpvote}
                    className={`flex items-center gap-2 text-[14px] font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] ${upvoted
                        ? 'bg-accent-primary text-white shadow-glow-primary'
                        : 'bg-base-850 text-content-primary border border-border-subtle hover:bg-base-800'
                      }`}
                  >
                    <ThumbsUp size={18} className={upvoted ? 'fill-white' : ''} strokeWidth={upvoted ? 2.5 : 2} />
                    {upvoteCount} <span className="hidden sm:inline">Upvotes</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('comments'); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                    className="flex items-center gap-2 text-[14px] font-semibold px-5 py-2.5 rounded-xl bg-base-850 text-content-primary border border-border-subtle hover:bg-base-800 transition-all duration-200 active:scale-[0.98]"
                  >
                    <MessageSquare size={18} />
                    {comments.length + issue.comment_count} <span className="hidden sm:inline">Comments</span>
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-base-900 border border-border-subtle rounded-xl p-1.5 mb-8 shadow-sm">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as 'overview' | 'updates' | 'comments' | 'reviews')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] md:text-[14px] font-semibold transition-all duration-200 ${activeTab === tab.key
                          ? 'bg-base-800 text-content-primary border border-border-subtle shadow-sm'
                          : 'text-content-secondary border border-transparent hover:text-content-primary hover:bg-base-850'
                        }`}
                    >
                      {tab.label}
                      {tab.count !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-wide ${activeTab === tab.key ? 'bg-accent-primary text-white' : 'bg-base-950 border border-border-subtle text-content-muted'
                          }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab: Overview */}
                {activeTab === 'overview' && (
                  <div className="space-y-6 animate-fade_in">
                    <div className="card p-6 bg-base-800">
                      <h3 className="label-micro mb-4 text-accent-primary">Description</h3>
                      <p className="text-[15px] text-content-secondary leading-relaxed whitespace-pre-wrap">{issue.description}</p>
                    </div>

                    <div className="card p-6 bg-base-800">
                      <h3 className="label-micro mb-6 text-accent-primary">Issue Timeline</h3>
                      <div className="relative pl-6">
                        <div className="absolute left-2.5 top-2.5 bottom-2 w-[2px] bg-border-subtle rounded-full" />
                        <div className="relative mb-0 flex gap-4">
                          <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-accent-primary shadow-glow-primary border-2 border-base-800 z-10" />
                          <div className="flex-1">
                            <div className="text-[15px] text-content-primary font-bold mb-1">Issue Reported</div>
                            <div className="text-[13px] text-content-muted font-medium flex items-center gap-1.5">
                              <Clock size={12} />
                              {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })} <span className="opacity-50 text-border-subtle">•</span> by {issue.author}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Updates */}
                {activeTab === 'updates' && (
                  <div className="animate-fade_in">
                    {updates.length === 0 ? (
                      <div className="card p-12 text-center bg-base-850 border-dashed">
                        <div className="w-14 h-14 rounded-full bg-base-800 border border-border-subtle flex items-center justify-center mx-auto mb-4">
                          <RefreshCw size={24} className="text-content-muted" />
                        </div>
                        <p className="text-[15px] font-semibold text-content-primary mb-1">No updates yet</p>
                        <p className="text-[13px] text-content-muted">Official status updates will appear here</p>
                      </div>
                    ) : (
                      <div className="card p-6 space-y-6 bg-base-800">
                        {updates.map(u => <UpdateEntry key={u.id} update={u} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Comments */}
                {activeTab === 'comments' && (
                  <div className="space-y-6 animate-fade_in">
                    {/* Comment input */}
                    {issue.status === 'Resolved' ? (
                      <div className="card p-5 bg-base-900 border-dashed border-state-success/30 flex items-center justify-center gap-3">
                        <CheckCircle2 size={20} className="text-state-success animate-pulse" />
                        <p className="text-sm text-content-secondary font-medium">
                          This issue is marked as <span className="text-state-success font-bold">Resolved</span>. New comments are closed.
                        </p>
                      </div>
                    ) : (
                      <div className="card p-5 bg-base-800">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-xl bg-accent-secondary/10 border border-accent-secondary/20 flex items-center justify-center text-sm font-bold text-accent-secondary shrink-0">
                            {(user?.name || 'A').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <textarea
                              value={commentText}
                              onChange={e => setCommentText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostComment();
                              }}
                              placeholder="Join the discussion... (⌘ + Enter)"
                              rows={3}
                              className="input-dark w-full resize-none text-[14px] leading-relaxed p-4 transition-all"
                            />
                            <div className="flex items-center justify-between mt-4">
                              <span className="text-[11px] font-semibold tracking-wide text-content-muted uppercase hidden sm:inline-block">⌘ + Enter to post</span>
                              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                {editingCommentId && (
                                  <button
                                    onClick={() => { setEditingCommentId(null); setCommentText(''); }}
                                    className="text-[13px] font-semibold text-content-muted hover:text-content-primary transition-colors px-2"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  onClick={handlePostComment}
                                  disabled={!commentText.trim() || submitting}
                                  className="btn-accent w-full sm:w-auto text-[13px] py-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                  {editingCommentId ? 'Update' : 'Post'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Comment list */}
                    {comments.length === 0 ? (
                      <div className="card p-12 text-center bg-base-850 border-dashed mt-6">
                        <div className="w-14 h-14 rounded-full bg-base-800 border border-border-subtle flex items-center justify-center mx-auto mb-4">
                          <MessageSquare size={24} className="text-content-muted" />
                        </div>
                        <p className="text-[15px] font-semibold text-content-primary mb-1">No comments yet</p>
                        <p className="text-[13px] text-content-muted">Be the first to share your thoughts</p>
                      </div>
                    ) : (
                      <div className="space-y-5 pt-2">
                        {comments.map(c => <CommentBubble key={c.id} comment={c} onEdit={handleEditComment} onDelete={handleDeleteComment} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Reviews (resolved issues only) */}
                {activeTab === 'reviews' && (
                  <ReviewSection issueId={issueId} isResolved={isResolved} />
                )}
              </div>

              {/* RIGHT — sidebar */}
              <div className="lg:w-[320px] shrink-0 space-y-6">
                {/* Administrative command panel */}
                {(user?.role === 'admin' || user?.role === 'department_staff') && (
                  <div className="card p-6 bg-base-800 border border-accent-secondary/20 relative overflow-hidden shadow-glow-secondary animate-fade_in">
                    <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-accent-secondary/5 blur-[40px] pointer-events-none" />
                    
                    <div className="flex items-center gap-2 mb-4 text-accent-secondary">
                      <div className="w-8 h-8 rounded-lg bg-accent-secondary/10 flex items-center justify-center border border-accent-secondary/20">
                        <AlertTriangle size={15} />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider">Admin Command Panel</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1.5">Update Status</label>
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value)}
                          className="input-dark h-10 w-full text-xs font-medium"
                        >
                          <option value="reported">Reported</option>
                          <option value="acknowledged">Acknowledged</option>
                          <option value="in_progress">In Progress</option>
                          <option value="pending_verification">Pending Verification</option>
                          <option value="resolved">Resolved</option>
                          <option value="rejected">Rejected</option>
                        </select>

                        {editStatus === 'rejected' && (
                          <div className="mt-3 animate-fade_in">
                            <label className="text-[10px] font-bold text-state-error uppercase tracking-wider block mb-1.5">Rejection Reason</label>
                            <textarea
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              placeholder="Please explain why this issue is being rejected..."
                              className="input-dark w-full text-xs font-medium p-2.5 min-h-[70px] resize-none text-content-primary placeholder:text-content-muted"
                              required
                            />
                          </div>
                        )}

                        {editStatus === 'resolved' && originalStatus !== 'resolved' && originalStatus !== 'pending_verification' && (
                          <div className="mt-3 animate-fade_in">
                            <label className="text-[10px] font-bold text-state-success uppercase tracking-wider block mb-1.5">Upload Resolution Proof</label>
                            <div className="relative group overflow-hidden rounded-xl border border-dashed border-state-success/30 hover:border-state-success/60 transition-all bg-state-success/5 p-4 flex flex-col items-center justify-center gap-2 min-h-[80px] cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                onChange={e => {
                                  if (e.target.files) {
                                    const filesArray = Array.from(e.target.files);
                                    if (filesArray.length > 5) {
                                      alert('You can only upload up to 5 resolution proof files.');
                                      setResolutionFiles(filesArray.slice(0, 5));
                                    } else {
                                      setResolutionFiles(filesArray);
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              {resolutionFiles.length > 0 ? (
                                <div className="flex flex-col items-center gap-1 text-state-success">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} />
                                    <span className="text-xs font-semibold">{resolutionFiles.length} files selected</span>
                                  </div>
                                  <span className="text-[9px] text-content-muted text-center leading-tight truncate max-w-[240px]">
                                    {resolutionFiles.map(f => f.name).join(', ')}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <Camera size={16} className="text-state-success group-hover:scale-115 transition-transform" />
                                  <span className="text-[10px] text-content-muted text-center leading-tight">Click or drop proof photos (max 5)</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1.5">Assign Department</label>
                        <select
                          value={editDept}
                          onChange={e => setEditDept(e.target.value)}
                          className="input-dark h-10 w-full text-xs font-medium"
                        >
                          <option value="">Unassigned</option>
                          <option value="Public Works">Public Works</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Sanitation">Sanitation</option>
                          <option value="Water Authority">Water Authority</option>
                          <option value="Parks & Rec">Parks & Rec</option>
                          <option value="Building Maintenance">Building Maintenance</option>
                          <option value="Traffic">Traffic</option>
                        </select>
                      </div>

                      <button
                        onClick={handleSaveAdminChanges}
                        disabled={adminSubmitting || (editStatus === originalStatus && editDept === originalDept && resolutionFiles.length === 0)}
                        className="w-full bg-accent-secondary hover:bg-accent-secondary/90 text-white font-bold text-xs uppercase tracking-wider h-10 rounded-xl transition-all duration-200 shadow-glow-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {adminSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Location */}
                <div className="card p-6 bg-base-800">
                  <h3 className="label-micro mb-4 text-accent-primary">Location</h3>
                  <div className="flex items-start gap-2.5 text-[14px] text-content-secondary mb-5 bg-base-950 p-3.5 rounded-xl border border-border-subtle">
                    <MapPin size={18} className="shrink-0 mt-0.5 text-accent-secondary" />
                    <span className="font-medium leading-relaxed">{issue.address}</span>
                  </div>
                  {/* Map placeholder */}
                  <div className="rounded-xl overflow-hidden bg-base-950 border border-border-subtle h-40 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent-primary/30 hover:shadow-glow-primary transition-all group">
                    <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center group-hover:bg-accent-primary/20 transition-colors">
                      <MapPin size={20} className="text-accent-primary" />
                    </div>
                    <span className="text-[12px] font-bold text-content-muted group-hover:text-accent-primary tracking-wide uppercase transition-colors">View on Map</span>
                  </div>
                </div>

                {/* Reported By */}
                <div className="card p-6 bg-base-800">
                  <h3 className="label-micro mb-4 text-accent-primary">Reporter</h3>
                  {(() => {
                    const isOwnIssue = user?.id === issue.reporter_id;
                    const profileHref = isOwnIssue ? '/profile' : (issue.reporter_id ? `/profile/${issue.reporter_id}` : null);
                    const isAnonymous = issue.author === 'Anonymous' || !issue.reporter_id;

                    const card = (
                      <div className={`flex items-center gap-4 bg-base-950 p-4 rounded-xl border border-border-subtle ${profileHref ? 'hover:border-accent-secondary/40 hover:bg-base-900 transition-all duration-200 cursor-pointer group' : ''}`}>
                        <div className="w-12 h-12 rounded-xl bg-accent-secondary/10 border border-accent-secondary/20 flex items-center justify-center text-[15px] font-bold text-accent-secondary shadow-sm overflow-hidden flex-shrink-0">
                          {issue.reporter_avatar ? (
                            <img src={formatMediaUrl(issue.reporter_avatar)} alt={issue.author} className="w-full h-full object-cover" />
                          ) : (
                            issue.author_initials
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[15px] font-bold mb-0.5 truncate ${profileHref ? 'group-hover:text-accent-secondary transition-colors' : 'text-content-primary'}`}>
                            {issue.author}
                            {isOwnIssue && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md border border-accent-secondary/20 bg-accent-secondary/10 text-accent-secondary font-bold uppercase tracking-wide">You</span>
                            )}
                          </div>
                          <div className="text-[12px] font-medium text-content-muted flex items-center gap-1.5">
                            <Clock size={12} />
                            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                          </div>
                          {profileHref && (
                            <div className="text-[11px] text-accent-secondary/60 group-hover:text-accent-secondary transition-colors font-medium mt-1">
                              {isOwnIssue ? 'Edit your profile →' : 'View profile →'}
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    if (profileHref && !isAnonymous) {
                      return <Link href={profileHref}>{card}</Link>;
                    }
                    return card;
                  })()}
                </div>


                {/* Details */}
                <div className="card p-6 bg-base-800">
                  <h3 className="label-micro mb-5 text-accent-primary">Details</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Created', value: format(new Date(issue.created_at), 'MMM d, yyyy') },
                      { label: 'Last Updated', value: format(new Date(issue.updated_at), 'MMM d, yyyy') },
                      { label: 'Category', value: `${issue.category_icon} ${issue.category}` },
                      { label: 'Severity', value: issue.severity },
                      { label: 'Followers', value: String(issue.follow_count + (following ? 1 : 0)) },
                      ...(issue.department ? [{ label: issue.status === 'Resolved' ? 'Resolved By' : 'Assigned Department', value: issue.department }] : []),
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between pb-3 border-b border-border-subtle/50 last:border-0 last:pb-0">
                        <span className="text-[13px] font-medium text-content-muted">{row.label}</span>
                        <span className="text-[13px] font-semibold text-content-primary bg-base-900 px-2.5 py-1 rounded-md border border-border-subtle">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="card p-6 bg-base-800">
                  <h3 className="label-micro mb-5 text-accent-primary">Engagement</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: ThumbsUp, val: upvoteCount, label: 'Upvotes' },
                      { icon: MessageSquare, val: comments.length + issue.comment_count, label: 'Comments' },
                      { icon: Eye, val: issue.follow_count + (following ? 1 : 0), label: 'Views' },
                    ].map(({ icon: Icon, val, label }) => (
                      <div key={label} className="text-center bg-base-950 rounded-xl p-3 border border-border-subtle hover:bg-base-900 transition-colors shadow-sm">
                        <Icon size={16} className="mx-auto mb-2 text-accent-secondary" />
                        <div className="text-[17px] font-black text-content-primary mb-1">{val}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
