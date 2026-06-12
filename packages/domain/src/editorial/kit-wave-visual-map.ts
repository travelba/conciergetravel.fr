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
    epicure: 10,
    '114 faubourg': 11,
    'le jardin francais': 12,
    'cafe antonia': 24,
    'le bar du bristol': 26,
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
    'shang palace': 10,
    'la bauhinia': 11,
    'le bar botaniste': 12,
    'les salons du prince': 4,
    'maison roland': 22,
    'les lounges': 23,
  },
};

/** Spa hero block — prefer pool/thermal over generic cabine when copy mentions piscine/eaux. */
const WAVE_SPA_HERO_SLOTS: Readonly<Partial<Record<KitWaveSlug, number>>> = {
  'cheval-blanc-paris': 16,
  'le-bristol-paris': 16,
  'les-airelles-courchevel': 15,
  'les-pres-deugenie': 13,
  'shangri-la-paris': 16,
};

export function resolveKitWaveDiningPublicId(
  hotelSlug: string,
  venueName: string,
): string | undefined {
  if (!isKitWaveSlug(hotelSlug)) return undefined;
  const slot = WAVE_DINING_SLOTS[hotelSlug][normalizeVenueName(venueName)];
  if (slot === undefined) return undefined;
  return pressPublicId(hotelSlug, slot);
}

export function resolveKitWaveSpaHeroPublicId(hotelSlug: string): string | undefined {
  if (!isKitWaveSlug(hotelSlug)) return undefined;
  const slot = WAVE_SPA_HERO_SLOTS[hotelSlug];
  if (slot === undefined) return undefined;
  return pressPublicId(hotelSlug, slot);
}
