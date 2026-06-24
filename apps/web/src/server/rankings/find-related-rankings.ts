import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { RankingLookup } from '@/server/itineraries/get-related-data';

/**
 * Editorial cross-linking helpers — find published rankings by
 * geographic / thematic context (lieu, city, itinerary).
 *
 * Internal-linking audit 2026-05-26 (P2C) — these helpers complement
 * the explicit `related_ranking_ids[]` column on itineraries
 * (currently `null` for 20/20 published rows) by deriving a sensible
 * set of cross-links at runtime. They are also called from the
 * destination + classement pages which never carried explicit
 * cross-link references.
 *
 * Rule: `seo-geo.mdc` §Maillage. Skill:
 * `.cursor/skills/seo-technical/SKILL.md` §Internal linking density.
 *
 * Design choices:
 *   - **No DB column changes** — the heuristic mappings live in TS so
 *     editors can ship a new ranking and immediately see it appear in
 *     the cross-link blocks without a migration.
 *   - **Conservative international policy** — itineraries whose
 *     `country_code !== 'FR'` do not receive France-focused ranking
 *     cross-links. PageRank dilution > marginal CTR gain.
 *   - **Stable cache key per query** — wrapped in `unstable_cache`
 *     with a 1 h TTL, tagged so a Payload publish hook can
 *     `revalidateTag` precisely (`related-rankings:<context>`).
 */

const RankingRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
});

/**
 * Maps an itinerary's `destination_city` (or part thereof) to the
 * `axes.lieu.slug` used by the rankings catalogue. The keys are
 * lower-cased substring tests; the first hit wins.
 *
 * The table is intentionally small — it covers only the cities that
 * (a) are referenced by a published itinerary AND (b) have ≥ 1
 * published ranking targeting them. Adding a new entry costs a row
 * here, not a DB migration.
 */
const ITINERARY_CITY_TO_LIEU_SLUG: ReadonlyArray<readonly [RegExp, string]> = [
  [/saint-tropez|st-tropez/u, 'saint-tropez'],
  [/courchevel/u, 'courchevel'],
  [/megève|megeve|val\s+d['']isère|val\s+d['']isere|chamonix|val\s+thorens|tignes/u, 'alpes'],
  [/cannes|nice|antibes|cap-ferrat|cap\s+ferrat|èze|eze|monaco|monte-carlo/u, 'cote-d-azur'],
  [/paris/u, 'paris'],
  [/ajaccio|porto-vecchio|porto\s+vecchio|bonifacio|calvi/u, 'corse'],
];

/**
 * Subset of FR-region slugs we'll surface when a more granular lieu
 * isn't reachable. The keys are normalised forms of the itinerary's
 * `destination_region` column.
 */
const ITINERARY_REGION_TO_LIEU_SLUG: ReadonlyArray<readonly [RegExp, string]> = [
  [/provence|côte d'azur|cote d'azur|alpes-maritimes/u, 'cote-d-azur'],
  [/auvergne-rhône-alpes|auvergne-rhone-alpes|savoie|haute-savoie/u, 'alpes'],
  [/bretagne/u, 'bretagne'],
  [/corse/u, 'corse'],
  [/loire|centre-val\s+de\s+loire/u, 'loire'],
  [/bourgogne|bourgogne-franche-comté|bourgogne-franche-comte/u, 'bourgogne'],
  [/alsace|grand\s+est/u, 'alsace'],
];

function deriveLieuSlugForItinerary(args: {
  readonly destinationCity: string | null;
  readonly destinationRegion: string | null;
  readonly countryCode: string;
}): string | null {
  // International — refuse to link to France-only rankings.
  if (args.countryCode !== 'FR') return null;
  const city = (args.destinationCity ?? '').toLowerCase();
  const region = (args.destinationRegion ?? '').toLowerCase();
  for (const [re, lieu] of ITINERARY_CITY_TO_LIEU_SLUG) {
    if (re.test(city)) return lieu;
  }
  for (const [re, lieu] of ITINERARY_REGION_TO_LIEU_SLUG) {
    if (re.test(region) || re.test(city)) return lieu;
  }
  // Last resort: every FR itinerary gets a couple of "Best of France"
  // links (`lieu='france'`) as a soft fallback. Better than dead-end.
  return 'france';
}

