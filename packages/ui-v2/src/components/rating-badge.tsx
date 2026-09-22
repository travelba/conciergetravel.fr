import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { formatRatingScore, resolveRatingLabel } from '../lib/rating-label';
import { cn } from '../lib/cn';

const ratingBadgeVariants = cva('inline-flex flex-col items-end gap-0.5 text-right', {
  variants: {
    size: {
      sm: '[&_[data-score]]:text-lg [&_[data-label]]:text-xs',
      md: '[&_[data-score]]:text-xl [&_[data-label]]:text-sm',
      lg: '[&_[data-score]]:text-2xl [&_[data-label]]:text-sm',
    },
    align: {
      end: 'items-end text-right',
      start: 'items-start text-left',
    },
  },
  defaultVariants: { size: 'md', align: 'end' },
});

export type RatingBadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof ratingBadgeVariants> & {
    /** Score on the UI /10 scale (CDC C1a). */
    scoreOutOfTen: number;
    /** Optional review count shown below the label. */
    reviewCount?: number;
  };

export function RatingBadge({
  className,
  scoreOutOfTen,
  reviewCount,
  size,
  align,
  ...props
}: RatingBadgeProps) {
  const label = resolveRatingLabel(scoreOutOfTen);
  const formattedScore = formatRatingScore(scoreOutOfTen);

  if (label === null) {
    return null;
  }

  return (
    <div className={cn(ratingBadgeVariants({ size, align }), className)} {...props}>
      <div className="flex items-baseline gap-1">
        <span
          data-score
          className="rounded-sm bg-[var(--color-primary-heritage)] px-1.5 py-0.5 font-semibold leading-none text-[var(--color-inverse-on-surface)]"
        >
          {formattedScore}
        </span>
      </div>
      <span data-label className="font-medium text-[var(--color-fg)]">
        {label}
      </span>
      {reviewCount !== undefined && reviewCount > 0 ? (
        <span className="text-xs text-[var(--color-muted)]">
          {reviewCount.toLocaleString('fr-FR')} avis
        </span>
      ) : null}
    </div>
  );
}

export { ratingBadgeVariants };
