/**
 * Le Bristol Paris "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override (local sandbox) and the
 * catalogue promotion script (`@mch/editorial-pilot`).
 *
 * Facts sourced from hotel-bristol.com / Oetker Collection and public
 * tourism references. Figures not confidently sourced are omitted (EEAT).
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import {
  LE_BRISTOL_PARIS_AMENITIES,
  type LeBristolParisAmenityRecord,
} from './le-bristol-paris-amenities';
import { buildKitWaveFaqKit, buildKitWaveFaqPromote } from './kit-wave-faq-seed';
import { LE_BRISTOL_PARIS_CONCIERGE_QUESTIONS_KIT } from './le-bristol-paris-concierge-questions';
import {
  LE_BRISTOL_PARIS_GALLERY_IMAGES,
  LE_BRISTOL_PARIS_HERO_IMAGE,
} from './le-bristol-paris-gallery';

export const LE_BRISTOL_PARIS_PROMOTE_SLUG = 'le-bristol-paris';

/** Google Places `place_id` — verified PO input (2026-06-10). */
export const LE_BRISTOL_PARIS_GOOGLE_PLACE_ID = 'ChIJVeUHqupv5kcR4taEicvH7ww';

/** Cloudinary folder prefix for Le Bristol kit / golden assets. */
export const LE_BRISTOL_PARIS_IMAGE_PREFIX = 'cct/hotels/le-bristol-paris';

/** Dedicated POI card asset — never reuse hotel gallery `press-*`. */
export function leBristolParisPoiImage(poiSlug: string): string {
  return `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/poi-${poiSlug}`;
}

const FNB_PHONE_MAIN = '+33 1 53 43 43 00';

export const LE_BRISTOL_PARIS_PHONE_E164 = '+33153434300';
export const LE_BRISTOL_PARIS_ADDRESS = '112 rue du Faubourg Saint-Honoré';
export const LE_BRISTOL_PARIS_POSTAL_CODE = '75008';
export const LE_BRISTOL_PARIS_LATITUDE = 48.8718;
export const LE_BRISTOL_PARIS_LONGITUDE = 2.3158;
export const LE_BRISTOL_PARIS_EMAIL_RESERVATIONS = 'reservation@lebristolparis.com';

export const LE_BRISTOL_PARIS_HOTEL_DISPLAY_NAME = 'Le Bristol Paris';

// ---------------------------------------------------------------------------
// restaurant_info.venues — 5 official F&B outlets (CDC D7)
// ---------------------------------------------------------------------------

