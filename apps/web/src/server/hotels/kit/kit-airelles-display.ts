import 'server-only';

import type { HotelRoomCardVM, HotelRoomFactLine } from '@/components/hotel/hotel-rooms-grid';
import type {
  LocalisedAward,
  LocalisedSignatureExperience,
} from '@/server/hotels/get-hotel-by-slug';

import {
  ICON_AMEN_ACCESS,
  ICON_AMEN_CONCIERGE,
  ICON_AMEN_DINING,
  ICON_AMEN_ROOM,
  ICON_AMEN_SPA,
  ICON_CHECK,
} from './kit-html-utils';

/** Curated `.rv2-facts` lines aligned with `design/html-kit/les-airelles-gordes.html`. */
const AIRELLES_KIT_ROOM_FACTS: Readonly<
  Record<
    string,
    {
      readonly areaFr: string;
      readonly areaEn: string;
      readonly bedFr: string;
      readonly bedEn: string;
    }
  >
> = {
  'chambre-superieure-village': {
    areaFr: '30 m²',
    areaEn: '30 sq m',
    bedFr: 'Lit King size · vue village',
    bedEn: 'King-size bed · village view',
  },
  'chambre-deluxe-village': {
    areaFr: '35 m²',
    areaEn: '35 sq m',
    bedFr: 'Lit King size · vue village',
    bedEn: 'King-size bed · village view',
  },
  'chambre-superieure-vallee': {
    areaFr: '29 m²',
    areaEn: '29 sq m',
    bedFr: 'Lit King size · vue vallée',
    bedEn: 'King-size bed · valley view',
  },
  'chambre-deluxe-vallee': {
    areaFr: '34 m²',
    areaEn: '34 sq m',
    bedFr: 'Lit King size · vue vallée',
    bedEn: 'King-size bed · valley view',
  },
  'junior-suite': {
    areaFr: '40 m²',
    areaEn: '40 sq m',
    bedFr: 'Lit King size · vue vallée',
    bedEn: 'King-size bed · valley view',
  },
  'junior-suite-prestige': {
    areaFr: '48 m²',
    areaEn: '48 sq m',
    bedFr: 'Lit King size · coin salon',
    bedEn: 'King-size bed · sitting area',
  },
  'suite-a-une-chambre': {
    areaFr: '50 m²',
    areaEn: '50 sq m',
    bedFr: 'Lit King size · salon séparé',
    bedEn: 'King-size bed · separate living room',
  },
  'suite-a-une-chambre-terrasse': {
    areaFr: '64 m² · terrasse 23 m²',
    areaEn: '64 sq m · 23 sq m terrace',
    bedFr: 'Lit King size · vue vallée',
    bedEn: 'King-size bed · valley view',
  },
  'suite-vasarely': {
    areaFr: '60 m² · terrasse 33 m²',
    areaEn: '60 sq m · 33 sq m terrace',
    bedFr: 'Lit King size · vue vallée',
    bedEn: 'King-size bed · valley view',
  },
  'suite-baron-de-simiane': {
    areaFr: '91 m²',
    areaEn: '91 sq m',
    bedFr: 'Lit King size · terrasse privée',
    bedEn: 'King-size bed · private terrace',
  },
  'suite-duc-de-soubise': {
    areaFr: '102 m² · terrasse 34 m²',
    areaEn: '102 sq m · 34 sq m terrace',
    bedFr: 'Lit King size · deux chambres',
    bedEn: 'King-size bed · two bedrooms',
  },
  'maison-de-constance': {
    areaFr: '250 m² · jardin 1 000 m²',
    areaEn: '250 sq m · 1,000 sq m garden',
    bedFr: '4 chambres · piscine privée',
    bedEn: '4 bedrooms · private pool',
  },
};

export type AirellesKitAmenityIcon = 'concierge' | 'spa' | 'dining' | 'room' | 'daily' | 'access';

