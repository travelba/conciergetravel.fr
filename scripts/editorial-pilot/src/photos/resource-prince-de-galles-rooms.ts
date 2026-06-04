/**
 * One-shot room seeding for `prince-de-galles-paris` (Travelport pilot).
 *
 * Why this exists (2026-06-04):
 *   The fiche is in `booking_mode = 'travelport'` with ZERO editorial rooms,
 *   so the rooms section fell back to the bare Travelport live list (label +
 *   price, no photo, no editorial). This script gives the hotel a real
 *   `hotel_rooms` set — per-room official photos + Concierge-voice editorial
 *   + concierge_advice — so the fiche renders OTA-grade room cards and the
 *   Travelport live "from" price overlays onto them by name match.
 *
 * Legality: every photo is the hotel's OWN official Marriott property DAM
 *   (`cache.marriott.com/.../PARLC/...`, the path-specific Prince de Galles
 *   property code — not a multi-property corporate root). Source = `press`
 *   (official media kit) per `photo-quality.mdc`; licence = all-rights-reserved
 *   with credit (provenance only, no licence link — we are not the licensor).
 *
 * Editorial: written in the Concierge voice, strictly factual — only facts
 *   corroborated across the official Marriott room pages, Forbes Travel Guide
 *   and the property's published descriptions (Art Deco design, marble +
 *   mosaic bathrooms, Lalique amenities, suite surfaces where the official
 *   site states them). No invented sizes/numbers; size left null when the
 *   official source does not state it.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-prince-de-galles-rooms.ts --dry-run   # plan only
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-prince-de-galles-rooms.ts             # upload + upsert
 *
 * Skill: photo-pipeline, concierge-voice-pipeline, content-modeling
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'prince-de-galles-paris';
const DAM_PREFIX = 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/';
/** Marriott renditions accept a parametric output width; cap at 1920 (Cloudinary then c_limit 2400). */
const DAM_SUFFIX = '.jpg?output-quality=85&interpolation=progressive-bilinear&downsize=1920px:*';
const CREDIT = 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)';

type Category = 'room' | 'suite' | 'detail' | 'view';
type TipFor = 'room' | 'dining' | 'timing' | 'access' | 'service' | 'wellness';

interface RoomImage {
  /** Marriott rendition filename (without prefix/suffix). */
  readonly file: string;
  readonly category: Category;
  readonly altFr: string;
  readonly altEn: string;
}

interface ConciergeAdvice {
  readonly title: string;
  /** 50–110 words (validated by RoomConciergeAdviceSchema). */
  readonly body: string;
  readonly tipFor: TipFor;
}

interface RoomSeed {
  readonly roomCode: string;
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly descFr: string;
  readonly descEn: string;
  readonly longFr: string;
  readonly longEn: string;
  readonly maxOccupancy: number | null;
  readonly bedType: string | null;
  readonly sizeSqm: number | null;
  readonly amenities: ReadonlyArray<{ readonly fr: string; readonly en: string }>;
  readonly isSignature: boolean;
  readonly displayOrder: number;
  /** `room-<source>` short id → Cloudinary public_id `cct/hotels/<slug>/room-<source>-<n>`. */
  readonly source: string;
  readonly images: readonly RoomImage[];
  readonly conciergeFr: ConciergeAdvice;
  readonly conciergeEn: ConciergeAdvice;
}

