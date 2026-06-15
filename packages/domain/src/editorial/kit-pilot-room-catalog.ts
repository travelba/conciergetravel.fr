/**
 * Kit pilot room ordering + image counts for CDC audit (D15–D16).
 * Wave 5 slugs use {@link buildKitWaveRoomAuditContext}; Prince de Galles is the
 * second reference pilot with its own card priority map.
 */

import { AIRELLES_CONCIERGE_PICK_SLUG, AIRELLES_PROMOTE_SLUG } from './airelles-golden';
import {
  PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG,
  PRINCE_DE_GALLES_ROOM_CATALOG,
} from './prince-de-galles-rooms';
import { PRINCE_DE_GALLES_PROMOTE_SLUG } from './prince-de-galles-golden';
import {
  buildKitWaveRoomAuditContext,
  getKitWaveRoomConfig,
  isKitWaveSlug,
  kitWaveVisibleRoomSlugs,
  type KitWaveRoomAuditRow,
  type KitWaveRoomImagePair,
} from './kit-wave-room-catalog';

export { PRINCE_DE_GALLES_PROMOTE_SLUG };

/** DA § `#chambres` — Concierge pick first (mirrors `kit-airelles-display.ts`). */
const AIRELLES_GORDES_CARD_PRIORITY: readonly (readonly string[])[] = [
  [AIRELLES_CONCIERGE_PICK_SLUG, 'baron-de-simiane-suite'],
  ['chambre-deluxe-vallee', 'deluxe-room-valley-side', 'deluxe-vallee'],
  ['suite-vasarely', 'vasarely-suite'],
];

function orderKitRoomSlugsByPriority(
  roomSlugs: readonly string[],
  priority: readonly (readonly string[])[],
): readonly string[] {
  const slugSet = new Set(roomSlugs);
  const ordered: string[] = [];
  const used = new Set<string>();

  for (const aliases of priority) {
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

  return ordered;
}

export function kitAirellesGordesVisibleRoomSlugs(roomSlugs: readonly string[]): readonly string[] {
  return orderKitRoomSlugsByPriority(roomSlugs, AIRELLES_GORDES_CARD_PRIORITY).slice(0, 3);
}

export function buildAirellesGordesRoomAuditContext(dbRooms: readonly KitWaveRoomAuditRow[]): {
  readonly orderedRoomSlugs: readonly string[];
  readonly rooms: readonly KitWaveRoomAuditRow[];
} {
  const orderedRoomSlugs = kitAirellesGordesVisibleRoomSlugs(dbRooms.map((r) => r.slug));
  return { orderedRoomSlugs, rooms: dbRooms };
}

const PRINCE_DE_GALLES_CARD_PRIORITY: readonly (readonly string[])[] = [
  [PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG, 'ART-DECO-BALCONY'],
  ['suite-or', 'OR-SUITE'],
  ['suite-lalique', 'LALIQUE-SUITE'],
  ['chambre-art-deco-deluxe', 'ART-DECO-DELUXE'],
];

function princeDeGallesRoomImages(): Readonly<Record<string, KitWaveRoomImagePair>> {
  return Object.fromEntries(
    PRINCE_DE_GALLES_ROOM_CATALOG.map((entry) => [entry.slug, { hero: entry.hero_image }]),
  );
}

/** Top 3 room slugs as rendered in `#chambres` for Prince de Galles. */
export function kitPrinceDeGallesVisibleRoomSlugs(roomSlugs: readonly string[]): readonly string[] {
  const slugSet = new Set(roomSlugs);
  const ordered: string[] = [];
  const used = new Set<string>();

  for (const aliases of PRINCE_DE_GALLES_CARD_PRIORITY) {
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

export function buildPrinceDeGallesRoomAuditContext(dbRooms: readonly KitWaveRoomAuditRow[]): {
  readonly orderedRoomSlugs: readonly string[];
  readonly rooms: readonly KitWaveRoomAuditRow[];
} {
  const dbSlugs = dbRooms.map((r) => r.slug);
  const orderedRoomSlugs = kitPrinceDeGallesVisibleRoomSlugs(dbSlugs);
  const curated = princeDeGallesRoomImages();

  const rooms = dbRooms.map((row) => {
    const map = curated[row.slug];
    const curatedCount = map !== undefined ? 1 : 0;
    return {
      slug: row.slug,
      imageCount: Math.max(row.imageCount, curatedCount),
    };
  });

  return { orderedRoomSlugs, rooms };
}

/** Room audit context for kit pilots (wave 5 + Prince de Galles). */
export function buildKitPilotRoomAuditContext(
  slug: string,
  dbRooms: readonly KitWaveRoomAuditRow[],
): {
  readonly orderedRoomSlugs: readonly string[];
  readonly rooms: readonly KitWaveRoomAuditRow[];
} | null {
  if (slug === AIRELLES_PROMOTE_SLUG) {
    return buildAirellesGordesRoomAuditContext(dbRooms);
  }
  if (slug === PRINCE_DE_GALLES_PROMOTE_SLUG) {
    return buildPrinceDeGallesRoomAuditContext(dbRooms);
  }
  if (isKitWaveSlug(slug)) {
    return buildKitWaveRoomAuditContext(slug, dbRooms);
  }
  return null;
}

/** Visible room slugs for a kit pilot slug (audit + room photo scripts). */
export function kitPilotVisibleRoomSlugs(
  slug: string,
  roomSlugs: readonly string[],
): readonly string[] {
  if (slug === AIRELLES_PROMOTE_SLUG) {
    return kitAirellesGordesVisibleRoomSlugs(roomSlugs);
  }
  if (slug === PRINCE_DE_GALLES_PROMOTE_SLUG) {
    return kitPrinceDeGallesVisibleRoomSlugs(roomSlugs);
  }
  if (isKitWaveSlug(slug)) {
    return kitWaveVisibleRoomSlugs(slug, roomSlugs);
  }
  return roomSlugs.slice(0, 3);
}

/** Curated hero public_id for a kit pilot room slug (display map). */
export function resolveKitPilotRoomHeroPublicId(slug: string, roomSlug: string): string | null {
  if (slug === PRINCE_DE_GALLES_PROMOTE_SLUG) {
    const entry = PRINCE_DE_GALLES_ROOM_CATALOG.find((r) => r.slug === roomSlug);
    return entry?.hero_image ?? null;
  }
  const config = getKitWaveRoomConfig(slug);
  if (config === null) return null;
  return config.roomImages[roomSlug]?.hero ?? null;
}
