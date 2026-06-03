import 'server-only';

import {
  dropDuplicateCategorySections,
  sanitizeAirellesText,
  sanitizeAirellesJsonb,
  patchAirellesAwards,
  patchAirellesAmenities,
  patchAirellesSpa,
  patchAirellesPolicies,
  AIRELLES_HIGHLIGHTS,
  AIRELLES_FAQ_CONTENT,
  AIRELLES_RESTAURANT_INFO,
  AIRELLES_POINTS_OF_INTEREST,
  AIRELLES_CONCIERGE_ADVICE,
  AIRELLES_INSTAGRAM,
  AIRELLES_FACTUAL_SUMMARY_FR,
  AIRELLES_FACTUAL_SUMMARY_EN,
  AIRELLES_META_DESC_FR,
  AIRELLES_META_DESC_EN,
  AIRELLES_PHONE_E164,
  AIRELLES_ADDRESS,
  AIRELLES_POSTAL_CODE,
  AIRELLES_EMAIL_RESERVATIONS,
  AIRELLES_CONCIERGE_PICK_SLUG,
  AIRELLES_CONCIERGE_PICK_NOTE,
  AIRELLES_CONCIERGE_HOOK,
} from '@mch/domain/editorial';

import type { HotelDetail, HotelRoomRow, SupportedLocale } from '@/server/hotels/get-hotel-by-slug';

/**
 * LOCAL-ONLY editorial override for the Airelles Gordes (La Bastide) hotel
 * fiche — the "golden template" sandbox.
 *
 * ⚠ This module NEVER writes to Supabase. It is a post-fetch, field-level
 * patch applied to the *real* row returned by `getHotelBySlug`, gated
 * exclusively by the `MCH_LOCAL_FIXTURE` env flag. Production builds (flag
 * unset) are unaffected — the branch is dead code at runtime.
 *
 * The golden CONTENT (restaurants, POIs, spa, FAQ, concierge blocks, …) now
 * lives in `@mch/domain/editorial` (`airelles-golden.ts`) as the single
 * source of truth, shared with the catalogue promotion script
 * (`@mch/editorial-pilot` → `promote-airelles-golden.ts`). This file only
 * keeps the web-specific glue: slug/flag helpers, the un-seeded rooms preview
 * and the post-fetch patch wiring.
 */

export const AIRELLES_OVERRIDE_SLUGS = ['les-airelles-gordes', 'les-airelles-gordes-en'] as const;

// Re-exported for the hotel page (rooms grid concierge pick + hero accroche).
export { AIRELLES_CONCIERGE_PICK_SLUG, AIRELLES_CONCIERGE_PICK_NOTE, AIRELLES_CONCIERGE_HOOK };

export function isAirellesLocalOverrideEnabled(): boolean {
  const raw = process.env['MCH_LOCAL_FIXTURE'];
  return typeof raw === 'string' && raw.trim().length > 0;
}

function isAirellesSlug(slug: string): boolean {
  return (AIRELLES_OVERRIDE_SLUGS as readonly string[]).includes(slug);
}

/**
 * True when the request targets the Airelles Gordes golden template AND the
 * local-fixture sandbox is enabled. Used by the hotel page to opt this single
 * fiche into the full-bleed overlay hero before the design is rolled out
 * catalogue-wide. Off (classic hero) for every other slug and in production.
 */
export function isAirellesGoldenTemplate(slug: string): boolean {
  return isAirellesLocalOverrideEnabled() && isAirellesSlug(slug);
}

// ---------------------------------------------------------------------------
// Rooms — the 12 official categories (40 rooms & suites total).
// Subpage links may 404 in the local sandbox (rooms not seeded); the section
// is rendered to visualise the catalogue, not to navigate.
// ---------------------------------------------------------------------------

interface RoomSeed {
  readonly code: string;
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly descFr: string;
  readonly descEn: string;
  readonly maxOccupancy: number;
  readonly signature?: boolean;
}

