import 'server-only';

import { AIRELLES_PROMOTE_SLUG, resolveAirellesGoldenRoom } from '@mch/domain/editorial';

import type { HotelRoomDetailRow } from '@/server/hotels/get-room-by-slug';
import type { HotelRoomRow, SupportedLocale } from '@/server/hotels/get-hotel-by-slug';

export function isAirellesHotelSlug(slug: string, slugEn: string | null): boolean {
  if (slug === AIRELLES_PROMOTE_SLUG) return true;
  return slugEn === AIRELLES_PROMOTE_SLUG || slug === `${AIRELLES_PROMOTE_SLUG}-en`;
}

function pickBedType(
  entry: { bed_type_fr: string; bed_type_en: string },
  locale: SupportedLocale,
): string {
  return locale === 'en' ? entry.bed_type_en : entry.bed_type_fr;
}

function pickAlt(
  entry: { hero_alt_fr: string; hero_alt_en: string },
  locale: SupportedLocale,
): string {
  return locale === 'en' ? entry.hero_alt_en : entry.hero_alt_fr;
}

/** Backfill missing photos / surface / bed from the golden catalogue (prod + local). */
export function enrichAirellesRoomRow<T extends HotelRoomRow>(room: T, locale: SupportedLocale): T {
  const golden = resolveAirellesGoldenRoom(room.slug, room.room_code);
  if (golden === undefined) return room;

  const bedType =
    room.bed_type !== null && room.bed_type !== '' ? room.bed_type : pickBedType(golden, locale);
  const sizeSqm = room.size_sqm ?? golden.size_sqm;
  const galleryImages =
    room.galleryImages.length > 0
      ? room.galleryImages.slice(0, 1)
      : [{ publicId: golden.hero_image, alt: pickAlt(golden, locale) }];

  return {
    ...room,
    name: room.name ?? (locale === 'en' ? golden.name_en : golden.name_fr),
    description:
      room.description ?? (locale === 'en' ? golden.description_en : golden.description_fr),
    bed_type: bedType,
    size_sqm: sizeSqm,
    max_occupancy: room.max_occupancy ?? golden.max_occupancy,
    isSignature: room.isSignature || golden.is_signature === true,
    cardImagePublicId: galleryImages[0]?.publicId ?? room.cardImagePublicId,
    cardImageAlt: galleryImages[0]?.alt ?? room.cardImageAlt,
    galleryImages,
  };
}

export function enrichAirellesRoomDetail(
  room: HotelRoomDetailRow,
  locale: SupportedLocale,
): HotelRoomDetailRow {
  const golden = resolveAirellesGoldenRoom(room.slug, room.roomCode);
  if (golden === undefined) return room;

  const bedType =
    room.bedType !== null && room.bedType !== '' ? room.bedType : pickBedType(golden, locale);
  const sizeSqm = room.sizeSqm ?? golden.size_sqm;
  const images =
    room.images.length > 0
      ? room.images.slice(0, 1)
      : [
          {
            publicId: golden.hero_image,
            alt: pickAlt(golden, locale),
            category: 'room' as const,
          },
        ];

  return {
    ...room,
    name: room.name.length > 0 ? room.name : locale === 'en' ? golden.name_en : golden.name_fr,
    shortDescription:
      room.shortDescription ?? (locale === 'en' ? golden.description_en : golden.description_fr),
    bedType,
    sizeSqm,
    maxOccupancy: room.maxOccupancy ?? golden.max_occupancy,
    isSignature: room.isSignature || golden.is_signature === true,
    heroImage: images[0]?.publicId ?? room.heroImage,
    images,
  };
}

export function enrichAirellesRooms(
  rooms: readonly HotelRoomRow[],
  locale: SupportedLocale,
): HotelRoomRow[] {
  return rooms.map((room) => enrichAirellesRoomRow(room, locale));
}
