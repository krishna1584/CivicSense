'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';

interface StarRatingProps {
  rating: number;
  size?: number;
  onChange?: (rating: number) => void;
}

/** Read-only stars, or a picker when `onChange` is given. */
export function StarRating({ rating, size = 14, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const shown = onChange ? hovered || rating : rating;

  return (
    <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Rating' : `${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => {
        const icon = (
          <Star
            size={size}
            className={clsx(n <= shown ? 'text-state-warning fill-state-warning' : 'text-border-subtle fill-transparent')}
          />
        );
        if (!onChange) return <span key={n}>{icon}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
