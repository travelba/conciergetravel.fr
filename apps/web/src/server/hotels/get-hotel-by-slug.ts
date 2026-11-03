import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { selectGoogleReviewsForAccesWithApiCapFallback } from '@mch/domain/reviews';
import { isToxicOfficialUrl } from '@mch/domain/url';
import { parseAffiliationsLenient, type HotelAffiliation } from '@mch/db';
import { z } from 'zod';

import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { mergeRoomGalleryImages } from '@/lib/hotel/sort-room-display-images';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  AMENITY_CATEGORIES,
  amenityOrder,
  categorizeAmenity,
  categoryOrder,
  isPremiumAmenity,
  type AmenityCategory,
} from '@/server/hotels/amenity-taxonomy';
import { getFakeHotelDetailBySlug } from '@/server/hotels/dev-fake-hotel-detail';
import {
  applyAirellesLocalOverride,
  isAirellesLocalOverrideEnabled,
} from '@/server/hotels/dev-override-airelles';
import { enrichAirellesRooms, isAirellesHotelSlug } from '@/server/hotels/enrich-airelles-rooms';

export type { SupportedLocale };

const BookingModeSchema = z.enum(['amadeus', 'little', 'travelport', 'email', 'display_only']);
const PrioritySchema = z.enum(['P0', 'P1', 'P2']);

const stringOrEmpty = z
  .string()
  .nullish()
  .transform((v) => (typeof v === 'string' ? v : null));

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

/** Hotel row consumed by the public detail page. */
export const HotelDetailRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  slug_en: stringOrEmpty,
  name: z.string(),
  name_en: stringOrEmpty,
  stars: z.number().int().min(1).max(5),
  is_palace: z.boolean(),
  // International hotels have NULL region (migration 0033). Coerce to
  // empty string so the detail page renders for non-FR hotels. The visible
  // breadcrumb falls back to country labels when region is empty.
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  department: stringOrEmpty,
  city: z.string(),
  district: stringOrEmpty,
  address: stringOrEmpty,
  postal_code: stringOrEmpty,
  latitude: numberOrNull,
  longitude: numberOrNull,
  description_fr: stringOrEmpty,
  description_en: stringOrEmpty,
  factual_summary_fr: stringOrEmpty,
  factual_summary_en: stringOrEmpty,
  highlights: z.unknown().nullable().optional(),
  amenities: z.unknown().nullable().optional(),
  faq_content: z.unknown().nullable().optional(),
  /** Extended Perplexity kit (40–60). When set, DOM FAQ reads this; JSON-LD uses faq_content. */
  faq_content_kit: z.unknown().nullable().optional(),
  /** Concierge-voice Q&A (20–30) — proactive replies, separate from factual FAQ. */
  concierge_questions: z.unknown().nullable().optional(),
  restaurant_info: z.unknown().nullable().optional(),
  spa_info: z.unknown().nullable().optional(),
  instagram: z.unknown().nullable().optional(),
  points_of_interest: z.unknown().nullable().optional(),
  transports: z.unknown().nullable().optional(),
  upcoming_events: z.unknown().nullable().optional(),
  policies: z.unknown().nullable().optional(),
  awards: z.unknown().nullable().optional(),
  affiliations: z.unknown().nullable().optional(),
  signature_experiences: z.unknown().nullable().optional(),
  concierge_advice: z.unknown().nullable().optional(),
  concierge_pick: z.unknown().nullable().optional(),
  concierge_hook: z.unknown().nullable().optional(),
  geo_qa: z.unknown().nullable().optional(),
  featured_reviews: z.unknown().nullable().optional(),
  hero_image: stringOrEmpty,
  gallery_images: z.unknown().nullable().optional(),
  long_description_sections: z.unknown().nullable().optional(),
  number_of_rooms: z.number().int().positive().nullish().transform((v) => v ?? null),
  number_of_suites: z.number().int().min(0).nullish().transform((v) => v ?? null),
  meta_title_fr: stringOrEmpty,
  meta_title_en: stringOrEmpty,
  meta_desc_fr: stringOrEmpty,
  meta_desc_en: stringOrEmpty,
  booking_mode: BookingModeSchema,
  amadeus_hotel_id: stringOrEmpty,
  priority: PrioritySchema,
  google_rating: numberOrNull,
  google_reviews_count: z.number().int().nullish().transform((v) => v ?? null),
  google_place_id: stringOrEmpty,
  google_reviews: z.unknown().nullable().optional(),
  last_reviews_sync: stringOrEmpty,
  phone_e164: stringOrEmpty,
  telephone: stringOrEmpty,
  price_range: stringOrEmpty,
  price_from: numberOrNull,
  aggregate_rating_value: numberOrNull,
  aggregate_rating_count: numberOrNull,
  aggregate_rating_source: stringOrEmpty,
  opened_at: stringOrEmpty,
  last_renovated_at: stringOrEmpty,
  virtual_tour_url: stringOrEmpty,
  mice_info: z.unknown().nullable().optional(),
  hero_video: z.unknown().nullable().optional(),
  wikidata_id: stringOrEmpty,
  wikipedia_url_fr: stringOrEmpty,
  wikipedia_url_en: stringOrEmpty,
  tripadvisor_location_id: stringOrEmpty,
  booking_com_hotel_id: stringOrEmpty,
  expedia_property_id: stringOrEmpty,
  hotels_com_hotel_id: stringOrEmpty,
  agoda_hotel_id: stringOrEmpty,
  official_url: stringOrEmpty,
  email_reservations: stringOrEmpty,
  commons_category: stringOrEmpty,
  external_sameas: z.unknown().nullable().optional(),
  external_sources: z.unknown().nullable().optional(),
  country_code: z.string().length(2).nullish().transform((v) => v ?? 'FR'),
  country_label_fr: stringOrEmpty,
  country_label_en: stringOrEmpty,
  luxury_tier: stringOrEmpty,
  is_published: z.boolean(),
  updated_at: stringOrEmpty,
});
