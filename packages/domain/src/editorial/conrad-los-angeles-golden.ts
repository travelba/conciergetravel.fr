/**
 * Conrad Los Angeles "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override (`patch-kit-golden-row.ts`)
 * and the catalogue promotion script (`@mch/editorial-pilot`).
 *
 * Facts sourced from the official Conrad Los Angeles / The Grand LA channels,
 * San Laurel (sanlaurel.com), Agua Viva, Forbes Travel Guide, José Andrés
 * group press and the Google Business Profile. Figures not confidently
 * sourced are omitted.
 *
 * IMPORTANT — booking_mode is INTENTIONALLY omitted from the golden field map.
 * Conrad LA is a Travelport (RateHawk) booking pilot; the promote script and
 * `mergeGoldenRow` must never overwrite `booking_mode='travelport'`. The kit
 * golden overlays editorial content + photos only.
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import { CONRAD_LOS_ANGELES_CONCIERGE_QUESTIONS_KIT } from './conrad-los-angeles-concierge-questions';
import {
  CONRAD_LOS_ANGELES_GALLERY_IMAGES,
  CONRAD_LOS_ANGELES_HERO_IMAGE,
  CONRAD_LOS_ANGELES_IMAGE_PREFIX,
} from './conrad-los-angeles-gallery';
import { buildKitWaveFaqKit, buildKitWaveFaqPromote } from './kit-wave-faq-seed';

export const CONRAD_LOS_ANGELES_PROMOTE_SLUG = 'conrad-los-angeles';

const PHONE_DISPLAY = '+1 213-349-8585';

export const CONRAD_LOS_ANGELES_PHONE_E164 = '+12133498585';
export const CONRAD_LOS_ANGELES_ADDRESS = '100 South Grand Avenue';
export const CONRAD_LOS_ANGELES_POSTAL_CODE = '90012';
export const CONRAD_LOS_ANGELES_LATITUDE = 34.05686;
export const CONRAD_LOS_ANGELES_LONGITUDE = -118.2493;

// ---------------------------------------------------------------------------
// restaurant_info.venues — José Andrés dining program (CDC D7)
// ---------------------------------------------------------------------------

export const CONRAD_LOS_ANGELES_RESTAURANT_INFO = {
  count: 3,
  michelin_stars: 0,
  venues: [
    {
      name: 'San Laurel',
      type_fr: 'Table signature · Cuisine espagnole au prisme californien · Chef José Andrés',
      type_en: 'Signature table · Spanish cuisine through a Californian lens · Chef José Andrés',
      chef: 'José Andrés',
      features: ['Vue Walt Disney Concert Hall', '10e étage', 'Terrasse San Laurel'],
      hours_fr: 'Petit-déjeuner, déjeuner et dîner selon service',
      hours_en: 'Breakfast, lunch and dinner per service',
      description_fr:
        'San Laurel est la table signature de José Andrés au 10e étage : cuisine espagnole revisitée avec les produits du marché californien, salle ouverte sur le Walt Disney Concert Hall et terrasse panoramique.',
      description_en:
        'San Laurel is José Andrés’s signature 10th-floor table: Spanish cuisine reimagined with Californian market produce, a dining room open to the Walt Disney Concert Hall and a panoramic terrace.',
      website: 'https://www.sanlaurel.com/',
      reservation_url: 'https://www.sanlaurel.com/',
      phone: PHONE_DISPLAY,
      price_note_fr: 'À la carte · menus dégustation',
      price_note_en: 'À la carte · tasting menus',
      tip_fr:
        'Mon conseil : calez le dîner sur un match à domicile des Dodgers — les soirs de victoire, les feux d’artifice du stade s’invitent à l’horizon depuis la salle.',
      tip_en:
        'My tip: time dinner with a Dodgers home game — on win nights the stadium fireworks join the horizon from the dining room.',
    },
    {
      name: 'Agua Viva',
      type_fr: 'Rooftop alfresco · Fruits de mer & tapas · Ambiance beach club',
      type_en: 'Alfresco rooftop · Seafood & tapas · Beach-club mood',
      chef: 'José Andrés',
      features: ['Rooftop', 'Vue Downtown', 'Bar à cocktails'],
      hours_fr: 'Déjeuner et dîner selon saison',
      hours_en: 'Lunch and dinner per season',
      description_fr:
        'Agua Viva est le rooftop façon beach club : fruits de mer, tapas et nori handrolls servis en plein air, face aux gratte-ciel de Downtown. L’adresse Instagram de l’hôtel.',
      description_en:
        'Agua Viva is the beach-club-style rooftop: seafood, tapas and nori handrolls served alfresco, facing the Downtown towers. The hotel’s Instagram address.',
      website: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/dining/',
      reservation_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/dining/',
      phone: PHONE_DISPLAY,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : réservez une table en terrasse en fin d’après-midi — le coucher de soleil sur Bunker Hill vaut l’apéritif.',
      tip_en:
        'My tip: book a terrace table in the late afternoon — sunset over Bunker Hill is worth the aperitivo.',
    },
    {
      name: 'The Beaudry Room',
      type_fr: 'Bar à cocktails · Avant ou après concert',
      type_en: 'Cocktail bar · Before or after the concert',
      features: ['Cocktails d’auteur', 'Face au Music Center', 'Ambiance feutrée'],
      hours_fr: 'Soirée selon programme',
      hours_en: 'Evenings per schedule',
      description_fr:
        'The Beaudry Room signe l’expérience cocktail de l’hôtel : créations d’auteur dans une ambiance feutrée, idéales avant ou après un spectacle au Walt Disney Concert Hall, juste en face.',
      description_en:
        'The Beaudry Room delivers the hotel cocktail experience: signature creations in a hushed setting, perfect before or after a show at the Walt Disney Concert Hall across the street.',
      website: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/dining/',
      reservation_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/dining/',
      phone: PHONE_DISPLAY,
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : commandez le Foggy Hill, un Negroni de gastronomie moléculaire servi en bécher de laboratoire — la signature maison.',
      tip_en:
        'My tip: order the Foggy Hill, a molecular-gastronomy Negroni served from a lab beaker — the house signature.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — Downtown LA / Grand Avenue cultural corridor
// ---------------------------------------------------------------------------

export const CONRAD_LOS_ANGELES_POINTS_OF_INTEREST = [
  {
    name: 'Walt Disney Concert Hall',
    name_en: 'Walt Disney Concert Hall',
    type: 'concert-hall',
    category_fr: 'Salle de concert emblématique',
    category_en: 'Emblematic concert hall',
    distance_meters: 90,
    walk_minutes: 1,
    latitude: 34.0553,
    longitude: -118.2498,
    bucket: 'visit',
    description_fr:
      'Signée Frank Gehry, siège du Los Angeles Philharmonic, la salle se rejoint en une minute à pied, juste en face de l’hôtel.',
    description_en:
      'Designed by Frank Gehry, home of the Los Angeles Philharmonic, the hall is a one-minute walk away, directly across from the hotel.',
    website: 'https://www.laphil.com/',
    address: '111 S Grand Ave, Los Angeles, CA 90012',
    tip_fr:
      'Mon conseil : réservez un dîner à San Laurel avant le concert — la salle est littéralement de l’autre côté de la rue.',
    tip_en:
      'My tip: book dinner at San Laurel before the concert — the hall is literally across the street.',
  },
  {
    name: 'The Broad',
    name_en: 'The Broad',
    type: 'museum',
    category_fr: 'Musée d’art contemporain',
    category_en: 'Contemporary art museum',
    distance_meters: 180,
    walk_minutes: 2,
    latitude: 34.0544,
    longitude: -118.2506,
    bucket: 'visit',
    description_fr:
      'Musée d’art contemporain gratuit (collection Broad) — Infinity Mirror Rooms de Yayoi Kusama et chefs-d’œuvre, deux minutes à pied.',
    description_en:
      'Free contemporary art museum (the Broad collection) — Yayoi Kusama’s Infinity Mirror Rooms and masterpieces, two minutes on foot.',
    website: 'https://www.thebroad.org/',
    address: '221 S Grand Ave, Los Angeles, CA 90012',
    price_note_fr: 'Entrée gratuite · billets horodatés recommandés',
    price_note_en: 'Free admission · timed tickets recommended',
    tip_fr:
      'Mon conseil : laissez la conciergerie réserver un billet horodaté du matin — l’Infinity Room se visite alors sans la file.',
    tip_en:
      'My tip: let the concierge book a morning timed ticket — the Infinity Room is then queue-free.',
  },
  {
    name: 'MOCA Grand Avenue',
    name_en: 'MOCA Grand Avenue',
    type: 'museum',
    category_fr: 'Art contemporain',
    category_en: 'Contemporary art',
    distance_meters: 260,
    walk_minutes: 3,
    latitude: 34.0531,
    longitude: -118.2503,
    bucket: 'visit',
    description_fr:
      'Le Museum of Contemporary Art déploie sa collection d’après-guerre à trois minutes à pied, sur Grand Avenue.',
    description_en:
      'The Museum of Contemporary Art unfolds its post-war collection three minutes on foot, on Grand Avenue.',
    website: 'https://www.moca.org/',
    address: '250 S Grand Ave, Los Angeles, CA 90012',
    tip_fr: 'Mon conseil : vérifiez les nocturnes — la collection se parcourt au calme en soirée.',
    tip_en: 'My tip: check the late openings — the collection is quiet in the evening.',
  },
  {
    name: 'Music Center & Dorothy Chandler Pavilion',
    name_en: 'Music Center & Dorothy Chandler Pavilion',
    type: 'theatre',
    category_fr: 'Opéra & arts de la scène',
    category_en: 'Opera & performing arts',
    distance_meters: 160,
    walk_minutes: 2,
    latitude: 34.0566,
    longitude: -118.2487,
    bucket: 'visit',
    description_fr:
      'Le Music Center réunit opéra (LA Opera), danse et théâtre — alternative idéale les soirs où le Concert Hall est complet.',
    description_en:
      'The Music Center gathers opera (LA Opera), dance and theatre — an ideal alternative when the Concert Hall is sold out.',
    website: 'https://www.musiccenter.org/',
    address: '135 N Grand Ave, Los Angeles, CA 90012',
    tip_fr:
      'Mon conseil : le lobby du 10e étage de l’hôtel est au niveau des auditoriums — l’accès aux salles est immédiat.',
    tip_en:
      'My tip: the hotel 10th-floor lobby sits level with the auditoriums — venue access is immediate.',
  },
  {
    name: 'Grand Park',
    name_en: 'Grand Park',
    type: 'garden',
    category_fr: 'Parc urbain',
    category_en: 'Urban park',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 34.0564,
    longitude: -118.246,
    bucket: 'do',
    description_fr:
      'Le Grand Park déroule pelouses et fontaine rose entre l’hôtel et l’Hôtel de Ville — pause familiale et festivals en plein air.',
    description_en:
      'Grand Park rolls out lawns and its pink fountain between the hotel and City Hall — a family pause and open-air festivals.',
    website: 'https://grandparkla.org/',
    address: '200 N Grand Ave, Los Angeles, CA 90012',
    tip_fr: 'Mon conseil : idéal pour une matinée avec enfants, face à l’hôtel.',
    tip_en: 'My tip: ideal for a morning with children, opposite the hotel.',
  },
  {
    name: 'Cathedral of Our Lady of the Angels',
    name_en: 'Cathedral of Our Lady of the Angels',
    type: 'cathedral',
    category_fr: 'Cathédrale contemporaine',
    category_en: 'Contemporary cathedral',
    distance_meters: 280,
    walk_minutes: 4,
    latitude: 34.0578,
    longitude: -118.2461,
    bucket: 'do',
    description_fr:
      'La cathédrale Notre-Dame-des-Anges, signée Rafael Moneo, marie béton et albâtre — quatre minutes à pied.',
    description_en:
      'The Rafael Moneo cathedral marries concrete and alabaster — four minutes on foot.',
    website: 'https://olacathedral.org/',
    address: '555 W Temple St, Los Angeles, CA 90012',
    tip_fr: 'Mon conseil : la lumière d’albâtre se lit le mieux en fin de matinée.',
    tip_en: 'My tip: the alabaster light reads best in late morning.',
  },
  {
    name: 'Grand Central Market',
    name_en: 'Grand Central Market',
    type: 'market',
    category_fr: 'Marché alimentaire historique (1917)',
    category_en: 'Historic food hall (1917)',
    distance_meters: 700,
    walk_minutes: 10,
    latitude: 34.0507,
    longitude: -118.2489,
    bucket: 'do',
    description_fr:
      'Marché couvert de 1917 : tacos, café de spécialité et cuisines du monde — dix minutes à pied via Angels Flight.',
    description_en:
      '1917 food hall: tacos, specialty coffee and global kitchens — ten minutes on foot via Angels Flight.',
    website: 'https://grandcentralmarket.com/',
    address: '317 S Broadway, Los Angeles, CA 90013',
    tip_fr:
      'Mon conseil : descendez par Angels Flight, le funiculaire historique de Bunker Hill, puis remontez à pied.',
    tip_en:
      'My tip: ride down on Angels Flight, the historic Bunker Hill funicular, then walk back up.',
  },
  {
    name: 'Angels Flight Railway',
    name_en: 'Angels Flight Railway',
    type: 'landmark',
    category_fr: 'Funiculaire historique',
    category_en: 'Historic funicular',
    distance_meters: 600,
    walk_minutes: 8,
    latitude: 34.0511,
    longitude: -118.2497,
    bucket: 'do',
    description_fr:
      'Le plus court chemin de fer du monde relie Bunker Hill à Grand Central Market depuis 1901 — une institution de Downtown.',
    description_en:
      'The world’s shortest railway has linked Bunker Hill to Grand Central Market since 1901 — a Downtown institution.',
    address: '350 S Grand Ave, Los Angeles, CA 90071',
    tip_fr: 'Mon conseil : un aller à un dollar, parfait pour rejoindre le marché.',
    tip_en: 'My tip: a one-dollar ride, perfect to reach the market.',
  },
  {
    name: 'The Last Bookstore',
    name_en: 'The Last Bookstore',
    type: 'shop',
    category_fr: 'Librairie indépendante iconique',
    category_en: 'Iconic independent bookstore',
    distance_meters: 850,
    walk_minutes: 11,
    latitude: 34.0477,
    longitude: -118.2496,
    bucket: 'shop',
    description_fr:
      'Plus grande librairie d’occasion de Californie, célèbre pour son tunnel de livres et ses arches — onze minutes à pied.',
    description_en:
      'California’s largest used bookstore, famous for its book tunnel and arches — eleven minutes on foot.',
    website: 'https://lastbookstorela.com/',
    address: '453 S Spring St, Los Angeles, CA 90013',
    tip_fr:
      'Mon conseil : montez à la mezzanine pour les arches en livres, l’angle le plus photographié.',
    tip_en: 'My tip: head to the mezzanine for the book arches, the most photographed corner.',
  },
  {
    name: 'Crypto.com Arena & L.A. Live',
    name_en: 'Crypto.com Arena & L.A. Live',
    type: 'arena',
    category_fr: 'Sport & concerts',
    category_en: 'Sports & concerts',
    distance_meters: 1500,
    walk_minutes: 18,
    latitude: 34.043,
    longitude: -118.2673,
    bucket: 'do',
    description_fr:
      'Lakers, Kings et grands concerts à L.A. Live — dix minutes en voiture, la conciergerie réserve billets et transfert.',
    description_en:
      'Lakers, Kings and major concerts at L.A. Live — ten minutes by car, the concierge books tickets and transfer.',
    website: 'https://www.cryptoarena.com/',
    address: '1111 S Figueroa St, Los Angeles, CA 90015',
    tip_fr:
      'Mon conseil : laissez la voiture à l’hôtel les soirs de match — le voiturier coordonne le retour.',
    tip_en: 'My tip: leave the car at the hotel on game nights — valet coordinates the return.',
  },
  {
    name: 'Little Tokyo',
    name_en: 'Little Tokyo',
    type: 'neighbourhood',
    category_fr: 'Quartier historique japonais',
    category_en: 'Historic Japanese district',
    distance_meters: 1100,
    walk_minutes: 14,
    latitude: 34.0505,
    longitude: -118.2401,
    bucket: 'do',
    description_fr:
      'Little Tokyo aligne izakayas, pâtisseries et le Japanese American National Museum — quatorze minutes à pied.',
    description_en:
      'Little Tokyo lines up izakayas, bakeries and the Japanese American National Museum — fourteen minutes on foot.',
    address: 'Little Tokyo, Los Angeles, CA 90012',
    tip_fr: 'Mon conseil : goûtez un mochi chez Fugetsu-do, ouvert depuis 1903.',
    tip_en: 'My tip: try a mochi at Fugetsu-do, open since 1903.',
  },
  {
    name: 'Rodeo Drive — Beverly Hills',
    name_en: 'Rodeo Drive — Beverly Hills',
    type: 'shopping',
    category_fr: 'Artère du luxe',
    category_en: 'Luxury shopping street',
    distance_meters: 13000,
    walk_minutes: 30,
    latitude: 34.0676,
    longitude: -118.4012,
    bucket: 'shop',
    description_fr:
      'Les maisons de luxe de Rodeo Drive se rejoignent en voiture selon le trafic — la conciergerie coordonne chauffeur et rendez-vous boutique.',
    description_en:
      'Rodeo Drive’s luxury houses are reachable by car depending on traffic — the concierge coordinates chauffeur and boutique appointments.',
    address: 'Rodeo Dr, Beverly Hills, CA 90210',
    tip_fr: 'Mon conseil : partez en milieu de matinée pour éviter le trafic du 10 et du 110.',
    tip_en: 'My tip: leave mid-morning to dodge the 10 and 110 traffic.',
  },
] as const;

// ---------------------------------------------------------------------------
// concierge_advice + concierge_pick + concierge_hook
// ---------------------------------------------------------------------------

export const CONRAD_LOS_ANGELES_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez une chambre orientée ouest entre le 12e et le 15e étage — la vue sur les courbes d’acier du Walt Disney Concert Hall y est la plus nette, et le double vitrage tient le calme malgré Downtown. Le rituel que je recommande : petit-déjeuner à San Laurel face au Concert Hall, quelques longueurs à la piscine du rooftop en fin de matinée, puis un cocktail à The Beaudry Room avant le spectacle d’en face. Précisez votre heure d’arrivée — la house car et le voiturier s’organisent à l’avance.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for a west-facing room between the 12th and 15th floor — the view onto the Walt Disney Concert Hall’s steel curves is clearest there, and the double glazing holds the calm despite Downtown. The ritual I recommend: breakfast at San Laurel facing the Concert Hall, a few laps in the rooftop pool late morning, then a cocktail at The Beaudry Room before the show across the street. Share your arrival time — the house car and valet are arranged ahead.',
  },
} as const;

export const CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG = 'premium-view-king';

export const CONRAD_LOS_ANGELES_CONCIERGE_PICK_NOTE = {
  fr: 'Baie vitrée toute hauteur sur le Walt Disney Concert Hall, orientation ouest aux étages 12-15 — la chambre que je bloque en premier pour une première venue.',
  en: 'Floor-to-ceiling window onto the Walt Disney Concert Hall, west aspect on floors 12-15 — the room I hold first for a first stay.',
} as const;

export const CONRAD_LOS_ANGELES_CONCIERGE_PICK = {
  slug: CONRAD_LOS_ANGELES_CONCIERGE_PICK_SLUG,
  note: CONRAD_LOS_ANGELES_CONCIERGE_PICK_NOTE,
} as const;

export const CONRAD_LOS_ANGELES_CONCIERGE_HOOK = {
  fr: 'Tour signée Frank Gehry au cœur de The Grand LA : 305 chambres face au Walt Disney Concert Hall, San Laurel et Agua Viva par José Andrés, piscine rooftop et spa de 650 m².',
  en: 'Frank Gehry tower at the heart of The Grand LA: 305 rooms facing the Walt Disney Concert Hall, San Laurel and Agua Viva by José Andrés, rooftop pool and a 650 sq m spa.',
} as const;

export const CONRAD_LOS_ANGELES_FACTUAL_SUMMARY_FR =
  'Tour Frank Gehry de The Grand LA, Downtown : 305 chambres face au Walt Disney Concert Hall, San Laurel et Agua Viva par José Andrés, piscine rooftop et spa.';
export const CONRAD_LOS_ANGELES_FACTUAL_SUMMARY_EN =
  'Frank Gehry tower at The Grand LA, Downtown: 305 rooms facing the Walt Disney Concert Hall, San Laurel and Agua Viva by José Andrés, rooftop pool and spa.';

export const CONRAD_LOS_ANGELES_DESCRIPTION_FR =
  'En poussant les portes du Conrad Los Angeles, on entre dans la tour signée Frank Gehry de The Grand LA, ouverte en 2022 sur Grand Avenue. Le lobby du 10e étage accueille les arrivées au niveau des auditoriums du Music Center, face aux courbes d’acier du Walt Disney Concert Hall.\n\nTrois cent cinq chambres et suites déploient baies vitrées toute hauteur, portes coulissantes et canapés en L. La conciergerie anticipe sans envahir : table chez José Andrés, billet horodaté pour The Broad, transfert depuis LAX. C’est l’essence d’un séjour à Downtown : la culture sur Grand Avenue, San Laurel et Agua Viva en gastronomie, la piscine rooftop et le spa de 650 m² pour reprendre souffle au-dessus de la ville.';
export const CONRAD_LOS_ANGELES_DESCRIPTION_EN =
  'Through the doors of Conrad Los Angeles, you enter The Grand LA’s Frank Gehry tower, opened in 2022 on Grand Avenue. The 10th-floor lobby welcomes arrivals level with the Music Center auditoriums, facing the steel curves of the Walt Disney Concert Hall.\n\nThree hundred and five rooms and suites unfold floor-to-ceiling windows, sliding barn doors and L-shaped sofas. The concierge anticipates without intruding: a table at José Andrés, a timed ticket for The Broad, a transfer from LAX. That is the essence of a Downtown stay: culture along Grand Avenue, San Laurel and Agua Viva for dining, the rooftop pool and the 650 sq m spa to catch your breath above the city.';

export const CONRAD_LOS_ANGELES_META_DESC_FR =
  'Conrad Los Angeles, tour Frank Gehry de The Grand LA à Downtown : San Laurel et Agua Viva par José Andrés, piscine rooftop, spa et vue Walt Disney Concert Hall.';
export const CONRAD_LOS_ANGELES_META_DESC_EN =
  'Conrad Los Angeles, The Grand LA’s Frank Gehry tower in Downtown: San Laurel and Agua Viva by José Andrés, rooftop pool, spa and Walt Disney Concert Hall view.';

export const CONRAD_LOS_ANGELES_META_TITLE_FR =
  'Conrad Los Angeles — Tour Frank Gehry, Downtown | MyConciergeHotel';
export const CONRAD_LOS_ANGELES_META_TITLE_EN =
  'Conrad Los Angeles — Frank Gehry Tower, Downtown | MyConciergeHotel';

export const CONRAD_LOS_ANGELES_EMAIL_RESERVATIONS = 'conradlosangeles.info@conradhotels.com';

export const CONRAD_LOS_ANGELES_AFFILIATIONS = [
  {
    kind: 'brand',
    source: 'conrad',
    display_name: 'Conrad Hotels & Resorts (Hilton)',
    verified: true,
    facet_slug: 'conrad',
    source_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/',
    since_year: 2022,
  },
  {
    kind: 'ranking',
    source: 'forbes_travel_guide',
    display_name: 'Forbes Travel Guide — Recommended',
    verified: true,
    facet_slug: 'forbes-travel-guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/los-angeles-california/conrad-los-angeles',
  },
] as const;

export const CONRAD_LOS_ANGELES_HOTEL_DISPLAY_NAME = 'Conrad Los Angeles';

export const CONRAD_LOS_ANGELES_HIGHLIGHTS = [
  {
    label_fr: 'Tour signée Frank Gehry au cœur de The Grand LA, ouverte en 2022',
    label_en: 'Frank Gehry tower at the heart of The Grand LA, opened in 2022',
  },
  {
    label_fr: '305 chambres et suites, baies vitrées toute hauteur sur Downtown',
    label_en: '305 rooms and suites, floor-to-ceiling windows onto Downtown',
  },
  {
    label_fr: 'San Laurel & Agua Viva — la cuisine de José Andrés, 2× Time 100',
    label_en: 'San Laurel & Agua Viva — cuisine by José Andrés, 2× Time 100',
  },
  {
    label_fr: 'Face au Walt Disney Concert Hall, The Broad et le MOCA',
    label_en: 'Facing the Walt Disney Concert Hall, The Broad and MOCA',
  },
  {
    label_fr: 'Piscine extérieure en rooftop et Conrad Spa de 650 m²',
    label_en: 'Rooftop outdoor pool and a 650 sq m Conrad Spa',
  },
  {
    label_fr: 'Galerie d’art publique — Casper Brindle, Mimi Jung',
    label_en: 'Public art gallery — Casper Brindle, Mimi Jung',
  },
] as const;

export {
  CONRAD_LOS_ANGELES_CONCIERGE_QUESTIONS_KIT,
  type ConradLosAngelesConciergeQuestionKit,
} from './conrad-los-angeles-concierge-questions';

export const CONRAD_LOS_ANGELES_SPA_INFO = {
  name: 'Conrad Spa Los Angeles',
  treatment_rooms: 4,
  has_pool: true,
  pool_type: 'outdoor',
  surface_m2: 650,
  description_fr:
    'Le Conrad Spa déploie environ 650 m² (7 000 sq ft) de soins au-dessus de Downtown, complété par une salle de fitness et la piscine extérieure du rooftop. Rituels sur rendez-vous, dans le calme contemporain de la tour Gehry.',
  description_en:
    'Conrad Spa unfolds about 650 sq m (7,000 sq ft) of treatments above Downtown, complemented by a fitness room and the rooftop outdoor pool. Rituals by appointment, in the contemporary calm of the Gehry tower.',
  hours_fr: 'Soins sur rendez-vous — horaires communiqués par la conciergerie bien-être',
  hours_en: 'Treatments by appointment — hours shared by the wellness concierge',
  price_note_fr: 'Soins sur rendez-vous — tarifs selon le rituel choisi.',
  price_note_en: 'Treatments by appointment — rates depend on the ritual selected.',
  website: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/spa/',
  phone: CONRAD_LOS_ANGELES_PHONE_E164,
  tip_fr:
    'Mon conseil : réservez un soin en fin de matinée, puis enchaînez sur la piscine rooftop avant le déjeuner à Agua Viva.',
  tip_en:
    'My tip: book a late-morning treatment, then continue to the rooftop pool before lunch at Agua Viva.',
} as const;

export const CONRAD_LOS_ANGELES_MICE_INFO = {
  summary_fr:
    'Le Grand Park Ballroom (environ 440 m²) et ses salons modulables accueillent réunions, galas et cocktails au cœur de Downtown, avec catering signé San Laurel.',
  summary_en:
    'The Grand Park Ballroom (about 4,747 sq ft) and its modular salons host meetings, galas and cocktails in the heart of Downtown, with San Laurel catering.',
  contact_email: CONRAD_LOS_ANGELES_EMAIL_RESERVATIONS,
  total_capacity_seated: 300,
  spaces: [
    {
      key: 'grand-park-ballroom',
      name: 'Grand Park Ballroom',
      max_seated: 300,
      configurations: ['reception', 'theatre', 'dinner', 'cocktail'],
      has_natural_light: false,
      notes_fr:
        'Salle de bal principale d’environ 440 m² — réception jusqu’à 300, dîner assis modulable.',
      notes_en: 'Main ballroom of about 4,747 sq ft — reception up to 300, modular seated dinner.',
    },
    {
      key: 'event-lawn',
      name: 'Event Lawn',
      max_seated: 120,
      configurations: ['reception', 'cocktail', 'ceremony'],
      has_natural_light: true,
      notes_fr: 'Pelouse événementielle en plein air pour cocktails et cérémonies.',
      notes_en: 'Open-air event lawn for cocktails and ceremonies.',
    },
    {
      key: 'salons-modulables',
      name: 'Salons modulables',
      max_seated: 60,
      configurations: ['boardroom', 'meeting', 'private-dinner'],
      has_natural_light: true,
      notes_fr: 'Salons de réunion pour séminaires et dîners privés.',
      notes_en: 'Meeting salons for seminars and private dinners.',
    },
  ],
  event_types: ['wedding', 'corporate-meeting', 'cocktail', 'private-dinner', 'product-launch'],
} as const;

export const CONRAD_LOS_ANGELES_INSTAGRAM = {
  handle: 'conradlosangeles',
  profile_url: 'https://www.instagram.com/conradlosangeles/',
  posts: [
    {
      permalink: 'https://www.instagram.com/conradlosangeles/',
      image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-5`,
      caption_fr: 'Rooftop au crépuscule sur Downtown Los Angeles — la signature du Conrad.',
      caption_en: 'Rooftop at dusk over Downtown Los Angeles — the Conrad signature.',
    },
    {
      permalink: 'https://www.instagram.com/conradlosangeles/',
      image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-2`,
      caption_fr: 'Baie vitrée toute hauteur sur le Walt Disney Concert Hall signé Frank Gehry.',
      caption_en: 'Floor-to-ceiling window onto Frank Gehry’s Walt Disney Concert Hall.',
    },
    {
      permalink: 'https://www.instagram.com/conradlosangeles/',
      image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-9`,
      caption_fr: 'Planches à partager d’Agua Viva, le rooftop façon beach club de José Andrés.',
      caption_en: 'Sharing boards at Agua Viva, José Andrés’s beach-club-style rooftop.',
    },
    {
      permalink: 'https://www.instagram.com/conradlosangeles/',
      image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-1`,
      caption_fr: 'Piscine du pool deck, transats face aux tours de Bunker Hill.',
      caption_en: 'Pool deck, loungers facing the Bunker Hill towers.',
    },
  ],
} as const;

export const CONRAD_LOS_ANGELES_FEATURED_REVIEWS = [
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/los-angeles-california/conrad-los-angeles',
    quote_fr:
      'Deux restaurants signés José Andrés, des lounges extérieurs avec vue, une piscine rooftop, un spa de 7 000 sq ft et une galerie d’art : le Conrad tient du resort au cœur de Downtown.',
    quote_en:
      'Two José Andrés restaurants, outdoor lounges with views, a rooftop pool, a 7,000-square-foot spa and an art gallery: the Conrad feels like a resort in the heart of Downtown.',
  },
  {
    source: 'Presse spécialisée',
    author: 'Presse spécialisée',
    quote_fr:
      'Ouvert en 2022, le Conrad Los Angeles occupe la tour Frank Gehry de The Grand LA, face au Walt Disney Concert Hall — l’une des vues les plus nettes de Downtown.',
    quote_en:
      'Opened in 2022, Conrad Los Angeles occupies The Grand LA’s Frank Gehry tower, facing the Walt Disney Concert Hall — one of the clearest views in Downtown.',
  },
] as const;

export const CONRAD_LOS_ANGELES_EXTERNAL_SOURCES = [
  {
    field: 'official_url',
    value: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/',
    source: 'official_site',
    source_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/',
    confidence: 'high',
    collected_at: '2026-06-16T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 2022,
    source: 'official_site',
    source_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/',
    confidence: 'high',
    collected_at: '2026-06-16T00:00:00.000Z',
  },
  {
    field: 'forbes_travel_guide',
    value: 'https://www.forbestravelguide.com/hotels/los-angeles-california/conrad-los-angeles',
    source: 'forbes_travel_guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/los-angeles-california/conrad-los-angeles',
    confidence: 'high',
    collected_at: '2026-06-16T00:00:00.000Z',
  },
] as const;

export const CONRAD_LOS_ANGELES_SIGNATURE_EXPERIENCES = [
  {
    key: 'diner-san-laurel-concert-hall',
    image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-6`,
    title_fr: 'Dîner San Laurel face au Concert Hall',
    title_en: 'San Laurel dinner facing the Concert Hall',
    description_fr:
      'Dîner signature de José Andrés au 10e étage, salle ouverte sur le Walt Disney Concert Hall — la conciergerie cale le créneau sur un spectacle d’en face.',
    description_en:
      'José Andrés signature dinner on the 10th floor, dining room open to the Walt Disney Concert Hall — the concierge times the slot with a show across the street.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://www.sanlaurel.com/',
  },
  {
    key: 'cocktail-beaudry-room',
    image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-8`,
    title_fr: 'Cocktail d’avant-concert à The Beaudry Room',
    title_en: 'Pre-concert cocktail at The Beaudry Room',
    description_fr:
      'Le Foggy Hill, Negroni de gastronomie moléculaire servi en bécher, ouvre la soirée avant le LA Phil — à deux pas du lobby du 10e étage.',
    description_en:
      'The Foggy Hill, a molecular-gastronomy Negroni served from a beaker, opens the evening before the LA Phil — steps from the 10th-floor lobby.',
    booking_required: true,
  },
  {
    key: 'rooftop-agua-viva',
    image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-9`,
    title_fr: 'Coucher de soleil au rooftop Agua Viva',
    title_en: 'Sunset at the Agua Viva rooftop',
    description_fr:
      'Fruits de mer et tapas en plein air sur le rooftop façon beach club, face au coucher de soleil sur Bunker Hill.',
    description_en:
      'Seafood and tapas alfresco on the beach-club-style rooftop, facing the sunset over Bunker Hill.',
    booking_required: true,
    website: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/dining/',
  },
  {
    key: 'parcours-art-grand-avenue',
    image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-8`,
    title_fr: 'Parcours d’art sur Grand Avenue',
    title_en: 'Grand Avenue art walk',
    description_fr:
      'The Broad, le MOCA et la galerie publique de l’hôtel (Casper Brindle, Mimi Jung) composent une matinée d’art, organisée par la conciergerie avec billets horodatés.',
    description_en:
      'The Broad, MOCA and the hotel’s public gallery (Casper Brindle, Mimi Jung) form an art morning, arranged by the concierge with timed tickets.',
    booking_required: false,
  },
  {
    key: 'detente-rooftop-spa',
    image_public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/places-3`,
    title_fr: 'Détente piscine rooftop & Conrad Spa',
    title_en: 'Rooftop pool & Conrad Spa relaxation',
    description_fr:
      'Soin au Conrad Spa puis quelques longueurs à la piscine extérieure du rooftop, cabanas face à Downtown — la pause bien-être au-dessus de la ville.',
    description_en:
      'A Conrad Spa treatment then a few laps in the rooftop outdoor pool, cabanas facing Downtown — the wellness pause above the city.',
    booking_required: true,
    website: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/spa/',
  },
] as const;

export function resolveConradLosAngelesSignatureExperiences(): unknown[] {
  return [...CONRAD_LOS_ANGELES_SIGNATURE_EXPERIENCES];
}

const CONRAD_LOS_ANGELES_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire — The Grand LA et la signature Gehry (2022)',
    title_en: 'History — The Grand LA and the Gehry signature (2022)',
    body_fr:
      'Le Conrad Los Angeles ouvre en 2022 au sein de The Grand LA, l’ensemble signé Frank Gehry sur Grand Avenue, en miroir du Walt Disney Concert Hall que l’architecte avait livré vingt ans plus tôt.\n\nLa tour réunit hôtel, résidences, commerces et places publiques au cœur du quartier culturel de Downtown. Première adresse Conrad de Los Angeles, elle inscrit la marque de luxe de Hilton dans le corridor de Grand Avenue, entre The Broad, le MOCA et le Music Center.\n\nLe parti pris architectural — façades d’acier ondulé, lobby perché au 10e étage — fait dialoguer l’hôtel avec la salle de concert qui lui fait face.',
    body_en:
      'Conrad Los Angeles opened in 2022 within The Grand LA, Frank Gehry’s development on Grand Avenue, mirroring the Walt Disney Concert Hall the architect had delivered twenty years earlier.\n\nThe tower gathers hotel, residences, retail and public plazas at the heart of Downtown’s cultural district. The first Conrad address in Los Angeles, it sets Hilton’s luxury brand into the Grand Avenue corridor, between The Broad, MOCA and the Music Center.\n\nThe architectural stance — undulating steel facades, a lobby perched on the 10th floor — places the hotel in dialogue with the concert hall it faces.',
  },
  {
    anchor: 'architecture',
    title_fr: 'Architecture — acier ondulé & lobby du 10e étage',
    title_en: 'Architecture — undulating steel & the 10th-floor lobby',
    body_fr:
      'Les arrivées se font au 10e étage, au niveau des auditoriums du Music Center : le lobby ouvre sur des salons, une galerie d’art publique et les restaurants de l’hôtel.\n\nLa galerie met en scène des artistes locaux — les cinq Light Glyphs de Casper Brindle, qui changent de couleur au fil de la journée, et la sculpture tissée jaune néon de Mimi Jung, entre l’accueil et les ascenseurs.\n\nLes 305 chambres réparties sur 28 étages jouent des baies vitrées toute hauteur, portes coulissantes façon grange et canapés en L qui maximisent chaque volume.',
    body_en:
      'Arrivals happen on the 10th floor, level with the Music Center auditoriums: the lobby opens onto lounges, a public art gallery and the hotel restaurants.\n\nThe gallery stages local artists — Casper Brindle’s five Light Glyphs, which shift colour through the day, and Mimi Jung’s neon-yellow woven sculpture, between check-in and the elevators.\n\nThe 305 rooms across 28 floors play with floor-to-ceiling windows, barn-style sliding doors and L-shaped sofas that maximise each volume.',
  },
  {
    anchor: 'experience',
    title_fr: 'L’expérience — un resort au cœur de Downtown',
    title_en: 'The experience — a resort in the heart of Downtown',
    body_fr:
      'Deux restaurants de José Andrés, deux bars à cocktails, une piscine extérieure en rooftop, un spa de 650 m², une salle de fitness et une galerie d’art donnent au Conrad des allures de resort planté dans la jungle urbaine de Los Angeles.\n\nLa conciergerie coordonne billets de concert, transferts depuis LAX ou Burbank, house car pour les courts trajets et réservations chez San Laurel. Le room-service vingt-quatre heures sur vingt-quatre et le voiturier prolongent l’expérience.\n\nOn vient ici pour habiter le quartier culturel de Downtown sans jamais traverser la ville — la culture, la table et le calme dans un même immeuble.',
    body_en:
      'Two José Andrés restaurants, two cocktail bars, a rooftop outdoor pool, a 650 sq m spa, a fitness room and an art gallery give the Conrad the feel of a resort planted in the Los Angeles urban jungle.\n\nThe concierge coordinates concert tickets, transfers from LAX or Burbank, a house car for short trips and San Laurel reservations. Twenty-four-hour room service and valet extend the experience.\n\nYou come here to inhabit Downtown’s cultural district without ever crossing the city — culture, dining and calm in a single building.',
  },
  {
    anchor: 'chambres-suites',
    title_fr: 'Chambres & suites — du King à la Presidential Suite',
    title_en: 'Rooms & suites — from King to Presidential Suite',
    body_fr:
      'Trois cent cinq chambres et suites, dont les Premium View King face au Walt Disney Concert Hall, les Studio Loft, les suites d’angle et les Presidential Suites à terrasse panoramique.\n\nLes catégories orientées ouest entre le 12e et le 15e étage offrent la vue la plus nette sur la salle de Gehry — le critère que je vérifie en premier pour une première venue. Les suites déploient salon, salle à manger et baignoire profonde.\n\nBaies toute hauteur, double vitrage qui tient le calme malgré Downtown, Wi-Fi inclus et grands écrans plats : la conciergerie note l’orientation souhaitée à la réservation.',
    body_en:
      'Three hundred and five rooms and suites, including Premium View Kings facing the Walt Disney Concert Hall, Studio Lofts, corner suites and Presidential Suites with panoramic terraces.\n\nWest-facing categories between the 12th and 15th floor offer the clearest view of Gehry’s hall — the criterion I check first for a first stay. Suites unfold a living room, dining area and deep soaking tub.\n\nFloor-to-ceiling windows, double glazing that holds the calm despite Downtown, included Wi-Fi and large flat-screens: the concierge notes the preferred aspect at booking.',
  },
] as const;

export const CONRAD_LOS_ANGELES_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Los Angeles International Airport (LAX)',
    station_en: 'Los Angeles International Airport (LAX)',
    distance_meters: 30_000,
    walk_minutes: 35,
    notes_fr:
      'Hub international principal ; transfert privé via la conciergerie (40–60 min selon trafic).',
    notes_en:
      'Main international hub; private transfer through the concierge (40–60 min depending on traffic).',
  },
  {
    mode: 'airport',
    station: 'Hollywood Burbank Airport (BUR)',
    station_en: 'Hollywood Burbank Airport (BUR)',
    distance_meters: 20_000,
    walk_minutes: 25,
    notes_fr: 'Souvent plus rapide pour les vols intérieurs (20–30 min selon trafic).',
    notes_en: 'Often faster for domestic flights (20–30 min depending on traffic).',
  },
  {
    mode: 'metro',
    station: 'Civic Center / Grand Park (lignes B & D)',
    station_en: 'Civic Center / Grand Park (B & D lines)',
    distance_meters: 350,
    walk_minutes: 5,
    notes_fr: 'Métro vers Hollywood, Koreatown et Union Station — cinq minutes à pied.',
    notes_en: 'Metro toward Hollywood, Koreatown and Union Station — five minutes on foot.',
  },
  {
    mode: 'train',
    station: 'Union Station',
    station_en: 'Union Station',
    distance_meters: 1700,
    walk_minutes: 22,
    notes_fr: 'Gare historique : Amtrak, Metrolink et navette FlyAway vers LAX.',
    notes_en: 'Historic station: Amtrak, Metrolink and the FlyAway shuttle to LAX.',
  },
] as const;

function resolveConradLosAngelesLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    CONRAD_LOS_ANGELES_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchConradLosAngelesLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: CONRAD_LOS_ANGELES_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: CONRAD_LOS_ANGELES_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchConradLosAngelesLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of CONRAD_LOS_ANGELES_LONG_DESCRIPTION_SECTIONS) {
    const idx = base.findIndex(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        (s as { anchor?: unknown }).anchor === section.anchor,
    );
    if (idx >= 0) {
      base[idx] = { ...(base[idx] as Record<string, unknown>), ...section };
    } else {
      base.push(section);
    }
  }
  return base;
}

export function sanitizeConradLosAngelesJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

export function patchConradLosAngelesAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchConradLosAngelesSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...CONRAD_LOS_ANGELES_SPA_INFO,
  };
}

export function patchConradLosAngelesPolicies(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    check_in: {
      time: '15:00',
      notes_fr:
        'Arrivée dès 15 h ; early check-in selon disponibilité sur demande auprès de la conciergerie.',
      notes_en:
        'Arrival from 3 pm; early check-in subject to availability on request through the concierge.',
    },
    check_out: {
      time: '12:00',
      notes_fr:
        'Départ jusqu’à 12 h ; late check-out selon disponibilité — la conciergerie transmet la demande à la réception.',
      notes_en:
        'Departure until noon; late check-out subject to availability — the concierge desk forwards the request to reception.',
    },
    cancellation: {
      notes_fr:
        'Conditions selon le tarif réservé. La conciergerie communique la politique exacte avant confirmation.',
      notes_en:
        'Terms depend on the rate booked. The concierge desk shares the exact policy before confirmation.',
    },
    pets: {
      allowed: true,
      notes_fr:
        'Hôtel pet-friendly — frais et conditions précisés par la réception. Signalez l’animal avant l’arrivée.',
      notes_en:
        'Pet-friendly hotel — fees and conditions confirmed by reception. Notify about the pet before arrival.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

export interface ConradLosAngelesGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

/**
 * Build the golden field map for Conrad Los Angeles.
 *
 * NOTE: `booking_mode` is intentionally NOT returned — the row keeps its
 * `travelport` pilot booking mode. The kit golden overlays editorial +
 * photo content only.
 */
