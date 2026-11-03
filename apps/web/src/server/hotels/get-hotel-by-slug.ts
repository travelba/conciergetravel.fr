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
  // Social feed teaser (no dedicated DB column yet — populated by the local
  // golden-template override; production will hydrate it from a Graph-API →
  // Cloudinary sync). Absent on the real query → parses to undefined → the
  // `<HotelInstagram>` section self-elides.
  instagram: z.unknown().nullable().optional(),
  points_of_interest: z.unknown().nullable().optional(),
  transports: z.unknown().nullable().optional(),
  upcoming_events: z.unknown().nullable().optional(),
  policies: z.unknown().nullable().optional(),
  awards: z.unknown().nullable().optional(),
  // Migration 0062 — structured affiliations (brand / label / ranking / guide).
  // Parsed by `readAffiliations` and surfaced into Hotel.brand + Hotel.award[].
  // See ADR-0023 and `.cursor/rules/hotel-detail-page.mdc` Hard Rule 14.
  affiliations: z.unknown().nullable().optional(),
  signature_experiences: z.unknown().nullable().optional(),
  concierge_advice: z.unknown().nullable().optional(),
  // Golden-template Concierge room pick + hero accroche (migration 0068 jsonb
  // columns). Optional — absent rows parse to undefined; the override injects
  // them locally and production hydrates from the row when populated.
  concierge_pick: z.unknown().nullable().optional(),
  concierge_hook: z.unknown().nullable().optional(),
  // Data-driven GEO/AEO answer-engine blocks (migration 0072 jsonb array).
  // Optional — absent rows parse to undefined and `<HotelGeoSection>` self-elides.
  geo_qa: z.unknown().nullable().optional(),
  featured_reviews: z.unknown().nullable().optional(),
  hero_image: stringOrEmpty,
  gallery_images: z.unknown().nullable().optional(),
  long_description_sections: z.unknown().nullable().optional(),
  number_of_rooms: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  number_of_suites: z
    .number()
    .int()
    .min(0)
    .nullish()
    .transform((v) => v ?? null),
  meta_title_fr: stringOrEmpty,
  meta_title_en: stringOrEmpty,
  meta_desc_fr: stringOrEmpty,
  meta_desc_en: stringOrEmpty,
  booking_mode: BookingModeSchema,
  /** 8-char Amadeus property code when `booking_mode = 'amadeus'` (or stored anyway for hotels with sentiment-only enrichment). */
  amadeus_hotel_id: stringOrEmpty,
  priority: PrioritySchema,
  google_rating: numberOrNull,
  google_reviews_count: z
    .number()
    .int()
    .nullish()
    .transform((v) => v ?? null),
  google_place_id: stringOrEmpty,
  google_reviews: z.unknown().nullable().optional(),
  last_reviews_sync: stringOrEmpty,
  phone_e164: stringOrEmpty,
  // Pricing + aggregate-rating fields (migration 0066). All optional —
  // only populated for fiches with editorially-sourced figures (e.g.
  // Airelles Gordes). Drive `Hotel.priceRange` / `Hotel.aggregateRating`
  // JSON-LD with explicit provenance so we never synthesise a score.
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
  // 0044 — Hero video (B8 — CDC §2 bloc 2). Optional jsonb mirroring `VideoObjectInput`.
  hero_video: z.unknown().nullable().optional(),
  // External identifiers & knowledge-graph anchors (migration 0025).
  // All optional — backfilled by `scripts/editorial-pilot/src/enrichment/enrich-wikidata-ids.ts`.
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
  // EEAT provenance (migration 0061 + Phase 1.5 backfill). Per-fact
  // provenance entries — `{ field, value, source, source_url,
  // confidence, collected_at }`. Surfaced by `readExternalSourcesProvenance`
  // for the public `<HotelExternalSourcesFooter>` (CDC §2 bloc 13bis).
  external_sources: z.unknown().nullable().optional(),
  // International support (migration 0033). FR for legacy rows; ISO-3166-1
  // alpha-2 for new intl entries. Country labels are denormalised so the UI
  // doesn't need a separate join.
  country_code: z
    .string()
    .length(2)
    .nullish()
    .transform((v) => v ?? 'FR'),
  country_label_fr: stringOrEmpty,
  country_label_en: stringOrEmpty,
  luxury_tier: stringOrEmpty,
  is_published: z.boolean(),
  updated_at: stringOrEmpty,
});

const HOTEL_COLUMNS =
  'id, slug, slug_en, name, name_en, stars, is_palace, region, department, city, district, address, postal_code, latitude, longitude, description_fr, description_en, factual_summary_fr, factual_summary_en, highlights, amenities, faq_content, faq_content_kit, concierge_questions, restaurant_info, spa_info, points_of_interest, transports, upcoming_events, policies, awards, affiliations, signature_experiences, concierge_advice, concierge_pick, concierge_hook, geo_qa, instagram, featured_reviews, hero_image, gallery_images, long_description_sections, number_of_rooms, number_of_suites, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en, booking_mode, amadeus_hotel_id, priority, google_rating, google_reviews_count, google_place_id, google_reviews, last_reviews_sync, phone_e164, telephone, price_range, price_from, aggregate_rating_value, aggregate_rating_count, aggregate_rating_source, opened_at, last_renovated_at, virtual_tour_url, mice_info, hero_video, wikidata_id, wikipedia_url_fr, wikipedia_url_en, tripadvisor_location_id, booking_com_hotel_id, expedia_property_id, hotels_com_hotel_id, agoda_hotel_id, official_url, email_reservations, commons_category, external_sameas, external_sources, country_code, country_label_fr, country_label_en, luxury_tier, is_published, updated_at';

/**
 * E.164 phone-number format: leading `+`, country code, 4-15 digits, no
 * separators. Mirrors the DB `hotels_phone_e164_ck` constraint.
 */
const E164_PHONE_REGEX = /^\+[1-9][0-9]{3,14}$/;

/**
 * Returns the row's phone number if it parses as a valid E.164, otherwise
 * `null`. We deliberately drop loose / partial entries (e.g. `+33 1 58 12`
 * with spaces — those should be re-typed as `+33158122888` before they
 * surface in JSON-LD or click-to-call URLs). The CHECK constraint at the
 * DB level enforces the same shape, this guard is the runtime safety
 * net for legacy rows pre-migration `0020`.
 */
export function readPhoneE164(row: HotelDetailRow): string | null {
  if (row.phone_e164 === null) return null;
  const trimmed = row.phone_e164.trim();
  if (trimmed.length === 0) return null;
  return E164_PHONE_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Loose postal-code validation — accepts French 5-digit codes plus DOM-TOM
 * (97xxx / 98xxx) and the typical EU shapes for future international
 * properties. Editorial mistakes (whitespace, accents) are normalized.
 */
const POSTAL_CODE_REGEX = /^[A-Z0-9][A-Z0-9 -]{2,9}[A-Z0-9]$/i;

/**
 * Returns the row's postal code if it parses, otherwise `null`. Whitespace
 * is trimmed so editorial entries copy/pasted with trailing spaces still
 * pass.
 */
export function readPostalCode(row: HotelDetailRow): string | null {
  if (row.postal_code === null) return null;
  const trimmed = row.postal_code.trim();
  if (trimmed.length === 0) return null;
  return POSTAL_CODE_REGEX.test(trimmed) ? trimmed : null;
}
