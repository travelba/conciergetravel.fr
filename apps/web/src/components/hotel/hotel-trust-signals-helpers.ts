import type { HotelAffiliation } from '@mch/db';

import { KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

/**
 * Pure helpers backing `<HotelTrustSignals>` (CDC §2 bloc 13).
 *
 * Kept in a separate file so Vitest can exercise the filtering / sort
 * logic without dragging the React + `next-intl/server` runtime into
 * the test boundary — the component imports `@/i18n/navigation` (the
 * locale-aware `Link`), which in turn imports `next-intl` modules that
 * resolve only through Next.js, not jsdom.
 */

/**
 * Stable identifier for the Atout France Palace synthetic entry. We
 * insert it into the `labels` bucket when `isPalace === true` and the
 * caller did not provide an affiliation row for it. De-dup happens via
 * this source string so an editor who later adds the affiliation
 * manually never sees a duplicate row in the UI.
 */
export const PALACE_SYNTHETIC_SOURCE = 'palace_atout_france';

/**
 * The subset of `affiliations[].facet_slug` values that resolve to a
 * working `/marque/[brandSlug]` page. Kept in lockstep with
 * `KNOWN_BRANDS` (single source of truth — see
 * `apps/web/src/server/hotels/get-related-hotels.ts`). Any other
 * `facet_slug` value renders the brand as plain text — we never link
 * to a slug that would 404.
 */
const BRAND_PAGE_SLUGS: ReadonlySet<string> = new Set(KNOWN_BRANDS.map((b) => b.slug));

export interface TrustSignalsSections {
  readonly hasAny: boolean;
  readonly brand: HotelAffiliation | null;
  readonly labels: readonly HotelAffiliation[];
  readonly rankings: readonly HotelAffiliation[];
  readonly guides: readonly HotelAffiliation[];
}

/**
 * Pure helper — splits the affiliations array into the 4 buckets the
 * `<HotelTrustSignals>` component renders, applies the synthetic Palace
 * row when `isPalace === true`, deduplicates against a real
 * `palace_atout_france` entry, and sorts each bucket by `since_year`
 * descending (then by `display_name` for stability).
 *
 * Defensive `verified` filter: the page-level reader (`readAffiliations`
 * in `apps/web/src/server/hotels/get-hotel-by-slug.ts`) already filters
 * verified=true, but we re-apply the predicate here so any future
 * caller that bypasses the reader cannot accidentally surface
 * unverified rows (Hard Rule 14 in
 * `.cursor/rules/hotel-detail-page.mdc`).
 */
export function buildTrustSignalsSections({
  affiliations,
  isPalace,
}: {
  readonly affiliations: readonly HotelAffiliation[];
  readonly isPalace: boolean;
}): TrustSignalsSections {
  const verified = affiliations.filter((a) => a.verified === true);

  const sortByYearDescNameAsc = (a: HotelAffiliation, b: HotelAffiliation): number => {
    const aYear = a.since_year ?? 0;
    const bYear = b.since_year ?? 0;
    if (aYear !== bYear) return bYear - aYear;
    return a.display_name.localeCompare(b.display_name, 'fr');
  };

  const brands = verified
    .filter((a) => a.kind === 'brand')
    .slice()
    .sort(sortByYearDescNameAsc);
  const brand: HotelAffiliation | null = brands.length > 0 ? (brands[0] ?? null) : null;

  const labelsRaw = verified
    .filter((a) => a.kind === 'label')
    .slice()
    .sort(sortByYearDescNameAsc);

  const hasPalaceRow = labelsRaw.some((a) => a.source === PALACE_SYNTHETIC_SOURCE);
  const labels: HotelAffiliation[] = labelsRaw.slice();
  if (isPalace && !hasPalaceRow) {
    labels.unshift({
      kind: 'label',
      source: PALACE_SYNTHETIC_SOURCE,
      display_name: 'Palace — Atout France',
      verified: true,
    });
  }

  const rankings = verified
    .filter((a) => a.kind === 'ranking')
    .slice()
    .sort(sortByYearDescNameAsc);
  const guides = verified
    .filter((a) => a.kind === 'guide')
    .slice()
    .sort(sortByYearDescNameAsc);

  const hasAny = brand !== null || labels.length > 0 || rankings.length > 0 || guides.length > 0;

  return { hasAny, brand, labels, rankings, guides };
}

/**
 * Brand link helper — returns the `/marque/<slug>` slug to feed the
 * in-app `Link` when the brand `facet_slug` resolves to a known
 * `/marque/<brandSlug>` page, or `null` when we should render the
 * brand as plain text instead. Never returns an external URL:
 * PageRank stays inside the catalogue.
 */
export function brandHrefSlug(brand: HotelAffiliation): string | null {
  const slug = brand.facet_slug ?? brand.source.replace(/_/gu, '-');
  return BRAND_PAGE_SLUGS.has(slug) ? slug : null;
}
