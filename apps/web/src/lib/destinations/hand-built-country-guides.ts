/**
 * Hand-built country guides — the 8 polished, natively-bilingual
 * `/guide/<country>` routes that predate the DB-backed editorial guide
 * pipeline (`apps/web/src/app/[locale]/guide/<slug>/page.tsx`).
 *
 * These stay canonical for their country: their `editorial_guides` DB
 * rows are `is_published = false` (the richer hand-built React page
 * wins). Everywhere a country guide is linked we must route these 8 to
 * `/guide/<slug>` and route every *other* (DB-backed) country guide to
 * `/destination/<slug>` (rendered by `<StandaloneGuidePage>`).
 *
 * Single source of truth shared by:
 *   - `app/[locale]/destination/[citySlug]/page.tsx` (308-redirect
 *     `/destination/<slug>` → `/guide/<slug>` so the two URLs never
 *     compete for the same SERP).
 *   - `server/destinations/list-destination-countries.ts` (directory
 *     link routing).
 *
 * Phase 1.5 country-guide surfacing — see AGENTS.md §4bis + the
 * `feat/surface-country-guides` work.
 */

/** Slugs of the 8 hand-built `/guide/<slug>` country pages. */
export const HAND_BUILT_COUNTRY_GUIDE_SLUGS: ReadonlySet<string> = new Set<string>([
  'japon',
  'italie',
  'etats-unis',
  'emirats-arabes-unis',
  'suisse',
  'thailande',
  'maroc',
  'maldives',
]);

/**
 * ISO 3166-1 alpha-2 (uppercase) → hand-built `/guide` slug. Lets the
 * directory resolve the canonical hand-built page for a country that
 * has published hotels but whose DB country-guide row is unpublished.
 */
export const HAND_BUILT_COUNTRY_GUIDE_BY_CODE: Readonly<Record<string, string>> = {
  JP: 'japon',
  IT: 'italie',
  US: 'etats-unis',
  AE: 'emirats-arabes-unis',
  CH: 'suisse',
  TH: 'thailande',
  MA: 'maroc',
  MV: 'maldives',
};

export function isHandBuiltCountrySlug(slug: string): boolean {
  return HAND_BUILT_COUNTRY_GUIDE_SLUGS.has(slug);
}
