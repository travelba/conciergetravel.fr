import 'server-only';

import { z } from 'zod';

import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { mergeRoomGalleryImages } from '@/lib/hotel/sort-room-display-images';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  enrichAirellesRoomDetail,
  isAirellesHotelSlug,
} from '@/server/hotels/enrich-airelles-rooms';
import { getFakeRoomBySlug } from '@/server/hotels/dev-fake-room-detail';
import {
  getHotelBySlug,
  isValidSlug,
  type HotelDetail,
  type LocalisedConciergeAdvice,
  type SupportedLocale,
} from '@/server/hotels/get-hotel-by-slug';

/**
 * Detailed room row consumed by `/hotel/[slug]/chambres/[roomSlug]` —
 * a strict superset of the list-card `HotelRoomRow`.
 *
 * Layered on top of `getHotelBySlug` so the parent hotel context (slug,
 * id, name, locale) is always available without a second round-trip and
 * the RLS contract is identical (anon SELECT → `is_published = true`).
 */

const stringOrEmpty = z
  .string()
  .nullish()
  .transform((v) => (typeof v === 'string' ? v : null));

/**
 * Mirrors the Cloudinary public_id grammar in `get-hotel-by-slug.ts`.
 * Keeps the value safely embeddable in URLs without escaping.
 */
const CloudinaryPublicIdSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/, {
    message: 'invalid Cloudinary public_id',
  });

const RoomImageSchema = z.object({
  public_id: CloudinaryPublicIdSchema,
  alt_fr: z.string().min(1).optional(),
  alt_en: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

const RoomImagesSchema = z.array(RoomImageSchema);

const IndicativePriceMinorDetailSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative().optional(),
    currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
  })
  .refine((p) => p.to === undefined || p.to >= p.from, {
    message: 'indicative_price_minor.to must be >= from',
  });

const HotelRoomDetailDbRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  room_code: z.string(),
  name_fr: stringOrEmpty,
  name_en: stringOrEmpty,
  description_fr: stringOrEmpty,
  description_en: stringOrEmpty,
  long_description_fr: stringOrEmpty,
  long_description_en: stringOrEmpty,
  max_occupancy: z.number().int().nullable(),
  bed_type: stringOrEmpty,
  size_sqm: z.number().int().nullable(),
  amenities: z.unknown().nullable().optional(),
  images: z.unknown().nullable().optional(),
  hero_image: stringOrEmpty,
  is_signature: z.boolean().nullable().optional(),
  indicative_price_minor: z.unknown().nullable().optional(),
  // 0043 — optional room-level Concierge advice; hotel block remains canonical.
  concierge_advice: z.unknown().nullable().optional(),
});

const ROOM_DETAIL_COLUMNS =
  'id, slug, room_code, name_fr, name_en, description_fr, description_en, long_description_fr, long_description_en, max_occupancy, bed_type, size_sqm, amenities, images, hero_image, is_signature, indicative_price_minor, concierge_advice';

export interface LocalisedRoomImage {
  readonly publicId: string;
  readonly alt: string;
  readonly category: string | null;
}

export interface RoomDetailIndicativePrice {
  readonly fromMinor: number;
  readonly toMinor: number | null;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
}

export interface HotelRoomDetailRow {
  readonly id: string;
  readonly slug: string;
  readonly roomCode: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly maxOccupancy: number | null;
  readonly bedType: string | null;
  readonly sizeSqm: number | null;
  readonly amenities: readonly string[];
  readonly heroImage: string | null;
  readonly images: readonly LocalisedRoomImage[];
  readonly isSignature: boolean;
  readonly indicativePrice: RoomDetailIndicativePrice | null;
  /**
   * Raw `concierge_advice` jsonb (parsed by `readRoomConciergeAdvice`).
   * Kept as `unknown` here so the room reader stays Zod-agnostic and
   * the validation lives in the shared `ConciergeAdviceSchema` (mirror
   * of the hotels-level shape — ADR-0011 + 0043).
   */
  readonly conciergeAdviceRaw: unknown;
}

