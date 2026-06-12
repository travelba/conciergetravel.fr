/**
 * Shangri-La Paris "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override (local sandbox) and the
 * catalogue promotion script (`@mch/editorial-pilot`).
 *
 * Facts sourced from the official Shangri-La Paris site (shangri-la.com/paris),
 * Michelin Guide, Forbes Travel Guide, Wikidata Q3481407 and Atout France
 * Palace distinction (2014). Figures not confidently sourced are omitted.
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import { SHANGRI_LA_PARIS_CONCIERGE_QUESTIONS_KIT } from './shangri-la-paris-concierge-questions';
import {
  SHANGRI_LA_PARIS_GALLERY_IMAGES,
  SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
  SHANGRI_LA_PARIS_HERO_IMAGE,
} from './shangri-la-paris-gallery';
import { attachKitGallerySourceUrls } from './kit-gallery-promote';
import { buildKitWaveFaqKit, buildKitWaveFaqPromote } from './kit-wave-faq-seed';

export const SHANGRI_LA_PARIS_PROMOTE_SLUG = 'shangri-la-paris';

/** Cloudinary folder prefix for Shangri-La Paris kit / golden assets. */
export const SHANGRI_LA_PARIS_IMAGE_PREFIX = 'cct/hotels/shangri-la-paris';

/** Dedicated POI card asset — never reuse hotel gallery `press-*`. */
export function shangriLaParisPoiImage(poiSlug: string): string {
  return `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/poi-${poiSlug}`;
}

const FNB_PHONE_DISPLAY = '+33 1 53 67 19 98';

export const SHANGRI_LA_PARIS_PHONE_E164 = '+33153671998';
export const SHANGRI_LA_PARIS_ADDRESS = "10 avenue d'Iéna";
export const SHANGRI_LA_PARIS_POSTAL_CODE = '75116';
export const SHANGRI_LA_PARIS_LATITUDE = 48.863922;
export const SHANGRI_LA_PARIS_LONGITUDE = 2.293397;

// ---------------------------------------------------------------------------
// restaurant_info.venues — 6 official F&B outlets (CDC D7)
// ---------------------------------------------------------------------------

