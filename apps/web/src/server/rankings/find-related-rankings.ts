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
 * Resolves the rankings to cross-link from a destination (city) page.
 * Matches by `axes.lieu.slug = citySlug`. Returns at most `limit`
 * results, never throws.
 *
 * Examples (2026-05-26 catalogue):
 *   - `paris` → 15 rankings
 *   - `cote-d-azur` → 13 rankings
 *   - `bordeaux` → 0 rankings (returns empty, the page should hide
 *     the block in that case)
 */
export async function findRankingsForCity(args: {
  readonly citySlug: string;
  readonly limit?: number;
}): Promise<readonly RankingLookup[]> {
  const limit = args.limit ?? 4;
  const cached = unstable_cache(
    () => queryRankingsByLieuSlug(args.citySlug, limit, null),
    [`city-related-rankings-${args.citySlug}-${limit}`],
    { revalidate: 3600, tags: [`related-rankings:${args.citySlug}`] },
  );
  return cached();
}

/**
 * Resolves the sibling rankings to cross-link from a ranking detail
 * page. Excludes the current ranking from the result.
 *
 * Used by `/classement/[slug]` to point at sibling rankings on the
 * same `lieu` (best PageRank distribution along the editorial mesh).
 */
export async function findSiblingRankings(args: {
  readonly currentSlug: string;
  readonly lieuSlug: string | null;
  readonly limit?: number;
}): Promise<readonly RankingLookup[]> {
  if (args.lieuSlug === null) return [];
  const limit = args.limit ?? 3;
  const lieuSlug = args.lieuSlug;
  const currentSlug = args.currentSlug;
  const cached = unstable_cache(
    () => queryRankingsByLieuSlug(lieuSlug, limit, currentSlug),
    [`sibling-rankings-${lieuSlug}-${currentSlug}-${limit}`],
    { revalidate: 3600, tags: [`related-rankings:${lieuSlug}`] },
  );
  return cached();
}
