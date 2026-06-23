import 'server-only';

import { cache } from 'react';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Data layer for the "lieux à visiter" vertical (public reads).
 *
 * Reads the canonical `public.places` + `place_hotel_links` +
 * `place_gyg_products` tables. We use the service-role client and
 * re-apply the `is_published = true` filter that the anon RLS policy
 * `places_select_published` enforces — same pattern as
 * `listPublishedHotelSlugs`. Every reader degrades to `null` / `[]`
 * when Supabase env is absent (CI smoke, preview) so the route never
 * 500s.
 */

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const FaqEntrySchema = z.object({
  q_fr: z.string(),
  a_fr: z.string(),
  q_en: z.string().nullish(),
  a_en: z.string().nullish(),
});

const ConciergeAdviceSchema = z.object({
  fr: z.object({ title: z.string().nullish(), body: z.string() }).nullish(),
  en: z.object({ title: z.string().nullish(), body: z.string() }).nullish(),
});

/**
 * One `gallery_images` item, mirroring the shape the photo pipeline
 * writes via `toGalleryRow` (@mch/integrations/cloudinary): a Cloudinary
 * `public_id` plus enriched alt text (FR + EN) and the place `kind`
 * category. Width/height are NOT persisted — the delivery transform is
 * authoritative for the rendered dimensions (Hard Rule 16).
 */
const GalleryImageRowSchema = z.object({
  public_id: z.string(),
  alt_fr: z.string().nullish(),
  alt_en: z.string().nullish(),
  category: z.string().nullish(),
});

export type PlaceGalleryImageRow = z.infer<typeof GalleryImageRowSchema>;

const PlaceRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  slug_en: z.string().nullish(),
  city_key: z.string(),
  city: z.string(),
  country_code: z.string(),
  bucket: z.enum(['visit', 'do']),
  kind: z.string(),
  latitude: numberOrNull,
  longitude: numberOrNull,
  address: z.string().nullish(),
  name: z.string(),
  name_en: z.string().nullish(),
  factual_summary_fr: z.string().nullish(),
  factual_summary_en: z.string().nullish(),
  description_fr: z.string().nullish(),
  description_en: z.string().nullish(),
  concierge_advice: ConciergeAdviceSchema.nullish(),
  faq: z.array(FaqEntrySchema).nullish(),
  hero_image: z.string().nullish(),
  gallery_images: z.array(GalleryImageRowSchema).nullish(),
  meta_title_fr: z.string().nullish(),
  meta_title_en: z.string().nullish(),
  meta_desc_fr: z.string().nullish(),
  meta_desc_en: z.string().nullish(),
  is_published: z.boolean(),
});

export type PlaceDetail = z.infer<typeof PlaceRowSchema>;

const PLACE_COLUMNS =
  'id, slug, slug_en, city_key, city, country_code, bucket, kind, latitude, longitude, address, name, name_en, factual_summary_fr, factual_summary_en, description_fr, description_en, concierge_advice, faq, hero_image, gallery_images, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en, is_published';

/**
 * Resolve a place by city + slug. Matches the FR slug first, then the
 * EN alias (so `/en/lieux/paris/<slug_en>` resolves). Returns `null`
 * for unpublished / unknown rows.
 */
export const getPlaceBySlug = cache(
  async (citySlug: string, placeSlug: string): Promise<PlaceDetail | null> => {
    try {
      const supabase = getSupabaseAdminClient();
      let res = await supabase
        .from('places')
        .select(PLACE_COLUMNS)
        .eq('city_key', citySlug)
        .eq('slug', placeSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (!res.data) {
        res = await supabase
          .from('places')
          .select(PLACE_COLUMNS)
          .eq('city_key', citySlug)
          .eq('slug_en', placeSlug)
          .eq('is_published', true)
          .maybeSingle();
      }

      if (res.error || !res.data) return null;
      const parsed = PlaceRowSchema.safeParse(res.data);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
);

export interface NearbyHotelLink {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  readonly heroImage: string | null;
}

const NearbyHotelRowSchema = z.object({
  distance_meters: z.number(),
  walk_minutes: numberOrNull,
  hotels: z
    .object({
      slug: z.string(),
      name: z.string(),
      city: z.string().nullish(),
      hero_image: z.string().nullish(),
      is_published: z.boolean(),
    })
    .nullish(),
});

/** Published hotels near a place, closest first (maillage retour). */
export const getNearbyHotelsForPlace = cache(
  async (placeId: string, limit = 6): Promise<readonly NearbyHotelLink[]> => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('place_hotel_links')
        .select(
          'distance_meters, walk_minutes, hotels!inner(slug, name, city, hero_image, is_published)',
        )
        .eq('place_id', placeId)
        .order('distance_meters', { ascending: true })
        .limit(limit * 2);
      if (error || !Array.isArray(data)) return [];

      const out: NearbyHotelLink[] = [];
      for (const raw of data) {
        const parsed = NearbyHotelRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        const hotel = parsed.data.hotels;
        if (!hotel || hotel.is_published !== true) continue;
        out.push({
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city ?? '',
          distanceMeters: parsed.data.distance_meters,
          walkMinutes: parsed.data.walk_minutes,
          heroImage: hotel.hero_image ?? null,
        });
        if (out.length >= limit) break;
      }
      return out;
    } catch {
      return [];
    }
  },
);

export interface PlaceGygProduct {
  readonly tourId: string;
  readonly title: string;
  readonly abstract: string | null;
  readonly priceFromMinor: number | null;
  readonly currency: string | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly deeplinkUrl: string;
  readonly imageUrl: string | null;
}

const GygProductRowSchema = z.object({
  gyg_tour_id: z.string(),
  title: z.string(),
  abstract: z.string().nullish(),
  price_from_minor: numberOrNull,
  currency: z.string().nullish(),
  rating: numberOrNull,
  review_count: numberOrNull,
  deeplink_url: z.string(),
  image_url: z.string().nullish(),
});

/** GetYourGuide products matched to a place (affiliate deeplinks). */
export const getGygProductsForPlace = cache(
  async (placeId: string, limit = 6): Promise<readonly PlaceGygProduct[]> => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('place_gyg_products')
        .select(
          'gyg_tour_id, title, abstract, price_from_minor, currency, rating, review_count, deeplink_url, image_url',
        )
        .eq('place_id', placeId)
        .order('sort_order', { ascending: true })
        .limit(limit);
      if (error || !Array.isArray(data)) return [];
      const out: PlaceGygProduct[] = [];
      for (const raw of data) {
        const parsed = GygProductRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        const p = parsed.data;
        out.push({
          tourId: p.gyg_tour_id,
          title: p.title,
          abstract: p.abstract ?? null,
          priceFromMinor: p.price_from_minor,
          currency: p.currency ?? null,
          rating: p.rating,
          reviewCount: p.review_count,
          deeplinkUrl: p.deeplink_url,
          imageUrl: p.image_url ?? null,
        });
      }
      return out;
    } catch {
      return [];
    }
  },
);
