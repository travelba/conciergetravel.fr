import 'server-only';

import type { HotelRoomCardVM, HotelRoomFactLine } from '@/components/hotel/hotel-rooms-grid';

import {
  PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG,
  PRINCE_DE_GALLES_ROOM_CATALOG,
} from '@mch/domain/editorial';

export { PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG };

/** Curated `.rv2-facts` lines — sourced from `prince-de-galles-rooms.ts` / resource script. */
const PRINCE_DE_GALLES_KIT_ROOM_FACTS: Readonly<
  Record<
    string,
    {
      readonly areaFr: string;
      readonly areaEn: string;
      readonly bedFr: string;
      readonly bedEn: string;
    }
  >
> = Object.fromEntries(
  PRINCE_DE_GALLES_ROOM_CATALOG.map((entry) => [
    entry.slug,
    {
      areaFr: entry.size_sqm !== null ? `${entry.size_sqm} m²` : '',
      areaEn: entry.size_sqm !== null ? `${entry.size_sqm} sq m` : '',
      bedFr: entry.bed_type_fr,
      bedEn: entry.bed_type_en,
    },
  ]),
);

const PRINCE_DE_GALLES_IMAGE_PREFIX = 'cct/hotels/prince-de-galles-paris';

export function enrichPrinceDeGallesKitRoomCards(
  cards: readonly HotelRoomCardVM[],
  locale: 'fr' | 'en',
): HotelRoomCardVM[] {
  return cards.map((card) => {
    const curated = PRINCE_DE_GALLES_KIT_ROOM_FACTS[card.slug];
    if (curated === undefined) return card;
    const factLines: HotelRoomFactLine[] = [];
    const areaText = locale === 'en' ? curated.areaEn : curated.areaFr;
    const bedText = locale === 'en' ? curated.bedEn : curated.bedFr;
    if (areaText.length > 0) {
      factLines.push({ kind: 'area', text: areaText });
    }
    if (bedText.length > 0) {
      factLines.push({ kind: 'bed', text: bedText });
    }
    if (factLines.length === 0) return card;
    return { ...card, factLines, facts: factLines.map((f) => f.text) };
  });
}

/** Hero + optional second tile — aligned with `resource-prince-de-galles-rooms.ts` press-1..35. */
export interface PrinceDeGallesKitRoomImagePair {
  readonly hero: string;
  readonly second?: string;
}

/**
 * Curated Cloudinary ids keyed by `hotel_rooms.slug` OR `hotel_rooms.room_code`.
 * Room script uploads press-1..35 in catalogue order (5 frames per category).
 */
const PRINCE_DE_GALLES_KIT_ROOM_IMAGES: Readonly<Record<string, PrinceDeGallesKitRoomImagePair>> = {
  'ART-DECO-DELUXE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-1`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-2`,
  },
  'chambre-art-deco-deluxe': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-1`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-2`,
  },
  'ART-DECO-BALCONY': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-6`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-7`,
  },
  'chambre-art-deco-deluxe-balcon': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-6`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-7`,
  },
  'MOSAIC-SUITE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-11`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-12`,
  },
  'suite-mosaique': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-11`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-12`,
  },
  'MACASSAR-SUITE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-16`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-17`,
  },
  'suite-macassar': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-16`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-17`,
  },
  'SAPHIR-SUITE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-21`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-22`,
  },
  'suite-saphir': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-21`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-22`,
  },
  'OR-SUITE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-26`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-27`,
  },
  'suite-or': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-26`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-27`,
  },
  'LALIQUE-SUITE': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-32`,
  },
  'suite-lalique': {
    hero: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
    second: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-32`,
  },
};

/** Resolve curated hero/second by editorial slug or DB `room_code`. */
export function resolvePrinceDeGallesKitRoomImages(
  slug: string,
  roomCode: string,
): PrinceDeGallesKitRoomImagePair | undefined {
  return PRINCE_DE_GALLES_KIT_ROOM_IMAGES[slug] ?? PRINCE_DE_GALLES_KIT_ROOM_IMAGES[roomCode];
}

/** DA § `#chambres` — Concierge pick first, then signature suites, then remaining cards. */
const PRINCE_DE_GALLES_KIT_CARD_PRIORITY: readonly (readonly string[])[] = [
  [PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG, 'ART-DECO-BALCONY'],
  ['suite-or', 'OR-SUITE'],
  ['suite-lalique', 'LALIQUE-SUITE'],
  ['chambre-art-deco-deluxe', 'ART-DECO-DELUXE'],
];

/** Puts the Concierge pick and signature trio first; remaining cards keep their relative order. */
export function orderPrinceDeGallesKitRoomCards(
  cards: readonly HotelRoomCardVM[],
): HotelRoomCardVM[] {
  const used = new Set<string>();
  const ordered: HotelRoomCardVM[] = [];

  for (const aliases of PRINCE_DE_GALLES_KIT_CARD_PRIORITY) {
    const match = cards.find((c) => aliases.includes(c.slug) && !used.has(c.id));
    if (match !== undefined) {
      ordered.push(match);
      used.add(match.id);
    }
  }

  for (const card of cards) {
    if (!used.has(card.id)) {
      ordered.push(card);
      used.add(card.id);
    }
  }

  return ordered;
}