export interface AirellesKitAmenityBlock {
  readonly icon: AirellesKitAmenityIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

/** Six curated amenity blocks from `DA/les-airelles-gordes.html`. */
export const AIRELLES_KIT_AMENITY_BLOCKS: readonly AirellesKitAmenityBlock[] = [
  {
    icon: 'concierge',
    titleFr: 'Conciergerie 24h/24',
    titleEn: '24-hour concierge',
    descFr: 'Réception et conciergerie en continu, personnel multilingue, service de réveil.',
    descEn: 'Round-the-clock reception and concierge, multilingual staff, wake-up service.',
  },
  {
    icon: 'spa',
    titleFr: 'Spa & trois piscines',
    titleEn: 'Spa & three pools',
    descFr: 'Spa Airelles sous voûtes, piscine intérieure, hammam, sauna, salle de fitness.',
    descEn: 'Vaulted Airelles Spa, indoor pool, hammam, sauna and fitness room.',
  },
  {
    icon: 'dining',
    titleFr: 'Six restaurants & bar',
    titleEn: 'Six restaurants & bar',
    descFr: 'Restaurant gastronomique, table provençale, trattoria, salon de thé, bar.',
    descEn: 'Gourmet restaurant, Provençal table, trattoria, tea salon and bar.',
  },
  {
    icon: 'room',
    titleFr: 'Confort en chambre',
    titleEn: 'In-room comfort',
    descFr: 'Climatisation, minibar, coffre-fort, machine Nespresso, peignoirs et chaussons.',
    descEn: 'Air conditioning, minibar, safe, Nespresso machine, robes and slippers.',
  },
  {
    icon: 'daily',
    titleFr: 'Services du quotidien',
    titleEn: 'Daily services',
    descFr: 'Service de chambre quotidien, couverture, blanchisserie, consigne à bagages.',
    descEn: 'Daily housekeeping, turndown, laundry, luggage storage.',
  },
  {
    icon: 'access',
    titleFr: 'Pratique & accès',
    titleEn: 'Practical & access',
    descFr: 'Wi-Fi gratuit, ports USB, ascenseur, établissement non-fumeur.',
    descEn: 'Complimentary Wi-Fi, USB ports, lift, non-smoking property.',
  },
];

export function amenityIconHtml(icon: AirellesKitAmenityIcon): string {
  switch (icon) {
    case 'concierge':
      return ICON_AMEN_CONCIERGE;
    case 'spa':
      return ICON_AMEN_SPA;
    case 'dining':
      return ICON_AMEN_DINING;
    case 'room':
      return ICON_AMEN_ROOM;
    case 'daily':
      return ICON_CHECK;
    case 'access':
      return ICON_AMEN_ACCESS;
  }
}

export function enrichAirellesKitRoomCards(
  cards: readonly HotelRoomCardVM[],
  locale: 'fr' | 'en',
): HotelRoomCardVM[] {
  return cards.map((card) => {
    const curated = AIRELLES_KIT_ROOM_FACTS[card.slug];
    if (curated === undefined) return card;
    const factLines: HotelRoomFactLine[] = [
      { kind: 'area', text: locale === 'en' ? curated.areaEn : curated.areaFr },
      { kind: 'bed', text: locale === 'en' ? curated.bedEn : curated.bedFr },
    ];
    return { ...card, factLines, facts: factLines.map((f) => f.text) };
  });
}

const AIRELLES_IMAGE_PREFIX = 'cct/hotels/les-airelles-gordes';

/** Hero + optional second tile — aligned with gallery press-1..30 and room uploads press-21..30. */
export interface AirellesKitRoomImagePair {
  readonly hero: string;
  readonly second?: string;
}

/**
 * Curated Cloudinary ids keyed by `hotel_rooms.slug` OR `hotel_rooms.room_code`.
 * Gallery: press-10 = Superior Village, press-11 = Deluxe Valley, press-13/14 =
 * Vasarely salon/terrasse (DA). Room script (`resource-airelles-rooms.ts`) uses
 * press-21..30 — never press-31+ (those ids are not uploaded).
 */
const AIRELLES_KIT_ROOM_IMAGES: Readonly<Record<string, AirellesKitRoomImagePair>> = {
  // ── Village side (DA: ch-superior-village → press-10) ──────────────────
  'superior-room-village-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-10`,
    second: `${AIRELLES_IMAGE_PREFIX}/places-4`,
  },
  'superieure-village': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-10`,
    second: `${AIRELLES_IMAGE_PREFIX}/places-4`,
  },
  'chambre-superieure-village': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-10`,
    second: `${AIRELLES_IMAGE_PREFIX}/places-4`,
  },
  'deluxe-room-village-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/places-2`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-10`,
  },
  'deluxe-village': {
    hero: `${AIRELLES_IMAGE_PREFIX}/places-2`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-10`,
  },
  'chambre-deluxe-village': {
    hero: `${AIRELLES_IMAGE_PREFIX}/places-2`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-10`,
  },
  // ── Valley side (DA: ch-deluxe-valley → press-11) ──────────────────────
  'deluxe-room-valley-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-11`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-29`,
  },
  'deluxe-vallee': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-11`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-29`,
  },
  'chambre-deluxe-vallee': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-11`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-29`,
  },
  'superior-room-valley-side': { hero: `${AIRELLES_IMAGE_PREFIX}/press-30` },
  'superieure-vallee': { hero: `${AIRELLES_IMAGE_PREFIX}/press-30` },
  'chambre-superieure-vallee': { hero: `${AIRELLES_IMAGE_PREFIX}/press-30` },
  // ── Suites (room uploads press-21..28) ─────────────────────────────────
  'junior-suite-valley-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-21`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-22`,
  },
  'junior-suite': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-21`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-22`,
  },
  'one-bedroom-suite-valley-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-23`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-24`,
  },
  'suite-une-chambre': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-23`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-24`,
  },
  'suite-a-une-chambre': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-23`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-24`,
  },
  'suite-une-chambre-terrasse': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-23`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-24`,
  },
  'suite-a-une-chambre-terrasse': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-23`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-24`,
  },
  'prestige-junior-suite-valley-side': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-25`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-26`,
  },
  'junior-suite-prestige': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-25`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-26`,
  },
  // ── Prestige suites (DA: suite-vasarely → press-13) ────────────────────
  'vasarely-suite': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-13`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-14`,
  },
  'suite-vasarely': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-13`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-14`,
  },
  'suite-baron-de-simiane': {
    hero: `${AIRELLES_IMAGE_PREFIX}/press-12`,
    second: `${AIRELLES_IMAGE_PREFIX}/press-14`,
  },
  'suite-duc-de-soubise': { hero: `${AIRELLES_IMAGE_PREFIX}/press-12` },
  'maison-de-constance': { hero: `${AIRELLES_IMAGE_PREFIX}/press-6` },
};

