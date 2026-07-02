import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * List readers for the places vertical: the city ranking/index page,
 * the `places.xml` sitemap, `generateStaticParams`, and the agent
 * endpoint. All degrade to `[]` without Supabase env.
 */

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const PlaceListRowSchema = z.object({
  slug: z.string(),
  slug_en: z.string().nullish(),
  city_key: z.string(),
  city: z.string(),
  bucket: z.enum(['visit', 'do']),
  kind: z.string(),
  name: z.string(),
  name_en: z.string().nullish(),
  latitude: numberOrNull,
  longitude: numberOrNull,
  factual_summary_fr: z.string().nullish(),
  factual_summary_en: z.string().nullish(),
  hero_image: z.string().nullish(),
  priority: z.number().nullish(),
});

export type PlaceListItem = z.infer<typeof PlaceListRowSchema>;

const LIST_COLUMNS =
  'slug, slug_en, city_key, city, bucket, kind, name, name_en, latitude, longitude, factual_summary_fr, factual_summary_en, hero_image, priority';

/**
 * Supabase enforces a server-side `db_max_rows` cap (default `1000` in our
 * project) that silently truncates `.limit(N)` calls to that cap regardless
 * of the value the client passes. The `lieux` catalogue crossed 1 000
 * published rows (1 106 on 2026-06-22 after the Paris/Dubai/Tokyo/… wave),
 * so the catalogue-wide readers below must page with `.range()` until
 * exhaustion — otherwise the sitemap and the `/lieux` hub silently drop
 * every row beyond the first 1 000. Same fix as `destinations/cities.ts`.
 * The hard `MAX_PAGES` ceiling avoids a runaway loop on a misconfigured env.
 */
const PAGE_SIZE = 1000;
const MAX_PAGES = 12;

/**
 * Published places for a city, optionally filtered by bucket.
 *
 * Returns the *full* published set for the city (no arbitrary cap): the
 * city `/lieux/[citySlug]` page paginates the result in memory and renders
 * crawlable numbered pages, so every published POI is reachable by a
 * crawler from the maillage. The old `.limit(200)` silently orphaned every
 * POI beyond the 200th (alpha order) — Paris alone has 779 published POIs,
 * so 579 were never linked. We page with `.range()` until exhaustion to
 * also bypass Supabase's `db_max_rows` cap (1000) should a single city
 * ever cross it. Ordering is stable (priority asc, name asc) so the
 * in-memory pagination never skips or duplicates a row across pages.
 */
export async function listPublishedPlacesForCity(
  citySlug: string,
  bucket?: 'visit' | 'do',
): Promise<readonly PlaceListItem[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const out: PlaceListItem[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      let q = supabase
        .from('places')
        .select(LIST_COLUMNS)
        .eq('city_key', citySlug)
        .eq('is_published', true);
      if (bucket !== undefined) q = q.eq('bucket', bucket);
      const { data, error } = await q
        .order('priority', { ascending: true })
        .order('name', { ascending: true })
        .order('slug', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !Array.isArray(data)) break;
      for (const raw of data) {
        const parsed = PlaceListRowSchema.safeParse(raw);
        if (parsed.success) out.push(parsed.data);
      }
      if (data.length < PAGE_SIZE) break;
    }
    return out;
  } catch {
    return [];
  }
}

export interface PublishedPlaceParam {
  readonly citySlug: string;
  readonly slugFr: string;
  readonly slugEn: string | null;
  readonly updatedAt: string | null;
}

/** All published place params — sitemap + generateStaticParams. */
export async function listPublishedPlaceParams(): Promise<readonly PublishedPlaceParam[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const out: PublishedPlaceParam[] = [];
    // Page by `(city_key, slug)` — a total order so pagination never skips
    // or duplicates a row across the `db_max_rows` boundary.
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('places')
        .select('slug, slug_en, city_key, updated_at')
        .eq('is_published', true)
        .order('city_key', { ascending: true })
        .order('slug', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !Array.isArray(data)) break;
      for (const raw of data) {
        const r = raw as {
          slug?: unknown;
          slug_en?: unknown;
          city_key?: unknown;
          updated_at?: unknown;
        };
        if (typeof r.slug === 'string' && typeof r.city_key === 'string') {
          out.push({
            citySlug: r.city_key,
            slugFr: r.slug,
            slugEn: typeof r.slug_en === 'string' ? r.slug_en : null,
            updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
          });
        }
      }
      if (data.length < PAGE_SIZE) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** A city that has at least one published place, with its counts. */
export interface PlaceCitySummary {
  readonly citySlug: string;
  readonly cityName: string;
  readonly total: number;
  readonly visit: number;
  readonly doCount: number;
}

/**
 * Uncached scan behind {@link listPlaceCities}. Throws on any Supabase
 * error so `unstable_cache` never persists a truncated aggregate for a
 * full TTL window (same contract as `destinations/cities.ts`).
 */
async function _listPlaceCitiesRaw(): Promise<readonly PlaceCitySummary[]> {
  const supabase = getSupabaseAdminClient();
  const byCity = new Map<string, { name: string; visit: number; doCount: number }>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('places')
      .select('city_key, city, bucket')
      .eq('is_published', true)
      .order('slug', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase error on page ${page}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error('Supabase returned non-array data');
    for (const raw of data) {
      const row = raw as { city_key?: unknown; city?: unknown; bucket?: unknown };
      if (typeof row.city_key !== 'string' || row.city_key.length === 0) continue;
      const entry = byCity.get(row.city_key) ?? {
        name: typeof row.city === 'string' && row.city.length > 0 ? row.city : row.city_key,
        visit: 0,
        doCount: 0,
      };
      if (row.bucket === 'do') entry.doCount += 1;
      else entry.visit += 1;
      byCity.set(row.city_key, entry);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return [...byCity.entries()]
    .map(([citySlug, v]) => ({
      citySlug,
      cityName: v.name,
      total: v.visit + v.doCount,
      visit: v.visit,
      doCount: v.doCount,
    }))
    .sort((a, b) => b.total - a.total || a.cityName.localeCompare(b.cityName));
}

// Shared Data Cache (ADR-0031): the `/lieux` hub route stays force-dynamic
// (CSP nonce contract) so the aggregation is cached at the data layer —
// once per hour per region instead of once per render.
const listPlaceCitiesCached = unstable_cache(_listPlaceCitiesRaw, ['place-cities'], {
  revalidate: 3600,
  tags: ['places-catalogue'],
});

/**
 * Distinct published cities with per-bucket counts — powers the `/lieux`
 * hub index. Aggregated in memory (the published-places volume is small),
 * degrades to `[]` without Supabase env.
 */
export async function listPlaceCities(): Promise<readonly PlaceCitySummary[]> {
  try {
    return await listPlaceCitiesCached();
  } catch {
    return [];
  }
}

/** Distinct published city keys that have at least one place. */
export async function listPlaceCityKeys(): Promise<readonly string[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const set = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from('places')
        .select('city_key')
        .eq('is_published', true)
        .order('slug', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !Array.isArray(data)) break;
      for (const raw of data) {
        const ck = (raw as { city_key?: unknown }).city_key;
        if (typeof ck === 'string' && ck.length > 0) set.add(ck);
      }
      if (data.length < PAGE_SIZE) break;
    }
    return [...set].sort();
  } catch {
    return [];
  }
}