export const SHANGRI_LA_PARIS_RESTAURANT_INFO = {
  count: 6,
  michelin_stars: 1,
  venues: [
    {
      name: 'Shang Palace',
      type_fr: 'Gastronomie cantonaise · 1 étoile MICHELIN · Chef Tony Xu',
      type_en: 'Cantonese fine dining · 1 MICHELIN Star · Chef Tony Xu',
      chef: 'Tony Xu',
      features: ['Dim sum', 'Salons privés Tang & Qing Ming', 'Atelier dim sum'],
      hours_fr: 'Déjeuner et dîner sur réservation (horaires selon service)',
      hours_en: 'Lunch and dinner by reservation (hours per service)',
      description_fr:
        'Seule table chinoise étoilée MICHELIN de France, au cœur du palace. Tony Xu et sa brigade cantonaise proposent haute gastronomie chinoise, dim sum et menus dégustation.',
      description_en:
        'France’s only MICHELIN-starred Chinese table, at the heart of the palace. Tony Xu and his Cantonese brigade serve haute Chinese cuisine, dim sum and tasting menus.',
      website: 'https://www.shangpalaceparis.com/',
      reservation_url: 'https://www.shangpalaceparis.com/',
      phone: '+33 6 61 86 56 86',
      price_note_fr: 'Menus dégustation · à la carte',
      price_note_en: 'Tasting menus · à la carte',
      tip_fr:
        'Mon conseil : pour un week-end, réservez deux semaines à l’avance. Demandez le salon Qing Ming pour un dîner privé jusqu’à vingt-quatre convives.',
      tip_en:
        'My tip: for a weekend, book two weeks ahead. Ask for Qing Ming salon for a private dinner for up to twenty-four guests.',
    },
    {
      name: 'La Bauhinia',
      type_fr: 'Restaurant sous verrière · Cuisine française & asiatique',
      type_en: 'Cupola restaurant · French & Asian cuisine',
      chef: 'Simon Havage & Timothy Lam',
      features: ['Verrière XIXe', 'Petit-déjeuner', 'Privatisation'],
      hours_fr: 'Petit-déjeuner, déjeuner et dîner tous les jours',
      hours_en: 'Breakfast, lunch and dinner daily',
      description_fr:
        'Sous la verrière inspirée des jardins d’hiver, La Bauhinia mêle cuisine française et asiatique — petit-déjeuner, déjeuner et dîners sur mesure.',
      description_en:
        'Under the winter-garden-inspired cupola, La Bauhinia blends French and Asian cuisine — breakfast, lunch and bespoke dinners.',
      website: 'https://www.shangri-la.com/paris/shangrila/dining/restaurants/la-bauhinia/',
      reservation_url: 'https://www.shangri-la.com/paris/shangrila/dining/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'À la carte · menus dégustation sur demande',
      price_note_en: 'À la carte · tasting menus on request',
      tip_fr:
        'Mon conseil : réservez le petit-déjeuner sous la verrière un matin ensoleillé — la lumière naturelle vaut le réveil matinal.',
      tip_en:
        'My tip: book breakfast under the cupola on a sunny morning — the natural light rewards the early start.',
    },
    {
      name: 'Le Bar Botaniste',
      type_fr: 'Bar cocktails · Ambiance tente napoléonienne',
      type_en: 'Cocktail bar · Napoleonic tent atmosphere',
      features: ['Cocktails botaniques', 'Spiritueux rares', 'Forbes Star Bar 2025'],
      hours_fr: 'Soirée · 18h–01h (horaires variables)',
      hours_en: 'Evenings · 6 pm–1 am (hours vary)',
      description_fr:
        'Le Bar Botaniste revisite la passion botanique du prince Roland Bonaparte avec cocktails botaniques et spiritueux rares dans une ambiance tente d’époque.',
      description_en:
        'Le Bar Botaniste revisits Prince Roland Bonaparte’s botanical passion with botanical cocktails and rare spirits in a period tent mood.',
      website: 'https://www.shangri-la.com/paris/shangrila/dining/bars/le-bar-botaniste/',
      reservation_url: 'https://www.shangri-la.com/paris/shangrila/dining/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : arrivez vers 19 h pour le comptoir — l’ambiance botanique se lit mieux avant l’affluence du dîner.',
      tip_en:
        'My tip: arrive around 7 pm for the counter — the botanical mood reads best before dinner crowds.',
    },
    {
      name: 'Les Salons du Prince',
      type_fr: 'Salons historiques · Cuisine traditionnelle',
      type_en: 'Historic salons · Traditional cuisine',
      features: ['Salons classés', 'Réceptions privées', 'Patrimoine Palais d’Iéna'],
      hours_fr: 'Sur réservation · déjeuner et dîner privés',
      hours_en: 'By reservation · private lunch and dinner',
      description_fr:
        'Les salons d’apparat du prince Roland Bonaparte accueillent déjeuners et dîners privés dans le cadre historique du Palais d’Iéna.',
      description_en:
        'Prince Roland Bonaparte’s reception salons host private lunches and dinners in the historic Palais d’Iéna setting.',
      website: 'https://www.shangri-la.com/paris/shangrila/dining/',
      reservation_url: 'https://www.shangri-la.com/paris/shangrila/dining/',
      phone: FNB_PHONE_DISPLAY,
      tip_fr:
        'Mon conseil : pour une réception intime, demandez le salon avec vue jardin — le calme du palace y est maximal.',
      tip_en:
        'My tip: for an intimate reception, ask for the garden-view salon — palace calm is at its peak there.',
    },
    {
      name: 'Maison Roland',
      type_fr: 'Bistrot parisien · Cuisine de brasserie',
      type_en: 'Parisian bistro · Brasserie cuisine',
      features: ['Bistrot', 'Cuisine française', 'Ambiance décontractée'],
      hours_fr: 'Déjeuner et dîner selon service',
      hours_en: 'Lunch and dinner per service',
      description_fr:
        'Maison Roland ancre le palace dans la brasserie parisienne : assiettes généreuses et ambiance bistrot au cœur du Palais d’Iéna.',
      description_en:
        'Maison Roland anchors the palace in the Parisian brasserie: generous plates and bistro mood at the heart of the Palais d’Iéna.',
      website: 'https://www.shangri-la.com/paris/shangrila/dining/',
      reservation_url: 'https://www.shangri-la.com/paris/shangrila/dining/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'À la carte bistrot',
      price_note_en: 'Bistro à la carte',
      tip_fr:
        'Mon conseil : idéal pour un déjeuner informel entre deux visites au Trocadéro — réservez en semaine pour le calme.',
      tip_en:
        'My tip: ideal for an informal lunch between Trocadéro visits — book on a weekday for calm.',
    },
    {
      name: 'Les Lounges',
      type_fr: 'Salon pâtisserie · Thé & champagne',
      type_en: 'Pastry lounge · Tea & champagne',
      features: ['Pâtisseries fines', 'Champagne', 'Afternoon tea'],
      hours_fr: 'Après-midi et soirée selon programme',
      hours_en: 'Afternoon and evening per schedule',
      description_fr:
        'Les Lounges servent pâtisseries d’exception, thés rares et champagne dans l’intimité des salons du palace.',
      description_en:
        'Les Lounges serve exceptional pastries, rare teas and champagne in the intimacy of the palace salons.',
      website: 'https://www.shangri-la.com/paris/shangrila/dining/',
      reservation_url: 'https://www.shangri-la.com/paris/shangrila/dining/',
      phone: FNB_PHONE_DISPLAY,
      tip_fr:
        'Mon conseil : l’after-noon tea se réserve le week-end — demandez une table près de la verrière si La Bauhinia est ouverte.',
      tip_en:
        'My tip: afternoon tea books up on weekends — ask for a table near the cupola when La Bauhinia is open.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — 18 curated POIs (visit / do / shop), 16e & Trocadéro
// ---------------------------------------------------------------------------

export const SHANGRI_LA_PARIS_POINTS_OF_INTEREST = [
  {
    name: 'Tour Eiffel & esplanade du Trocadéro',
    name_en: 'Eiffel Tower & Trocadéro esplanade',
    type: 'monument',
    category_fr: 'Monument emblématique',
    category_en: 'Emblematic monument',
    distance_meters: 450,
    walk_minutes: 6,
    latitude: 48.8584,
    longitude: 2.2945,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('tour-eiffel-trocadero'),
    description_fr:
      'Depuis le Trocadéro, la Tour Eiffel se dévoile dans l’axe le plus photographié de Paris — six minutes à pied depuis l’avenue d’Iéna.',
    description_en:
      'From Trocadéro, the Eiffel Tower unfolds on Paris’s most photographed axis — six minutes on foot from Avenue d’Iéna.',
    website: 'https://www.toureiffel.paris/',
    address: 'Place du Trocadéro, 75116 Paris',
    tip_fr:
      'Mon conseil : traversez le pont de l’Alma au crépuscule — la Tour s’illumine pendant la promenade.',
    tip_en: 'My tip: cross Pont de l’Alma at dusk — the Tower lights up during the walk.',
  },
  {
    name: 'Musée Guimet',
    name_en: 'Musée Guimet',
    type: 'museum',
    category_fr: 'Art asiatique',
    category_en: 'Asian art',
    distance_meters: 134,
    walk_minutes: 2,
    latitude: 48.8653,
    longitude: 2.2938,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('musee-guimet'),
    description_fr:
      'Plus vaste collection d’art asiatique d’Europe : deux minutes à pied depuis le palace, dialogue naturel avec Shang Palace.',
    description_en:
      'Europe’s largest Asian art collection: two minutes on foot from the palace, a natural dialogue with Shang Palace.',
    website: 'https://www.guimet.fr/',
    address: '6 Place d’Iéna, 75116 Paris',
    hours_fr: 'Mer–lun 10h–18h (fermé mar)',
    hours_en: 'Wed–Mon 10 am–6 pm (closed Tue)',
    price_note_fr: 'Collections permanentes payantes · nocturnes ponctuelles',
    price_note_en: 'Paid permanent collections · occasional late openings',
    tip_fr:
      'Mon conseil : visitez le matin avant le déjeuner — les salles sont au calme et le parcours se enchaîne avec le palace.',
    tip_en:
      'My tip: visit in the morning before lunch — galleries are quiet and the route pairs naturally with the palace.',
  },
  {
    name: 'Palais de Tokyo',
    name_en: 'Palais de Tokyo',
    type: 'museum',
    category_fr: 'Art contemporain',
    category_en: 'Contemporary art',
    distance_meters: 229,
    walk_minutes: 3,
    latitude: 48.864242,
    longitude: 2.297636,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('palais-de-tokyo'),
    description_fr:
      'Plus grand centre d’art contemporain d’Europe, ouvert jusqu’à minuit — trois minutes à pied depuis l’hôtel.',
    description_en:
      'Europe’s largest contemporary art centre, open until midnight — three minutes on foot from the hotel.',
    website: 'https://www.palaisdetokyo.com/',
    address: '13 Avenue du Président Wilson, 75116 Paris',
    hours_fr: 'Mer–lun 12h–minuit (fermé mar)',
    hours_en: 'Wed–Mon noon–midnight (closed Tue)',
    tip_fr:
      'Mon conseil : allez en nocturne après 20 h — les expositions gagnent en densité quand le public se raréfie.',
    tip_en: 'My tip: go after 8 pm — exhibitions gain density when the crowd thins.',
  },
  {
    name: 'Musée Yves Saint Laurent Paris',
    name_en: 'Yves Saint Laurent Paris Museum',
    type: 'museum',
    category_fr: 'Musée de la mode',
    category_en: 'Fashion museum',
    distance_meters: 380,
    walk_minutes: 5,
    latitude: 48.868703,
    longitude: 2.303305,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('musee-yves-saint-laurent'),
    description_fr:
      'Ancien hôtel particulier avenue Marceau : atelier reconstitué et collections de haute couture YSL.',
    description_en:
      'Former Avenue Marceau town house: reconstructed studio and YSL haute couture collections.',
    website: 'https://museeyslparis.com/',
    address: '5 Avenue Marceau, 75116 Paris',
    tip_fr:
      'Mon conseil : réservez l’atelier reconstitué en créneau du matin — la lumière nord y est la même qu’à l’époque du couturier.',
    tip_en:
      'My tip: book the reconstructed studio for a morning slot — north light matches the couturier’s era.',
  },
  {
    name: 'Cité de l’architecture et du patrimoine',
    name_en: 'Cité de l’architecture et du patrimoine',
    type: 'museum',
    category_fr: 'Architecture & patrimoine',
    category_en: 'Architecture & heritage',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 48.8648,
    longitude: 2.2955,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('cite-architecture'),
    description_fr:
      'Au Trocadéro, la Cité abrite moulages monumentaux et expositions sur l’architecture — écho au Palais d’Iéna classé.',
    description_en:
      'At Trocadéro, the Cité holds monumental casts and architecture exhibitions — an echo of the listed Palais d’Iéna.',
    website: 'https://www.citechaillot.fr/',
    address: '1 Place du Trocadéro, 75116 Paris',
    tip_fr:
      'Mon conseil : la terrasse du Trocadéro depuis la Cité offre la vue la plus classique sur la Tour Eiffel.',
    tip_en:
      'My tip: the Trocadéro terrace from the Cité offers the most classic Eiffel Tower view.',
  },
  {
    name: 'Cathédrale de la Sainte-Trinité',
    name_en: 'Holy Trinity Cathedral',
    type: 'cathedral',
    category_fr: 'Église orthodoxe russe',
    category_en: 'Russian Orthodox cathedral',
    distance_meters: 520,
    walk_minutes: 7,
    latitude: 48.861908,
    longitude: 2.300888,
    bucket: 'visit',
    image_public_id: shangriLaParisPoiImage('cathedrale-sainte-trinite'),
    description_fr:
      'Cathédrale orthodoxe russe néo-russe (2016), cinq coupoles dorées — sept minutes à pied depuis d’Iéna.',
    description_en:
      'Neo-Russian Orthodox cathedral (2016), five gilded domes — seven minutes on foot from d’Iéna.',
    website: 'https://www.cathedrale-russe.eu/',
    address: '6 Avenue Albert II de Monaco, 75116 Paris',
    tip_fr:
      'Mon conseil : les offices du dimanche matin résonnent sous les coupoles — arrivez dix minutes avant l’ouverture.',
    tip_en:
      'My tip: Sunday morning services resonate under the domes — arrive ten minutes before opening.',
  },
  {
    name: 'Promenade du quai de la Seine',
    name_en: 'Seine riverbank stroll',
    type: 'promenade',
    category_fr: 'Flânerie parisienne',
    category_en: 'Parisian stroll',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 48.8625,
    longitude: 2.292,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('promenade-seine'),
    description_fr:
      'Le quai de la Seine, sous l’avenue d’Iéna, offre une promenade face à la Tour Eiffel et aux péniches.',
    description_en:
      'The Seine quay, below Avenue d’Iéna, offers a walk facing the Eiffel Tower and the houseboats.',
    address: 'Port de la Conférence, 75008 Paris',
    tip_fr:
      'Mon conseil : sortez au lever du jour — la Seine est au calme et la lumière sur la Tour est la plus nette.',
    tip_en: 'My tip: step out at daybreak — the Seine is quiet and light on the Tower is clearest.',
  },
  {
    name: 'Croisière sur la Seine',
    name_en: 'Seine river cruise',
    type: 'cruise',
    category_fr: 'Croisière commentée',
    category_en: 'Sightseeing cruise',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 48.863,
    longitude: 2.308,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('croisiere-seine'),
    description_fr:
      'Embarquement au Port de la Conférence, sous le pont de l’Alma — cinq minutes à pied depuis le palace.',
    description_en:
      'Boarding at Port de la Conférence, below Pont de l’Alma — five minutes on foot from the palace.',
    website: 'https://www.bateauxparisiens.com/',
    address: 'Port de la Conférence, 75008 Paris',
    tip_fr:
      'Mon conseil : embarquez au crépuscule — la Tour Eiffel s’illumine pendant la croisière.',
    tip_en: 'My tip: board at dusk — the Eiffel Tower lights up during the cruise.',
  },
  {
    name: 'Théâtre des Champs-Élysées',
    name_en: 'Théâtre des Champs-Élysées',
    type: 'theatre',
    category_fr: 'Salle de concerts & opéra',
    category_en: 'Concert hall & opera',
    distance_meters: 400,
    walk_minutes: 5,
    latitude: 48.866787,
    longitude: 2.303934,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('theatre-champs-elysees'),
    description_fr:
      'Salle Art Nouveau (1913) avenue Montaigne : programmation classique, jazz et danse.',
    description_en:
      'Art Nouveau hall (1913) on Avenue Montaigne: classical, jazz and dance programming.',
    website: 'https://www.theatrechampselysees.fr/',
    address: '15 Avenue Montaigne, 75008 Paris',
    tip_fr:
      'Mon conseil : vérifiez les répétitions ouvertes — l’acoustique se juge mieux en live qu’en disque.',
    tip_en: 'My tip: check open rehearsals — acoustics are best judged live, not on record.',
  },
  {
    name: 'Musée Marmottan Monet',
    name_en: 'Musée Marmottan Monet',
    type: 'museum',
    category_fr: 'Impressionnisme',
    category_en: 'Impressionism',
    distance_meters: 1200,
    walk_minutes: 15,
    latitude: 48.8595,
    longitude: 2.2672,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('musee-marmottan'),
    description_fr:
      'Plus grande collection de Monet au monde, dans l’ancien hôtel particulier du 16e — quinze minutes en taxi.',
    description_en:
      'World’s largest Monet collection, in a 16th-arrondissement town house — fifteen minutes by taxi.',
    website: 'https://www.marmottan.fr/',
    address: '2 Rue Louis-Boilly, 75016 Paris',
    tip_fr:
      'Mon conseil : réservez le créneau de 10 h — les Nymphéas se visitent dans le calme matinal.',
    tip_en: 'My tip: book the 10 am slot — the Water Lilies are best in morning calm.',
  },
  {
    name: 'Bois de Boulogne',
    name_en: 'Bois de Boulogne',
    type: 'garden',
    category_fr: 'Parc & jardin',
    category_en: 'Park & garden',
    distance_meters: 2500,
    walk_minutes: 30,
    latitude: 48.8625,
    longitude: 2.2498,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('bois-de-boulogne'),
    description_fr:
      'Le Bois de Boulogne, dix minutes en taxi, offre promenades, Jardin d’Acclimatation et calme hors du centre.',
    description_en:
      'Bois de Boulogne, ten minutes by taxi, offers walks, Jardin d’Acclimatation and calm away from the centre.',
    address: 'Bois de Boulogne, 75016 Paris',
    tip_fr: 'Mon conseil : un matin de week-end, avant 10 h — les allées sont presque désertes.',
    tip_en: 'My tip: a weekend morning, before 10 am — the alleys are almost empty.',
  },
  {
    name: 'Le Clarence',
    name_en: 'Le Clarence',
    type: 'restaurant',
    category_fr: 'Table 3 étoiles MICHELIN',
    category_en: '3 MICHELIN Star table',
    distance_meters: 1800,
    walk_minutes: 22,
    latitude: 48.8775,
    longitude: 2.3095,
    bucket: 'do',
    image_public_id: shangriLaParisPoiImage('le-clarence'),
    description_fr:
      'Table trois étoiles MICHELIN d’Arnaud Donckele avenue de Friedland — vingt-deux minutes à pied ou huit en taxi.',
    description_en:
      'Arnaud Donckele’s three-MICHELIN-star table on Avenue de Friedland — twenty-two minutes on foot or eight by taxi.',
    website: 'https://www.leclarence.paris/',
    phone: '+33 1 82 88 80 80',
    tip_fr: 'Mon conseil : réservez le salon du premier étage — le service y est plus intime.',
    tip_en: 'My tip: book the first-floor salon — service is more intimate there.',
  },
  {
    name: 'Avenue Montaigne',
    name_en: 'Avenue Montaigne',
    type: 'shopping',
    category_fr: 'Artère du luxe parisien',
    category_en: 'Paris luxury avenue',
    distance_meters: 800,
    walk_minutes: 10,
    latitude: 48.8665,
    longitude: 2.3045,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('avenue-montaigne'),
    description_fr:
      'Chanel, Dior, Louis Vuitton et haute joaillerie — dix minutes à pied ou cinq en taxi depuis d’Iéna.',
    description_en:
      'Chanel, Dior, Louis Vuitton and high jewellery — ten minutes on foot or five by taxi from d’Iéna.',
    address: 'Avenue Montaigne, 75008 Paris',
    tip_fr:
      'Mon conseil : flânez en semaine vers 11 h — les vitrines se changent et les salons sont plus disponibles.',
    tip_en:
      'My tip: stroll on a weekday around 11 am — windows are being dressed and salons are more available.',
  },
  {
    name: 'Marché de Passy',
    name_en: 'Marché de Passy',
    type: 'market',
    category_fr: 'Marché couvert',
    category_en: 'Covered market',
    distance_meters: 900,
    walk_minutes: 12,
    latitude: 48.8578,
    longitude: 2.2785,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('marche-passy'),
    description_fr:
      'Marché couvert du 16e : fromages, poissonnerie et primeurs — douze minutes en métro depuis Iéna.',
    description_en:
      '16th-arrondissement covered market: cheese, fishmongers and greengrocers — twelve minutes by metro from Iéna.',
    address: 'Rue de l’Annonciation, 75016 Paris',
    hours_fr: 'Mar–dim matin (fermé lun)',
    hours_en: 'Tue–Sun mornings (closed Mon)',
    tip_fr:
      'Mon conseil : allez entre 9 h et 10 h — les étals sont complets et le marché respire encore.',
    tip_en: 'My tip: go between 9 and 10 am — stalls are full and the market still breathes.',
  },
  {
    name: 'Palais Galliera',
    name_en: 'Palais Galliera',
    type: 'museum',
    category_fr: 'Musée de la Mode de Paris',
    category_en: 'Paris Fashion Museum',
    distance_meters: 480,
    walk_minutes: 6,
    latitude: 48.865242,
    longitude: 2.297839,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('palais-galliera'),
    description_fr:
      'Boutique du musée et expositions temporaires avenue Pierre-Ier-de-Serbie — six minutes à pied.',
    description_en:
      'Museum shop and temporary exhibitions on Avenue Pierre 1er de Serbie — six minutes on foot.',
    website: 'https://www.palaisgalliera.paris.fr/',
    address: '10 Avenue Pierre 1er de Serbie, 75116 Paris',
    tip_fr:
      'Mon conseil : la boutique du musée vaut le détour pour des éditions limitées et livres de mode.',
    tip_en: 'My tip: the museum shop is worth the detour for limited editions and fashion books.',
  },
  {
    name: 'Maison Guerlain Champs-Élysées',
    name_en: 'Guerlain Champs-Élysées',
    type: 'store',
    category_fr: 'Maison de parfum historique',
    category_en: 'Historic perfume house',
    distance_meters: 1100,
    walk_minutes: 14,
    latitude: 48.871,
    longitude: 2.303,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('maison-guerlain'),
    description_fr:
      'Temple de la parfumerie au 68 des Champs-Élysées depuis 1914 — atelier de personnalisation et gravure sur flacon.',
    description_en:
      'Perfumery temple at 68 Champs-Élysées since 1914 — personalisation atelier and bottle engraving.',
    website: 'https://www.guerlain.com/',
    address: '68 Avenue des Champs-Élysées, 75008 Paris',
    tip_fr:
      'Mon conseil : demandez une gravure sur flacon — c’est le cadeau le plus net à rapporter du 16e.',
    tip_en: 'My tip: ask for bottle engraving — the clearest gift to bring back from the 16th.',
  },
  {
    name: 'Galeries Lafayette Champs-Élysées',
    name_en: 'Galeries Lafayette Champs-Élysées',
    type: 'store',
    category_fr: 'Concept store',
    category_en: 'Concept store',
    distance_meters: 1200,
    walk_minutes: 15,
    latitude: 48.870445,
    longitude: 2.306291,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('galeries-lafayette-champs-elysees'),
    description_fr:
      'Concept store mode créateur, beauté et rooftop avec vue sur l’Arc de triomphe.',
    description_en: 'Designer fashion, beauty concept store and rooftop with Arc de Triomphe view.',
    website: 'https://haussmann.galerieslafayette.com/champs-elysees',
    address: '60 Avenue des Champs-Élysées, 75008 Paris',
    tip_fr: 'Mon conseil : montez au rooftop avant 18 h — la vue se lit sans la foule du soir.',
    tip_en: 'My tip: head to the rooftop before 6 pm — the view comes without the evening crowd.',
  },
  {
    name: 'Galerie Dior',
    name_en: 'La Galerie Dior',
    type: 'store',
    category_fr: 'Musée de la couture Dior',
    category_en: 'Dior couture museum',
    distance_meters: 700,
    walk_minutes: 9,
    latitude: 48.8669,
    longitude: 2.3038,
    bucket: 'shop',
    image_public_id: shangriLaParisPoiImage('galerie-dior'),
    description_fr:
      'Parcours immersif Dior avenue Montaigne : haute couture de 1947 à aujourd’hui.',
    description_en: 'Immersive Dior journey on Avenue Montaigne: haute couture from 1947 to today.',
    website: 'https://www.dior.com/',
    address: '11 Rue François 1er, 75008 Paris',
    tip_fr: 'Mon conseil : réservez le créneau de 10 h — la galerie se parcourt dans le calme.',
    tip_en: 'My tip: book the 10 am slot — you tour the gallery in calm.',
  },
] as const;

// ---------------------------------------------------------------------------
// concierge_advice + concierge_pick + concierge_hook
// ---------------------------------------------------------------------------

export const SHANGRI_LA_PARIS_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez une Terrace Eiffel View Room au 5e ou 6e étage côté Seine. La perspective sur la Tour se lit sans obstruer depuis le balcon privatif. Le rituel que je recommande : petit-déjeuner en chambre vers 8 h, puis quelques longueurs à la piscine du CHI Spa avant un déjeuner à La Bauhinia. Précisez votre heure d’arrivée — la conciergerie note la catégorie et la préparation en chambre.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for a Terrace Eiffel View Room on the 5th or 6th floor Seine side. The Tower perspective reads clearly from the private balcony. The ritual I recommend: in-room breakfast around 8 am, then a few laps in the CHI Spa pool before lunch at La Bauhinia. Share your arrival time — the concierge desk notes the category and in-room setup.',
  },
} as const;

export const SHANGRI_LA_PARIS_CONCIERGE_PICK_SLUG = 'terrace-eiffel-view-room';

export const SHANGRI_LA_PARIS_CONCIERGE_PICK_NOTE = {
  fr: 'Balcon privatif face à la Tour Eiffel — la chambre que je bloque en premier pour une première venue au Palais d’Iéna.',
  en: 'Private balcony facing the Eiffel Tower — the room I hold first for a first stay at the Palais d’Iéna.',
} as const;

export const SHANGRI_LA_PARIS_CONCIERGE_PICK = {
  slug: SHANGRI_LA_PARIS_CONCIERGE_PICK_SLUG,
  note: SHANGRI_LA_PARIS_CONCIERGE_PICK_NOTE,
} as const;

export const SHANGRI_LA_PARIS_CONCIERGE_HOOK = {
  fr: 'Palace du Palais d’Iéna, distinction Atout France : cent chambres dont trente-sept suites, Shang Palace étoilé MICHELIN et vue Tour Eiffel depuis le 16e.',
  en: 'Palace in the Palais d’Iéna, Atout France distinction: one hundred rooms including thirty-seven suites, MICHELIN-starred Shang Palace and Eiffel Tower views from the 16th.',
} as const;

export const SHANGRI_LA_PARIS_FACTUAL_SUMMARY_FR =
  'Palace avenue d’Iéna, ex-Palais d’Iéna : 100 chambres, Shang Palace 1 étoile MICHELIN, CHI Spa avec piscine 17 m et vue Tour Eiffel.';
export const SHANGRI_LA_PARIS_FACTUAL_SUMMARY_EN =
  'Palace on Avenue d’Iéna, former Palais d’Iéna: 100 rooms, 1-MICHELIN-star Shang Palace, CHI Spa with 17 m pool and Eiffel Tower views.';

export const SHANGRI_LA_PARIS_DESCRIPTION_FR =
  'En poussant les portes du Palais d’Iéna, on entre dans l’hôtel particulier du prince Roland Bonaparte, métamorphosé en palace en 2010. Moulures, fresques et escaliers d’honneur dialoguent avec cent chambres et trente-sept suites aux volumes généreux — une rareté parisienne.\n\nLa conciergerie anticipe sans envahir : transfert depuis Roissy, table au Shang Palace, visite privée du patrimoine. C’est l’essence d’un séjour au 16e : la Tour Eiffel depuis les terrasses, la Seine à trois minutes, le Trocadéro au bout de l’avenue d’Iéna. Shang Palace et La Bauhinia ancrent la maison dans un dialogue franco-asiatique unique à Paris.';
export const SHANGRI_LA_PARIS_DESCRIPTION_EN =
  'Through the doors of the Palais d’Iéna, you enter Prince Roland Bonaparte’s town house, transformed into a palace in 2010. Mouldings, frescoes and grand staircases dialogue with one hundred rooms and thirty-seven suites at generous volumes — a Parisian rarity.\n\nThe concierge anticipates without intruding: transfer from Roissy, a table at Shang Palace, a private heritage tour. That is the essence of a 16th-arrondissement stay: the Eiffel Tower from the terraces, the Seine three minutes away, Trocadéro at the end of Avenue d’Iéna. Shang Palace and La Bauhinia anchor the house in a Franco-Asian dialogue unique in Paris.';

export const SHANGRI_LA_PARIS_META_DESC_FR =
  'Shangri-La Paris, palace du Palais d’Iéna : Shang Palace étoilé, La Bauhinia, CHI Spa et vue Tour Eiffel. Métro Iéna, Trocadéro.';
export const SHANGRI_LA_PARIS_META_DESC_EN =
  'Shangri-La Paris, Palais d’Iéna palace: starred Shang Palace, La Bauhinia, CHI Spa and Eiffel Tower view. Iéna metro, Trocadéro.';

export const SHANGRI_LA_PARIS_META_TITLE_FR =
  'Shangri-La Paris — Palace Palais d’Iéna | MyConciergeHotel';
export const SHANGRI_LA_PARIS_META_TITLE_EN =
  'Shangri-La Paris — Palais d’Iéna Palace | MyConciergeHotel';

export const SHANGRI_LA_PARIS_EMAIL_RESERVATIONS = 'slpr.reservations@shangri-la.com';

export const SHANGRI_LA_PARIS_AFFILIATIONS = [
  {
    kind: 'brand',
    source: 'shangri_la',
    display_name: 'Shangri-La Hotels & Resorts',
    verified: true,
    facet_slug: 'shangri-la',
    source_url: 'https://www.shangri-la.com/paris/shangrila/',
    since_year: 2010,
  },
  {
    kind: 'label',
    source: 'atout_france_palace',
    display_name: 'Distinction Palace — Atout France (2014)',
    verified: true,
    facet_slug: 'palace-atout-france',
    source_url: 'https://palace.atout-france.fr/',
    since_year: 2014,
  },
  {
    kind: 'label',
    source: 'forbes_5_star',
    display_name: 'Forbes Travel Guide Five-Star',
    verified: true,
    facet_slug: 'forbes-5-star',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/shangri-la-paris',
  },
] as const;

export const SHANGRI_LA_PARIS_HOTEL_DISPLAY_NAME = 'Shangri-La Paris';

export const SHANGRI_LA_PARIS_HIGHLIGHTS = [
  {
    label_fr: 'Palace du Palais d’Iéna — distinction Atout France depuis 2014',
    label_en: 'Palais d’Iéna palace — Atout France distinction since 2014',
  },
  {
    label_fr:
      '100 chambres dont 37 suites — 40 % des chambres et 60 % des suites avec vue Tour Eiffel',
    label_en:
      '100 rooms including 37 suites — 40% of rooms and 60% of suites with Eiffel Tower view',
  },
  {
    label_fr: 'Shang Palace — seule table chinoise étoilée MICHELIN de France, chef Tony Xu',
    label_en: 'Shang Palace — France’s only MICHELIN-starred Chinese table, Chef Tony Xu',
  },
  {
    label_fr: 'La Bauhinia sous verrière — cuisine française & asiatique',
    label_en: 'La Bauhinia under its cupola — French & Asian cuisine',
  },
  {
    label_fr: 'CHI, The Spa — piscine intérieure 17 m, hammam et fitness',
    label_en: 'CHI, The Spa — 17 m indoor pool, hammam and fitness',
  },
  {
    label_fr: 'Le Bar Botaniste — cocktails botaniques, Forbes Star Bar 2025',
    label_en: 'Le Bar Botaniste — botanical cocktails, Forbes Star Bar 2025',
  },
] as const;

export {
  SHANGRI_LA_PARIS_CONCIERGE_QUESTIONS_KIT,
  type ShangriLaParisConciergeQuestionKit,
} from './shangri-la-paris-concierge-questions';

export const SHANGRI_LA_PARIS_SPA_INFO = {
  name: 'CHI, The Spa at Shangri-La Paris',
  treatment_rooms: 4,
  has_pool: true,
  pool_type: 'indoor',
  pool_length_m: 17,
  surface_m2: 94,
  description_fr:
    'CHI, The Spa conjugue rituels asiatiques et soins occidentaux dans l’ancien Palais d’Iéna. Piscine intérieure de 17 m baignée de lumière naturelle, hammam, salle de fitness et cabines de soin sur rendez-vous.',
  description_en:
    'CHI, The Spa blends Asian rituals and Western treatments in the former Palais d’Iéna. A 17-metre indoor pool flooded with natural light, hammam, fitness room and treatment cabins by appointment.',
  hours_fr: 'Tous les jours 9h–21h (soins sur rendez-vous)',
  hours_en: 'Daily 9 am–9 pm (treatments by appointment)',
  price_note_fr: 'Soins sur rendez-vous — tarifs selon le rituel choisi.',
  price_note_en: 'Treatments by appointment — rates depend on the ritual selected.',
  website: 'https://www.shangri-la.com/paris/shangrila/wellness/chi-the-spa/',
  phone: SHANGRI_LA_PARIS_PHONE_E164,
  tip_fr:
    'Mon conseil : réservez le rituel Prince Bonaparte en fin d’après-midi, puis quelques longueurs au bassin avant le dîner au Shang Palace.',
  tip_en:
    'My tip: book the Prince Bonaparte ritual in the late afternoon, then a few laps in the pool before dinner at Shang Palace.',
} as const;

export const SHANGRI_LA_PARIS_MICE_INFO = {
  summary_fr:
    'Salons classés du Palais d’Iéna jusqu’à 280 convives en réception : mariages, galas, boardrooms et cocktails au cœur du 16e.',
  summary_en:
    'Listed Palais d’Iéna salons for up to 280 guests in reception format: weddings, galas, boardrooms and cocktails in the heart of the 16th.',
  contact_email: SHANGRI_LA_PARIS_EMAIL_RESERVATIONS,
  total_capacity_seated: 280,
  spaces: [
    {
      key: 'salon-honneur',
      name: 'Salon d’Honneur',
      max_seated: 280,
      configurations: ['reception', 'theatre', 'dinner', 'cocktail'],
      has_natural_light: true,
      notes_fr: 'Plus grand salon historique — réception 280, dîner 120.',
      notes_en: 'Largest historic salon — reception 280, dinner 120.',
    },
    {
      key: 'salon-bonaparte',
      name: 'Salon Bonaparte',
      max_seated: 80,
      configurations: ['reception', 'boardroom', 'dinner'],
      has_natural_light: true,
      notes_fr: 'Salon intermédiaire pour séminaires et dîners privés.',
      notes_en: 'Mid-size salon for seminars and private dinners.',
    },
    {
      key: 'salon-intime',
      name: 'Salon Intime',
      max_seated: 24,
      configurations: ['boardroom', 'dinner'],
      has_natural_light: true,
      notes_fr: 'Boardroom pour vingt-quatre personnes maximum.',
      notes_en: 'Boardroom for up to twenty-four guests.',
    },
  ],
  event_types: ['wedding', 'corporate-meeting', 'cocktail', 'private-dinner', 'product-launch'],
} as const;

export const SHANGRI_LA_PARIS_UPCOMING_EVENTS = [
  {
    name: 'Feux d’artifice du 14 juillet',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    venue_name: 'Tour Eiffel & Champ-de-Mars',
    latitude: 48.858,
    longitude: 2.295,
    distance_meters: 600,
    category: 'festival',
    period_fr: '14 juillet',
    period_en: '14 July',
    hours_fr: 'Feu d’artifice vers 23 h',
    hours_en: 'Fireworks around 11 pm',
    description_fr:
      'Depuis les suites côté Tour Eiffel, le feu d’artifice se lit au-dessus de Paris — six minutes à pied du Trocadéro.',
    description_en:
      'From Eiffel-side suites, the fireworks unfold above Paris — six minutes on foot to Trocadéro.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-21`,
  },
  {
    name: 'Roland-Garros — Internationaux de France',
    start_date: '2026-05-24',
    end_date: '2026-06-07',
    venue_name: 'Stade Roland-Garros',
    latitude: 48.847,
    longitude: 2.249,
    distance_meters: 3500,
    category: 'sport',
    period_fr: 'Fin mai – début juin',
    period_en: 'Late May – early June',
    description_fr:
      'Le tournoi du Grand Chelem se rejoint en quinze minutes en taxi — la conciergerie réserve billets et transferts.',
    description_en:
      'The Grand Slam tournament is fifteen minutes by taxi — the concierge books tickets and transfers.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-19`,
  },
  {
    name: 'Nuit Blanche — parcours d’art contemporain',
    start_date: '2026-10-03',
    end_date: '2026-10-04',
    venue_name: 'Paris 16e',
    latitude: 48.864,
    longitude: 2.297,
    distance_meters: 229,
    category: 'culture',
    period_fr: 'Premier week-end d’octobre',
    period_en: 'First October weekend',
    description_fr:
      'Installations nocturnes au Palais de Tokyo — trois minutes à pied depuis le palace pour commencer le parcours.',
    description_en:
      'Night-time installations at Palais de Tokyo — three minutes on foot from the palace to start the route.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-4`,
  },
  {
    name: 'Paris Fashion Week — défilés avenue Montaigne',
    start_date: '2026-09-22',
    end_date: '2026-09-30',
    venue_name: 'Avenue Montaigne',
    latitude: 48.8665,
    longitude: 2.3045,
    distance_meters: 800,
    category: 'fashion',
    period_fr: 'Fin septembre',
    period_en: 'Late September',
    description_fr:
      'Semaine de la mode : les maisons de couture ouvrent leurs salons à dix minutes à pied ou cinq en taxi.',
    description_en:
      'Fashion Week: couture houses open their salons ten minutes on foot or five by taxi.',
    pricing: { type: 'invitation', amount_eur: null },
    image_url: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-22`,
  },
] as const;

export const SHANGRI_LA_PARIS_INSTAGRAM = {
  handle: 'shangrilaparis',
  profile_url: 'https://www.instagram.com/shangrilaparis/',
  posts: [
    {
      permalink: 'https://www.instagram.com/shangrilaparis/',
      image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-19`,
      caption_fr:
        'Vue Tour Eiffel depuis les suites du Palais d’Iéna — le tableau parisien au réveil.',
      caption_en:
        'Eiffel Tower view from the Palais d’Iéna suites — the Parisian tableau at daybreak.',
    },
    {
      permalink: 'https://www.instagram.com/shangrilaparis/',
      image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-10`,
      caption_fr:
        'Shang Palace, seule table chinoise étoilée MICHELIN de France — dim sum et haute gastronomie cantonaise.',
      caption_en:
        'Shang Palace, France’s only MICHELIN-starred Chinese table — dim sum and Cantonese haute cuisine.',
    },
    {
      permalink: 'https://www.instagram.com/shangrilaparis/',
      image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-16`,
      caption_fr:
        'Piscine intérieure de 17 m du CHI Spa — lumière naturelle et terrasse végétalisée.',
      caption_en: 'CHI Spa’s 17-metre indoor pool — natural light and landscaped terrace.',
    },
    {
      permalink: 'https://www.instagram.com/shangrilaparis/',
      image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-11`,
      caption_fr:
        'La Bauhinia sous sa verrière — petit-déjeuner et dîners franco-asiatiques au cœur du palace.',
      caption_en:
        'La Bauhinia under its cupola — Franco-Asian breakfasts and dinners at the heart of the palace.',
    },
  ],
} as const;

export const SHANGRI_LA_PARIS_FEATURED_REVIEWS = [
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/shangri-la-paris',
    quote_fr:
      'Palace parisien dans l’ancien Palais d’Iéna : suites avec vue Tour Eiffel, Shang Palace étoilé et CHI Spa avec piscine intérieure.',
    quote_en:
      'Parisian palace in the former Palais d’Iéna: suites with Eiffel Tower views, starred Shang Palace and CHI Spa with indoor pool.',
  },
  {
    source: 'MICHELIN Hotels',
    author: 'MICHELIN Hotels',
    source_url: 'https://guide.michelin.com/fr/fr/hotels-stays/paris/shangrila-hotel-paris-5455',
    quote_fr:
      'Seul palace parisien mêlant héritage historique et double culture culinaire franco-asiatique.',
    quote_en:
      'The only Parisian palace blending historic heritage with Franco-Asian dual culinary culture.',
  },
  {
    source: 'Presse spécialisée',
    author: 'Presse spécialisée',
    quote_fr:
      'Depuis 2010, le Shangri-La Paris habite le Palais d’Iéna avec une des vues Tour Eiffel les plus nettes du 16e arrondissement.',
    quote_en:
      'Since 2010, Shangri-La Paris inhabits the Palais d’Iéna with one of the clearest Eiffel Tower views in the 16th arrondissement.',
  },
] as const;

export const SHANGRI_LA_PARIS_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q3481407',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q3481407',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Shangri-La_Hotel_Paris',
    source: 'wikipedia',
    source_url: 'https://fr.wikipedia.org/wiki/Shangri-La_Hotel_Paris',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/Shangri-La_Hotel,_Paris',
    source: 'wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Shangri-La_Hotel,_Paris',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'https://www.shangri-la.com/paris/shangrila/',
    source: 'official',
    source_url: 'https://www.shangri-la.com/paris/shangrila/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 2010,
    source: 'official',
    source_url: 'https://www.shangri-la.com/paris/shangrila/about/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type ShangriLaParisExternalScalarField =
  | 'wikidata_id'
  | 'wikipedia_url_fr'
  | 'wikipedia_url_en'
  | 'official_url';

function shangriLaParisExternalScalar(field: ShangriLaParisExternalScalarField): string {
  const entry = SHANGRI_LA_PARIS_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

export const SHANGRI_LA_PARIS_SIGNATURE_EXPERIENCES = [
  {
    key: 'atelier-dim-sum',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-10`,
    title_fr: 'Atelier dim sum au Shang Palace',
    title_en: 'Dim sum workshop at Shang Palace',
    description_fr:
      'Atelier exclusif avec l’équipe du Shang Palace : confectionnez vos dim sum puis dégustez-les avec un thé choisi par le sommelier.',
    description_en:
      'Exclusive workshop with the Shang Palace team: craft your dim sum then taste them with tea selected by the sommelier.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://www.shangpalaceparis.com/',
  },
  {
    key: 'rituel-prince-bonaparte',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-13`,
    title_fr: 'Rituel Prince Bonaparte au CHI Spa',
    title_en: 'Prince Bonaparte ritual at CHI Spa',
    description_fr:
      'Soin du visage et massage corporel au CHI Spa, conclu par une infusion maison au bord de la piscine intérieure.',
    description_en:
      'Facial and body massage at CHI Spa, concluding with a house herbal tea by the indoor pool.',
    booking_required: true,
    phone: SHANGRI_LA_PARIS_PHONE_E164,
    website: 'https://www.shangri-la.com/paris/shangrila/wellness/chi-the-spa/',
  },
  {
    key: 'diner-verriere-bauhinia',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-11`,
    title_fr: 'Dîner privé sous la verrière La Bauhinia',
    title_en: 'Private dinner under La Bauhinia cupola',
    description_fr:
      'Privatisation de La Bauhinia pour un dîner sur mesure sous la verrière — menu franco-asiatique des chefs Simon Havage et Timothy Lam.',
    description_en:
      'La Bauhinia privatisation for a bespoke dinner under the cupola — Franco-Asian menu by chefs Simon Havage and Timothy Lam.',
    booking_required: true,
    website: 'https://www.shangri-la.com/paris/shangrila/dining/restaurants/la-bauhinia/',
  },
  {
    key: 'visite-patrimoine',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-4`,
    title_fr: 'Visite guidée du patrimoine du Palais d’Iéna',
    title_en: 'Guided tour of Palais d’Iéna heritage',
    description_fr:
      'Parcours privé des salons historiques et de l’histoire de Roland Bonaparte, organisé par la conciergerie sur rendez-vous.',
    description_en:
      'Private tour of historic salons and Roland Bonaparte history, arranged by the concierge by appointment.',
    booking_required: true,
  },
  {
    key: 'petit-dejeuner-vue-eiffel',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-20`,
    title_fr: 'Petit-déjeuner vue Tour Eiffel en terrasse',
    title_en: 'Eiffel Tower view terrace breakfast',
    description_fr:
      'Petit-déjeuner exclusif sur la terrasse des suites signatures, face à la Tour Eiffel — inclus pour certaines catégories suite.',
    description_en:
      'Exclusive breakfast on signature suite terraces, facing the Eiffel Tower — included for certain suite categories.',
    booking_required: false,
  },
  {
    key: 'soiree-chinoise-privee',
    image_public_id: `${SHANGRI_LA_PARIS_IMAGE_PREFIX}/press-22`,
    title_fr: 'Soirée chinoise privée au Shang Palace',
    title_en: 'Private Chinese soirée at Shang Palace',
    description_fr:
      'Privatisation du salon Qing Ming (24 couverts) : menu dégustation étoilé par Tony Xu, accords thés ou vins.',
    description_en:
      'Qing Ming salon privatisation (24 covers): starred tasting menu by Tony Xu, tea or wine pairings.',
    booking_required: true,
    website: 'https://www.shangpalaceparis.com/',
  },
] as const;

export function resolveShangriLaParisSignatureExperiences(): unknown[] {
  return [...SHANGRI_LA_PARIS_SIGNATURE_EXPERIENCES];
}

const SHANGRI_LA_PARIS_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire — du Palais d’Iéna au palace (1896–2010)',
    title_en: 'History — from Palais d’Iéna to palace (1896–2010)',
    body_fr:
      'Érigé en 1896 pour le prince Roland Bonaparte, petit-neveu de Napoléon Ier, le Palais d’Iéna abritait collections botaniques et salons d’apparat.\n\nClassé monument historique, le bâtiment ouvrit comme hôtel de luxe en décembre 2010 — première adresse européenne de Shangri-La Hotels & Resorts. En 2014, la distinction Palace d’Atout France consacra l’excellence de la maison.\n\nCent chambres et trente-sept suites composent aujourd’hui un palace à l’échelle humaine, où l’héritage du XIXe siècle dialogue avec le confort contemporain.',
    body_en:
      'Built in 1896 for Prince Roland Bonaparte, Napoleon I’s grand-nephew, the Palais d’Iéna housed botanical collections and reception salons.\n\nListed as a historic monument, the building opened as a luxury hotel in December 2010 — Shangri-La Hotels & Resorts’ first European address. In 2014, the Atout France Palace distinction crowned the house excellence.\n\nOne hundred rooms and thirty-seven suites today form a human-scale palace, where 19th-century heritage dialogues with contemporary comfort.',
  },
  {
    anchor: 'architecture',
    title_fr: 'Architecture — haussmannien & volumes d’exception',
    title_en: 'Architecture — Haussmannian & exceptional volumes',
    body_fr:
      'Les architectes Alfred Ernest Charles Janty et Michel Roux-Spitz ont honoré l’héritage tout en ouvrant perspectives sur la Seine et la Tour Eiffel.\n\nMoulures, fresques et boiseries d’origine ont été préservées lors de la rénovation palace. Les suites déploient des surfaces rares dans le paysage hôtelier parisien — jusqu’à plusieurs centaines de mètres carrés pour les signatures.\n\nLa verrière de La Bauhinia, inspirée des jardins d’hiver du XIXe siècle, compose l’un des volumes les plus photographiés du palace.',
    body_en:
      'Architects Alfred Ernest Charles Janty and Michel Roux-Spitz honoured the heritage while opening perspectives onto the Seine and Eiffel Tower.\n\nOriginal mouldings, frescoes and panelling were preserved during the palace renovation. Suites unfold surfaces rare in the Parisian hotel landscape — up to several hundred square metres for signature categories.\n\nLa Bauhinia’s cupola, inspired by 19th-century winter gardens, forms one of the palace’s most photographed volumes.',
  },
  {
    anchor: 'experience',
    title_fr: 'L’expérience — vue Tour Eiffel & service Shangri-La',
    title_en: 'The experience — Eiffel view & Shangri-La service',
    body_fr:
      'Quarante pour cent des chambres et soixante pour cent des suites offrent une vue directe sur la Tour Eiffel et la Seine — un privilège rare pour un palace du 16e.\n\nLa conciergerie Clefs d’Or coordonne transferts, réservations Shang Palace et visites du patrimoine. Le service voiturier, le room-service vingt-quatre heures sur vingt-quatre et l’accueil multilingue prolongent l’expérience au-delà des murs historiques.\n\nOn vient ici pour habiter un décor de prince avec le confort attendu d’une adresse Forbes Five-Star — sans concession sur le calme ni sur la discrétion.',
    body_en:
      'Forty per cent of rooms and sixty per cent of suites offer a direct Eiffel Tower and Seine view — a rare privilege for a 16th-arrondissement palace.\n\nLes Clefs d’Or concierge coordinates transfers, Shang Palace bookings and heritage tours. Valet service, twenty-four-hour room service and multilingual welcome extend the experience beyond the historic walls.\n\nYou come here to inhabit a princely setting with the comfort expected of a Forbes Five-Star address — with no compromise on calm or discretion.',
  },
  {
    anchor: 'chambres-suites',
    title_fr: 'Chambres & suites — du Deluxe à la Suite Shangri-La',
    title_en: 'Rooms & suites — from Deluxe to Shangri-La Suite',
    body_fr:
      'Cent chambres dont trente-sept suites : Deluxe, Premier, Terrace Eiffel View Room et suites signatures (Shangri-La Suite, Suite Impériale).\n\nLes Terrace Eiffel View Room ouvrent sur balcon privatif face à la Tour — le critère que je vérifie en premier pour une première venue. Les suites déploient salon séparé, marbre et terrasse pour les catégories supérieures.\n\nCôté cour pour le calme du jardin intérieur ; côté Seine pour la perspective Tour Eiffel — la conciergerie note la préférence à la réservation.',
    body_en:
      'One hundred rooms including thirty-seven suites: Deluxe, Premier, Terrace Eiffel View Room and signature suites (Shangri-La Suite, Imperial Suite).\n\nTerrace Eiffel View Rooms open onto a private balcony facing the Tower — the criterion I check first for a first stay. Suites unfold separate living room, marble and terrace for upper categories.\n\nCourtyard side for inner garden calm; Seine side for Eiffel Tower perspective — the concierge notes the preference at booking.',
  },
] as const;

