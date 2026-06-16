/**
 * Conrad Los Angeles room catalogue — shared by the promote script and the kit
 * `#chambres` display.
 *
 * Conrad LA is a Travelport booking pilot whose live `hotel_rooms` inventory was
 * seeded from a RateHawk SANDBOX property (fake "river view" / "villa pool"
 * rooms, no photos). This curated catalogue REPLACES that sandbox data with the
 * real Conrad Los Angeles room taxonomy sourced from the official Hilton site
 * (hilton.com/.../laxavci-conrad-los-angeles/rooms). Sizes converted from the
 * official square footage (348 sq ft ≈ 32 m², 652 sq ft ≈ 61 m², 1 414 sq ft
 * ≈ 131 m²).
 *
 * Photos: only 3 room-grade frames exist in the Google Places set
 * (`places-2` King with Disney Hall view, `places-7` suite living room,
 * `places-4` travertine bathroom). They illustrate the top-3 visible cards
 * (Concierge pick first). The remaining rooms stay photo-light — same amber
 * status as the gallery, same root cause (Google Places 10-photo ceiling) —
 * until an official Conrad/Hilton room press kit is sourced.
 */

import { CONRAD_LOS_ANGELES_IMAGE_PREFIX } from './conrad-los-angeles-gallery';
import {
  CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG,
  CONRAD_LOS_ANGELES_PROMOTE_SLUG,
} from './conrad-los-angeles-golden';

export { CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG, CONRAD_LOS_ANGELES_PROMOTE_SLUG };

export interface ConradLosAngelesGoldenRoomEntry {
  readonly room_code: string;
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly description_fr: string;
  readonly description_en: string;
  readonly size_sqm: number | null;
  readonly bed_type_fr: string;
  readonly bed_type_en: string;
  readonly max_occupancy: number;
  readonly is_signature?: boolean;
  /** Cloudinary public_id, or null when no real room frame is available yet. */
  readonly hero_image: string | null;
  readonly hero_alt_fr: string;
  readonly hero_alt_en: string;
  readonly display_order: number;
}

/**
 * Six real Conrad Los Angeles categories. The Concierge pick (Premium King —
 * Walt Disney Concert Hall view) is first; the two illustrated cards that
 * follow keep the top-3 `#chambres` row fully photographed.
 */
