/**
 * Ranking meta-description resolution (SEO P1-5).
 *
 * The classement page previously resolved the meta description as
 * `meta_desc_<locale> ?? intro_<locale>.slice(0, 160) ?? intro_fr.slice(0, 160)`.
 * Two problems surfaced in the 2026-06-24 audit:
 *   1. A short DB `meta_desc_en` (e.g. 69 chars on `palaces-de-france-2026`)
 *      was used verbatim, far below the 140-170 SERP sweet spot, while a
 *      richer same-locale source (the AEO `factual_summary_en`, tuned to
 *      130-150 chars) sat unused.
 *   2. `.slice(0, 160)` cut mid-word and could spill a FR intro onto an EN
 *      page.
 *
 * This helper picks the first same-locale candidate that clears an SEO
 * floor, preferring an explicit meta description, then the AEO factual
 * summary, then the intro; it only falls back to the FR sources when no
 * English source is usable. The chosen text is normalised and truncated at
 * a word boundary to the SERP ceiling. It never writes the DB — it just
 * stops surfacing an under-sized description when a better one already
 * exists in the row.
 */

export const RANKING_META_DESC_FLOOR = 120;
export const RANKING_META_DESC_CEILING = 170;

export function truncateAtWordBoundary(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/gu, ' ');
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:–—-]+$/u, '')}…`;
}

export interface RankingMetaDescriptionInput {
  readonly locale: 'fr' | 'en';
  readonly metaDescFr: string | null;
  readonly metaDescEn: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly introFr: string;
  readonly introEn: string | null;
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim().replace(/\s+/gu, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRankingMetaDescription(input: RankingMetaDescriptionInput): string {
  // Same-locale candidates first (preferred), then FR fallbacks. Order
  // within a locale: explicit meta description → AEO factual summary → intro.
  const localized =
    input.locale === 'en'
      ? [input.metaDescEn, input.factualSummaryEn, input.introEn]
      : [input.metaDescFr, input.factualSummaryFr, input.introFr];
  const fallback = [input.metaDescFr, input.factualSummaryFr, input.introFr];

  const candidates = [...localized, ...fallback].map(clean).filter((c): c is string => c !== null);

  // Prefer the first candidate that clears the SEO floor; otherwise keep the
  // longest available text so we never regress to an empty description.
  const aboveFloor = candidates.find((c) => c.length >= RANKING_META_DESC_FLOOR);
  const chosen =
    aboveFloor ?? candidates.reduce<string>((best, c) => (c.length > best.length ? c : best), '');

  return truncateAtWordBoundary(chosen, RANKING_META_DESC_CEILING);
}
