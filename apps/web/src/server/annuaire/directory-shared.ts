import 'server-only';

import { buildCloudinarySrc } from '@mch/ui';

import type { DirectoryMapPoint } from '@/components/directory/directory-map-layout';
import { env } from '@/lib/env';
import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import type { HotelGroupRow } from '@/server/destinations/cities';
import { detectBrand } from '@/server/hotels/get-related-hotels';

/**
 * Annuaire — shared hotel projection + ordering (ADR-0026).
 *
 * Both `/hotels/[pays]` and `/hotels/[pays]/[ville]` render the same
 * factual hotel card, so the row → view-model projection and the sort
 * comparator live here once.
 */

export interface DirectoryHotel {
  readonly id: string;
  /** Locale-aware slug for the `/hotel/[slug]` deep link. */
  readonly slug: string;
  /** Locale-aware display name. */
  readonly name: string;
  readonly city: string;
  readonly district: string | null;
  readonly isPalace: boolean;
  readonly stars: number;
  /** Truncated localised description (≤ 180 chars) for the card body. */
  readonly excerpt: string;
  /** WGS84 latitude — null when the row isn't geocoded (≈1% of catalogue). */
  readonly lat: number | null;
  /** WGS84 longitude — null when the row isn't geocoded. */
  readonly lng: number | null;
  /**
   * Ready-to-use thumbnail URL for the OTA-style result card, or null
   * when the hotel has no photo yet (Phase 1 — most of the catalogue).
   * Resolved server-side so the presentational card stays env-free.
   */
  readonly thumbnailUrl: string | null;
  /**
   * Hotel-group family detected from the name (Aman, Four Seasons,
   * Relais & Châteaux brands…), or null when the name matches no known
   * family. Drives the "Marque" facet of the Booking-style filter rail.
   */
  readonly brand: { readonly slug: string; readonly label: string } | null;
}

/** Cloudinary transform for the directory result thumbnail (4:3, ~440×330 @2x). */
const THUMB_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_440,h_330';

/**
 * Resolve a hotel's `hero_image` into a directory thumbnail URL.
 *
 * - `null` / empty → `null` (the card renders an elegant placeholder).
 * - absolute URL (legacy external hotlink) → returned as-is.
 * - Cloudinary public_id → wrapped via `buildCloudinarySrc`.
 *
 * Mirrors `resolveHeroUrl` on the hotel + itinerary pages (skill
 * `photo-pipeline` §fallback).
 */
function resolveThumbnailUrl(heroImage: string | null): string | null {
  if (heroImage === null || heroImage.length === 0) return null;
  if (heroImage.startsWith('http://') || heroImage.startsWith('https://')) return heroImage;
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined) return null;
  return buildCloudinarySrc({ cloudName, publicId: heroImage, transforms: THUMB_TRANSFORMS });
}

const PRIORITY_RANK: Record<HotelGroupRow['priority'], number> = { P0: 0, P1: 1, P2: 2 };

function pickName(row: HotelGroupRow, locale: SupportedLocale): string {
  return pickByLocale(locale, row.name, row.name_en ?? row.name);
}

function pickSlug(row: HotelGroupRow, locale: SupportedLocale): string {
  const en = row.slug_en;
  return pickByLocale(locale, row.slug, en !== null && en.length > 0 ? en : row.slug);
}

function pickExcerpt(row: HotelGroupRow, locale: SupportedLocale): string {
  const raw = (pickLocalizedText(locale, row.description_fr, row.description_en) ?? '').trim();
  if (raw.length === 0) return '';
  const max = 180;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).replace(/[\s,;.:!?-]+$/u, '')}…`;
}

export function toDirectoryHotel(row: HotelGroupRow, locale: SupportedLocale): DirectoryHotel {
  return {
    id: row.id,
    slug: pickSlug(row, locale),
    name: pickName(row, locale),
    city: row.city,
    district: row.district,
    isPalace: row.is_palace,
    stars: row.stars,
    excerpt: pickExcerpt(row, locale),
    lat: row.latitude,
    lng: row.longitude,
    thumbnailUrl: resolveThumbnailUrl(row.hero_image),
    brand: detectBrand(row.name),
  };
}

/**
 * Project the geolocated subset of a hotel list into map markers for
 * `<DirectoryMapLayout>`. Hotels without coordinates are skipped (they
 * still render in the indexable list). `pathFor` resolves the
 * locale-aware fiche path, keeping this helper free of any navigation
 * coupling and trivially testable.
 */
export function toDirectoryMapPoints(
  hotels: readonly DirectoryHotel[],
  pathFor: (slug: string) => string,
): DirectoryMapPoint[] {
  const points: DirectoryMapPoint[] = [];
  for (const hotel of hotels) {
    if (hotel.lat === null || hotel.lng === null) continue;
    // Drop unset "null island" coordinates (lat≈0, lng≈0): they aren't a
    // real location and otherwise blow up the map's fitBounds, zooming the
    // whole continent out to fit a point off the African coast.
    if (Math.abs(hotel.lat) < 0.01 && Math.abs(hotel.lng) < 0.01) continue;
    points.push({
      id: hotel.id,
      name: hotel.name,
      url: pathFor(hotel.slug),
      lat: hotel.lat,
      lng: hotel.lng,
      isPalace: hotel.isPalace,
    });
  }
  return points;
}

/**
 * Canonical hotel ordering for the directory: editorial priority
 * (P0 → P2), then Palaces first, then localised name. Returns a new
 * sorted array (does not mutate the input).
 */
export function sortDirectoryRows(
  rows: readonly HotelGroupRow[],
  locale: SupportedLocale,
): readonly HotelGroupRow[] {
  return [...rows].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    if (a.is_palace !== b.is_palace) return a.is_palace ? -1 : 1;
    return pickByLocale(locale, a.name, a.name_en ?? a.name).localeCompare(
      pickByLocale(locale, b.name, b.name_en ?? b.name),
      locale,
    );
  });
}
