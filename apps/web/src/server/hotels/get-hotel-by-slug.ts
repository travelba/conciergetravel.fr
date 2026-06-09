import 'server-only';

import { parseAffiliationsLenient, type HotelAffiliation } from '@mch/db';
import { z } from 'zod';

import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { mergeRoomGalleryImages } from '@/lib/hotel/sort-room-display-images';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
import { isHotelIndexable } from '@/server/hotels/indexability';

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

export type HotelDetailRow = z.infer<typeof HotelDetailRowSchema>;

const HOTEL_COLUMNS =
  'id, slug, slug_en, name, name_en, stars, is_palace, region, department, city, district, address, postal_code, latitude, longitude, description_fr, description_en, factual_summary_fr, factual_summary_en, highlights, amenities, faq_content, restaurant_info, spa_info, points_of_interest, transports, upcoming_events, policies, awards, affiliations, signature_experiences, concierge_advice, concierge_pick, concierge_hook, geo_qa, instagram, featured_reviews, hero_image, gallery_images, long_description_sections, number_of_rooms, number_of_suites, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en, booking_mode, amadeus_hotel_id, priority, google_rating, google_reviews_count, google_place_id, google_reviews, last_reviews_sync, phone_e164, telephone, price_range, price_from, aggregate_rating_value, aggregate_rating_count, aggregate_rating_source, opened_at, last_renovated_at, virtual_tour_url, mice_info, hero_video, wikidata_id, wikipedia_url_fr, wikipedia_url_en, tripadvisor_location_id, booking_com_hotel_id, expedia_property_id, hotels_com_hotel_id, agoda_hotel_id, official_url, email_reservations, commons_category, external_sameas, external_sources, country_code, country_label_fr, country_label_en, luxury_tier, is_published, updated_at';

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

/**
 * External identifiers + knowledge-graph anchors (migration 0025).
 *
 * Surfaces to:
 *   - the JSON-LD `sameAs[]` array (Schema.org best-practice signal that
 *     anchors the hotel in the AI/agentic knowledge graph — Wikidata,
 *     Wikipedia, official website, social handles, OTA listings),
 *   - the `subjectOf[]` array (Article schema pointing at the Wikipedia
 *     and Commons gallery pages — strong EEAT signal),
 *   - the `additionalType` URL (Schema.org `Hotel` is too coarse; we
 *     point at the Wikidata QID so AI agents disambiguate the exact
 *     property — a "Cheval Blanc" can be the chain, the Courchevel
 *     fiche, or the Saint-Tropez fiche; only the QID is unambiguous),
 *   - the booking widget (email_reservations for booking_mode=email),
 *   - the price-comparator persisted fallback (booking_com_hotel_id,
 *     expedia_property_id, hotels_com_hotel_id — never exposed on the
 *     UI per addendum v3.2: no logos, no clickable refs).
 *
 * All values are passed through narrow validators so a corrupt DB row
 * (or an editor mistake reaching production) can never poison the
 * JSON-LD with a half-typed identifier.
 */
export interface HotelExternalIds {
  /** Wikidata QID — `Q1573604` etc. Source of truth for `additionalType`. */
  readonly wikidataId: string | null;
  /** French Wikipedia article URL — `subjectOf` + `sameAs`. */
  readonly wikipediaUrlFr: string | null;
  /** English Wikipedia article URL — `subjectOf` (en locale) + `sameAs`. */
  readonly wikipediaUrlEn: string | null;
  /** Official hotel website (HTTPS). Surfaces as `url` companion + `sameAs`. */
  readonly officialUrl: string | null;
  /** Reservation email — drives the `mailto:` CTA when booking_mode=email. */
  readonly emailReservations: string | null;
  /** Wikimedia Commons category — powers the photo-import pipeline. */
  readonly commonsCategory: string | null;
  /** TripAdvisor location ID — `sameAs` target (numeric). */
  readonly tripadvisorLocationId: string | null;
  /** Booking.com hotel slug — comparator only, never UI. */
  readonly bookingComHotelId: string | null;
  /** Expedia numeric property ID — comparator only, never UI. */
  readonly expediaPropertyId: string | null;
  /** Hotels.com numeric hotel ID — comparator only, never UI. */
  readonly hotelsComHotelId: string | null;
  /** Agoda numeric hotel ID — comparator only, never UI. */
  readonly agodaHotelId: string | null;
  /** Wikipedia Commons category gallery URL — derived from `commonsCategory`. */
  readonly commonsGalleryUrl: string | null;
  /** TripAdvisor location URL — derived from `tripadvisorLocationId`. */
  readonly tripadvisorUrl: string | null;
  /**
   * Social and press links surfaced as JSON-LD `sameAs[]`. Already
   * filtered to HTTPS-only entries and limited to known platforms
   * ({@link KNOWN_SAMEAS_KEYS}). Any other key in the DB is silently
   * dropped at the reader so a typo never leaks to a public payload.
   */
  readonly sameAs: readonly string[];
  /**
   * Knowledge-graph facts extracted from Wikidata (`external_sameas`
   * blob): inception year, architect names, heritage designations,
   * Mérimée ID, Google Maps CID. Surfaces in the press kit + sidebar.
   */
  readonly knowledgeGraph: {
    readonly inceptionYear: number | null;
    readonly architects: readonly string[];
    readonly heritageDesignations: readonly string[];
    readonly merimeeId: string | null;
    readonly googleMapsCid: string | null;
  };
}

const EXT_HTTPS_URL_REGEX = /^https:\/\/[^\s<>]+$/iu;
const EXT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const QID_REGEX = /^Q[1-9][0-9]*$/u;
const NUMERIC_ID_REGEX = /^[0-9]+$/u;
const SLUG_ID_REGEX = /^[a-z0-9-]+$/u;

/** Whitelisted `sameAs` platforms (skill: security-engineering — no
 *  open redirect via arbitrary external_sameas keys). Order matters:
 *  the JSON-LD builder emits the array in this order so Wikidata /
 *  Wikipedia (the strongest authority signals) lead. */
const KNOWN_SAMEAS_KEYS = [
  'twitter',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'pinterest',
  'tiktok',
  'michelin',
  'tablet',
  'lhw',
  'virtuoso',
  'forbes',
  'condenast',
] as const;

function takeStringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function safeHttps(v: unknown): string | null {
  const s = takeStringOrNull(v);
  if (s === null) return null;
  return EXT_HTTPS_URL_REGEX.test(s) ? s : null;
}

export function readExternalIds(row: HotelDetailRow): HotelExternalIds {
  const wikidataRaw = takeStringOrNull(row.wikidata_id);
  const wikidataId = wikidataRaw !== null && QID_REGEX.test(wikidataRaw) ? wikidataRaw : null;

  const wikipediaUrlFr = safeHttps(row.wikipedia_url_fr);
  const wikipediaUrlEn = safeHttps(row.wikipedia_url_en);
  const officialUrl = safeHttps(row.official_url);

  const emailRaw = takeStringOrNull(row.email_reservations);
  const emailReservations = emailRaw !== null && EXT_EMAIL_REGEX.test(emailRaw) ? emailRaw : null;

  const commonsCategory = takeStringOrNull(row.commons_category);
  const commonsGalleryUrl =
    commonsCategory !== null
      ? `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(commonsCategory).replace(/%20/g, '_')}`
      : null;

  const tripadvisorRaw = takeStringOrNull(row.tripadvisor_location_id);
  const tripadvisorLocationId =
    tripadvisorRaw !== null && NUMERIC_ID_REGEX.test(tripadvisorRaw) ? tripadvisorRaw : null;
  const tripadvisorUrl =
    tripadvisorLocationId !== null
      ? `https://www.tripadvisor.com/Hotel_Review-d${tripadvisorLocationId}`
      : null;

  const bookingRaw = takeStringOrNull(row.booking_com_hotel_id);
  const bookingComHotelId =
    bookingRaw !== null && SLUG_ID_REGEX.test(bookingRaw) ? bookingRaw : null;
  const expediaRaw = takeStringOrNull(row.expedia_property_id);
  const expediaPropertyId =
    expediaRaw !== null && NUMERIC_ID_REGEX.test(expediaRaw) ? expediaRaw : null;
  const hotelsComRaw = takeStringOrNull(row.hotels_com_hotel_id);
  const hotelsComHotelId =
    hotelsComRaw !== null && NUMERIC_ID_REGEX.test(hotelsComRaw) ? hotelsComRaw : null;
  const agodaRaw = takeStringOrNull(row.agoda_hotel_id);
  const agodaHotelId = agodaRaw !== null && NUMERIC_ID_REGEX.test(agodaRaw) ? agodaRaw : null;

  // ── Knowledge-graph + sameAs blob ──────────────────────────────────────
  const sameAsList: string[] = [];
  if (wikidataId !== null) sameAsList.push(`https://www.wikidata.org/wiki/${wikidataId}`);
  if (wikipediaUrlFr !== null) sameAsList.push(wikipediaUrlFr);
  if (wikipediaUrlEn !== null) sameAsList.push(wikipediaUrlEn);
  if (officialUrl !== null) sameAsList.push(officialUrl);

  let inceptionYear: number | null = null;
  const architects: string[] = [];
  const heritageDesignations: string[] = [];
  let merimeeId: string | null = null;
  let googleMapsCid: string | null = null;

  const blob = row.external_sameas;
  if (blob !== null && blob !== undefined && typeof blob === 'object' && !Array.isArray(blob)) {
    const dict = blob as Record<string, unknown>;
    for (const key of KNOWN_SAMEAS_KEYS) {
      const u = safeHttps(dict[key]);
      if (u !== null) sameAsList.push(u);
    }
    const yr = dict['inception_year'];
    if (typeof yr === 'number' && Number.isFinite(yr) && yr >= 1500 && yr <= 2100) {
      inceptionYear = Math.trunc(yr);
    }
    const archs = dict['architects'];
    if (Array.isArray(archs)) {
      for (const a of archs) {
        const s = takeStringOrNull(a);
        if (s !== null && architects.length < 6) architects.push(s);
      }
    }
    const heritages = dict['heritage_designations'];
    if (Array.isArray(heritages)) {
      for (const h of heritages) {
        const s = takeStringOrNull(h);
        if (s !== null && heritageDesignations.length < 4) heritageDesignations.push(s);
      }
    }
    const merimee = takeStringOrNull(dict['merimee_id']);
    if (merimee !== null) merimeeId = merimee;
    const cid = takeStringOrNull(dict['google_maps_cid']);
    if (cid !== null && NUMERIC_ID_REGEX.test(cid)) googleMapsCid = cid;
  }

  if (tripadvisorUrl !== null) sameAsList.push(tripadvisorUrl);
  if (commonsGalleryUrl !== null) sameAsList.push(commonsGalleryUrl);
  if (merimeeId !== null) {
    sameAsList.push(`https://www.pop.culture.gouv.fr/notice/merimee/${merimeeId}`);
  }
  if (googleMapsCid !== null) {
    sameAsList.push(`https://maps.google.com/?cid=${googleMapsCid}`);
  }

  // De-dupe (some hotels have official_url == wikipedia_url_fr for chains)
  const sameAs = [...new Set(sameAsList)];

  return {
    wikidataId,
    wikipediaUrlFr,
    wikipediaUrlEn,
    officialUrl,
    emailReservations,
    commonsCategory,
    tripadvisorLocationId,
    bookingComHotelId,
    expediaPropertyId,
    hotelsComHotelId,
    agodaHotelId,
    commonsGalleryUrl,
    tripadvisorUrl,
    sameAs,
    knowledgeGraph: {
      inceptionYear,
      architects,
      heritageDesignations,
      merimeeId,
      googleMapsCid,
    },
  };
}

/** Canonical Google Maps deep link from a Places API `place_id`. */
export function buildGoogleMapsPlaceUrl(placeId: string): string {
  const id = placeId.startsWith('places/') ? placeId.slice('places/'.length) : placeId;
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(id)}`;
}

export interface HotelGoogleAccess {
  readonly officialUrl: string | null;
  readonly googleMapsUrl: string | null;
}

/**
 * Official website + Google Maps / Business Profile link for #acces.
 * Prefers `google_place_id` over legacy `external_sameas.google_maps_cid`.
 */
export function readGoogleAccess(row: HotelDetailRow): HotelGoogleAccess {
  const externalIds = readExternalIds(row);
  const placeIdRaw = takeStringOrNull(row.google_place_id);
  let googleMapsUrl: string | null = null;
  if (placeIdRaw !== null && placeIdRaw.length > 0) {
    googleMapsUrl = buildGoogleMapsPlaceUrl(placeIdRaw);
  } else if (externalIds.knowledgeGraph.googleMapsCid !== null) {
    googleMapsUrl = `https://maps.google.com/?cid=${externalIds.knowledgeGraph.googleMapsCid}`;
  }
  return {
    officialUrl: externalIds.officialUrl,
    googleMapsUrl,
  };
}

const StoredGoogleReviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  publish_time: z.string().optional(),
  language: z.string().optional(),
});

export interface LocalisedGoogleReview {
  readonly author: string;
  readonly rating: number;
  readonly text: string;
  readonly publishTime: string | null;
}