export const SHANGRI_LA_PARIS_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Aéroport Paris-Charles-de-Gaulle',
    station_en: 'Paris Charles de Gaulle Airport',
    distance_meters: 26_000,
    walk_minutes: 45,
    notes_fr:
      'Vols internationaux ; transfert privé via la conciergerie (environ 45 min selon trafic).',
    notes_en:
      'International flights; private transfer through the concierge (about 45 min depending on traffic).',
  },
  {
    mode: 'airport',
    station: 'Aéroport Paris-Orly',
    station_en: 'Paris Orly Airport',
    distance_meters: 17_000,
    walk_minutes: 30,
    notes_fr: 'Orlyval + métro ou transfert privé sur réservation (environ 30–40 min).',
    notes_en: 'Orlyval + metro or private transfer on reservation (about 30–40 min).',
  },
  {
    mode: 'metro',
    station: 'Iéna',
    station_en: 'Iéna',
    distance_meters: 120,
    walk_minutes: 2,
    notes_fr: 'Ligne 9 : deux pas de l’entrée, accès direct Trocadéro, Opéra et Grands Boulevards.',
    notes_en:
      'Line 9: steps from the entrance, direct access to Trocadéro, Opéra and Grands Boulevards.',
  },
  {
    mode: 'metro',
    station: 'Trocadéro',
    station_en: 'Trocadéro',
    distance_meters: 450,
    walk_minutes: 6,
    notes_fr: 'Lignes 6 et 9 : six minutes à pied, accès direct Tour Eiffel et esplanade.',
    notes_en: 'Lines 6 and 9: six minutes on foot, direct access to Eiffel Tower and esplanade.',
  },
] as const;

function resolveShangriLaParisLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    SHANGRI_LA_PARIS_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchShangriLaParisLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: SHANGRI_LA_PARIS_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: SHANGRI_LA_PARIS_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchShangriLaParisLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of SHANGRI_LA_PARIS_LONG_DESCRIPTION_SECTIONS) {
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

export function sanitizeShangriLaParisJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

export function patchShangriLaParisAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchShangriLaParisSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...SHANGRI_LA_PARIS_SPA_INFO,
  };
}

export function patchShangriLaParisPolicies(existing: unknown): Record<string, unknown> {
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
      fee_eur: 0,
      notes_fr:
        'Un seul animal jusqu’à 10 kg par chambre accepté sans supplément. Signalez-le avant l’arrivée pour préparer la chambre.',
      notes_en:
        'One pet up to 10 kg per room welcome at no extra charge. Notify before arrival to prepare the room.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

export interface ShangriLaParisGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildShangriLaParisGoldenFields(
  current: ShangriLaParisGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchShangriLaParisSpa(current.spa_info);
  return {
    highlights: SHANGRI_LA_PARIS_HIGHLIGHTS,
    concierge_questions: SHANGRI_LA_PARIS_CONCIERGE_QUESTIONS_KIT,
    opened_at: '2010-12-01',
    transports: SHANGRI_LA_PARIS_TRANSPORTS,
    restaurant_info: SHANGRI_LA_PARIS_RESTAURANT_INFO,
    points_of_interest: SHANGRI_LA_PARIS_POINTS_OF_INTEREST,
    concierge_advice: SHANGRI_LA_PARIS_CONCIERGE_ADVICE,
    concierge_pick: SHANGRI_LA_PARIS_CONCIERGE_PICK,
    concierge_hook: SHANGRI_LA_PARIS_CONCIERGE_HOOK,
    instagram: SHANGRI_LA_PARIS_INSTAGRAM,
    policies: patchShangriLaParisPolicies(current.policies),
    awards: patchShangriLaParisAwards(current.awards),
    amenities: current.amenities,
    spa_info: spaInfo,
    description_fr: SHANGRI_LA_PARIS_DESCRIPTION_FR,
    description_en: SHANGRI_LA_PARIS_DESCRIPTION_EN,
    long_description_sections: sanitizeShangriLaParisJsonb(
      resolveShangriLaParisLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeShangriLaParisJsonb(resolveShangriLaParisSignatureExperiences()),
    featured_reviews: SHANGRI_LA_PARIS_FEATURED_REVIEWS,
    upcoming_events: SHANGRI_LA_PARIS_UPCOMING_EVENTS,
    factual_summary_fr: SHANGRI_LA_PARIS_FACTUAL_SUMMARY_FR,
    factual_summary_en: SHANGRI_LA_PARIS_FACTUAL_SUMMARY_EN,
    meta_desc_fr: SHANGRI_LA_PARIS_META_DESC_FR,
    meta_desc_en: SHANGRI_LA_PARIS_META_DESC_EN,
    meta_title_fr: SHANGRI_LA_PARIS_META_TITLE_FR,
    meta_title_en: SHANGRI_LA_PARIS_META_TITLE_EN,
    hero_image: SHANGRI_LA_PARIS_HERO_IMAGE,
    gallery_images: attachKitGallerySourceUrls(
      SHANGRI_LA_PARIS_GALLERY_IMAGES,
      SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
    ),
    external_sources: SHANGRI_LA_PARIS_EXTERNAL_SOURCES,
    wikidata_id: shangriLaParisExternalScalar('wikidata_id'),
    wikipedia_url_fr: shangriLaParisExternalScalar('wikipedia_url_fr'),
    wikipedia_url_en: shangriLaParisExternalScalar('wikipedia_url_en'),
    official_url: shangriLaParisExternalScalar('official_url'),
    phone_e164: SHANGRI_LA_PARIS_PHONE_E164,
    address: SHANGRI_LA_PARIS_ADDRESS,
    postal_code: SHANGRI_LA_PARIS_POSTAL_CODE,
    latitude: SHANGRI_LA_PARIS_LATITUDE,
    longitude: SHANGRI_LA_PARIS_LONGITUDE,
    email_reservations: SHANGRI_LA_PARIS_EMAIL_RESERVATIONS,
    mice_info: SHANGRI_LA_PARIS_MICE_INFO,
    affiliations: SHANGRI_LA_PARIS_AFFILIATIONS,
    faq_content: buildKitWaveFaqPromote('shangri-la-paris'),
    faq_content_kit: buildKitWaveFaqKit('shangri-la-paris'),
  };
}
