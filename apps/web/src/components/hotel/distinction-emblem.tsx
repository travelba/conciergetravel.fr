import type React from 'react';

/**
 * Shared distinction emblem — a bespoke amber medallion glyph per
 * recognition family (Palace laurel, Forbes star, Michelin Key, Relais &
 * Châteaux crest, Leading crown, eco leaf, awards trophy, guide book,
 * hotel-group crest). Consumed by both `<HotelAwards>` (CDC §2 bloc 11,
 * editorial mentions) and `<HotelTrustSignals>` (bloc 13, structured
 * affiliations) so the whole "distinctions" area reads in one language.
 *
 * Pure decoration (`aria-hidden`) and **no third-party trademark logos** —
 * the distinction name carries the meaning (see
 * `.cursor/skills/competitive-pricing-comparison/SKILL.md`).
 */

export type DistinctionKind =
  | 'palace'
  | 'stars'
  | 'key'
  | 'relais'
  | 'leading'
  | 'green'
  | 'trophy'
  | 'guide'
  | 'brand'
  | 'medal';

/**
 * Keyword table driving {@link resolveDistinctionKind}. Order matters: the
 * more specific families win first (a "Michelin Key" must beat the generic
 * "michelin"/guide family; a Forbes "five star" must beat the bare "star").
 */
const DISTINCTION_KEYWORDS: readonly (readonly [DistinctionKind, readonly string[]])[] = [
  ['palace', ['palace', 'atout france']],
  ['key', ['michelin key', 'clé michelin', 'cle michelin', 'michelin keys', 'clés michelin', 'cles michelin']],
  [
    'green',
    ['green key', 'clef verte', 'clé verte', 'cle verte', 'leed', 'green globe', 'écolabel', 'ecolabel', 'breeam', 'green star', 'earthcheck'],
  ],
  ['relais', ['relais & châteaux', 'relais et châteaux', 'relais & chateaux', 'relais and chateaux', 'relais&châteaux']],
  ['leading', ['leading hotels', 'lhw', 'small luxury hotels', 'slh', 'virtuoso', 'preferred hotels', 'design hotels']],
  [
    'trophy',
    ['world travel awards', "world's 50 best", 'worlds 50 best', '50 best', 'condé nast', 'conde nast', 'readers', 'travel + leisure', 'travel and leisure', "travellers' choice", 'best hotel', 'gold list', 'hot list'],
  ],
  ['stars', ['forbes', 'five star', 'five-star', '5 star', '5-star', 'cinq étoiles', 'cinq etoiles', '5 étoiles', '5 etoiles']],
  ['guide', ['michelin', 'gault', 'tablet', 'guide', 'star']],
];

export function resolveDistinctionKind(label: string): DistinctionKind {
  const haystack = label.toLowerCase();
  for (const [kind, keywords] of DISTINCTION_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return kind;
  }
  return 'medal';
}

const DISTINCTION_ICON_PATHS: Record<DistinctionKind, React.ReactNode> = {
  // Laurel wreath — Palace / Atout France.
  palace: (
    <>
      <path d="M12 3c-3.5 1.5-5.5 5-5.5 9s2 7.5 5.5 9M12 3c3.5 1.5 5.5 5 5.5 9s-2 7.5-5.5 9" />
      <path d="M8 8c1 .5 2 .5 3 0M8 13c1 .5 2 .5 3 0M16 8c-1 .5-2 .5-3 0M16 13c-1 .5-2 .5-3 0" />
    </>
  ),
  // Five-point star — Forbes / 5-star rating.
  stars: <path d="M12 3l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9l-5.1 2.6 1-5.7-4.1-4 5.7-.8z" />,
  // Key — Michelin Key.
  key: (
    <>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M10.5 10.5L20 20M16.5 16.5l2-2M18.5 18.5l1.5-1.5" />
    </>
  ),
  // Crest / shield — Relais & Châteaux.
  relais: (
    <>
      <path d="M12 3l7 3v5.5c0 4.2-3 7.3-7 9.5-4-2.2-7-5.3-7-9.5V6z" />
      <path d="M12 8v5M9.5 10.5h5" />
    </>
  ),
  // Crown — Leading / Small Luxury Hotels.
  leading: (
    <>
      <path d="M4 8l3.2 3 4.8-6 4.8 6L20 8l-2 11H6z" />
      <path d="M6 19h12" />
    </>
  ),
  // Leaf — eco / green certifications.
  green: (
    <>
      <path d="M5 19c0-8 6-13.5 14-13.5C19 13.5 13 19 5 19z" />
      <path d="M5.5 18.5c3-4.5 6.5-7 11-8.5" />
    </>
  ),
  // Trophy — travel awards / "best of" rankings.
  trophy: (
    <>
      <path d="M7 4h10v3a5 5 0 0 1-10 0zM7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M9 14h6M10 18h4M9 21h6" />
    </>
  ),
  // Open book — guides (Michelin star, Gault&Millau, Tablet).
  guide: <path d="M12 6c-2-1.2-4.5-1.5-7-1v13c2.5-.5 5-.2 7 1 2-1.2 4.5-1.5 7-1V5c-2.5-.5-5-.2-7 1zM12 6v13" />,
  // Building crest — hotel group / brand.
  brand: (
    <>
      <path d="M4 21V6l8-3 8 3v15M4 21h16" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" />
    </>
  ),
  // Ribbon medal — generic distinction.
  medal: (
    <>
      <path d="M9 3l3 5 3-5" />
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M12 11.5l.8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.3 1.9-.3z" />
    </>
  ),
};

interface DistinctionEmblemProps {
  /** Free text used to resolve the glyph (award name, issuer, display_name). */
  readonly label: string;
  /** Forces a glyph instead of resolving from `label` (e.g. the brand column). */
  readonly forceKind?: DistinctionKind;
  /** `md` = 40px medallion (cards), `sm` = 28px (dense affiliation grid). */
  readonly size?: 'sm' | 'md';
}

export function DistinctionEmblem({
  label,
  forceKind,
  size = 'md',
}: DistinctionEmblemProps): React.ReactElement {
  const kind = forceKind ?? resolveDistinctionKind(label);
  const box = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span
      aria-hidden
      className={`border-accent/30 bg-accent/10 text-accent flex ${box} shrink-0 items-center justify-center rounded-full border`}
    >
      <svg
        viewBox="0 0 24 24"
        className={glyph}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {DISTINCTION_ICON_PATHS[kind]}
      </svg>
    </span>
  );
}
