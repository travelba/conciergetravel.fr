/**
 * Conrad Los Angeles — gallery manifest (kit fiche).
 *
 * Photo source: Google Places Photos API (real, attributed Conrad Los
 * Angeles imagery), re-hosted on Cloudinary under
 * `cct/hotels/conrad-los-angeles/places-*`. Ten photos is the Google
 * Places per-place ceiling; the kit 5×5 (25-photo) gallery gate stays
 * amber until an official Conrad/Hilton press kit is sourced. Alt +
 * captions are hand-authored (Hard Rule 16) after visual inspection of
 * each frame — never the weak Vision draft.
 *
 * Categories observed: pool ×2, room ×2, dining ×3, view ×1, lobby ×1,
 * detail ×1. No spa frame available from Places.
 */

export const CONRAD_LOS_ANGELES_IMAGE_PREFIX = 'cct/hotels/conrad-los-angeles';

const CREDIT = 'Conrad Los Angeles (Hilton) — via Google Maps';

/** Hero = rooftop terrace at sunset over Downtown (landscape, signature). */
export const CONRAD_LOS_ANGELES_HERO_IMAGE = `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-5`;

export const CONRAD_LOS_ANGELES_GALLERY_IMAGES = [
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-1`,
    category: 'pool',
    width: 819,
    height: 1024,
    representativeness: 8,
    hero_suitable: false,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr:
      'Piscine extérieure sur le rooftop du Conrad Los Angeles avec vue sur les gratte-ciel de Downtown',
    alt_en: 'Rooftop outdoor pool at Conrad Los Angeles overlooking the Downtown LA skyline',
    caption_fr:
      'La piscine du pool deck domine Downtown Los Angeles, transats alignés face aux tours de Bunker Hill.',
    caption_en:
      'The pool deck rises above Downtown Los Angeles, loungers lined up facing the Bunker Hill towers.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-2`,
    category: 'room',
    width: 1600,
    height: 900,
    representativeness: 8,
    hero_suitable: true,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Chambre King du Conrad Los Angeles avec baie vitrée sur le Walt Disney Concert Hall',
    alt_en:
      'King guest room at Conrad Los Angeles with a floor-to-ceiling window onto the Walt Disney Concert Hall',
    caption_fr:
      'Boiseries de chêne, lit king et fenêtre toute hauteur cadrant les courbes d’acier du Walt Disney Concert Hall signé Frank Gehry.',
    caption_en:
      'Oak panelling, a king bed and a full-height window framing the steel curves of Frank Gehry’s Walt Disney Concert Hall.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-3`,
    category: 'pool',
    width: 1600,
    height: 1067,
    representativeness: 8,
    hero_suitable: true,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Cabanas et transats au bord de la piscine rooftop du Conrad Los Angeles',
    alt_en: 'Cabanas and loungers by the rooftop pool at Conrad Los Angeles',
    caption_fr:
      'Sous la pergola de bois, cabanas et bains de soleil bordent le bassin extérieur du pool deck.',
    caption_en:
      'Under the timber pergola, cabanas and sun loungers line the outdoor pool on the deck.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-4`,
    category: 'detail',
    width: 1600,
    height: 900,
    representativeness: 6,
    hero_suitable: false,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Salle de bains en travertin d’une chambre du Conrad Los Angeles',
    alt_en: 'Travertine marble bathroom in a Conrad Los Angeles guest room',
    caption_fr:
      'Travertin pleine hauteur, double vasque et baignoire encastrée signent les salles de bains des chambres.',
    caption_en:
      'Full-height travertine, a double vanity and a recessed tub define the guest-room bathrooms.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-6`,
    category: 'dining',
    width: 1024,
    height: 576,
    representativeness: 8,
    hero_suitable: true,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Salle du restaurant San Laurel du chef José Andrés au Conrad Los Angeles',
    alt_en: 'Chef José Andrés’s San Laurel dining room at Conrad Los Angeles',
    caption_fr:
      'Tables de marbre et banquettes de San Laurel, la table signature de José Andrés, ouvertes sur le Walt Disney Concert Hall.',
    caption_en:
      'Marble tables and banquettes at San Laurel, José Andrés’s signature restaurant, opening onto the Walt Disney Concert Hall.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-7`,
    category: 'room',
    width: 1600,
    height: 2133,
    representativeness: 8,
    hero_suitable: false,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Salon et cuisine ouverte d’une suite du Conrad Los Angeles avec vue sur la ville',
    alt_en: 'Open-plan living room and kitchen of a Conrad Los Angeles suite with city view',
    caption_fr:
      'Les suites déploient salon, cuisine en chêne et îlot de marbre, baies vitrées ouvertes sur l’horizon de Los Angeles.',
    caption_en:
      'Suites unfold a living room, oak kitchen and marble island, with picture windows opening onto the Los Angeles horizon.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-8`,
    category: 'lobby',
    width: 1600,
    height: 1067,
    representativeness: 8,
    hero_suitable: true,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Lobby-salon du 10e étage du Conrad Los Angeles avec cheminée',
    alt_en: '10th-floor lobby lounge at Conrad Los Angeles with a fireplace',
    caption_fr:
      'Le lobby du 10e étage, au niveau des auditoriums du Music Center, mêle cheminée, sofas et fauteuils tressés.',
    caption_en:
      'The 10th-floor lobby, level with the Music Center auditoriums, blends a fireplace, sofas and woven armchairs.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-9`,
    category: 'dining',
    width: 1536,
    height: 1024,
    representativeness: 7,
    hero_suitable: false,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Planches à partager d’Agua Viva, le rooftop du Conrad Los Angeles',
    alt_en: 'Sharing boards at Agua Viva, the Conrad Los Angeles rooftop restaurant',
    caption_fr:
      'Sliders, croquettes et bouchées de thon : les planches à partager d’Agua Viva, le rooftop façon beach club.',
    caption_en:
      'Sliders, croquettes and tuna bites: the sharing boards at Agua Viva, the beach-club-style rooftop.',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-10`,
    category: 'dining',
    width: 1023,
    height: 682,
    representativeness: 8,
    hero_suitable: true,
    credit: CREDIT,
    licence: 'all-rights-reserved',
    alt_fr: 'Plats signature et champagne servis à San Laurel, Conrad Los Angeles',
    alt_en: 'Signature plates and champagne served at San Laurel, Conrad Los Angeles',
    caption_fr:
      'La cuisine espagnole de José Andrés revisitée au prisme californien : assiettes ciselées et champagne à San Laurel.',
    caption_en:
      'José Andrés’s Spanish cuisine through a Californian lens: refined plates and champagne at San Laurel.',
  },
] as const;

/** Filter categories represented in the manifest (kit legacy set). */
export const CONRAD_LOS_ANGELES_GALLERY_CATEGORIES = [
  'view',
  'room',
  'pool',
  'dining',
  'lobby',
  'detail',
] as const;