export const CONRAD_LOS_ANGELES_ROOM_CATALOG: readonly ConradLosAngelesGoldenRoomEntry[] = [
  {
    room_code: 'PREMIUM-KING-DISNEY',
    slug: CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG,
    name_fr: 'Chambre Premium King — vue Walt Disney Concert Hall',
    name_en: 'Premium King Room — Walt Disney Concert Hall View',
    description_fr:
      'Chambre d’angle aux étages élevés, baie vitrée toute hauteur cadrant les courbes d’acier du Walt Disney Concert Hall. Boiseries de chêne, lit king et salle de bains en travertin.',
    description_en:
      'High-floor room with a floor-to-ceiling window framing the steel curves of the Walt Disney Concert Hall. Oak panelling, a king bed and a travertine bathroom.',
    size_sqm: 37,
    bed_type_fr: 'Lit King size · vue Concert Hall',
    bed_type_en: 'King bed · Concert Hall view',
    max_occupancy: 2,
    is_signature: true,
    hero_image: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-2`,
    hero_alt_fr:
      'Chambre Premium King du Conrad Los Angeles avec baie vitrée sur le Walt Disney Concert Hall',
    hero_alt_en:
      'Premium King room at Conrad Los Angeles with a window onto the Walt Disney Concert Hall',
    display_order: 10,
  },
  {
    room_code: 'CORNER-SUITE-KING',
    slug: 'corner-suite-king',
    name_fr: 'Corner Suite — One King',
    name_en: 'Corner Suite — One King',
    description_fr:
      'Suite d’angle avec salon attenant et double exposition vitrée sur l’horizon de Downtown. Cuisine en chêne, îlot de marbre et baies ouvertes sur Grand Avenue.',
    description_en:
      'Corner suite with an adjoining living room and dual-aspect glazing over the Downtown skyline. Oak kitchen, marble island and windows opening onto Grand Avenue.',
    size_sqm: 61,
    bed_type_fr: 'Lit King size · salon attenant',
    bed_type_en: 'King bed · adjoining living room',
    max_occupancy: 3,
    is_signature: true,
    hero_image: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-7`,
    hero_alt_fr: 'Salon et cuisine ouverte d’une Corner Suite du Conrad Los Angeles avec vue ville',
    hero_alt_en: 'Living room and open kitchen of a Conrad Los Angeles Corner Suite with city view',
    display_order: 20,
  },
  {
    room_code: 'DELUXE-KING-CITY',
    slug: 'deluxe-king-city-view',
    name_fr: 'Chambre Deluxe King — City View',
    name_en: 'Deluxe King Room — City View',
    description_fr:
      'Chambre d’entrée de gamme de 32 m², lit king et vue sur Grand Avenue. Salle de bains en travertin pleine hauteur, double vasque et baignoire encastrée.',
    description_en:
      'Entry category of 32 sq m with a king bed and a Grand Avenue outlook. Full-height travertine bathroom with a double vanity and a recessed tub.',
    size_sqm: 32,
    bed_type_fr: 'Lit King size · vue ville',
    bed_type_en: 'King bed · city view',
    max_occupancy: 2,
    hero_image: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-4`,
    hero_alt_fr: 'Salle de bains en travertin d’une chambre Deluxe King du Conrad Los Angeles',
    hero_alt_en: 'Travertine bathroom of a Deluxe King room at Conrad Los Angeles',
    display_order: 30,
  },
  {
    room_code: 'DELUXE-TWO-QUEEN-CITY',
    slug: 'deluxe-two-queen-city-view',
    name_fr: 'Chambre Deluxe — Deux lits Queen',
    name_en: 'Deluxe Two Queen Room — City View',
    description_fr:
      'Chambre de 32 m² configurée pour les familles, deux lits queen et vue sur Downtown. Mêmes finitions chêne et travertin que les chambres King.',
    description_en:
      'A 32 sq m room set up for families, two queen beds and a Downtown outlook. Same oak and travertine finishes as the King rooms.',
    size_sqm: 32,
    bed_type_fr: 'Deux lits Queen · vue ville',
    bed_type_en: 'Two queen beds · city view',
    max_occupancy: 4,
    hero_image: null,
    hero_alt_fr: 'Chambre Deluxe deux lits Queen du Conrad Los Angeles',
    hero_alt_en: 'Deluxe two queen room at Conrad Los Angeles',
    display_order: 40,
  },
  {
    room_code: 'MOUNTAIN-VIEW-SUITE',
    slug: 'mountain-view-suite',
    name_fr: 'Mountain View Suite — One Bedroom',
    name_en: 'Mountain View Suite — One Bedroom',
    description_fr:
      'Suite d’une chambre de 61 m² orientée vers les collines de Hollywood et les San Gabriel Mountains. Salon séparé, dressing et salle de bains en travertin.',
    description_en:
      'One-bedroom suite of 61 sq m facing the Hollywood Hills and San Gabriel Mountains. Separate living room, walk-in wardrobe and travertine bathroom.',
    size_sqm: 61,
    bed_type_fr: 'Lit King size · vue montagne',
    bed_type_en: 'King bed · mountain view',
    max_occupancy: 3,
    is_signature: true,
    hero_image: null,
    hero_alt_fr: 'Mountain View Suite du Conrad Los Angeles, vue sur les collines de Hollywood',
    hero_alt_en: 'Mountain View Suite at Conrad Los Angeles facing the Hollywood Hills',
    display_order: 50,
  },
  {
    room_code: 'GRAND-PENTHOUSE',
    slug: 'grand-penthouse',
    name_fr: 'Grand Penthouse',
    name_en: 'Grand Penthouse',
    description_fr:
      'Penthouse de 131 m² au 18e étage : salon, salle à manger de six couverts, chambre principale et vaste terrasse avec brasero ouverte sur Grand Avenue, jusqu’aux collines de Hollywood.',
    description_en:
      'A 131 sq m penthouse on the 18th floor: living room, six-seat dining room, master bedroom and a large terrace with a fire pit open onto Grand Avenue, reaching to the Hollywood Hills.',
    size_sqm: 131,
    bed_type_fr: 'Lit King size · terrasse brasero',
    bed_type_en: 'King bed · fire-pit terrace',
    max_occupancy: 4,
    is_signature: true,
    hero_image: null,
    hero_alt_fr: 'Grand Penthouse du Conrad Los Angeles, terrasse avec brasero sur Grand Avenue',
    hero_alt_en: 'Grand Penthouse at Conrad Los Angeles, fire-pit terrace over Grand Avenue',
    display_order: 60,
  },
];

function imageCategoryForEntry(entry: ConradLosAngelesGoldenRoomEntry): 'room' | 'suite' {
  if (entry.slug.includes('suite') || entry.slug.includes('penthouse')) return 'suite';
  if (entry.size_sqm !== null && entry.size_sqm >= 55) return 'suite';
  return 'room';
}

/**
 * Patch body for a `hotel_rooms` upsert/patch. Only attaches an `images[]`
 * frame when a real photo exists; rooms without a frame keep an empty gallery
 * rather than a placeholder (PO rule: no fake/AI room photos).
 */
export function conradLosAngelesCatalogPatch(
  entry: ConradLosAngelesGoldenRoomEntry,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    room_code: entry.room_code,
    slug: entry.slug,
    name_fr: entry.name_fr,
    name_en: entry.name_en,
    description_fr: entry.description_fr,
    description_en: entry.description_en,
    max_occupancy: entry.max_occupancy,
    bed_type: entry.bed_type_fr,
    size_sqm: entry.size_sqm,
    is_signature: entry.is_signature === true,
    display_order: entry.display_order,
  };
  if (entry.hero_image !== null) {
    base['hero_image'] = entry.hero_image;
    base['images'] = [
      {
        public_id: entry.hero_image,
        alt_fr: entry.hero_alt_fr,
        alt_en: entry.hero_alt_en,
        category: imageCategoryForEntry(entry),
      },
    ];
  } else {
    base['hero_image'] = null;
    base['images'] = [];
  }
  return base;
}

/** Curated kit display map (slug → hero frame) for the rooms that have a photo. */
export const CONRAD_LOS_ANGELES_ROOM_IMAGES: Readonly<Record<string, { hero: string }>> =
  Object.fromEntries(
    CONRAD_LOS_ANGELES_ROOM_CATALOG.filter((e) => e.hero_image !== null).map((e) => [
      e.slug,
      { hero: e.hero_image as string },
    ]),
  );

/** Card priority for `#chambres`: pick first, then the two illustrated cards. */
export const CONRAD_LOS_ANGELES_CARD_PRIORITY: readonly (readonly string[])[] = [
  [CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG],
  ['corner-suite-king'],
  ['deluxe-king-city-view'],
];
