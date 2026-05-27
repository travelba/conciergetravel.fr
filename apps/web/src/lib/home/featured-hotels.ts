import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Featured-hotels reader for the home `<HomeHotelGrid>`.
 *
 * Distinct from `listPublishedHotelsForIndex` in three ways:
 *   1. Projects `luxury_tier` + `country_code` so the card can render
 *      a tier badge and the country eyebrow.
 *   2. Filters out rows without `hero_image` — the home grid is a
 *      visual surface.
 *   3. Returns a mix of FR + intl by round-robining country buckets
 *      so the top of the grid avoids the "six Paris palaces in a row"
 *      effect that the 2026-05-27 audit surfaced.
 */
export interface FeaturedHotelCard {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string;
  readonly stars: number;
  readonly isPalace: boolean;
  readonly luxuryTier: string;
  readonly countryCode: string;
  readonly countryLabelFr: string;
  readonly countryLabelEn: string;
  readonly heroPublicId: string;
}

const FeaturedRowSchema = z.object({
  slug: z.string(),
  slug_en: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  name: z.string(),
  name_en: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  city: z.string(),
  stars: z.number().int().min(1).max(5),
  is_palace: z.boolean(),
  luxury_tier: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  country_code: z
    .string()
    .length(2)
    .nullish()
    .transform((v) => v ?? 'FR'),
  country_label_fr: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  country_label_en: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  hero_image: z.string().min(1),
});

async function fetchFeaturedHotels(limit: number): Promise<readonly FeaturedHotelCard[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(
        'slug, slug_en, name, name_en, city, stars, is_palace, luxury_tier, country_code, country_label_fr, country_label_en, hero_image, priority',
      )
      .eq('is_published', true)
      .not('hero_image', 'is', null)
      .order('priority', { ascending: true })
      .order('country_code', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit * 3);

    if (error !== null || !Array.isArray(data)) return [];

    const parsed: FeaturedHotelCard[] = [];
    for (const raw of data) {
      const r = FeaturedRowSchema.safeParse(raw);
      if (!r.success) continue;
      parsed.push({
        slug: r.data.slug,
        slugEn: r.data.slug_en,
        nameFr: r.data.name,
        nameEn: r.data.name_en,
        city: r.data.city,
        stars: r.data.stars,
        isPalace: r.data.is_palace,
        luxuryTier: r.data.luxury_tier,
        countryCode: r.data.country_code,
        countryLabelFr: r.data.country_label_fr,
        countryLabelEn: r.data.country_label_en,
        heroPublicId: r.data.hero_image,
      });
    }

    return diversifyByCountry(parsed, limit);
  } catch {
    return [];
  }
}

/**
 * Pure: rebalance the array by `countryCode` so consecutive entries
 * never share the same country. Deficit round-robin that preserves
 * the original priority within each country bucket.
 */
export function diversifyByCountry<T extends { readonly countryCode: string }>(
  rows: readonly T[],
  limit: number,
): readonly T[] {
  if (rows.length <= 1) return rows.slice(0, limit);
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const arr = buckets.get(row.countryCode) ?? [];
    arr.push(row);
    buckets.set(row.countryCode, arr);
  }
  const out: T[] = [];
  const codes = Array.from(buckets.keys());
  while (out.length < limit && codes.some((c) => (buckets.get(c)?.length ?? 0) > 0)) {
    for (const code of codes) {
      if (out.length >= limit) break;
      const bucket = buckets.get(code);
      if (bucket !== undefined && bucket.length > 0) {
        const next = bucket.shift();
        if (next !== undefined) out.push(next);
      }
    }
  }
  return out;
}

export async function getHomeFeaturedHotels(limit: number): Promise<readonly FeaturedHotelCard[]> {
  const safeLimit = Math.max(1, Math.min(24, Math.floor(limit)));
  const cached = unstable_cache(
    () => fetchFeaturedHotels(safeLimit),
    ['home-featured-hotels-v1', String(safeLimit)],
    { revalidate: 3600, tags: ['home-featured-hotels', 'home-metrics'] },
  );
  return cached();
}
