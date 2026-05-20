import type React from 'react';

interface Props {
  readonly variant?: 'hero' | 'gallery' | 'thumbnail' | 'square';
  readonly hotelName: string;
  readonly category?: string;
  readonly className?: string;
}

const ASPECT_RATIO: Record<NonNullable<Props['variant']>, string> = {
  hero: 'aspect-[16/9]',
  gallery: 'aspect-[3/2]',
  thumbnail: 'aspect-[4/3]',
  square: 'aspect-square',
};

/**
 * Programmatic placeholder rendered when an editorial fiche is **complete on
 * the content side** (sections, concierge advice, FAQ ≥ 10) but the
 * `hero_image` / `gallery_images` haven't been uploaded yet — typical of
 * the FR Concierge overnight production where photos are deferred to the
 * end of the project.
 *
 * Renders a sober stone-tinted block with an inline camera glyph + a label
 * derived from the hotel name. Sized via aspect-ratio classes so the layout
 * never shifts when real photos drop in. WCAG 2.2 AA compliant — fully
 * decorative (`role="img"` with `aria-label` carrying the hotel name).
 *
 * Pair with the conditional skip in `packages/seo/src/jsonld/hotel.ts`:
 * when a hotel has no `hero_image`, the JSON-LD builder MUST omit
 * `image[]` entirely rather than emit a placeholder URL — Google flags
 * placeholder graphics as broken `ImageObject` references.
 *
 * Skill: responsive-ui-architecture, accessibility, structured-data-schema-org.
 */
export function HotelImagePlaceholder({
  variant = 'gallery',
  hotelName,
  category,
  className,
}: Props): React.ReactElement {
  const ariaLabel = category
    ? `Photo à venir — ${hotelName} (${category})`
    : `Photo à venir — ${hotelName}`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={[
        'relative flex w-full items-center justify-center overflow-hidden bg-stone-100 ring-1 ring-stone-200',
        ASPECT_RATIO[variant],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 text-stone-300"
      >
        <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      {category ? (
        <span className="absolute bottom-2 right-3 text-xs uppercase tracking-wide text-stone-400">
          {category}
        </span>
      ) : null}
    </div>
  );
}
