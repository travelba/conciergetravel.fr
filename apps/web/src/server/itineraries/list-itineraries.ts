import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Itinerary listing reader for `/itineraires` (hub) and the
 * `list-itineraries` agent skill (CDC §6.1).
 *
 * Returns a compact card shape — never the full row — so the hub can
 * paginate efficiently. The detail page calls `getItineraryBySlug`
 * separately when the user clicks a card.
 *
 * Cached via `unstable_cache` returning a **plain array of POJOs**
 * (rule itinerary-page.mdc §6 — never `Map` / `Set`, the JSON round-
 * trip would crash every cache hit after the first; cf. hotfix
 * 4d02187 that this very project paid for once already).
 *
 * Skill: itinerary-editorial-pipeline.
 */

// ============================================================================
// Filter schema — narrow the agent input before it reaches Supabase.
// ============================================================================

export const ListItinerariesFiltersSchema = z.object({
  /** ISO 3166-1 alpha-2 (`'FR'`, `'JP'`). */
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/u)
    .optional(),
  /** Free-form region/cluster ("Toscane", "Côte d'Azur"). */
  destination_region: z.string().min(1).optional(),
  /** Free-form city ("Paris", "Kyoto"). */
  destination_city: z.string().min(1).optional(),
  /** Theme tags — `themes && themes_filter` overlap. */
  themes: z.array(z.string().min(1)).optional(),
  travel_style: z
    .enum([
      'luxe',
      'famille',
      'couple',
      'solo',
      'aventure',
      'bien-etre',
      'gastronomie',
      'culture',
      'affaires',
    ])
    .optional(),
  duration_min_days: z.number().int().min(1).max(60).optional(),
  duration_max_days: z.number().int().min(1).max(60).optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  /** Hard cap to keep the hub response small. Default 60. */
  limit: z.number().int().min(1).max(100).default(60),
});
export type ListItinerariesFilters = z.infer<typeof ListItinerariesFiltersSchema>;

// ============================================================================
// Card shape — what the hub renders.
// ============================================================================

export interface ItineraryCard {
  readonly id: string;
  readonly slugFr: string;
  readonly slugEn: string | null;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly metaDescFr: string | null;
  readonly metaDescEn: string | null;
  readonly countryCode: string;
  readonly destinationRegion: string | null;
  readonly destinationCity: string | null;
  readonly themes: readonly string[];
  readonly durationMinDays: number;
  readonly durationMaxDays: number | null;
  readonly travelStyle: string;
  readonly season: string | null;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
  readonly heroCloudinaryId: string | null;
  readonly heroAltFr: string | null;
  readonly heroAltEn: string | null;
  readonly hotelCount: number;
  readonly lastUpdated: string;
}