const ROOM_SEEDS: readonly RoomSeed[] = [
  {
    code: 'superieure-village',
    slug: 'chambre-superieure-village',
    nameFr: 'Chambre Supérieure Village',
    nameEn: 'Superior Village Room',
    descFr:
      'Chambre élégante donnant sur le village de Gordes, parquet point de Hongrie, lit king-size et salle de bain en pierre.',
    descEn:
      'An elegant room overlooking the village of Gordes, herringbone parquet, king-size bed and a stone bathroom.',
    maxOccupancy: 2,
  },
  {
    code: 'deluxe-village',
    slug: 'chambre-deluxe-village',
    nameFr: 'Chambre Deluxe Village',
    nameEn: 'Deluxe Village Room',
    descFr:
      'Chambre Deluxe avec vue sur le village, plus spacieuse, au décor provençal raffiné et au mobilier chiné.',
    descEn:
      'A more spacious Deluxe room with village views, refined Provençal décor and antique furniture.',
    maxOccupancy: 2,
  },
  {
    code: 'superieure-vallee',
    slug: 'chambre-superieure-vallee',
    nameFr: 'Chambre Supérieure Vallée',
    nameEn: 'Superior Valley Room',
    descFr:
      'Chambre Supérieure ouvrant sur la vallée du Luberon, lumière du matin et panorama sur les collines d’oliviers.',
    descEn:
      'A Superior room opening onto the Luberon valley, morning light and a panorama over the olive-clad hills.',
    maxOccupancy: 2,
  },
  {
    code: 'deluxe-vallee',
    slug: 'chambre-deluxe-vallee',
    nameFr: 'Chambre Deluxe Vallée',
    nameEn: 'Deluxe Valley Room',
    descFr:
      'Chambre Deluxe avec vue dégagée sur la vallée, espace généreux et salle de bain habillée de pierre.',
    descEn: 'A Deluxe room with open valley views, generous space and a stone-clad bathroom.',
    maxOccupancy: 2,
  },
  {
    code: 'junior-suite',
    slug: 'junior-suite',
    nameFr: 'Junior Suite',
    nameEn: 'Junior Suite',
    descFr:
      'Junior Suite au coin salon ouvert, alliant le confort d’une suite à l’intimité d’une chambre, décor 18e revisité.',
    descEn:
      'A Junior Suite with an open sitting area, blending suite comfort with the intimacy of a room, in a revisited 18th-century décor.',
    maxOccupancy: 2,
  },
  {
    code: 'junior-suite-prestige',
    slug: 'junior-suite-prestige',
    nameFr: 'Junior Suite Prestige',
    nameEn: 'Prestige Junior Suite',
    descFr:
      'Junior Suite Prestige plus vaste, vue vallée, salon et chambre articulés autour d’une terrasse provençale.',
    descEn:
      'A larger Prestige Junior Suite, valley view, with living and sleeping areas arranged around a Provençal terrace.',
    maxOccupancy: 3,
  },
  {
    code: 'suite-une-chambre',
    slug: 'suite-a-une-chambre',
    nameFr: 'Suite à une Chambre',
    nameEn: 'One-Bedroom Suite',
    descFr:
      'Suite avec chambre et salon séparés, idéale pour un séjour prolongé, dans le calme de La Bastide.',
    descEn:
      'A suite with separate bedroom and living room, ideal for a longer stay, in the quiet of La Bastide.',
    maxOccupancy: 3,
  },
  {
    code: 'suite-une-chambre-terrasse',
    slug: 'suite-a-une-chambre-terrasse',
    nameFr: 'Suite à une Chambre Terrasse',
    nameEn: 'One-Bedroom Terrace Suite',
    descFr:
      'Suite à une chambre prolongée d’une terrasse privée face à la vallée, pour les petits-déjeuners au soleil.',
    descEn:
      'A one-bedroom suite extended by a private terrace facing the valley, for breakfasts in the sun.',
    maxOccupancy: 3,
  },
  {
    code: 'suite-vasarely',
    slug: 'suite-vasarely',
    nameFr: 'Suite Vasarely',
    nameEn: 'Vasarely Suite',
    descFr:
      'Suite de prestige au salon séparé et au style d’époque, distinguée par sa vue époustouflante sur la vallée, tel un tableau provençal.',
    descEn:
      'A prestige suite with a separate living room and period style, set apart by its breathtaking valley view, like a Provençal painting.',
    maxOccupancy: 3,
    signature: true,
  },
  {
    code: 'suite-baron-de-simiane',
    slug: 'suite-baron-de-simiane',
    nameFr: 'Suite Baron de Simiane',
    nameEn: 'Baron de Simiane Suite',
    descFr:
      'Suite empruntant son nom à l’une des plus illustres familles de Provence : finitions originales, mobilier du XVIIIe siècle et terrasse privée à la vue panoramique.',
    descEn:
      'A suite named after one of Provence’s most illustrious families: original finishes, 18th-century furniture and a private terrace with panoramic views.',
    maxOccupancy: 3,
    signature: true,
  },
  {
    code: 'suite-duc-de-soubise',
    slug: 'suite-duc-de-soubise',
    nameFr: 'Suite Duc de Soubise',
    nameEn: 'Duc de Soubise Suite',
    descFr:
      'Vaste suite de prestige avec petit salon, chambre et terrasse, dans l’esprit aristocratique de La Bastide.',
    descEn:
      'A vast prestige suite with a small sitting room, bedroom and terrace, in the aristocratic spirit of La Bastide.',
    maxOccupancy: 3,
    signature: true,
  },
  {
    code: 'maison-de-constance',
    slug: 'maison-de-constance',
    nameFr: 'Maison de Constance (villa privée)',
    nameEn: 'Maison de Constance (private villa)',
    descFr:
      'Villa privée de quatre chambres avec piscine privée et accès direct au village de Gordes — la plus grande intimité de La Bastide, pour les familles et les groupes d’amis.',
    descEn:
      'A private four-bedroom villa with its own pool and direct access to Gordes village — the greatest privacy at La Bastide, for families and groups of friends.',
    maxOccupancy: 8,
    signature: true,
  },
];

