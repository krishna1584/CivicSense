'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Send, Loader2, ShieldAlert, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { reviewsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { clsx } from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_hidden: boolean;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  reviewer_trust: number;
}

interface Summary {
  avg_rating: string | null;
  total_reviews: string;
  five_star: string;
  four_star: string;
  three_star: string;
  two_star: string;
  one_star: string;
}

// ─── Star Display ─────────────────────────────────────────────────────────────
function StarRow({ rating, size = 16, interactive = false, onChange }: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= (interactive ? (hovered || rating) : rating);
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => interactive && setHovered(n)}
            onMouseLeave={() => interactive && setHovered(0)}
            className={clsx(
              'transition-transform duration-100',
              interactive && 'hover:scale-125 cursor-pointer',
              !interactive && 'cursor-default'
            )}
          >
            <Star
              size={size}
              className={clsx(
                'transition-colors duration-150',
                filled ? 'text-state-warning fill-state-warning' : 'text-base-700 fill-base-900'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Rating Bar ───────────────────────────────────────────────────────────────
function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="text-content-muted w-14 text-right shrink-0">{label}</span>
      <div className="flex-1 bg-base-900 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-state-warning transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-content-muted w-5 text-left shrink-0">{count}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReviewSection({ issueId, isResolved }: { issueId: string; isResolved: boolean }) {
  const { user } = useAuthStore();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [userEligible, setUserEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await reviewsApi.list(issueId);
      setReviews(res.data.reviews);
      setSummary(res.data.summary);
      setUserReview(res.data.userReview);
      setUserEligible(res.data.userEligible);
      if (res.data.userReview) {
        setRating(res.data.userReview.rating);
        setComment(res.data.userReview.comment || '');
      }
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    if (isResolved) fetchReviews();
  }, [isResolved, fetchReviews]);

  if (!isResolved) return null;

  const totalReviews = parseInt(summary?.total_reviews || '0');
  const avgRating = parseFloat(summary?.avg_rating || '0');

  const handleSubmit = async () => {
    if (rating === 0) { setSubmitError('Please select a star rating.'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await reviewsApi.submit(issueId, { rating, comment: comment.trim() || undefined });
      setUserReview(res.data.review);
      setIsEditing(false);
      fetchReviews();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHide = async (reviewId: string) => {
    try {
      await reviewsApi.hide(issueId, reviewId);
      fetchReviews();
    } catch (err) {
      console.error('Failed to hide review', err);
    }
  };

  const showForm = userEligible && (!userReview || isEditing);

  return (
    <div className="space-y-6 animate-fade_in">

      {/* ── Summary Header ── */}
      <div className="card p-6 bg-base-800">
        <h3 className="label-micro mb-5 text-accent-primary">Citizen Satisfaction</h3>

        {loading ? (
          <div className="flex items-center gap-3 text-content-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading reviews...</span>
          </div>
        ) : totalReviews === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <Star key={n} size={24} className="text-base-700" />
              ))}
            </div>
            <p className="text-content-muted text-sm font-medium">No reviews yet</p>
            <p className="text-content-muted text-xs">Be the first to rate this resolution</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Big average */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <span className="text-5xl font-black text-state-warning leading-none">{avgRating.toFixed(1)}</span>
              <StarRow rating={Math.round(avgRating)} size={18} />
              <span className="text-[11px] text-content-muted font-medium">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</span>
            </div>

            {/* Breakdown bars */}
            <div className="flex-1 space-y-1.5 w-full">
              <RatingBar label="5 ★" count={parseInt(summary?.five_star || '0')} total={totalReviews} />
              <RatingBar label="4 ★" count={parseInt(summary?.four_star || '0')} total={totalReviews} />
              <RatingBar label="3 ★" count={parseInt(summary?.three_star || '0')} total={totalReviews} />
              <RatingBar label="2 ★" count={parseInt(summary?.two_star || '0')} total={totalReviews} />
              <RatingBar label="1 ★" count={parseInt(summary?.one_star || '0')} total={totalReviews} />
            </div>
          </div>
        )}
      </div>

      {/* ── User's existing review (not editing) ── */}
      {userReview && !isEditing && (
        <div className="card p-5 bg-base-800 border border-accent-secondary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-accent-secondary rounded-l-xl" />
          <div className="pl-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-secondary">Your Review</span>
                <StarRow rating={userReview.rating} size={14} />
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="text-[11px] text-content-muted hover:text-accent-secondary transition-colors font-medium"
              >
                Edit
              </button>
            </div>
            {userReview.comment && (
              <p className="text-[14px] text-content-secondary leading-relaxed">{userReview.comment}</p>
            )}
            <p className="text-[11px] text-content-muted mt-2">
              {formatDistanceToNow(new Date(userReview.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      )}

      {/* ── Review Form ── */}
      {showForm && (
        <div className="card p-6 bg-base-800">
          <h3 className="label-micro mb-4 text-accent-primary">
            {isEditing ? 'Update Your Review' : 'Rate This Resolution'}
          </h3>

          {/* Not logged in */}
          {!user && (
            <p className="text-[13px] text-content-muted">
              Please <a href="/login" className="text-accent-secondary hover:underline">sign in</a> to leave a review.
            </p>
          )}



          {/* Form */}
          {user && userEligible && (
            <div className="space-y-4">
              {/* Star picker */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-2">
                  Your Rating
                </label>
                <StarRow rating={rating} size={28} interactive onChange={setRating} />
                {rating > 0 && (
                  <p className="text-[12px] text-content-muted mt-1.5">
                    {['', 'Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'][rating]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted block mb-2">
                  Comment <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Was the pothole properly filled? Did the fix last? Share your experience..."
                  rows={3}
                  className="input-dark w-full resize-none text-[14px] leading-relaxed p-3.5"
                  maxLength={500}
                />
                <p className="text-[11px] text-content-muted text-right mt-1">{comment.length}/500</p>
              </div>

              {submitError && (
                <p className="text-[12px] text-state-error flex items-center gap-1.5">
                  <ShieldAlert size={13} /> {submitError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || rating === 0}
                  className="btn-accent flex items-center gap-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </button>
                {isEditing && (
                  <button
                    onClick={() => { setIsEditing(false); setRating(userReview?.rating || 0); setComment(userReview?.comment || ''); }}
                    className="text-[13px] text-content-muted hover:text-content-primary transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Review List ── */}
      {!loading && totalReviews > 0 && (
        <div className="space-y-4">
          <h3 className="label-micro text-accent-primary">
            Community Reviews
            <span className="ml-2 text-content-muted font-normal normal-case text-xs">({totalReviews})</span>
          </h3>

          {reviews.map(review => {
            const initials = review.reviewer_name
              ? review.reviewer_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              : 'U';
            const avatarUrl = review.reviewer_avatar ? formatMediaUrl(review.reviewer_avatar) : '';
            const isAdmin = user?.role === 'admin' || user?.role === 'department_staff';

            return (
              <div key={review.id} className={clsx(
                'card p-5 bg-base-800 group',
                review.is_hidden && 'opacity-50 border-dashed'
              )}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-accent-secondary/10 border border-accent-secondary/20 flex items-center justify-center text-[12px] font-bold text-accent-secondary overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={review.reviewer_name} className="w-full h-full object-cover" />
                    ) : initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-content-primary">{review.reviewer_name}</span>
                        {review.reviewer_trust >= 50 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-state-success/20 bg-state-success/10 text-state-success font-bold uppercase tracking-wide">
                            Trusted
                          </span>
                        )}
                        {review.is_hidden && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-state-error/20 bg-state-error/10 text-state-error font-bold uppercase tracking-wide">
                            Hidden
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <StarRow rating={review.rating} size={13} />
                        <span className="text-[11px] text-content-muted">
                          {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                        </span>
                        {/* Admin hide toggle */}
                        {isAdmin && (
                          <button
                            onClick={() => handleHide(review.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-state-error p-1 rounded"
                            title={review.is_hidden ? 'Show review' : 'Hide review'}
                          >
                            {review.is_hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {review.comment && (
                      <p className="text-[14px] text-content-secondary leading-relaxed">{review.comment}</p>
                    )}
                    {!review.comment && (
                      <p className="text-[12px] text-content-muted italic">No written review</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}