const CardRowSchema = z.object({
  id: z.string().uuid(),
  slug_fr: z.string(),
  slug_en: z.string().nullable(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  country_code: z.string(),
  destination_region: z.string().nullable(),
  destination_city: z.string().nullable(),
  themes: z.array(z.string()).default([]),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  travel_style: z.string(),
  season: z.string().nullable(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  hero_cloudinary_id: z.string().nullable(),
  hero_alt_fr: z.string().nullable(),
  hero_alt_en: z.string().nullable(),
  hotel_ids: z.array(z.string().uuid()).default([]),
  last_updated: z.string(),
});

const CARD_COLUMNS =
  'id, slug_fr, slug_en, title_fr, title_en, meta_desc_fr, meta_desc_en, ' +
  'country_code, destination_region, destination_city, themes, ' +
  'duration_min_days, duration_max_days, travel_style, season, priority, ' +
  'hero_cloudinary_id, hero_alt_fr, hero_alt_en, hotel_ids, last_updated';

// ============================================================================
// Pure mappers — exposed for unit tests.
// ============================================================================

/**
 * Project a Supabase row into the public card shape. Pure function, no
 * I/O — exercised directly by `itineraries.test.ts`.
 */
export function rowToCard(raw: unknown): ItineraryCard | null {
  const parsed = CardRowSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  return {
    id: r.id,
    slugFr: r.slug_fr,
    slugEn: r.slug_en,
    titleFr: r.title_fr,
    titleEn: r.title_en,
    metaDescFr: r.meta_desc_fr,
    metaDescEn: r.meta_desc_en,
    countryCode: r.country_code,
    destinationRegion: r.destination_region,
    destinationCity: r.destination_city,
    themes: r.themes,
    durationMinDays: r.duration_min_days,
    durationMaxDays: r.duration_max_days,
    travelStyle: r.travel_style,
    season: r.season,
    priority: r.priority,
    heroCloudinaryId: r.hero_cloudinary_id,
    heroAltFr: r.hero_alt_fr,
    heroAltEn: r.hero_alt_en,
    hotelCount: r.hotel_ids.length,
    lastUpdated: r.last_updated,
  };
}

/**
 * Sort cards in the canonical order surfaced by the hub:
 *   1. Priority (P0 first, P3 last)
 *   2. `last_updated` DESC (freshest first inside a priority bucket)
 *   3. `title_fr` ASC (deterministic tie-breaker)
 *
 * Pure function — exposed for testing.
 */
const PRIORITY_ORDER: Readonly<Record<'P0' | 'P1' | 'P2' | 'P3', number>> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export function sortCards(cards: readonly ItineraryCard[]): readonly ItineraryCard[] {
  return [...cards].sort((a, b) => {
    if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (a.lastUpdated !== b.lastUpdated) return a.lastUpdated < b.lastUpdated ? 1 : -1;
    return a.titleFr.localeCompare(b.titleFr);
  });
}

// ============================================================================
// Reader.
// ============================================================================

async function fetchItineraryCards(
  filters: ListItinerariesFilters,
): Promise<readonly ItineraryCard[]> {
  try {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('itineraries')
      .select(CARD_COLUMNS)
      .eq('status', 'published')
      .limit(filters.limit);

    if (filters.country_code !== undefined) {
      query = query.eq('country_code', filters.country_code);
    }
    if (filters.destination_region !== undefined) {
      query = query.ilike('destination_region', filters.destination_region);
    }
    if (filters.destination_city !== undefined) {
      query = query.ilike('destination_city', filters.destination_city);
    }
    if (filters.themes !== undefined && filters.themes.length > 0) {
      // PostgREST `overlaps` operator on text[] columns. Equivalent to
      // `themes && '{a,b}'::text[]`.
      query = query.overlaps('themes', filters.themes);
    }
    if (filters.travel_style !== undefined) {
      query = query.eq('travel_style', filters.travel_style);
    }
    if (filters.duration_min_days !== undefined) {
      query = query.gte('duration_min_days', filters.duration_min_days);
    }
    if (filters.duration_max_days !== undefined) {
      // Itineraries with NULL `duration_max_days` are excluded by this
      // filter — that's intended: a user explicitly capping max days
      // wants a hard upper bound.
      query = query.lte('duration_max_days', filters.duration_max_days);
    }
    if (filters.priority !== undefined) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error } = await query;
    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.list] supabase error', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const cards: ItineraryCard[] = [];
    for (const raw of data) {
      const card = rowToCard(raw);
      if (card !== null) cards.push(card);
    }
    return sortCards(cards);
  } catch (e) {
    console.error(
      '[itineraries.list] fetchItineraryCards threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Build a stable cache key from the filter object. JSON.stringify is
 * intentional — Zod parsing happens upstream so the input shape is
 * guaranteed serializable, and small objects keep the key short
 * enough to fit Vercel's data-cache key budget.
 *
 * Returns a mutable `string[]` because `unstable_cache`'s second
 * argument expects exactly that shape.
 */
function cacheKeyFor(filters: ListItinerariesFilters): string[] {
  return ['itineraries-list-v1', JSON.stringify(filters)];
}

/**
 * Slug-only reader powering `generateStaticParams` on
 * `/itineraire/[slug]/page.tsx`. Returns the FR slugs of every
 * published itinerary as a flat array.
 *
 * Defensive `[]` on any failure (rule nextjs-app-router.mdc) so the
 * static slate stays buildable even when Supabase is unreachable
 * (e.g. preview deployments without env vars).
 */
export async function listPublishedItinerarySlugs(): Promise<readonly string[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('itineraries')
      .select('slug_fr')
      .eq('status', 'published');

    if (error !== null || !Array.isArray(data)) {
      if (error !== null) {
        console.error('[itineraries.list-slugs] supabase error', {
          message: error.message,
          code: error.code,
        });
      }
      return [];
    }

    const out: string[] = [];
    for (const row of data) {
      const slug = (row as { slug_fr?: unknown }).slug_fr;
      if (typeof slug === 'string' && slug.length > 0) out.push(slug);
    }
    return out;
  } catch (e) {
    console.error(
      '[itineraries.list-slugs] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Public listing helper. Validates the input through Zod first
 * (defaulting `limit = 60` when missing), then hits the cached fetch.
 *
 * Cache TTL: 1 h, tagged `itineraries-hub` and `itineraries-country-{code}`
 * (when filtered) so editors can `revalidateTag` precisely on publish.
 */
export async function listItineraries(
  filters: Partial<ListItinerariesFilters> = {},
): Promise<readonly ItineraryCard[]> {
  const parsed = ListItinerariesFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    console.error('[itineraries.list] invalid filters', {
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return [];
  }
  const cached = unstable_cache(() => fetchItineraryCards(parsed.data), cacheKeyFor(parsed.data), {
    revalidate: 3600,
    tags: [
      'itineraries-hub',
      ...(parsed.data.country_code !== undefined
        ? [`itineraries-country-${parsed.data.country_code}`]
        : []),
    ],
  });
  return cached();
}
