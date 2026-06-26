/**
 * Catalogue statistics — single source of truth for the public-facing
 * "X hotels in Y countries" copy. Updated manually after each material
 * publish wave; the values must reflect what `is_published = true` looks
 * like in production at the time of update.
 *
 * Used by:
 *   - `apps/web/src/app/layout.tsx`              (root metaDesc)
 *   - `apps/web/src/app/[locale]/page.tsx`       (locale fallback meta)
 *   - `apps/web/src/app/llms.txt/route.ts`       (LLM-friendly preamble)
 *   - `apps/web/src/app/llms-full.txt/route.ts`  (LLM corpus header)
 *   - `apps/web/src/i18n/messages/{fr,en}.json`  (visible homepage badges)
 *
 * The `lastUpdated` field gates a unit test that warns if the constants
 * have drifted more than 90 days behind today — a soft reminder to
 * refresh the snapshot whenever the catalogue ships a major batch.
 *
 * History:
 *   2026-05-27 — 615 / 91 / 435 (post Relais & Châteaux scaffold).
 *   2026-05-28 — 2134 / 127 / 434 (post Phase 1 publish flip — 1519 new
 *                published hotels via `publish-eligible-drafts.ts`).
 *   2026-05-31 — 2219 / 127 / 435 (post Akelarre flip + draft cleanup —
 *                hotel catalogue now at zero drafts; affiliations refactor
 *                has not yet been backfilled with SLH / W50B awards, so
 *                CATALOGUE_SMALL_LUXURY and CATALOGUE_WORLD_50_BEST stay
 *                pinned to their historical values pending a re-ingestion
 *                pass — see `scripts/editorial-pilot/src/global-sources/`).
 *   2026-06-17 — 2221 / 127 / 479 (live DB re-count via Supabase MCP).
 *                Affiliations are now backfilled: Relais & Châteaux 479,
 *                Small Luxury 224, World's 50 Best 127, Atout France
 *                Palaces 39. Counts derived from `affiliations[].facet_slug`
 *                on `is_published = true` rows.
 *   2026-06-24 — 2219 / 127 / 479 (health audit reconciliation). The raw
 *                `is_published = true` count is 2221, but the public surface
 *                (sitemap `/sitemaps/hotels.xml`) and what Google indexes is
 *                2219 — 2 published rows are non-indexable (indexability
 *                gate). We pin the public-facing copy + llms.txt to the
 *                indexable count so the advertised number matches the
 *                crawlable catalogue. See docs/audits/health-2026-06-24-*.md.
 *   2026-06-26 — 2984 / 128 / 479 (live DB re-count via Supabase MCP — the
 *                snapshot had drifted ~765 hotels behind after a fresh publish
 *                wave). Affiliations unchanged on published rows: Relais &
 *                Châteaux 479, Small Luxury 224, World's 50 Best 127. Sibling
 *                editorial surfaces verified the same day (consumed dynamically,
 *                not pinned here): rankings 816, guides 82, places/POI 1147,
 *                itineraries 23 published. Counts are the raw `is_published`
 *                figures (the 2026-06-24 indexable-pinning convention is
 *                superseded by the explicit PO re-count).
 */
export const CATALOGUE_PUBLISHED = 2984;
export const CATALOGUE_COUNTRIES = 128;
export const CATALOGUE_RELAIS_CHATEAUX = 479;
export const CATALOGUE_SMALL_LUXURY = 224;
export const CATALOGUE_WORLD_50_BEST = 127;
export const CATALOGUE_LAST_UPDATED = '2026-06-26';
