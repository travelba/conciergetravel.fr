import 'server-only';

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

/** Published places for a city, optionally filtered by bucket. */
export async function listPublishedPlacesForCity(
  citySlug: string,
  bucket?: 'visit' | 'do',
): Promise<readonly PlaceListItem[]> {
  try {
    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from('places')
      .select(LIST_COLUMNS)
      .eq('city_key', citySlug)
      .eq('is_published', true);
    if (bucket !== undefined) q = q.eq('bucket', bucket);
    const { data, error } = await q
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(200);
    if (error || !Array.isArray(data)) return [];
    const out: PlaceListItem[] = [];
    for (const raw of data) {
      const parsed = PlaceListRowSchema.safeParse(raw);
      if (parsed.success) out.push(parsed.data);
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
    const { data, error } = await supabase
      .from('places')
      .select('slug, slug_en, city_key, updated_at')
      .eq('is_published', true)
      .order('city_key', { ascending: true })
      .limit(5000);
    if (error || !Array.isArray(data)) return [];
    const out: PublishedPlaceParam[] = [];
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
    return out;
  } catch {
    return [];
  }
}

/** Distinct published city keys that have at least one place. */
export async function listPlaceCityKeys(): Promise<readonly string[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('places')
      .select('city_key')
      .eq('is_published', true)
      .limit(5000);
    if (error || !Array.isArray(data)) return [];
    const set = new Set<string>();
    for (const raw of data) {
      const ck = (raw as { city_key?: unknown }).city_key;
      if (typeof ck === 'string' && ck.length > 0) set.add(ck);
    }
    return [...set].sort();
  } catch {
    return [];
  }
}