/** Parses cached `google_reviews` jsonb synced from Google Places. */
export function readGoogleReviews(
  row: HotelDetailRow,
  _locale: SupportedLocale,
): readonly LocalisedGoogleReview[] {
  const raw = row.google_reviews;
  if (raw === null || raw === undefined || !Array.isArray(raw)) return [];
  const out: LocalisedGoogleReview[] = [];
  for (const entry of raw) {
    const parsed = StoredGoogleReviewSchema.safeParse(entry);
    if (!parsed.success) continue;
    out.push({
      author: parsed.data.author,
      rating: parsed.data.rating,
      text: parsed.data.text,
      publishTime: parsed.data.publish_time ?? null,
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** Whether #acces should render Google traveler reviews instead of editorial fallbacks. */
export function hasGoogleTravelerReviews(row: HotelDetailRow): boolean {
  if (readGoogleReviews(row, 'fr').length > 0) return true;
  return (
    row.google_rating !== null && row.google_reviews_count !== null && row.google_reviews_count > 0
  );
}

/**
 * Editorial opening / last-renovation dates (CDC §2.4 + §2.15).
 *
 * The DB stores full `date` values (CHECK-bounded between 1500-01-01 and
 * `current_date`, and `last_renovated_at >= opened_at` when both are set
 * — see migration `0022_hotel_dates_columns.sql`). The page only renders
 * the years; the JSON-LD builder maps `openedYear` to Schema.org
 * `foundingDate` as a bare `YYYY` string (which Google's hotel
 * rich-result validator accepts).
 *
 * We rely on the DB constraints rather than re-validating ranges here.
 * Defensive parsing only catches:
 *   - non-ISO inputs (string came back malformed from PostgREST),
 *   - empty strings (which `stringOrEmpty` already normalised to `null`),
 *   - years outside a sane editorial range (1500-current_year + 1) — a
 *     belt-and-braces guard for legacy rows pre-CHECK constraint.
 */
export interface HotelHistoryDates {
  readonly openedDate: string | null;
  readonly openedYear: number | null;
  readonly lastRenovatedDate: string | null;
  readonly lastRenovatedYear: number | null;
}

const EDITORIAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseEditorialDate(
  raw: string | null,
): { readonly iso: string; readonly year: number } | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const match = EDITORIAL_DATE_REGEX.exec(trimmed);
  if (match === null) return null;
  const yearString = match[1];
  if (yearString === undefined) return null;
  const year = Number.parseInt(yearString, 10);
  if (!Number.isFinite(year)) return null;
  // Sanity envelope — well beyond the DB CHECK but cheap.
  const currentYear = new Date().getUTCFullYear();
  if (year < 1500 || year > currentYear + 1) return null;
  return { iso: trimmed, year };
}

export function readHotelHistoryDates(row: HotelDetailRow): HotelHistoryDates {
  const opened = parseEditorialDate(row.opened_at);
  const renovated = parseEditorialDate(row.last_renovated_at);
  return {
    openedDate: opened?.iso ?? null,
    openedYear: opened?.year ?? null,
    lastRenovatedDate: renovated?.iso ?? null,
    lastRenovatedYear: renovated?.year ?? null,
  };
}

/**
 * Virtual / 360° tour URL (Phase 11.4 — CDC §2 bloc 2 polish).
 *
 * The DB CHECK constraint in migration `0023_hotel_virtual_tour.sql`
 * already restricts the host to `my.matterport.com` or `kuula.co` and
 * enforces a 512-char ceiling. We re-validate at read time as a
 * belt-and-braces guard against:
 *
 *   - rows written before the CHECK constraint existed,
 *   - rows imported via direct UPSERTs that bypass the trigger (the
 *     constraint catches those, but defensive parsing keeps the page
 *     working even when a corrupt row sneaks past),
 *   - Cypress / E2E fixtures that intentionally inject bad data to
 *     exercise the fallback path.
 *
 * The set of allowed hosts MUST stay in lockstep with the CSP
 * `frame-src` allowlist in `apps/web/src/lib/security/csp.ts` and the
 * SQL CHECK regex — three places, one truth: "Matterport + Kuula".
 *
 * Returns `null` on any mismatch (rather than throwing) so a single
 * malformed editorial entry never tanks the route.
 */
export type VirtualTourProvider = 'matterport' | 'kuula';

export interface HotelVirtualTour {
  readonly url: string;
  readonly provider: VirtualTourProvider;
}

const ALLOWED_VIRTUAL_TOUR_HOSTS: Readonly<Record<string, VirtualTourProvider>> = {
  'my.matterport.com': 'matterport',
  'kuula.co': 'kuula',
};

export function readVirtualTour(row: HotelDetailRow): HotelVirtualTour | null {
  if (row.virtual_tour_url === null) return null;
  const raw = row.virtual_tour_url.trim();
  if (raw.length === 0 || raw.length > 512) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  // Disallow user-info or non-default ports — both can be used to
  // smuggle a malicious endpoint into an otherwise-trusted host.
  if (url.username.length > 0 || url.password.length > 0) return null;
  if (url.port.length > 0 && url.port !== '443') return null;
  const provider = ALLOWED_VIRTUAL_TOUR_HOSTS[url.hostname];
  if (provider === undefined) return null;
  return { url: url.toString(), provider };
}

// ---------------------------------------------------------------------------
// MICE — Meetings, Incentives, Conferences, Events (Phase 11.5 — CDC §2.14)
// ---------------------------------------------------------------------------

/**
 * Stable identifier grammar for a MICE space — lowercase kebab,
 * 2-48 chars. Used as React key and as anchor when a brochure
 * deep-links into a single space.
 */
const MICE_SPACE_KEY_REGEX = /^[a-z][a-z0-9-]{1,47}$/;

/**
 * Standard event-space layout terms recognised by the industry
 * (UFI / ICCA classifications). Editorial entries outside this set
 * are dropped at parse time rather than rendered as raw strings
 * because UI uses the discriminator to pick an icon / localisation.
 */
export const MICE_CONFIGURATIONS = [
  'theatre',
  'classroom',
  'u-shape',
  'boardroom',
  'banquet',
  'cocktail',
] as const;
export type MiceConfiguration = (typeof MICE_CONFIGURATIONS)[number];
const MiceConfigurationSchema = z.enum(MICE_CONFIGURATIONS);

/**
 * Event types a property hosts. The set is intentionally narrow
 * (six values) — wider taxonomies fragment the UI without giving
 * planners any extra signal, and the seeds collapse 95 % of
 * editorial intent onto these six.
 */
export const MICE_EVENT_TYPES = [
  'corporate-meeting',
  'wedding',
  'gala-dinner',
  'press-launch',
  'incentive',
  'private-screening',
] as const;
export type MiceEventType = (typeof MICE_EVENT_TYPES)[number];
const MiceEventTypeSchema = z.enum(MICE_EVENT_TYPES);

/**
 * Loose RFC-5322-ish e-mail validator. Mirrors the contract enforced
 * by the rest of the codebase (Brevo + Supabase Auth both validate
 * server-side too); we keep the regex permissive to avoid bouncing
 * editorial entries with legitimate `+aliases` or sub-domain MX.
 */
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const EmailSchema = z.string().max(254).regex(EMAIL_REGEX, { message: 'invalid e-mail' });

/**
 * HTTPS-only URL with a 2048-char ceiling — reused from the spirit
 * of the awards / featured-reviews validators below. Bounded length
 * prevents stuffed tracking garbage from leaking into the brochure
 * link.
 */
const HttpsBrochureUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith('https://'), { message: 'brochure url must be https' });

const MiceSpaceSchema = z.object({
  key: z.string().regex(MICE_SPACE_KEY_REGEX, { message: 'expected lowercase kebab key' }),
  name: z.string().min(1).max(120),
  surface_sqm: z.number().int().positive().max(50000),
  max_seated: z.number().int().positive().max(10000),
  configurations: z.array(MiceConfigurationSchema).min(1).optional(),
  has_natural_light: z.boolean().optional(),
  notes_fr: z.string().min(1).max(400).optional(),
  notes_en: z.string().min(1).max(400).optional(),
});

const MiceInfoSchema = z.object({
  summary_fr: z.string().min(1).max(400).optional(),
  summary_en: z.string().min(1).max(400).optional(),
  contact_email: EmailSchema,
  brochure_url: HttpsBrochureUrlSchema.optional(),
  total_capacity_seated: z.number().int().positive().max(10000),
  max_room_height_m: z.number().positive().max(50).optional(),
  spaces: z.array(MiceSpaceSchema).min(1).max(40),
  event_types: z.array(MiceEventTypeSchema).min(1).max(10).optional(),
});

export interface LocalisedMiceSpace {
  readonly key: string;
  readonly name: string;
  readonly surfaceSqm: number;
  readonly maxSeated: number;
  readonly configurations: readonly MiceConfiguration[];
  readonly hasNaturalLight: boolean;
  readonly notes: string | null;
}

export interface LocalisedMiceInfo {
  readonly summary: string | null;
  readonly contactEmail: string;
  readonly brochureUrl: string | null;
  readonly totalCapacitySeated: number;
  readonly maxRoomHeightM: number | null;
  readonly spaces: readonly LocalisedMiceSpace[];
  readonly eventTypes: readonly MiceEventType[];
}

/**
 * Localized MICE offer for the hotel detail page (CDC §2.14).
 *
 * Returns `null` whenever the raw payload fails the Zod schema —
 * any single malformed entry (e.g. negative `max_seated`, wrong
 * email shape) drops the whole offer rather than partially-render
 * a misleading section. Editorial errors land as a missing section
 * which the UI self-elides.
 *
 * The shape is mirrored 1:1 in the Payload admin field
 * (`apps/admin/src/collections/hotels.ts`) so the editorial JSON
 * input matches what the page expects.
 */
export function readMiceInfo(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedMiceInfo | null {
  const parsed = MiceInfoSchema.safeParse(row.mice_info);
  if (!parsed.success) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[readMiceInfo] parse error', parsed.error.flatten().fieldErrors);
    }
    return null;
  }
  const p = parsed.data;

  return {
    summary: pickLocalizedText(locale, p.summary_fr, p.summary_en),
    contactEmail: p.contact_email,
    brochureUrl: p.brochure_url ?? null,
    totalCapacitySeated: p.total_capacity_seated,
    maxRoomHeightM: p.max_room_height_m ?? null,
    spaces: p.spaces.map((s) => ({
      key: s.key,
      name: s.name,
      surfaceSqm: s.surface_sqm,
      maxSeated: s.max_seated,
      configurations: s.configurations ?? [],
      hasNaturalLight: s.has_natural_light === true,
      notes: pickLocalizedText(locale, s.notes_fr, s.notes_en),
    })),
    eventTypes: p.event_types ?? [],
  };
}

/**
 * Inventory counts (Schema.org `Hotel.numberOfRooms` + editorial suite count).
 *
 * Both fields are typed `number | null` in the row schema already — this
 * tiny indirection exists so the caller can spread `{ ...readInventoryCounts(row) }`
 * onto a JSON-LD input without rewriting the conditional. We pin
 * `totalRooms` to a positive integer (drops 0/NaN defensively even though
 * the DB CHECK forbids them) and pin `suites` to non-negative.
 */
export interface HotelInventoryCounts {
  readonly totalRooms: number | null;
  readonly suites: number | null;
}

/**
 * Long-form story section (CDC §2.4). Each entry maps 1:1 to an
 * `<h3 id="{anchor}">` + body paragraphs on the public hotel page.
 *
 *   - `anchor` is the URL-safe slug used both for the `<h3 id>` and
 *     for the table of contents link. Must be lowercase, kebab-cased.
 *   - `title_*` and `body_*` are required per locale, but we accept
 *     locale-only entries (e.g. French-only seed for legacy hotels).
 *   - `body_*` accepts CRLF or LF and is split on blank lines to
 *     render multi-paragraph bodies.
 *
 * We intentionally do NOT accept inline markdown in `body_*`; the
 * structured `title + body` already covers 95% of editorial needs
 * and we avoid shipping a markdown parser. A future migration could
 * widen the schema with a `format: 'plain' | 'markdown'` discriminator.
 */
const ANCHOR_REGEX = /^[a-z][a-z0-9-]{1,40}$/;
const LongDescriptionSectionSchema = z.object({
  anchor: z.string().regex(ANCHOR_REGEX, { message: 'expected lowercase kebab anchor' }),
  title_fr: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  body_fr: z.string().min(1).optional(),
  body_en: z.string().min(1).optional(),
});
const LongDescriptionSectionsSchema = z.array(LongDescriptionSectionSchema);

export interface LocalisedHotelStorySection {
  readonly anchor: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/**
 * Returns the hotel's long-form story as an ordered list of localised
 * sections. Falls back to the other locale when a per-section
 * translation is missing, and drops sections that have neither a
 * title nor a body to show.
 */
export function readHotelStory(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedHotelStorySection[] {
  const parsed = LongDescriptionSectionsSchema.safeParse(row.long_description_sections);
  if (!parsed.success) return [];

  const out: LocalisedHotelStorySection[] = [];
  for (const section of parsed.data) {
    const title = pickLocalizedText(locale, section.title_fr, section.title_en);
    const body = pickLocalizedText(locale, section.body_fr, section.body_en);
    if (title === null || body === null) continue;
    const paragraphs = body
      .split(/\r?\n\r?\n+/u)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) continue;
    out.push({ anchor: section.anchor, title, paragraphs });
  }
  return out;
}

export function readInventoryCounts(row: HotelDetailRow): HotelInventoryCounts {
  const totalRooms =
    row.number_of_rooms !== null && Number.isInteger(row.number_of_rooms) && row.number_of_rooms > 0
      ? row.number_of_rooms
      : null;
  const suites =
    row.number_of_suites !== null &&
    Number.isInteger(row.number_of_suites) &&
    row.number_of_suites >= 0
      ? row.number_of_suites
      : null;
  return { totalRooms, suites };
}

/** A FAQ item that may appear under `hotels.faq_content`. */
/**
 * FAQ buckets for intent-based grouping on the public hotel page
 * (CDC §2.11). Mapping rationale:
 *
 *   - `before` — pre-stay logistics: address, transport from airport,
 *     pet policy, room categories, pricing range, dress code, etc.
 *     This is the bucket most travel searchers care about pre-click.
 *   - `during` — in-stay services: spa hours, breakfast service,
 *     pool, restaurant reservations, concierge desk hours.
 *   - `after` — post-stay: cancellation, modification, loyalty
 *     redemption, invoice / VAT, lost & found.
 *   - `agency` — property-level facts that are stable regardless of
 *     the booking lifecycle: palace distinction, history, official
 *     awards, ownership.
 *
 * Untagged entries fall into `before` (the historical bucket).
 */
export const FAQ_CATEGORIES = ['before', 'during', 'after', 'agency'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
const FaqCategorySchema = z.enum(FAQ_CATEGORIES);

export const FaqItemSchema = z.object({
  question_fr: z.string().min(1).optional(),
  question_en: z.string().min(1).optional(),
  answer_fr: z.string().min(1).optional(),
  answer_en: z.string().min(1).optional(),
  category: FaqCategorySchema.optional(),
  // ---------------------------------------------------------------------
  // Concierge-voice extension (WS5 phase 4, jsonb compatible — all fields
  // OPTIONAL so legacy rows still parse).
  //
  //   - `featured: true` lifts the Q&A into the "Top 5 réponses du Concierge"
  //     visible block (component `<TopConciergeFaq>`). The humanizer caps
  //     featured items at 5 per hotel; the reader (`readTopConciergeFaq`)
  //     also trims to 5 defensively.
  //   - `concierge_tip_fr / _en` is an OPTIONAL one-liner ("Mon conseil :
  //     …") that the UI surfaces under the answer. Only set on the 1-2
  //     answers that genuinely lend themselves to a contextual tip.
  // ---------------------------------------------------------------------
  featured: z.boolean().optional(),
  concierge_tip_fr: z.string().min(1).optional(),
  concierge_tip_en: z.string().min(1).optional(),
});
export type FaqItem = z.infer<typeof FaqItemSchema>;

const FaqContentSchema = z.array(FaqItemSchema);

export interface LocalisedFaq {
  readonly question: string;
  readonly answer: string;
  readonly category: FaqCategory;
  /** Lifted into the Top Concierge block when true (WS5 phase 4). */
  readonly featured: boolean;
  /** Optional Concierge tip surfaced under the answer ("Mon conseil : …"). */
  readonly conciergeTip: string | null;
}

export interface LocalisedFaqGroup {
  readonly category: FaqCategory;
  readonly items: readonly LocalisedFaq[];
}

/** Extracts a list of strings from a jsonb field that may be a string[] or object[]. */
function readStringList(raw: unknown, locale: SupportedLocale): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry.trim());
      continue;
    }
    if (entry !== null && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const candidates = pickByLocale<readonly string[]>(
        locale,
        ['label_fr', 'name_fr', 'label', 'name'],
        ['label_en', 'name_en', 'label', 'name'],
      );
      for (const k of candidates) {
        const v = e[k];
        if (typeof v === 'string' && v.trim().length > 0) {
          out.push(v.trim());
          break;
        }
      }
    }
  }
  return out;
}

export function readHighlights(row: HotelDetailRow, locale: SupportedLocale): readonly string[] {
  return readStringList(row.highlights, locale);
}

export function readAmenities(row: HotelDetailRow, locale: SupportedLocale): readonly string[] {
  return readStringList(row.amenities, locale);
}

// ---------------------------------------------------------------------------
// amenities — typed view (CDC §2 bloc 7)
// ---------------------------------------------------------------------------

/** A single amenity preserved with its raw `key` so the UI can categorize / style it. */
export interface LocalisedAmenityEntry {
  /** Stable identifier (see `amenity-taxonomy.ts`). Falls back to a slugified label. */
  readonly key: string;
  /** Localized label shown to the guest. */
  readonly label: string;
  /** Whether this amenity should get the "premium" emphasis. */
  readonly isPremium: boolean;
}

/** Amenities grouped by category, with deterministic ordering. */
export interface LocalisedAmenityGroup {
  readonly category: AmenityCategory;
  readonly entries: readonly LocalisedAmenityEntry[];
}

/**
 * Best-effort kebab-case fallback for amenities that arrive without a `key`
 * (legacy editorial). Mirrors the slug grammar so the result is safe to
 * re-emit anywhere a key is expected.
 */
function slugifyForKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Returns amenities preserving the raw `key` (when present) so the caller
 * can apply taxonomy logic. Same input shape as `readAmenities`, but
 * lossless w.r.t. the structured `{ key, label_fr, label_en }` form.
 */
function readAmenityEntries(
  raw: unknown,
  locale: SupportedLocale,
): readonly LocalisedAmenityEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LocalisedAmenityEntry[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      const label = entry.trim();
      out.push({ key: slugifyForKey(label), label, isPremium: false });
      continue;
    }
    if (entry === null || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const labelCandidates = pickByLocale<readonly string[]>(
      locale,
      ['label_fr', 'name_fr', 'label', 'name'],
      ['label_en', 'name_en', 'label', 'name'],
    );
    let label: string | null = null;
    for (const k of labelCandidates) {
      const v = e[k];
      if (typeof v === 'string' && v.trim().length > 0) {
        label = v.trim();
        break;
      }
    }
    if (label === null) continue;
    const rawKey = e['key'];
    const key = typeof rawKey === 'string' && rawKey.length > 0 ? rawKey : slugifyForKey(label);
    out.push({ key, label, isPremium: isPremiumAmenity(key) });
  }
  return out;
}

/**
 * Group amenities by canonical category. Empty groups are dropped, so the
 * UI never renders an empty `<h3>` section.
 *
 * Categories are presented in the order declared by `AMENITY_CATEGORIES`;
 * within a category, the entries are ordered by `amenityOrder(key)` then
 * by their label (stable Unicode sort).
 */
