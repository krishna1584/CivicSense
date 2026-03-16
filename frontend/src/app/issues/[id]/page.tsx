'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, ThumbsUp, MessageSquare, Eye,
  Clock, Share2, Flag, Send, User, ChevronRight,
  Zap, AlertTriangle, CheckCircle2, XCircle, Loader2,
  Calendar, RefreshCw, Bell, BellOff
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'Reported' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Rejected';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

interface Comment {
  id: string;
  author: string;
  initials: string;
  avatarColor: string;
  content: string;
  created_at: string;
  isOwn?: boolean;
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
  title: 'Faded stop sign at school crossing',
  description:
    'The stop sign at the elementary school crossing is severely faded and barely visible, posing a serious safety hazard for students and drivers. The reflective coating has completely worn off and the sign is difficult to see even in daylight, let alone at night. This intersection sees heavy foot traffic every morning and afternoon during school hours.',
  category: 'Traffic',
  category_icon: '🚦',
  status: 'Reported' as Status,
  severity: 'High' as Severity,
  address: 'Lincoln Elementary School, 789 Maple Ave',
  upvote_count: 118,
  comment_count: 31,
  follow_count: 44,
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  updated_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  author: 'Robert Martinez',
  author_initials: 'RM',
  image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=85',
};

const MOCK_UPDATES: Update[] = [];

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { color: string; bg: string; dot: string; icon: React.ElementType }> = {
  Reported:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5',       dot: 'bg-[#9CA3AF]', icon: AlertTriangle },
  Acknowledged:  { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/10',  dot: 'bg-[#61C0FF]', icon: Eye },
  'In Progress': { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10',  dot: 'bg-[#F59E0B]', icon: Loader2 },
  Resolved:      { color: 'text-[#00FF94]', bg: 'bg-[#00FF94]/10',  dot: 'bg-[#00FF94]', icon: CheckCircle2 },
  Rejected:      { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10',  dot: 'bg-[#EF4444]', icon: XCircle },
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string }> = {
  Critical: { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/20' },
  High:     { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20' },
  Medium:   { color: 'text-[#61C0FF]', bg: 'bg-[#61C0FF]/10', border: 'border-[#61C0FF]/20' },
  Low:      { color: 'text-[#9CA3AF]', bg: 'bg-white/5',      border: 'border-white/10' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.color} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <AlertTriangle size={10} />
      {severity}
    </span>
  );
}

function CommentBubble({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3 group" style={{ animation: 'fadeUp 0.3s ease-out both' }}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
        style={{ background: comment.avatarColor + '30', color: comment.avatarColor }}
      >
        {comment.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-white">{comment.author}</span>
          {comment.isOwn && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#61C0FF]/10 text-[#61C0FF] font-medium">You</span>
          )}
          <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 ml-auto">
            <Clock size={10} />
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className="bg-[#0E131A] border border-white/5 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-[#D1D5DB] leading-relaxed">
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
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon size={14} className={cfg.color} />
      </div>
      <div className="flex-1 pb-4 border-b border-white/5 last:border-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={update.status} />
          <span className="text-[11px] text-[#9CA3AF] ml-auto flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
          </span>
        </div>
        {update.note && <p className="text-sm text-[#9CA3AF] mt-1">{update.note}</p>}
        <p className="text-[11px] text-[#9CA3AF]/60 mt-1">by {update.author}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IssueDetailPage() {
  const issue = MOCK_ISSUE;

  const [activeTab, setActiveTab] = useState<'overview' | 'updates' | 'comments'>('overview');
  const [comments, setComments] = useState<Comment[]>([]);
  const [updates] = useState<Update[]>(MOCK_UPDATES);
  const [commentText, setCommentText] = useState('');
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(issue.upvote_count);
  const [following, setFollowing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUpvote = () => {
    setUpvoted(v => !v);
    setUpvoteCount(c => upvoted ? c - 1 : c + 1);
  };

  const handleFollow = () => setFollowing(v => !v);

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);

    // Simulate network delay — backend integration point
    await new Promise(r => setTimeout(r, 600));

    const newComment: Comment = {
      id: Date.now().toString(),
      author: 'John Doe',
      initials: 'JD',
      avatarColor: '#61C0FF',
      content: text,
      created_at: new Date().toISOString(),
      isOwn: true,
    };

    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setSubmitting(false);
    setActiveTab('comments');
  };

  const tabs = [
    { key: 'overview',  label: 'Overview',                    count: null },
    { key: 'updates',   label: 'Updates',                     count: updates.length },
    { key: 'comments',  label: 'Comments',                    count: comments.length },
  ] as const;

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tab-active { background: #0E131A; color: white; }
      `}</style>

      <div className="min-h-screen bg-[#05070A] text-white">
        {/* Top nav bar */}
        <header className="sticky top-0 z-30 glass-panel border-b border-white/5 px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href="/explore" className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="flex-1" />
          <button
            onClick={handleFollow}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              following
                ? 'border-[#61C0FF]/30 bg-[#61C0FF]/10 text-[#61C0FF]'
                : 'border-white/10 text-[#9CA3AF] hover:text-white hover:border-white/20'
            }`}
          >
            {following ? <BellOff size={13} /> : <Bell size={13} />}
            {following ? 'Following' : 'Follow'}
          </button>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 text-[#9CA3AF] hover:text-white hover:border-white/20 transition-all">
            <Share2 size={13} />
            Share
          </button>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 text-[#9CA3AF] hover:text-[#EF4444] hover:border-[#EF4444]/20 transition-all">
            <Flag size={13} />
          </button>
        </header>

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] mb-5">
            <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
            <ChevronRight size={12} />
            <span className="text-[#9CA3AF]">{issue.category}</span>
            <ChevronRight size={12} />
            <span className="text-white truncate max-w-[200px]">{issue.title}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-black mb-4 leading-tight text-[#61C0FF]">
            {issue.title}
          </h1>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <StatusBadge status={issue.status} />
            <SeverityBadge severity={issue.severity} />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/5 text-[#9CA3AF]">
              {issue.category_icon} {issue.category}
            </span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-5 mb-8 pb-6 border-b border-white/5">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-2 text-sm font-medium transition-all ${
                upvoted ? 'text-[#61C0FF]' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <ThumbsUp size={16} className={upvoted ? 'fill-[#61C0FF]' : ''} />
              {upvoteCount}
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className="flex items-center gap-2 text-sm font-medium text-[#9CA3AF] hover:text-white transition-colors"
            >
              <MessageSquare size={16} />
              {comments.length + issue.comment_count}
            </button>
            <button
              onClick={handleFollow}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${following ? 'text-[#61C0FF]' : 'text-[#9CA3AF] hover:text-white'}`}
            >
              <Eye size={16} />
              Follow
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT — main content */}
            <div className="flex-1 min-w-0">
              {/* Hero image */}
              {issue.image && (
                <div className="rounded-2xl overflow-hidden mb-6 bg-[#0B0F14] border border-white/5">
                  <img
                    src={issue.image}
                    alt={issue.title}
                    className="w-full h-72 md:h-96 object-cover"
                  />
                </div>
              )}

              {/* Tabs */}
              <div className="flex bg-[#0B0F14] border border-white/5 rounded-xl p-1 mb-5">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      activeTab === tab.key
                        ? 'tab-active shadow-sm'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                        activeTab === tab.key ? 'bg-[#61C0FF]/20 text-[#61C0FF]' : 'bg-white/5 text-[#9CA3AF]'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-5" style={{ animation: 'fadeUp 0.25s ease-out' }}>
                  <div className="card p-5">
                    <h3 className="label-micro text-[#61C0FF] mb-3">Description</h3>
                    <p className="text-[#D1D5DB] text-sm leading-relaxed">{issue.description}</p>
                  </div>
                  <div className="card p-5">
                    <h3 className="label-micro text-[#61C0FF] mb-4">Issue Timeline</h3>
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-1 bottom-1 w-px bg-white/5" />
                      <div className="relative mb-0">
                        <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-[#9CA3AF] border-2 border-[#05070A]" />
                        <div className="text-sm text-white font-medium mb-0.5">Issue Reported</div>
                        <div className="text-xs text-[#9CA3AF]">
                          {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })} · by {issue.author}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Updates */}
              {activeTab === 'updates' && (
                <div style={{ animation: 'fadeUp 0.25s ease-out' }}>
                  {updates.length === 0 ? (
                    <div className="card p-12 text-center">
                      <RefreshCw size={32} className="mx-auto mb-3 opacity-10" />
                      <p className="font-semibold text-white mb-1">No updates yet</p>
                      <p className="text-sm text-[#9CA3AF]">Official status updates will appear here</p>
                    </div>
                  ) : (
                    <div className="card p-5 space-y-4">
                      {updates.map(u => <UpdateEntry key={u.id} update={u} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Comments */}
              {activeTab === 'comments' && (
                <div className="space-y-4" style={{ animation: 'fadeUp 0.25s ease-out' }}>
                  {/* Comment input */}
                  <div className="card p-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#61C0FF]/20 flex items-center justify-center text-xs font-bold text-[#61C0FF] shrink-0">
                        JD
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostComment();
                          }}
                          placeholder="Add a comment..."
                          rows={3}
                          className="input-dark w-full resize-none text-sm leading-relaxed"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-[#9CA3AF]">⌘ + Enter to post</span>
                          <button
                            onClick={handlePostComment}
                            disabled={!commentText.trim() || submitting}
                            className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            {submitting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Post Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comment list */}
                  {comments.length === 0 ? (
                    <div className="card p-12 text-center">
                      <MessageSquare size={32} className="mx-auto mb-3 opacity-10" />
                      <p className="font-semibold text-white mb-1">No comments yet</p>
                      <p className="text-sm text-[#9CA3AF]">Be the first to comment</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {comments.map(c => <CommentBubble key={c.id} comment={c} />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — sidebar */}
            <div className="lg:w-72 xl:w-80 shrink-0 space-y-4">
              {/* Location */}
              <div className="card p-5">
                <h3 className="label-micro text-[#61C0FF] mb-3">Location</h3>
                <div className="flex items-start gap-2 text-sm text-[#9CA3AF] mb-3">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-[#61C0FF]" />
                  <span>{issue.address}</span>
                </div>
                {/* Map placeholder */}
                <div className="rounded-xl overflow-hidden bg-[#0E131A] border border-white/5 h-40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#61C0FF]/20 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-[#61C0FF]/10 flex items-center justify-center group-hover:bg-[#61C0FF]/20 transition-colors">
                    <MapPin size={18} className="text-[#61C0FF]" />
                  </div>
                  <span className="text-xs text-[#9CA3AF] group-hover:text-white transition-colors">Map View</span>
                </div>
              </div>

              {/* Reported By */}
              <div className="card p-5">
                <h3 className="label-micro text-[#61C0FF] mb-3">Reported By</h3>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#61C0FF]/20 flex items-center justify-center text-sm font-bold text-[#61C0FF]">
                    {issue.author_initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{issue.author}</div>
                    <div className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="card p-5">
                <h3 className="label-micro text-[#61C0FF] mb-4">Details</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Created',      value: format(new Date(issue.created_at), 'M/d/yyyy') },
                    { label: 'Last Updated', value: format(new Date(issue.updated_at), 'M/d/yyyy') },
                    { label: 'Category',     value: `${issue.category_icon} ${issue.category}` },
                    { label: 'Severity',     value: issue.severity },
                    { label: 'Followers',    value: String(issue.follow_count + (following ? 1 : 0)) },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-[#9CA3AF]">{row.label}</span>
                      <span className="text-xs text-white font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="card p-5">
                <h3 className="label-micro text-[#61C0FF] mb-4">Engagement</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: ThumbsUp,       val: upvoteCount,                        label: 'Upvotes' },
                    { icon: MessageSquare,  val: comments.length + issue.comment_count, label: 'Comments' },
                    { icon: Eye,            val: issue.follow_count + (following ? 1 : 0), label: 'Followers' },
                  ].map(({ icon: Icon, val, label }) => (
                    <div key={label} className="text-center bg-[#0E131A] rounded-xl p-3 border border-white/5">
                      <Icon size={14} className="mx-auto mb-1.5 text-[#61C0FF]" />
                      <div className="text-base font-black text-white">{val}</div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
