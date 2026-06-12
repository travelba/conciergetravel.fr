/**
 * Kit wave 5 — shared room ordering + Cloudinary image maps (D15–D16).
 * Consumed by apps/web kit display and editorial-pilot CDC audit.
 */

import type { HotelRoomCardVM } from './kit-wave-room-types';

import {
  CHEVAL_BLANC_PARIS_CONCIERGE_PICK_SLUG,
  CHEVAL_BLANC_PARIS_IMAGE_PREFIX,
} from './cheval-blanc-paris-golden';
import { LE_BRISTOL_PARIS_CONCIERGE_PICK_SLUG } from './le-bristol-paris-golden';
import {
  LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG,
  LES_AIRELLES_COURCHEVEL_ROOM_CATALOG,
} from './les-airelles-courchevel-rooms';
import { LES_PRES_DEUGENIE_CONCIERGE_PICK_SLUG } from './les-pres-deugenie-golden';
import { SHANGRI_LA_PARIS_CONCIERGE_PICK_SLUG } from './shangri-la-paris-golden';
import { isKitWaveSlug, KIT_WAVE_SLUGS, type KitWaveSlug } from './kit-golden-loader';

export { isKitWaveSlug, KIT_WAVE_SLUGS, type KitWaveSlug };

export interface KitWaveRoomImagePair {
  readonly hero: string;
  readonly second?: string;
}

export interface KitWaveRoomAuditRow {
  readonly slug: string;
  readonly imageCount: number;
}

interface KitWaveRoomConfig {
  readonly pickSlug: string;
  readonly cardPriority: readonly (readonly string[])[];
  readonly roomImages: Readonly<Record<string, KitWaveRoomImagePair>>;
}

const PREFIX = {
  'cheval-blanc-paris': CHEVAL_BLANC_PARIS_IMAGE_PREFIX,
  'le-bristol-paris': 'cct/hotels/le-bristol-paris',
  'les-airelles-courchevel': 'cct/hotels/les-airelles-courchevel',
  'les-pres-deugenie': 'cct/hotels/les-pres-deugenie',
  'shangri-la-paris': 'cct/hotels/shangri-la-paris',
} as const satisfies Record<KitWaveSlug, string>;

function press(slug: KitWaveSlug, n: number): string {
  return `${PREFIX[slug]}/press-${String(n)}`;
}

function pair(slug: KitWaveSlug, heroN: number, secondN?: number): KitWaveRoomImagePair {
  const hero = press(slug, heroN);
  if (secondN === undefined) return { hero };
  return { hero, second: press(slug, secondN) };
}

const WAVE_ROOM_CONFIGS: Readonly<Record<KitWaveSlug, KitWaveRoomConfig>> = {
  'cheval-blanc-paris': {
    pickSlug: CHEVAL_BLANC_PARIS_CONCIERGE_PICK_SLUG,
    cardPriority: [
      [CHEVAL_BLANC_PARIS_CONCIERGE_PICK_SLUG],
      ['eiffel-suite'],
      ['pont-neuf-deluxe-room'],
    ],
    roomImages: {
      'seine-junior-suite': pair('cheval-blanc-paris', 9),
      'eiffel-suite': pair('cheval-blanc-paris', 19),
      'pont-neuf-deluxe-room': pair('cheval-blanc-paris', 8),
      'deluxe-room': pair('cheval-blanc-paris', 7),
    },
  },
  'le-bristol-paris': {
    pickSlug: LE_BRISTOL_PARIS_CONCIERGE_PICK_SLUG,
    cardPriority: [[LE_BRISTOL_PARIS_CONCIERGE_PICK_SLUG], ['suite-paris'], ['suite-azur']],
    roomImages: {
      'suite-eden': pair('le-bristol-paris', 9),
      'suite-paris': pair('le-bristol-paris', 8),
      'suite-azur': pair('le-bristol-paris', 19),
    },
  },
  'les-airelles-courchevel': {
    pickSlug: LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG,
    cardPriority: LES_AIRELLES_COURCHEVEL_ROOM_CATALOG.map((entry) => [entry.slug]),
    roomImages: Object.fromEntries(
      LES_AIRELLES_COURCHEVEL_ROOM_CATALOG.map((entry) => [entry.slug, { hero: entry.hero_image }]),
    ),
  },
  'les-pres-deugenie': {
    pickSlug: LES_PRES_DEUGENIE_CONCIERGE_PICK_SLUG,
    cardPriority: [
      [LES_PRES_DEUGENIE_CONCIERGE_PICK_SLUG],
      ['de-luxe-rooms'],
      ['classic-superior-room'],
    ],
    roomImages: {
      'terrace-room-with-onzen': pair('les-pres-deugenie', 27),
      'de-luxe-rooms': pair('les-pres-deugenie', 7),
      'classic-superior-room': pair('les-pres-deugenie', 8),
    },
  },
  'shangri-la-paris': {
    pickSlug: SHANGRI_LA_PARIS_CONCIERGE_PICK_SLUG,
    cardPriority: [[SHANGRI_LA_PARIS_CONCIERGE_PICK_SLUG], ['superior-room'], ['deluxe-room']],
    roomImages: {
      'terrace-eiffel-view-room': pair('shangri-la-paris', 19, 20),
      'superior-room': pair('shangri-la-paris', 6),
      'deluxe-room': pair('shangri-la-paris', 7),
      'terrace-room': pair('shangri-la-paris', 20),
      'eiffel-view-room': pair('shangri-la-paris', 19),
    },
  },
};

