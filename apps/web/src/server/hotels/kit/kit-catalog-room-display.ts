import 'server-only';

import type { HotelRoomCardVM, HotelRoomFactLine } from '@/components/hotel/hotel-rooms-grid';

import {
  getKitWaveRoomConfig,
  isKitWaveSlug,
  orderKitWaveRoomCards,
  resolveKitWaveRoomImages,
  type KitWaveRoomImagePair,
} from '@mch/domain/editorial';

export type { KitWaveRoomImagePair };

export function enrichKitWaveRoomCards(
  hotelSlug: string,
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
  return orderKitWaveRoomCards(hotelSlug, cards);
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
