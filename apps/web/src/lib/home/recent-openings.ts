import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Recent-openings reader for the home « Le Concierge a frappé à leur
 * porte » section and the `/ouvertures` page.
 *
 * Distinct from `getHomeFeaturedHotels` (`featured-hotels.ts`) in three
 * ways:
 *   1. **Sourcing signal** — `priority` ascending (1 = top, 99 = noise)
 *      instead of the country-diversification round-robin. The PO
 *      decision (2026-05-28) is to lean on the editorial priority
 *      column until `opened_at` is back-filled across the catalogue
 *      (today 0/2193, see `0022_hotel_dates_columns.sql`). The shape
 *      below already projects `opened_at` so the switch is a one-line
 *      `order` change when the column is populated.
 *   2. **No country diversification** — the openings strip is supposed
 *      to feel curated; back-to-back Italian openings are fine when the
 *      Concierge has just visited Tuscany.
 *   3. **Limit-driven** — used at 4 entries on the home (grid 2×2) and
 *      up to 20 on `/ouvertures`.
 *
 * The card shape mirrors `FeaturedHotelCard` so the renderer can share
 * a single card component if we ever consolidate; today both use their
 * own visual to leave room for divergence (badge, eyebrow, layout).
 */
export interface RecentOpeningCard {
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
  /** ISO date `YYYY-MM-DD` when the hotel opened. `null` until back-filled. */
  readonly openedAt: string | null;
  /**
   * ISO timestamp of the last database update on the row. Surfaced so
   * the `/ouvertures` page can drive a `<LastUpdatedBadge />` from the
   * `max(updated_at)` of the projected list (triple-sync freshness
   * signal — see `.cursor/rules/seo-geo.mdc` §Freshness signal).
   */
  readonly updatedAt: string | null;
}

const RowSchema = z.object({
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
  opened_at: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  updated_at: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});

async function fetchRecentOpenings(limit: number): Promise<readonly RecentOpeningCard[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(
        'slug, slug_en, name, name_en, city, stars, is_palace, luxury_tier, country_code, country_label_fr, country_label_en, hero_image, opened_at, updated_at, priority',
      )
      .eq('is_published', true)
      .not('hero_image', 'is', null)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    if (error !== null || !Array.isArray(data)) return [];

    const out: RecentOpeningCard[] = [];
    for (const raw of data) {
      const r = RowSchema.safeParse(raw);
      if (!r.success) continue;
      out.push({
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
        openedAt: r.data.opened_at,
        updatedAt: r.data.updated_at,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getRecentOpenings(limit: number): Promise<readonly RecentOpeningCard[]> {
  const safeLimit = Math.max(1, Math.min(40, Math.floor(limit)));
  const cached = unstable_cache(
    () => fetchRecentOpenings(safeLimit),
    ['home-recent-openings-v1', String(safeLimit)],
    { revalidate: 3600, tags: ['home-recent-openings', 'home-metrics'] },
  );
  return cached();
}