export interface HotelRoomDetail {
  readonly hotel: HotelDetail;
  readonly room: HotelRoomDetailRow;
}

/** Localized list of amenity strings — accepts string[] or `{label_fr,label_en}[]`. */
function readAmenityList(raw: unknown, locale: SupportedLocale): readonly string[] {
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

function localizeImages(
  raw: unknown,
  locale: SupportedLocale,
  fallbackAlt: string,
): readonly LocalisedRoomImage[] {
  const parsed = RoomImagesSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.map((img) => ({
    publicId: img.public_id,
    alt: pickLocalizedText(locale, img.alt_fr, img.alt_en) ?? fallbackAlt,
    category: img.category ?? null,
  }));
}

function pickName(
  row: z.infer<typeof HotelRoomDetailDbRowSchema>,
  locale: SupportedLocale,
): string {
  return pickLocalizedText(locale, row.name_fr, row.name_en) ?? row.room_code;
}

function pickShortDescription(
  row: z.infer<typeof HotelRoomDetailDbRowSchema>,
  locale: SupportedLocale,
): string | null {
  return pickLocalizedText(locale, row.description_fr, row.description_en);
}

function pickLongDescription(
  row: z.infer<typeof HotelRoomDetailDbRowSchema>,
  locale: SupportedLocale,
): string | null {
  return pickLocalizedText(locale, row.long_description_fr, row.long_description_en);
}

function readIndicativePriceDetail(raw: unknown): RoomDetailIndicativePrice | null {
  const parsed = IndicativePriceMinorDetailSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    fromMinor: parsed.data.from,
    toMinor: parsed.data.to ?? null,
    currency: parsed.data.currency,
  };
}

function rowToDetail(
  raw: z.infer<typeof HotelRoomDetailDbRowSchema>,
  locale: SupportedLocale,
): HotelRoomDetailRow {
  const name = pickName(raw, locale);
  const localized = localizeImages(raw.images, locale, name);
  const heroRaw =
    typeof raw.hero_image === 'string' && raw.hero_image.length > 0 ? raw.hero_image : null;
  const sortedImages = mergeRoomGalleryImages({
    heroImage: heroRaw,
    images: localized,
    heroAlt: name,
  }).map((img) => ({
    publicId: img.publicId,
    alt: img.alt,
    category: img.category ?? null,
  }));
  return {
    id: raw.id,
    slug: raw.slug,
    roomCode: raw.room_code,
    name,
    shortDescription: pickShortDescription(raw, locale),
    longDescription: pickLongDescription(raw, locale),
    maxOccupancy: raw.max_occupancy,
    bedType: raw.bed_type,
    sizeSqm: raw.size_sqm,
    amenities: readAmenityList(raw.amenities, locale),
    heroImage: sortedImages[0]?.publicId ?? heroRaw,
    images: sortedImages,
    isSignature: raw.is_signature === true,
    indicativePrice: readIndicativePriceDetail(raw.indicative_price_minor),
    conciergeAdviceRaw: raw.concierge_advice ?? null,
  };
}

// ---------------------------------------------------------------------------
// concierge_advice (room-level — same shape as hotels, ADR-0011 + 0043)
// ---------------------------------------------------------------------------

const ROOM_CONCIERGE_TIP_FOR = [
  'room',
  'dining',
  'timing',
  'access',
  'service',
  'wellness',
] as const;

function countWords(s: string): number {
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0).length;
}

const RoomConciergeAdviceLocaleSchema = z.object({
  title: z.string().min(1).max(120),
  body: z
    .string()
    .min(1)
    .refine(
      (b) => {
        const n = countWords(b);
        return n >= 50 && n <= 110;
      },
      { message: 'room concierge_advice.body must be 50-110 words' },
    ),
  tip_for: z.enum(ROOM_CONCIERGE_TIP_FOR),
});

const RoomConciergeAdviceSchema = z.object({
  fr: RoomConciergeAdviceLocaleSchema,
  en: RoomConciergeAdviceLocaleSchema.optional(),
});

