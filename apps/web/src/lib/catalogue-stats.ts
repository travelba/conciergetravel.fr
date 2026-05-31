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
 */
export const CATALOGUE_PUBLISHED = 2219;
export const CATALOGUE_COUNTRIES = 127;
export const CATALOGUE_RELAIS_CHATEAUX = 435;
export const CATALOGUE_SMALL_LUXURY = 197;
export const CATALOGUE_WORLD_50_BEST = 127;
export const CATALOGUE_LAST_UPDATED = '2026-05-31';
