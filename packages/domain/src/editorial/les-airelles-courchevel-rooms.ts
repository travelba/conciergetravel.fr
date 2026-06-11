/**
 * Les Airelles Courchevel room catalogue — shared by promote script and kit display.
 */

import {
  LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG,
  LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX,
  LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG,
} from './les-airelles-courchevel-golden';

export { LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG, LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG };

export interface LesAirellesCourchevelGoldenRoomEntry {
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
  readonly hero_image: string;
  readonly hero_alt_fr: string;
  readonly hero_alt_en: string;
  readonly display_order: number;
}

/** Three priority categories for kit `#chambres` — ski-in suite first (Concierge pick). */
export const LES_AIRELLES_COURCHEVEL_ROOM_CATALOG: readonly LesAirellesCourchevelGoldenRoomEntry[] =
  [
    {
      room_code: 'SUITE-SUR-PISTES',
      slug: 'suite-sur-pistes',
      name_fr: 'Suite sur pistes',
      name_en: 'Slope-side Suite',
      description_fr:
        'Suite ski-in depuis le Jardin Alpin — cheminée, salon séparé et accès direct aux pistes des 3 Vallées.',
      description_en:
        'Ski-in suite from Le Jardin Alpin — fireplace, separate living room and direct access to Three Valleys slopes.',
      size_sqm: 65,
      bed_type_fr: 'Lit King size · ski-in',
      bed_type_en: 'King size · ski-in',
      max_occupancy: 3,
      is_signature: true,
      hero_image: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-9`,
      hero_alt_fr: 'Suite sur pistes Les Airelles Courchevel, accès ski-in Jardin Alpin',
      hero_alt_en: 'Slope-side suite at Les Airelles Courchevel, ski-in from Le Jardin Alpin',
      display_order: 10,
    },
    {
      room_code: 'CHAMBRE-DELUXE-JARDIN',
      slug: 'chambre-deluxe-jardin-alpin',
      name_fr: 'Chambre Deluxe Jardin Alpin',
      name_en: 'Deluxe Jardin Alpin Room',
      description_fr:
        'Chambre au décor de chalet alpin — vue sur le Jardin Alpin et les sommets de la Tarentaise.',
      description_en: 'Alpine chalet-decor room — views over Le Jardin Alpin and Tarentaise peaks.',
      size_sqm: 38,
      bed_type_fr: 'Lit King size · vue montagne',
      bed_type_en: 'King size · mountain view',
      max_occupancy: 2,
      hero_image: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-7`,
      hero_alt_fr: 'Chambre Deluxe Jardin Alpin, Les Airelles Courchevel',
      hero_alt_en: 'Deluxe Jardin Alpin Room, Les Airelles Courchevel',
      display_order: 20,
    },
    {
      room_code: 'SUITE-PRESTIGE-TOUR',
      slug: 'suite-prestige-tour',
      name_fr: 'Suite Prestige Tour',
      name_en: 'Prestige Tower Suite',
      description_fr:
        'Suite dans les tours du palais — volumes généreux, boiseries et panorama sur Courchevel 1850.',
      description_en:
        'Suite in the palace towers — generous volumes, panelling and panorama over Courchevel 1850.',
      size_sqm: 80,
      bed_type_fr: 'Lit King size · salon séparé',
      bed_type_en: 'King size · separate living room',
      max_occupancy: 4,
      is_signature: true,
      hero_image: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-8`,
      hero_alt_fr: 'Suite Prestige Tour, palais des neiges Les Airelles Courchevel',
      hero_alt_en: 'Prestige Tower Suite, snow palace Les Airelles Courchevel',
      display_order: 30,
    },
  ];

function imageCategoryForEntry(entry: LesAirellesCourchevelGoldenRoomEntry): 'room' | 'suite' {
  if (entry.slug.startsWith('suite-') || entry.is_signature === true) return 'suite';
  if (entry.size_sqm !== null && entry.size_sqm >= 55) return 'suite';
  return 'room';
}

/** Patch body for `hotel_rooms` upsert/patch (facts + single-frame gallery). */
export function lesAirellesCourchevelCatalogPatch(
  entry: LesAirellesCourchevelGoldenRoomEntry,
): Record<string, unknown> {
  return {
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
    hero_image: entry.hero_image,
    images: [
      {
        public_id: entry.hero_image,
        alt_fr: entry.hero_alt_fr,
        alt_en: entry.hero_alt_en,
        category: imageCategoryForEntry(entry),
      },
    ],
  };
}
