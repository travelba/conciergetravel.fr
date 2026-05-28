import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ItineraryMiniCard } from '@/server/itineraries/get-related-data';

/**
 * Editorial cross-linking helper — find published itineraries by
 * geographic context (city, region, lieu slug).
 *
 * Internal-linking audit 2026-05-26 (P2C) — destination and ranking
 * pages never carried `<RelatedItineraries>` cross-link blocks even
 * though every published itinerary advertises its
 * `destination_city`. This helper closes the loop without forcing
 * the editor to maintain a redundant `related_itinerary_ids[]`
 * column on each destination / ranking row.
 *
 * The query uses a case-insensitive `ilike` over `destination_city`
 * because itineraries store free-text "Cannes, Antibes, Cap Ferrat,
 * Èze, Monaco" rather than a normalised slug. Pair with the
 * geographic mapping tables in
 * `apps/web/src/server/rankings/find-related-rankings.ts` for
 * consistency.
 */

const RowSchema = z.object({
  slug_fr: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  destination_city: z.string().nullable(),
  destination_region: z.string().nullable(),
  country_code: z.string(),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  hero_cloudinary_id: z.string().nullable(),
});

async function queryItineraries(args: {
  readonly cityNeedles: readonly string[];
  readonly regionNeedles: readonly string[];
  readonly excludeSlug: string | null;
  readonly limit: number;
}): Promise<readonly ItineraryMiniCard[]> {
  if (args.cityNeedles.length === 0 && args.regionNeedles.length === 0) {
    return [];
  }
  try {
    const supabase = getSupabaseAdminClient();
    // PostgREST `.or()` accepts a comma-separated string of column
    // conditions. We OR multiple ilike patterns over destination_city
    // + destination_region. ilike is unanchored so `%biarritz%` will
    // match "Biarritz, Saint-Jean-de-Luz, San Sebastian".
    const orParts: string[] = [];
    for (const c of args.cityNeedles) {
      orParts.push(`destination_city.ilike.%${c}%`);
    }
    for (const r of args.regionNeedles) {
      orParts.push(`destination_region.ilike.%${r}%`);
    }
    let q = supabase
      .from('itineraries')
      .select(
        'slug_fr, title_fr, title_en, destination_city, destination_region, country_code, duration_min_days, duration_max_days, hero_cloudinary_id',
      )
      .eq('status', 'published')
      .or(orParts.join(','))
      .limit(Math.max(1, Math.min(20, args.limit * 2)));

    if (args.excludeSlug !== null) {
      q = q.neq('slug_fr', args.excludeSlug);
    }
    const { data, error } = await q;
    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[find-itineraries-for-context] supabase error', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }
    const out: ItineraryMiniCard[] = [];
    for (const raw of data) {
      const parsed = RowSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        slugFr: parsed.data.slug_fr,
        titleFr: parsed.data.title_fr,
        titleEn: parsed.data.title_en,
        destinationCity: parsed.data.destination_city,
        destinationRegion: parsed.data.destination_region,
        countryCode: parsed.data.country_code,
        durationMinDays: parsed.data.duration_min_days,
        durationMaxDays: parsed.data.duration_max_days,
        heroCloudinaryId: parsed.data.hero_cloudinary_id,
      });
      if (out.length >= args.limit) break;
    }
    return out;
  } catch (e) {
    console.error(
      '[find-itineraries-for-context] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Maps each city slug surfaced by the menu to the substrings the
 * itinerary `destination_city` column is expected to contain. Multiple
 * synonyms per slug increase recall (e.g. `cannes` → matches itineraries
 * that mention "Cannes" anywhere in the comma-separated list).
 */
const CITY_SLUG_TO_NEEDLES: Readonly<Record<string, readonly string[]>> = {
  paris: ['paris'],
  cannes: ['cannes', 'antibes', 'côte d', 'cote d'],
  courchevel: ['courchevel'],
  'aix-en-provence': ['aix-en-provence', 'aix', 'provence'],
  bordeaux: ['bordeaux'],
  reims: ['reims'],
  biarritz: ['biarritz'],
  'porto-vecchio': ['porto-vecchio', 'porto vecchio', 'corse'],
  // Hero regions
  'cote-d-azur': ['côte d', 'cote d', 'cannes', 'nice', 'monaco'],
  provence: ['provence', 'aix', 'luberon'],
  alpes: ['alpes', 'megève', 'megeve', 'courchevel', 'val d'],
  champagne: ['reims', 'épernay', 'epernay', 'champagne'],
  corse: ['corse', 'ajaccio', 'porto-vecchio', 'porto vecchio'],
  'pays-basque': ['biarritz', 'pays basque', 'saint-jean-de-luz'],
  loire: ['loire'],
  // International cities — Phase 4.A unblock (ADR-0016, 2026-05-28).
  // Needles match `destination_city` / `destination_region` columns of
  // published itineraries. Add a row here when a new itinerary covers
  // a new locale; no migration needed.
  'new-york': ['new york', 'new-york', 'manhattan', 'brooklyn'],
  dubai: ['dubai', 'dubaï', 'dubaï', 'émirats', 'emirats'],
  tokyo: ['tokyo', 'japon', 'japan'],
  marrakech: ['marrakech', 'maroc', 'morocco'],
  mykonos: ['mykonos', 'cyclades', 'grèce', 'greece'],
  santorin: ['santorin', 'santorini', 'cyclades', 'grèce', 'greece'],
  bali: ['bali', 'ubud', 'seminyak', 'indonésie', 'indonesia'],
  phuket: ['phuket', 'thaïlande', 'thailande', 'thailand'],
  'st-moritz': ['st-moritz', 'st moritz', 'saint-moritz', 'saint moritz', 'engadine', 'suisse'],
  'lake-como': ['lake como', 'lac de come', 'lac de côme', 'como', 'lombardie'],
  madeira: ['madeira', 'madère', 'funchal', 'portugal'],
  'riviera-maya': [
    'riviera maya',
    'tulum',
    'playa del carmen',
    'cancun',
    'cancún',
    'mexique',
    'mexico',
  ],
  algarve: ['algarve', 'lagos', 'faro', 'portimão', 'portimao', 'portugal'],
  'amalfi-coast': [
    'amalfi',
    'positano',
    'ravello',
    'côte amalfitaine',
    'cote amalfitaine',
    'campanie',
    'italie',
    'italy',
  ],
};

/**
 * Resolves up to `limit` published itineraries that match the given
 * city slug. Returns `[]` when the slug is unknown or no itinerary
 * matches — the caller is expected to hide the cross-link section in
 * that case (avoids "Related — (empty)" UX dead-ends).
 */
export async function findItinerariesForCity(args: {
  readonly citySlug: string;
  readonly limit?: number;
  readonly excludeSlug?: string | null;
}): Promise<readonly ItineraryMiniCard[]> {
  const needles = CITY_SLUG_TO_NEEDLES[args.citySlug] ?? [];
  if (needles.length === 0) return [];
  const limit = args.limit ?? 3;
  const excludeSlug = args.excludeSlug ?? null;
  const cached = unstable_cache(
    () =>
      queryItineraries({
        cityNeedles: needles,
        regionNeedles: [],
        excludeSlug,
        limit,
      }),
    [`city-related-itineraries-${args.citySlug}-${limit}-${excludeSlug ?? 'none'}`],
    { revalidate: 3600, tags: [`related-itineraries:${args.citySlug}`] },
  );
  return cached();
}