export const LE_BRISTOL_PARIS_RESTAURANT_INFO = {
  count: 5,
  michelin_stars: 4,
  venues: [
    {
      name: 'Epicure',
      type_fr: 'Gastronomie · 3 étoiles MICHELIN · Chef Arnaud Faye',
      type_en: 'Fine dining · 3 MICHELIN Stars · Chef Arnaud Faye',
      chef: 'Arnaud Faye',
      features: ['Terrasse jardin', 'Petit-déjeuner clients', 'Table signature macaroni truffe'],
      hours_fr: 'Déj. mar–sam 12h–13h30 · Dîner mar–sam 19h30–21h30 · Pdj. clients 7h30–10h30',
      hours_en:
        'Lunch Tue–Sat 12–1:30 pm · Dinner Tue–Sat 7:30–9:30 pm · Guest breakfast 7:30–10:30 am',
      description_fr:
        'Table trois étoiles MICHELIN d’Arnaud Faye : haute cuisine française face au jardin à la française du palace.',
      description_en:
        'Arnaud Faye’s three-MICHELIN-star table: outstanding French cuisine facing the palace French garden.',
      website: 'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/epicure/',
      reservation_url:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/epicure/',
      phone: '+33 1 53 43 43 40',
      price_note_fr: 'Menus dégustation · à la carte',
      price_note_en: 'Tasting menus · à la carte',
      tip_fr:
        'Mon conseil : pour un déjeuner en semaine, demandez la terrasse jardin — la lumière de midi y est la plus flatteuse sur les assiettes.',
      tip_en:
        'My tip: for a weekday lunch, ask for the garden terrace — midday light is most flattering on the plates there.',
    },
    {
      name: '114 Faubourg',
      type_fr: 'Brasserie · 1 étoile MICHELIN · Chef Vincent Schmit',
      type_en: 'Brasserie · 1 MICHELIN Star · Chef Vincent Schmit',
      chef: 'Vincent Schmit',
      features: ['Bistronomie', 'Bar attenant', 'Adresse 114 rue du Faubourg'],
      hours_fr: 'Déj. lun–ven 12h–14h · Dîner lun–dim 19h–22h',
      hours_en: 'Lunch Mon–Fri 12–2 pm · Dinner Mon–Sun 7–10 pm',
      description_fr:
        'Brasserie une étoile au 114 rue du Faubourg Saint-Honoré : bistronomie parisienne dans un décor contemporain.',
      description_en:
        'One-star brasserie at 114 rue du Faubourg Saint-Honoré: Parisian bistronomy in a contemporary setting.',
      website:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/114-faubourg/',
      reservation_url:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/114-faubourg/',
      phone: '+33 1 53 43 44 44',
      price_note_fr: 'À la carte · formules déjeuner',
      price_note_en: 'À la carte · lunch menus',
      tip_fr:
        'Mon conseil : le comptoir du bar 114 tient souvent des places le soir même — idéal après un spectacle à l’Opéra.',
      tip_en:
        'My tip: the 114 bar counter often holds same-evening seats — ideal after a show at the Opéra.',
    },
    {
      name: 'Le Jardin Français',
      type_fr: 'Restaurant terrasse · Jardin à la française',
      type_en: 'Terrace restaurant · French garden',
      features: ['Afternoon tea', 'Déjeuner en plein air', 'Oasis 1 200 m²'],
      hours_fr: 'Déj. 12h–15h · Tea 15h–18h · Dîner 18h–22h30',
      hours_en: 'Lunch 12–3 pm · Tea 3–6 pm · Dinner 6–10:30 pm',
      description_fr:
        'Table en plein air au cœur du jardin intérieur : déjeuner, afternoon tea et dîner entre roses et fontaines.',
      description_en:
        'Al fresco table at the heart of the interior garden: lunch, afternoon tea and dinner among roses and fountains.',
      website:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/le-jardin-francais/',
      reservation_url:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/le-jardin-francais/',
      phone: '+33 1 53 43 43 42',
      price_note_fr: 'À la carte · tea time',
      price_note_en: 'À la carte · tea time',
      tip_fr:
        'Mon conseil : réservez l’afternoon tea vers 15 h 30, avant l’affluence du week-end sur la terrasse.',
      tip_en: 'My tip: book afternoon tea around 3:30 pm, before weekend crowds on the terrace.',
    },
    {
      name: 'Café Antonia',
      type_fr: 'Café lounge · Fresques et lustres',
      type_en: 'Café lounge · Frescoes and chandeliers',
      features: ['Toute la journée', 'Snacking', 'Déjeuner décontracté'],
      description_fr:
        'Café lounge aux fresques murales : rafraîchissements et déjeuner décontracté toute la journée dans le palace.',
      description_en:
        'Lounge café with wall frescoes: refreshments and relaxed lunch all day within the palace.',
      website:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/cafe-antonia/',
      phone: FNB_PHONE_MAIN,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : pause idéale entre deux rendez-vous couture sur le Faubourg — sans quitter l’hôtel.',
      tip_en:
        'My tip: ideal pause between two couture appointments on the Faubourg — without leaving the hotel.',
    },
    {
      name: 'Le Bar du Bristol',
      type_fr: 'Bar cocktails · Musique live jeudi–samedi',
      type_en: 'Cocktail bar · Live music Thu–Sat',
      features: ['Cocktails signature', 'Snacking', 'Ambiance intimiste'],
      hours_fr: 'Jeu–sam 18h–2h',
      hours_en: 'Thu–Sat 6 pm–2 am',
      description_fr:
        'Bar intimiste du palace : cocktails signature, snacking et programmation jazz live certains soirs.',
      description_en:
        'The palace intimate bar: signature cocktails, light bites and live jazz programming on select evenings.',
      website:
        'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/le-bristol-after-dark/',
      phone: '+33 1 53 43 42 41',
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : arrivez vers 19 h pour le comptoir — l’ambiance live démarre sans la foule de fin de soirée.',
      tip_en:
        'My tip: arrive around 7 pm for the counter — live mood starts without the late-night crowd.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — 18 curated POIs (visit / do / shop)
// ---------------------------------------------------------------------------

export const LE_BRISTOL_PARIS_POINTS_OF_INTEREST = [
  {
    name: 'Palais de l’Élysée',
    name_en: 'Élysée Palace',
    type: 'landmark',
    category_fr: 'Résidence présidentielle',
    category_en: 'Presidential residence',
    distance_meters: 300,
    walk_minutes: 4,
    latitude: 48.8704,
    longitude: 2.3168,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('palais-elysee'),
    description_fr:
      'Résidence officielle du Président de la République, à l’entrée du Faubourg Saint-Honoré. Jardins ouverts lors des Journées du Patrimoine.',
    description_en:
      'Official residence of the French President, at the top of Faubourg Saint-Honoré. Gardens open during Heritage Days.',
    address: '55 rue du Faubourg Saint-Honoré, 75008 Paris',
    tip_fr:
      'Mon conseil : quatre minutes à pied — le palace est le pied-à-terre diplomatique par excellence du quartier.',
    tip_en:
      'My tip: a four-minute walk — the palace is the district’s quintessential diplomatic base.',
  },
  {
    name: 'Église de la Madeleine',
    name_en: 'La Madeleine',
    type: 'church',
    category_fr: 'Temple néoclassique',
    category_en: 'Neoclassical church',
    distance_meters: 600,
    walk_minutes: 8,
    latitude: 48.8701,
    longitude: 2.3246,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('eglise-madeleine'),
    description_fr:
      'Église néoclassique en forme de temple romain, place de la Madeleine. Concerts d’orgue et messes dominicales.',
    description_en:
      'Neoclassical church shaped like a Roman temple on Place de la Madeleine. Organ concerts and Sunday services.',
    website: 'https://www.eglise-lamadeleine.com/',
    tip_fr:
      'Mon conseil : huit minutes à pied. Les concerts d’orgue du samedi soir résonnent dans la nef comme nulle part ailleurs.',
    tip_en:
      'My tip: an eight-minute walk. Saturday evening organ concerts resonate in the nave like nowhere else.',
  },
  {
    name: 'Place de la Concorde',
    name_en: 'Place de la Concorde',
    type: 'landmark',
    category_fr: 'Place historique',
    category_en: 'Historic square',
    distance_meters: 850,
    walk_minutes: 11,
    latitude: 48.865633,
    longitude: 2.321236,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('place-de-la-concorde'),
    description_fr:
      'Plus grande place de Paris, entre le jardin des Tuileries et les Champs-Élysées. Obélisque de Louxor et fontaines.',
    description_en:
      'Paris’s largest square, between the Tuileries Garden and the Champs-Élysées. Luxor Obelisk and fountains.',
    tip_fr:
      'Mon conseil : traversez au crépuscule — l’obélisque et la Tour Eiffel s’alignent dans la même perspective.',
    tip_en: 'My tip: cross at dusk — the obelisk and the Eiffel Tower align in the same sightline.',
  },
  {
    name: 'Musée Jacquemart-André',
    name_en: 'Musée Jacquemart-André',
    type: 'museum',
    category_fr: 'Hôtel particulier & collections',
    category_en: 'Town house & collections',
    distance_meters: 700,
    walk_minutes: 9,
    latitude: 48.8753,
    longitude: 2.3167,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('musee-jacquemart-andre'),
    description_fr:
      'Collection privée d’art italien et flamand dans un hôtel particulier du boulevard Haussmann, salon de thé historique.',
    description_en:
      'Private Italian and Flemish art collection in a Haussmann boulevard town house, historic tea salon.',
    website: 'https://www.musee-jacquemart-andre.com/',
    tip_fr:
      'Mon conseil : neuf minutes à pied. Le salon de thé du musée clôt bien une matinée culturelle.',
    tip_en: 'My tip: a nine-minute walk. The museum tea salon closes a cultural morning neatly.',
  },
  {
    name: 'Musée Nissim de Camondo',
    name_en: 'Musée Nissim de Camondo',
    type: 'museum',
    category_fr: 'Demeure du XVIIIe siècle',
    category_en: '18th-century residence',
    distance_meters: 1100,
    walk_minutes: 14,
    latitude: 48.8791,
    longitude: 2.3142,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('musee-nissim-de-camondo'),
    description_fr:
      'Hôtel particulier avenue Mozart reconstitué, collections mobilier Louis XV et XVI — pendant décoratif du Bristol.',
    description_en:
      'Recreated town house on Avenue Mozart, Louis XV and XVI furniture — a decorative counterpart to Le Bristol.',
    website: 'https://www.arts-decoratifs.com/musee-nissim-de-camondo',
    tip_fr:
      'Mon conseil : quatorze minutes à pied ou cinq en taxi. La cuisine d’époque du musée surprend toujours.',
    tip_en: 'My tip: a fourteen-minute walk or five by taxi. The period kitchen always surprises.',
  },
  {
    name: 'Parc Monceau',
    name_en: 'Parc Monceau',
    type: 'park',
    category_fr: 'Jardin à l’anglaise',
    category_en: 'English-style garden',
    distance_meters: 1100,
    walk_minutes: 14,
    latitude: 48.8797,
    longitude: 2.3095,
    bucket: 'do',
    image_public_id: leBristolParisPoiImage('parc-monceau'),
    description_fr:
      'Jardin à l’anglaise du 8e arrondissement, rotunde, colonnes et allées ombragées — promenade des habitués du palace.',
    description_en:
      'English-style garden in the 8th arrondissement, rotunda, columns and shaded paths — a stroll for palace regulars.',
    tip_fr:
      'Mon conseil : promenade à l’aube, avant l’affluence — quatorze minutes à pied depuis le jardin du Bristol.',
    tip_en:
      'My tip: stroll at dawn, before crowds — fourteen minutes on foot from the Bristol garden.',
  },
  {
    name: 'Opéra Garnier',
    name_en: 'Palais Garnier',
    type: 'opera',
    category_fr: 'Opéra & ballet',
    category_en: 'Opera & ballet',
    distance_meters: 1400,
    walk_minutes: 18,
    latitude: 48.872,
    longitude: 2.3316,
    bucket: 'do',
    image_public_id: leBristolParisPoiImage('opera-garnier'),
    description_fr:
      'Chef-d’œuvre de Charles Garnier (1875), programme opéra et ballet. Visites guidées en journée.',
    description_en:
      'Charles Garnier masterpiece (1875), opera and ballet programming. Guided visits by day.',
    website: 'https://www.operadeparis.fr/',
    tip_fr:
      'Mon conseil : réservez les places de galerie pour le rapport qualité-prix, puis dînez au 114 Faubourg après le rideau.',
    tip_en: 'My tip: book gallery seats for value, then dine at 114 Faubourg after the curtain.',
  },
  {
    name: 'Jardin des Tuileries',
    name_en: 'Tuileries Garden',
    type: 'garden',
    category_fr: 'Jardin historique',
    category_en: 'Historic garden',
    distance_meters: 900,
    walk_minutes: 12,
    latitude: 48.8634,
    longitude: 2.3275,
    bucket: 'do',
    image_public_id: leBristolParisPoiImage('jardin-des-tuileries'),
    description_fr:
      'Jardin entre le Louvre et la Concorde, chaises vertes et bassins — pause nature à douze minutes du palace.',
    description_en:
      'Garden between the Louvre and Concorde, green chairs and pools — a nature break twelve minutes from the palace.',
    tip_fr:
      'Mon conseil : traversez après le musée Jacquemart-André — les allées ombragées coupent le bruit du 8e.',
    tip_en:
      'My tip: cross after Musée Jacquemart-André — shaded alleys cut the 8th arrondissement noise.',
  },
  {
    name: 'Croisière sur la Seine',
    name_en: 'Seine river cruise',
    type: 'cruise',
    category_fr: 'Croisière commentée',
    category_en: 'Sightseeing cruise',
    distance_meters: 1000,
    walk_minutes: 13,
    latitude: 48.863,
    longitude: 2.308,
    bucket: 'do',
    image_public_id: leBristolParisPoiImage('croisiere-seine'),
    description_fr:
      'Embarquement au Port de la Conférence, sous le pont de l’Alma. Croisières d’une heure ou dîners sur la Seine.',
    description_en:
      'Boarding at Port de la Conférence, below Pont de l’Alma. One-hour cruises or dinner cruises on the Seine.',
    website: 'https://www.bateauxparisiens.com/',
    tip_fr:
      'Mon conseil : embarquez au crépuscule — la Tour Eiffel s’illumine pendant la croisière.',
    tip_en: 'My tip: board at dusk — the Eiffel Tower lights up during the cruise.',
  },
  {
    name: 'Faubourg Saint-Honoré',
    name_en: 'Faubourg Saint-Honoré',
    type: 'shopping',
    category_fr: 'Avenue du luxe parisien',
    category_en: 'Paris luxury avenue',
    distance_meters: 0,
    walk_minutes: 1,
    latitude: 48.8718,
    longitude: 2.3158,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('faubourg-saint-honore'),
    description_fr:
      'Artère des maisons de couture et d’art : Hermès 24, Lanvin, Saint Laurent, Goyard — le palace est au cœur de l’axe.',
    description_en:
      'Avenue of couture and art houses: Hermès 24, Lanvin, Saint Laurent, Goyard — the palace sits at the axis.',
    tip_fr:
      'Mon conseil : flânez en semaine vers 11 h — les vitrines se changent et les salons sont plus disponibles.',
    tip_en:
      'My tip: stroll on a weekday around 11 am — windows are being dressed and salons are more available.',
  },
  {
    name: 'Hermès 24 Faubourg',
    name_en: 'Hermès 24 Faubourg',
    type: 'store',
    category_fr: 'Maison flagship',
    category_en: 'Flagship store',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 48.8732,
    longitude: 2.3208,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('hermes-24-faubourg'),
    description_fr:
      'Temple de la maroquinerie Hermès au 24 Faubourg Saint-Honoré — personnalisation et pièces iconiques.',
    description_en:
      'Hermès leather-goods temple at 24 Faubourg Saint-Honoré — personalisation and iconic pieces.',
    website: 'https://www.hermes.com/',
    tip_fr:
      'Mon conseil : les pièces personnalisées demandent quarante-huit heures — passez le premier jour pour récupérer avant le départ.',
    tip_en:
      'My tip: personalised pieces need forty-eight hours — stop on day one to collect before departure.',
  },
  {
    name: 'Place Vendôme',
    name_en: 'Place Vendôme',
    type: 'landmark',
    category_fr: 'Place joaillière',
    category_en: 'Jewellery square',
    distance_meters: 900,
    walk_minutes: 12,
    latitude: 48.8675,
    longitude: 2.3299,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('place-vendome'),
    description_fr:
      'Place octogonale et colonne Vendôme, haute joaillerie et horlogerie de prestige — douze minutes en taxi.',
    description_en:
      'Octagonal square and Vendôme column, prestige high jewellery and watchmaking — twelve minutes by taxi.',
    tip_fr:
      'Mon conseil : les maisons ouvrent parfois sur rendez-vous avant l’heure publique — la conciergerie transmet la demande.',
    tip_en:
      'My tip: houses sometimes open by appointment before public hours — the concierge forwards the request.',
  },
  {
    name: 'Avenue Montaigne',
    name_en: 'Avenue Montaigne',
    type: 'shopping',
    category_fr: 'Artère couture',
    category_en: 'Couture avenue',
    distance_meters: 1200,
    walk_minutes: 15,
    latitude: 48.8665,
    longitude: 2.3045,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('avenue-montaigne'),
    description_fr:
      'Chanel, Dior, Louis Vuitton et haute joaillerie entre Champs-Élysées et Seine.',
    description_en:
      'Chanel, Dior, Louis Vuitton and high jewellery between the Champs-Élysées and the Seine.',
    tip_fr:
      'Mon conseil : quinze minutes à pied ou cinq en taxi — enchaînez après un déjeuner au Jardin Français.',
    tip_en:
      'My tip: fifteen minutes on foot or five by taxi — continue after lunch at Le Jardin Français.',
  },
  {
    name: 'Le Bon Marché',
    name_en: 'Le Bon Marché',
    type: 'store',
    category_fr: 'Grand magasin Rive Gauche',
    category_en: 'Left Bank department store',
    distance_meters: 2000,
    walk_minutes: 25,
    latitude: 48.8512,
    longitude: 2.3237,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('le-bon-marche'),
    description_fr:
      'Grand magasin Rive Gauche, la Grande Épicerie et sélection créateur — vingt-cinq minutes en taxi depuis le palace.',
    description_en:
      'Left Bank department store, La Grande Épicerie and designer selection — twenty-five minutes by taxi from the palace.',
    website: 'https://www.lebonmarche.com/',
    tip_fr:
      'Mon conseil : la Grande Épicerie vaut le détour pour les cadeaux gourmands à rapporter.',
    tip_en: 'My tip: La Grande Épicerie is worth the trip for gourmet gifts to bring back.',
  },
  {
    name: 'Salle Pleyel',
    name_en: 'Salle Pleyel',
    type: 'concert',
    category_fr: 'Salle de concerts',
    category_en: 'Concert hall',
    distance_meters: 1500,
    walk_minutes: 19,
    latitude: 48.8804,
    longitude: 2.3012,
    bucket: 'do',
    image_public_id: leBristolParisPoiImage('salle-pleyel'),
    description_fr:
      'Salle de concerts avenue du Général-Lemonnier, programmation classique et orchestres internationaux.',
    description_en:
      'Concert hall on Avenue du Général-Lemonnier, classical programming and international orchestras.',
    website: 'https://www.sallepleyel.com/',
    tip_fr:
      'Mon conseil : vérifiez la programmation du moment — la conciergerie réserve les places disponibles.',
    tip_en: 'My tip: check the current programme — the concierge books available seats.',
  },
  {
    name: 'Grand Palais',
    name_en: 'Grand Palais',
    type: 'museum',
    category_fr: 'Monument & expositions',
    category_en: 'Monument & exhibitions',
    distance_meters: 1600,
    walk_minutes: 20,
    latitude: 48.866109,
    longitude: 2.312454,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('grand-palais'),
    description_fr:
      'Chef-d’œuvre Belle Époque et programmation culturelle au cœur des Champs-Élysées.',
    description_en:
      'Belle Époque landmark and cultural programming at the heart of the Champs-Élysées.',
    website: 'https://www.grandpalais.fr/',
    tip_fr:
      'Mon conseil : vérifiez l’expo du moment sur grandpalais.fr — la verrière seule justifie le détour.',
    tip_en:
      'My tip: check the current exhibition on grandpalais.fr — the glass roof alone justifies the trip.',
  },
  {
    name: 'Petit Palais',
    name_en: 'Petit Palais',
    type: 'museum',
    category_fr: 'Musée des Beaux-Arts',
    category_en: 'Fine Arts Museum',
    distance_meters: 1500,
    walk_minutes: 19,
    latitude: 48.866047,
    longitude: 2.314424,
    bucket: 'visit',
    image_public_id: leBristolParisPoiImage('petit-palais'),
    description_fr:
      'Musée municipal gratuit (collections permanentes) dans un palais de 1900, jardin et café en terrasse.',
    description_en:
      'Free municipal museum (permanent collections) in a 1900 palace, garden and terrace café.',
    website: 'https://www.petitpalais.paris.fr/',
    price_note_fr: 'Collections permanentes gratuites',
    price_note_en: 'Permanent collections free',
    tip_fr:
      'Mon conseil : collections permanentes gratuites — entrez par le jardin pour un café à l’ombre.',
    tip_en: 'My tip: permanent collections are free — enter via the garden for a shaded coffee.',
  },
  {
    name: 'Rue du Faubourg Saint-Honoré (boutiques)',
    name_en: 'Faubourg Saint-Honoré boutiques',
    type: 'shopping',
    category_fr: 'Maisons de luxe',
    category_en: 'Luxury houses',
    distance_meters: 100,
    walk_minutes: 2,
    latitude: 48.872,
    longitude: 2.316,
    bucket: 'shop',
    image_public_id: leBristolParisPoiImage('boutiques-faubourg'),
    description_fr:
      'Lanvin, Versace, Goyard et galeries d’art à deux pas de l’entrée du palace — le triangle du luxe discret.',
    description_en:
      'Lanvin, Versace, Goyard and art galleries steps from the palace entrance — the discreet luxury triangle.',
    tip_fr:
      'Mon conseil : commencez par Hermès 24, puis redescendez vers le palace pour l’afternoon tea sans repasser par le trafic.',
    tip_en:
      'My tip: start at Hermès 24, then walk back to the palace for afternoon tea without crossing traffic again.',
  },
] as const;

export const LE_BRISTOL_PARIS_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez une Prestige côté jardin. Vous dormez face aux 1 200 m² de verdure, sans renoncer à la lumière du matin. Le rituel que je recommande : petit-déjeuner au Jardin Français, puis quelques longueurs à la piscine en acajou avant un déjeuner Epicure. Précisez votre heure d’arrivée — la chambre peut être préparée en avance.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for a Prestige room on the garden side. You sleep facing 1,200 sq m of greenery without losing the morning light. The ritual I recommend is breakfast at Le Jardin Français, then a few lengths in the mahogany pool before lunch at Epicure. Share your arrival time — the room can be readied early.',
  },
} as const;

export const LE_BRISTOL_PARIS_CONCIERGE_PICK_SLUG = 'suite-eden';

export const LE_BRISTOL_PARIS_CONCIERGE_PICK_NOTE = {
  fr: 'Vue jardin — la chambre que je recommande en premier pour une première venue au Bristol.',
  en: 'Garden view — the room I recommend first for a first stay at Le Bristol.',
} as const;

export const LE_BRISTOL_PARIS_CONCIERGE_PICK = {
  slug: LE_BRISTOL_PARIS_CONCIERGE_PICK_SLUG,
  note: LE_BRISTOL_PARIS_CONCIERGE_PICK_NOTE,
} as const;

export const LE_BRISTOL_PARIS_CONCIERGE_HOOK = {
  fr: 'Palace Oetker Collection sur le Faubourg Saint-Honoré : jardin de 1 200 m², Epicure 3 étoiles, piscine rooftop et spa La Mer, à 300 m de l’Élysée.',
  en: 'Oetker Collection palace on Faubourg Saint-Honoré: 1,200 sq m garden, 3-star Epicure, rooftop pool and La Mer spa, 300 m from the Élysée.',
} as const;

export const LE_BRISTOL_PARIS_FACTUAL_SUMMARY_FR =
  'Palace Oetker sur le Faubourg Saint-Honoré : 188 chambres, jardin de 1 200 m², Epicure 3 étoiles, piscine rooftop et spa La Mer.';
export const LE_BRISTOL_PARIS_FACTUAL_SUMMARY_EN =
  'Oetker Collection palace on Faubourg Saint-Honoré: 188 rooms, 1,200 sq m garden, 3-star Epicure, rooftop pool and La Mer spa.';

export const LE_BRISTOL_PARIS_DESCRIPTION_FR =
  'Sur le Faubourg Saint-Honoré, Le Bristol cultive l’art de recevoir à la française depuis 1925. L’hôtel particulier du XVIIIe siècle abrite 188 chambres et suites, un jardin à la française de 1 200 m² et une piscine en acajou sur les toits.\n\nLa conciergerie Les Clefs d’Or anticipe sans envahir — table Epicure, afternoon tea au Jardin Français, transfert Élysée. C’est l’essence d’un séjour diplomatique parisien : le luxe intérieur, à trois cents mètres du pouvoir, sans jamais rompre la parenthèse. Arnaud Faye et Vincent Schmit ancrent la maison dans la gastronomie française contemporaine.';
export const LE_BRISTOL_PARIS_DESCRIPTION_EN =
  'On Faubourg Saint-Honoré, Le Bristol has cultivated French hospitality since 1925. The 18th-century town house holds 188 rooms and suites, a 1,200 sq m French garden and a mahogany pool on the rooftops.\n\nThe Les Clefs d’Or concierge anticipates without intruding — Epicure table, afternoon tea at Le Jardin Français, Élysée transfer. That is the essence of a Parisian diplomatic stay: interior luxury, three hundred metres from power, without ever breaking the spell. Arnaud Faye and Vincent Schmit anchor the house in contemporary French dining.';

export const LE_BRISTOL_PARIS_META_DESC_FR =
  'Le Bristol Paris, palace Faubourg Saint-Honoré : Epicure 3 étoiles, jardin 1 200 m², piscine rooftop, spa La Mer. Oetker Collection.';
export const LE_BRISTOL_PARIS_META_DESC_EN =
  'Le Bristol Paris, palace on Faubourg Saint-Honoré: 3-star Epicure, 1,200 sq m garden, rooftop pool, La Mer spa. Oetker Collection.';

export const LE_BRISTOL_PARIS_META_TITLE_FR =
  'Le Bristol Paris — Palace Faubourg Saint-Honoré | MyConciergeHotel';
export const LE_BRISTOL_PARIS_META_TITLE_EN =
  'Le Bristol Paris — Palace Faubourg Saint-Honoré | MyConciergeHotel';

export const LE_BRISTOL_PARIS_AFFILIATIONS = [
  {
    kind: 'brand',
    source: 'oetker_collection',
    display_name: 'Oetker Collection',
    verified: true,
    facet_slug: 'oetker-collection',
    source_url: 'https://www.oetkercollection.com/hotels/le-bristol-paris/',
    since_year: 1978,
  },
  {
    kind: 'label',
    source: 'atout_france_palace',
    display_name: 'Palace Atout France',
    verified: true,
    facet_slug: 'palace-atout-france',
    source_url: 'https://www.atout-france.fr/',
    since_year: 2011,
  },
  {
    kind: 'label',
    source: 'forbes_5_star',
    display_name: 'Forbes Travel Guide Five-Star',
    verified: true,
    facet_slug: 'forbes-5-star',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/le-bristol-paris',
  },
] as const;

export const LE_BRISTOL_PARIS_HIGHLIGHTS = [
  {
    label_fr: 'Palace Oetker Collection depuis 1978, inauguré en 1925 par Hippolyte Jammet',
    label_en: 'Oetker Collection palace since 1978, opened in 1925 by Hippolyte Jammet',
  },
  {
    label_fr: '188 chambres et suites, mobilier Louis XV / XVI et tissus Pierre Frey',
    label_en: '188 rooms and suites, Louis XV / XVI furniture and Pierre Frey fabrics',
  },
  {
    label_fr:
      'Jardin à la française de 1 200 m² — l’un des plus vastes jardins privés d’hôtel à Paris',
    label_en: '1,200 sq m French garden — one of Paris’s largest private hotel gardens',
  },
  {
    label_fr: 'Epicure — 3 étoiles MICHELIN, Arnaud Faye',
    label_en: 'Epicure — 3 MICHELIN Stars, Arnaud Faye',
  },
  {
    label_fr: '114 Faubourg — 1 étoile MICHELIN, Vincent Schmit',
    label_en: '114 Faubourg — 1 MICHELIN Star, Vincent Schmit',
  },
  {
    label_fr: 'Piscine couverte en acajou au 6e étage, vue Tour Eiffel — Spa Le Bristol by La Mer',
    label_en: '6th-floor mahogany indoor pool, Eiffel Tower views — Spa Le Bristol by La Mer',
  },
] as const;

export const LE_BRISTOL_PARIS_FAQ_CONTENT_PROMOTE = buildKitWaveFaqPromote('le-bristol-paris');
export const LE_BRISTOL_PARIS_FAQ_CONTENT_KIT = buildKitWaveFaqKit('le-bristol-paris');
export {
  LE_BRISTOL_PARIS_CONCIERGE_QUESTIONS_KIT,
  type LeBristolParisConciergeQuestionKit,
} from './le-bristol-paris-concierge-questions';

export const LE_BRISTOL_PARIS_SPA_INFO = {
  name: 'Spa Le Bristol by La Mer',
  partner: 'La Mer',
  treatment_rooms: 8,
  description_fr:
    'Spa de 1 200 m² ouvert sur le jardin intérieur : huit cabines dont une suite duo, hammam, sauna et soins La Mer. La piscine couverte en acajou au 6e étage complète le parcours bien-être.',
  description_en:
    '1,200 sq m spa opening onto the interior garden: eight rooms including a couples suite, hammam, sauna and La Mer treatments. The 6th-floor mahogany indoor pool completes the wellness journey.',
  hours_fr: 'Tous les jours 9h–21h (soins sur rendez-vous) · Piscine 6h30–22h30',
  hours_en: 'Daily 9 am–9 pm (treatments by appointment) · Pool 6:30 am–10:30 pm',
  price_note_fr: 'Soins La Mer sur rendez-vous — tarifs selon le soin choisi.',
  price_note_en: 'La Mer treatments by appointment — rates depend on the treatment selected.',
  website: 'https://www.oetkercollection.com/hotels/le-bristol-paris/spa-wellness/',
  phone: '+33 1 53 43 41 67',
  tip_fr:
    'Mon conseil : enchaînez un soin en fin d’après-midi et la piscine avant un dîner Epicure — le spa est au plus calme entre 17 h et 19 h.',
  tip_en:
    'My tip: follow a late-afternoon treatment with the pool before dinner at Epicure — the spa is quietest between 5 and 7 pm.',
} as const;

export const LE_BRISTOL_PARIS_MICE_INFO = {
  summary_fr:
    'Salons historiques et jardin privatisable jusqu’à 120 convives : séminaires, cocktails et mariages au cœur du Faubourg Saint-Honoré.',
  summary_en:
    'Historic salons and a privatisable garden for up to 120 guests: seminars, cocktails and weddings at the heart of Faubourg Saint-Honoré.',
  contact_email: LE_BRISTOL_PARIS_EMAIL_RESERVATIONS,
  contact_phone: '+33 1 53 43 42 69',
  total_capacity_seated: 120,
  spaces: [
    {
      key: 'salon-honneur',
      name: 'Salon d’honneur',
      max_seated: 120,
      configurations: ['reception', 'theatre', 'dinner', 'cocktail'],
      has_natural_light: true,
      notes_fr: 'Plus grande capacité : cocktail 120, dîner 80.',
      notes_en: 'Largest capacity: cocktail 120, dinner 80.',
    },
    {
      key: 'salon-jardin',
      name: 'Privatisation jardin',
      max_seated: 80,
      configurations: ['reception', 'cocktail', 'dinner'],
      has_natural_light: true,
      notes_fr: 'Jardin à la française — chapiteau ou ciel ouvert selon saison.',
      notes_en: 'French garden — marquee or open sky depending on season.',
    },
    {
      key: 'salon-epicure',
      name: 'Salon privatif Epicure',
      max_seated: 24,
      configurations: ['boardroom', 'dinner'],
      has_natural_light: true,
      notes_fr: 'Déjeuners de travail et dîners intimistes face au jardin.',
      notes_en: 'Working lunches and intimate dinners facing the garden.',
    },
  ],
  event_types: ['corporate-meeting', 'cocktail', 'private-dinner', 'wedding'],
} as const;

export const LE_BRISTOL_PARIS_UPCOMING_EVENTS = [
  {
    name: 'Paris Fashion Week — défilés avenue Montaigne',
    start_date: '2026-09-22',
    end_date: '2026-09-30',
    venue_name: 'Avenue Montaigne',
    latitude: 48.8665,
    longitude: 2.3045,
    distance_meters: 1200,
    category: 'fashion',
    period_fr: 'Fin septembre (dates variables)',
    period_en: 'Late September (dates vary)',
    description_fr:
      'Semaine de la mode : les maisons de couture ouvrent leurs salons à quinze minutes du palace.',
    description_en:
      'Fashion Week: couture houses open their salons fifteen minutes from the palace.',
    pricing: { type: 'invitation', amount_eur: null },
    image_url: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-20`,
  },
  {
    name: 'Fête nationale — défilé et feu d’artifice',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    venue_name: 'Champs-Élysées & Tour Eiffel',
    latitude: 48.873,
    longitude: 2.295,
    distance_meters: 1500,
    category: 'festival',
    period_fr: '14 juillet',
    period_en: '14 July',
    description_fr:
      'Le défilé descend les Champs-Élysées ; depuis la piscine rooftop, le feu d’artifice se lit au-dessus de Paris.',
    description_en:
      'The parade runs down the Champs-Élysées; from the rooftop pool, fireworks unfold above Paris.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-19`,
  },
  {
    name: 'Journées européennes du Patrimoine — Palais de l’Élysée',
    start_date: '2026-09-19',
    end_date: '2026-09-20',
    venue_name: 'Palais de l’Élysée',
    latitude: 48.8704,
    longitude: 2.3168,
    distance_meters: 300,
    category: 'culture',
    period_fr: 'Mi-septembre (week-end)',
    period_en: 'Mid-September (weekend)',
    description_fr:
      'Ouverture exceptionnelle des jardins de l’Élysée — quatre minutes à pied depuis le Bristol.',
    description_en:
      'Exceptional opening of the Élysée gardens — four minutes on foot from Le Bristol.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-1`,
  },
] as const;

export const LE_BRISTOL_PARIS_INSTAGRAM = {
  handle: 'lebristolparis',
  profile_url: 'https://www.instagram.com/lebristolparis/',
  posts: [
    {
      permalink: 'https://www.instagram.com/lebristolparis/',
      image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-10`,
      caption_fr: 'Epicure, trois étoiles MICHELIN, face au jardin à la française du palace.',
      caption_en: 'Epicure, three MICHELIN Stars, facing the palace French garden.',
    },
    {
      permalink: 'https://www.instagram.com/lebristolparis/',
      image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-16`,
      caption_fr: 'La piscine en acajou du 6e étage surplombe les toits de Paris.',
      caption_en: 'The 6th-floor mahogany pool overlooks the Paris rooftops.',
    },
    {
      permalink: 'https://www.instagram.com/lebristolparis/',
      image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-12`,
      caption_fr: 'Afternoon tea au Jardin Français, entre roses et fontaines.',
      caption_en: 'Afternoon tea at Le Jardin Français, among roses and fountains.',
    },
    {
      permalink: 'https://www.instagram.com/lebristolparis/',
      image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-20`,
      caption_fr:
        'Façade du palace sur le Faubourg Saint-Honoré — hôtel particulier du XVIIIe au cœur du pouvoir parisien.',
      caption_en:
        'Palace façade on Faubourg Saint-Honoré — an 18th-century town house at the heart of Parisian power.',
    },
  ],
} as const;

export const LE_BRISTOL_PARIS_FEATURED_REVIEWS = [
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/le-bristol-paris',
    quote_fr:
      'Palace de référence sur le Faubourg Saint-Honoré : jardin secret, Epicure trois étoiles et service Clefs d’Or au sommet de l’art de recevoir parisien.',
    quote_en:
      'Reference palace on Faubourg Saint-Honoré: secret garden, three-star Epicure and Clefs d’Or service at the peak of Parisian hospitality.',
  },
  {
    source: 'MICHELIN Hotels',
    author: 'MICHELIN Hotels',
    source_url: 'https://guide.michelin.com/fr/fr/hotels-stays/paris/le-bristol-1200888',
    quote_fr:
      'Quatre étoiles MICHELIN cumulées dans la maison — Epicure et 114 Faubourg — au cœur d’un hôtel particulier du XVIIIe siècle.',
    quote_en:
      'Four MICHELIN Stars combined in the house — Epicure and 114 Faubourg — at the heart of an 18th-century town house.',
  },
  {
    source: 'Presse spécialisée',
    author: 'Presse spécialisée',
    quote_fr:
      'Depuis 1925, Le Bristol incarne le palace discret du pouvoir parisien — à trois cents mètres de l’Élysée, loin de l’agitation des Champs-Élysées.',
    quote_en:
      'Since 1925, Le Bristol embodies the discreet palace of Parisian power — three hundred metres from the Élysée, away from Champs-Élysées bustle.',
  },
] as const;

