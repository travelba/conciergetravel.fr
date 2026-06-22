/**
 * toxic-official-url.ts — write-time guard for "this URL is NOT a legitimate
 * hotel official site".
 *
 * The detector itself now lives in `@mch/domain/url` (a pure, no-I/O domain
 * helper) so the SAME regex is shared by every consumer with no drift:
 *
 *   - the write boundary (this pipeline) — `convert-wikidata-to-external-sources.ts`
 *     + `photos/backfill-official-url.ts` veto squatter URLs before they reach
 *     `official_url` / `external_sources`;
 *   - the emission boundary — `@mch/seo` (`jsonld/hotel.ts` → `Restaurant.url`)
 *     and `@mch/web` (`get-hotel-by-slug.ts` → the `official` provenance
 *     reference + the `official_url → sameAs` projection) veto squatter URLs
 *     before they reach the JSON-LD / a rendered "Site officiel" link.
 *
 * This module re-exports the canonical implementation so the existing
 * fixtures in `toxic-official-url.test.ts` keep pinning the regex from the
 * pipeline's vantage point.
 */
export { isToxicOfficialUrl } from '@mch/domain/url';
