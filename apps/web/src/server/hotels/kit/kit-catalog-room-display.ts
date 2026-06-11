import 'server-only';

import type { HotelRoomCardVM } from '@/components/hotel/hotel-rooms-grid';

import {
  getKitWaveRoomConfig,
  isKitWaveSlug,
  orderKitWaveRoomCards,
  resolveKitWaveRoomImages,
  type KitWaveRoomImagePair,
} from '@mch/domain/editorial';

export type { KitWaveRoomImagePair };

export function enrichKitWaveRoomCards(
  _hotelSlug: string,
  cards: readonly HotelRoomCardVM[],
  _locale: 'fr' | 'en',
): HotelRoomCardVM[] {
  return [...cards];
}

export function orderCatalogKitRoomCards(
  hotelSlug: string,
  cards: readonly HotelRoomCardVM[],
): HotelRoomCardVM[] {
  if (!isKitWaveSlug(hotelSlug)) return [...cards];

  const orderedKeys = orderKitWaveRoomCards(
    hotelSlug,
    cards.map((card) => ({ id: card.id, slug: card.slug })),
  );
  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered: HotelRoomCardVM[] = [];
  for (const key of orderedKeys) {
    const card = byId.get(key.id);
    if (card !== undefined) ordered.push(card);
  }
  return ordered;
}

export function resolveCatalogKitRoomImages(
  hotelSlug: string,
  roomSlug: string,
  roomCode: string,
): KitWaveRoomImagePair | undefined {
  if (!isKitWaveSlug(hotelSlug)) return undefined;
  return resolveKitWaveRoomImages(hotelSlug, roomSlug, roomCode);
}

export function kitWaveConciergePickSlug(hotelSlug: string): string | null {
  const config = getKitWaveRoomConfig(hotelSlug);
  return config?.pickSlug ?? null;
}
