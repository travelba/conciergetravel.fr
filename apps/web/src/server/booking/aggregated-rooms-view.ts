import 'server-only';

import type { Supplier } from '@mch/integrations/supplier';

import type { AggregatedRate, RateShoppingResult } from '@/server/booking/rate-shopping';
import type { HotelRoomRow } from '@/server/hotels/get-hotel-by-slug';

/**
 * Editorial "branchement" (Phase 4).
 *
 * Merges the supplier-agnostic rate-shopping output (`shopRates`) with the
 * editorial `hotel_rooms` catalogue into a single display model used by the
 * fiche / funnel.
 *
 * EEAT / indexability contract:
 *   - The indexable image is ALWAYS our curated Cloudinary editorial photo
 *     (`hotel_rooms.hero_image`), never a supplier-hosted image. RateHawk
 *     media is contractually non-indexable, so it is intentionally absent
 *     here; the non-indexed funnel reads `supplier_room_catalog` separately.
 *   - Title prefers the editorial room name (stable, human-validated) and
 *     falls back to the live supplier label only when a room is unmapped.
 */

export interface DisplayRoom {
  /** `hotel_rooms.id` when mapped to a canonical editorial room, else null. */
  readonly canonicalRoomId: string | null;
  readonly title: string;
  /** Curated Cloudinary public_id — safe to render on index,follow pages. */
  readonly indexableImagePublicId: string | null;
  readonly indexableImageAlt: string | null;
  readonly isSignature: boolean;
  /** Cheapest EUR price across suppliers, or null for editorial-only rooms. */
  readonly bestPriceMinor: number | null;
  readonly winningSupplier: Supplier | null;
  readonly rates: readonly AggregatedRate[];
}

/**
 * @param editorialRooms canonical editorial rooms (from `getHotelBySlug`).
 * @param aggregation    result of `shopRates` for the same hotel + stay.
 * @param includeEditorialOnly when true, editorial rooms without any live rate
 *   are appended (price null) so the fiche still lists the full catalogue.
 */
export function buildDisplayRooms(input: {
  readonly editorialRooms: readonly HotelRoomRow[];
  readonly aggregation: RateShoppingResult;
  readonly includeEditorialOnly?: boolean;
}): readonly DisplayRoom[] {
  const editorialById = new Map<string, HotelRoomRow>();
  for (const room of input.editorialRooms) editorialById.set(room.id, room);

  const out: DisplayRoom[] = [];
  const mappedEditorialIds = new Set<string>();

  for (const room of input.aggregation.rooms) {
    const editorial =
      room.canonicalRoomId !== null ? editorialById.get(room.canonicalRoomId) : undefined;
    if (editorial !== undefined) mappedEditorialIds.add(editorial.id);

    out.push({
      canonicalRoomId: room.canonicalRoomId,
      title: editorial?.name ?? room.label,
      indexableImagePublicId: editorial?.cardImagePublicId ?? null,
      indexableImageAlt: editorial?.cardImageAlt ?? null,
      isSignature: editorial?.isSignature ?? false,
      bestPriceMinor: room.best.priceMinor,
      winningSupplier: room.best.supplier,
      rates: room.all,
    });
  }

  if (input.includeEditorialOnly === true) {
    for (const room of input.editorialRooms) {
      if (mappedEditorialIds.has(room.id)) continue;
      out.push({
        canonicalRoomId: room.id,
        title: room.name ?? room.room_code,
        indexableImagePublicId: room.cardImagePublicId,
        indexableImageAlt: room.cardImageAlt,
        isSignature: room.isSignature,
        bestPriceMinor: null,
        winningSupplier: null,
        rates: [],
      });
    }
  }

  return out;
}
