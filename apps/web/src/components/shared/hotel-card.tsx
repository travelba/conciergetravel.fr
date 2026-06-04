import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cn } from '@mch/ui';

import { Link } from '@/i18n/navigation';

type HotelHref = ComponentProps<typeof Link>['href'];

export interface HotelCardProps {
  /** Typed i18n href to the hotel fiche. */
  readonly href: HotelHref;
  /** `grid` = vertical tile (listing/discovery). `row` = horizontal (annuaire). */
  readonly variant?: 'grid' | 'row';
  readonly name: string;
  /** e.g. "Paris 8e · Champs-Élysées". Hidden when empty. */
  readonly location?: string;
  /** Distinction pill — Palace gets the solid gold fill, others the outline. */
  readonly distinction?: { readonly label: string; readonly isPalace: boolean } | null;
  readonly brandLabel?: string | null;
  readonly excerpt?: string | null;
  /** Photo node (e.g. `<HotelImage>` or a placeholder) — fills the frame. */
  readonly media: ReactNode;
  /** Optional price node, e.g. "À partir de 980 € / nuit". */
  readonly price?: ReactNode;
  /** Optional rating chip content, e.g. "9,4". */
  readonly rating?: ReactNode;
  /** CTA affordance label (visual only — the whole card is the link). */
  readonly ctaLabel?: string;
  /** `data-*` passthrough for analytics / e2e selectors. */
  readonly dataAttrs?: Readonly<Record<string, string | number>>;
  readonly prefetch?: boolean;
  readonly className?: string;
}

/**
 * Unified hotel card — the single source for every hotel tile (listing,
 * discovery, annuaire row, editorial cross-links). Slot-based so each surface
 * supplies its own optimized photo / price node while the card owns layout,
 * badges, typography, focus and hover behaviour.
 *
 * Honest-data friendly: `price` and `rating` are optional slots that simply
 * don't render until the booking inventories light them up.
 */
export function HotelCard({
  href,
  variant = 'grid',
  name,
  location,
  distinction = null,
  brandLabel,
  excerpt,
  media,
  price,
  rating,
  ctaLabel,
  dataAttrs,
  prefetch = false,
  className,
}: HotelCardProps): ReactElement {
  const isRow = variant === 'row';

  return (
    <Link
      href={href}
      prefetch={prefetch}
      {...dataAttrs}
      className={cn(
        'border-border/60 bg-surface-container-lowest shadow-card duration-base ease-standard group flex h-full overflow-hidden rounded-2xl border transition',
        'hover:shadow-card-hover hover:border-gold-300 hover:-translate-y-0.5',
        'focus-visible:outline-ring focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
        isRow ? 'flex-col sm:flex-row' : 'flex-col',
        className,
      )}
    >
      {/* Photo frame + overlays */}
      <div
        className={cn(
          'bg-surface-container relative shrink-0 overflow-hidden',
          isRow ? 'aspect-[16/10] w-full sm:aspect-auto sm:w-52 md:w-56' : 'aspect-[4/3] w-full',
        )}
      >
        <div className="[&>img]:duration-slow [&>img]:ease-editorial absolute inset-0 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:transition-transform group-hover:[&>img]:scale-105">
          {media}
        </div>
        {distinction != null && (
          <span
            className={cn(
              'text-label-caps shadow-xs absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 uppercase backdrop-blur-sm',
              distinction.isPalace ? 'bg-gold text-charcoal' : 'bg-off-white/95 text-gold-800',
            )}
          >
            {distinction.label}
          </span>
        )}
        {rating != null && (
          <span className="bg-off-white/95 text-charcoal shadow-xs absolute right-3 top-3 inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium backdrop-blur-sm">
            {rating}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-fg duration-fast group-hover:text-gold-800 font-serif text-lg leading-snug transition-colors md:text-xl">
          {name}
        </h3>

        {location != null && location.length > 0 && (
          <p className="text-muted mt-1 flex items-center gap-1 text-xs">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              aria-hidden="true"
              className="shrink-0 fill-current opacity-70"
            >
              <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {location}
          </p>
        )}

        {brandLabel != null && brandLabel.length > 0 && (
          <p className="mt-1.5">
            <span className="border-border text-label-caps text-muted inline-flex items-center rounded border px-1.5 py-0.5 uppercase">
              {brandLabel}
            </span>
          </p>
        )}

        {excerpt != null && excerpt.length > 0 && (
          <p className="text-muted mt-2 line-clamp-2 text-sm">{excerpt}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {price != null ? <div className="text-fg text-sm">{price}</div> : <span />}
          {ctaLabel != null && (
            <span className="bg-gold text-charcoal duration-fast group-hover:bg-gold-600 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors">
              {ctaLabel}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