export function readAmenitiesByCategory(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedAmenityGroup[] {
  const entries = readAmenityEntries(row.amenities, locale);
  if (entries.length === 0) return [];

  const buckets = new Map<AmenityCategory, LocalisedAmenityEntry[]>();
  for (const entry of entries) {
    const cat = categorizeAmenity(entry.key);
    const arr = buckets.get(cat) ?? [];
    arr.push(entry);
    buckets.set(cat, arr);
  }

  // `localeCompare`'s `locales` argument accepts any 2-letter ISO code or
  // BCP-47 tag. Passing `locale` directly gives DE/ES/IT proper native
  // collation instead of forcing a French fallback when the user is on
  // a /de/, /es/ or /it/ route.
  const localeCmp: SupportedLocale = locale;
  const groups: LocalisedAmenityGroup[] = [];
  for (const cat of AMENITY_CATEGORIES) {
    const arr = buckets.get(cat);
    if (arr === undefined || arr.length === 0) continue;
    const sorted = [...arr].sort((a, b) => {
      const oa = amenityOrder(a.key);
      const ob = amenityOrder(b.key);
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label, localeCmp);
    });
    groups.push({ category: cat, entries: sorted });
  }

  // Defensive: `categoryOrder` is also exported so callers can re-sort if
  // they ever build groups outside this helper. We assert here that the
  // produced array is consistent with that helper to keep both code paths
  // honest (it costs ~O(n) at most).
  return groups.sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

export function readFaq(row: HotelDetailRow, locale: SupportedLocale): readonly LocalisedFaq[] {
  const parsed = FaqContentSchema.safeParse(row.faq_content);
  if (!parsed.success) return [];
  const out: LocalisedFaq[] = [];
  for (const item of parsed.data) {
    const q = pickLocalizedText(locale, item.question_fr, item.question_en);
    const a = pickLocalizedText(locale, item.answer_fr, item.answer_en);
    if (q === null || a === null) continue;
    const tipRaw = pickLocalizedText(locale, item.concierge_tip_fr, item.concierge_tip_en);
    const tip = typeof tipRaw === 'string' && tipRaw.trim().length > 0 ? tipRaw.trim() : null;
    out.push({
      question: q,
      answer: a,
      category: item.category ?? 'before',
      featured: item.featured === true,
      conciergeTip: tip,
    });
  }
  return out;
}

/**
 * Returns up to 5 FAQ items marked `featured: true` — the "Top 5
 * réponses du Concierge" visible block (ADR-0011 C1, WS5 phase 4).
 *
 * Order is the source array order (Payload / humanizer-controlled);
 * the cap of 5 is defensive in case the humanizer ever marks more
 * than 5 (the LLM is instructed to mark exactly 5, but production
 * data should never crash a page).
 *
 * Returns `[]` when no item is featured — the caller should not
 * render the block in that case (component already self-elides on
 * `length < 5`, falling back to the standard `<HotelFaq>`).
 */
export function readTopConciergeFaq(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedFaq[] {
  const all = readFaq(row, locale);
  const featured = all.filter((f) => f.featured);
  return featured.slice(0, 5);
}

/**
 * Groups the FAQ entries by intent bucket (CDC §2.11). The order of
 * the returned groups follows `FAQ_CATEGORIES` (`before`, `during`,
 * `after`, `agency`) — a deliberate pre-stay-first ranking that
 * mirrors the average traveller's mental model. Buckets with zero
 * items are omitted.
 *
 * We preserve the in-bucket order from the source (Payload editorial
 * sort, which is array-position) — alphabetising would scramble
 * questions designed to flow narratively ("Is breakfast included?"
 * before "What time is breakfast served?").
 */
export function readFaqByCategory(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedFaqGroup[] {
  const flat = readFaq(row, locale);
  if (flat.length === 0) return [];
  const buckets = new Map<FaqCategory, LocalisedFaq[]>();
  for (const cat of FAQ_CATEGORIES) {
    buckets.set(cat, []);
  }
  for (const item of flat) {
    buckets.get(item.category)?.push(item);
  }
  const groups: LocalisedFaqGroup[] = [];
  for (const cat of FAQ_CATEGORIES) {
    const items = buckets.get(cat);
    if (items !== undefined && items.length > 0) {
      groups.push({ category: cat, items });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// restaurant_info — F&B venues (hotels.restaurant_info jsonb)
// ---------------------------------------------------------------------------

const RestaurantVenueSchema = z.object({
  name: z.string().min(1),
  type_fr: z.string().min(1).optional(),
  type_en: z.string().min(1).optional(),
  michelin_stars: z.number().int().min(0).max(3).optional(),
  chef: z.string().min(1).optional(),
  pastry_chef: z.string().min(1).optional(),
  sommelier: z.string().min(1).optional(),
  since: z.number().int().optional(),
  michelin_since: z.number().int().optional(),
  features: z.array(z.string().min(1)).optional(),
  hours_fr: z.string().min(1).optional(),
  hours_en: z.string().min(1).optional(),
  // ── "Concierge handoff" practical block (golden-template extension) ──
  // Each cited venue carries the same info a concierge would email a
  // guest: website, reservation link, phone, address, opening hours,
  // an indicative price note and a one-line concierge tip. All optional
  // so existing rows stay valid; the UI renders only populated fields.
  website: z.string().url().optional(),
  reservation_url: z.string().url().optional(),
  phone: z.string().min(1).max(40).optional(),
  address: z.string().min(1).max(200).optional(),
  price_note_fr: z.string().min(1).max(200).optional(),
  price_note_en: z.string().min(1).max(200).optional(),
  // "Quel plat / dessert commander" — the one concierge recommendation a
  // guest acts on. Short, concrete (a named dish or dessert), bilingual.
  must_order_fr: z.string().min(1).max(200).optional(),
  must_order_en: z.string().min(1).max(200).optional(),
  /** Editorial card body (kit DA `.resto-body > p`). Distinct from `tip_*` (cc-why). */
  description_fr: z.string().min(1).max(500).optional(),
  description_en: z.string().min(1).max(500).optional(),
  // Whether the venue is suitable for children (high chairs, kids menu,
  // relaxed setting). `true` shows a "famille bienvenue" badge.
  kid_friendly: z.boolean().optional(),
  tip_fr: z.string().min(1).max(400).optional(),
  tip_en: z.string().min(1).max(400).optional(),
});

const RestaurantInfoSchema = z.object({
  count: z.number().int().min(0).optional(),
  michelin_stars: z.number().int().min(0).optional(),
  venues: z.array(RestaurantVenueSchema).min(1),
});

export interface LocalisedRestaurantVenue {
  readonly name: string;
  readonly type: string | null;
  readonly michelinStars: number | null;
  readonly chef: string | null;
  readonly pastryChef: string | null;
  readonly sommelier: string | null;
  readonly since: number | null;
  readonly michelinSince: number | null;
  readonly features: readonly string[];
  readonly hours: string | null;
  readonly website: string | null;
  readonly reservationUrl: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly priceNote: string | null;
  readonly mustOrder: string | null;
  readonly description: string | null;
  readonly kidFriendly: boolean | null;
  readonly tip: string | null;
}

export interface LocalisedRestaurants {
  readonly count: number | null;
  readonly michelinStars: number | null;
  readonly venues: readonly LocalisedRestaurantVenue[];
}

export function readRestaurants(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedRestaurants | null {
  const parsed = RestaurantInfoSchema.safeParse(row.restaurant_info);
  if (!parsed.success) return null;
  const venues: LocalisedRestaurantVenue[] = parsed.data.venues.map((v) => ({
    name: v.name,
    type: pickLocalizedText(locale, v.type_fr, v.type_en),
    michelinStars: v.michelin_stars ?? null,
    chef: v.chef ?? null,
    pastryChef: v.pastry_chef ?? null,
    sommelier: v.sommelier ?? null,
    since: v.since ?? null,
    michelinSince: v.michelin_since ?? null,
    features: v.features ?? [],
    hours: pickLocalizedText(locale, v.hours_fr, v.hours_en),
    website: v.website ?? null,
    reservationUrl: v.reservation_url ?? null,
    phone: v.phone ?? null,
    address: v.address ?? null,
    priceNote: pickLocalizedText(locale, v.price_note_fr, v.price_note_en),
    mustOrder: pickLocalizedText(locale, v.must_order_fr, v.must_order_en),
    description: pickLocalizedText(locale, v.description_fr, v.description_en),
    kidFriendly: v.kid_friendly ?? null,
    tip: pickLocalizedText(locale, v.tip_fr, v.tip_en),
  }));
  return {
    count: parsed.data.count ?? null,
    michelinStars: parsed.data.michelin_stars ?? null,
    venues,
  };
}

// ---------------------------------------------------------------------------
// spa_info — Spa/wellness venue (hotels.spa_info jsonb)
// ---------------------------------------------------------------------------

const SpaInfoSchema = z.object({
  name: z.string().min(1),
  surface_sqm: z.number().int().positive().optional(),
  treatment_rooms: z.number().int().positive().optional(),
  features_fr: z.array(z.string().min(1)).optional(),
  features_en: z.array(z.string().min(1)).optional(),
  // Concierge dossier fields (mirror RestaurantVenueSchema): a short
  // editorial description plus the practical facts a guest needs before
  // booking a treatment — opening hours, an indicative price note, the
  // booking channel and a one-line Concierge tip.
  description_fr: z.string().min(1).max(1200).optional(),
  description_en: z.string().min(1).max(1200).optional(),
  hours_fr: z.string().min(1).max(200).optional(),
  hours_en: z.string().min(1).max(200).optional(),
  price_note_fr: z.string().min(1).max(200).optional(),
  price_note_en: z.string().min(1).max(200).optional(),
  website: z.string().url().optional(),
  reservation_url: z.string().url().optional(),
  phone: z.string().min(1).max(40).optional(),
  tip_fr: z.string().min(1).max(400).optional(),
  tip_en: z.string().min(1).max(400).optional(),
});

export interface LocalisedSpa {
  readonly name: string;
  readonly surfaceSqm: number | null;
  readonly treatmentRooms: number | null;
  readonly features: readonly string[];
  readonly description: string | null;
  readonly hours: string | null;
  readonly priceNote: string | null;
  readonly website: string | null;
  readonly reservationUrl: string | null;
  readonly phone: string | null;
  readonly tip: string | null;
}

export function readSpa(row: HotelDetailRow, locale: SupportedLocale): LocalisedSpa | null {
  const parsed = SpaInfoSchema.safeParse(row.spa_info);
  if (!parsed.success) return null;
  const localizedFeatures = pickByLocale(
    locale,
    parsed.data.features_fr ?? parsed.data.features_en ?? [],
    parsed.data.features_en ?? parsed.data.features_fr ?? [],
  );
  return {
    name: parsed.data.name,
    surfaceSqm: parsed.data.surface_sqm ?? null,
    treatmentRooms: parsed.data.treatment_rooms ?? null,
    features: localizedFeatures,
    description: pickLocalizedText(locale, parsed.data.description_fr, parsed.data.description_en),
    hours: pickLocalizedText(locale, parsed.data.hours_fr, parsed.data.hours_en),
    priceNote: pickLocalizedText(locale, parsed.data.price_note_fr, parsed.data.price_note_en),
    website: parsed.data.website ?? null,
    reservationUrl: parsed.data.reservation_url ?? null,
    phone: parsed.data.phone ?? null,
    tip: pickLocalizedText(locale, parsed.data.tip_fr, parsed.data.tip_en),
  };
}

// ---------------------------------------------------------------------------
// instagram — social feed teaser (hotels.instagram jsonb, override-only today)
// ---------------------------------------------------------------------------

const InstagramPostSchema = z.object({
  permalink: z.string().url(),
  // Cloudinary public_id of the mirrored image (photo-quality rule: published
  // imagery lives on our Cloudinary, never hotlinked from scontent.cdninstagram).
  image_public_id: z.string().min(1).optional(),
  caption_fr: z.string().min(1).max(300).optional(),
  caption_en: z.string().min(1).max(300).optional(),
  posted_at: z.string().min(1).optional(),
});

const InstagramFeedSchema = z.object({
  handle: z.string().min(1).max(60),
  profile_url: z.string().url(),
  followers: z.number().int().nonnegative().optional(),
  posts: z.array(InstagramPostSchema).min(1).max(4),
});

export interface LocalisedInstagramPost {
  readonly permalink: string;
  readonly imagePublicId: string | null;
  readonly caption: string | null;
  readonly postedAtIso: string | null;
}

export interface LocalisedInstagramFeed {
  readonly handle: string;
  readonly profileUrl: string;
  readonly followers: number | null;
  readonly posts: readonly LocalisedInstagramPost[];
}

export function readInstagram(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedInstagramFeed | null {
  const parsed = InstagramFeedSchema.safeParse(row.instagram);
  if (!parsed.success) return null;
  return {
    handle: parsed.data.handle,
    profileUrl: parsed.data.profile_url,
    followers: parsed.data.followers ?? null,
    posts: parsed.data.posts.map((p) => ({
      permalink: p.permalink,
      imagePublicId: p.image_public_id ?? null,
      caption: pickLocalizedText(locale, p.caption_fr, p.caption_en),
      postedAtIso: p.posted_at ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// concierge_pick / concierge_hook — golden-template editorial blocks
// (hotels.concierge_pick / concierge_hook jsonb, migration 0068). Both
// optional: absent rows parse to null and the page falls back to the classic
// hero / un-framed rooms grid.
// ---------------------------------------------------------------------------

const ConciergePickSchema = z.object({
  slug: z.string().min(1),
  note: z.object({
    fr: z.string().min(1),
    en: z.string().min(1),
  }),
});

export interface LocalisedConciergePick {
  readonly slug: string;
  readonly note: string;
}

export function readConciergePick(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedConciergePick | null {
  const parsed = ConciergePickSchema.safeParse(row.concierge_pick);
  if (!parsed.success) return null;
  return {
    slug: parsed.data.slug,
    note: locale === 'en' ? parsed.data.note.en : parsed.data.note.fr,
  };
}

const ConciergeHookSchema = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
});

/** Hero accroche (Concierge voice, ≤ 25 words). Null when the row carries none. */
export function readConciergeHook(row: HotelDetailRow, locale: SupportedLocale): string | null {
  const parsed = ConciergeHookSchema.safeParse(row.concierge_hook);
  if (!parsed.success) return null;
  return locale === 'en' ? parsed.data.en : parsed.data.fr;
}

/**
 * True when the fiche carries the golden-template hero accroche
 * (`concierge_hook`). Drives the full-bleed overlay hero — any promoted golden
 * fiche opts in automatically, no per-slug flag. Replaces the Airelles-only
 * `isAirellesGoldenTemplate` sandbox gate.
 */
export function hasGoldenHero(row: HotelDetailRow): boolean {
  return ConciergeHookSchema.safeParse(row.concierge_hook).success;
}

// ---------------------------------------------------------------------------
// geo_qa — data-driven GEO/AEO answer-engine blocks (migration 0072 jsonb
// array). Replaces the Airelles-only hard-coded `<HotelGeoSection>` gate: any
// fiche carrying a valid `geo_qa` array surfaces its own answer-engine block.
// ---------------------------------------------------------------------------

const GeoQaEntrySchema = z.object({
  id: z.string().min(1),
  question_fr: z.string().min(1),
  question_en: z.string().min(1),
  paragraphs_fr: z.array(z.string().min(1)).min(1),
  paragraphs_en: z.array(z.string().min(1)).min(1),
});

const GeoQaSchema = z.array(GeoQaEntrySchema);

export interface GeoQaBlock {
  readonly id: string;
  readonly question: string;
  readonly paragraphs: readonly string[];
}

/**
 * Localised GEO/AEO blocks for the fiche. Returns [] when the row carries no
 * (or an invalid) `geo_qa` payload — the caller then skips `<HotelGeoSection>`.
 */
export function readGeoQa(row: HotelDetailRow, locale: SupportedLocale): readonly GeoQaBlock[] {
  const parsed = GeoQaSchema.safeParse(row.geo_qa);
  if (!parsed.success) return [];
  return parsed.data.map((entry) => ({
    id: entry.id,
    question: locale === 'en' ? entry.question_en : entry.question_fr,
    paragraphs: locale === 'en' ? entry.paragraphs_en : entry.paragraphs_fr,
  }));
}

// ---------------------------------------------------------------------------
// Media — hero_image (text) + gallery_images (jsonb)
// ---------------------------------------------------------------------------

/**
 * Constraint mirrored from Cloudinary public_id grammar:
 * folder segments separated by `/`, each segment matches
 * `[A-Za-z0-9][A-Za-z0-9._-]*`. This rejects spaces, query strings,
 * absolute URLs and trickery while accepting realistic public_ids.
 */
const CloudinaryPublicIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/, {
    message: 'invalid Cloudinary public_id',
  });

/**
 * Image licence enum — mirrors the Cloudinary Structured Metadata
 * `licence` field (see `.cursor/skills/photo-pipeline`). Drives the
 * JSON-LD `ImageObject.license` / Licensable badge: only the
 * Creative-Commons values resolve to a public licence URL; press-kit /
 * `all-rights-reserved` / `fair-use` photos emit provenance metadata
 * (credit / copyright) WITHOUT a licence link.
 */
const GalleryLicenceSchema = z.enum([
  'cc-by-sa-4.0',
  'cc-by-4.0',
  'cc0',
  'all-rights-reserved',
  'fair-use',
]);

export type GalleryLicence = z.infer<typeof GalleryLicenceSchema>;

const GalleryImageSchema = z.object({
  public_id: CloudinaryPublicIdSchema,
  alt_fr: z.string().min(1).optional(),
  alt_en: z.string().min(1).optional(),
  caption_fr: z.string().min(1).optional(),
  caption_en: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  /** Photographer / source attribution (Cloudinary SMD `credit`). */
  credit: z.string().min(1).max(200).optional(),
  /** Legal trail (Cloudinary SMD `licence`). */
  licence: GalleryLicenceSchema.optional(),
});

const GalleryImagesSchema = z.array(GalleryImageSchema);

export interface LocalisedGalleryImage {
  readonly publicId: string;
  readonly alt: string;
  /**
   * Localised full-sentence caption for the JSON-LD `ImageObject`
   * (LLM-citable, see photo-quality-seo-geo-agentique). Falls back to
   * `alt` when the gallery row has no caption yet.
   */
  readonly caption: string | null;
  readonly category: string | null;
  /** Rightsholder / source attribution, or `null` when unknown. */
  readonly credit: string | null;
  /** Licence enum, or `null` when not recorded. */
  readonly licence: GalleryLicence | null;
}

export function readHeroImage(row: HotelDetailRow): string | null {
  if (row.hero_image === null) return null;
  const parsed = CloudinaryPublicIdSchema.safeParse(row.hero_image);
  return parsed.success ? parsed.data : null;
}

export function readGallery(
  row: HotelDetailRow,
  locale: SupportedLocale,
  fallbackName: string,
): readonly LocalisedGalleryImage[] {
  const parsed = GalleryImagesSchema.safeParse(row.gallery_images);
  if (!parsed.success) return [];
  return parsed.data.map((img) => ({
    publicId: img.public_id,
    alt: pickLocalizedText(locale, img.alt_fr, img.alt_en) ?? fallbackName,
    caption: pickLocalizedText(locale, img.caption_fr, img.caption_en) ?? null,
    category: img.category ?? null,
    credit: img.credit ?? null,
    licence: img.licence ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Location enrichment — points_of_interest (jsonb) + transports (jsonb)
// ---------------------------------------------------------------------------

/**
 * Editorial bucket — used to split the "Around the hotel" section into
 * sub-blocks on the public fiche (kit `template-hotel.html`, « Autour »):
 *   - `visit` — patrimony + culture + nature (museum, castle, park, beach, …)
 *   - `do` — activities + experiential (wineries, sports, trails, …)
 *   - `eat` — dining around the hotel (restaurants, bistros, cafés, …)
 *   - `shop` — daily-life utilities (pharmacy, bakery, supermarket, ATM, …)
 *
 * Stored inside the `points_of_interest` JSONB array (no DB CHECK — the
 * enum is enforced here, in Zod). Legacy rows (pre-WS3) may omit the
 * field; the reader infers a sane bucket from `type` so the UI never
 * crashes. `eat` is always explicit (editorial) — inference keeps
 * routing generic dining to `do` for back-compat.
 */
export const POI_BUCKETS = ['visit', 'do', 'eat', 'shop'] as const;
export type PoiBucket = (typeof POI_BUCKETS)[number];
const PoiBucketSchema = z.enum(POI_BUCKETS);

/**
 * Pricing model — supports the three industry shapes:
 *   - `free` — admission is gratis (parks, churches, viewpoints).
 *   - `paid` — flat ticket (museums, attractions).
 *   - `donation` — pay-what-you-want (some religious sites).
 *   - `mixed` — partly free / partly paid (e.g. permanent collection
 *     free, temporary exhibitions paid).
 *
 * `amount_eur` is the indicative price for the most common adult ticket.
 * Renders as "À partir de X €" on the front; never enforced as the
 * canonical price (the canonical source is the POI's own website).
 */
const PoiPricingSchema = z.object({
  type: z.enum(['free', 'paid', 'donation', 'mixed']),
  amount_eur: z.number().nonnegative().max(10000).optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']).optional(),
  notes_fr: z.string().min(1).max(200).optional(),
  notes_en: z.string().min(1).max(200).optional(),
});

/**
 * Nearest public-transport station as attributed by the sync script
 * (Overpass-driven). `bus` is included for taxi/airport-only POIs even
 * though the bus tag is excluded from the global station fetch — POIs
 * may carry an explicit `bus_stop` ref when relevant.
 */
const PoiTransitModeSchema = z.enum(['subway', 'light_rail', 'tram', 'rail', 'monorail', 'bus']);

const PoiNearestTransitSchema = z.object({
  mode: PoiTransitModeSchema,
  name: z.string().min(1).max(120),
  distance_meters: z.number().int().nonnegative(),
  walk_minutes: z.number().int().nonnegative().optional(),
  /** Comma-separated line refs when tagged, e.g. `"1, 9"` or `"A"`. */
  line_ref: z.string().min(1).max(60).optional(),
});

const PointOfInterestSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().min(1).optional(),
  type: z.string().min(1),
  category_fr: z.string().min(1).optional(),
  category_en: z.string().min(1).optional(),
  distance_meters: z.number().int().nonnegative(),
  walk_minutes: z.number().int().nonnegative().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  // ── WS3 extensions ────────────────────────────────────────────────
  /** Editorial bucket (visit / do / shop). Defaults applied at read time. */
  bucket: PoiBucketSchema.optional(),
  /** LLM-generated 1-2 sentence description (max 280 chars, EEAT-safe). */
  description_fr: z.string().min(1).max(280).optional(),
  description_en: z.string().min(1).max(280).optional(),
  /**
   * Concierge-voice tip for the *bucket* this POI sits in (one short
   * sentence, ≤ 25 words, style guide §4-5). Written by the humanizer
   * to the first POI of each bucket only — the reader collects the
   * first non-empty match per bucket. Falls back to the i18n
   * `location.buckets.<bucket>.tipFallback` when no humanized tip is
   * available yet. WS5 phase 1 — schema slot only; phase 2 ships the
   * humanizer that populates the field.
   */
  bucket_tip_fr: z.string().min(1).max(280).optional(),
  bucket_tip_en: z.string().min(1).max(280).optional(),
  /** Raw OSM `opening_hours` tag (parser lives in apps/web/src/lib/poi-hours.ts). */
  opening_hours: z.string().min(1).max(400).optional(),
  /** Nearest metro/RER/tram station, attached when ≤ 400 m. */
  nearest_transit: PoiNearestTransitSchema.optional(),
  /** Indicative pricing for paid attractions (DATAtourisme `hasPrice` mostly). */
  pricing: PoiPricingSchema.optional(),
  /**
   * Schema.org `additionalType` URL (e.g. `https://schema.org/Pharmacy`).
   * Used by the JSON-LD builder to emit the canonical Schema.org class
   * for utility shops, instead of the generic `TouristAttraction`.
   */
  schema_type: z.string().url().max(160).optional(),
  /**
   * Source identifier (`node/123`, `way/456`, `dt/<uuid>`). Editorial
   * never renders it but the sync script uses it to dedupe on re-runs.
   */
  osm_id: z.string().min(1).max(80).optional(),
  // ── "Concierge handoff" practical block (golden-template extension) ──
  // Same info a concierge would email a guest about a place worth
  // visiting: website, reservation link, phone, address, a human-
  // readable hours string, an indicative price note and a one-line
  // concierge tip. All optional; the UI renders only populated fields.
  // (`opening_hours` above stays for the OSM raw tag; `hours_fr/en` is
  // the curated display string used by editorial overrides.)
  website: z.string().url().optional(),
  reservation_url: z.string().url().optional(),
  phone: z.string().min(1).max(40).optional(),
  address: z.string().min(1).max(200).optional(),
  hours_fr: z.string().min(1).max(200).optional(),
  hours_en: z.string().min(1).max(200).optional(),
  price_note_fr: z.string().min(1).max(200).optional(),
  price_note_en: z.string().min(1).max(200).optional(),
  tip_fr: z.string().min(1).max(400).optional(),
  tip_en: z.string().min(1).max(400).optional(),
  /** Cloudinary public_id for kit `.around-img` cards (visit POIs). */
  image_public_id: CloudinaryPublicIdSchema.optional(),
});

const PointsOfInterestSchema = z.array(PointOfInterestSchema);

const TransportModeSchema = z.enum([
  'metro',
  'rer',
  'tram',
  'bus',
  'train',
  'taxi',
  'airport',
  'airport_shuttle',
]);

const TransportSchema = z.object({
  mode: TransportModeSchema,
  line: z.string().min(1).optional(),
  station: z.string().min(1),
  station_en: z.string().min(1).optional(),
  distance_meters: z.number().int().nonnegative(),
  walk_minutes: z.number().int().nonnegative().optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

const TransportsSchema = z.array(TransportSchema);

export type TransportMode = z.infer<typeof TransportModeSchema>;

export interface LocalisedPoiNearestTransit {
  readonly mode: z.infer<typeof PoiTransitModeSchema>;
  readonly name: string;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  readonly lineRef: string | null;
}

export interface LocalisedPoiPricing {
  readonly type: 'free' | 'paid' | 'donation' | 'mixed';
  readonly amountEur: number | null;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  readonly notes: string | null;
}

export interface LocalisedPointOfInterest {
  readonly name: string;
  readonly type: string;
  readonly category: string | null;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly bucket: PoiBucket;
  readonly description: string | null;
  readonly openingHours: string | null;
  readonly nearestTransit: LocalisedPoiNearestTransit | null;
  readonly pricing: LocalisedPoiPricing | null;
  readonly schemaType: string | null;
  readonly osmId: string | null;
  readonly website: string | null;
  readonly reservationUrl: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly priceNote: string | null;
  readonly tip: string | null;
  readonly imagePublicId: string | null;
}

export interface LocalisedTransport {
  readonly mode: TransportMode;
  readonly line: string | null;
  readonly station: string;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  readonly notes: string | null;
}

/**
 * Concierge-voice tip surfaced at the top of each POI bucket section
 * (visit / do / shop). Sourced from the first `bucket_tip_fr/_en`
 * found in the bucket; `null` when the humanizer has not populated
 * the slot yet, in which case the UI displays the i18n
 * `location.buckets.<bucket>.tipFallback` template.
 */
export type LocalisedPoiBucketTips = Readonly<Record<PoiBucket, string | null>>;

export interface LocalisedLocation {
  readonly pointsOfInterest: readonly LocalisedPointOfInterest[];
  readonly transports: readonly LocalisedTransport[];
  readonly bucketTips: LocalisedPoiBucketTips;
}

/**
 * Three-bucket projection of {@link LocalisedLocation.pointsOfInterest},
 * matching the three sub-sections of the front-end "Around" block.
 * Returned by {@link readLocationByBucket} so the UI never needs to
 * filter the flat array — keeps the React tree pure and the
 * `groupBy` cost out of the render path.
 *
 * Each bucket is pre-sorted by distance ascending (closer first), which
 * matches the editorial expectation: a tourist scanning "things to do"
 * wants the nearest options at the top.
 */
export interface LocalisedLocationByBucket {
  readonly visit: readonly LocalisedPointOfInterest[];
  readonly do: readonly LocalisedPointOfInterest[];
  readonly eat: readonly LocalisedPointOfInterest[];
  readonly shop: readonly LocalisedPointOfInterest[];
  readonly transports: readonly LocalisedTransport[];
}

/**
 * Coarse bucket inference for legacy rows persisted before WS3 (i.e.
 * `bucket` field absent). Mirrors the same taxonomy used by the
 * editorial sync script (`scripts/editorial-pilot/src/enrichment/`),
 * but kept minimal — the canonical assignment lives in the sync, this
 * is only a safety net so unmigrated rows render in a sane section.
 *
 * Heuristics (DATAtourisme / OSM `type` strings):
 *   - museum / monument / castle / heritage / park / garden / nature
 *     / beach / viewpoint / church / cathedral → `visit`
 *   - pharmacy / bakery / supermarket / convenience / atm / post_office
 *     / store → `shop`
 *   - everything else (restaurant, winery, sports, trail, …) → `do`
 */
function inferBucketFromType(rawType: string): PoiBucket {
  const t = rawType.toLowerCase();
  if (
    t.includes('museum') ||
    t.includes('monument') ||
    t.includes('castle') ||
    t.includes('chateau') ||
    t.includes('heritage') ||
    t.includes('cultural') ||
    t.includes('park') ||
    t.includes('garden') ||
    t.includes('nature') ||
    t.includes('beach') ||
    t.includes('viewpoint') ||
    t.includes('church') ||
    t.includes('cathedral') ||
    t.includes('religious')
  ) {
    return 'visit';
  }
  if (
    t === 'pharmacy' ||
    t === 'bakery' ||
    t === 'supermarket' ||
    t === 'convenience' ||
    t === 'atm' ||
    t === 'post_office' ||
    t === 'store' ||
    t.includes('shop')
  ) {
    return 'shop';
  }
  return 'do';
}

/**
 * Returns the localized POI + transport snapshot for the hotel.
 *
 * Caller decides whether the fiche shows the section: an empty
 * `{ pointsOfInterest: [], transports: [] }` is a valid "no enriched
 * location yet" state.
 */
export function readLocation(row: HotelDetailRow, locale: SupportedLocale): LocalisedLocation {
  const poisRaw = PointsOfInterestSchema.safeParse(row.points_of_interest);
  const transportsRaw = TransportsSchema.safeParse(row.transports);

  const pointsOfInterest: LocalisedPointOfInterest[] = poisRaw.success
    ? poisRaw.data.map((p) => {
        const description = pickLocalizedText(locale, p.description_fr, p.description_en);
        const pricing: LocalisedPoiPricing | null = p.pricing
          ? {
              type: p.pricing.type,
              amountEur: p.pricing.amount_eur ?? null,
              currency: p.pricing.currency ?? 'EUR',
              notes: pickLocalizedText(locale, p.pricing.notes_fr, p.pricing.notes_en),
            }
          : null;
        const nearestTransit: LocalisedPoiNearestTransit | null = p.nearest_transit
          ? {
              mode: p.nearest_transit.mode,
              name: p.nearest_transit.name,
              distanceMeters: p.nearest_transit.distance_meters,
              walkMinutes: p.nearest_transit.walk_minutes ?? null,
              lineRef: p.nearest_transit.line_ref ?? null,
            }
          : null;
        return {
          name: pickByLocale(locale, p.name, p.name_en ?? p.name).trim(),
          type: p.type,
          category: pickLocalizedText(locale, p.category_fr, p.category_en),
          distanceMeters: p.distance_meters,
          walkMinutes: p.walk_minutes ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          bucket: p.bucket ?? inferBucketFromType(p.type),
          description,
          openingHours: p.opening_hours ?? null,
          nearestTransit,
          pricing,
          schemaType: p.schema_type ?? null,
          osmId: p.osm_id ?? null,
          website: p.website ?? null,
          reservationUrl: p.reservation_url ?? null,
          phone: p.phone ?? null,
          address: p.address ?? null,
          hours: pickLocalizedText(locale, p.hours_fr, p.hours_en),
          priceNote: pickLocalizedText(locale, p.price_note_fr, p.price_note_en),
          tip: pickLocalizedText(locale, p.tip_fr, p.tip_en),
          imagePublicId: p.image_public_id ?? null,
        };
      })
    : [];

  const transports: LocalisedTransport[] = transportsRaw.success
    ? transportsRaw.data.map((t) => ({
        mode: t.mode,
        line: t.line ?? null,
        station: pickByLocale(locale, t.station, t.station_en ?? t.station).trim(),
        distanceMeters: t.distance_meters,
        walkMinutes: t.walk_minutes ?? null,
        notes: pickLocalizedText(locale, t.notes_fr, t.notes_en),
      }))
    : [];

  // Bucket tips — the Concierge-voice humanizer (WS5 phase 2) stores
  // a single short sentence on the *first* POI of each bucket via the
  // `bucket_tip_fr/_en` slot. The reader collects the first non-empty
  // match per bucket so the UI never has to re-scan the array. When
  // no humanized tip is present (legacy rows or pre-humanizer hotels),
  // the value stays `null` and the front-end falls back to the i18n
  // `location.buckets.<bucket>.tipFallback` template.
  const bucketTips: Record<PoiBucket, string | null> = {
    visit: null,
    do: null,
    eat: null,
    shop: null,
  };
  if (poisRaw.success) {
    for (const p of poisRaw.data) {
      const bucket: PoiBucket = p.bucket ?? inferBucketFromType(p.type);
      if (bucketTips[bucket] !== null) continue;
      const tip = pickLocalizedText(locale, p.bucket_tip_fr, p.bucket_tip_en);
      if (tip !== null && tip.trim().length > 0) {
        bucketTips[bucket] = tip.trim();
      }
    }
  }

  return { pointsOfInterest, transports, bucketTips };
}

/**
 * Returns POIs already grouped into the three editorial buckets
 * (`visit`, `do`, `shop`) along with the transports list. The
 * components feed each sub-section directly without re-grouping.
 *
 * Within each bucket, entries are sorted by walking distance (closer
 * first), with `walkMinutes`-less entries falling back to
 * `distanceMeters`. Editorial sort is stable — the source array
 * order is preserved when two POIs are equidistant.
 */
export function readLocationByBucket(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedLocationByBucket {
  const { pointsOfInterest, transports } = readLocation(row, locale);
  const buckets: Record<PoiBucket, LocalisedPointOfInterest[]> = {
    visit: [],
    do: [],
    eat: [],
    shop: [],
  };
  for (const p of pointsOfInterest) {
    buckets[p.bucket].push(p);
  }
  const byDistance = (a: LocalisedPointOfInterest, b: LocalisedPointOfInterest): number => {
    const da = a.walkMinutes ?? Math.round(a.distanceMeters / 80);
    const db = b.walkMinutes ?? Math.round(b.distanceMeters / 80);
    if (da !== db) return da - db;
    return a.distanceMeters - b.distanceMeters;
  };
  return {
    visit: buckets.visit.sort(byDistance),
    do: buckets.do.sort(byDistance),
    eat: buckets.eat.sort(byDistance),
    shop: buckets.shop.sort(byDistance),
    transports,
  };
}

// ---------------------------------------------------------------------------
// upcoming_events (jsonb) — CDC §2 bloc "À proximité" (events lifecycle)
// ---------------------------------------------------------------------------

/**
 * Editorial event category — drives the icon, the colour pill, and the
 * Schema.org subtype emitted in `event.ts`.
 *
 * The 6 buckets cover the vast majority of culturally-relevant events
 * surfaced by DATAtourisme regional ODTs: classical / pop concerts,
 * temporary exhibitions, festivals (music + arts + gastronomy),
 * sports events (marathons, regattas, tennis), theatre / opera /
 * dance, and a generic catch-all.
 */
export const EVENT_CATEGORIES = [
  'concert',
  'expo',
  'festival',
  'sport',
  'theater',
  'other',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
const EventCategorySchema = z.enum(EVENT_CATEGORIES);

const EventPricingSchema = z.object({
  type: z.enum(['free', 'paid']),
  amount_eur: z.number().nonnegative().max(10_000).nullable(),
});

/**
 * Each persisted event must carry a parseable `YYYY-MM-DD` start
 * date — DATAtourisme sometimes emits datetimes; the sync script
 * normalises everything to a date-only string before persisting.
 *
 * Coordinates are mandatory: we always show events on the same
 * surface as the POI map, and an event without a venue would just
 * be noise on the page.
 */
const UpcomingEventSchema = z.object({
  name: z.string().min(1).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, { message: 'expected YYYY-MM-DD' }),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable()
    .optional(),
  venue_name: z.string().min(1).max(200).nullable().optional(),
  venue_address: z.string().min(1).max(400).nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  distance_meters: z.number().int().nonnegative(),
  category: EventCategorySchema,
  description_fr: z.string().min(1).max(280).nullable().optional(),
  description_en: z.string().min(1).max(280).nullable().optional(),
  pricing: EventPricingSchema.nullable().optional(),
  /** Official source URL (when present in DATAtourisme `hasContact.homepage`). */
  url: z.string().url().max(2048).nullable().optional(),
  /** DATAtourisme UUID — emitted as `sameAs` in JSON-LD for provenance. */
  dt_uuid: z.string().min(1).max(80).nullable().optional(),
  /**
   * Absolute HTTPS URL of an image that genuinely depicts the event
   * (Google-recommended `Event.image`). Populated by the editorial
   * pipeline only when DATAtourisme/the source carries a representative
   * image — never a borrowed or unrelated photo (the JSON-LD builder
   * re-validates HTTPS and drops anything else).
   */
  image_url: z.string().url().max(2048).nullable().optional(),
  /**
   * Human-readable season window for kit / editorial surfaces — e.g.
   * « Toute l'année », « Juin–septembre ». When absent, the reader
   * derives a compact label from `start_date` / `end_date` or
   * `is_year_round`.
   */
  period_fr: z.string().min(1).max(120).optional(),
  period_en: z.string().min(1).max(120).optional(),
  /** Practical schedule — market mornings, concert evenings, etc. */
  hours_fr: z.string().min(1).max(200).optional(),
  hours_en: z.string().min(1).max(200).optional(),
  /** Permanent fixture (weekly market year-round) — surfaces « Toute l'année » when `period_*` is absent. */
  is_year_round: z.boolean().optional(),
});

const UpcomingEventsSchema = z.array(UpcomingEventSchema);

export interface LocalisedUpcomingEvent {
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly distanceMeters: number;
  readonly category: EventCategory;
  readonly description: string | null;
  readonly pricing: { readonly type: 'free' | 'paid'; readonly amountEur: number | null } | null;
  readonly url: string | null;
  readonly dtUuid: string | null;
  /** Representative event image (absolute HTTPS), or `null` when none. */
  readonly imageUrl: string | null;
  /** Season / recurrence window for display (e.g. « Toute l'année », « Juin–août »). */
  readonly period: string | null;
  /** Practical hours / schedule when available. */
  readonly schedule: string | null;
}

function isFullCalendarYear(startIso: string, endIso: string): boolean {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === 0 &&
    start.getUTCDate() === 1 &&
    end.getUTCMonth() === 11 &&
    end.getUTCDate() === 31
  );
}

/**
 * Compact period label for kit cards when `period_fr/en` is not stored.
 * Mirrors the year-round heuristic in `hotel-events.tsx` (`formatEventDates`).
 */
function deriveUpcomingEventPeriod(
  startIso: string,
  endIso: string | null,
  locale: SupportedLocale,
  isYearRound: boolean | undefined,
): string | null {
  if (isYearRound) {
    return pickLocalizedText(locale, 'Toute l’année', 'Year-round');
  }
  if (endIso === null || endIso === startIso) {
    const start = new Date(`${startIso}T00:00:00Z`);
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return fmt.format(start);
  }
  if (isFullCalendarYear(startIso, endIso)) {
    return pickLocalizedText(locale, 'Toute l’année', 'Year-round');
  }
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const fmtMonth = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long' });
  const startMonth = fmtMonth.format(start);
  const endMonth = fmtMonth.format(end);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear && startMonth !== endMonth) {
    return `${startMonth}–${endMonth}`;
  }
  const fmtShort = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
  const fmtFull = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (startYear === endYear) {
    return `${fmtShort.format(start)} – ${fmtFull.format(end)}`;
  }
  return `${fmtFull.format(start)} – ${fmtFull.format(end)}`;
}

/**
 * Returns up to 5 upcoming local events around the hotel, in the user's
 * locale, sorted by start date ascending.
 *
 * Filtering rules
 * ---------------
 * 1. **Stale events are dropped** — anything whose `endDate` (or
 *    `startDate` for single-day events) is before "today" is filtered
 *    out at read time, even if the sync hasn't run yet. This prevents
 *    a Friday-night render from surfacing an event that ended Friday
 *    morning.
 * 2. **No events without coordinates** — the schema already enforces
 *    `latitude/longitude`, so a malformed entry simply doesn't parse.
 * 3. **Cap = 5** — matches the editorial cap in the sync script. The
 *    JSON-LD builder emits all 5 as standalone `Event` nodes.
 *
 * Returns an empty array on any parse failure (no events surface
 * rather than partial / stale data).
 */
export function readUpcomingEvents(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedUpcomingEvent[] {
  const parsed = UpcomingEventsSchema.safeParse(row.upcoming_events);
  if (!parsed.success) {
    if (
      process.env['NODE_ENV'] !== 'production' &&
      row.upcoming_events !== null &&
      row.upcoming_events !== undefined
    ) {
      console.warn('[readUpcomingEvents] parse error', parsed.error.flatten().fieldErrors);
    }
    return [];
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const localised: LocalisedUpcomingEvent[] = [];
  for (const e of parsed.data) {
    const lastDay = e.end_date ?? e.start_date;
    if (lastDay < todayIso) continue;
    const description = pickLocalizedText(locale, e.description_fr, e.description_en);
    const periodStored = pickLocalizedText(locale, e.period_fr, e.period_en);
    const period =
      periodStored !== null && periodStored.trim().length > 0
        ? periodStored.trim()
        : deriveUpcomingEventPeriod(e.start_date, e.end_date ?? null, locale, e.is_year_round);
    const schedule = pickLocalizedText(locale, e.hours_fr, e.hours_en);
    localised.push({
      name: e.name.trim(),
      startDate: e.start_date,
      endDate: e.end_date ?? null,
      venueName: e.venue_name ?? null,
      venueAddress: e.venue_address ?? null,
      latitude: e.latitude,
      longitude: e.longitude,
      distanceMeters: e.distance_meters,
      category: e.category,
      description,
      pricing: e.pricing ? { type: e.pricing.type, amountEur: e.pricing.amount_eur } : null,
      url: e.url ?? null,
      dtUuid: e.dt_uuid ?? null,
      imageUrl: e.image_url ?? null,
      period,
      schedule: schedule !== null && schedule.trim().length > 0 ? schedule.trim() : null,
    });
  }

  return localised.sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
}

// ---------------------------------------------------------------------------
// policies (jsonb)
// ---------------------------------------------------------------------------

/** `HH:MM` 24-hour time string (e.g. `15:00`, `23:30`). */
const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'expected HH:MM time' });

const PaymentMethodSchema = z.enum([
  'visa',
  'mc',
  'amex',
  'diners',
  'jcb',
  'unionpay',
  'apple_pay',
  'google_pay',
  'cash',
  'bank_transfer',
]);

const CheckInPolicySchema = z.object({
  from: TimeOfDaySchema,
  until: TimeOfDaySchema.optional(),
});

const CheckOutPolicySchema = z.object({
  until: TimeOfDaySchema,
});

const CancellationPolicySchema = z.object({
  summary_fr: z.string().min(1).optional(),
  summary_en: z.string().min(1).optional(),
  free_until_hours: z.number().int().nonnegative().optional(),
  penalty_after_fr: z.string().min(1).optional(),
  penalty_after_en: z.string().min(1).optional(),
});

const PetsPolicySchema = z.object({
  allowed: z.boolean(),
  fee_eur: z.number().nonnegative().optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

const ChildrenPolicySchema = z.object({
  welcome: z.boolean(),
  free_under_age: z.number().int().nonnegative().optional(),
  extra_bed_fee_eur: z.number().nonnegative().optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

const PaymentPolicySchema = z.object({
  methods: z.array(PaymentMethodSchema).min(1),
  deposit_required: z.boolean().optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

/**
 * City / tourist tax (taxe de séjour).
 *
 * Modeled as a per-person-per-night flat amount in the property's
 * currency because that's how French municipalities (and most EU
 * jurisdictions) publish their rates — even when the tax is
 * technically tiered by category (e.g. palace, 5★, 4★). The
 * Île-de-France 25 % regional surtax in Paris is typically rolled
 * into the displayed amount and called out in `notes_fr/en` so that
 * the public-facing copy is unambiguous.
 *
 * Editors set `free_under_age` when minors are exempt (most French
 * municipalities exempt under-18s, but some apply ages 12 or 16).
 */
const CityTaxPolicySchema = z.object({
  amount_per_person_per_night: z.number().nonnegative(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']).default('EUR'),
  free_under_age: z.number().int().nonnegative().optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

/**
 * Wi-Fi policy. Booking engines and OTAs penalise hotels with
 * paywalled Wi-Fi heavily — surfacing "Wi-Fi haut débit inclus
 * dans toutes les chambres" prominently is a documented conversion
 * lever, and palaces typically include it. We model it as a
 * structured node (not a free amenity flag) because the *scope*
 * matters: some properties include public-areas Wi-Fi but charge
 * for in-room access.
 */
const WifiPolicySchema = z.object({
  included: z.boolean(),
  scope: z.enum(['whole_property', 'public_areas', 'rooms']).optional(),
  notes_fr: z.string().min(1).optional(),
  notes_en: z.string().min(1).optional(),
});

const PoliciesSchema = z.object({
  check_in: CheckInPolicySchema.optional(),
  check_out: CheckOutPolicySchema.optional(),
  cancellation: CancellationPolicySchema.optional(),
  pets: PetsPolicySchema.optional(),
  children: ChildrenPolicySchema.optional(),
  payment: PaymentPolicySchema.optional(),
  city_tax: CityTaxPolicySchema.optional(),
  wifi: WifiPolicySchema.optional(),
});

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export interface LocalisedCheckInPolicy {
  readonly from: string;
  readonly until: string | null;
}
export interface LocalisedCheckOutPolicy {
  readonly until: string;
}
export interface LocalisedCancellationPolicy {
  readonly summary: string | null;
  readonly freeUntilHours: number | null;
  readonly penaltyAfter: string | null;
}
export interface LocalisedPetsPolicy {
  readonly allowed: boolean;
  readonly feeEur: number | null;
  readonly notes: string | null;
}
export interface LocalisedChildrenPolicy {
  readonly welcome: boolean;
  readonly freeUnderAge: number | null;
  readonly extraBedFeeEur: number | null;
  readonly notes: string | null;
}
export interface LocalisedPaymentPolicy {
  readonly methods: readonly PaymentMethod[];
  readonly depositRequired: boolean | null;
  readonly notes: string | null;
}
export interface LocalisedCityTaxPolicy {
  readonly amountPerPersonPerNight: number;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  readonly freeUnderAge: number | null;
  readonly notes: string | null;
}
export interface LocalisedWifiPolicy {
  readonly included: boolean;
  readonly scope: 'whole_property' | 'public_areas' | 'rooms' | null;
  readonly notes: string | null;
}

export interface LocalisedPolicies {
  readonly checkIn: LocalisedCheckInPolicy | null;
  readonly checkOut: LocalisedCheckOutPolicy | null;
  readonly cancellation: LocalisedCancellationPolicy | null;
  readonly pets: LocalisedPetsPolicy | null;
  readonly children: LocalisedChildrenPolicy | null;
  readonly payment: LocalisedPaymentPolicy | null;
  readonly cityTax: LocalisedCityTaxPolicy | null;
  readonly wifi: LocalisedWifiPolicy | null;
}

const EMPTY_POLICIES: LocalisedPolicies = {
  checkIn: null,
  checkOut: null,
  cancellation: null,
  pets: null,
  children: null,
  payment: null,
  cityTax: null,
  wifi: null,
};

export function readPolicies(row: HotelDetailRow, locale: SupportedLocale): LocalisedPolicies {
  const parsed = PoliciesSchema.safeParse(row.policies);
  if (!parsed.success) return EMPTY_POLICIES;
  const p = parsed.data;

  return {
    checkIn:
      p.check_in !== undefined ? { from: p.check_in.from, until: p.check_in.until ?? null } : null,
    checkOut: p.check_out !== undefined ? { until: p.check_out.until } : null,
    cancellation:
      p.cancellation !== undefined
        ? {
            summary: pickLocalizedText(
              locale,
              p.cancellation.summary_fr,
              p.cancellation.summary_en,
            ),
            freeUntilHours: p.cancellation.free_until_hours ?? null,
            penaltyAfter: pickLocalizedText(
              locale,
              p.cancellation.penalty_after_fr,
              p.cancellation.penalty_after_en,
            ),
          }
        : null,
    pets:
      p.pets !== undefined
        ? {
            allowed: p.pets.allowed,
            feeEur: p.pets.fee_eur ?? null,
            notes: pickLocalizedText(locale, p.pets.notes_fr, p.pets.notes_en),
          }
        : null,
    children:
      p.children !== undefined
        ? {
            welcome: p.children.welcome,
            freeUnderAge: p.children.free_under_age ?? null,
            extraBedFeeEur: p.children.extra_bed_fee_eur ?? null,
            notes: pickLocalizedText(locale, p.children.notes_fr, p.children.notes_en),
          }
        : null,
    payment:
      p.payment !== undefined
        ? {
            methods: p.payment.methods,
            depositRequired: p.payment.deposit_required ?? null,
            notes: pickLocalizedText(locale, p.payment.notes_fr, p.payment.notes_en),
          }
        : null,
    cityTax:
      p.city_tax !== undefined
        ? {
            amountPerPersonPerNight: p.city_tax.amount_per_person_per_night,
            currency: p.city_tax.currency,
            freeUnderAge: p.city_tax.free_under_age ?? null,
            notes: pickLocalizedText(locale, p.city_tax.notes_fr, p.city_tax.notes_en),
          }
        : null,
    wifi:
      p.wifi !== undefined
        ? {
            included: p.wifi.included,
            scope: p.wifi.scope ?? null,
            notes: pickLocalizedText(locale, p.wifi.notes_fr, p.wifi.notes_en),
          }
        : null,
  };
}

export function hasAnyPolicy(p: LocalisedPolicies): boolean {
  return (
    p.checkIn !== null ||
    p.checkOut !== null ||
    p.cancellation !== null ||
    p.pets !== null ||
    p.children !== null ||
    p.payment !== null ||
    p.cityTax !== null ||
    p.wifi !== null
  );
}

// ---------------------------------------------------------------------------
// awards (jsonb)
// ---------------------------------------------------------------------------

/**
 * URL whitelist: https only (no http, no javascript:, no relative).
 * Bounded length prevents stuffed seo-spam URLs from leaking into JSON-LD.
 */
const AwardUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith('https://'), { message: 'award url must be https' });

const AwardSchema = z.object({
  name_fr: z.string().min(1),
  name_en: z.string().min(1),
  issuer: z.string().min(1),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  url: AwardUrlSchema.optional(),
  image: CloudinaryPublicIdSchema.optional(),
});

const AwardsSchema = z.array(AwardSchema);

export interface LocalisedAward {
  readonly name: string;
  readonly issuer: string;
  readonly year: number | null;
  readonly url: string | null;
  readonly image: string | null;
}

/**
 * Returns the localized awards list, sorted by year descending (most recent
 * first) with year-less awards last. Empty array is a valid "no awards
 * recorded" state — callers decide whether to hide the section.
 */
export function readAwards(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedAward[] {
  const parsed = AwardsSchema.safeParse(row.awards);
  if (!parsed.success) return [];

  const localized: LocalisedAward[] = parsed.data.map((a) => ({
    name: pickByLocale(locale, a.name_fr, a.name_en).trim(),
    issuer: a.issuer.trim(),
    year: a.year ?? null,
    url: a.url ?? null,
    image: a.image ?? null,
  }));

  // Recent-first; entries without a year fall to the bottom while keeping a
  // stable order amongst themselves (Array#sort is stable since ES2019).
  return localized.sort((left, right) => {
    if (left.year === null && right.year === null) return 0;
    if (left.year === null) return 1;
    if (right.year === null) return -1;
    return right.year - left.year;
  });
}

// ---------------------------------------------------------------------------
// affiliations (jsonb) — migration 0062 / ADR-0023
// ---------------------------------------------------------------------------

/**
 * Returns the **verified** affiliations stored in `hotels.affiliations[]`.
 *
 * Verification is the boundary between "scaffolded scrape" and "JSON-LD
 * emission" — only entries marked `verified: true` by the ingestion
 * pipelines (Atout France Palaces, Forbes 5-Star, brand ownership, …)
 * surface here. Hard Rule 14 (`.cursor/rules/hotel-detail-page.mdc`)
 * forbids emitting unverified affiliations to the public graph.
 *
 * Lenient parsing: a single malformed entry never crashes the fiche —
 * see `parseAffiliationsLenient` in `@mch/db`. Empty array is a valid
 * "no affiliations recorded" state.
 *
 * The page-level composer downstream feeds the result into:
 *   - `mapAffiliationsToAwardStrings()` (→ `Hotel.award[]`)
 *   - `mapAffiliationsToBrand()` (→ `Hotel.brand`)
 *
 * (Both live in `@mch/seo/jsonld`.)
 */
export function readAffiliations(row: HotelDetailRow): readonly HotelAffiliation[] {
  const parsed = parseAffiliationsLenient(row.affiliations);
  return parsed.filter((a) => a.verified === true);
}

// ---------------------------------------------------------------------------
// external_sources (jsonb) — EEAT provenance, CDC §2 bloc 13bis
// ---------------------------------------------------------------------------

/**
 * Per-fact provenance entry mirrored from migration 0061 / Phase 1.5
 * backfill (`scripts/editorial-pilot/src/enrichment/convert-wikidata-
 * to-external-sources.ts`). Shape is `{ field, value, source,
 * source_url, confidence, collected_at }`.
 *
 * Schema is duplicated here (instead of imported from
 * `get-hotel-external-sources.ts`) on purpose: that module already
 * imports `isValidSlug` from this file, so reusing its export would
 * create a circular dependency. The shape is small and stable enough
 * to live in both places — the test in
 * `get-hotel-external-sources.test.ts` asserts they stay in sync.
 */
const ExternalSourceEntrySchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  source: z.string().min(1),
  source_url: z.string().url().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  collected_at: z.string().min(1).optional(),
});

/**
 * The "kind" a public reference belongs to. Each kind maps to one
 * row in `<HotelExternalSourcesFooter>` and to one i18n label.
 *
 * `wikipedia_fr` / `wikipedia_en` are kept distinct so the footer
 * can show both side-by-side when both are present — LLM ingestion
 * weights French Wikipedia coverage independently from English.
 */
export type HotelExternalSourceReferenceKind =
  | 'wikidata'
  | 'wikipedia_fr'
  | 'wikipedia_en'
  | 'official'
  | 'commons'
  | 'tripadvisor'
  | 'booking_com';

export interface HotelExternalSourceReference {
  readonly kind: HotelExternalSourceReferenceKind;
  readonly url: string;
  /** Identifier displayed inline (Wikidata Q-id, TripAdvisor numeric id, …). */
  readonly identifier: string | null;
}

export interface HotelExternalSourceFacts {
  readonly inceptionYear: number | null;
  readonly architects: readonly string[];
  readonly heritageDesignations: readonly string[];
}

export interface HotelExternalSourcesProvenance {
  readonly references: readonly HotelExternalSourceReference[];
  readonly facts: HotelExternalSourceFacts;
  /** Most recent `collected_at` across all entries — drives the freshness microtext. */
  readonly collectedAt: string | null;
}

/** Map an entry's `field` name to a public reference `kind`. */
function refKindForField(field: string): HotelExternalSourceReferenceKind | null {
  switch (field) {
    case 'wikidata_id':
      return 'wikidata';
    case 'wikipedia_url_fr':
      return 'wikipedia_fr';
    case 'wikipedia_url_en':
      return 'wikipedia_en';
    case 'official_url':
      return 'official';
    case 'commons_category':
      return 'commons';
    case 'tripadvisor_location_id':
      return 'tripadvisor';
    case 'booking_com_hotel_id':
      return 'booking_com';
    default:
      return null;
  }
}

/**
 * EEAT provenance reader — CDC §2 bloc 13bis.
 *
 * Returns `null` when the column is missing, empty, or carries no
 * publicly useful entries (e.g. only `social_handle` rows, which we
 * intentionally exclude from this surface — they belong in the
 * footer's social block, not the EEAT footer).
 *
 * The reader is **lenient**: a single malformed entry is dropped, not
 * the whole row, so the public surface keeps working while the
 * backfill catches up.
 *
 * Architects + heritage designations are surfaced as facts (not as
 * separate references) because they answer "what is this place?"
 * rather than "who says so?". Their `source_url` (Wikidata Q-page)
 * is already exposed via the `wikidata` reference.
 */
export function readExternalSourcesProvenance(
  row: HotelDetailRow,
): HotelExternalSourcesProvenance | null {
  if (!Array.isArray(row.external_sources)) return null;

  const refByKind = new Map<HotelExternalSourceReferenceKind, HotelExternalSourceReference>();
  let inceptionYear: number | null = null;
  const architects: string[] = [];
  const heritage: string[] = [];
  let mostRecent: string | null = null;

  for (const candidate of row.external_sources) {
    const parsed = ExternalSourceEntrySchema.safeParse(candidate);
    if (!parsed.success) continue;
    const entry = parsed.data;
    if (entry.collected_at !== undefined) {
      if (mostRecent === null || entry.collected_at > mostRecent) {
        mostRecent = entry.collected_at;
      }
    }

    const kind = refKindForField(entry.field);
    if (kind !== null && entry.source_url !== undefined) {
      // First entry wins (stable ordering = ingestion order). Subsequent
      // entries for the same kind are dropped silently — the convertor
      // is idempotent, so duplicates only happen when an editor adds a
      // manual entry on top of a Wikidata-resolved one.
      if (!refByKind.has(kind)) {
        // Q-id / numeric id displayed inline next to the link. Falls
        // back to `null` when `value` is a URL (already conveyed by
        // the link itself) or a non-string scalar.
        let identifier: string | null = null;
        if (typeof entry.value === 'string') {
          if (kind === 'wikidata' && /^Q\d+$/.test(entry.value)) identifier = entry.value;
          if (kind === 'tripadvisor' && /^\d+$/.test(entry.value)) identifier = entry.value;
        }
        refByKind.set(kind, { kind, url: entry.source_url, identifier });
      }
      continue;
    }

    // Derived facts (high-trust, attributed to Wikidata).
    if (entry.field === 'inception_year' && typeof entry.value === 'number') {
      if (entry.value > 1000 && entry.value < 9999) inceptionYear = entry.value;
      continue;
    }
    if (entry.field === 'architects' && Array.isArray(entry.value)) {
      for (const a of entry.value) {
        if (typeof a === 'string' && a.trim().length > 0) architects.push(a.trim());
      }
      continue;
    }
    if (entry.field === 'heritage_designations' && Array.isArray(entry.value)) {
      for (const h of entry.value) {
        if (typeof h === 'string' && h.trim().length > 0) heritage.push(h.trim());
      }
      continue;
    }
    // `social_handle` and other unknown fields are intentionally
    // skipped — they don't belong in the "Sources & vérifications"
    // surface.
  }

  // Stable ordering for the references list — encyclopaedias first,
  // then official + Commons, then aggregators. Mirrors the editorial
  // sources footer hierarchy.
  const ORDER: readonly HotelExternalSourceReferenceKind[] = [
    'wikidata',
    'wikipedia_fr',
    'wikipedia_en',
    'commons',
    'official',
    'tripadvisor',
    'booking_com',
  ];
  const references: HotelExternalSourceReference[] = [];
  for (const k of ORDER) {
    const ref = refByKind.get(k);
    if (ref !== undefined) references.push(ref);
  }

  const facts: HotelExternalSourceFacts = {
    inceptionYear,
    architects,
    heritageDesignations: heritage,
  };

  const hasFacts =
    facts.inceptionYear !== null ||
    facts.architects.length > 0 ||
    facts.heritageDesignations.length > 0;
  if (references.length === 0 && !hasFacts) return null;

  return { references, facts, collectedAt: mostRecent };
}

// ---------------------------------------------------------------------------
// signature_experiences (jsonb) — CDC §2.12
// ---------------------------------------------------------------------------

/**
 * Stable identifier grammar for a signature experience: lowercase
 * kebab-case, 2-48 chars. Used both as React key and as URL anchor
 * if the editorial team links to a specific card.
 */
const EXPERIENCE_KEY_REGEX = /^[a-z][a-z0-9-]{1,47}$/;

const SignatureExperienceSchema = z.object({
  key: z.string().regex(EXPERIENCE_KEY_REGEX, {
    message: 'expected lowercase kebab key (2-48 chars)',
  }),
  /**
   * Discriminator (kit `template-hotel.html`, D4). `experience` (default)
   * renders in the generic signature grid; `kid_club` is surfaced as a
   * dedicated `.feature-block` (image + meta + footer) under « L'hôtel en
   * bref ». Absent on legacy rows → treated as `experience`.
   */
  kind: z.enum(['experience', 'kid_club']).optional(),
  title_fr: z.string().min(1),
  title_en: z.string().min(1),
  description_fr: z.string().min(1).max(500),
  description_en: z.string().min(1).max(500),
  badge_fr: z.string().min(1).max(48).optional(),
  badge_en: z.string().min(1).max(48).optional(),
  /**
   * Whether the experience requires an explicit booking on top of the
   * stay. Drives the wording of the CTA / footer line ("Sur réservation"
   * vs "Inclus dans le séjour").
   */
  booking_required: z.boolean(),
  image_public_id: CloudinaryPublicIdSchema.optional(),
  price_note_fr: z.string().min(1).max(120).optional(),
  price_note_en: z.string().min(1).max(120).optional(),
  tip_fr: z.string().min(1).max(400).optional(),
  tip_en: z.string().min(1).max(400).optional(),
  /** Vendor or official page for « En savoir plus » (not the booking tunnel). */
  website: z.string().url().optional(),
});

const SignatureExperiencesSchema = z.array(SignatureExperienceSchema);

export interface LocalisedSignatureExperience {
  readonly key: string;
  readonly kind: 'experience' | 'kid_club';
  readonly title: string;
  readonly description: string;
  readonly badge: string | null;
  readonly bookingRequired: boolean;
  readonly imagePublicId: string | null;
  readonly priceNote: string | null;
  readonly tip: string | null;
  readonly website: string | null;
}

/**
 * Returns the property's signature experiences, localized. Falls back
 * to the other locale per-field when one side is missing — but since
 * `title_*` and `description_*` are both required by the schema, the
 * fallback only matters if editorial inserts an under-typed payload
 * via a future Payload migration.
 *
 * Empty array is a valid "no signature experiences declared" state;
 * the UI component self-elides in that case.
 */
export function readSignatureExperiences(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedSignatureExperience[] {
  const parsed = SignatureExperiencesSchema.safeParse(row.signature_experiences);
  if (!parsed.success) return [];

  return parsed.data.map((e) => ({
    key: e.key,
    kind: e.kind ?? 'experience',
    title: pickByLocale(locale, e.title_fr, e.title_en),
    description: pickByLocale(locale, e.description_fr, e.description_en),
    badge: pickLocalizedText(locale, e.badge_fr, e.badge_en),
    bookingRequired: e.booking_required,
    imagePublicId: e.image_public_id ?? null,
    priceNote: pickLocalizedText(locale, e.price_note_fr, e.price_note_en),
    tip: pickLocalizedText(locale, e.tip_fr, e.tip_en),
    website: e.website ?? null,
  }));
}

// ---------------------------------------------------------------------------
// hero_video (jsonb) — CDC §2 bloc 2 (B8 / migration 0044)
// ---------------------------------------------------------------------------

const HeroVideoSchema = z
  .object({
    name: z.string().min(1).max(160),
    description: z.string().min(1).max(500),
    thumbnailUrl: z.union([z.string().url(), z.array(z.string().url()).min(1)]),
    uploadDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/u, {
        message: 'uploadDate must be ISO 8601 (YYYY-MM-DD or full DateTime)',
      }),
    contentUrl: z.string().url().optional(),
    embedUrl: z.string().url().optional(),
    duration: z
      .string()
      .regex(/^PT\d+(M\d+S|S|M)$/u, { message: 'duration must be ISO 8601 (e.g. PT45S)' })
      .optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    caption: z.string().min(1).max(280).optional(),
  })
  .refine((v) => v.contentUrl !== undefined || v.embedUrl !== undefined, {
    message: 'hero_video requires at least one of contentUrl or embedUrl',
  });

export type HotelHeroVideo = z.infer<typeof HeroVideoSchema>;

/**
 * Returns the hero video payload when present and valid, otherwise
 * `null`. Validation is strict — any malformed legacy row is dropped
 * silently in production (warned in dev) so the `<HotelVideo>`
 * component and the `VideoObject` JSON-LD stay coherent.
 *
 * Skill: structured-data-schema-org, content-modeling.
 */
export function readHeroVideo(row: HotelDetailRow): HotelHeroVideo | null {
  if (row.hero_video === null || row.hero_video === undefined) return null;
  const parsed = HeroVideoSchema.safeParse(row.hero_video);
  if (!parsed.success) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn(`[hero_video] hotel ${row.slug}: invalid payload — ${parsed.error.message}`);
    }
    return null;
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// concierge_advice (jsonb) — bloc obligatoire « Le Conseil du Concierge »
// (CDC §2 + ADR-0011 + EDITORIAL_VOICE.md §4 bloc 8).
// ---------------------------------------------------------------------------

const CONCIERGE_TIP_FOR = ['room', 'dining', 'timing', 'access', 'service', 'wellness'] as const;

/**
 * Compteur de mots tolérant : on découpe sur tout ce qui n'est ni
 * lettre ni chiffre. Suffisant pour la validation 60-90 mots ; ne
 * cherche pas à matcher exactement une norme typographique.
 */
function countWords(s: string): number {
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0).length;
}

/**
 * Body envelope 50-110 words (relaxed from the initial 60-90 target
 * after the Phase 3 humanizer-pass audit on 106 hotels — voir
 * ADR-0011 Phase 3 notes). The Concierge voice tip is empirically
 * punchier than a 90-word paragraph; the lower 50 word floor keeps
 * the bloc substantial enough to feel like real concierge advice
 * rather than a one-liner.
 */
const ConciergeAdviceLocaleSchema = z.object({
  title: z.string().min(1).max(120),
  body: z
    .string()
    .min(1)
    .refine(
      (b) => {
        const n = countWords(b);
        return n >= 50 && n <= 110;
      },
      { message: 'concierge_advice.body must be 50-110 words' },
    ),
  tip_for: z.enum(CONCIERGE_TIP_FOR),
});

const ConciergeAdviceSchema = z.object({
  fr: ConciergeAdviceLocaleSchema,
  en: ConciergeAdviceLocaleSchema.optional(),
});

export interface LocalisedConciergeAdvice {
  readonly title: string;
  readonly body: string;
  readonly tipFor: (typeof CONCIERGE_TIP_FOR)[number];
}

/**
 * Returns the « Conseil du Concierge » bloc for the requested locale.
 * Falls back to FR if the EN payload is missing (the FR voice is
 * canonical and the EN copy is generated from it — never the other
 * way around).
 *
 * Returns `null` for hotels that have not yet been processed by the
 * Phase 3 humanizer-pass — the UI component is a no-op in that case.
 */
// ---------------------------------------------------------------------------
// factual_summary_fr / _en (text) — CDC §2.3 (IA-ready summary)
// ---------------------------------------------------------------------------

/**
 * Soft length window for the CDC §2.3 "factual summary" surfaced under
 * the H1 of every hotel detail page. Editorial pipeline targets
 * 130-150 chars (the LLM-friendly slot — fits a citation snippet in
 * AI Overviews + Perplexity exactly once), but legacy rows may be
 * shorter or longer; the reader returns the value verbatim and the
 * component is responsible for the visible warning.
 */
const FACTUAL_SUMMARY_MIN_CHARS = 110;
const FACTUAL_SUMMARY_MAX_CHARS = 165;

export interface HotelFactualSummary {
  /** Verbatim text as stored — no normalisation. */
  readonly text: string;
  /** `true` when `text.length` ∈ [110, 165] (CDC §2.3 enveloppe empirique). */
  readonly isWithinTarget: boolean;
}

/**
 * Returns the factual summary for the requested locale, falling back
 * to the FR canonical when the locale-specific column is empty. The
 * UI component (`<FactualSummary>`) trusts the verbatim text but uses
 * `isWithinTarget` to surface an editorial warning in non-production
 * environments (CDC §2.3 enforcement).
 *
 * Returns `null` when no summary is set at all — the page falls back
 * to the truncated `description` in that case (pre-migration 0041
 * behaviour preserved).
 */
export function readFactualSummary(
  row: HotelDetailRow,
  locale: SupportedLocale,
): HotelFactualSummary | null {
  const raw = pickLocalizedText(locale, row.factual_summary_fr, row.factual_summary_en);
  if (raw === null) return null;
  const text = raw.trim();
  if (text.length === 0) return null;
  return {
    text,
    isWithinTarget:
      text.length >= FACTUAL_SUMMARY_MIN_CHARS && text.length <= FACTUAL_SUMMARY_MAX_CHARS,
  };
}

export function readConciergeAdvice(
  row: HotelDetailRow,
  locale: SupportedLocale,
): LocalisedConciergeAdvice | null {
  const parsed = ConciergeAdviceSchema.safeParse(row.concierge_advice);
  if (!parsed.success) {
    if (
      process.env['NODE_ENV'] !== 'production' &&
      row.concierge_advice !== null &&
      row.concierge_advice !== undefined
    ) {
      console.warn(
        `[concierge_advice] hotel ${row.slug}: invalid payload — ${parsed.error.message}`,
      );
    }
    return null;
  }
  // EN reads the EN payload when present, otherwise falls back to FR
  // (FR is canonical — EN is generated from it, never the other way
  // around). DE/ES/IT collapse to FR for the same reason until the
  // Phase 3 translations pipeline runs on the corpus.
  const pick = pickByLocale(locale, parsed.data.fr, parsed.data.en ?? parsed.data.fr);
  return {
    title: pick.title,
    body: pick.body,
    tipFor: pick.tip_for,
  };
}

// ---------------------------------------------------------------------------
// featured_reviews (jsonb) — CDC §2.10 (editorial pull-quotes)
// ---------------------------------------------------------------------------

/**
 * Publication-date guard: ISO-8601 `YYYY-MM-DD`, leap years not
 * validated at this level (Zod's `z.string().date()` would refuse
 * `2024-02-30` but is a Zod 3.23+ feature; we ship a self-contained
 * regex to keep the runtime predictable across Zod versions).
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * HTTPS-only URL guard reused from the awards schema spirit. We
 * accept up to 2048 chars to fit real-world long URLs (Forbes
 * Travel Guide query-stringed canonical links can exceed 200).
 */
const HttpsUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith('https://'), { message: 'review url must be https' });

const FeaturedReviewSchema = z
  .object({
    source: z.string().min(1).max(120),
    source_url: HttpsUrlSchema.optional(),
    author: z.string().min(1).max(160).optional(),
    quote_fr: z.string().min(1).max(500).optional(),
    quote_en: z.string().min(1).max(500).optional(),
    rating: z.number().min(0).max(100).optional(),
    max_rating: z.number().int().min(1).max(100).optional(),
    date_iso: z.string().regex(ISO_DATE_REGEX).optional(),
  })
  .refine((r) => r.quote_fr !== undefined || r.quote_en !== undefined, {
    message: 'at least one of quote_fr/quote_en is required',
  })
  .refine((r) => (r.rating !== undefined ? r.max_rating !== undefined : true), {
    message: 'rating requires max_rating',
  })
  .refine(
    (r) => (r.rating !== undefined && r.max_rating !== undefined ? r.rating <= r.max_rating : true),
    { message: 'rating must be ≤ max_rating' },
  );

const FeaturedReviewsSchema = z.array(FeaturedReviewSchema);

export interface LocalisedFeaturedReview {
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly author: string | null;
  readonly quote: string;
  readonly rating: number | null;
  readonly maxRating: number | null;
  readonly dateIso: string | null;
}

/**
 * Returns the editorial featured review quotes for the hotel,
 * localized. Empty array is a valid "no curated quotes yet" state.
 *
 * Sort order: by `date_iso` descending (most recent first), with
 * date-less entries appended at the end in source order. This
 * matches the editorial expectation that the freshest accolade
 * lands at the top of the block — and it's the order LLM
 * ingestion will prefer for `Hotel.review[]`.
 *
 * Cap: callers decide how many to render; the JSON-LD builder caps
 * at 5 (Google's Rich Results sweet spot) and the UI component
 * caps at 3 (visual density). We intentionally do NOT cap here.
 */
export function readFeaturedReviews(
  row: HotelDetailRow,
  locale: SupportedLocale,
): readonly LocalisedFeaturedReview[] {
  const parsed = FeaturedReviewsSchema.safeParse(row.featured_reviews);
  if (!parsed.success) return [];

  const localized: LocalisedFeaturedReview[] = [];
  for (const r of parsed.data) {
    const quote = pickLocalizedText(locale, r.quote_fr, r.quote_en);
    // The schema refinement guarantees at least one quote is present;
    // narrow defensively for TypeScript without an assertion.
    if (quote === null) continue;
    localized.push({
      source: r.source,
      sourceUrl: r.source_url ?? null,
      author: r.author ?? null,
      quote,
      rating: r.rating ?? null,
      maxRating: r.max_rating ?? null,
      dateIso: r.date_iso ?? null,
    });
  }

  return localized.sort((left, right) => {
    if (left.dateIso === null && right.dateIso === null) return 0;
    if (left.dateIso === null) return 1;
    if (right.dateIso === null) return -1;
    return right.dateIso.localeCompare(left.dateIso);
  });
}

/**
 * Editorial indicative price range for a room category.
 *
 * Stored in jsonb to keep the shape one-sided ("from 1 200 €", no
 * upper bound) and to carry a currency code per row (later useful when
 * we wire a multi-currency selector, cf. Phase 11+).
 *
 * Amounts are in the currency's **minor unit** (cents for EUR/USD,
 * pence for GBP) — matches the existing Amadeus offer pricing
 * convention in `packages/integrations/amadeus`, so the codebase
 * keeps a single mental model for money.
 *
 * Optional `to` — when omitted, the UI renders "À partir de {from}"
 * rather than a closed range.
 */
const IndicativePriceMinorSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative().optional(),
    currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
  })
  .refine((p) => p.to === undefined || p.to >= p.from, {
    message: 'indicative_price_minor.to must be >= from',
  });

export interface LocalisedIndicativePrice {
  readonly fromMinor: number;
  readonly toMinor: number | null;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
}

export interface HotelRoomRow {
  readonly id: string;
  readonly slug: string;
  readonly room_code: string;
  readonly name: string | null;
  readonly description: string | null;
  readonly max_occupancy: number | null;
  readonly bed_type: string | null;
  readonly size_sqm: number | null;
  readonly amenities: readonly string[];
  readonly isSignature: boolean;
  readonly indicativePrice: LocalisedIndicativePrice | null;
  readonly displayOrder: number | null;
  /**
   * Image de carte (liste chambres fiche) : `hero_image` si présent, sinon
   * première image de la galerie `images[]`. `null` quand aucune photo n'est
   * renseignée (la carte retombe alors sur un placeholder sobre).
   */
  readonly cardImagePublicId: string | null;
  readonly cardImageAlt: string | null;
  /**
   * Per-room mini-gallery (kit `.mini-gallery`) : `hero_image` (en tête) +
   * toutes les entrées `images[]`, dédupliquées. Vide quand la chambre n'a
   * aucune photo — la carte retombe alors sur l'image de carte ou un repli.
   */
  readonly galleryImages: readonly { readonly publicId: string; readonly alt: string }[];
}

const HotelRoomDbRowSchema = z.object({
  id: z.string().uuid(),
  slug: stringOrEmpty,
  room_code: z.string(),
  name_fr: stringOrEmpty,
  name_en: stringOrEmpty,
  description_fr: stringOrEmpty,
  description_en: stringOrEmpty,
  max_occupancy: z.number().int().nullable(),
  bed_type: stringOrEmpty,
  size_sqm: z.number().int().nullable(),
  amenities: z.unknown().nullable().optional(),
  is_signature: z.boolean().nullable().optional(),
  indicative_price_minor: z.unknown().nullable().optional(),
  display_order: z.number().int().nullable().optional(),
  hero_image: stringOrEmpty,
  images: z.unknown().nullable().optional(),
});

const ROOM_LIST_COLUMNS =
  'id, slug, room_code, name_fr, name_en, description_fr, description_en, max_occupancy, bed_type, size_sqm, amenities, is_signature, indicative_price_minor, display_order, hero_image, images';

function readIndicativePrice(raw: unknown): LocalisedIndicativePrice | null {
  const parsed = IndicativePriceMinorSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    fromMinor: parsed.data.from,
    toMinor: parsed.data.to ?? null,
    currency: parsed.data.currency,
  };
}

/**
 * Résout l'image de carte d'une chambre pour la liste de la fiche : priorité au
 * `hero_image` (public_id Cloudinary), repli sur la première image de galerie.
 * Réutilise `GalleryImageSchema` (même forme `{public_id, alt_fr, alt_en}` que
 * les images chambre). Renvoie `null` si rien d'exploitable.
 */
function readRoomCardImage(
  row: z.infer<typeof HotelRoomDbRowSchema>,
  locale: SupportedLocale,
  fallbackAlt: string,
): { readonly publicId: string; readonly alt: string } | null {
  const gallery = readRoomGallery(row, locale, fallbackAlt);
  return gallery[0] ?? null;
}

/**
 * Mini-galerie d'une chambre (kit `.mini-gallery`) : toutes les photos
 * dédupliquées, triées intérieur/chambre en premier (pas de priorité aveugle
 * au `hero_image` quand c'est une salle de bain ou une vue).
 */
function readRoomGallery(
  row: z.infer<typeof HotelRoomDbRowSchema>,
  locale: SupportedLocale,
  fallbackAlt: string,
): readonly { readonly publicId: string; readonly alt: string }[] {
  const items: { publicId: string; alt: string; category: string | null }[] = [];
  const gallery = GalleryImagesSchema.safeParse(row.images);
  if (gallery.success) {
    for (const img of gallery.data) {
      items.push({
        publicId: img.public_id,
        alt: pickLocalizedText(locale, img.alt_fr, img.alt_en) ?? fallbackAlt,
        category: img.category ?? null,
      });
    }
  }
  const hero =
    typeof row.hero_image === 'string' && row.hero_image.length > 0 ? row.hero_image : null;
  const sorted = mergeRoomGalleryImages({
    heroImage: hero,
    images: items,
    heroAlt: fallbackAlt,
  });
  return sorted.map(({ publicId, alt }) => ({ publicId, alt }));
}

/** Slug shape: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (matches `hotels_slug_ck`). */
export function isValidSlug(candidate: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate);
}

export interface HotelDetail {
  readonly row: HotelDetailRow;
  readonly rooms: readonly HotelRoomRow[];
}

/**
 * Public read of a hotel by slug. Anon client → RLS policy
 * `hotels_select_published` filters out unpublished rows automatically.
 *
 * Tries the locale-matching slug column first; falls back to the other.
 */
/** Kit pilot EN slugs share one DB row keyed by the FR slug. */
const KIT_FETCH_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'les-airelles-gordes-en': 'les-airelles-gordes',
};

export async function getHotelBySlug(
  slug: string,
  locale: SupportedLocale,
): Promise<HotelDetail | null> {
  if (!isValidSlug(slug)) return null;

  // E2E / dev seam — short-circuit before touching Supabase. Activated
  // exclusively via `MCH_E2E_FAKE_HOTEL_ID`; see
  // `dev-fake-hotel-detail.ts` for the synthetic row.
  const fake = getFakeHotelDetailBySlug(slug, locale);
  if (fake !== null) return fake;

  try {
    const supabase = await createSupabaseServerClient();

    // V2 locales (DE/ES/IT) reuse the FR slug — `hotels.slug_<locale>`
    // columns do not exist yet (cf. ADR-0012 §Phase 3 + runbook).
    const primaryColumn = pickByLocale(locale, 'slug', 'slug_en');
    const fallbackColumn = pickByLocale(locale, 'slug_en', 'slug');

    const aliasSlug = KIT_FETCH_SLUG_ALIASES[slug];

    let row = await supabase
      .from('hotels')
      .select(HOTEL_COLUMNS)
      .eq(primaryColumn, slug)
      .maybeSingle();

    if (!row.data) {
      row = await supabase
        .from('hotels')
        .select(HOTEL_COLUMNS)
        .eq(fallbackColumn, slug)
        .maybeSingle();
    }

    if (!row.data && aliasSlug !== undefined) {
      const aliasPrimary = await supabase
        .from('hotels')
        .select(HOTEL_COLUMNS)
        .eq(primaryColumn, aliasSlug)
        .maybeSingle();
      if (aliasPrimary.data) {
        row = aliasPrimary;
      } else {
        const aliasFallback = await supabase
          .from('hotels')
          .select(HOTEL_COLUMNS)
          .eq(fallbackColumn, aliasSlug)
          .maybeSingle();
        if (aliasFallback.data) {
          row = aliasFallback;
        } else if (aliasPrimary.error !== null) {
          row = aliasPrimary;
        } else {
          row = aliasFallback;
        }
      }
    }

    if (row.error || !row.data) {
      if (process.env['NODE_ENV'] !== 'production' && row.error) {
        // Surfaces PostgREST errors (missing columns, RLS denials, network
        // failures) at dev-time. Silent in production to keep logs clean.
        console.warn('[getHotelBySlug] no row', { slug, locale, error: row.error });
      }
      return null;
    }

    const parsed = HotelDetailRowSchema.safeParse(row.data);
    if (!parsed.success) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn('[getHotelBySlug] parse error', parsed.error.flatten());
      }
      return null;
    }
    if (!parsed.data.is_published) return null;

    // Order rooms by:
    //   1. `display_order` (NULLS LAST) — editorial override,
    //   2. `is_signature DESC` — signature suite always above the
    //      generic categories when the editor hasn't set an explicit
    //      order,
    //   3. `id` — stable tie-breaker so the SSR/ISR output is
    //      deterministic across renders.
    const roomsRes = await supabase
      .from('hotel_rooms')
      .select(ROOM_LIST_COLUMNS)
      .eq('hotel_id', parsed.data.id)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('is_signature', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true });

    const rooms: HotelRoomRow[] = [];
    if (!roomsRes.error && Array.isArray(roomsRes.data)) {
      for (const raw of roomsRes.data) {
        const r = HotelRoomDbRowSchema.safeParse(raw);
        if (!r.success) continue;
        const roomName = pickLocalizedText(locale, r.data.name_fr, r.data.name_en);
        const cardImage = readRoomCardImage(r.data, locale, roomName ?? r.data.room_code);
        rooms.push({
          id: r.data.id,
          slug: r.data.slug ?? r.data.room_code,
          room_code: r.data.room_code,
          name: roomName,
          description: pickLocalizedText(locale, r.data.description_fr, r.data.description_en),
          max_occupancy: r.data.max_occupancy,
          bed_type: r.data.bed_type,
          size_sqm: r.data.size_sqm,
          amenities: readStringList(r.data.amenities, locale),
          isSignature: r.data.is_signature === true,
          indicativePrice: readIndicativePrice(r.data.indicative_price_minor),
          displayOrder: r.data.display_order ?? null,
          cardImagePublicId: cardImage?.publicId ?? null,
          cardImageAlt: cardImage?.alt ?? null,
          galleryImages: readRoomGallery(r.data, locale, roomName ?? r.data.room_code),
        });
      }
    }

    // LOCAL-ONLY editorial sandbox. When `MCH_LOCAL_FIXTURE` is set, the
    // Airelles Gordes fiche is patched in-memory with the curated
    // "golden template" content (never persisted). No-op for every
    // other slug and in production (flag unset). See
    // `dev-override-airelles.ts`.
    if (isAirellesLocalOverrideEnabled()) {
      return applyAirellesLocalOverride({ row: parsed.data, rooms }, locale);
    }

    return { row: parsed.data, rooms };
  } catch (e) {
    // Degraded env (CI smoke, preview without Supabase) — render 404
    // instead of crashing the route.
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[getHotelBySlug] failed:', e);
    }
    return null;
  }
}

/** Pre-renderable list of slugs (FR + EN), for `generateStaticParams`. */
export interface PublishedHotelSlug {
  readonly slugFr: string;
  readonly slugEn: string | null;
  /**
   * ISO 8601 `updated_at` value (B9). Used as `<lastmod>` in the
   * hotels sub-sitemap and as the `dateModified` signal for the
   * hotel JSON-LD. `null` when the upstream row has no `updated_at`
   * column populated (legacy seed rows pre-migration 0001).
   */
  readonly updatedAt: string | null;
}

/**
 * Catalog summary used by GEO/LLM surfaces (llms.txt, llms-full.txt). Carries
 * only the strict minimum to build a one-line description per hotel — keeps
 * the LLM corpus compact (no descriptions, no awards).
 */
export interface PublishedHotelSummary {
  readonly slugFr: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string;
  readonly stars: number;
  readonly isPalace: boolean;
  readonly priority: 'P0' | 'P1' | 'P2';
}

/**
 * Service-role read for build-time (`generateStaticParams`) and `force-static`
 * route handlers (sitemap). No request cookies needed; we re-apply the same
 * `is_published = true` filter that the RLS policy `hotels_select_published`
 * enforces for anon reads.
 */
export async function listPublishedHotelSlugs(): Promise<readonly PublishedHotelSlug[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('slug, slug_en, updated_at')
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .limit(500);
    if (error || !Array.isArray(data)) return [];
    const out: PublishedHotelSlug[] = [];
    for (const raw of data) {
      const r = raw as { slug?: unknown; slug_en?: unknown; updated_at?: unknown };
      const slug = r.slug;
      const slugEn = r.slug_en;
      if (typeof slug === 'string' && isValidSlug(slug)) {
        out.push({
          slugFr: slug,
          slugEn: typeof slugEn === 'string' && isValidSlug(slugEn) ? slugEn : null,
          updatedAt:
            typeof r.updated_at === 'string' && r.updated_at.length > 0 ? r.updated_at : null,
        });
      }
    }
    return out;
  } catch {
    // No Supabase env (CI smoke, preview) — prerender no slug at build
    // time. The dynamic page still resolves at request time via the
    // seam or the regular Supabase path.
    return [];
  }
}

/**
 * Indexable hotel slugs — same shape as `listPublishedHotelSlugs` but
 * additionally filters out catalog-only "stub" sheets that exist
 * solely to feed the rankings combinatorial matrix
 * (`scripts/editorial-pilot/src/import/import-atout-france-5stars.ts`).
 *
 * Indexability rule (Phase 1, May 2026 — `AGENTS.md §4ter`):
 *   Two paths — see `apps/web/src/server/hotels/indexability.ts`.
 *     1. Photo-rich (legacy): hero + (≥5 gallery photos OR ≥1 section)
 *     2. Editorial-only (Phase 1): ≥1 section OR full publish-gate set
 *        (description_fr ≥ 600, factual_summary_fr ≥ 100, concierge_advice
 *        non-null, faq_content ≥ 10 items).
 *
 * Used by the public sitemap (`/sitemaps/hotels.xml`) so Google never
 * spends crawl budget on stub URLs that we mark `noindex` server-side.
 * MUST stay in lockstep with the `isIndexable` predicate in
 * `apps/web/src/app/[locale]/hotel/[slug]/page.tsx#generateMetadata`
 * and `apps/web/src/server/hotels/list-indexable-for-llms.ts` —
 * the shared `isHotelIndexable` helper guarantees that.
 *
 * Cap raised from 500 → 5000 (May 2026, post Phase 1 publish flip:
 * 615 → 2134 published rows).
 */
export async function listIndexableHotelSlugs(): Promise<readonly PublishedHotelSlug[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(
        'slug, slug_en, hero_image, gallery_images, long_description_sections, description_fr, factual_summary_fr, concierge_advice, faq_content, updated_at',
      )
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .limit(5000);
    if (error || !Array.isArray(data)) return [];
    const out: PublishedHotelSlug[] = [];
    for (const raw of data) {
      const r = raw as {
        slug?: unknown;
        slug_en?: unknown;
        hero_image?: unknown;
        gallery_images?: unknown;
        long_description_sections?: unknown;
        description_fr?: unknown;
        factual_summary_fr?: unknown;
        concierge_advice?: unknown;
        faq_content?: unknown;
        updated_at?: unknown;
      };
      const slug = r.slug;
      if (typeof slug !== 'string' || !isValidSlug(slug)) continue;
      if (!isHotelIndexable(r)) continue;
      out.push({
        slugFr: slug,
        slugEn: typeof r.slug_en === 'string' && isValidSlug(r.slug_en) ? r.slug_en : null,
        updatedAt:
          typeof r.updated_at === 'string' && r.updated_at.length > 0 ? r.updated_at : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

const HotelSummaryRowSchema = z.object({
  slug: z.string(),
  slug_en: stringOrEmpty,
  name: z.string(),
  name_en: stringOrEmpty,
  city: z.string(),
  stars: z.number().int().min(1).max(5),
  is_palace: z.boolean(),
  priority: PrioritySchema,
});

/**
 * Index-card row used by `/[locale]/hotels` (catalog landing).
 * Carries the visual + filter signals (`region`, `hero_image`, short
 * description) that `PublishedHotelSummary` deliberately omits to
 * keep the LLM corpus compact.
 */
export interface PublishedHotelIndexCard {
  readonly slugFr: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string;
  readonly region: string;
  readonly stars: number;
  readonly isPalace: boolean;
  readonly priority: 'P0' | 'P1' | 'P2';
  readonly heroPublicId: string | null;
  readonly descriptionFr: string | null;
  readonly descriptionEn: string | null;
  // International scope signals (migration 0033 + ADR-0021). Nullable
  // because legacy FR-only rows can still ship without an explicit
  // country code; consumers fall back to "France" when null.
  readonly countryCode: string | null;
  readonly countryLabelFr: string | null;
  readonly countryLabelEn: string | null;
  // ── Affiliation facet slugs (migration 0063 + commit 5b23300) ────────
  // `facet_slug` values from verified `affiliations[]` entries, indexed by
  // `kind`. Feeds the `/marque/[brandSlug]` and `/label/[facetSlug]`
  // collection pages so they no longer rely solely on regex name matching
  // (which misses Ritz-Carlton, Kempinski, etc. that don't have a
  // `BRAND_FAMILIES` regex entry but DO have a structured affiliation).
  readonly affiliationBrandSlugs: readonly string[];
  readonly affiliationLabelSlugs: readonly string[];
  readonly affiliationRankingSlugs: readonly string[];
}

const HotelIndexRowSchema = z.object({
  slug: z.string(),
  slug_en: stringOrEmpty,
  name: z.string(),
  name_en: stringOrEmpty,
  city: z.string(),
  // International hotels have NULL region (migration 0033). Coerce to
  // empty string so the /hotels listing surfaces non-FR rows too.
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  stars: z.number().int().min(1).max(5),
  is_palace: z.boolean(),
  priority: PrioritySchema,
  hero_image: stringOrEmpty,
  description_fr: stringOrEmpty,
  description_en: stringOrEmpty,
  // International scope (migration 0033). Country labels are optional —
  // older rows may still be NULL while the backfill is in progress.
  country_code: z
    .string()
    .nullable()
    .transform((v) => (typeof v === 'string' && v.length === 2 ? v.toUpperCase() : null)),
  country_label_fr: stringOrEmpty,
  country_label_en: stringOrEmpty,
  // Verified affiliations (migration 0063). Parsed leniently via
  // `parseAffiliationsLenient` downstream so a corrupt row never breaks
  // the index listing.
  affiliations: z.unknown().nullable().optional(),
});

/**
 * Service-role read powering `/[locale]/hotels` and the `/categorie/*`
 * + `/destination/*` + `/marque/*` taxonomic landings. Ordered by
 * editorial `priority` then `name` so promoted properties always
 * surface above the fold.
 *
 * Capped at 200 — even the most aggressive scale plan stays under
 * that bound for the curated 5★/Palace catalogue.
 */
export async function listPublishedHotelsForIndex(
  limit = 200,
): Promise<readonly PublishedHotelIndexCard[]> {
  // Plafond élargi à 3000 — la migration 0063 + le scaffold international
  // ont gonflé le catalogue publié au-delà de 2000 lignes. Les pages
  // `/marque/[brandSlug]` et `/label/[facetSlug]` peuvent pointer sur
  // ~500 hôtels chacune (Ritz-Carlton ~100, Relais & Châteaux ~478),
  // et le default 200 est conservé pour le catalogue de tête.
  const safeLimit = Math.max(1, Math.min(3000, limit));
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(
        'slug, slug_en, name, name_en, city, region, stars, is_palace, priority, hero_image, description_fr, description_en, country_code, country_label_fr, country_label_en, affiliations',
      )
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(safeLimit);
    if (error || !Array.isArray(data)) return [];

    const out: PublishedHotelIndexCard[] = [];
    for (const raw of data) {
      const parsed = HotelIndexRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const row = parsed.data;
      if (!isValidSlug(row.slug)) continue;
      const affs = parseAffiliationsLenient(row.affiliations).filter((a) => a.verified === true);
      const brandSlugs: string[] = [];
      const labelSlugs: string[] = [];
      const rankingSlugs: string[] = [];
      for (const a of affs) {
        if (typeof a.facet_slug !== 'string' || a.facet_slug.length === 0) continue;
        if (a.kind === 'brand' && !brandSlugs.includes(a.facet_slug)) brandSlugs.push(a.facet_slug);
        else if (a.kind === 'label' && !labelSlugs.includes(a.facet_slug))
          labelSlugs.push(a.facet_slug);
        else if (a.kind === 'ranking' && !rankingSlugs.includes(a.facet_slug))
          rankingSlugs.push(a.facet_slug);
      }
      out.push({
        slugFr: row.slug,
        slugEn:
          row.slug_en !== null && row.slug_en.length > 0 && isValidSlug(row.slug_en)
            ? row.slug_en
            : null,
        nameFr: row.name,
        nameEn: row.name_en !== null && row.name_en.length > 0 ? row.name_en : null,
        city: row.city,
        region: row.region,
        stars: row.stars,
        isPalace: row.is_palace,
        priority: row.priority,
        heroPublicId: row.hero_image,
        descriptionFr: row.description_fr,
        descriptionEn: row.description_en,
        countryCode: row.country_code,
        countryLabelFr: row.country_label_fr,
        countryLabelEn: row.country_label_en,
        affiliationBrandSlugs: brandSlugs,
        affiliationLabelSlugs: labelSlugs,
        affiliationRankingSlugs: rankingSlugs,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * DB-filtered read for the `/marque/[brandSlug]` and `/label/[facetSlug]`
 * collection pages — bypasses the in-memory affiliation filter that hits
 * the PostgREST row cap for P2-only chains (e.g. Ritz-Carlton's 100
 * scaffold drafts all sit past the 1000-row default of
 * `listPublishedHotelsForIndex`).
 *
 * Uses the `@>` JSONB containment operator backed by the
 * `hotels_affiliations_gin` GIN index (migration 0063), so the planner
 * returns only matching rows without a full-table scan.
 *
 * The filter is `verified: true` AND `facet_slug = '<slug>'` — i.e.
 * exactly what `Hotel.award[]` / `Hotel.brand` emit in JSON-LD via
 * `@mch/seo/jsonld/affiliations`. This keeps the JSON-LD signal and the
 * `/marque|label/` listing in lockstep (no row appears on the collection
 * page that doesn't carry the matching distinction in its structured data).
 *
 * `kind` narrows the lookup for label vs brand vs ranking — used by the
 * `/label/[facetSlug]` route to avoid mixing kinds in a single page.
 */
export async function listPublishedHotelsByAffiliation(args: {
  readonly facetSlug: string;
  readonly kind?: 'brand' | 'label' | 'ranking' | 'guide';
  readonly limit?: number;
}): Promise<readonly PublishedHotelIndexCard[]> {
  const safeLimit = Math.max(1, Math.min(1500, args.limit ?? 1500));
  // ── Why an RPC instead of `.contains()` on the table?
  //
  // We need `affiliations @> '[{"facet_slug":"<slug>","verified":true,
  // "kind":"<kind>"}]'::jsonb`. The Supabase JS client's `.contains()`
  // helper serializes that payload in a way that PostgREST silently
  // ignores: direct SQL counted 478 Relais & Châteaux rows, the route
  // returned 0 (cf. migration 0065 header). The RPC sidesteps the
  // serialisation altogether by passing primitive `text` arguments to
  // a SQL function that builds the JSONB matcher server-side via
  // `jsonb_build_object`. PostgreSQL still uses the
  // `hotels_affiliations_gin` index — the `@>` predicate stays
  // index-pushable.
  //
  // Bonus: the RPC's own `limit greatest(1, least(p_limit, 3000))`
  // bypasses PostgREST's default `max-rows = 1000` cap that was hiding
  // every P2-only chain (Ritz-Carlton 100, R&C 478 …).
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('published_hotels_by_affiliation', {
      p_facet_slug: args.facetSlug,
      p_kind: typeof args.kind === 'string' ? args.kind : null,
      p_limit: safeLimit,
    });
    if (error || !Array.isArray(data)) return [];

    const out: PublishedHotelIndexCard[] = [];
    for (const raw of data) {
      const parsed = HotelIndexRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const row = parsed.data;
      if (!isValidSlug(row.slug)) continue;
      const affs = parseAffiliationsLenient(row.affiliations).filter((a) => a.verified === true);
      const brandSlugs: string[] = [];
      const labelSlugs: string[] = [];
      const rankingSlugs: string[] = [];
      for (const a of affs) {
        if (typeof a.facet_slug !== 'string' || a.facet_slug.length === 0) continue;
        if (a.kind === 'brand' && !brandSlugs.includes(a.facet_slug)) brandSlugs.push(a.facet_slug);
        else if (a.kind === 'label' && !labelSlugs.includes(a.facet_slug))
          labelSlugs.push(a.facet_slug);
        else if (a.kind === 'ranking' && !rankingSlugs.includes(a.facet_slug))
          rankingSlugs.push(a.facet_slug);
      }
      out.push({
        slugFr: row.slug,
        slugEn:
          row.slug_en !== null && row.slug_en.length > 0 && isValidSlug(row.slug_en)
            ? row.slug_en
            : null,
        nameFr: row.name,
        nameEn: row.name_en !== null && row.name_en.length > 0 ? row.name_en : null,
        city: row.city,
        region: row.region,
        stars: row.stars,
        isPalace: row.is_palace,
        priority: row.priority,
        heroPublicId: row.hero_image,
        descriptionFr: row.description_fr,
        descriptionEn: row.description_en,
        countryCode: row.country_code,
        countryLabelFr: row.country_label_fr,
        countryLabelEn: row.country_label_en,
        affiliationBrandSlugs: brandSlugs,
        affiliationLabelSlugs: labelSlugs,
        affiliationRankingSlugs: rankingSlugs,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Service-role catalog read for GEO/LLM surfaces (`llms.txt`,
 * `llms-full.txt`). Returns up to `limit` published hotels ordered by
 * editorial priority then name. Mirrors `hotels_select_published` (anon RLS
 * filters `is_published = true`).
 */
export async function listPublishedHotelSummaries(
  limit = 50,
): Promise<readonly PublishedHotelSummary[]> {
  // Guard against accidental fan-out — Supabase silently caps very large
  // limits, but an explicit bound documents intent.
  const safeLimit = Math.max(1, Math.min(500, limit));
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('slug, slug_en, name, name_en, city, stars, is_palace, priority')
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(safeLimit);
    if (error || !Array.isArray(data)) return [];

    const out: PublishedHotelSummary[] = [];
    for (const raw of data) {
      const parsed = HotelSummaryRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const row = parsed.data;
      if (!isValidSlug(row.slug)) continue;
      out.push({
        slugFr: row.slug,
        slugEn:
          row.slug_en !== null && row.slug_en.length > 0 && isValidSlug(row.slug_en)
            ? row.slug_en
            : null,
        nameFr: row.name,
        nameEn: row.name_en !== null && row.name_en.length > 0 ? row.name_en : null,
        city: row.city,
        stars: row.stars,
        isPalace: row.is_palace,
        priority: row.priority,
      });
    }
    return out;
  } catch {
    return [];
  }
}