export function readRoomConciergeAdvice(
  room: HotelRoomDetailRow,
  locale: SupportedLocale,
): LocalisedConciergeAdvice | null {
  const parsed = RoomConciergeAdviceSchema.safeParse(room.conciergeAdviceRaw);
  if (!parsed.success) {
    if (
      process.env['NODE_ENV'] !== 'production' &&
      room.conciergeAdviceRaw !== null &&
      room.conciergeAdviceRaw !== undefined
    ) {
      console.warn(
        `[room concierge_advice] room ${room.slug}: invalid payload — ${parsed.error.message}`,
      );
    }
    return null;
  }
  const pickLocale: 'fr' | 'en' = locale === 'fr' ? 'fr' : 'en';
  const block = pickLocale === 'en' ? (parsed.data.en ?? parsed.data.fr) : parsed.data.fr;
  return { title: block.title, body: block.body, tipFor: block.tip_for };
}

/**
 * Room sub-page indexability guard (CDC §2 + ADR-0009).
 *
 * Returns `false` when the room sub-page is too thin to safely index:
 *   - gallery has fewer than 5 photos, OR
 *   - the long+short description body has fewer than 200 words.
 *
 * Sub-pages flagged as not-indexable still render to humans, but
 * `generateMetadata` returns `{ robots: { index: false, follow: false } }`
 * to keep cannibalisation and thin-content penalties off the parent
 * hotel page.
 */
export function isRoomSubpageIndexable(room: HotelRoomDetailRow): boolean {
  const gallerySize = room.images.length + (room.heroImage !== null ? 1 : 0);
  if (gallerySize < 5) return false;
  const longWords = room.longDescription !== null ? countWords(room.longDescription) : 0;
  const shortWords = room.shortDescription !== null ? countWords(room.shortDescription) : 0;
  return longWords + shortWords >= 200;
}

/**
 * Public read of a single room for `/hotel/[slug]/chambres/[roomSlug]`.
 *
 * Looks up the hotel first (anon RLS handles `is_published`), then the
 * room by `(hotel_id, slug)`. Returns `null` for invalid slugs, missing
 * hotels, missing rooms, or RLS-rejected rows.
 */
export async function getRoomBySlug(
  hotelSlug: string,
  roomSlug: string,
  locale: SupportedLocale,
): Promise<HotelRoomDetail | null> {
  if (!isValidSlug(hotelSlug) || !isValidSlug(roomSlug)) return null;

  // Dev/E2E seam — short-circuits when `MCH_E2E_FAKE_HOTEL_ID` is set and
  // the slug pair maps to a fixture. Keeps the room sub-page testable
  // without seeding `hotel_rooms` in Supabase.
  const fake = getFakeRoomBySlug(hotelSlug, roomSlug, locale);
  if (fake !== null) return fake;

  const hotel = await getHotelBySlug(hotelSlug, locale);
  if (!hotel) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('hotel_rooms')
      .select(ROOM_DETAIL_COLUMNS)
      .eq('hotel_id', hotel.row.id)
      .eq('slug', roomSlug)
      .maybeSingle();

    if (error || data === null) return null;

    const parsed = HotelRoomDetailDbRowSchema.safeParse(data);
    if (!parsed.success) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn('[getRoomBySlug] parse error', parsed.error.flatten());
      }
      return null;
    }
    const room = rowToDetail(parsed.data, locale);
    const enrichedRoom = isAirellesHotelSlug(hotel.row.slug, hotel.row.slug_en)
      ? enrichAirellesRoomDetail(room, locale)
      : room;
    return { hotel, room: enrichedRoom };
  } catch (e) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[getRoomBySlug] failed:', e);
    }
    return null;
  }
}