export function buildConradLosAngelesGoldenFields(
  current: ConradLosAngelesGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchConradLosAngelesSpa(current.spa_info);
  return {
    highlights: CONRAD_LOS_ANGELES_HIGHLIGHTS,
    concierge_questions: CONRAD_LOS_ANGELES_CONCIERGE_QUESTIONS_KIT,
    opened_at: '2022-07-01',
    number_of_rooms: 305,
    number_of_suites: 28,
    transports: CONRAD_LOS_ANGELES_TRANSPORTS,
    restaurant_info: CONRAD_LOS_ANGELES_RESTAURANT_INFO,
    points_of_interest: CONRAD_LOS_ANGELES_POINTS_OF_INTEREST,
    concierge_advice: CONRAD_LOS_ANGELES_CONCIERGE_ADVICE,
    concierge_pick: CONRAD_LOS_ANGELES_CONCIERGE_PICK,
    concierge_hook: CONRAD_LOS_ANGELES_CONCIERGE_HOOK,
    instagram: CONRAD_LOS_ANGELES_INSTAGRAM,
    policies: patchConradLosAngelesPolicies(current.policies),
    awards: patchConradLosAngelesAwards(current.awards),
    amenities: current.amenities,
    spa_info: spaInfo,
    description_fr: CONRAD_LOS_ANGELES_DESCRIPTION_FR,
    description_en: CONRAD_LOS_ANGELES_DESCRIPTION_EN,
    long_description_sections: sanitizeConradLosAngelesJsonb(
      resolveConradLosAngelesLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeConradLosAngelesJsonb(
      resolveConradLosAngelesSignatureExperiences(),
    ),
    featured_reviews: CONRAD_LOS_ANGELES_FEATURED_REVIEWS,
    factual_summary_fr: CONRAD_LOS_ANGELES_FACTUAL_SUMMARY_FR,
    factual_summary_en: CONRAD_LOS_ANGELES_FACTUAL_SUMMARY_EN,
    meta_desc_fr: CONRAD_LOS_ANGELES_META_DESC_FR,
    meta_desc_en: CONRAD_LOS_ANGELES_META_DESC_EN,
    meta_title_fr: CONRAD_LOS_ANGELES_META_TITLE_FR,
    meta_title_en: CONRAD_LOS_ANGELES_META_TITLE_EN,
    hero_image: CONRAD_LOS_ANGELES_HERO_IMAGE,
    gallery_images: CONRAD_LOS_ANGELES_GALLERY_IMAGES,
    external_sources: CONRAD_LOS_ANGELES_EXTERNAL_SOURCES,
    official_url: 'https://www.hilton.com/en/hotels/laxglci-conrad-los-angeles/',
    phone_e164: CONRAD_LOS_ANGELES_PHONE_E164,
    address: CONRAD_LOS_ANGELES_ADDRESS,
    postal_code: CONRAD_LOS_ANGELES_POSTAL_CODE,
    latitude: CONRAD_LOS_ANGELES_LATITUDE,
    longitude: CONRAD_LOS_ANGELES_LONGITUDE,
    email_reservations: CONRAD_LOS_ANGELES_EMAIL_RESERVATIONS,
    mice_info: CONRAD_LOS_ANGELES_MICE_INFO,
    affiliations: CONRAD_LOS_ANGELES_AFFILIATIONS,
    faq_content: buildKitWaveFaqPromote('conrad-los-angeles'),
    faq_content_kit: buildKitWaveFaqKit('conrad-los-angeles'),
  };
}