const ROOMS: readonly RoomSeed[] = [
  {
    roomCode: 'ART-DECO-DELUXE',
    slug: 'chambre-art-deco-deluxe',
    nameFr: 'Chambre Art Déco Deluxe',
    nameEn: 'Art Deco Deluxe Room',
    descFr:
      'Une chambre d’environ 26 m² au style Art déco assumé : motifs géométriques, tête de lit miroitée et salle de bain en marbre à mosaïque.',
    descEn:
      'A roughly 26 m² room with a confident Art Deco signature: geometric patterns, a mirrored headboard and a marble mosaic bathroom.',
    longFr:
      'La Chambre Art Déco Deluxe incarne l’ADN du Prince de Galles, à deux pas des Champs-Élysées et de l’avenue Montaigne. Les lignes géométriques, les photographies en noir et blanc et la tête de lit miroitée signent le décor des 116 chambres de la maison.\n\nLa salle de bain en marbre marie douche et baignoire séparées, mosaïque d’inspiration Art déco et produits Lalique. Eau minérale et choix de presse quotidienne complètent l’accueil.',
    longEn:
      'The Art Deco Deluxe Room captures the DNA of Prince de Galles, steps from the Champs-Élysées and Avenue Montaigne. Geometric lines, black-and-white photography and a mirrored headboard define the décor across the hotel’s 116 rooms.\n\nThe marble bathroom pairs a separate shower and bath, Art Deco-inspired mosaic and Lalique toiletries. Bottled mineral water and a daily choice of newspapers complete the welcome.',
    maxOccupancy: 2,
    bedType: 'King size',
    sizeSqm: 26,
    amenities: [
      { fr: 'Décor Art déco', en: 'Art Deco décor' },
      { fr: 'Salle de bain en marbre', en: 'Marble bathroom' },
      { fr: 'Douche et baignoire séparées', en: 'Separate shower and bath' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Peignoirs et chaussons', en: 'Robes and slippers' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: false,
    displayOrder: 10,
    source: 'art-deco-deluxe',
    images: [
      {
        file: 'parlc-art-deco-1138-hor-wide',
        category: 'room',
        altFr: 'Chambre Art Déco Deluxe du Prince de Galles Paris, tête de lit miroitée',
        altEn: 'Art Deco Deluxe Room at Prince de Galles Paris with a mirrored headboard',
      },
      {
        file: 'parlc-art-deco-0642-hor-wide',
        category: 'detail',
        altFr: 'Salle de bain en marbre et mosaïque Art déco, Prince de Galles Paris',
        altEn: 'Marble and Art Deco mosaic bathroom, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'Pour une première fois au Prince de Galles, cette Art Déco Deluxe est mon entrée préférée dans la maison. Demandez un étage élevé côté cour : vous gagnez le calme rare d’un palace parisien sans renoncer à la lumière. Le rituel que je recommande : un bain le soir dans le marbre à mosaïque, peignoir et produits Lalique, avant de rejoindre l’avenue Montaigne à pied. Prévenez-moi de votre heure d’arrivée, je fais préparer la chambre en avance.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'For a first stay at Prince de Galles, this Art Deco Deluxe is my favourite way into the house. Ask for a high floor on the courtyard side: you gain the rare quiet of a Parisian palace without losing the light. The ritual I recommend is an evening bath in the mosaic marble, robe and Lalique amenities, before walking to Avenue Montaigne. Let me know your arrival time and I will have the room readied early.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'ART-DECO-BALCONY',
    slug: 'chambre-art-deco-deluxe-balcon',
    nameFr: 'Chambre Art Déco Deluxe Balcon',
    nameEn: 'Art Deco Deluxe Balcony Room',
    descFr:
      'La même élégance Art déco, prolongée d’un balcon privé ouvrant sur la cour intérieure ou l’avenue George V.',
    descEn:
      'The same Art Deco elegance, extended by a private balcony opening onto the courtyard or Avenue George V.',
    longFr:
      'Vingt-six chambres et suites du Prince de Galles disposent d’un balcon ou d’une terrasse sur la ville ou sur le Patio, la cour intérieure emblématique de la maison. Cette catégorie en fait partie : un espace extérieur privatif prolonge la chambre Art déco.\n\nLe décor reste fidèle à la signature de l’hôtel — marbre, mosaïque, produits Lalique — avec, en prime, l’air de Paris au réveil.',
    longEn:
      'Twenty-six rooms and suites at Prince de Galles offer a balcony or terrace over the city or Le Patio, the hotel’s emblematic inner courtyard. This category is one of them: a private outdoor space extends the Art Deco room.\n\nThe décor stays faithful to the hotel’s signature — marble, mosaic, Lalique amenities — with, as a bonus, the Paris air at wake-up.',
    maxOccupancy: 2,
    bedType: 'King size',
    sizeSqm: 26,
    amenities: [
      { fr: 'Balcon privatif', en: 'Private balcony' },
      { fr: 'Vue cour ou avenue', en: 'Courtyard or avenue view' },
      { fr: 'Décor Art déco', en: 'Art Deco décor' },
      { fr: 'Salle de bain en marbre', en: 'Marble bathroom' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: false,
    displayOrder: 20,
    source: 'art-deco-balcon',
    images: [
      {
        file: 'parlc-courtyardview-guestroom-0592-hor-feat',
        category: 'room',
        altFr: 'Chambre Art Déco Deluxe avec balcon sur cour, Prince de Galles Paris',
        altEn: 'Art Deco Deluxe Balcony courtyard-view room, Prince de Galles Paris',
      },
      {
        file: 'parlc-art-deco-4808-hor-wide',
        category: 'view',
        altFr: 'Balcon privatif d’une chambre Art déco, Prince de Galles Paris',
        altEn: 'Private balcony of an Art Deco room, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'Le balcon change tout. Côté Patio, vous prenez le petit-déjeuner au calme, à l’abri de l’agitation de l’avenue George V ; côté avenue, vous attrapez l’animation parisienne au réveil. Les balcons sont en nombre limité dans la maison : réservez tôt et dites-moi votre préférence, cour ou avenue. Au printemps, je fais monter un café et la presse sur le balcon pour le premier matin — un geste simple qui rend la chambre tout de suite plus parisienne.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'The balcony changes everything. On the Patio side you take breakfast in quiet, sheltered from Avenue George V; on the avenue side you catch Parisian life at wake-up. Balconies are limited in the house: book early and tell me your preference, courtyard or avenue. In spring I have coffee and the newspapers brought to the balcony for the first morning — a simple gesture that makes the room feel instantly more Parisian.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'MOSAIC-SUITE',
    slug: 'suite-mosaique',
    nameFr: 'Suite Mosaïque',
    nameEn: 'Mosaic Suite',
    descFr:
      'Une suite de 48 m² avec salon séparé et salle de bain habillée d’une mosaïque colorée, fil conducteur du décor.',
    descEn:
      'A 48 m² suite with a separate living room and a bathroom dressed in a colourful mosaic, the décor’s guiding thread.',
    longFr:
      'La Suite Mosaïque déploie 48 m² entre une chambre et un salon distinct, idéale pour un séjour à deux qui veut de l’espace. Son nom vient de la salle de bain, ornée d’une mosaïque de céramique aux couleurs inspirées de l’époque Art déco.\n\nComme partout dans la maison, l’accueil comprend produits Lalique, peignoirs et eau minérale ; la décoration mêle motifs géométriques et photographies en noir et blanc.',
    longEn:
      'The Mosaic Suite unfolds across 48 m² between a bedroom and a separate living room, ideal for a couple who wants space. Its name comes from the bathroom, dressed with ceramic mosaic in colours inspired by the Art Deco era.\n\nAs everywhere in the house, the welcome includes Lalique toiletries, robes and bottled water; the décor blends geometric patterns and black-and-white photography.',
    maxOccupancy: 3,
    bedType: 'King size',
    sizeSqm: 48,
    amenities: [
      { fr: 'Salon séparé', en: 'Separate living room' },
      { fr: 'Salle de bain à mosaïque', en: 'Mosaic bathroom' },
      { fr: 'Décor Art déco', en: 'Art Deco décor' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Peignoirs et chaussons', en: 'Robes and slippers' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: false,
    displayOrder: 30,
    source: 'mosaique',
    images: [
      {
        file: 'parlc-mosaic-suite-4799-hor-wide',
        category: 'suite',
        altFr: 'Chambre de la Suite Mosaïque, Prince de Galles Paris',
        altEn: 'Bedroom of the Mosaic Suite, Prince de Galles Paris',
      },
      {
        file: 'parlc-mosaic-suite-4802-hor-wide',
        category: 'suite',
        altFr: 'Salon séparé de la Suite Mosaïque, Prince de Galles Paris',
        altEn: 'Separate living room of the Mosaic Suite, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'C’est la suite que je propose aux voyageurs qui restent plusieurs nuits : le salon séparé fait toute la différence pour travailler, recevoir un verre ou simplement respirer. La salle de bain à mosaïque est l’une des plus photogéniques de la maison. Mon conseil : réservez une fin de journée libre pour profiter du salon, et laissez-moi organiser un dîner léger en chambre. Si vous fêtez une occasion, prévenez-moi : j’aime soigner l’arrivée.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'This is the suite I suggest for guests staying several nights: the separate living room makes all the difference to work, host a drink or simply breathe. The mosaic bathroom is one of the most photogenic in the house. My advice: keep one late afternoon free to enjoy the lounge, and let me arrange a light in-room dinner. If you are marking an occasion, tell me — I like to take care of the arrival.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'MACASSAR-SUITE',
    slug: 'suite-macassar',
    nameFr: 'Suite Macassar',
    nameEn: 'Macassar Suite',
    descFr:
      'Une suite chaleureuse en bois de Macassar, chambre et salon distincts, certaines avec terrasse sur Paris.',
    descEn:
      'A warm Macassar-wood suite with a separate bedroom and living room, some with a terrace over Paris.',
    longFr:
      'La Suite Macassar tire son nom de l’ébène de Macassar qui réchauffe son décor Art déco. Elle s’organise autour d’une chambre et d’un salon séparés ; certaines configurations s’ouvrent sur une terrasse privée.\n\nLa salle de bain en marbre et la signature Lalique prolongent l’élégance maison. Un cocon idéal pour un séjour parisien sans compromis sur l’espace.',
    longEn:
      'The Macassar Suite takes its name from the Macassar ebony that warms its Art Deco décor. It is built around a separate bedroom and living room; some layouts open onto a private terrace.\n\nThe marble bathroom and the Lalique signature extend the house elegance. An ideal cocoon for a Parisian stay with no compromise on space.',
    maxOccupancy: 3,
    bedType: 'King size',
    sizeSqm: null,
    amenities: [
      { fr: 'Chambre et salon séparés', en: 'Separate bedroom and living room' },
      { fr: 'Bois de Macassar', en: 'Macassar wood' },
      { fr: 'Terrasse (selon configuration)', en: 'Terrace (select layouts)' },
      { fr: 'Salle de bain en marbre', en: 'Marble bathroom' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: false,
    displayOrder: 40,
    source: 'macassar',
    images: [
      {
        file: 'parlc-makassar-suite-6028-hor-wide',
        category: 'suite',
        altFr: 'Chambre de la Suite Macassar en ébène, Prince de Galles Paris',
        altEn: 'Bedroom of the Macassar ebony Suite, Prince de Galles Paris',
      },
      {
        file: 'parlc-makassar-suite-6030-hor-wide',
        category: 'suite',
        altFr: 'Salon de la Suite Macassar, Prince de Galles Paris',
        altEn: 'Living room of the Macassar Suite, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'La Macassar est ma suite « cocon » : le bois sombre et le salon séparé créent une atmosphère feutrée, parfaite l’hiver. Si vous tenez à la terrasse, dites-le moi à la réservation, car toutes les Macassar n’en disposent pas. J’aime y installer les voyageurs qui veulent vivre l’hôtel plutôt que seulement y dormir. Pour une soirée tranquille, je peux réserver une table au restaurant de la maison, puis vous laisser le salon pour le digestif.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'The Macassar is my “cocoon” suite: the dark wood and separate living room create a hushed atmosphere, perfect in winter. If the terrace matters to you, tell me at booking, because not every Macassar has one. I like to place here the guests who want to live the hotel rather than only sleep in it. For a quiet evening I can book a table at the house restaurant, then leave you the lounge for a nightcap.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'SAPHIR-SUITE',
    slug: 'suite-saphir',
    nameFr: 'Suite Saphir',
    nameEn: 'Saphir Suite',
    descFr:
      'Une suite raffinée — chambre, salon et terrasse — aux accents bleu saphir, sur les toits parisiens.',
    descEn:
      'A refined suite — bedroom, living room and terrace — with sapphire-blue accents, over the Paris rooftops.',
    longFr:
      'La Suite Saphir joue la carte d’un bleu profond qui réchauffe l’Art déco de la maison. Elle réunit une chambre, un salon et une terrasse ouverte sur la ville, pour un séjour qui prend de la hauteur.\n\nLa salle de bain en marbre, les peignoirs et les produits Lalique signent l’expérience Prince de Galles. Idéale pour qui cherche l’espace d’une suite avec un extérieur privatif.',
    longEn:
      'The Saphir Suite plays a deep blue that warms the house’s Art Deco. It brings together a bedroom, a living room and a terrace open to the city, for a stay that rises above the street.\n\nThe marble bathroom, robes and Lalique toiletries sign the Prince de Galles experience. Ideal for those seeking the space of a suite with a private outdoor area.',
    maxOccupancy: 3,
    bedType: 'King size',
    sizeSqm: null,
    amenities: [
      { fr: 'Chambre, salon et terrasse', en: 'Bedroom, living room and terrace' },
      { fr: 'Terrasse sur la ville', en: 'Terrace over the city' },
      { fr: 'Salle de bain en marbre', en: 'Marble bathroom' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Peignoirs et chaussons', en: 'Robes and slippers' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: false,
    displayOrder: 50,
    source: 'saphir',
    images: [
      {
        file: 'parlc-prince-9106-hor-clsc',
        category: 'suite',
        altFr: 'Chambre de la Suite Saphir aux accents bleus, Prince de Galles Paris',
        altEn: 'Bedroom of the Saphir Suite with blue accents, Prince de Galles Paris',
      },
      {
        file: 'parlc-suite-living-8696-hor-wide',
        category: 'suite',
        altFr: 'Salon de la Suite Saphir, Prince de Galles Paris',
        altEn: 'Living room of the Saphir Suite, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'J’envoie la Saphir aux voyageurs qui veulent une terrasse sans monter jusqu’aux suites signatures. Le bleu profond et la vue sur les toits en font une suite très douce en fin de journée. Mon moment préféré : un apéritif sur la terrasse à l’heure dorée. Réservez tôt, la maison ne compte qu’un nombre limité de suites à terrasse. Dites-moi vos horaires de vol, je cale l’arrivée et le départ pour profiter au maximum de l’extérieur.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'I send the Saphir to guests who want a terrace without going up to the signature suites. The deep blue and the rooftop view make it a very gentle suite at day’s end. My favourite moment is an aperitif on the terrace at golden hour. Book early, as the house has only a limited number of terrace suites. Tell me your flight times and I will set arrival and departure to make the most of the outdoor space.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'OR-SUITE',
    slug: 'suite-or',
    nameFr: 'Suite Or',
    nameEn: 'Suite Or',
    descFr:
      'Suite signature de 97 m² aux touches dorées, double salon et terrasse sur l’avenue George V.',
    descEn:
      'A 97 m² signature suite with gilded touches, a double living room and a terrace over Avenue George V.',
    longFr:
      'La Suite Or s’étend sur 97 m² ornés de touches dorées, avec un double salon spacieux et une terrasse ouverte sur l’avenue George V. Son charme Art déco intemporel culmine dans une salle de bain à la mosaïque dorée et noire.\n\nC’est l’une des adresses signatures de la maison : un appartement parisien pour qui veut recevoir, s’installer et vivre l’hôtel en grand.',
    longEn:
      'Suite Or spans 97 m² adorned with gilded touches, with a spacious double living room and a terrace open to Avenue George V. Its timeless Art Deco charm culminates in a golden-and-black mosaic bathroom.\n\nIt is one of the house signatures: a Parisian apartment for those who want to host, settle in and live the hotel on a grand scale.',
    maxOccupancy: 4,
    bedType: 'King size',
    sizeSqm: 97,
    amenities: [
      { fr: 'Double salon', en: 'Double living room' },
      { fr: 'Terrasse avenue George V', en: 'Avenue George V terrace' },
      { fr: 'Touches dorées Art déco', en: 'Gilded Art Deco touches' },
      { fr: 'Salle de bain mosaïque or et noir', en: 'Gold-and-black mosaic bathroom' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
      { fr: 'Eau minérale offerte', en: 'Complimentary bottled water' },
    ],
    isSignature: true,
    displayOrder: 60,
    source: 'suite-or',
    images: [
      {
        file: 'parlc-prince-5630-hor-clsc',
        category: 'suite',
        altFr: 'Chambre de la Suite Or aux touches dorées, Prince de Galles Paris',
        altEn: 'Bedroom of the gilded Suite Or, Prince de Galles Paris',
      },
      {
        file: 'parlc-prince-5631-hor-wide',
        category: 'suite',
        altFr: 'Double salon de la Suite Or, Prince de Galles Paris',
        altEn: 'Double living room of the Suite Or, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'La Suite Or, c’est l’adresse que je garde pour les grandes occasions. Quatre-vingt-dix-sept mètres carrés, un double salon et cette terrasse sur l’avenue George V : on y reçoit comme dans un appartement parisien. Je conseille d’y arriver en fin d’après-midi, quand la lumière dore la mosaïque de la salle de bain. Pour un anniversaire ou une demande, prévenez-moi : fleurs, champagne et table au restaurant, je m’occupe de tout en amont.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'Suite Or is the address I keep for grand occasions. Ninety-seven square metres, a double living room and that terrace over Avenue George V: you host here as in a Parisian apartment. I suggest arriving in late afternoon, when the light gilds the bathroom mosaic. For a birthday or a proposal, tell me in advance: flowers, champagne and a table at the restaurant — I will arrange everything beforehand.',
      tipFor: 'room',
    },
  },
  {
    roomCode: 'LALIQUE-SUITE',
    slug: 'suite-lalique',
    nameFr: 'Suite Lalique par Patrick Hellmann',
    nameEn: 'Lalique Suite by Patrick Hellmann',
    descFr:
      'La suite signature : un duplex de 180 m² aux 8e et 9e étages, né d’une collaboration avec le cristallier Lalique.',
    descEn:
      'The signature suite: a 180 m² duplex on the 8th and 9th floors, born of a collaboration with crystal maker Lalique.',
    longFr:
      'Nichée aux 8e et 9e étages, la Suite Lalique est un duplex de 180 m² imaginé avec la Maison Lalique et le designer Patrick Hellmann. Œuvres en cristal, salle de bain en marbre et terrasse composent un appartement unique à Paris.\n\nDévoilée pour les 90 ans de l’hôtel, elle relit les lignes Art déco d’origine dans un esprit contemporain. C’est la suite la plus exclusive de la maison.',
    longEn:
      'Nestled on the 8th and 9th floors, the Lalique Suite is a 180 m² duplex conceived with Maison Lalique and designer Patrick Hellmann. Crystal artworks, a marble bathroom and a terrace make up an apartment unlike any other in Paris.\n\nUnveiled for the hotel’s 90th anniversary, it rereads the original Art Deco lines in a contemporary spirit. It is the most exclusive suite in the house.',
    maxOccupancy: 4,
    bedType: 'King size',
    sizeSqm: 180,
    amenities: [
      { fr: 'Duplex sur deux étages', en: 'Two-floor duplex' },
      { fr: 'Œuvres en cristal Lalique', en: 'Lalique crystal artworks' },
      { fr: 'Terrasse privée', en: 'Private terrace' },
      { fr: 'Salle de bain en marbre', en: 'Marble bathroom' },
      { fr: 'Design Patrick Hellmann', en: 'Patrick Hellmann design' },
      { fr: 'Produits Lalique', en: 'Lalique toiletries' },
    ],
    isSignature: true,
    displayOrder: 70,
    source: 'lalique',
    images: [
      {
        file: 'parlc-suite-patrick-hellmann-0852-hor-clsc',
        category: 'suite',
        altFr: 'Salon de la Suite Lalique par Patrick Hellmann, Prince de Galles Paris',
        altEn: 'Living room of the Lalique Suite by Patrick Hellmann, Prince de Galles Paris',
      },
      {
        file: 'parlc-suite-hellmann-8273-hor-clsc',
        category: 'suite',
        altFr: 'Chambre de la Suite Lalique, cristal et marbre, Prince de Galles Paris',
        altEn: 'Bedroom of the Lalique Suite, crystal and marble, Prince de Galles Paris',
      },
      {
        file: 'parlc-suite-lalique-terrace-2106-hor-clsc',
        category: 'view',
        altFr: 'Terrasse de la Suite Lalique en duplex, Prince de Galles Paris',
        altEn: 'Terrace of the duplex Lalique Suite, Prince de Galles Paris',
      },
    ],
    conciergeFr: {
      title: 'Le conseil du Concierge',
      body: 'La Suite Lalique est le joyau de la maison : un duplex de 180 m² signé avec le cristallier Lalique, perché aux derniers étages. On y vient pour une demande en mariage, un anniversaire de mariage ou un séjour d’exception. Réservez longtemps à l’avance, elle est unique. Je prépare volontiers une arrivée sur-mesure — cristal, champagne, terrasse au coucher du soleil. Confiez-moi votre projet, je l’orchestre discrètement du début à la fin.',
      tipFor: 'room',
    },
    conciergeEn: {
      title: 'The Concierge’s tip',
      body: 'The Lalique Suite is the jewel of the house: a 180 m² duplex created with crystal maker Lalique, perched on the top floors. Guests come here for a proposal, a wedding anniversary or an exceptional stay. Book well ahead, as it is one of a kind. I am glad to prepare a bespoke arrival — crystal, champagne, the terrace at sunset. Trust me with your plan and I will orchestrate it discreetly from start to finish.',
      tipFor: 'room',
    },
  },
];

function buildSourceUrl(file: string): string {
  return `${DAM_PREFIX}${file}${DAM_SUFFIX}`;
}

interface HotelRoomInsert {
  readonly hotel_id: string;
  readonly room_code: string;
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly description_fr: string;
  readonly description_en: string;
  readonly long_description_fr: string;
  readonly long_description_en: string;
  readonly max_occupancy: number | null;
  readonly bed_type: string | null;
  readonly size_sqm: number | null;
  readonly amenities: ReadonlyArray<{ readonly label_fr: string; readonly label_en: string }>;
  readonly is_signature: boolean;
  readonly display_order: number;
  readonly hero_image: string | null;
  readonly images: ReadonlyArray<{
    readonly public_id: string;
    readonly alt_fr: string;
    readonly alt_en: string;
    readonly category: string;
  }>;
  readonly concierge_advice: {
    readonly fr: { readonly title: string; readonly body: string; readonly tip_for: TipFor };
    readonly en: { readonly title: string; readonly body: string; readonly tip_for: TipFor };
  };
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[pdg-rooms] hotel not found: ${SLUG}`);
  return id;
}

async function upsertRooms(
  cfg: SupabaseRestConfig,
  rows: readonly HotelRoomInsert[],
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotel_rooms?on_conflict=hotel_id,room_code`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert hotel_rooms failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[pdg-rooms] Cloudinary creds missing despite requirePhotoEnv check');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const hotelId = dryRun ? '<hotel-id>' : await fetchHotelId(cfg);
  console.log(
    `[pdg-rooms] ${ROOMS.length} rooms — dry-run: ${dryRun ? 'YES' : 'NO'} — hotel ${hotelId}`,
  );

  const inserts: HotelRoomInsert[] = [];
  // Global 1-based index → flat `cct/hotels/<slug>/press-<n>` public_ids
  // (source `press` = official Marriott media kit, per photo-quality.mdc).
  let photoIndex = 0;

  for (const room of ROOMS) {
    const galleryImages: HotelRoomInsert['images'][number][] = [];

    for (let i = 0; i < room.images.length; i++) {
      const img = room.images[i]!;
      photoIndex += 1;
      const publicId = `cct/hotels/${SLUG}/press-${photoIndex}`;
      const sourceUrl = buildSourceUrl(img.file);

      if (dryRun) {
        console.log(
          `  [${room.slug}#${i + 1}] (${img.category}) -> ${publicId}\n      ${sourceUrl}`,
        );
      } else {
        const result = await uploadFromUrl({
          sourceUrl,
          hotelSlug: SLUG,
          source: 'press',
          index: photoIndex,
          altFr: img.altFr,
          altEn: img.altEn,
          category: img.category,
          extraTags: ['prince-de-galles-rooms-2026', `room-${room.slug}`],
        });
        if (!result.ok) {
          console.error(`  [${room.slug}#${i + 1}] UPLOAD FAILED: ${JSON.stringify(result.error)}`);
          throw new Error(
            `[pdg-rooms] upload failed (${room.slug} #${i + 1}); aborting before DB write`,
          );
        }
        console.log(
          `  [${room.slug}#${i + 1}] OK ${result.value.public_id} ${result.value.width}x${result.value.height}`,
        );
      }

      galleryImages.push({
        public_id: publicId,
        alt_fr: img.altFr,
        alt_en: img.altEn,
        category: img.category,
      });
    }

    const hero = galleryImages[0]?.public_id ?? null;

    inserts.push({
      hotel_id: hotelId,
      room_code: room.roomCode,
      slug: room.slug,
      name_fr: room.nameFr,
      name_en: room.nameEn,
      description_fr: room.descFr,
      description_en: room.descEn,
      long_description_fr: room.longFr,
      long_description_en: room.longEn,
      max_occupancy: room.maxOccupancy,
      bed_type: room.bedType,
      size_sqm: room.sizeSqm,
      amenities: room.amenities.map((a) => ({ label_fr: a.fr, label_en: a.en })),
      is_signature: room.isSignature,
      display_order: room.displayOrder,
      hero_image: hero,
      images: galleryImages,
      concierge_advice: {
        fr: {
          title: room.conciergeFr.title,
          body: room.conciergeFr.body,
          tip_for: room.conciergeFr.tipFor,
        },
        en: {
          title: room.conciergeEn.title,
          body: room.conciergeEn.body,
          tip_for: room.conciergeEn.tipFor,
        },
      },
    });
  }

  if (dryRun) {
    console.log(
      `\n[pdg-rooms] dry-run — ${inserts.length} rooms prepared, no upload, no DB write.`,
    );
    return;
  }

  await upsertRooms(cfg, inserts);
  console.log(`\n[pdg-rooms] upserted ${inserts.length} rooms for ${SLUG}. Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