async function queryRankingsByLieuSlug(
  lieuSlug: string,
  limit: number,
  excludeRankingSlug: string | null,
): Promise<readonly RankingLookup[]> {
  try {
    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from('editorial_rankings')
      .select('id, slug, title_fr, title_en, factual_summary_fr, factual_summary_en, axes')
      .eq('is_published', true)
      // PostgREST JSON filter — uses `->'lieu'->>'slug'`.
      // The arrow operators are quoted as a single path string.
      .filter('axes->lieu->>slug', 'eq', lieuSlug)
      .limit(Math.max(1, Math.min(20, limit * 2))); // overscan for the exclude filter

    if (excludeRankingSlug !== null) {
      q = q.neq('slug', excludeRankingSlug);
    }
    const { data, error } = await q;
    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[find-related-rankings] supabase error', {
          message: error.message,
          code: error.code,
          lieuSlug,
        });
      }
      return [];
    }
    const out: RankingLookup[] = [];
    for (const raw of data) {
      const parsed = RankingRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        id: parsed.data.id,
        slug: parsed.data.slug,
        titleFr: parsed.data.title_fr,
        titleEn: parsed.data.title_en,
        factualSummaryFr: parsed.data.factual_summary_fr,
        factualSummaryEn: parsed.data.factual_summary_en,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.error(
      '[find-related-rankings] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Resolves a list of rankings to cross-link from an itinerary detail
 * page. The contract is "best effort": call this when the explicit
 * `related_ranking_ids[]` column on `itineraries` is empty (which is
 * the case for 100 % of the 2026-05-26 catalogue), and the helper
 * derives a sensible set from the itinerary's lieu.
 *
 * Returns at most `limit` rankings; never throws.
 */
export async function findRankingsForItinerary(args: {
  readonly destinationCity: string | null;
  readonly destinationRegion: string | null;
  readonly countryCode: string;
  readonly limit?: number;
}): Promise<readonly RankingLookup[]> {
  const limit = args.limit ?? 4;
  const lieuSlug = deriveLieuSlugForItinerary(args);
  if (lieuSlug === null) return [];
  const cached = unstable_cache(
    () => queryRankingsByLieuSlug(lieuSlug, limit, null),
    [`itinerary-related-rankings-${lieuSlug}-${limit}`],
    { revalidate: 3600, tags: [`related-rankings:${lieuSlug}`] },
  );
  return cached();
}

/**
 * Maps an FR city slug to its broader lieu ancestors (region / cluster)
 * so a destination hub can also surface the cluster + national rankings
 * that cover it (B2). `france` is appended automatically for every city.
 * The fallback is applied by `findRankingsForCity` only when the
 * destination's `countryCode === 'FR'`, so the national `france` ancestor
 * never leaks onto an international hub.
 *
 * Keys are the `citySlug(city)` outputs; values are ranking `axes.lieu.
 * slug` values (HERO-region slugs). Unknown FR cities still get the
 * `france` fallback via `fallbackLieusForCity`.
 */
const CITY_LIEU_ANCESTORS: Readonly<Record<string, readonly string[]>> = {
  paris: ['ile-de-france'],
  versailles: ['ile-de-france'],
  cannes: ['cote-d-azur'],
  nice: ['cote-d-azur'],
  antibes: ['cote-d-azur'],
  'saint-jean-cap-ferrat': ['cote-d-azur'],
  menton: ['cote-d-azur'],
  monaco: ['cote-d-azur'],
  'saint-tropez': ['cote-d-azur', 'provence'],
  ramatuelle: ['cote-d-azur', 'provence'],
  'aix-en-provence': ['provence'],
  avignon: ['provence'],
  gordes: ['provence'],
  'les-baux-de-provence': ['provence'],
  arles: ['provence'],
  courchevel: ['alpes'],
  megeve: ['alpes'],
  'val-d-isere': ['alpes'],
  chamonix: ['alpes'],
  tignes: ['alpes'],
  'saint-emilion': ['bordeaux'],
  reims: ['champagne'],
  epernay: ['champagne'],
  biarritz: ['pays-basque'],
  'saint-jean-de-luz': ['pays-basque'],
  bidart: ['pays-basque'],
  'porto-vecchio': ['corse'],
  ajaccio: ['corse'],
  bonifacio: ['corse'],
  calvi: ['corse'],
  'cote-d-azur': ['provence'],
};

function fallbackLieusForCity(citySlug: string): readonly string[] {
  const explicit = CITY_LIEU_ANCESTORS[citySlug] ?? [];
  return explicit.includes('france') ? explicit : [...explicit, 'france'];
}

/**
 * Resolves the rankings to cross-link from a destination (city) page.
 * Primary match is `axes.lieu.slug = citySlug`; B2 adds a region/country
 * fallback so a city with few (or zero) dedicated rankings still surfaces
 * its cluster + national classements (e.g. `reims` → champagne → france,
 * `paris` → france). Primary matches always rank ahead of fallbacks.
 *
 * **Conservative international policy** (mirrors `findRankingsForItinerary`):
 * the region/country fallback fires ONLY for FR destinations. An
 * international hub (`countryCode !== 'FR'`) keeps the legacy strict
 * `lieu.slug = citySlug` behaviour so a Tokyo / Dubai page never pulls in
 * France-focused rankings via the `france` ancestor. When `countryCode` is
 * omitted the fallback is skipped too (safe default).
 *
 * Returns at most `limit` results, never throws.
 */
export async function findRankingsForCity(args: {
  readonly citySlug: string;
  readonly countryCode?: string;
  readonly limit?: number;
}): Promise<readonly RankingLookup[]> {
  const limit = Math.max(1, args.limit ?? 4);
  try {
    const index = await loadRankingScoreIndex();
    if (index.length === 0) return [];
    const citySlug = args.citySlug;
    const byTitle = (a: RankingIndexEntry, b: RankingIndexEntry): number =>
      a.titleFr.localeCompare(b.titleFr);
    const primary = index.filter((e) => e.lieuSlug === citySlug).sort(byTitle);
    const seen = new Set(primary.map((e) => e.slug));
    const secondary: RankingIndexEntry[] = [];
    if (args.countryCode === 'FR') {
      for (const fallback of fallbackLieusForCity(citySlug)) {
        const matches = index
          .filter((e) => e.lieuSlug === fallback && !seen.has(e.slug))
          .sort(byTitle);
        for (const m of matches) {
          seen.add(m.slug);
          secondary.push(m);
        }
      }
    }
    return [...primary, ...secondary].slice(0, limit).map(toLookup);
  } catch (e) {
    console.error(
      '[findRankingsForCity] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

// ─── In-memory scoring index (B1 — cross-link by theme/type/chain) ─────────
//
// The lieu-only sibling helper (`queryRankingsByLieuSlug`) returns `[]`
// for the 102 published rankings that carry no `axes.lieu` (chains
// `top-<brand>-…-monde`, curated awards `classement-worlds-50-best-*`,
// and a handful of lieu-less geographic rankings). Those pages had NO
// "related rankings" block at all. Worse, the lieu-less rows also ship
// `axes: {}` — themes/types are empty in the DB today — so a pure
// axes-theme/type heuristic can't rescue them either.
//
// The fix scores every published ranking against the current one along
// three signals: shared lieu (kept identical to the legacy behaviour),
// shared themes/types (future-proof — fires the day the pipeline starts
// populating them), and a **slug family** derived purely from the slug
// shape (chain collection / curated award / "best-of place"). The family
// signal only contributes when the current ranking has no lieu, so city
// rankings stay lieu-homogeneous and the "Autres classements {ville}"
// heading remains accurate.

type RankingFamily = 'chain-collection' | 'curated-award' | 'geo-best';

/**
 * Derives a cross-link family from the slug alone — the only reliable
 * signal on the lieu-less cohort (their `axes` is `{}`). Returns `null`
 * for slugs that don't belong to a recognised family (those keep the
 * lieu/theme/type signals only).
 */
function familyForSlug(slug: string): RankingFamily | null {
  if (/^top-[a-z0-9-]+-(?:hotels|palaces|resorts)-monde$/u.test(slug)) return 'chain-collection';
  if (/-toutes-les-maisons$/u.test(slug)) return 'chain-collection';
  if (
    /^classement-(?:ritz-carlton-reserve|leading-hotels-of-the-world|small-luxury-hotels)/u.test(
      slug,
    )
  ) {
    return 'chain-collection';
  }
  if (/^classement-(?:worlds-50-best|travel-leisure|conde-nast)/u.test(slug))
    return 'curated-award';
  if (/^palaces-(?:de-france|gastronomie|romantiques|spa-detente)/u.test(slug)) {
    return 'curated-award';
  }
  if (/^meilleurs-(?:hotels|palaces)-/u.test(slug)) return 'geo-best';
  return null;
}

interface RankingIndexEntry {
  readonly id: string;
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly kind: string;
  readonly lieuSlug: string | null;
  readonly themes: readonly string[];
  readonly types: readonly string[];
  readonly family: RankingFamily | null;
}

const IndexRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  kind: z.string(),
  axes: z
    .object({
      lieu: z.object({ slug: z.string() }).optional(),
      themes: z.array(z.string()).default([]),
      types: z.array(z.string()).default([]),
    })
    .default({ themes: [], types: [] }),
});

async function _loadRankingScoreIndex(): Promise<readonly RankingIndexEntry[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('editorial_rankings')
      .select('id, slug, title_fr, title_en, factual_summary_fr, factual_summary_en, kind, axes')
      .eq('is_published', true);
    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[find-related-rankings] index query failed:', error.message);
      }
      return [];
    }
    const out: RankingIndexEntry[] = [];
    for (const raw of data) {
      const parsed = IndexRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const { axes } = parsed.data;
      out.push({
        id: parsed.data.id,
        slug: parsed.data.slug,
        titleFr: parsed.data.title_fr,
        titleEn: parsed.data.title_en,
        factualSummaryFr: parsed.data.factual_summary_fr,
        factualSummaryEn: parsed.data.factual_summary_en,
        kind: parsed.data.kind,
        lieuSlug: axes.lieu?.slug ?? null,
        themes: axes.themes,
        types: axes.types,
        family: familyForSlug(parsed.data.slug),
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[find-related-rankings] index threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Request-deduped + 1 h ISR-cached snapshot of the published-ranking
 * scoring index (~560 rows, no entry-count scan → cheap). Tagged
 * `related-rankings:index` so a Payload publish hook can invalidate it.
 */
const loadRankingScoreIndex = (): Promise<readonly RankingIndexEntry[]> =>
  unstable_cache(_loadRankingScoreIndex, ['ranking-score-index'], {
    revalidate: 3600,
    tags: ['related-rankings:index'],
  })();

interface CurrentRankingSignals {
  readonly lieuSlug: string | null;
  readonly themes: readonly string[];
  readonly types: readonly string[];
  readonly family: RankingFamily | null;
  readonly kind: string;
}

function scoreCandidate(current: CurrentRankingSignals, cand: RankingIndexEntry): number {
  let score = 0;
  if (current.lieuSlug !== null && cand.lieuSlug === current.lieuSlug) score += 4;
  for (const th of current.themes) if (cand.themes.includes(th)) score += 2;
  for (const ty of current.types) if (cand.types.includes(ty)) score += 1;
  // Family / kind cross-links contribute ONLY when the current ranking
  // has no lieu (chain / curated / global). This keeps city rankings
  // lieu-homogeneous so the "Autres classements {ville}" heading on the
  // detail page never lists an off-lieu ranking.
  if (current.lieuSlug === null) {
    if (current.family !== null && cand.family === current.family) score += 2;
    if (current.kind === cand.kind) score += 0.5;
  }
  return score;
}

function toLookup(e: RankingIndexEntry): RankingLookup {
  return {
    id: e.id,
    slug: e.slug,
    titleFr: e.titleFr,
    titleEn: e.titleEn,
    factualSummaryFr: e.factualSummaryFr,
    factualSummaryEn: e.factualSummaryEn,
  };
}

/**
 * Resolves the sibling rankings to cross-link from a ranking detail
 * page. Excludes the current ranking from the result.
 *
 * Used by `/classement/[slug]`. Unlike the legacy lieu-only behaviour,
 * this now scores by lieu **and** theme/type/chain family, so the 102
 * lieu-less rankings (chains, curated awards, lieu-less geographic) get
 * a populated "related rankings" block for the first time (B1).
 */
export async function findSiblingRankings(args: {
  readonly currentSlug: string;
  readonly lieuSlug: string | null;
  readonly themes?: readonly string[];
  readonly types?: readonly string[];
  readonly limit?: number;
}): Promise<readonly RankingLookup[]> {
  const limit = args.limit ?? 3;
  try {
    const index = await loadRankingScoreIndex();
    if (index.length === 0) return [];
    const current: CurrentRankingSignals = {
      lieuSlug: args.lieuSlug,
      themes: args.themes ?? [],
      types: args.types ?? [],
      family: familyForSlug(args.currentSlug),
      kind: index.find((e) => e.slug === args.currentSlug)?.kind ?? '',
    };
    return index
      .filter((e) => e.slug !== args.currentSlug)
      .map((e) => ({ e, score: scoreCandidate(current, e) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.e.titleFr.localeCompare(b.e.titleFr))
      .slice(0, Math.max(1, limit))
      .map((x) => toLookup(x.e));
  } catch (e) {
    console.error(
      '[findSiblingRankings] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}
