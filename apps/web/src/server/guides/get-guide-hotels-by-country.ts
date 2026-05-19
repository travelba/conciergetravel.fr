import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

import type { GuideHotelCard } from './get-guide-hotels';

const HotelCardSchema = z.object({
  slug: z.string(),
  slug_en: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string(),
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  stars: z.number().int(),
  is_palace: z.boolean(),
  hero_image: z.string().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
});

const HOTEL_COLUMNS =
  'slug, slug_en, name, name_en, city, region, stars, is_palace, hero_image, description_fr, description_en';

/**
 * Fetches published hotels for a country guide.
 *
 * Country guides aggregate dozens-to-hundreds of hotels across many
 * cities, so the city-based join used by `getHotelsForDestination` is
 * the wrong shape — we filter directly on `country_code` instead.
 *
 * The result is bounded (default 18) so the rendered list stays
 * scannable and JSON-LD `ItemList` doesn't bloat. Ordering prioritises:
 *   1. `luxury_tier IS NOT NULL` (curated tier) before generic 5★.
 *   2. `hero_image IS NOT NULL` (visually complete fiches first).
 *   3. `is_palace` then `stars` then alphabetical.
 *
 * Hotels without `description_fr/en` are skipped — we don't want a
 * country guide cross-linking to thin-content fiches.
 */
export async function getHotelsForCountry(
  countryCode: string,
  limit = 18,
): Promise<readonly GuideHotelCard[]> {
  if (typeof countryCode !== 'string' || countryCode.length !== 2) return [];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('hotels')
    .select(HOTEL_COLUMNS)
    .eq('is_published', true)
    .eq('country_code', countryCode.toUpperCase())
    .not('description_fr', 'is', null)
    .order('luxury_tier', { ascending: false, nullsFirst: false })
    .order('hero_image', { ascending: false, nullsFirst: false })
    .order('is_palace', { ascending: false })
    .order('stars', { ascending: false })
    .order('name', { ascending: true })
    .limit(limit);
  if (error !== null || data === null) return [];
  const out: GuideHotelCard[] = [];
  for (const row of data as unknown[]) {
    const parsed = HotelCardSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