/** `(hotelSlug, roomSlug)` couple for `generateStaticParams`. */
export interface PublishedRoomSlug {
  readonly hotelSlugFr: string;
  readonly hotelSlugEn: string | null;
  readonly roomSlug: string;
  /**
   * ISO 8601 `updated_at` value (B9). Surfaced as `<lastmod>` in the
   * rooms sub-sitemap. Falls back to `null` for legacy rows.
   */
  readonly updatedAt: string | null;
  /**
   * Whether the room sub-page passes the `isRoomSubpageIndexable` guard
   * (≥ 5 photos AND ≥ 200 words FR). The rooms sub-sitemap MUST only list
   * indexable rooms — `generateMetadata` returns `noindex` otherwise, and a
   * sitemap that advertises `noindex` URLs is a Search Console "Indexed,
   * though blocked"/"Discovered – not indexed" smell. Computed on the FR
   * primary locale (the sitemap `<loc>` is the FR URL).
   */
  readonly indexable: boolean;
}

/**
 * Service-role read for build-time static-params generation.
 * Pre-renders every room of every published hotel, in FR + EN.
 */
export async function listPublishedRoomSlugs(): Promise<readonly PublishedRoomSlug[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotel_rooms')
      .select(
        'slug, updated_at, images, hero_image, long_description_fr, description_fr, hotel:hotels!inner(slug, slug_en, is_published, updated_at)',
      )
      .eq('hotel.is_published', true)
      .limit(2000);
    if (error || !Array.isArray(data)) return [];

    const out: PublishedRoomSlug[] = [];
    for (const raw of data) {
      const rec = raw as {
        slug?: unknown;
        updated_at?: unknown;
        images?: unknown;
        hero_image?: unknown;
        long_description_fr?: unknown;
        description_fr?: unknown;
        hotel?: unknown;
      };
      const roomSlug = rec.slug;
      const hotel = rec.hotel as
        | { slug?: unknown; slug_en?: unknown; updated_at?: unknown }
        | { slug?: unknown; slug_en?: unknown; updated_at?: unknown }[]
        | undefined;
      const hotelRow = Array.isArray(hotel) ? hotel[0] : hotel;
      if (typeof roomSlug !== 'string' || !isValidSlug(roomSlug)) continue;
      if (hotelRow === undefined) continue;
      const hotelSlug = hotelRow.slug;
      const hotelSlugEn = hotelRow.slug_en;
      if (typeof hotelSlug !== 'string' || !isValidSlug(hotelSlug)) continue;
      // Pick the later of room.updated_at vs hotel.updated_at — a
      // hotel-level change (new photos, FAQ rewrite) is a legitimate
      // freshness signal for every sub-page below it.
      const roomUpdated =
        typeof rec.updated_at === 'string' && rec.updated_at.length > 0 ? rec.updated_at : null;
      const hotelUpdated =
        typeof hotelRow.updated_at === 'string' && hotelRow.updated_at.length > 0
          ? hotelRow.updated_at
          : null;
      const updatedAt =
        roomUpdated !== null && hotelUpdated !== null
          ? roomUpdated > hotelUpdated
            ? roomUpdated
            : hotelUpdated
          : (roomUpdated ?? hotelUpdated);
      // Mirror `isRoomSubpageIndexable` on the raw row (FR primary locale):
      // ≥ 5 photos (gallery + hero) AND ≥ 200 words (long + short FR).
      const gallerySize =
        (Array.isArray(rec.images) ? rec.images.length : 0) +
        (typeof rec.hero_image === 'string' && rec.hero_image.length > 0 ? 1 : 0);
      const longWords =
        typeof rec.long_description_fr === 'string' ? countWords(rec.long_description_fr) : 0;
      const shortWords =
        typeof rec.description_fr === 'string' ? countWords(rec.description_fr) : 0;
      const indexable = gallerySize >= 5 && longWords + shortWords >= 200;

      out.push({
        hotelSlugFr: hotelSlug,
        hotelSlugEn:
          typeof hotelSlugEn === 'string' && isValidSlug(hotelSlugEn) ? hotelSlugEn : null,
        roomSlug,
        updatedAt,
        indexable,
      });
    }
    return out;
  } catch {
    return [];
  }
}