export function getKitWaveRoomConfig(slug: string): KitWaveRoomConfig | null {
  if (!isKitWaveSlug(slug)) return null;
  return WAVE_ROOM_CONFIGS[slug];
}

export function resolveKitWaveRoomImages(
  hotelSlug: string,
  roomSlug: string,
  roomCode: string,
): KitWaveRoomImagePair | undefined {
  const config = getKitWaveRoomConfig(hotelSlug);
  if (config === null) return undefined;
  return config.roomImages[roomSlug] ?? config.roomImages[roomCode];
}

/** Puts Concierge pick first, then signature trio; remaining cards keep relative order. */
export function orderKitWaveRoomCards(
  hotelSlug: string,
  cards: readonly HotelRoomCardVM[],
): HotelRoomCardVM[] {
  const config = getKitWaveRoomConfig(hotelSlug);
  if (config === null) return [...cards];

  const used = new Set<string>();
  const ordered: HotelRoomCardVM[] = [];

  for (const aliases of config.cardPriority) {
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

/** Top 3 room slugs as rendered in `#chambres` (pick first, then cardPriority). */
export function kitWaveVisibleRoomSlugs(
  hotelSlug: string,
  roomSlugs: readonly string[],
): readonly string[] {
  const config = getKitWaveRoomConfig(hotelSlug);
  if (config === null) return roomSlugs.slice(0, 3);

  const slugSet = new Set(roomSlugs);
  const ordered: string[] = [];
  const used = new Set<string>();

  for (const aliases of config.cardPriority) {
    const match = aliases.find((alias) => slugSet.has(alias) && !used.has(alias));
    if (match !== undefined) {
      ordered.push(match);
      used.add(match);
    }
  }

  for (const slug of roomSlugs) {
    if (!used.has(slug)) {
      ordered.push(slug);
      used.add(slug);
    }
  }

  return ordered.slice(0, 3);
}

/** Merge DB `hotel_rooms.images[]` counts with curated kit display map (audit D15). */
export function buildKitWaveRoomAuditContext(
  hotelSlug: string,
  dbRooms: readonly KitWaveRoomAuditRow[],
): {
  readonly orderedRoomSlugs: readonly string[];
  readonly rooms: readonly KitWaveRoomAuditRow[];
} {
  const config = getKitWaveRoomConfig(hotelSlug);
  const dbSlugs = dbRooms.map((r) => r.slug);
  const orderedRoomSlugs =
    config !== null ? kitWaveVisibleRoomSlugs(hotelSlug, dbSlugs) : dbSlugs.slice(0, 3);

  const rooms = dbRooms.map((row) => {
    const curated = config !== null ? config.roomImages[row.slug] : undefined;
    const curatedCount = curated !== undefined ? (curated.second !== undefined ? 2 : 1) : 0;
    return {
      slug: row.slug,
      imageCount: Math.max(row.imageCount, curatedCount),
    };
  });

  return { orderedRoomSlugs, rooms };
}

/** Room slugs that need a DB images[] patch when count is zero. */
export function listKitWaveRoomsNeedingDbImages(
  hotelSlug: string,
  dbRooms: readonly KitWaveRoomAuditRow[],
): readonly string[] {
  const config = getKitWaveRoomConfig(hotelSlug);
  if (config === null) return [];
  const visible = kitWaveVisibleRoomSlugs(
    hotelSlug,
    dbRooms.map((r) => r.slug),
  );
  return visible.filter((slug) => {
    const dbCount = dbRooms.find((r) => r.slug === slug)?.imageCount ?? 0;
    const curated = config.roomImages[slug];
    return dbCount < 1 && curated !== undefined;
  });
}
