'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';

import { cn } from '../lib/cn';
import { Badge } from './badge';
import { RatingBadge } from './rating-badge';

type HotelCardContentProps = {
  name: string;
  stars?: number;
  district?: string;
  distanceLabel?: string;
  highlights: string[];
  editorialBadge?: string;
  image: React.ReactNode;
  priceSlot: React.ReactNode;
  ratingScoreOutOfTen?: number;
  reviewCount?: number;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
};

export type HotelCardProps = {
  name: string;
  stars?: number;
  district?: string;
  distanceLabel?: string;
  highlights?: string[];
  editorialBadge?: string;
  image: React.ReactNode;
  priceSlot: React.ReactNode;
  ratingScoreOutOfTen?: number;
  reviewCount?: number;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function HotelCard({
  name,
  stars,
  district,
  distanceLabel,
  highlights = [],
  editorialBadge,
  image,
  priceSlot,
  ratingScoreOutOfTen,
  reviewCount,
  isFavorite = false,
  onFavoriteToggle,
  href,
  onClick,
  className,
}: HotelCardProps) {
  const cardClassName = cn(
    'group relative flex min-h-[var(--hotel-card-min-height)] w-full overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]',
    (href !== undefined || onClick !== undefined) && 'cursor-pointer',
    className,
  );

  const contentProps: HotelCardContentProps = {
    name,
    image,
    priceSlot,
    highlights,
    isFavorite,
  };
  if (stars !== undefined) contentProps.stars = stars;
  if (district !== undefined) contentProps.district = district;
  if (distanceLabel !== undefined) contentProps.distanceLabel = distanceLabel;
  if (editorialBadge !== undefined) contentProps.editorialBadge = editorialBadge;
  if (ratingScoreOutOfTen !== undefined) contentProps.ratingScoreOutOfTen = ratingScoreOutOfTen;
  if (reviewCount !== undefined) contentProps.reviewCount = reviewCount;
  if (onFavoriteToggle !== undefined) contentProps.onFavoriteToggle = onFavoriteToggle;

  const content = <HotelCardContent {...contentProps} />;
  if (href !== undefined) {
    return (
      <a href={href} onClick={onClick} className={cardClassName}>
        {content}
      </a>
    );
  }

  if (onClick !== undefined) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} className={cardClassName}>
        {content}
      </div>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

function HotelCardContent({
  name,
  stars,
  district,
  distanceLabel,
  highlights,
  editorialBadge,
  image,
  priceSlot,
  ratingScoreOutOfTen,
  reviewCount,
  isFavorite = false,
  onFavoriteToggle,
}: HotelCardContentProps) {
  return (
    <>
      <div className="relative w-[200px] shrink-0 overflow-hidden sm:w-[220px]">{image}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-lg leading-tight text-[var(--color-fg)]">
              {name}
            </h3>
            {stars !== undefined && stars > 0 ? (
              <p
                className="mt-0.5 text-xs text-[var(--color-gold-700)]"
                aria-label={`${stars} étoiles`}
              >
                {'★'.repeat(Math.min(stars, 5))}
              </p>
            ) : null}
          </div>
          {onFavoriteToggle !== undefined ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onFavoriteToggle();
              }}
              className="shrink-0 rounded-sm p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={isFavorite}
            >
              <Heart
                className={cn(
                  'size-5',
                  isFavorite && 'fill-[var(--color-danger)] text-[var(--color-danger)]',
                )}
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        {(district !== undefined || distanceLabel !== undefined) && (
          <p className="text-xs text-[var(--color-muted)]">
            {[district, distanceLabel].filter(Boolean).join(' · ')}
          </p>
        )}

        {highlights !== undefined && highlights.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {highlights.slice(0, 3).map((item) => (
              <li key={item}>
                <Badge variant="neutral">{item}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {editorialBadge !== undefined ? (
          <Badge variant="gold" className="w-fit">
            {editorialBadge}
          </Badge>
        ) : null}
      </div>

      <div className="flex w-[140px] shrink-0 flex-col items-end justify-between gap-3 border-l border-[var(--color-border)] p-3 sm:w-[160px] sm:p-4">
        {ratingScoreOutOfTen !== undefined ? (
          <RatingBadge
            scoreOutOfTen={ratingScoreOutOfTen}
            {...(reviewCount !== undefined ? { reviewCount } : {})}
            size="sm"
          />
        ) : null}
        <div className="mt-auto w-full text-right">{priceSlot}</div>
      </div>
    </>
  );
}
