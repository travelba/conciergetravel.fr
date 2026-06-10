/**
 * Curated amenity blocks for `#hotel-en-bref` on the Prince de Galles kit fiche.
 * Mirrors `AIRELLES_KIT_AMENITY_BLOCKS` in `kit-airelles-display.ts`.
 */

export type PrinceDeGallesKitAmenityIcon =
  | 'concierge'
  | 'spa'
  | 'dining'
  | 'room'
  | 'daily'
  | 'access';

export interface PrinceDeGallesKitAmenityBlock {
  readonly icon: PrinceDeGallesKitAmenityIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

/** Eight curated amenity blocks — Art déco, Le Patio, dining, wellness, balconies, Lalique. */
export const PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS: readonly PrinceDeGallesKitAmenityBlock[] = [
  {
    icon: 'room',
    titleFr: 'Palace Art déco (1929)',
    titleEn: 'Art Deco palace (1929)',
    descFr:
      'Façade André Arfvidson, mosaïques, marbre et photographies noir et blanc — héritage Luxury Collection depuis 1929.',
    descEn:
      'André Arfvidson façade, mosaics, marble and black-and-white photography — Luxury Collection heritage since 1929.',
  },
  {
    icon: 'dining',
    titleFr: 'Le Patio',
    titleEn: 'Le Patio',
    descFr:
      'Cour intérieure Art déco, brunch le week-end et tables en plein air — écrin visible depuis les balcons.',
    descEn:
      'Art Deco inner courtyard, weekend brunch and alfresco tables — setting visible from the balconies.',
  },
  {
    icon: 'dining',
    titleFr: 'Akira Back & 19.20',
    titleEn: 'Akira Back & 19.20',
    descFr:
      'Table fusion nippo-coréenne 1★ MICHELIN et bar-salon 19.20 by Norbert Tarayre sous le même toit.',
    descEn:
      'One-MICHELIN-star Japanese-Korean fusion and 19.20 by Norbert Tarayre bar-lounge under one roof.',
  },
  {
    icon: 'spa',
    titleFr: 'Wellness & CALMA',
    titleEn: 'Wellness & CALMA',
    descFr:
      'Centre de fitness, Wellness Suite avec hammam sur rendez-vous — soins CALMA en partenariat.',
    descEn:
      'Fitness centre, Wellness Suite with hammam by appointment — CALMA treatments in partnership.',
  },
  {
    icon: 'room',
    titleFr: 'Balcons & terrasses',
    titleEn: 'Balconies & terraces',
    descFr: '26 chambres et suites avec balcon ou terrasse sur Le Patio ou l’avenue George-V.',
    descEn: '26 rooms and suites with a balcony or terrace over Le Patio or avenue George-V.',
  },
  {
    icon: 'room',
    titleFr: 'Lalique en chambre',
    titleEn: 'Lalique in-room',
    descFr:
      'Produits d’accueil Lalique, têtes de lit miroitées, marbre et mosaïques Art déco en salle de bain.',
    descEn: 'Lalique toiletries, mirrored headboards, marble and Art Deco mosaic bathrooms.',
  },
  {
    icon: 'concierge',
    titleFr: 'Conciergerie 24h/24',
    titleEn: '24-hour concierge',
    descFr:
      'Réception et conciergerie en continu, voiturier, personnel multilingue, room service 24 h.',
    descEn:
      'Round-the-clock reception and concierge, valet, multilingual staff, 24-hour room service.',
  },
  {
    icon: 'access',
    titleFr: 'Triangle d’Or',
    titleEn: 'Golden Triangle',
    descFr:
      'Avenue George-V, métro George V (ligne 1), Champs-Élysées et avenue Montaigne à deux pas.',
    descEn:
      'Avenue George-V, George V metro (line 1), Champs-Élysées and Avenue Montaigne steps away.',
  },
];
