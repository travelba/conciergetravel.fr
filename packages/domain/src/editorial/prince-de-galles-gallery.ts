/**
 * Phase 3 — honest 30-image gallery manifest for `prince-de-galles-paris`.
 *
 * 2026-06-16 — re-audited against the live Cloudinary pixels (no drop, 30 kept).
 * The palace has NO on-site pool, and the former `concierge`/`events` slots were
 * padded with rooms, bathrooms and salons. Each slot is now categorised by its
 * real subject: the `pool`, `concierge` and `events` categories are gone, the
 * Piscine tab shrinks to nothing rather than showing a fabricated pool.
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-prince-de-galles-gallery-batch.ts`.
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

const PRINCE_DE_GALLES_DAM_PREFIX =
  'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/';
const PRINCE_DE_GALLES_DAM_SUFFIX =
  '?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*';

function princeDeGallesDamUrl(file: string): string {
  return `${PRINCE_DE_GALLES_DAM_PREFIX}${file}.jpg${PRINCE_DE_GALLES_DAM_SUFFIX}`;
}

export const PRINCE_DE_GALLES_HERO_IMAGE = 'cct/hotels/prince-de-galles-paris/hero';

export const PRINCE_DE_GALLES_HERO_SOURCE_URL = princeDeGallesDamUrl(
  'parlc-hotel-facade-5619-hor-wide',
);

export const PRINCE_DE_GALLES_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-1',
    category: 'exterior',
    alt_fr: 'Façade Art déco du Prince de Galles, avenue George V, Paris',
    alt_en: 'Art Deco facade of Prince de Galles on Avenue George V, Paris',
    caption_fr:
      'La façade en pierre claire du palace, inauguré en 1929, domine l’avenue George V à deux pas des Champs-Élysées.',
    caption_en:
      'The pale-stone palace facade, opened in 1929, overlooks Avenue George V steps from the Champs-Élysées.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-2',
    category: 'exterior',
    alt_fr: 'Entrée du Prince de Galles Paris, palace du Triangle d’Or',
    alt_en: 'Entrance of Prince de Galles Paris, Golden Triangle palace',
    caption_fr:
      'L’entrée du palace ouvre sur l’avenue George V, adresse discrète du Triangle d’Or depuis près d’un siècle.',
    caption_en:
      'The palace entrance opens onto Avenue George V, a discreet Golden Triangle address for nearly a century.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-3',
    category: 'exterior',
    alt_fr: 'Vue extérieure du Prince de Galles Paris, style Art déco',
    alt_en: 'Exterior view of Prince de Galles Paris, Art Deco style',
    caption_fr:
      'Les lignes géométriques de la façade incarnent l’Art déco parisien des années 1920, restaurées en 2014.',
    caption_en: 'The facade’s geometric lines embody 1920s Parisian Art Deco, restored in 2014.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-4',
    category: 'lobby',
    alt_fr: 'Lobby Art déco du Prince de Galles Paris, lustres et marbre',
    alt_en: 'Art Deco lobby at Prince de Galles Paris, chandeliers and marble',
    caption_fr:
      'Le lobby mêle marbre noir, bois de Macassar et lustres dorés, dans l’esprit d’un salon parisien des années 1920.',
    caption_en:
      'The lobby blends black marble, Macassar wood and gilded chandeliers, in the spirit of a 1920s Parisian salon.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-5',
    category: 'lobby',
    alt_fr: 'Escalier en marbre du Prince de Galles Paris',
    alt_en: 'Marble staircase at Prince de Galles Paris',
    caption_fr:
      'L’escalier en marbre relie les espaces publics du palace, entre photographies noir et blanc et lumière tamisée.',
    caption_en:
      'The marble staircase links the palace public spaces, between black-and-white photography and soft light.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-6',
    category: 'lobby',
    alt_fr: 'Salon d’accueil du Prince de Galles Paris, fauteuils capitonnés',
    alt_en: 'Reception lounge at Prince de Galles Paris, tufted armchairs',
    caption_fr:
      'Le salon d’accueil accueille les arrivées dans un décor feutré : velours, boiseries laquées et lumière dorée.',
    caption_en:
      'The reception lounge welcomes arrivals in a hushed setting: velvet, lacquered panelling and golden light.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-7',
    category: 'room',
    alt_fr: 'Chambre Art Déco Deluxe du Prince de Galles Paris, tête de lit miroitée',
    alt_en: 'Art Deco Deluxe Room at Prince de Galles Paris with a mirrored headboard',
    caption_fr:
      'La chambre Art Déco Deluxe signe la maison : lignes géométriques, tête de lit miroitée et linge fin.',
    caption_en:
      'The Art Deco Deluxe Room carries the house signature: geometric lines, a mirrored headboard and fine linen.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-8',
    category: 'room',
    alt_fr: 'Coin nuit d’une chambre Art déco, lit king size, Prince de Galles Paris',
    alt_en: 'Sleeping area of an Art Deco room with a king bed, Prince de Galles Paris',
    caption_fr:
      'Le coin nuit, habillé d’un lit king size, prolonge la palette sobre et lumineuse des 116 chambres du palace.',
    caption_en:
      'The sleeping area, dressed with a king-size bed, extends the sober, bright palette of the palace’s 116 rooms.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-9',
    category: 'room',
    alt_fr: 'Chambre avec vue sur la cour intérieure, Prince de Galles Paris',
    alt_en: 'Guest room with a courtyard view, Prince de Galles Paris',
    caption_fr:
      'Côté cour, la chambre ouvre sur Le Patio, la cour intérieure mosaïquée au calme du cœur d’îlot parisien.',
    caption_en:
      'On the courtyard side, the room opens onto Le Patio, the mosaic inner courtyard quiet at the heart of the block.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-10',
    category: 'dining',
    alt_fr: 'Le Patio du Prince de Galles Paris, cour mosaïquée',
    alt_en: 'Le Patio at Prince de Galles Paris, mosaic courtyard',
    caption_fr:
      'Le Patio, cour mosaïquée au cœur du palace, sert petits déjeuners, déjeuners et cocktails à l’abri de l’avenue.',
    caption_en:
      'Le Patio, the mosaic courtyard at the heart of the palace, serves breakfast, lunch and cocktails sheltered from the avenue.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-11',
    category: 'dining',
    alt_fr: 'Terrasse végétalisée de Le Patio, Prince de Galles Paris',
    alt_en: 'Planted terrace of Le Patio, Prince de Galles Paris',
    caption_fr:
      'La terrasse de Le Patio mêle mosaïques Art déco et verdure, refuge estival à deux pas des Champs-Élysées.',
    caption_en:
      'Le Patio terrace blends Art Deco mosaics and greenery, a summer refuge steps from the Champs-Élysées.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-12',
    category: 'dining',
    alt_fr: 'Brunch dominical au Prince de Galles Paris',
    alt_en: 'Sunday brunch at Prince de Galles Paris',
    caption_fr:
      'Le brunch du palace aligne pâtisseries fines, créations salées et bulles, servi au Akira Back ou sur Le Patio.',
    caption_en:
      'The palace brunch lines fine pastries, savoury creations and sparkling wine, served at Akira Back or on Le Patio.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-13',
    category: 'spa',
    alt_fr: 'Hammam et douche de la Wellness Suite CALMA PARIS, Prince de Galles Paris',
    alt_en: 'Hammam and shower in the CALMA PARIS Wellness Suite, Prince de Galles Paris',
    caption_fr:
      'Le hammam de la Wellness Suite CALMA PARIS prolonge les soins visage et corps — accès privatif sur rendez-vous, au cœur du palace George V.',
    caption_en:
      'The CALMA PARIS Wellness Suite hammam extends face and body treatments — private access by appointment at the heart of the George V palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-14',
    category: 'spa',
    alt_fr: 'Espace détente de la Wellness Suite CALMA PARIS, Prince de Galles Paris',
    alt_en: 'Relaxation area of the CALMA PARIS Wellness Suite, Prince de Galles Paris',
    caption_fr:
      'Matériaux nobles et lumière tamisée composent l’atmosphère méditerranéenne de la Wellness Suite, exclusive au Prince de Galles à Paris.',
    caption_en:
      'Noble materials and soft light shape the Mediterranean mood of the Wellness Suite, exclusive to Prince de Galles in Paris.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-15',
    category: 'detail',
    alt_fr: 'Salle de bain en marbre d’une suite signature, Prince de Galles Paris',
    alt_en: 'Marble bathroom of a signature suite, Prince de Galles Paris',
    caption_fr:
      'Douche et baignoire séparées, marbre et produits Lalique composent le rituel bien-être des suites du palace.',
    caption_en:
      'Separate shower and bath, marble and Lalique amenities make up the wellness ritual in the palace suites.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-16',
    category: 'detail',
    alt_fr: 'Salle de fitness 24h/24 du Prince de Galles Paris',
    alt_en: '24-hour fitness room at Prince de Galles Paris',
    caption_fr:
      'Pas de piscine sur site : le palace équipe une salle de fitness ouverte vingt-quatre heures sur vingt-quatre ; la conciergerie oriente vers les clubs voisins pour la natation.',
    caption_en:
      'No on-site pool: the palace offers a twenty-four-hour fitness room; the concierge directs guests to nearby clubs for swimming.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-17',
    category: 'spa',
    alt_fr: 'Massage duo en Wellness Suite CALMA PARIS, Prince de Galles Paris',
    alt_en: 'Duo massage in the CALMA PARIS Wellness Suite, Prince de Galles Paris',
    caption_fr:
      'La Wellness Suite CALMA PARIS propose massages duo et rituels à la fleur d’oranger amère — exclusive au palace, sur rendez-vous de 9 h à 21 h.',
    caption_en:
      'The CALMA PARIS Wellness Suite offers duo massages and bitter-orange blossom rituals — exclusive to the palace, by appointment from 9 am to 9 pm.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-18',
    category: 'room',
    alt_fr: 'Suite du Prince de Galles Paris, salon sombre ouvert sur les toits de Paris',
    alt_en: 'Prince de Galles Paris suite, dark living room opening onto the Paris rooftops',
    caption_fr:
      'Le salon de la suite ouvre par sa baie sur les toits du Triangle d’Or — le palace n’a pas de piscine, mais cultive ces échappées parisiennes.',
    caption_en:
      'The suite living room opens through its bay onto the Golden Triangle rooftops — the palace has no pool, but cultivates these Parisian vistas.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-19',
    category: 'view',
    alt_fr:
      'Balcon de la Suite Patrick Hellmann avec vue sur la tour Eiffel, Prince de Galles Paris',
    alt_en: 'Balcony of the Patrick Hellmann Suite with Eiffel Tower view, Prince de Galles Paris',
    caption_fr:
      'Depuis le balcon de la suite signature, les toits de Paris et la tour Eiffel se dévoilent au-dessus de l’avenue George V.',
    caption_en:
      'From the signature suite balcony, the Paris rooftops and the Eiffel Tower unfold above Avenue George V.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-20',
    category: 'view',
    alt_fr: 'Vue sur l’avenue George V depuis une chambre, Prince de Galles Paris',
    alt_en: 'View over Avenue George V from a guest room, Prince de Galles Paris',
    caption_fr:
      'Côté avenue, la chambre attrape l’animation du Triangle d’Or et la lumière du boulevard George V.',
    caption_en:
      'On the avenue side, the room catches the Golden Triangle energy and the light of George V.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-21',
    category: 'view',
    alt_fr: 'Tour Eiffel vue depuis le Prince de Galles Paris',
    alt_en: 'Eiffel Tower seen from Prince de Galles Paris',
    caption_fr:
      'Depuis les étages supérieurs, la tour Eiffel domine l’horizon parisien, à quelques minutes à pied du palace.',
    caption_en:
      'From the upper floors, the Eiffel Tower dominates the Paris skyline, a few minutes’ walk from the palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-22',
    category: 'detail',
    alt_fr: 'Salle de bain en marbre et mosaïque Art déco, Prince de Galles Paris',
    alt_en: 'Marble and Art Deco mosaic bathroom, Prince de Galles Paris',
    caption_fr:
      'Le marbre et la mosaïque d’inspiration Art déco composent les salles de bain, signature tactile du palace.',
    caption_en:
      'Marble and Art Deco-inspired mosaic shape the bathrooms, a tactile signature of the palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-23',
    category: 'room',
    alt_fr: 'Chambre du Prince de Galles Paris, tête de lit capitonnée et photographies encadrées',
    alt_en: 'Guest room at Prince de Galles Paris, tufted headboard and framed photography',
    caption_fr:
      'La chambre décline la palette feutrée du palace — tête de lit capitonnée, tons taupe et photographies encadrées.',
    caption_en:
      'The room reprises the palace’s hushed palette — tufted headboard, taupe tones and framed photography.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-24',
    category: 'room',
    alt_fr: 'Salon d’une suite signature du Prince de Galles Paris, miroir et fauteuils',
    alt_en: 'Signature suite living room at Prince de Galles Paris, mirror and armchairs',
    caption_fr:
      'Le salon de la suite signature réunit boiseries laquées, miroir d’apparat et fauteuils — l’esprit d’un appartement parisien des années 1920.',
    caption_en:
      'The signature suite living room gathers lacquered panelling, a statement mirror and armchairs — the spirit of a 1920s Parisian apartment.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-25',
    category: 'room',
    alt_fr: 'Chambre du Prince de Galles Paris, tête de lit dorée et chevets éclairés',
    alt_en: 'Guest room at Prince de Galles Paris, golden headboard and lit bedside tables',
    caption_fr:
      'La chambre habille son lit d’une tête capitonnée dorée et de chevets éclairés — confort feutré derrière la façade Art déco.',
    caption_en:
      'The room dresses its bed with a golden tufted headboard and lit bedside tables — hushed comfort behind the Art Deco facade.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-26',
    category: 'detail',
    alt_fr:
      'Salle de bain en marbre d’une suite, baignoire et rideaux dorés, Prince de Galles Paris',
    alt_en: 'Marble suite bathroom with bathtub and golden drapes, Prince de Galles Paris',
    caption_fr:
      'La salle de bain de la suite déploie marbre, baignoire îlot et rideaux dorés — le rituel bien-être à domicile du palace.',
    caption_en:
      'The suite bathroom unfolds marble, a freestanding bath and golden drapes — the palace’s in-room wellness ritual.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-27',
    category: 'view',
    alt_fr: 'Balcon d’une suite du Prince de Galles Paris, table bistrot et vue sur les toits',
    alt_en: 'Suite balcony at Prince de Galles Paris, bistro table and rooftop view',
    caption_fr:
      'Le balcon de la suite installe une table bistrot face aux toits du Triangle d’Or — un petit déjeuner suspendu au-dessus de l’avenue George V.',
    caption_en:
      'The suite balcony sets a bistro table facing the Golden Triangle rooftops — breakfast suspended above Avenue George V.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-28',
    category: 'room',
    alt_fr: 'Salon d’une suite du Prince de Galles Paris, miroir rond et fauteuils Art déco',
    alt_en: 'Suite living room at Prince de Galles Paris, round mirror and Art Deco armchairs',
    caption_fr:
      'Le salon de la suite réunit miroir rond, fauteuils Art déco et œuvres encadrées — un séjour habillé comme un appartement privé.',
    caption_en:
      'The suite living room gathers a round mirror, Art Deco armchairs and framed works — a lounge dressed like a private apartment.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-29',
    category: 'room',
    alt_fr:
      'Salon de la Suite Mosaïque, canapés clairs ouverts sur la verdure, Prince de Galles Paris',
    alt_en: 'Mosaic Suite living room, pale sofas opening onto greenery, Prince de Galles Paris',
    caption_fr:
      'Le salon de la Suite Mosaïque aligne canapés clairs et baies ouvertes sur la verdure du Patio — un séjour au calme du cœur d’îlot.',
    caption_en:
      'The Mosaic Suite living room lines pale sofas and bays opening onto the Patio greenery — a stay in the quiet heart of the block.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-30',
    category: 'detail',
    alt_fr:
      'Salle de bain en marbre d’une suite, baignoire et œuvre contemporaine, Prince de Galles Paris',
    alt_en: 'Marble suite bathroom with bathtub and contemporary artwork, Prince de Galles Paris',
    caption_fr:
      'La salle de bain de la Suite Mosaïque marie marbre, baignoire îlot et œuvre contemporaine — le bien-être en suite, signature du palace.',
    caption_en:
      'The Mosaic Suite bathroom marries marble, a freestanding bath and contemporary artwork — in-suite wellness, a palace signature.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
] as const;

/** Raw Marriott DAM / Scene7 URLs per press slot (hero excluded — deduped in {@link PRINCE_DE_GALLES_GALLERY_SOURCE_URLS}). */
export const PRINCE_DE_GALLES_GALLERY_PRESS_SLOT_URLS = [
  princeDeGallesDamUrl('parlc-hotel-facade-5618-hor-clsc'),
  princeDeGallesDamUrl('parlc-hotel-facade-5619-hor-clsc'),
  princeDeGallesDamUrl('parlc-exterior-4792-hor-clsc'),
  princeDeGallesDamUrl('parlc-lobby-9112-hor-clsc'),
  princeDeGallesDamUrl('parlc-marble-stairs-6041-ver-clsc'),
  princeDeGallesDamUrl('parlc-suite-living-8696-hor-wide'),
  princeDeGallesDamUrl('parlc-art-deco-1138-hor-wide'),
  princeDeGallesDamUrl('parlc-art-deco-6033-hor-wide'),
  princeDeGallesDamUrl('parlc-courtyardview-guestroom-0592-hor-wide'),
  princeDeGallesDamUrl('parlc-patio-5651-hor-clsc'),
  princeDeGallesDamUrl('parlc-le-patio-0640-hor-clsc'),
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-s-lection-shooting-oubrun-18140:Classic-Hor?wid=2880&fit=constrain',
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-hammam2-40183:Classic-Hor?wid=2880&fit=constrain',
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-relax2-39825:Classic-Hor?wid=2880&fit=constrain',
  princeDeGallesDamUrl('parlc-suite-bathroom-0856-hor-wide'),
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-gym-27587:Classic-Hor?wid=2880&fit=constrain',
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-double-13746:Classic-Hor?wid=2880&fit=constrain',
  princeDeGallesDamUrl('parlc-suite-patrick-hellmann-0852-hor-wide'),
  princeDeGallesDamUrl('parlc-george-view-2593-hor-wide'),
  princeDeGallesDamUrl('parlc-attraction-eiffel-0251-hor-clsc'),
  princeDeGallesDamUrl('parlc-art-deco-0642-hor-wide'),
  princeDeGallesDamUrl('parlc-art-deco-0643-hor-wide'),
  princeDeGallesDamUrl('parlc-suite-patrick-hellmann-0855-hor-clsc'),
  'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lobby-and-concierge--23375:Classic-Hor?wid=2880&fit=constrain',
  princeDeGallesDamUrl('parlc-prince-5630-hor-clsc'),
  princeDeGallesDamUrl('parlc-prince-9090-hor-wide'),
  princeDeGallesDamUrl('parlc-prince-5632-hor-wide'),
  princeDeGallesDamUrl('parlc-mosaic-suite-4802-hor-wide'),
  princeDeGallesDamUrl('parlc-patio-5653-hor-clsc'),
  princeDeGallesDamUrl('parlc-mosaic-suite-4800-hor-wide'),
] as const;

/** Provenance URLs for promote + `kit.02.gallery_source_url_tracked` (hero excluded). */
export const PRINCE_DE_GALLES_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  PRINCE_DE_GALLES_GALLERY_PRESS_SLOT_URLS,
  PRINCE_DE_GALLES_HERO_SOURCE_URL,
);

/** Honest categories represented in the manifest (no pool — heritage building has none). */
export const PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'spa',
  'view',
  'detail',
] as const;
