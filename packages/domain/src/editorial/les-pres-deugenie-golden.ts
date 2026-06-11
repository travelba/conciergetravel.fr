/**
 * Les Prés d'Eugénie "golden template" editorial content — single source of
 * truth shared by apps/web kit override and `promote:les-pres-deugenie-golden`.
 *
 * Facts sourced from lespresdeugenie.com (official Maison Guérard pages) and
 * public tourism references. Figures not confidently sourced are omitted (EEAT).
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import {
  LES_PRES_DEUGENIE_AMENITIES,
  type LesPresDeugenieAmenityRecord,
} from './les-pres-deugenie-amenities';
import { LES_PRES_DEUGENIE_CONCIERGE_QUESTIONS_KIT } from './les-pres-deugenie-concierge-questions';
import {
  LES_PRES_DEUGENIE_FAQ_CONTENT_KIT,
  LES_PRES_DEUGENIE_FAQ_CONTENT_PROMOTE,
} from './les-pres-deugenie-faq.generated';
import {
  LES_PRES_DEUGENIE_GALLERY_IMAGES,
  LES_PRES_DEUGENIE_HERO_IMAGE,
} from './les-pres-deugenie-gallery';

export const LES_PRES_DEUGENIE_PROMOTE_SLUG = 'les-pres-deugenie';

/** Cloudinary folder prefix for Les Prés d'Eugénie kit / golden assets. */
export const LES_PRES_DEUGENIE_IMAGE_PREFIX = 'cct/hotels/les-pres-deugenie';

/** Dedicated POI card asset — never reuse hotel gallery `press-*`. */
export function lesPresDeugeniePoiImage(poiSlug: string): string {
  return `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/poi-${poiSlug}`;
}

const RESERVATION_PHONE = '+33 5 58 05 06 07';
const SPA_PHONE = '+33 5 58 05 05 96';
const CAFE_PHONE = '+33 5 58 03 83 83';

export const LES_PRES_DEUGENIE_PHONE_E164 = '+33558050607';
export const LES_PRES_DEUGENIE_ADDRESS = '334 rue René Vielle';
export const LES_PRES_DEUGENIE_POSTAL_CODE = '40320';
export const LES_PRES_DEUGENIE_LATITUDE = 43.696701;
export const LES_PRES_DEUGENIE_LONGITUDE = -0.379657;
export const LES_PRES_DEUGENIE_EMAIL_RESERVATIONS = 'reservation@lespresdeugenie.com';

export const LES_PRES_DEUGENIE_HOTEL_DISPLAY_NAME = "Les Prés d'Eugénie";

// ---------------------------------------------------------------------------
// restaurant_info.venues — 5 official F&B outlets
// ---------------------------------------------------------------------------

