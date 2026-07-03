/**
 * Hotel indexability predicate — shared between:
 *   - `listIndexableHotelSlugs()`              (sitemap-hotels.xml)
 *   - `page.tsx#generateMetadata`              (robots: noindex flag)
 *   - `list-indexable-for-llms.ts`             (llms-full.txt corpus)
 *
 * The three call-sites MUST agree, otherwise the sitemap would list a
 * URL that emits `noindex` (or vice-versa) and tank crawl budget.
 *
 * Two paths to indexability — kept separate so we can phase out the
 * photo-rich path independently if needed:
 *
 * 1. **Photo-rich** (legacy, < May 2026):
 *      hero_image present AND (≥5 gallery photos OR ≥1 long-form section)
 *    The original CDC §2 EEAT bar. Always wins when photos exist.
 *
 * 2. **Editorial-only** (Phase 1, May 2026 — `AGENTS.md §4ter`):
 *      ≥1 long_description_section OR
 *      (description_fr ≥ 600 chars AND factual_summary_fr ≥ 100 chars
 *       AND concierge_advice non-null AND faq_content ≥ 10 items)
 *    The Phase 1 catalogue-first / photos-last sequencing. Mirrors the
 *    publish-gate in `scripts/editorial-pilot/src/global-sources/
 *    publish-eligible-drafts.ts` so any row that passes publish ALSO
 *    passes indexability.
 *
 * Once the photo orchestrator hydrates a row, the photo-rich path
 * supersedes the editorial path automatically (no DB change needed).
 *
 * Skill: seo-technical, geo-llm-optimization.
 */

export interface IndexabilityRow {
  readonly hero_image?: unknown;
  readonly gallery_images?: unknown;
  readonly long_description_sections?: unknown;
  readonly description_fr?: unknown;
  readonly factual_summary_fr?: unknown;
  readonly concierge_advice?: unknown;
  readonly faq_content?: unknown;
}

/** CDC §2.4 — minimum description length on a published hotel page. */
const DESCRIPTION_MIN_CHARS = 600;
/** CDC §2.3 — minimum factual summary length (production envelope is 110-165). */
const FACTUAL_SUMMARY_MIN_CHARS = 100;
/** CDC §2.11 — minimum FAQ count (10 canonical questions). */
const FAQ_MIN_ITEMS = 10;
/** Hero + N gallery photos = a credible mini-fiche even without a long body. */
const PHOTO_RICH_GALLERY_THRESHOLD = 5;

/**
 * D3 — crawl-focus threshold (PO decision 2026-07-02, "coupe complète").
 *
 * A `/destination/<city>` hub is only worth a crawl slot when it groups
 * at least this many published hotels. Google was spending crawl budget
 * on 1-hotel long-tail destinations (Dommeldange, Belgrade, Clervaux…)
 * while head pages (Venise, Paris) stayed "Discovered, not indexed".
 * Below the threshold the page STILL renders (honest thin/empty state,
 * already in place) but emits `noindex, follow` and is dropped from
 * `hubs.xml`.
 *
 * Single source of truth — consumed by:
 *   - `apps/web/src/app/sitemaps/hubs.xml/route.ts`  (sitemap inclusion:
 *     destination hubs + annuaire country/city directories)
 *   - `apps/web/src/app/sitemaps/guides.xml/route.ts` (city-guide inclusion)
 *   - `apps/web/src/app/[locale]/destination/[citySlug]/page.tsx`
 *                                                    (`generateMetadata` robots)
 *   - `apps/web/src/app/[locale]/hotels/[pays]/page.tsx` +
 *     `apps/web/src/app/[locale]/hotels/[pays]/[ville]/page.tsx`
 *     (annuaire — D3 extended per PO decision 2026-07-03: 40/128 countries
 *     and the long-tail city directories group < 3 published hotels)
 *
 * Reversible: change the constant, redeploy — the sitemap and the meta
 * robots follow automatically. Raise it to prune harder, drop it to 1 to
 * revert to the pre-D3 "index every destination" behaviour. Re-introduce
 * the pruned destinations wholesale by setting this to `1`.
 *
 * Skill: seo-technical §Indexability.
 */
export const DESTINATION_MIN_PUBLISHED_HOTELS = 3;

/**
 * True when a destination hub has enough published hotels to earn an
 * index slot (and a sitemap entry). Mirror of the `>= threshold` rule so
 * the sitemap and the page's `noindex` flag can never diverge — they both
 * import this predicate.
 */
export function isDestinationIndexable(publishedHotelCount: number): boolean {
  return publishedHotelCount >= DESTINATION_MIN_PUBLISHED_HOTELS;
}

export function isHotelIndexable(row: IndexabilityRow): boolean {
  const hasHero = typeof row.hero_image === 'string' && row.hero_image.length > 0;
  const sections = Array.isArray(row.long_description_sections)
    ? row.long_description_sections
    : [];
  const galleryCount = Array.isArray(row.gallery_images) ? row.gallery_images.length : 0;

  if (hasHero && (galleryCount >= PHOTO_RICH_GALLERY_THRESHOLD || sections.length > 0)) {
    return true;
  }

  if (sections.length > 0) return true;

  const descLen = typeof row.description_fr === 'string' ? row.description_fr.length : 0;
  const factualLen = typeof row.factual_summary_fr === 'string' ? row.factual_summary_fr.length : 0;
  const hasConcierge = row.concierge_advice !== null && typeof row.concierge_advice === 'object';
  const faqCount = Array.isArray(row.faq_content) ? row.faq_content.length : 0;

  return (
    descLen >= DESCRIPTION_MIN_CHARS &&
    factualLen >= FACTUAL_SUMMARY_MIN_CHARS &&
    hasConcierge &&
    faqCount >= FAQ_MIN_ITEMS
  );
}
