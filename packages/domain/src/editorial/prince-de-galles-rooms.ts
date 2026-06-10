/**
 * Prince de Galles room catalogue — shared by the promote script and kit display.
 *
 * Facts and hero Cloudinary ids align with `resource-prince-de-galles-rooms.ts`
 * (press-1..35, one global upload index across the seven categories).
 */

import {
  PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG,
  PRINCE_DE_GALLES_IMAGE_PREFIX,
} from './prince-de-galles-golden';

export { PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG };

/** Single hero frame per room category — sourced from official Marriott DAM uploads. */
export interface PrinceDeGallesGoldenRoomEntry {
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

export const PRINCE_DE_GALLES_ROOM_CATALOG: readonly PrinceDeGallesGoldenRoomEntry[] = [
  {
    room_code: 'ART-DECO-DELUXE',
    slug: 'chambre-art-deco-deluxe',
    name_fr: 'Chambre Art Déco Deluxe',
    name_en: 'Art Deco Deluxe Room',
    description_fr:
      'Une chambre d’environ 26 m² au style Art déco assumé : motifs géométriques, tête de lit miroitée et salle de bain en marbre à mosaïque.',
    description_en:
      'A roughly 26 sq m room with a confident Art Deco signature: geometric patterns, a mirrored headboard and a marble mosaic bathroom.',
    size_sqm: 26,
    bed_type_fr: 'Lit King size',
    bed_type_en: 'King size',
    max_occupancy: 2,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-1`,
    hero_alt_fr: 'Chambre Art Déco Deluxe du Prince de Galles Paris, tête de lit miroitée',
    hero_alt_en: 'Art Deco Deluxe Room at Prince de Galles Paris with a mirrored headboard',
    display_order: 10,
  },
  {
    room_code: 'ART-DECO-BALCONY',
    slug: 'chambre-art-deco-deluxe-balcon',
    name_fr: 'Chambre Art Déco Deluxe Balcon',
    name_en: 'Art Deco Deluxe Balcony Room',
    description_fr:
      'La même élégance Art déco, prolongée d’un balcon privé ouvrant sur la cour intérieure ou l’avenue George V.',
    description_en:
      'The same Art Deco elegance, extended by a private balcony opening onto the courtyard or Avenue George V.',
    size_sqm: 26,
    bed_type_fr: 'Lit King size · balcon privatif',
    bed_type_en: 'King size · private balcony',
    max_occupancy: 2,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-6`,
    hero_alt_fr: 'Chambre Art Déco Deluxe avec balcon sur cour, Prince de Galles Paris',
    hero_alt_en: 'Art Deco Deluxe Balcony courtyard-view room, Prince de Galles Paris',
    display_order: 20,
  },
  {
    room_code: 'MOSAIC-SUITE',
    slug: 'suite-mosaique',
    name_fr: 'Suite Mosaïque',
    name_en: 'Mosaic Suite',
    description_fr:
      'Une suite de 48 m² avec salon séparé et salle de bain habillée d’une mosaïque colorée, fil conducteur du décor.',
    description_en:
      'A 48 sq m suite with a separate living room and a bathroom dressed in a colourful mosaic, the décor’s guiding thread.',
    size_sqm: 48,
    bed_type_fr: 'Lit King size · salon séparé',
    bed_type_en: 'King size · separate living room',
    max_occupancy: 3,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-11`,
    hero_alt_fr: 'Chambre de la Suite Mosaïque, Prince de Galles Paris',
    hero_alt_en: 'Bedroom of the Mosaic Suite, Prince de Galles Paris',
    display_order: 30,
  },
  {
    room_code: 'MACASSAR-SUITE',
    slug: 'suite-macassar',
    name_fr: 'Suite Macassar',
    name_en: 'Macassar Suite',
    description_fr:
      'Une suite chaleureuse en bois de Macassar, chambre et salon distincts, certaines avec terrasse sur Paris.',
    description_en:
      'A warm Macassar-wood suite with a separate bedroom and living room, some with a terrace over Paris.',
    size_sqm: null,
    bed_type_fr: 'Lit King size · ébène de Macassar',
    bed_type_en: 'King size · Macassar ebony',
    max_occupancy: 3,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-16`,
    hero_alt_fr: 'Chambre de la Suite Macassar en ébène, Prince de Galles Paris',
    hero_alt_en: 'Bedroom of the Macassar ebony Suite, Prince de Galles Paris',
    display_order: 40,
  },
  {
    room_code: 'SAPHIR-SUITE',
    slug: 'suite-saphir',
    name_fr: 'Suite Saphir',
    name_en: 'Saphir Suite',
    description_fr:
      'Une suite raffinée — chambre, salon et terrasse — aux accents bleu saphir, sur les toits parisiens.',
    description_en:
      'A refined suite — bedroom, living room and terrace — with sapphire-blue accents, over the Paris rooftops.',
    size_sqm: null,
    bed_type_fr: 'Lit King size · terrasse sur la ville',
    bed_type_en: 'King size · terrace over the city',
    max_occupancy: 3,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-21`,
    hero_alt_fr: 'Chambre de la Suite Saphir aux accents bleus, Prince de Galles Paris',
    hero_alt_en: 'Bedroom of the Saphir Suite with blue accents, Prince de Galles Paris',
    display_order: 50,
  },
  {
    room_code: 'OR-SUITE',
    slug: 'suite-or',
    name_fr: 'Suite Or',
    name_en: 'Suite Or',
    description_fr:
      'Suite signature de 97 m² aux touches dorées, double salon et terrasse sur l’avenue George V.',
    description_en:
      'A 97 sq m signature suite with gilded touches, a double living room and a terrace over Avenue George V.',
    size_sqm: 97,
    bed_type_fr: 'Lit King size · double salon',
    bed_type_en: 'King size · double living room',
    max_occupancy: 4,
    is_signature: true,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-26`,
    hero_alt_fr: 'Chambre de la Suite Or aux touches dorées, Prince de Galles Paris',
    hero_alt_en: 'Bedroom of the gilded Suite Or, Prince de Galles Paris',
    display_order: 60,
  },
  {
    room_code: 'LALIQUE-SUITE',
    slug: 'suite-lalique',
    name_fr: 'Suite Lalique par Patrick Hellmann',
    name_en: 'Lalique Suite by Patrick Hellmann',
    description_fr:
      'La suite signature : un duplex de 180 m² aux 8e et 9e étages, né d’une collaboration avec le cristallier Lalique.',
    description_en:
      'The signature suite: a 180 sq m duplex on the 8th and 9th floors, born of a collaboration with crystal maker Lalique.',
    size_sqm: 180,
    bed_type_fr: 'Lit King size · duplex Lalique',
    bed_type_en: 'King size · Lalique duplex',
    max_occupancy: 4,
    is_signature: true,
    hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
    hero_alt_fr: 'Salon de la Suite Lalique par Patrick Hellmann, Prince de Galles Paris',
    hero_alt_en: 'Living room of the Lalique Suite by Patrick Hellmann, Prince de Galles Paris',
    display_order: 70,
  },
] as const;

/** ADR-0009 — indexable room sub-page (Suite Lalique, ≥800 chars + 5 photos). */
export const PRINCE_DE_GALLES_INDEXABLE_ROOM = {
  room_code: 'LALIQUE-SUITE',
  slug: 'suite-lalique',
  name_fr: 'Suite Lalique par Patrick Hellmann',
  name_en: 'Lalique Suite by Patrick Hellmann',
  description_fr:
    'Duplex signature de 180 m² aux 8e et 9e étages, né d’une collaboration avec le cristallier Lalique et le designer Patrick Hellmann.',
  description_en:
    '180 sq m signature duplex on the 8th and 9th floors, born of a collaboration with crystal maker Lalique and designer Patrick Hellmann.',
  long_description_fr:
    'La Suite Lalique est le joyau du Prince de Galles : un duplex de 180 m² signé avec le cristallier Lalique, perché aux derniers étages avenue George V. Patrick Hellmann a composé un décor où cristal taillé, marbre noir et accents Art déco dialoguent avec la lumière parisienne — chaque pièce porte une œuvre Lalique unique.\n\nLe rez-de-chaussée aérien accueille un double salon et une salle à manger privée ; l’étage nuit abrite la chambre king size, un dressing et une salle de bain en marbre avec baignoire et douche à l’italienne. La terrasse privative domine les toits haussmanniens et, par temps clair, la tour Eiffel se découpe au-dessus des Champs-Élysées.\n\nOn y vient pour une demande en mariage, un anniversaire ou un séjour où l’on veut habiter l’Art déco dans sa forme la plus rare. Je la réserve longtemps à l’avance : elle est unique dans le paysage palace parisien. Confiez-moi votre projet d’arrivée — champagne, cristal, terrasse au coucher du soleil — je l’orchestre discrètement du début à la fin.',
  long_description_en:
    'The Lalique Suite is the jewel of Prince de Galles: a 180 sq m duplex created with crystal maker Lalique, perched on the top floors of Avenue George V. Patrick Hellmann designed a décor where cut crystal, black marble and Art Deco accents converse with Parisian light — each room carries a unique Lalique piece.\n\nThe airy lower level holds a double living room and a private dining room; the sleeping floor has a king-size bedroom, a dressing area and a marble bathroom with bathtub and walk-in shower. The private terrace overlooks the Haussmann rooftops and, on clear days, the Eiffel Tower rises above the Champs-Élysées.\n\nGuests come here for a proposal, an anniversary or a stay that means living Art Deco at its rarest. I book it well ahead: it is unique in the Parisian palace landscape. Trust me with your arrival plan — champagne, crystal, the terrace at sunset — and I orchestrate it discreetly from start to finish.',
  max_occupancy: 4,
  bed_type: 'Lit King size · duplex Lalique',
  size_sqm: 180,
  is_signature: true,
  display_order: 70,
  hero_image: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
  images: [
    {
      public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
      alt_fr:
        'Balcon de la Suite Patrick Hellmann avec vue sur la tour Eiffel, Prince de Galles Paris',
      alt_en:
        'Balcony of the Patrick Hellmann Suite with Eiffel Tower view, Prince de Galles Paris',
      category: 'suite',
    },
    {
      public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-22`,
      alt_fr: 'Salle de bain en marbre et mosaïque Art déco, Prince de Galles Paris',
      alt_en: 'Marble and Art Deco mosaic bathroom, Prince de Galles Paris',
      category: 'detail',
    },
    {
      public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-23`,
      alt_fr: 'Détail de mosaïque Art déco de la salle de bain, Prince de Galles Paris',
      alt_en: 'Art Deco mosaic bathroom detail, Prince de Galles Paris',
      category: 'detail',
    },
    {
      public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-24`,
      alt_fr:
        'Détail de décoration en cristal Lalique de la suite signature, Prince de Galles Paris',
      alt_en: 'Lalique crystal decorative detail of the signature suite, Prince de Galles Paris',
      category: 'detail',
    },
    {
      public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-20`,
      alt_fr: 'Vue sur l’avenue George V depuis une chambre, Prince de Galles Paris',
      alt_en: 'View over Avenue George V from a guest room, Prince de Galles Paris',
      category: 'view',
    },
  ],
} as const;

function imageCategoryForEntry(entry: PrinceDeGallesGoldenRoomEntry): 'room' | 'suite' {
  if (entry.slug.startsWith('suite-') || entry.is_signature === true) return 'suite';
  if (entry.size_sqm !== null && entry.size_sqm >= 48) return 'suite';
  return 'room';
}

/** Patch body for `hotel_rooms` upsert/patch (facts + single-frame gallery). */
export function princeDeGallesCatalogPatch(
  entry: PrinceDeGallesGoldenRoomEntry,
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