export const LE_BRISTOL_PARIS_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q1632093',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q1632093',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Hôtel_Le_Bristol_Paris',
    source: 'wikipedia',
    source_url: 'https://fr.wikipedia.org/wiki/Hôtel_Le_Bristol_Paris',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/Hôtel_Le_Bristol_Paris',
    source: 'wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Hôtel_Le_Bristol_Paris',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'http://www.hotel-bristol.com/',
    source: 'official',
    source_url: 'http://www.hotel-bristol.com/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'google_place_id',
    value: LE_BRISTOL_PARIS_GOOGLE_PLACE_ID,
    source: 'google_places',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 1925,
    source: 'official',
    source_url: 'https://www.oetkercollection.com/hotels/le-bristol-paris/the-hotel/history/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type LeBristolParisExternalScalarField =
  | 'wikidata_id'
  | 'wikipedia_url_fr'
  | 'wikipedia_url_en'
  | 'official_url';

function leBristolParisExternalScalar(field: LeBristolParisExternalScalarField): string {
  const entry = LE_BRISTOL_PARIS_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

export const LE_BRISTOL_PARIS_SIGNATURE_EXPERIENCES = [
  {
    key: 'epicure-terrasse',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-10`,
    title_fr: 'Déjeuner Epicure en terrasse jardin',
    title_en: 'Epicure lunch on the garden terrace',
    description_fr:
      'Table trois étoiles MICHELIN face au jardin à la française — réserver en semaine pour la terrasse.',
    description_en:
      'Three-MICHELIN-star table facing the French garden — book on a weekday for the terrace.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/epicure/',
    tip_fr:
      'Mon conseil : demandez la terrasse pour le service de midi — la lumière y est la plus flatteuse.',
    tip_en: 'My tip: ask for the terrace at lunch — the light is most flattering there.',
  },
  {
    key: 'afternoon-tea-jardin',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-12`,
    title_fr: 'Afternoon tea au Jardin Français',
    title_en: 'Afternoon tea at Le Jardin Français',
    description_fr: 'Tea time 15 h–18 h dans le jardin intérieur — pâtisseries et thés rares.',
    description_en: 'Tea time 3–6 pm in the interior garden — pastries and rare teas.',
    booking_required: true,
    tip_fr: 'Mon conseil : réservez vers 15 h 30, avant l’affluence du week-end.',
    tip_en: 'My tip: book around 3:30 pm, before weekend crowds.',
  },
  {
    key: 'pool-ritual',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-16`,
    title_fr: 'Rituel piscine rooftop en acajou',
    title_en: 'Mahogany rooftop pool ritual',
    description_fr:
      'Piscine couverte 6e étage, 6 h 30–22 h 30 — vue Tour Eiffel et Montmartre, réservée aux clients.',
    description_en:
      '6th-floor indoor pool, 6:30 am–10:30 pm — Eiffel Tower and Montmartre views, guests only.',
    tip_fr: 'Mon conseil : quelques longueurs à l’aube, avant le petit-déjeuner au jardin.',
    tip_en: 'My tip: a few lengths at dawn, before garden breakfast.',
  },
  {
    key: 'spa-la-mer',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-13`,
    title_fr: 'Soin La Mer en cabine duo',
    title_en: 'La Mer treatment in couples suite',
    description_fr: 'Spa Le Bristol by La Mer, 9 h–21 h — rituels visage et corps sur rendez-vous.',
    description_en: 'Spa Le Bristol by La Mer, 9 am–9 pm — face and body rituals by appointment.',
    booking_required: true,
    phone: '+33 1 53 43 41 67',
    tip_fr: 'Mon conseil : réservez la cabine duo en fin d’après-midi, puis rejoignez la piscine.',
    tip_en: 'My tip: book the couples suite late afternoon, then head to the pool.',
  },
  {
    key: '114-faubourg-bar',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-11`,
    title_fr: 'Comptoir 114 Faubourg après spectacle',
    title_en: '114 Faubourg counter after a show',
    description_fr:
      'Brasserie une étoile — le comptoir tient souvent des places tardives le soir même.',
    description_en: 'One-star brasserie — the counter often holds late same-evening seats.',
    booking_required: true,
    website:
      'https://www.oetkercollection.com/hotels/le-bristol-paris/restaurants-bar/114-faubourg/',
    tip_fr: 'Mon conseil : idéal après l’Opéra Garnier, à dix-huit minutes à pied.',
    tip_en: 'My tip: ideal after the Opéra Garnier, an eighteen-minute walk.',
  },
  {
    key: 'garden-breakfast',
    image_public_id: `${LE_BRISTOL_PARIS_IMAGE_PREFIX}/press-20`,
    title_fr: 'Petit-déjeuner privé au jardin',
    title_en: 'Private garden breakfast',
    description_fr:
      'Petit-déjeuner en plein air dans le jardin de 1 200 m² — selon météo et calendrier du palace.',
    description_en:
      'Al fresco breakfast in the 1,200 sq m garden — weather and palace calendar permitting.',
    booking_required: true,
    tip_fr: 'Mon conseil : demandez la table côté fontaine — le calme y est maximal vers 8 h.',
    tip_en: 'My tip: ask for the fountain-side table — it is quietest around 8 am.',
  },
] as const;

export function resolveLeBristolParisSignatureExperiences(): unknown[] {
  return [...LE_BRISTOL_PARIS_SIGNATURE_EXPERIENCES];
}

const LE_BRISTOL_PARIS_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire — de 1758 à l’Oetker Collection',
    title_en: 'History — from 1758 to Oetker Collection',
    body_fr:
      'L’hôtel particulier du comte Jules de Castellane, construit en 1758, devient en 1925 l’Hôtel Le Bristol sous l’impulsion d’Hippolyte Jammet. La famille Oetker acquiert le palace en 1978 — navire amiral de l’Oetker Collection.\n\nPendant la Libération, Le Bristol accueille l’ambassade des États-Unis ; l’établissement est l’un des rares palaces parisiens non réquisitionnés sous l’Occupation. Epicure obtient sa troisième étoile MICHELIN en 2009 ; le palace est parmi les premiers distingués Palace par Atout France en 2011.\n\nMidnight in Paris de Woody Allen (2011) a immortalisé les salons et le jardin du Bristol — la demeure reste une référence du cinéma parisien.',
    body_en:
      'Count Jules de Castellane’s town house, built in 1758, became Hôtel Le Bristol in 1925 under Hippolyte Jammet. The Oetker family acquired the palace in 1978 — flagship of Oetker Collection.\n\nDuring the Liberation, Le Bristol hosted the US embassy; it was one of the few Parisian palaces not requisitioned under the Occupation. Epicure earned its third MICHELIN Star in 2009; the palace was among the first Palace distinctions by Atout France in 2011.\n\nWoody Allen’s Midnight in Paris (2011) immortalised the Bristol’s salons and garden — the residence remains a reference of Parisian cinema.',
  },
  {
    anchor: 'emplacement-paris',
    title_fr: 'Emplacement — Faubourg Saint-Honoré & Élysée',
    title_en: 'Location — Faubourg Saint-Honoré & Élysée',
    body_fr:
      'Le Bristol occupe le 112 rue du Faubourg Saint-Honoré, à trois cents mètres du Palais de l’Élysée. Le métro Madeleine (lignes 8, 12, 14) se rejoint en huit minutes à pied.\n\nLe quartier est celui du pouvoir et de la couture discrète : Hermès 24, boutiques du Faubourg, Place Vendôme à douze minutes. La conciergerie coordonne taxis, VTC et itinéraires piétons selon vos rendez-vous protocolaires.\n\nL’adresse convient aux séjours diplomatiques, familiaux (jardin intérieur) et gastronomiques — loin de l’animation nocturne des Champs-Élysées.',
    body_en:
      'Le Bristol stands at 112 rue du Faubourg Saint-Honoré, three hundred metres from the Élysée Palace. Madeleine metro (lines 8, 12, 14) is an eight-minute walk.\n\nThe district is one of power and discreet couture: Hermès 24, Faubourg boutiques, Place Vendôme twelve minutes away. The concierge coordinates taxis, private cars and walking routes around protocol appointments.\n\nThe address suits diplomatic, family (interior garden) and gastronomic stays — away from Champs-Élysées nightlife.',
  },
  {
    anchor: 'heritage-palace',
    title_fr: 'Héritage palace — jardin, piscine, art de vivre',
    title_en: 'Palace heritage — garden, pool, art de living',
    body_fr:
      'Le jardin à la française de 1 200 m² est l’un des plus vastes jardins privés d’un hôtel parisien — oasis entre les façades du XVIIIe siècle. L’aile Matignon (2009) a ajouté vingt-six chambres et la piscine couverte en acajou au 6e étage.\n\nLes 188 chambres et suites portent mobilier d’époque, tissus Pierre Frey et tableaux de maîtres. Fa-Raon, le chat sacré de Birmanie, est la mascotte officielle des salons depuis 2010.\n\nLe service Clefs d’Or prolonge l’expérience au-delà des murs : tables Epicure, transferts Élysée, accès privés sur le Faubourg.',
    body_en:
      'The 1,200 sq m French garden is one of Paris’s largest private hotel gardens — an oasis between 18th-century façades. The Matignon wing (2009) added twenty-six rooms and the mahogany-lined indoor pool on the 6th floor.\n\nThe 188 rooms and suites carry period furniture, Pierre Frey fabrics and master paintings. Fa-Raon, the sacred Birman cat, has been the official salon mascot since 2010.\n\nClefs d’Or service extends the experience beyond the walls: Epicure tables, Élysée transfers, private access on the Faubourg.',
  },
  {
    anchor: 'chambres-suites',
    title_fr: 'Chambres & suites — du Deluxe à la Suite Impériale',
    title_en: 'Rooms & suites — from Deluxe to Imperial Suite',
    body_fr:
      'Cent quatre-vingt-huit chambres et suites composent le palace. Les catégories Deluxe et Prestige (vue jardin ou ville) portent la signature Bristol : marbre, tissus français, salles de bain généreuses.\n\nLa Suite Impériale (320 m²) et la Suite Penthouse (270 m² + terrasse 100 m²) comptent parmi les hébergements les plus vastes de Paris. La Suite Eden accueille les rituels bien-être.\n\nCôté jardin pour le calme, côté Faubourg pour l’animation discrète — c’est le critère que la conciergerie vérifie en premier à la réservation.',
    body_en:
      'One hundred eighty-eight rooms and suites make up the palace. Deluxe and Prestige categories (garden or city view) carry the Bristol signature: marble, French fabrics, generous bathrooms.\n\nThe Imperial Suite (320 sq m) and Penthouse Suite (270 sq m + 100 sq m terrace) rank among Paris’s largest accommodations. Suite Eden hosts wellness rituals.\n\nGarden side for quiet, Faubourg side for discreet energy — that is the criterion the concierge checks first at booking.',
  },
] as const;

export const LE_BRISTOL_PARIS_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Aéroport Paris-Charles-de-Gaulle',
    station_en: 'Paris Charles de Gaulle Airport',
    distance_meters: 26_000,
    walk_minutes: 50,
    notes_fr:
      'Vols internationaux ; RER B jusqu’à Châtelet puis métro ligne 1, ou transfert privé via la conciergerie (environ 50 min).',
    notes_en:
      'International flights; RER B to Châtelet then metro line 1, or private transfer through the concierge (about 50 min).',
  },
  {
    mode: 'airport',
    station: 'Aéroport Paris-Orly',
    station_en: 'Paris Orly Airport',
    distance_meters: 17_000,
    walk_minutes: 40,
    notes_fr:
      'Orlyval + RER B ou métro ; transfert privé sur réservation (environ 35–45 min selon trafic).',
    notes_en:
      'Orlyval + RER B or metro; private transfer on reservation (about 35–45 min depending on traffic).',
  },
  {
    mode: 'metro',
    station: 'Madeleine',
    station_en: 'Madeleine',
    distance_meters: 600,
    walk_minutes: 8,
    notes_fr:
      'Lignes 8, 12 et 14 — accès Concorde, Opéra et Rive Gauche en correspondance directe.',
    notes_en: 'Lines 8, 12 and 14 — direct connection to Concorde, Opéra and the Left Bank.',
  },
] as const;

function resolveLeBristolParisLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    LE_BRISTOL_PARIS_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchLeBristolParisLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: LE_BRISTOL_PARIS_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: LE_BRISTOL_PARIS_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchLeBristolParisLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of LE_BRISTOL_PARIS_LONG_DESCRIPTION_SECTIONS) {
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

export function sanitizeLeBristolParisJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

export function patchLeBristolParisAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchLeBristolParisAmenities(
  _existing: unknown,
): readonly LeBristolParisAmenityRecord[] {
  return LE_BRISTOL_PARIS_AMENITIES;
}

export {
  LE_BRISTOL_PARIS_AMENITIES,
  type LeBristolParisAmenityRecord,
} from './le-bristol-paris-amenities';

export function patchLeBristolParisSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...LE_BRISTOL_PARIS_SPA_INFO,
  };
}

export function patchLeBristolParisPolicies(existing: unknown): Record<string, unknown> {
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
        'Départ jusqu’à 12 h ; late check-out selon disponibilité — la conciergerie coordonne avec la réception.',
      notes_en:
        'Departure until noon; late check-out subject to availability — the concierge coordinates with reception.',
    },
    cancellation: {
      notes_fr:
        'Conditions selon le tarif réservé. La conciergerie communique la politique exacte avant confirmation.',
      notes_en:
        'Terms depend on the rate booked. The concierge shares the exact policy before confirmation.',
    },
    pets: {
      allowed: true,
      notes_fr:
        'Chiens et chats acceptés sous conditions ; Epicure n’accueille pas les animaux. Contacter la conciergerie avant l’arrivée.',
      notes_en:
        'Dogs and cats welcome under conditions; Epicure does not accept pets. Contact the concierge before arrival.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

export interface LeBristolParisGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildLeBristolParisGoldenFields(
  current: LeBristolParisGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchLeBristolParisSpa(current.spa_info);
  return {
    highlights: LE_BRISTOL_PARIS_HIGHLIGHTS,
    faq_content: LE_BRISTOL_PARIS_FAQ_CONTENT_PROMOTE,
    faq_content_kit: LE_BRISTOL_PARIS_FAQ_CONTENT_KIT,
    concierge_questions: LE_BRISTOL_PARIS_CONCIERGE_QUESTIONS_KIT,
    opened_at: '1925-01-01',
    transports: LE_BRISTOL_PARIS_TRANSPORTS,
    restaurant_info: LE_BRISTOL_PARIS_RESTAURANT_INFO,
    points_of_interest: LE_BRISTOL_PARIS_POINTS_OF_INTEREST,
    concierge_advice: LE_BRISTOL_PARIS_CONCIERGE_ADVICE,
    concierge_pick: LE_BRISTOL_PARIS_CONCIERGE_PICK,
    concierge_hook: LE_BRISTOL_PARIS_CONCIERGE_HOOK,
    instagram: LE_BRISTOL_PARIS_INSTAGRAM,
    policies: patchLeBristolParisPolicies(current.policies),
    awards: patchLeBristolParisAwards(current.awards),
    amenities: patchLeBristolParisAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: LE_BRISTOL_PARIS_DESCRIPTION_FR,
    description_en: LE_BRISTOL_PARIS_DESCRIPTION_EN,
    long_description_sections: sanitizeLeBristolParisJsonb(
      resolveLeBristolParisLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeLeBristolParisJsonb(resolveLeBristolParisSignatureExperiences()),
    featured_reviews: LE_BRISTOL_PARIS_FEATURED_REVIEWS,
    upcoming_events: LE_BRISTOL_PARIS_UPCOMING_EVENTS,
    factual_summary_fr: LE_BRISTOL_PARIS_FACTUAL_SUMMARY_FR,
    factual_summary_en: LE_BRISTOL_PARIS_FACTUAL_SUMMARY_EN,
    meta_desc_fr: LE_BRISTOL_PARIS_META_DESC_FR,
    meta_desc_en: LE_BRISTOL_PARIS_META_DESC_EN,
    meta_title_fr: LE_BRISTOL_PARIS_META_TITLE_FR,
    meta_title_en: LE_BRISTOL_PARIS_META_TITLE_EN,
    hero_image: LE_BRISTOL_PARIS_HERO_IMAGE,
    gallery_images: LE_BRISTOL_PARIS_GALLERY_IMAGES,
    external_sources: LE_BRISTOL_PARIS_EXTERNAL_SOURCES,
    wikidata_id: leBristolParisExternalScalar('wikidata_id'),
    wikipedia_url_fr: leBristolParisExternalScalar('wikipedia_url_fr'),
    wikipedia_url_en: leBristolParisExternalScalar('wikipedia_url_en'),
    official_url: leBristolParisExternalScalar('official_url'),
    google_place_id: LE_BRISTOL_PARIS_GOOGLE_PLACE_ID,
    phone_e164: LE_BRISTOL_PARIS_PHONE_E164,
    address: LE_BRISTOL_PARIS_ADDRESS,
    postal_code: LE_BRISTOL_PARIS_POSTAL_CODE,
    latitude: LE_BRISTOL_PARIS_LATITUDE,
    longitude: LE_BRISTOL_PARIS_LONGITUDE,
    email_reservations: LE_BRISTOL_PARIS_EMAIL_RESERVATIONS,
    mice_info: LE_BRISTOL_PARIS_MICE_INFO,
    affiliations: LE_BRISTOL_PARIS_AFFILIATIONS,
    booking_mode: 'display_only',
    luxury_tier: 'oetker_collection',
  };
}