function buildRooms(locale: SupportedLocale): HotelRoomRow[] {
  const isFr = locale === 'fr';
  return ROOM_SEEDS.map((seed, index) => ({
    id: `airelles-${seed.code}`,
    slug: seed.slug,
    room_code: seed.code,
    name: isFr ? seed.nameFr : seed.nameEn,
    description: isFr ? seed.descFr : seed.descEn,
    max_occupancy: seed.maxOccupancy,
    bed_type: null,
    size_sqm: null,
    amenities: [],
    isSignature: seed.signature === true,
    indicativePrice: null,
    displayOrder: index,
  }));
}

// ---------------------------------------------------------------------------
// Public entry — applies the field-level patch to the real detail.
// ---------------------------------------------------------------------------

export function applyAirellesLocalOverride(
  detail: HotelDetail,
  locale: SupportedLocale,
): HotelDetail {
  if (!isAirellesSlug(detail.row.slug) && !isAirellesSlug(detail.row.slug_en ?? '')) {
    return detail;
  }

  const patchedRow = {
    ...detail.row,
    highlights: AIRELLES_HIGHLIGHTS,
    faq_content: AIRELLES_FAQ_CONTENT,
    restaurant_info: AIRELLES_RESTAURANT_INFO,
    points_of_interest: AIRELLES_POINTS_OF_INTEREST,
    concierge_advice: AIRELLES_CONCIERGE_ADVICE,
    policies: patchAirellesPolicies(detail.row.policies),
    awards: patchAirellesAwards(detail.row.awards),
    amenities: patchAirellesAmenities(detail.row.amenities),
    spa_info: patchAirellesSpa(detail.row.spa_info),
    instagram: AIRELLES_INSTAGRAM,
    description_fr:
      typeof detail.row.description_fr === 'string'
        ? sanitizeAirellesText(detail.row.description_fr)
        : detail.row.description_fr,
    description_en:
      typeof detail.row.description_en === 'string'
        ? sanitizeAirellesText(detail.row.description_en)
        : detail.row.description_en,
    long_description_sections: sanitizeAirellesJsonb(
      dropDuplicateCategorySections(detail.row.long_description_sections),
    ),
    signature_experiences: sanitizeAirellesJsonb(detail.row.signature_experiences),
    factual_summary_fr: AIRELLES_FACTUAL_SUMMARY_FR,
    factual_summary_en: AIRELLES_FACTUAL_SUMMARY_EN,
    meta_desc_fr: AIRELLES_META_DESC_FR,
    meta_desc_en: AIRELLES_META_DESC_EN,
    phone_e164: AIRELLES_PHONE_E164,
    address: AIRELLES_ADDRESS,
    postal_code: AIRELLES_POSTAL_CODE,
    email_reservations: AIRELLES_EMAIL_RESERVATIONS,
  };

  return {
    row: patchedRow,
    rooms: buildRooms(locale),
  };
}
