/**
 * Kit wave 5 — press-slot overrides for dining, spa hero and visitor-audit dedup (D18).
 * Consumed by apps/web `kit-media-resolver.ts`.
 */

import { isKitWaveSlug, type KitWaveSlug } from './kit-golden-loader';

const PREFIX: Readonly<Record<KitWaveSlug, string>> = {
  'cheval-blanc-paris': 'cct/hotels/cheval-blanc-paris',
  'le-bristol-paris': 'cct/hotels/le-bristol-paris',
  'les-airelles-courchevel': 'cct/hotels/les-airelles-courchevel',
  'les-pres-deugenie': 'cct/hotels/les-pres-deugenie',
  'shangri-la-paris': 'cct/hotels/shangri-la-paris',
  'conrad-los-angeles': 'cct/hotels/conrad-los-angeles',
};

function normalizeVenueName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201B\u2032`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .trim();
}

/** Shared venue key for dining maps — normalizes curly apostrophes (Loulou's vs Loulou's). */
export function normalizeKitVenueName(name: string): string {
  return normalizeVenueName(name);
}

function pressPublicId(slug: KitWaveSlug, slot: number): string {
  return `${PREFIX[slug]}/press-${String(slot)}`;
}

function kitHotelPressPublicId(slug: string, slot: number): string {
  return `cct/hotels/${slug}/press-${String(slot)}`;
}

/** Kit pilot slugs outside wave 5 — venue → press slot (gallery-aligned). */
const KIT_PILOT_DINING_SLOTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'prince-de-galles-paris': {
    'bar 19.20': 4,
    'restaurant 19.20 by norbert tarayre': 30,
    'akira back paris': 12,
    'le patio & cabana bar': 10,
  },
};

/** Kit pilot spa hero — decouple wellness block from signature experience slides. */
const KIT_PILOT_SPA_HERO_SLOTS: Readonly<Record<string, number>> = {
  'prince-de-galles-paris': 17,
};

/** Normalized venue name → press slot (1–30). */
const WAVE_DINING_SLOTS: Readonly<Record<KitWaveSlug, Readonly<Record<string, number>>>> = {
  'cheval-blanc-paris': {
    plenitude: 10,
    hakuba: 23,
    langosteria: 12,
    'le tout-paris': 11,
    'bar le tout-paris': 28,
    'le jardin': 20,
    'bar le jardin': 17,
  },
  'le-bristol-paris': {
    epicure: 16,
    '114 faubourg': 18,
    'le jardin francais': 20,
    'cafe antonia': 17,
    'le bar du bristol': 19,
  },
  'les-airelles-courchevel': {
    'la table des airelles': 10,
    'matsuhisa courchevel': 11,
    palladio: 30,
    'le coin savoyard': 12,
    'le chalet de pierres': 21,
    'la folie douce · la fruitiere': 27,
    'le bar': 5,
    'le fumoir': 6,
  },
  'les-pres-deugenie': {
    'michel guerard': 10,
    "l'orangerie": 11,
    'la ferme aux grives': 12,
    'cafe mere poule': 24,
    "loulou's lounge bar": 5,
    'loulous lounge bar': 5,
  },
  'shangri-la-paris': {
    'shang palace': 16,
    'la bauhinia': 17,
    'le bar botaniste': 18,
    'les salons du prince': 25,
    'maison roland': 24,
    'les lounges': 15,
  },
  // Conrad LA gallery uses Google Places `places-*` assets (no `press-*` slots);
  // leave empty so the dining resolver falls back to the gallery `category` map.
  'conrad-los-angeles': {},
};

/** Spa hero block — prefer pool/thermal over generic cabine when copy mentions piscine/eaux. */
const WAVE_SPA_HERO_SLOTS: Readonly<Partial<Record<KitWaveSlug, number>>> = {
  'cheval-blanc-paris': 16,
  'le-bristol-paris': 21,
  'les-airelles-courchevel': 15,
  'les-pres-deugenie': 13,
  'shangri-la-paris': 21,
};

function resolvePilotDiningSlot(hotelSlug: string, venueName: string): number | undefined {
  const slots = KIT_PILOT_DINING_SLOTS[hotelSlug];
  if (slots === undefined) return undefined;
  return slots[normalizeVenueName(venueName)];
}

export function resolveKitWaveDiningPublicId(
  hotelSlug: string,
  venueName: string,
): string | undefined {
  const pilotSlot = resolvePilotDiningSlot(hotelSlug, venueName);
  if (pilotSlot !== undefined) {
    return kitHotelPressPublicId(hotelSlug, pilotSlot);
  }
  if (!isKitWaveSlug(hotelSlug)) return undefined;
  const slot = WAVE_DINING_SLOTS[hotelSlug][normalizeVenueName(venueName)];
  if (slot === undefined) return undefined;
  return pressPublicId(hotelSlug, slot);
}

export function resolveKitWaveSpaHeroPublicId(hotelSlug: string): string | undefined {
  const pilotSlot = KIT_PILOT_SPA_HERO_SLOTS[hotelSlug];
  if (pilotSlot !== undefined) {
    return kitHotelPressPublicId(hotelSlug, pilotSlot);
  }
  if (!isKitWaveSlug(hotelSlug)) return undefined;
  const slot = WAVE_SPA_HERO_SLOTS[hotelSlug];
  if (slot === undefined) return undefined;
  return pressPublicId(hotelSlug, slot);
}
