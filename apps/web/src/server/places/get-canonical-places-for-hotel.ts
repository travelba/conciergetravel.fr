import 'server-only';

import { cache } from 'react';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Reverse maillage for the hotel "Autour" section: given a hotel, list
 * the canonical published `places` linked to it (via `place_hotel_links`),
 * grouped by editorial bucket (`visit` / `do`).
 *
 * Anti-cannibalisation (plan §3.2): the hotel page renders only a short
 * card + link to the canonical place fiche — never the long description.
 * When no canonical link exists the caller falls back to the legacy
 * embedded `points_of_interest` JSONB rendering (zero-regression).
 *
 * Degrades to an empty result without Supabase env.
 */

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const LinkedPlaceRowSchema = z.object({
  distance_meters: z.number(),
  walk_minutes: numberOrNull,
  places: z
    .object({
      slug: z.string(),
      slug_en: z.string().nullish(),
      city_key: z.string(),
      bucket: z.enum(['visit', 'do']),
      kind: z.string(),
      name: z.string(),
      name_en: z.string().nullish(),
      factual_summary_fr: z.string().nullish(),
      factual_summary_en: z.string().nullish(),
      hero_image: z.string().nullish(),
      is_published: z.boolean(),
    })
    .nullish(),
});

export interface CanonicalPlaceCard {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly citySlug: string;
  readonly kind: string;
  readonly name: string;
  readonly nameEn: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly heroImage: string | null;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
}

export interface HotelCanonicalPlaces {
  readonly visit: readonly CanonicalPlaceCard[];
  readonly do: readonly CanonicalPlaceCard[];
}

const EMPTY: HotelCanonicalPlaces = { visit: [], do: [] };

/** Canonical places linked to a hotel, grouped by bucket (closest first). */
export const getCanonicalPlacesForHotel = cache(
  async (hotelId: string, limitPerBucket = 8): Promise<HotelCanonicalPlaces> => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('place_hotel_links')
        .select(
          'distance_meters, walk_minutes, places!inner(slug, slug_en, city_key, bucket, kind, name, name_en, factual_summary_fr, factual_summary_en, hero_image, is_published)',
        )
        .eq('hotel_id', hotelId)
        .order('distance_meters', { ascending: true })
        .limit(limitPerBucket * 4);
      if (error || !Array.isArray(data)) return EMPTY;

      const visit: CanonicalPlaceCard[] = [];
      const doIt: CanonicalPlaceCard[] = [];
      for (const raw of data) {
        const parsed = LinkedPlaceRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        const p = parsed.data.places;
        if (!p || p.is_published !== true) continue;
        const card: CanonicalPlaceCard = {
          slug: p.slug,
          slugEn: p.slug_en ?? null,
          citySlug: p.city_key,
          kind: p.kind,
          name: p.name,
          nameEn: p.name_en ?? null,
          factualSummaryFr: p.factual_summary_fr ?? null,
          factualSummaryEn: p.factual_summary_en ?? null,
          heroImage: p.hero_image ?? null,
          distanceMeters: parsed.data.distance_meters,
          walkMinutes: parsed.data.walk_minutes,
        };
        const target = p.bucket === 'do' ? doIt : visit;
        if (target.length < limitPerBucket) target.push(card);
      }
      return { visit, do: doIt };
    } catch {
      return EMPTY;
    }
  },
);

/** Resolve a hotel id by FR or EN slug (published only). */
async function resolveHotelIdBySlug(slug: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    let res = await supabase
      .from('hotels')
      .select('id')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (!res.data) {
      res = await supabase
        .from('hotels')
        .select('id')
        .eq('slug_en', slug)
        .eq('is_published', true)
        .maybeSingle();
    }
    const id = (res.data as { id?: unknown } | null)?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** Canonical places linked to a hotel identified by its slug. */
export const getCanonicalPlacesForHotelSlug = cache(
  async (slug: string, limitPerBucket = 8): Promise<HotelCanonicalPlaces | null> => {
    const id = await resolveHotelIdBySlug(slug);
    if (id === null) return null;
    return getCanonicalPlacesForHotel(id, limitPerBucket);
  },
);