/** Resolve curated hero/second by editorial slug or DB `room_code`. */
export function resolveAirellesKitRoomImages(
  slug: string,
  roomCode: string,
): AirellesKitRoomImagePair | undefined {
  return AIRELLES_KIT_ROOM_IMAGES[slug] ?? AIRELLES_KIT_ROOM_IMAGES[roomCode];
}

/** @deprecated Prefer {@link resolveAirellesKitRoomImages} — flat hero map for legacy callers. */
export const AIRELLES_KIT_ROOM_HERO: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(AIRELLES_KIT_ROOM_IMAGES).map(([key, pair]) => [key, pair.hero]),
);

/** @deprecated Prefer {@link resolveAirellesKitRoomImages} — flat second map for legacy callers. */
export const AIRELLES_KIT_ROOM_SECOND: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(AIRELLES_KIT_ROOM_IMAGES)
    .filter((entry): entry is [string, AirellesKitRoomImagePair & { second: string }] => {
      const pair = entry[1];
      return pair.second !== undefined;
    })
    .map(([key, pair]) => [key, pair.second]),
);

/** DA § `#chambres` — first three cards: Deluxe Valley, Superior Village, Vasarely. */
const AIRELLES_KIT_CARD_PRIORITY: readonly (readonly string[])[] = [
  ['chambre-deluxe-vallee', 'deluxe-room-valley-side', 'deluxe-vallee'],
  ['chambre-superieure-village', 'superior-room-village-side', 'superieure-village'],
  ['suite-vasarely', 'vasarely-suite'],
];

/** Golden `signature_experiences[].key` for the Concierge pick card (DA § expériences). */
export const AIRELLES_KIT_SIGNATURE_EXPERIENCE_PICK_KEY = 'montgolfiere-lever-soleil';

/** True when editorial marks an experience as the Concierge selection (`badge_*` or golden key). */
export function isKitSignatureExperienceConciergePick(
  exp: Pick<LocalisedSignatureExperience, 'badge' | 'key'>,
): boolean {
  return exp.badge !== null || exp.key === AIRELLES_KIT_SIGNATURE_EXPERIENCE_PICK_KEY;
}

/** Surfaces Concierge-pick experiences first; remaining cards keep their relative order. */
export function orderKitSignatureExperiences(
  experiences: readonly LocalisedSignatureExperience[],
): LocalisedSignatureExperience[] {
  const picks: LocalisedSignatureExperience[] = [];
  const rest: LocalisedSignatureExperience[] = [];
  for (const exp of experiences) {
    if (isKitSignatureExperienceConciergePick(exp)) picks.push(exp);
    else rest.push(exp);
  }
  return [...picks, ...rest];
}

/** Puts the DA trio first; remaining cards keep their relative order. */
export function orderAirellesKitRoomCards(cards: readonly HotelRoomCardVM[]): HotelRoomCardVM[] {
  const used = new Set<string>();
  const ordered: HotelRoomCardVM[] = [];

  for (const aliases of AIRELLES_KIT_CARD_PRIORITY) {
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

/** Distinction chip copy aligned with the DA template. */
export function formatKitDistinctionLabel(award: LocalisedAward, locale: 'fr' | 'en'): string {
  const issuerLower = award.issuer.toLowerCase();
  const nameLower = award.name.toLowerCase();

  if (issuerLower.includes('atout france') || nameLower.includes('palace')) {
    return locale === 'en'
      ? 'Palace distinction — Atout France'
      : 'Distinction Palace — Atout France';
  }

  if (
    nameLower.includes('michelin') &&
    (nameLower.includes('clé') || nameLower.includes('cle') || nameLower.includes('key'))
  ) {
    return award.year !== null ? `${award.name} — ${award.year}` : award.name;
  }

  if (issuerLower.includes('forbes') || nameLower.includes('forbes')) {
    return award.name;
  }

  if (issuerLower.includes('gault') || nameLower.includes('gault') || nameLower.includes('toque')) {
    if (award.year !== null && !award.name.includes(String(award.year))) {
      return `${award.name} — ${award.year}`;
    }
    return award.name;
  }

  if (award.year !== null) {
    if (award.name.includes(award.issuer)) {
      return `${award.name} — ${award.year}`;
    }
    return `${award.name} — ${award.issuer}, ${award.year}`;
  }

  return `${award.name} — ${award.issuer}`;
}