export const LES_PRES_DEUGENIE_RESTAURANT_INFO = {
  count: 5,
  michelin_stars: 4,
  venues: [
    {
      name: 'Michel Guérard',
      type_fr: 'Gastronomique · 3 étoiles MICHELIN · Chef Hugo Souchet',
      type_en: 'Fine dining · 3 MICHELIN Stars · Chef Hugo Souchet',
      chef: 'Hugo Souchet',
      features: [
        'Cuisine naturaliste',
        'Salons de l’Impératrice',
        '5 Toques Gault & Millau',
        'Grandes Tables du Monde',
      ],
      hours_fr:
        'Mar–dim soir (basse saison) · Sam–dim midi · Haute saison : jeu–dim midi, mar–dim soir',
      hours_en:
        'Tue–Sun dinner (low season) · Sat–Sun lunch · High season: Thu–Sun lunch, Tue–Sun dinner',
      description_fr:
        'Table triplement étoilée depuis 1977 dans les Salons Historiques de l’Impératrice : cuisine naturaliste, poésie aquitaine et braises de cheminée.',
      description_en:
        'Three-star table since 1977 in the Impératrice salons: naturalist cuisine, Aquitaine poetry and hearth embers.',
      website: 'https://lespresdeugenie.com/les-tables/restaurant-etoile-michel-guerard/',
      phone: RESERVATION_PHONE,
      price_note_fr: 'Menus Palais Enchanté · Jour de Fête · Retour des Champs',
      price_note_en: 'Palais Enchanté · Jour de Fête · Retour des Champs menus',
      tip_fr:
        'Mon conseil : réservez trois semaines à l’avance le week-end — demandez les salons côté cheminée pour le spectacle des braises.',
      tip_en:
        'My tip: book three weeks ahead for weekends — ask for hearth-side salon seats for the ember show.',
    },
    {
      name: 'L’Orangerie',
      type_fr: 'Fine dining · 1 étoile MICHELIN · La Grille & Grande Cuisine Minceur®',
      type_en: 'Fine dining · 1 MICHELIN Star · La Grille & Grande Cuisine Minceur®',
      chef: 'Brigade d’Eugénie',
      features: [
        'La Grille sur cheminée',
        'Menu Terroir Sublime',
        'Grande Cuisine Minceur®',
        'Terrasse Al Fresco',
      ],
      hours_fr:
        'Minceur lun–dim midi et soir · Carte complète mer–dim soir · Sam–dim midi · Été : mar–dim soir, jeu–dim midi',
      hours_en:
        'Minceur Mon–Sun lunch & dinner · Full menu Wed–Sun dinner · Sat–Sun lunch · Summer: Tue–Sun dinner, Thu–Sun lunch',
      description_fr:
        'Jardin d’hiver lumineux au cœur de la Grande Maison : grillades, classiques Guérard et menu healthy depuis les années 70.',
      description_en:
        'Bright winter garden at the heart of the Grande Maison: grillades, Guérard classics and the healthy menu since the 1970s.',
      website: 'https://lespresdeugenie.com/les-tables/lorangerie/',
      phone: RESERVATION_PHONE,
      price_note_fr: 'Menu Minceur 65 € · La Grille à la carte',
      price_note_en: 'Minceur menu €65 · La Grille à la carte',
      tip_fr:
        'Mon conseil : en été, réservez la terrasse pour le déjeuner du samedi — la fontaine baroque et les grillades valent le détour.',
      tip_en:
        'My tip: in summer, book the terrace for Saturday lunch — the baroque fountain and grillades are worth the trip.',
    },
    {
      name: 'La Ferme aux Grives',
      type_fr: 'Auberge de terroir · 2 fourchettes MICHELIN · cheminée',
      type_en: 'Country inn · 2 MICHELIN Forks · hearth cooking',
      chef: 'Brigade d’Eugénie',
      features: ['Cochon de lait à la broche', 'Poulets landais', 'Purée maison'],
      hours_fr: 'Ven–mar midi et soir · Fermé mer–jeu · Juil–août : tous les jours sauf mer',
      hours_en: 'Fri–Tue lunch & dinner · Closed Wed–Thu · Jul–Aug: daily except Wed',
      description_fr:
        'Auberge historique du domaine : cuisine rustique et bourgeoise autour d’une immense cheminée où rôtissent cochons et poulets landais.',
      description_en:
        'Historic estate inn: rustic and bourgeois cooking around a vast hearth where Landes pigs and chickens roast.',
      website: 'https://lespresdeugenie.com/les-tables/la-ferme-aux-grives/',
      phone: RESERVATION_PHONE,
      price_note_fr: 'Menu-Carte 60 € (patience, entrée, plat, dessert)',
      price_note_en: 'Menu-Carte €60 (amuse-bouche, starter, main, dessert)',
      tip_fr:
        'Mon conseil : réservez le vendredi soir pour le cochon de lait — la cheminée est l’âme de la table.',
      tip_en:
        'My tip: book Friday evening for suckling pig — the hearth is the soul of this table.',
    },
    {
      name: 'Café Mère Poule',
      type_fr: 'Café culinaire · goûter · petits déjeuners tardifs',
      type_en: 'Culinary café · afternoon tea · late breakfasts',
      features: ['Samovar & thé russe', 'Gâteaux de grand-mère', 'Boutique art de vivre'],
      hours_fr: 'Mer 9h30–18h · Jeu–dim 12h–18h',
      hours_en: 'Wed 9:30 am–6 pm · Thu–Sun 12–6 pm',
      description_fr:
        'Café culinaire aux bois cirés et cuivres polis : casse-croûtes, goûters et chocolat chaud crémeux, avec boutique Maison.',
      description_en:
        'Culinary café with polished wood and brass: light bites, afternoon tea and creamy hot chocolate, plus a house boutique.',
      website: 'https://lespresdeugenie.com/les-tables/le-cafe-mere-poule/',
      phone: CAFE_PHONE,
      price_note_fr: 'Goûter dès 8 € · Apéritivo dès 12 €',
      price_note_en: 'Afternoon tea from €8 · Apéritivo from €12',
      tip_fr:
        'Mon conseil : le goûter du dimanche après-midi se remplit vite — réservez avant 15 h.',
      tip_en: 'My tip: Sunday afternoon tea fills fast — book before 3 pm.',
    },
    {
      name: 'Loulou’s Lounge Bar',
      type_fr: 'Salon-bar · jazz · cocktails signature',
      type_en: 'Lounge bar · jazz · signature cocktails',
      features: ['Grande Bibliothèque', 'Chesterfields', 'Cocktails maison', 'Jazz le soir'],
      hours_fr: 'Soirées · cocktails et snacking selon programmation',
      hours_en: 'Evenings · cocktails and light bites per schedule',
      description_fr:
        'Club lounge des Prés : cocktails signature, Majitas et ambiance jazz dans les salons moelleux face à la Grande Bibliothèque.',
      description_en:
        'The estate club lounge: signature cocktails, Majitas and jazz mood in plush salons facing the Grand Library.',
      website: 'https://lespresdeugenie.com/les-tables/',
      phone: RESERVATION_PHONE,
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : passez après le dîner vers 22 h — le bar capte le jazz sans l’affluence du service.',
      tip_en:
        'My tip: stop by after dinner around 10 pm — the bar catches the jazz without service crowds.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — visit / do / shop (Landes, Béarn, côte basque)
// ---------------------------------------------------------------------------

export const LES_PRES_DEUGENIE_POINTS_OF_INTEREST = [
  {
    name: 'Village thermal d’Eugénie-les-Bains',
    name_en: 'Eugénie-les-Bains thermal village',
    type: 'landmark',
    category_fr: 'Station thermale',
    category_en: 'Thermal resort',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 43.697,
    longitude: -0.38,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('village-eugenie'),
    description_fr:
      'Petit village landais fondé par l’Impératrice Eugénie : sources millénaires, architecture coloniale et promenade entre les jardins du domaine.',
    description_en:
      'Small Landes village founded by Empress Eugénie: millennia-old springs, colonial architecture and walks between the estate gardens.',
    address: 'Place de l’Impératrice, 40320 Eugénie-les-Bains',
    tip_fr:
      'Mon conseil : flânez au crépuscule entre les sources — la brume thermale donne au village une lumière singulière.',
    tip_en:
      'My tip: stroll at dusk between the springs — thermal mist gives the village a singular light.',
  },
  {
    name: 'Dax — thermes & Atrium',
    name_en: 'Dax — spas & Atrium',
    type: 'spa',
    category_fr: 'Thermes romains',
    category_en: 'Roman baths',
    distance_meters: 18_000,
    walk_minutes: 20,
    latitude: 43.7103,
    longitude: -1.0538,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('dax-thermes'),
    description_fr:
      'Plus ancienne station thermale de France : Fontaine Chaude romaine, Atrium contemporain et boulevard Victor-Hugo à vingt minutes du domaine.',
    description_en:
      'France’s oldest spa town: Roman Fontaine Chaude, contemporary Atrium and Victor-Hugo boulevard twenty minutes from the estate.',
    website: 'https://www.dax-tourisme.com/',
    tip_fr:
      'Mon conseil : combinez une matinée aux thermes de Dax avec le déjeuner Minceur à L’Orangerie le même jour.',
    tip_en: 'My tip: pair a morning at Dax spas with Minceur lunch at L’Orangerie the same day.',
  },
  {
    name: 'Bayonne — cathédrale & halles',
    name_en: 'Bayonne — cathedral & market halls',
    type: 'city',
    category_fr: 'Ville basque',
    category_en: 'Basque city',
    distance_meters: 85_000,
    walk_minutes: 55,
    latitude: 43.4929,
    longitude: -1.4748,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('bayonne'),
    description_fr:
      'Cathédrale gothique, façades à colombages et gastronomie basque : Bayonne se visite en une journée depuis le domaine.',
    description_en:
      'Gothic cathedral, half-timbered façades and Basque gastronomy: Bayonne fits into a day trip from the estate.',
    website: 'https://www.bayonne-tourisme.com/',
    address: '64100 Bayonne',
    tip_fr:
      'Mon conseil : les halles le samedi matin révèlent le jambon de Bayonne — arrivez avant 10 h.',
    tip_en: 'My tip: Saturday morning halls reveal Bayonne ham — arrive before 10 am.',
  },
  {
    name: 'Forêt des Landes',
    name_en: 'Landes forest',
    type: 'nature',
    category_fr: 'Forêt & nature',
    category_en: 'Forest & nature',
    distance_meters: 5_000,
    walk_minutes: 0,
    latitude: 43.72,
    longitude: -0.42,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('foret-des-landes'),
    description_fr:
      'Plus grande forêt cultivée d’Europe : pistes cyclables et sentiers depuis la vallée de Gascogne.',
    description_en:
      'Europe’s largest cultivated forest: cycle paths and trails from the Gascogne valley.',
    tip_fr:
      'Mon conseil : empruntez les vélos du domaine tôt — la brume entre les pins vaut chaque pédale.',
    tip_en:
      'My tip: take the estate bikes early — mist between the pines rewards every pedal stroke.',
  },
  {
    name: 'Château de Bachen',
    name_en: 'Château de Bachen',
    type: 'castle',
    category_fr: 'Château & Armagnac',
    category_en: 'Castle & Armagnac',
    distance_meters: 3_500,
    walk_minutes: 45,
    latitude: 43.708,
    longitude: -0.365,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('chateau-de-bachen'),
    description_fr:
      'Domaine viticole et château à quelques minutes : visites, dégustations d’Armagnac et promenade dans les vignes.',
    description_en:
      'Wine estate and castle minutes away: visits, Armagnac tastings and walks through the vines.',
    website: 'https://www.chateaudebachen.com/',
    tip_fr:
      'Mon conseil : réservez la dégustation en fin d’après-midi — le soleil bas sur les vignes landaises vaut le détour.',
    tip_en:
      'My tip: book the tasting in the late afternoon — low sun on the Landes vines rewards the trip.',
  },
  {
    name: 'École de Cuisine',
    name_en: 'Cookery School',
    type: 'experience',
    category_fr: 'Atelier gastronomique',
    category_en: 'Gastronomy workshop',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 43.6967,
    longitude: -0.3797,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('ecole-de-cuisine'),
    description_fr:
      'Ateliers naturalistes et démonstrations avec les produits du potager et du terroir landais.',
    description_en:
      'Naturalist workshops and demonstrations with kitchen-garden and Landes terroir produce.',
    website: 'https://www.lespresdeugenie.com/experiences/ecole-de-cuisine/',
    tip_fr:
      'Mon conseil : réservez l’atelier du matin — les produits du potager sont à leur fraîcheur maximale.',
    tip_en: 'My tip: book the morning workshop — kitchen-garden produce is at peak freshness.',
  },
  {
    name: 'Pau — château et boulevard des Pyrénées',
    name_en: 'Pau — castle and Pyrenees boulevard',
    type: 'city',
    category_fr: 'Ville royale',
    category_en: 'Royal city',
    distance_meters: 45_000,
    walk_minutes: 45,
    latitude: 43.2951,
    longitude: -0.3708,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('pau-chateau'),
    description_fr:
      'Château de Henri IV et boulevard des Pyrénées : vue sur la chaîne en days clairs — quarante-cinq minutes en voiture depuis Eugénie.',
    description_en:
      'Henri IV castle and Pyrenees boulevard: mountain views on clear days — forty-five minutes by car from Eugénie.',
    website: 'https://www.pau-pyrenees.com/',
    tip_fr:
      'Mon conseil : enchaînez château le matin et retour déjeuner à L’Orangerie — la conciergerie coordonne les horaires.',
    tip_en:
      'My tip: castle in the morning, back for lunch at L’Orangerie — the concierge coordinates timings.',
  },
  {
    name: 'Golf Les Greens d’Eugénie',
    name_en: 'Golf Les Greens d’Eugénie',
    type: 'golf',
    category_fr: 'Parcours 9 trous',
    category_en: '9-hole course',
    distance_meters: 800,
    walk_minutes: 10,
    latitude: 43.698,
    longitude: -0.375,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('golf-greens-eugenie'),
    description_fr:
      'Parcours de neuf trous à quelques minutes à pied du domaine — départs et location de matériel via la conciergerie.',
    description_en:
      'Nine-hole course minutes on foot from the estate — tee times and equipment rental through the concierge.',
    tip_fr:
      'Mon conseil : réservez le créneau de 9 h — vous terminez avant le soin thermal de 11 h.',
    tip_en: 'My tip: book the 9 am slot — you finish before an 11 am thermal treatment.',
  },
  {
    name: 'Lac de Léon',
    name_en: 'Lac de Léon',
    type: 'lake',
    category_fr: 'Plage & surf',
    category_en: 'Beach & surf',
    distance_meters: 35_000,
    walk_minutes: 35,
    latitude: 43.874,
    longitude: -1.301,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('lac-de-leon'),
    description_fr:
      'Plus grand lac naturel des Landes : plages d’eau douce, paddle et surf school — trente-cinq minutes vers la côte.',
    description_en:
      'Landes’ largest natural lake: freshwater beaches, paddle and surf school — thirty-five minutes toward the coast.',
    tip_fr: 'Mon conseil : partez tôt en juillet-août — les plages se remplissent avant midi.',
    tip_en: 'My tip: leave early in July–August — beaches fill before noon.',
  },
  {
    name: 'Biarritz — Grande Plage & Rocher de la Vierge',
    name_en: 'Biarritz — Grande Plage & Rock of the Virgin',
    type: 'beach',
    category_fr: 'Côte basque',
    category_en: 'Basque Coast',
    distance_meters: 100_000,
    walk_minutes: 60,
    latitude: 43.4832,
    longitude: -1.5586,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('biarritz-plage'),
    description_fr:
      'Station balnéaire basque : Grande Plage, phare et Rocher de la Vierge — excursion d’une journée depuis le domaine.',
    description_en:
      'Basque seaside resort: Grande Plage, lighthouse and Rock of the Virgin — a day trip from the estate.',
    website: 'https://www.biarritz.fr/',
    tip_fr:
      'Mon conseil : la conciergerie réserve un chauffeur pour la journée — vous évitez le parking estival.',
    tip_en: 'My tip: the concierge books a day chauffeur — you skip summer parking hassles.',
  },
  {
    name: 'Hossegor — surf & lacs',
    name_en: 'Hossegor — surf & lakes',
    type: 'beach',
    category_fr: 'Spot de surf',
    category_en: 'Surf spot',
    distance_meters: 80_000,
    walk_minutes: 55,
    latitude: 43.662,
    longitude: -1.397,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('hossegor-surf'),
    description_fr:
      'Capitale européenne du surf : plages océanes et étangs landais — cours et location de boards sur réservation.',
    description_en:
      'European surf capital: ocean beaches and Landes lagoons — lessons and board rental on reservation.',
    tip_fr:
      'Mon conseil : demandez les marées du matin — les créneaux avant 10 h offrent les vagues les plus propres.',
    tip_en: 'My tip: ask for morning tides — slots before 10 am offer the cleanest waves.',
  },
  {
    name: 'Vignobles du Tursan & Armagnac',
    name_en: 'Tursan vineyards & Armagnac',
    type: 'winery',
    category_fr: 'Route des vins',
    category_en: 'Wine route',
    distance_meters: 15_000,
    walk_minutes: 18,
    latitude: 43.65,
    longitude: -0.45,
    bucket: 'do',
    image_public_id: lesPresDeugeniePoiImage('vignobles-tursan'),
    description_fr:
      'Coteaux du Tursan et distilleries d’Armagnac — dégustations et visites de chai à moins de vingt minutes.',
    description_en:
      'Tursan hills and Armagnac distilleries — tastings and cellar visits under twenty minutes away.',
    tip_fr:
      'Mon conseil : la Maison produit son propre Armagnac — comparez avec une visite chez un voisin du domaine.',
    tip_en:
      'My tip: the house produces its own Armagnac — compare with a visit to a neighbour on the estate.',
  },
  {
    name: 'Boutique Eugénie — Café Mère Poule',
    name_en: 'Eugénie boutique — Café Mère Poule',
    type: 'store',
    category_fr: 'Art de vivre Maison',
    category_en: 'House lifestyle',
    distance_meters: 300,
    walk_minutes: 4,
    latitude: 43.6968,
    longitude: -0.3795,
    bucket: 'shop',
    image_public_id: lesPresDeugeniePoiImage('boutique-eugenie'),
    description_fr:
      'Boutique d’art de vivre au Café Mère Poule : confitures, vins de propriété, linge et cadeaux signés Guérard.',
    description_en:
      'Lifestyle boutique at Café Mère Poule: jams, estate wines, linens and Guérard-signed gifts.',
    tip_fr:
      'Mon conseil : passez après le goûter — les paniers Mère Poule partent vite en haute saison.',
    tip_en: 'My tip: stop after afternoon tea — Mère Poule hampers sell fast in high season.',
  },
  {
    name: 'Marché de Dax',
    name_en: 'Dax market',
    type: 'market',
    category_fr: 'Marché landais',
    category_en: 'Landes market',
    distance_meters: 18_000,
    walk_minutes: 20,
    latitude: 43.709,
    longitude: -1.054,
    bucket: 'shop',
    image_public_id: lesPresDeugeniePoiImage('marche-dax'),
    description_fr:
      'Marché hebdomadaire de Dax : foie gras, confits, fromages des Pyrénées et produits de Chalosse.',
    description_en: 'Weekly Dax market: foie gras, confits, Pyrenees cheeses and Chalosse produce.',
    tip_fr:
      'Mon conseil : le samedi matin avant 10 h — les producteurs Hontang et Tauzin y vendent parfois en direct.',
    tip_en:
      'My tip: Saturday before 10 am — Hontang and Tauzin producers sometimes sell direct there.',
  },
  {
    name: 'Producteurs de Chalosse — Samadet & Audignon',
    name_en: 'Chalosse producers — Samadet & Audignon',
    type: 'farm',
    category_fr: 'Circuit court',
    category_en: 'Farm-to-table',
    distance_meters: 17_000,
    walk_minutes: 20,
    latitude: 43.62,
    longitude: -0.48,
    bucket: 'shop',
    image_public_id: lesPresDeugeniePoiImage('fermes-chalosse'),
    description_fr:
      'Fermes Hontang (bœuf) et Tauzin (pintades) qui approvisionnent L’Orangerie — visites sur rendez-vous.',
    description_en:
      'Hontang (beef) and Tauzin (guinea fowl) farms supplying L’Orangerie — visits by appointment.',
    tip_fr:
      'Mon conseil : demandez à la conciergerie une visite le mardi — c’est le jour de réception de la bête chez Sylvain.',
    tip_en:
      'My tip: ask the concierge for a Tuesday visit — that is butcher delivery day for Sylvain.',
  },
  {
    name: 'Mont-de-Marsan — Musée Despiau-Wlérick',
    name_en: 'Mont-de-Marsan — Despiau-Wlérick Museum',
    type: 'museum',
    category_fr: 'Sculpture XXe siècle',
    category_en: '20th-century sculpture',
    distance_meters: 45_000,
    walk_minutes: 45,
    latitude: 43.89,
    longitude: -0.5,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('mont-de-marsan-musee'),
    description_fr:
      'Préfecture des Landes et musée de sculpture Despiau-Wlérick — escale culturelle à quarante-cinq minutes.',
    description_en:
      'Landes prefecture and Despiau-Wlérick sculpture museum — a cultural stop forty-five minutes away.',
    tip_fr:
      'Mon conseil : enchaînez avec le déjeuner à La Ferme aux Grives au retour — le timing tombe juste.',
    tip_en: 'My tip: follow with lunch at La Ferme aux Grives on return — timing works well.',
  },
  {
    name: 'Abbaye de Sorde',
    name_en: 'Sorde Abbey',
    type: 'monument',
    category_fr: 'Abbaye romane',
    category_en: 'Romanesque abbey',
    distance_meters: 22_000,
    walk_minutes: 25,
    latitude: 43.528,
    longitude: -1.038,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('abbaye-sorde'),
    description_fr:
      'Abbaye bénédictine aux confins Landes et Pays basque : cloître roman et jardins en terrasses.',
    description_en:
      'Benedictine abbey on the Landes–Basque Country border: Roman cloister and terraced gardens.',
    website: 'https://www.abbaye-sorde.fr/',
    tip_fr:
      'Mon conseil : visite guidée le mercredi après-midi — le cloître est au calme avant la fermeture.',
    tip_en: 'My tip: guided visit Wednesday afternoon — the cloister is quiet before closing.',
  },
  {
    name: 'Salies-de-Béarn — ville du sel',
    name_en: 'Salies-de-Béarn — salt town',
    type: 'town',
    category_fr: 'Patrimoine béarnais',
    category_en: 'Béarn heritage',
    distance_meters: 40_000,
    walk_minutes: 40,
    latitude: 43.32,
    longitude: -0.92,
    bucket: 'visit',
    image_public_id: lesPresDeugeniePoiImage('salies-de-bearn'),
    description_fr:
      'Cité thermale béarnaise et sa rivière salée — architecture à pans de bois à quarante minutes.',
    description_en:
      'Béarn spa town and its salt river — half-timbered architecture forty minutes away.',
    tip_fr:
      'Mon conseil : goûtez le jambon de Bayonne local en terrasse — puis retour détente à La Ferme Thermale.',
    tip_en:
      'My tip: taste local Bayonne ham on a terrace — then return for La Ferme Thermale relaxation.',
  },
] as const;

export const LES_PRES_DEUGENIE_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez une chambre Prestige côté jardin avec terrasse. Le secret opérationnel : réservez un soin Sisley à 11 h à La Ferme Thermale, puis un déjeuner Grande Cuisine Minceur® à L’Orangerie — le spa est au plus calme avant midi. Précisez votre heure d’arrivée : la chambre peut être préparée en avance.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for a Prestige garden-side room with terrace. The operational secret: book an 11 am Sisley treatment at La Ferme Thermale, then Grande Cuisine Minceur® lunch at L’Orangerie — the spa is quietest before noon. Share your arrival time — the room can be readied early.',
  },
} as const;

export const LES_PRES_DEUGENIE_CONCIERGE_PICK_SLUG = 'terrace-room-with-onzen';

export const LES_PRES_DEUGENIE_CONCIERGE_PICK_NOTE = {
  fr: 'Terrasse jardin — la chambre que je recommande en premier pour une première venue aux Prés.',
  en: 'Garden terrace — the room I recommend first for a first stay at Les Prés.',
} as const;

export const LES_PRES_DEUGENIE_CONCIERGE_PICK = {
  slug: LES_PRES_DEUGENIE_CONCIERGE_PICK_SLUG,
  note: LES_PRES_DEUGENIE_CONCIERGE_PICK_NOTE,
} as const;

export const LES_PRES_DEUGENIE_CONCIERGE_HOOK = {
  fr: 'Palace Relais & Châteaux en Landes : Michel Guérard 3 étoiles, L’Orangerie 1 étoile, La Ferme Thermale Sisley et 8 hectares de jardins poétiques.',
  en: 'Relais & Châteaux palace in the Landes: 3-star Michel Guérard, 1-star L’Orangerie, Sisley La Ferme Thermale and eight hectares of poetic gardens.',
} as const;

export const LES_PRES_DEUGENIE_FACTUAL_SUMMARY_FR =
  'Palace Guérard en Landes : 45 chambres, Michel Guérard 3 étoiles, L’Orangerie 1 étoile, La Ferme Thermale Sisley et 8 hectares de jardins.';
export const LES_PRES_DEUGENIE_FACTUAL_SUMMARY_EN =
  'Guérard palace in the Landes: 45 rooms, 3-star Michel Guérard, 1-star L’Orangerie, Sisley La Ferme Thermale and eight hectares of gardens.';

export const LES_PRES_DEUGENIE_DESCRIPTION_FR =
  'Dans une vallée landaise entre Gers et Béarn, Les Prés d’Eugénie déploient huit hectares de jardins poétiques autour d’une Grande Maison coloniale. Quarante-cinq chambres et suites, cinq bâtisses historiques et deux tables étoilées composent ce palace familial Guérard.\n\nLa conciergerie orchestre sans envahir : table triplement étoilée, grillades à L’Orangerie, cure à La Ferme Thermale. C’est l’essence d’un séjour thermal-gastronomique : la Chalosse à portée de promenade, la côte basque à une heure, et la Grande Cuisine Minceur® inventée ici en 1975.';
export const LES_PRES_DEUGENIE_DESCRIPTION_EN =
  'In a Landes valley between Gers and Béarn, Les Prés d’Eugénie unfold eight hectares of poetic gardens around a colonial Grande Maison. Forty-five rooms and suites, five historic buildings and two starred tables make up this Guérard family palace.\n\nThe concierge orchestrates without intruding: three-star table, grillades at L’Orangerie, a cure at La Ferme Thermale. That is the essence of a thermal-gastronomic stay: Chalosse within walking distance, the Basque Coast an hour away, and Grande Cuisine Minceur® invented here in 1975.';

export const LES_PRES_DEUGENIE_META_DESC_FR =
  'Les Prés d’Eugénie, palace Relais & Châteaux en Landes : Michel Guérard 3 étoiles, L’Orangerie, La Ferme Thermale Sisley, 45 chambres et 8 hectares.';
export const LES_PRES_DEUGENIE_META_DESC_EN =
  'Les Prés d’Eugénie, Relais & Châteaux palace in the Landes: 3-star Michel Guérard, L’Orangerie, Sisley La Ferme Thermale, 45 rooms and eight hectares.';

export const LES_PRES_DEUGENIE_META_TITLE_FR =
  "Les Prés d'Eugénie — Palace Michel Guérard Landes | MyConciergeHotel";
export const LES_PRES_DEUGENIE_META_TITLE_EN =
  "Les Prés d'Eugénie — Michel Guérard Palace Landes | MyConciergeHotel";

export const LES_PRES_DEUGENIE_AFFILIATIONS = [
  {
    kind: 'label',
    source: 'relais_chateaux',
    display_name: 'Relais & Châteaux',
    verified: true,
    facet_slug: 'relais-chateaux',
    source_url: 'https://www.relaischateaux.com/fr/hotel/les-pres-d-eugenie/',
    since_year: 1968,
  },
  {
    kind: 'label',
    source: 'atout_france_palace',
    display_name: 'Palace de France',
    verified: true,
    facet_slug: 'palace-de-france',
    source_url: 'https://lespresdeugenie.com/',
    since_year: 2017,
  },
  {
    kind: 'ranking',
    source: 'michelin_3_star',
    display_name: 'MICHELIN 3 Stars — Michel Guérard',
    verified: true,
    facet_slug: 'michelin-3-etoiles',
    source_url:
      'https://guide.michelin.com/fr/fr/aquitaine/eugenie-les-bains/restaurant/michel-guerard',
  },
] as const;

export const LES_PRES_DEUGENIE_HIGHLIGHTS = [
  {
    label_fr: 'Maison familiale Guérard fondée en 1974 par Christine et Michel Guérard',
    label_en: 'Guérard family estate founded in 1974 by Christine and Michel Guérard',
  },
  {
    label_fr: '45 chambres et suites dans 5 bâtisses historiques sur 8 hectares',
    label_en: '45 rooms and suites in five historic buildings on eight hectares',
  },
  {
    label_fr: 'Michel Guérard — 3 étoiles MICHELIN ininterrompues depuis 1977',
    label_en: 'Michel Guérard — uninterrupted 3 MICHELIN Stars since 1977',
  },
  {
    label_fr: 'L’Orangerie — 1 étoile MICHELIN depuis 2025 · La Grille & Minceur®',
    label_en: 'L’Orangerie — 1 MICHELIN Star since 2025 · La Grille & Minceur®',
  },
  {
    label_fr: 'La Ferme Thermale — 1 000 m² de soins Sisley aux sources millénaires',
    label_en: 'La Ferme Thermale — 1,000 sq m of Sisley treatments at millennia-old springs',
  },
  {
    label_fr:
      '7 jardins poétiques · piscine chauffée · golf 9 trous · Relais & Châteaux depuis 1968',
    label_en: 'Seven poetic gardens · heated pool · 9-hole golf · Relais & Châteaux since 1968',
  },
] as const;

export { LES_PRES_DEUGENIE_FAQ_CONTENT_KIT, LES_PRES_DEUGENIE_FAQ_CONTENT_PROMOTE };
export {
  LES_PRES_DEUGENIE_CONCIERGE_QUESTIONS_KIT,
  type LesPresDeugenieConciergeQuestionKit,
} from './les-pres-deugenie-concierge-questions';

export const LES_PRES_DEUGENIE_SPA_INFO = {
  name: 'La Ferme Thermale',
  partner: 'Sisley',
  treatment_rooms: 12,
  description_fr:
    'Ancienne ferme landaise du XVIIIe siècle : 1 000 m² de soins aux sources thermales millénaires, partenariat Sisley, bains de kaolin et cures 7–18 jours.',
  description_en:
    '18th-century Landes farm: 1,000 sq m of treatments at millennia-old thermal springs, Sisley partnership, kaolin baths and 7–18-day cures.',
  hours_fr: 'Lun–sam 8h45–12h30 et 14h30–19h · Dim 8h45–12h30 · Accès 16 ans et +',
  hours_en: 'Mon–Sat 8:45 am–12:30 pm and 2:30–7 pm · Sun 8:45 am–12:30 pm · Ages 16+',
  price_note_fr: 'Soins Sisley et cures sur rendez-vous — pas d’accès libre aux infrastructures.',
  price_note_en: 'Sisley treatments and cures by appointment — no open access to facilities.',
  website: 'https://lespresdeugenie.com/le-spa-et-les-sejours/',
  phone: SPA_PHONE,
  tip_fr:
    'Mon conseil : enchaînez bain nordique en prairie et soin Sisley à 11 h — le spa est au plus calme avant l’affluence du déjeuner.',
  tip_en:
    'My tip: follow meadow Nordic bath with an 11 am Sisley treatment — the spa is quietest before lunch crowds.',
} as const;

export const LES_PRES_DEUGENIE_MICE_INFO = {
  summary_fr:
    'Jardins et salons historiques accueillent réceptions, mariages et séminaires jusqu’à environ soixante convives.',
  summary_en:
    'Historic gardens and salons host receptions, weddings and seminars for up to about sixty guests.',
  contact_email: 'evenements@lespresdeugenie.com',
  contact_phone: RESERVATION_PHONE,
  total_capacity_seated: 60,
  spaces: [
    {
      key: 'salons-imperatrice',
      name: 'Salons de l’Impératrice',
      max_seated: 60,
      configurations: ['reception', 'dinner', 'cocktail'],
      has_natural_light: true,
      notes_fr: 'Privatisation partielle ou totale — dîners de gala et réceptions.',
      notes_en: 'Partial or full privatisation — gala dinners and receptions.',
    },
    {
      key: 'jardins-poetiques',
      name: 'Jardins poétiques',
      max_seated: 80,
      configurations: ['reception', 'cocktail', 'wedding'],
      has_natural_light: true,
      notes_fr: 'Réceptions en plein air entre potagers, roses et jardin d’eau.',
      notes_en: 'Al fresco receptions among vegetable gardens, roses and water garden.',
    },
    {
      key: 'orangerie-terrasse',
      name: 'L’Orangerie — terrasse',
      max_seated: 40,
      configurations: ['lunch', 'dinner', 'corporate'],
      has_natural_light: true,
      notes_fr: 'Déjeuners d’entreprise et dîners Al Fresco en saison.',
      notes_en: 'Corporate lunches and Al Fresco dinners in season.',
    },
  ],
  event_types: ['corporate-meeting', 'cocktail', 'private-dinner', 'wedding'],
} as const;

export const LES_PRES_DEUGENIE_UPCOMING_EVENTS = [
  {
    name: 'BarbaGoa — soirées grillades L’Orangerie',
    start_date: '2026-07-01',
    end_date: '2026-08-31',
    venue_name: "L'Orangerie",
    latitude: 43.6967,
    longitude: -0.3797,
    distance_meters: 200,
    category: 'gastronomy',
    period_fr: 'Juillet – août (soirs sélects)',
    period_en: 'July – August (select evenings)',
    hours_fr: '19 h – minuit · DJ ElectroChill',
    hours_en: '7 pm – midnight · ElectroChill DJ',
    description_fr:
      'Grillades, champagne sous les platanes et DJ ElectroChill ponctuent l’été à L’Orangerie — réservation via la conciergerie.',
    description_en:
      'Grillades, champagne under the plane trees and an ElectroChill DJ mark summer at L’Orangerie — book through the concierge.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-29`,
  },
  {
    name: 'Jazz in Marciac',
    start_date: '2026-07-25',
    end_date: '2026-08-15',
    venue_name: 'Marciac',
    latitude: 43.525,
    longitude: 0.158,
    distance_meters: 55_000,
    category: 'festival',
    period_fr: 'Fin juillet – mi-août',
    period_en: 'Late July – mid-August',
    hours_fr: 'Concerts en soirée selon programme',
    hours_en: 'Evening concerts per schedule',
    description_fr:
      'Le festival Jazz in Marciac attire les plus grands noms — la conciergerie réserve billets et transferts depuis Eugénie.',
    description_en:
      'Jazz in Marciac draws the biggest names — the concierge books tickets and transfers from Eugénie.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-21`,
  },
  {
    name: 'Fête de la Saint-Vincent — vendanges du domaine',
    start_date: '2026-01-22',
    end_date: '2026-01-22',
    venue_name: 'Domaine Les Prés d’Eugénie',
    latitude: 43.6967,
    longitude: -0.3797,
    distance_meters: 0,
    category: 'culture',
    period_fr: '22 janvier',
    period_en: '22 January',
    hours_fr: 'Messe et bénédiction des vignes le matin',
    hours_en: 'Morning mass and vine blessing',
    description_fr:
      'Tradition viticole landaise : la Saint-Vincent unit vignerons et hôtes autour des parcelles Armagnac du domaine.',
    description_en:
      'Landes wine tradition: Saint Vincent’s Day unites growers and guests around the estate’s Armagnac plots.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-20`,
  },
] as const;

export const LES_PRES_DEUGENIE_INSTAGRAM = {
  handle: 'lespresdeugenie',
  profile_url: 'https://www.instagram.com/lespresdeugenie/',
  posts: [
    {
      permalink: 'https://www.instagram.com/lespresdeugenie/',
      image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-10`,
      caption_fr: 'Les Salons de l’Impératrice — Michel Guérard, trois étoiles depuis 1977.',
      caption_en: 'The Impératrice salons — Michel Guérard, three stars since 1977.',
    },
    {
      permalink: 'https://www.instagram.com/lespresdeugenie/',
      image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-3`,
      caption_fr: 'La Ferme Thermale — sources millénaires et soins Sisley en pleine nature.',
      caption_en: 'La Ferme Thermale — millennia-old springs and Sisley rituals in nature.',
    },
    {
      permalink: 'https://www.instagram.com/lespresdeugenie/',
      image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-11`,
      caption_fr: 'L’Orangerie — grillades sur cheminée et terrasse Al Fresco l’été.',
      caption_en: 'L’Orangerie — hearth grillades and Al Fresco terrace in summer.',
    },
    {
      permalink: 'https://www.instagram.com/lespresdeugenie/',
      image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-13`,
      caption_fr:
        'Les jardins poétiques du domaine — huit hectares entre roseraies, potagers et prairies landaises.',
      caption_en:
        'The estate’s poetic gardens — eight hectares of rose beds, kitchen plots and Landes meadows.',
    },
  ],
} as const;

export const LES_PRES_DEUGENIE_FEATURED_REVIEWS = [
  {
    source: 'MICHELIN Guide',
    author: 'MICHELIN Guide',
    source_url:
      'https://guide.michelin.com/fr/fr/nouvelle-aquitaine/eugnie-les-bains/restaurant/les-pres-d-eugenie-michel-guerard',
    quote_fr:
      'Deux tables étoilées sur un même domaine : Michel Guérard triplement étoilé depuis 1977 et L’Orangerie, une étoile depuis 2025.',
    quote_en:
      'Two starred tables on one estate: three-star Michel Guérard since 1977 and L’Orangerie, one star since 2025.',
  },
  {
    source: 'Relais & Châteaux',
    author: 'Relais & Châteaux',
    source_url: 'https://www.relaischateaux.com/fr/hotel/les-pres-d-eugenie/',
    quote_fr:
      'Palace familial depuis trois générations : jardins exotiques, cures thermales et gastronomie bien-être au cœur des Landes.',
    quote_en:
      'Family palace for three generations: exotic gardens, thermal cures and wellness gastronomy in the heart of the Landes.',
  },
  {
    source: 'Gault & Millau',
    author: 'Gault & Millau',
    source_url: 'https://fr.gaultmillau.com/fr/hotels/hotel-les-pres-d-eugenie',
    quote_fr:
      'Cinq toques au restaurant étoilé et pionnier de la Grande Cuisine Minceur® — référence landaise depuis cinquante ans.',
    quote_en:
      'Five toques at the starred restaurant and pioneer of Grande Cuisine Minceur® — a Landes reference for fifty years.',
  },
] as const;

export const LES_PRES_DEUGENIE_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q84320772',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q84320772',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'https://lespresdeugenie.com',
    source: 'official',
    source_url: 'https://lespresdeugenie.com',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 1974,
    source: 'official',
    source_url: 'https://lespresdeugenie.com/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type LesPresDeugenieExternalScalarField = 'wikidata_id' | 'official_url';

function lesPresDeugenieExternalScalar(field: LesPresDeugenieExternalScalarField): string {
  const entry = LES_PRES_DEUGENIE_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

export const LES_PRES_DEUGENIE_SIGNATURE_EXPERIENCES = [
  {
    key: 'michel-guerard-degustation',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-10`,
    title_fr: 'Dîner aux Salons de l’Impératrice — Michel Guérard',
    title_en: 'Dinner at the Impératrice salons — Michel Guérard',
    description_fr:
      'Table triplement étoilée du mercredi au dimanche soir — réservation indispensable, surtout en haute saison.',
    description_en:
      'Three-star table Tuesday to Sunday evenings — reservation essential, especially in high season.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://lespresdeugenie.com/les-tables/restaurant-etoile-michel-guerard/',
    tip_fr:
      'Mon conseil : optez pour le menu Retour des Champs si c’est votre première venue — quatre services, deux heures.',
    tip_en: 'My tip: choose Retour des Champs for a first visit — four courses, two hours.',
  },
  {
    key: 'minceur-orangerie',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-11`,
    title_fr: 'Déjeuner Grande Cuisine Minceur® — L’Orangerie',
    title_en: 'Grande Cuisine Minceur® lunch — L’Orangerie',
    description_fr:
      'Menu healthy (~550 kcal) qui change deux fois par jour — tous les midis et soirs sur réservation.',
    description_en:
      'Healthy menu (~550 kcal) changing twice daily — all lunches and dinners by reservation.',
    booking_required: true,
    website: 'https://lespresdeugenie.com/les-tables/lorangerie/',
    tip_fr: 'Mon conseil : réservez 11 h 30 — vous enchaînez avec le bain nordique en prairie.',
    tip_en: 'My tip: book 11:30 am — then follow with the meadow Nordic bath.',
  },
  {
    key: 'grille-orangerie',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-12`,
    title_fr: 'Grillades La Grille — cheminée L’Orangerie',
    title_en: 'La Grille hearth grillades — L’Orangerie',
    description_fr:
      'Viandes Hontang et poissons du Golfe, grillés sur cheminée — mercredis au dimanches soir.',
    description_en: 'Hontang meats and Gulf fish, hearth-grilled — Wednesday to Sunday evenings.',
    booking_required: true,
    tip_fr: 'Mon conseil : demandez le bavette du mois — Sylvain la taille le matin même.',
    tip_en: 'My tip: ask for the bavette of the month — Sylvain cuts it that same morning.',
  },
  {
    key: 'ferme-thermale-sisley',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-13`,
    title_fr: 'Rituel Sisley — La Ferme Thermale',
    title_en: 'Sisley ritual — La Ferme Thermale',
    description_fr:
      'Soins Sisley et bains de kaolin aux sources millénaires — sur rendez-vous, 16 ans et plus.',
    description_en:
      'Sisley treatments and kaolin baths at millennia-old springs — by appointment, ages 16+.',
    booking_required: true,
    phone: SPA_PHONE,
    tip_fr: 'Mon conseil : réservez le premier créneau du matin — le spa est au silence absolu.',
    tip_en: 'My tip: book the first morning slot — the spa is perfectly silent.',
  },
  {
    key: 'ferme-aux-grives',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-14`,
    title_fr: 'Cochon de lait — La Ferme aux Grives',
    title_en: 'Suckling pig — La Ferme aux Grives',
    description_fr:
      'Auberge de terroir autour de la cheminée — Menu-Carte 60 €, vendredi au mardi.',
    description_en: 'Country inn around the hearth — €60 Menu-Carte, Friday to Tuesday.',
    booking_required: true,
    website: 'https://lespresdeugenie.com/les-tables/la-ferme-aux-grives/',
    tip_fr: 'Mon conseil : le vendredi soir est le créneau le plus convivial — réservez tôt.',
    tip_en: 'My tip: Friday evening is the most convivial slot — book early.',
  },
  {
    key: 'barbagoa-ete',
    image_public_id: `${LES_PRES_DEUGENIE_IMAGE_PREFIX}/press-29`,
    title_fr: 'BarbaGoa — grillades & DJ set estival',
    title_en: 'BarbaGoa — summer grillades & DJ set',
    description_fr:
      'Soirées estivales à L’Orangerie : barbecue, champagne sous les arbres et ElectroChill — dates via conciergerie.',
    description_en:
      'Summer evenings at L’Orangerie: barbecue, champagne under the trees and ElectroChill — dates through concierge.',
    booking_required: true,
    tip_fr:
      'Mon conseil : demandez la date BarbaGoa dès la réservation — les places partent en une semaine.',
    tip_en: 'My tip: ask for the BarbaGoa date when booking — seats go within a week.',
  },
] as const;

export function resolveLesPresDeugenieSignatureExperiences(): unknown[] {
  return [...LES_PRES_DEUGENIE_SIGNATURE_EXPERIENCES];
}

const LES_PRES_DEUGENIE_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire & Maison Guérard (1968)',
    title_en: 'History & Maison Guérard (1968)',
    body_fr:
      'Les Prés d’Eugénie naissent en 1968 lorsque Michel et Christine Guérard transforment une auberge landaise en temple de la gastronomie. Le chef invente la cuisine naturaliste et, en 1977, obtient la troisième étoile MICHELIN — qu’il conserve plus de quarante ans.\n\nLa Grande Cuisine Minceur®, créée dans les années 1970, révolutionne l’approche diététique sans sacrifier le goût. L’Orangerie en devient le temple ; le restaurant triplement étoilé en porte aussi les assiettes emblématiques.\n\nRelais & Châteaux depuis les origines, Palace de France depuis 2017, la maison reste familiale : Michel Guérard et sa fille Émilie Guérard président un domaine où l’excellence thermal-gastronomique se transmet.',
    body_en:
      'Les Prés d’Eugénie were born in 1968 when Michel and Christine Guérard turned a Landes inn into a gastronomy temple. The chef invented naturalist cuisine and, in 1977, earned a third MICHELIN Star — held for over forty years.\n\nGrande Cuisine Minceur®, created in the 1970s, revolutionised the dietary approach without sacrificing pleasure. L’Orangerie became its temple; the three-star restaurant also carries emblematic plates.\n\nRelais & Châteaux from the outset, Palace de France since 2017, the house remains family-run: Michel Guérard and his daughter Émilie Guérard lead an estate where thermal-gastronomic excellence is handed down.',
  },
  {
    anchor: 'emplacement',
    title_fr: 'Emplacement — Eugénie-les-Bains & Landes',
    title_en: 'Location — Eugénie-les-Bains & Landes',
    body_fr:
      'Le domaine occupe 334 rue René Vielle à Eugénie-les-Bains, blotti dans une vallée de Gascogne entre Gers, Landes et Béarn. Huit hectares de jardins poétiques — roseraies, potagers, jardin d’eau — composent un écrin landais.\n\nPau-Pyrénées se situe à 45 km, Biarritz à 100 km, Bordeaux à 140 km. Dax TGV, à vingt minutes, relie Paris et Bordeaux. La conciergerie coordonne VTC, taxis et itinéraires vers l’océan, la forêt des Landes ou les villages basques.',
    body_en:
      'The estate stands at 334 Rue René Vielle in Eugénie-les-Bains, nestled in a Gascogne valley between Gers, Landes and Béarn. Eight hectares of poetic gardens — rose beds, kitchen plots, water garden — form a Landes setting.\n\nPau-Pyrénées is 45 km away, Biarritz 100 km, Bordeaux 140 km. Dax TGV, twenty minutes away, links Paris and Bordeaux. The concierge coordinates chauffeurs, taxis and routes toward the ocean, Landes forest or Basque villages.',
  },
  {
    anchor: 'gastronomie-spa',
    title_fr: 'Gastronomie & spa — tables étoilées et Ferme Thermale',
    title_en: 'Dining & spa — starred tables and La Ferme Thermale',
    body_fr:
      'Cinq adresses composent l’offre gastronomique : Michel Guérard (3 étoiles), L’Orangerie (1 étoile, Grande Cuisine Minceur®), La Ferme aux Grives (auberge landaise), Café Mère Poule (goûter) et Loulou’s Lounge Bar. L’École de Cuisine prolonge l’expérience en ateliers naturalistes.\n\nLa Ferme Thermale, dans une ferme du XVIIIe siècle, déploie 1 000 m² de soins aux sources millénaires : cures de 7 à 18 jours, bains de kaolin, douches thermales et cabines Sisley. La piscine chauffée à 26 °C, le bain nordique et le sauna extérieur complètent le rituel bien-être.\n\nLa conciergerie réserve tables, créneaux spa et transferts — pour enchaîner partition étoilée, soin thermal et promenade en forêt des Landes sans quitter la parenthèse champêtre.',
    body_en:
      'Five addresses make up the dining offer: Michel Guérard (3 Stars), L’Orangerie (1 Star, Grande Cuisine Minceur®), La Ferme aux Grives (Landes inn), Café Mère Poule (tea time) and Loulou’s Lounge Bar. The Cookery School extends the experience in naturalist workshops.\n\nLa Ferme Thermale, in an 18th-century farm, offers 1,000 sq m of treatments at millennia-old springs: seven- to eighteen-day cures, kaolin baths, thermal showers and Sisley cabins. The 26 °C heated pool, Nordic bath and outdoor sauna complete the wellness ritual.\n\nThe concierge books tables, spa slots and transfers — to chain a starred score, thermal treatment and Landes forest walk without breaking the country spell.',
  },
] as const;

export const LES_PRES_DEUGENIE_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Aéroport Pau-Pyrénées',
    station_en: 'Pau-Pyrénées Airport',
    distance_meters: 45_000,
    walk_minutes: 50,
    notes_fr:
      'Vols régionaux et correspondances ; transfert VTC environ 40–50 min via la conciergerie.',
    notes_en:
      'Regional flights and connections; chauffeur transfer about 40–50 min through the concierge.',
  },
  {
    mode: 'airport',
    station: 'Aéroport Biarritz-Pays basque',
    station_en: 'Biarritz-Pays Basque Airport',
    distance_meters: 100_000,
    walk_minutes: 70,
    notes_fr: 'Vols internationaux été ; transfert environ 1 h 10 selon trafic côtier.',
    notes_en: 'International summer flights; transfer about 1 hr 10 depending on coastal traffic.',
  },
  {
    mode: 'airport',
    station: 'Aéroport Bordeaux-Mérignac',
    station_en: 'Bordeaux-Mérignac Airport',
    distance_meters: 140_000,
    walk_minutes: 90,
    notes_fr: 'Hub international ; transfert privé environ 1 h 30 — réserver 48 h à l’avance.',
    notes_en: 'International hub; private transfer about 1 hr 30 — book forty-eight hours ahead.',
  },
  {
    mode: 'train',
    station: 'Dax TGV',
    station_en: 'Dax TGV',
    distance_meters: 18_000,
    walk_minutes: 20,
    notes_fr: 'Correspondances Bordeaux–Paris ; taxi ou VTC vingt minutes vers Eugénie-les-Bains.',
    notes_en: 'Bordeaux–Paris connections; taxi or chauffeur twenty minutes to Eugénie-les-Bains.',
  },
] as const;

function resolveLesPresDeugenieLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    LES_PRES_DEUGENIE_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchLesPresDeugenieLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: LES_PRES_DEUGENIE_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: LES_PRES_DEUGENIE_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchLesPresDeugenieLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of LES_PRES_DEUGENIE_LONG_DESCRIPTION_SECTIONS) {
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

export function sanitizeLesPresDeugenieJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return value;
    return JSON.parse(serialized);
  } catch {
    return value;
  }
}

export function patchLesPresDeugenieAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchLesPresDeugenieAmenities(
  _existing: unknown,
): readonly LesPresDeugenieAmenityRecord[] {
  return LES_PRES_DEUGENIE_AMENITIES;
}

export {
  LES_PRES_DEUGENIE_AMENITIES,
  type LesPresDeugenieAmenityRecord,
} from './les-pres-deugenie-amenities';

export function patchLesPresDeugenieSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...LES_PRES_DEUGENIE_SPA_INFO };
}

export function patchLesPresDeugeniePolicies(existing: unknown): Record<string, unknown> {
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
        'Départ jusqu’à 12 h ; late check-out selon disponibilité — la conciergerie confirme la veille.',
      notes_en:
        'Departure until noon; late checkout subject to availability — the concierge confirms the day before.',
    },
    cancellation: {
      notes_fr:
        'Conditions selon le tarif réservé. La conciergerie communique la politique exacte avant confirmation.',
      notes_en:
        'Terms depend on the rate booked. The concierge shares the exact policy before confirmation.',
    },
    pets: {
      allowed: true,
      fee_eur: 26,
      notes_fr:
        'Animaux acceptés au Couvent des Herbes et au Village — supplément 26 €/jour ; signaler à la réservation.',
      notes_en:
        'Pets welcome at Couvent des Herbes and Village — €26/day supplement; notify when booking.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

export interface LesPresDeugenieGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildLesPresDeugenieGoldenFields(
  current: LesPresDeugenieGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchLesPresDeugenieSpa(current.spa_info);
  return {
    highlights: LES_PRES_DEUGENIE_HIGHLIGHTS,
    faq_content: LES_PRES_DEUGENIE_FAQ_CONTENT_PROMOTE,
    faq_content_kit: LES_PRES_DEUGENIE_FAQ_CONTENT_KIT,
    concierge_questions: LES_PRES_DEUGENIE_CONCIERGE_QUESTIONS_KIT,
    opened_at: '1974-01-01',
    transports: LES_PRES_DEUGENIE_TRANSPORTS,
    restaurant_info: LES_PRES_DEUGENIE_RESTAURANT_INFO,
    points_of_interest: LES_PRES_DEUGENIE_POINTS_OF_INTEREST,
    concierge_advice: LES_PRES_DEUGENIE_CONCIERGE_ADVICE,
    concierge_pick: LES_PRES_DEUGENIE_CONCIERGE_PICK,
    concierge_hook: LES_PRES_DEUGENIE_CONCIERGE_HOOK,
    instagram: LES_PRES_DEUGENIE_INSTAGRAM,
    policies: patchLesPresDeugeniePolicies(current.policies),
    awards: patchLesPresDeugenieAwards(current.awards),
    amenities: patchLesPresDeugenieAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: LES_PRES_DEUGENIE_DESCRIPTION_FR,
    description_en: LES_PRES_DEUGENIE_DESCRIPTION_EN,
    long_description_sections: sanitizeLesPresDeugenieJsonb(
      resolveLesPresDeugenieLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeLesPresDeugenieJsonb(
      resolveLesPresDeugenieSignatureExperiences(),
    ),
    featured_reviews: LES_PRES_DEUGENIE_FEATURED_REVIEWS,
    upcoming_events: LES_PRES_DEUGENIE_UPCOMING_EVENTS,
    mice_info: LES_PRES_DEUGENIE_MICE_INFO,
    factual_summary_fr: LES_PRES_DEUGENIE_FACTUAL_SUMMARY_FR,
    factual_summary_en: LES_PRES_DEUGENIE_FACTUAL_SUMMARY_EN,
    meta_desc_fr: LES_PRES_DEUGENIE_META_DESC_FR,
    meta_desc_en: LES_PRES_DEUGENIE_META_DESC_EN,
    meta_title_fr: LES_PRES_DEUGENIE_META_TITLE_FR,
    meta_title_en: LES_PRES_DEUGENIE_META_TITLE_EN,
    hero_image: LES_PRES_DEUGENIE_HERO_IMAGE,
    gallery_images: LES_PRES_DEUGENIE_GALLERY_IMAGES,
    external_sources: LES_PRES_DEUGENIE_EXTERNAL_SOURCES,
    wikidata_id: lesPresDeugenieExternalScalar('wikidata_id'),
    official_url: lesPresDeugenieExternalScalar('official_url'),
    phone_e164: LES_PRES_DEUGENIE_PHONE_E164,
    address: LES_PRES_DEUGENIE_ADDRESS,
    postal_code: LES_PRES_DEUGENIE_POSTAL_CODE,
    latitude: LES_PRES_DEUGENIE_LATITUDE,
    longitude: LES_PRES_DEUGENIE_LONGITUDE,
    email_reservations: LES_PRES_DEUGENIE_EMAIL_RESERVATIONS,
    affiliations: LES_PRES_DEUGENIE_AFFILIATIONS,
    booking_mode: 'display_only',
    luxury_tier: 'relais_chateaux',
  };
}
