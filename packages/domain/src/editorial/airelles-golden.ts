/**
 * Airelles Gordes "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override (local sandbox) and the
 * catalogue promotion script (`@mch/editorial-pilot`).
 *
 * Pure data + pure transforms (no `server-only`, no framework imports) so it
 * can be imported from both the Next.js app and the standalone tsx scripts.
 *
 * Every fact here is sourced from the official site (airelles.com) or a public
 * tourism source. When a figure is not confidently sourced it is OMITTED
 * rather than fabricated (EEAT — IATA-accredited OTA).
 */

import { AIRELLES_AMENITIES, type AirellesAmenityRecord } from './airelles-amenities';
import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';

export const AIRELLES_PROMOTE_SLUG = 'les-airelles-gordes';

/** Cloudinary folder prefix for all Airelles Gordes kit / golden assets. */
const AIRELLES_IMAGE_PREFIX = 'cct/hotels/les-airelles-gordes';

// ---------------------------------------------------------------------------
// Shared contact constants (official — informations-pratiques-gordes page)
// ---------------------------------------------------------------------------

const HOTEL_PHONE = '+33 4 90 72 12 12';
export const AIRELLES_PHONE_E164 = '+33490721212';
export const AIRELLES_ADDRESS = '61 Rue de la Combe';
export const AIRELLES_POSTAL_CODE = '84220';
export const AIRELLES_EMAIL_RESERVATIONS = 'reservation.labastide@airelles.com';

// ---------------------------------------------------------------------------
// restaurant_info.venues — the 6 official F&B venues + practical blocks
// ---------------------------------------------------------------------------

export const AIRELLES_RESTAURANT_INFO = {
  count: 6,
  michelin_stars: 0,
  venues: [
    {
      name: 'Clover Gordes',
      type_fr: 'Table provençale · Jean-François Piège · 2 toques Gault&Millau 2025',
      type_en: 'Provençal table · Jean-François Piège · 2 toques Gault&Millau 2025',
      chef: 'Jean-François Piège',
      features: ['Terrasse panoramique', 'Vue vallée du Luberon', 'Grill au feu de bois'],
      hours_fr: 'Tous les jours, 12h15–14h et 19h15–21h45',
      hours_en: 'Daily, 12:15–2:00 pm and 7:15–9:45 pm',
      description_fr:
        'La signature de la maison : légumes du Luberon et grill au feu de bois, par le chef multi-étoilé Jean-François Piège. Tous les jours 12h15–14h / 19h15–21h45.',
      description_en:
        'The house signature: Luberon vegetables and a wood-fired grill by multi-Michelin-starred chef Jean-François Piège. Daily 12:15–2 pm / 7:15–9:45 pm.',
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/clover-gordes-jean-francois-piege-cuisine-terroir-terrasse',
      reservation_url: 'https://www.sevenrooms.com/reservations/clovergordes',
      phone: '+33 4 90 72 18 80',
      price_note_fr: 'Menu dès 95 €',
      price_note_en: 'Menu from €95',
      tip_fr:
        'La signature de la maison. Réservez une table en terrasse vers 19h45 : on dîne pendant que le soleil glisse sur la vallée.',
      tip_en:
        'The house signature. Book a terrace table around 7:45 pm to dine as the sun slides over the valley.',
    },
    {
      name: 'La Table de La Bastide',
      type_fr: 'Cuisine provençale raffinée · Chef Pierre Marty',
      type_en: 'Refined Provençal cuisine · Chef Pierre Marty',
      chef: 'Pierre Marty',
      features: ['Terrasse panoramique', 'Jardins suspendus'],
      description_fr:
        'La table du quotidien sur la terrasse panoramique aux jardins suspendus. Petit-déjeuner 7h30–11h, déjeuner 12h15–14h, dîner 19h15–21h45.',
      description_en:
        'The everyday table on the panoramic terrace in the hanging gardens. Breakfast 7:30–11 am, lunch 12:15–2 pm, dinner 7:15–9:45 pm.',
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/la-table-de-la-bastide-restaurant',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : c’est ici que se prend le petit-déjeuner et le déjeuner face aux Alpilles. Demandez la table d’angle des jardins suspendus, à l’ombre en milieu de journée.',
      tip_en:
        'My tip: this is where breakfast and lunch are served facing the Alpilles. Ask for the corner table in the hanging gardens — shaded at midday.',
    },
    {
      name: 'La Bastide de Pierres',
      type_fr: 'Trattoria italienne · adresse village depuis 1820',
      type_en: 'Italian trattoria · village address since 1820',
      features: ['Pizza napolitaine', 'Pasta', 'Cadre convivial'],
      description_fr:
        'Antipasti, burrata, pizzas au feu de bois et pâtes fraîches. Déjeuner 12h–14h15, dîner 19h–21h45. Tél. +33 4 90 72 18 91.',
      description_en:
        'Antipasti, burrata, wood-fired pizzas and fresh pasta. Lunch 12–2:15 pm, dinner 7–9:45 pm. Tel. +33 4 90 72 18 91.',
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/la-bastide-pierres-restaurant-italien',
      phone: '+33 4 90 72 18 91',
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : l’adresse décontractée de La Bastide, parfaite pour un dîner en famille. La pasta alle vongole et la pizza napolitaine valent le détour.',
      tip_en:
        'My tip: La Bastide’s relaxed address, perfect for a family dinner. The pasta alle vongole and the Neapolitan pizza are worth the detour.',
    },
    {
      name: 'Ladurée',
      type_fr: 'Salon de thé & boutique · Maison fondée 1862',
      type_en: 'Tea room & boutique · founded 1862',
      features: ['Macarons', 'Afternoon tea', 'Glaces artisanales'],
      hours_fr: 'Tous les jours 9h–18h',
      hours_en: 'Daily 9 am–6 pm',
      description_fr:
        'Macarons, afternoon tea et glaces italiennes dans le seul salon Ladurée du Luberon. Tous les jours 9h–18h. Tél. +33 4 88 85 40 40.',
      description_en:
        'Macarons, afternoon tea and Italian ice cream in the only Ladurée salon in the Luberon. Daily 9 am–6 pm. Tel. +33 4 88 85 40 40.',
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/salon-de-the-laduree-gordes',
      phone: '+33 4 88 85 40 40',
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : la seule terrasse Ladurée du Luberon. Idéale pour une pause à 17h après avoir flâné dans les ruelles caladées de Gordes.',
      tip_en:
        'My tip: the only Ladurée terrace in the Luberon. Ideal for a 5 pm break after wandering Gordes’ cobbled lanes.',
    },
    {
      name: 'Beefbar Gordes',
      type_fr: 'Grill & viandes au feu · Ouverture 4 juin 2026',
      type_en: 'Fire grill & meats · opens 4 June 2026',
      features: ['Cuissons au feu', 'Saison estivale'],
      description_fr:
        'La nouveauté de l’été 2026 : grill de viandes au feu de bois, esprit convivial et saison estivale. Réservation via SevenRooms dès maintenant.',
      description_en:
        'The summer 2026 newcomer: wood-fired meat grill, convivial spirit and seasonal opening. Book via SevenRooms now.',
      reservation_url:
        'https://www.sevenrooms.com/explore/beefbargordes/reservations/create/search/',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : la nouveauté de l’été 2026. Ouverture le 4 juin — réservez dès maintenant via SevenRooms, l’adresse fera le plein dès l’ouverture.',
      tip_en:
        'My tip: the summer 2026 newcomer. Opens 4 June — book now via SevenRooms; the place will fill from day one.',
    },
    {
      name: 'Le Brunch du Dimanche',
      type_fr: 'Brunch · La Table de La Bastide · Dimanche',
      type_en: 'Brunch · La Table de La Bastide · Sunday',
      features: ['Buffet sucré & salé', 'Jardins suspendus'],
      hours_fr: 'Tous les dimanches 12h–14h15',
      hours_en: 'Every Sunday 12–2:15 pm',
      description_fr:
        'Buffet sucré et salé dans les jardins suspendus, tous les dimanches 12h–14h15. Ouvert aux visiteurs extérieurs — réservez 48h à l’avance.',
      description_en:
        'Sweet and savoury buffet in the hanging gardens, every Sunday 12–2:15 pm. Open to outside guests — book 48 h ahead.',
      website: 'https://airelles.com/fr/destination/gordes-hotel/restaurants/brunch-dimanche',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : le brunch du dimanche est ouvert aux visiteurs extérieurs — réservez 48 h à l’avance, les tables partent vite en été.',
      tip_en:
        'My tip: the Sunday brunch is open to outside guests — book 48 h ahead, tables fill fast in summer.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — 4 sous-sections (visit / do / eat / shop). Distances/
// coords approx. depuis le centre de Gordes (~43.911, 5.200). Sourcé Tavily
// (2026-06-02 ; tables « eat » ajoutées 2026-06-09, statut MICHELIN vérifié).
// ---------------------------------------------------------------------------

export const AIRELLES_POINTS_OF_INTEREST = [
  {
    name: 'Château de Gordes',
    name_en: 'Château de Gordes',
    type: 'castle',
    category_fr: 'Monument & patrimoine',
    category_en: 'Monument & heritage',
    distance_meters: 400,
    walk_minutes: 6,
    latitude: 43.9112,
    longitude: 5.2008,
    bucket: 'visit',
    description_fr:
      'Château Renaissance du XVIe siècle au cœur du village, classé Monument historique. Sa façade et son escalier d’honneur dominent la place centrale de Gordes.',
    description_en:
      '16th-century Renaissance castle in the heart of the village, listed Monument historique. Its façade and grand staircase overlook the central square of Gordes.',
    website: 'https://chateaudegordes.com',
    phone: '+33 4 32 50 11 41',
    address: 'Place du Château, 84220 Gordes',
    hours_fr: 'Tous les jours, 10h–13h et 13h30–17h30',
    hours_en: 'Daily, 10 am–1 pm and 1:30–5:30 pm',
    price_note_fr: '6 € adulte · 4 € étudiant · gratuit -12 ans',
    price_note_en: '€6 adult · €4 student · free under 12',
    tip_fr:
      'Mon conseil : 6 minutes à pied depuis La Bastide. Montez en fin de matinée, puis enchaînez avec un café sur la place du Château juste en contrebas.',
    tip_en:
      'My tip: a 6-minute walk from La Bastide. Go late morning, then settle for a coffee on the Place du Château just below.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-chateau-de-gordes',
  },
  {
    name: 'Caves du Palais Saint-Firmin',
    name_en: 'Caves of the Palais Saint-Firmin',
    type: 'heritage',
    category_fr: 'Site troglodyte',
    category_en: 'Troglodyte site',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 43.911,
    longitude: 5.201,
    bucket: 'visit',
    description_fr:
      'Réseau de caves semi-troglodytes creusées dans la roche sous le village : ancien moulin à huile, citernes et escaliers étagés, avec un jardin en terrasse et une vue sur la vallée.',
    description_en:
      'A network of semi-troglodyte cellars carved into the rock beneath the village: a former oil mill, cisterns and tiered staircases, with a terraced garden and valley views.',
    website: 'https://www.caves-saint-firmin.com',
    address: 'Rue du Belvédère, 84220 Gordes',
    hours_fr: 'Tous les jours du 4 avril au 1er novembre, 10h30–13h et 14h30–18h',
    hours_en: 'Daily, 4 April–1 November, 10:30 am–1 pm and 2:30–6 pm',
    price_note_fr: '6 € adulte',
    price_note_en: '€6 adult',
    tip_fr:
      'Mon conseil : 5 minutes à pied. Visitez en début d’après-midi quand le village est écrasé de soleil — les caves restent fraîches et la lumière sur la vallée est superbe.',
    tip_en:
      'My tip: a 5-minute walk. Visit in the early afternoon when the village bakes in the sun — the cellars stay cool and the valley light is superb.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-caves-saint-firmin',
  },
  {
    name: 'Village des Bories',
    name_en: 'Village des Bories',
    type: 'museum',
    category_fr: 'Musée de plein air',
    category_en: 'Open-air museum',
    distance_meters: 3500,
    latitude: 43.9006,
    longitude: 5.1869,
    bucket: 'visit',
    description_fr:
      'Hameau classé Monument historique de cabanes en pierre sèche (bories), musée d’habitat rural présentant les outils et le mode de vie provençal d’autrefois.',
    description_en:
      'A listed hamlet of dry-stone huts (bories), an open-air museum of rural dwellings showing the tools and the way of life of old Provence.',
    website: 'https://www.levillagedesbories.com',
    phone: '+33 4 90 72 03 48',
    address: 'Route de Sénanque (D15), 84220 Gordes',
    hours_fr: 'Toute l’année sauf 25 décembre et 1er janvier',
    hours_en: 'Year-round except 25 December and 1 January',
    price_note_fr: '8 € adulte · 4 € (12–17 ans) · gratuit -12 ans',
    price_note_en: '€8 adult · €4 (ages 12–17) · free under 12',
    tip_fr:
      'Mon conseil : à 5 minutes en voiture. Allez-y tôt le matin, avant l’arrivée des cars — la lumière rasante sur les bories est faite pour la photo.',
    tip_en:
      'My tip: a 5-minute drive. Go early morning, before the coaches arrive — the low light on the bories is made for photographs.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-village-des-bories',
  },
  {
    name: 'Abbaye Notre-Dame de Sénanque',
    name_en: 'Notre-Dame de Sénanque Abbey',
    type: 'monastery',
    category_fr: 'Abbaye cistercienne',
    category_en: 'Cistercian abbey',
    distance_meters: 4200,
    latitude: 43.9285,
    longitude: 5.1869,
    bucket: 'visit',
    description_fr:
      'Abbaye cistercienne fondée en 1148, monastère encore en activité. Ses champs de lavande, en fleur de mi-juin à mi-juillet, en font l’image emblématique de la Provence.',
    description_en:
      'A Cistercian abbey founded in 1148, still an active monastery. Its lavender fields, in bloom from mid-June to mid-July, are the emblematic image of Provence.',
    website: 'https://www.senanque.fr',
    address: 'Sénanque, 84220 Gordes',
    hours_fr: 'Ouvert tous les jours — visites guidées sur réservation (senanque.fr)',
    hours_en: 'Open daily — guided tours by reservation (senanque.fr)',
    price_note_fr: 'Visite guidée 8 €',
    price_note_en: 'Guided tour €8',
    tip_fr:
      'Mon conseil : 8 minutes en voiture. Réservez la première visite guidée du matin, à l’ouverture — la lavande est photographiée sans la foule, et la lumière y est rasante.',
    tip_en:
      'My tip: an 8-minute drive. Book the first guided tour of the morning, at opening — you photograph the lavender without the crowd, in raking light.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-abbaye-senanque',
  },
  {
    name: 'Musée du Moulin des Bouillons',
    name_en: 'Moulin des Bouillons Museum',
    type: 'museum',
    category_fr: 'Musée du verre & du vitrail',
    category_en: 'Glass & stained-glass museum',
    distance_meters: 6000,
    latitude: 43.8835,
    longitude: 5.2167,
    bucket: 'visit',
    description_fr:
      'Ancien moulin à huile abritant un musée de l’histoire du verre et du vitrail, dans un parc planté d’oliviers. L’un des plus anciens moulins conservés de la région.',
    description_en:
      'A former oil mill housing a museum of the history of glass and stained glass, set in an olive grove. One of the oldest preserved mills in the region.',
    website: 'https://www.musee-verre-vitrail.fr',
    phone: '+33 4 90 72 22 11',
    address: '1953 Route de Saint-Pantaléon (D148), 84220 Gordes',
    hours_fr: 'Avril à septembre — mardi, jeudi et dimanche, 14h–17h30',
    hours_en: 'April to September — Tuesday, Thursday and Sunday, 2–5:30 pm',
    price_note_fr: '7,50 € adulte · 5,50 € tarif réduit · gratuit -12 ans',
    price_note_en: '€7.50 adult · €5.50 reduced · free under 12',
    tip_fr:
      'Mon conseil : 10 minutes en voiture, sur la route de Saint-Pantaléon. Ouverture limitée à trois jours par semaine — vérifiez le jour avant de partir.',
    tip_en:
      'My tip: a 10-minute drive on the Saint-Pantaléon road. Open only three days a week — check the day before you set off.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-moulin-des-bouillons',
  },
  {
    name: 'Le C — Hôtel Carcarille',
    name_en: 'Le C — Hôtel Carcarille',
    type: 'restaurant',
    category_fr: 'Restaurant gastronomique',
    category_en: 'Gourmet restaurant',
    distance_meters: 1800,
    latitude: 43.905,
    longitude: 5.195,
    bucket: 'do',
    description_fr:
      'Table raffinée d’un hôtel familial 3 étoiles, cuisine provençale aux produits locaux servie sur une terrasse ombragée, à quelques minutes du village.',
    description_en:
      'The refined table of a family-run 3-star hotel, Provençal cuisine from local produce served on a shaded terrace, minutes from the village.',
    website: 'https://www.carcarille.com',
    phone: '+33 4 90 72 02 63',
    address: 'Les Gervais (D2), 84220 Gordes',
    tip_fr:
      'Mon conseil : une alternative au village, plus confidentielle. Réservez la terrasse au déjeuner, garez-vous sur le parking gratuit de l’hôtel.',
    tip_en:
      'My tip: a quieter alternative to the village. Book the terrace for lunch and use the hotel’s free car park.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-carcarille',
  },
  {
    name: 'Mas de la Sénancole',
    name_en: 'Mas de la Sénancole',
    type: 'restaurant',
    category_fr: 'Restaurant d’hôtel · Les Imberts',
    category_en: 'Hotel restaurant · Les Imberts',
    distance_meters: 4000,
    latitude: 43.879,
    longitude: 5.185,
    bucket: 'do',
    description_fr:
      'Restaurant d’un mas provençal de charme au hameau des Imberts, cuisine du marché et terrasse au bord de la piscine, sur la route de l’abbaye de Sénanque.',
    description_en:
      'The restaurant of a charming Provençal mas in the Les Imberts hamlet, market cuisine and a poolside terrace, on the road to the Sénanque abbey.',
    website: 'https://www.mas-de-la-senancole.com',
    phone: '+33 4 90 76 76 55',
    address: 'Les Imberts, 2171 Avenue Justin Bonfils, 84220 Gordes',
    tip_fr:
      'Mon conseil : sur la route de Sénanque, idéal en milieu d’après-midi avant ou après la lavande. Pensez à réserver le week-end.',
    tip_en:
      'My tip: on the Sénanque road, ideal in mid-afternoon before or after the lavender. Book ahead at weekends.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-mas-senancole',
  },
  {
    name: 'Marché provençal de Gordes',
    name_en: 'Gordes Provençal market',
    type: 'market',
    category_fr: 'Marché hebdomadaire',
    category_en: 'Weekly market',
    distance_meters: 300,
    walk_minutes: 4,
    latitude: 43.9116,
    longitude: 5.2003,
    bucket: 'do',
    bucket_tip_fr:
      'Mon conseil : réservez la veille et partez tôt — le Luberon se savoure au lever du jour, avant la chaleur et les cars.',
    bucket_tip_en:
      'My tip: book the day before and set off early — the Luberon is best at daybreak, before the heat and the coaches.',
    description_fr:
      'L’un des marchés les plus courus du Parc naturel régional du Luberon : primeurs, fromages, huiles d’olive, savons et poteries autour de la place du Monument.',
    description_en:
      'One of the busiest markets in the Luberon Regional Park: fruit and veg, cheeses, olive oils, soaps and pottery around the Place du Monument.',
    website: 'https://luberon.fr/tourisme/marches/marches-forains/annu+marche-de-gordes+1935.html',
    address: 'Place du Monument, 84220 Gordes',
    hours_fr: 'Le mardi matin, 8h–13h',
    hours_en: 'Tuesday morning, 8 am–1 pm',
    price_note_fr: 'Accès libre',
    price_note_en: 'Free entry',
    tip_fr:
      'Mon conseil : 4 minutes à pied. Descendez avant 9h, panier à la main — à midi les meilleurs étals de tapenade et de chèvre sont dévalisés.',
    tip_en:
      'My tip: a 4-minute walk. Go down before 9 am, basket in hand — by noon the best tapenade and goat-cheese stalls are sold out.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-marche-gordes',
  },
  {
    name: 'Randonnée du Col de Gordes',
    name_en: 'Col de Gordes hike',
    type: 'hike',
    category_fr: 'Randonnée · panorama',
    category_en: 'Hike · viewpoint',
    distance_meters: 1500,
    latitude: 43.9155,
    longitude: 5.205,
    bucket: 'do',
    description_fr:
      'Boucle familiale accessible au départ du village, vers les monts de Vaucluse et la vallée du Luberon : sentiers balisés, oratoires de pierre et vues sur le village perché.',
    description_en:
      'An easy family loop from the village toward the Vaucluse hills and the Luberon valley: way-marked paths, stone oratories and views over the hilltop village.',
    website: 'https://www.destinationluberon.com/page/le-col-de-gordes+62763.html',
    price_note_fr: 'Accès libre',
    price_note_en: 'Free access',
    tip_fr:
      'Mon conseil : partez tôt, avant la chaleur. La réception vous prête une carte des sentiers — la boucle se fait en 1h30, chaussures fermées conseillées.',
    tip_en:
      'My tip: set off early, before the heat. Reception lends a trail map — the loop takes 1h30; closed shoes recommended.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-randonnee-col-de-gordes',
  },
  {
    name: 'Vol en montgolfière — Montgolfière Luberon',
    name_en: 'Hot-air balloon — Montgolfière Luberon',
    type: 'activity',
    category_fr: 'Survol du Luberon',
    category_en: 'Luberon balloon flight',
    distance_meters: 10000,
    latitude: 43.9025,
    longitude: 5.2925,
    bucket: 'do',
    description_fr:
      'Vol au lever du soleil au départ de Roussillon, au-dessus des ocres, des villages perchés et des champs de lavande. Une heure environ dans les airs, suivie du verre de l’amitié.',
    description_en:
      'A sunrise flight from Roussillon over the ochre cliffs, hilltop villages and lavender fields. About an hour aloft, followed by the traditional toast.',
    website: 'https://www.montgolfiere-luberon.com',
    reservation_url: 'https://www.montgolfiere-luberon.fr/tarifs.php',
    address: '1066 Route des Gaillanes, 84220 Roussillon',
    price_note_fr: '250 € par personne · 500 € pour deux',
    price_note_en: '€250 per person · €500 for two',
    tip_fr:
      'Mon conseil : à 15 minutes en voiture. Réservez la veille le créneau du lever du soleil — c’est le seul moment où l’air est assez stable, et la lumière sur les ocres est irréelle.',
    tip_en:
      'My tip: a 15-minute drive. Book the sunrise slot the day before — it is the only time the air is stable enough, and the light on the ochres is unreal.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-montgolfiere-luberon',
  },
  {
    name: 'Location de vélos électriques — Electric Move',
    name_en: 'E-bike rental — Electric Move',
    type: 'activity',
    category_fr: 'Vélo électrique · Luberon',
    category_en: 'E-bike · Luberon',
    distance_meters: 8000,
    latitude: 43.8762,
    longitude: 5.1585,
    bucket: 'do',
    description_fr:
      'Loueur de vélos à assistance électrique à Coustellet, idéal pour relier Gordes, Roussillon et les villages perchés sans souffrir des montées. Casques et accessoires fournis.',
    description_en:
      'An e-bike rental at Coustellet, ideal for linking Gordes, Roussillon and the hilltop villages without dreading the climbs. Helmets and accessories provided.',
    website: 'https://electricmove.fr',
    phone: '+33 4 65 30 00 10',
    address: '213 Route d’Apt, Coustellet, 84220 Cabrières-d’Avignon',
    price_note_fr: 'Location à la journée — réservation conseillée en haute saison',
    price_note_en: 'Daily rental — booking advised in high season',
    tip_fr:
      'Mon conseil : à 10 minutes. Prenez le vélo électrique, pas le musculaire — entre Gordes et Roussillon, les côtes sont raides et la chaleur traître l’après-midi.',
    tip_en:
      'My tip: a 10-minute drive. Take the electric bike, not the manual one — between Gordes and Roussillon the climbs are steep and the afternoon heat is treacherous.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-electric-move',
  },
  {
    name: 'Domaine des Peyre — dégustation',
    name_en: 'Domaine des Peyre — wine tasting',
    type: 'winery',
    category_fr: 'Domaine viticole bio',
    category_en: 'Organic wine estate',
    distance_meters: 18000,
    latitude: 43.8722,
    longitude: 5.1185,
    bucket: 'do',
    description_fr:
      'Domaine en agriculture biologique au pied du Luberon : dégustation de vins en AOC Luberon, parcours d’art contemporain dans les vignes et soirées Jazz’n Wine en été.',
    description_en:
      'An organic wine estate at the foot of the Luberon: tastings of AOC Luberon wines, a contemporary-art trail through the vines and Jazz’n Wine evenings in summer.',
    website: 'https://www.domainedespeyre.com',
    phone: '+33 6 08 92 87 71',
    address: '1620 Route d’Avignon, 84440 Robion',
    hours_fr: 'D’avril à septembre, tous les jours',
    hours_en: 'April to September, daily',
    price_note_fr: 'Dégustation sur réservation · soirée Jazz’n Wine 15 € (jeudis de juillet–août)',
    price_note_en: 'Tasting by reservation · Jazz’n Wine evening €15 (Thursdays in July–August)',
    tip_fr:
      'Mon conseil : à 20 minutes. Téléphonez la veille pour caler la dégustation ; en juillet-août, visez un jeudi soir pour le Jazz’n Wine, food trucks dans les vignes.',
    tip_en:
      'My tip: a 20-minute drive. Call the day before to set the tasting; in July–August aim for a Thursday evening for Jazz’n Wine, food trucks among the vines.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-domaine-des-peyre',
  },
  {
    name: 'Le Fournil de Mamie Jeanne',
    name_en: 'Le Fournil de Mamie Jeanne',
    type: 'bakery',
    category_fr: 'Boulangerie · pâtisserie',
    category_en: 'Bakery · patisserie',
    distance_meters: 280,
    walk_minutes: 4,
    latitude: 43.9118,
    longitude: 5.1996,
    bucket: 'shop',
    bucket_tip_fr:
      'Mon conseil : tout est à pied dans le village — la réception garde ces adresses sous la main si vous manquez quelque chose.',
    bucket_tip_en:
      'My tip: everything is walkable in the village — reception keeps these addresses handy if you run short of anything.',
    description_fr:
      'Boulangerie artisanale au cœur du village depuis 2016 : pains au levain, fougasses à l’huile d’olive et viennoiseries pour le pique-nique du midi.',
    description_en:
      'An artisan bakery in the heart of the village since 2016: sourdough breads, olive-oil fougasses and pastries for the midday picnic.',
    website: 'https://www.mamie-jeanne-patisserie-gordes.fr',
    phone: '+33 4 90 72 09 34',
    address: '55 Rue Baptistin Picca, 84220 Gordes',
    tip_fr:
      'Mon conseil : 4 minutes à pied. Passez avant la rando — une fougasse aux olives et deux parts de tarte, et vous tenez jusqu’au soir.',
    tip_en:
      'My tip: a 4-minute walk. Stop before the hike — an olive fougasse and two slices of tart will see you through to the evening.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-fournil-mamie-jeanne',
  },
  {
    name: 'Maison Brémond 1830',
    name_en: 'Maison Brémond 1830',
    type: 'deli',
    category_fr: 'Épicerie fine provençale',
    category_en: 'Provençal delicatessen',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 43.9112,
    longitude: 5.2008,
    bucket: 'shop',
    description_fr:
      'Épicerie fine sur la place du Château : huiles d’olive, tapenades, miels, calissons et confitures — la maison idéale pour les cadeaux gourmands à rapporter.',
    description_en:
      'A fine-food boutique on the Place du Château: olive oils, tapenades, honeys, calissons and jams — the place for edible gifts to take home.',
    website: 'https://www.mb-1830.com/fr/nos-epiceries-fines',
    phone: '+33 4 90 72 80 49',
    address: 'Place du Château, 84220 Gordes',
    tip_fr:
      'Mon conseil : 5 minutes à pied, juste sous le Château. Demandez l’huile d’olive de la dernière récolte — ils la font goûter avant l’achat.',
    tip_en:
      'My tip: a 5-minute walk, right below the Château. Ask for the latest-harvest olive oil — they let you taste before you buy.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-maison-bremond',
  },
  {
    name: 'Moulin du Clos des Jeannons',
    name_en: 'Moulin du Clos des Jeannons',
    type: 'producer',
    category_fr: 'Moulin à huile d’olive',
    category_en: 'Olive-oil mill',
    distance_meters: 2600,
    latitude: 43.9275,
    longitude: 5.2105,
    bucket: 'shop',
    description_fr:
      'Moulin familial depuis 2002, 27 hectares d’oliviers de variété aglandau. Vente directe de l’huile d’olive du domaine et visite du moulin sur la route de Murs.',
    description_en:
      'A family mill since 2002, 27 hectares of aglandau olive trees. Direct sale of the estate’s olive oil and a mill visit on the Murs road.',
    website: 'https://www.moulinjeannons.com',
    address: 'Route de Murs, 84220 Gordes',
    tip_fr:
      'Mon conseil : à 5 minutes en voiture. Téléphonez avant de monter — la vente se fait au moulin, et l’huile d’aglandau est plus douce que celle du marché.',
    tip_en:
      'My tip: a 5-minute drive. Call before going up — the sale is at the mill, and the aglandau oil is gentler than the market’s.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-moulin-jeannons',
  },
  {
    name: 'Pharmacie de Gordes',
    name_en: 'Gordes pharmacy',
    type: 'pharmacy',
    category_fr: 'Pharmacie',
    category_en: 'Pharmacy',
    distance_meters: 300,
    walk_minutes: 4,
    latitude: 43.9109,
    longitude: 5.2012,
    bucket: 'shop',
    description_fr:
      'La pharmacie du village, rue de l’Église, pour les petits imprévus du séjour : crème solaire, anti-moustiques, premiers soins.',
    description_en:
      'The village pharmacy on Rue de l’Église, for the small surprises of a stay: sun cream, insect repellent, first aid.',
    phone: '+33 4 90 72 02 10',
    address: '2 Rue de l’Église, 84220 Gordes',
    hours_fr: 'Du lundi au samedi, 9h–12h30 et 14h30–19h',
    hours_en: 'Monday to Saturday, 9 am–12:30 pm and 2:30–7 pm',
    tip_fr:
      'Mon conseil : 4 minutes à pied. En été, pensez à l’anti-moustiques et à la crème indice 50 — le soleil du Luberon ne pardonne pas en terrasse.',
    tip_en:
      'My tip: a 4-minute walk. In summer, remember insect repellent and SPF 50 — the Luberon sun is merciless on the terrace.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-pharmacie-gordes',
  },
  // ── eat — tables autour de l'hôtel (hors restaurants de La Bastide).
  //    Statut MICHELIN + cuisine vérifiés via le Guide MICHELIN (Tavily
  //    2026-06-09). Coords/distances approximatives au niveau du village.
  {
    name: 'Les Bories',
    name_en: 'Les Bories',
    type: 'restaurant',
    category_fr: 'Restaurant gastronomique · 1 étoile MICHELIN',
    category_en: 'Gourmet restaurant · 1 MICHELIN star',
    distance_meters: 1800,
    latitude: 43.918,
    longitude: 5.187,
    bucket: 'eat',
    description_fr:
      'Restaurant gastronomique étoilé au Guide MICHELIN, au sein de l’hôtel Les Bories & Spa sur la route de Sénanque. Cuisine provençale contemporaine et terrasse face au Luberon, à quelques minutes de Gordes.',
    description_en:
      'MICHELIN-starred gourmet restaurant within the Les Bories & Spa hotel on the Sénanque road. Contemporary Provençal cuisine and a terrace facing the Luberon, minutes from Gordes village.',
    bucket_tip_fr:
      'Autour de Gordes, deux tables étoilées et un bistrot de village : de quoi varier les plaisirs selon l’envie du soir.',
    bucket_tip_en:
      'Around Gordes, two starred tables and a village bistro — enough to vary the mood from one evening to the next.',
    tip_fr:
      'Mon conseil : réservez la terrasse au coucher du soleil — la vue sur le Luberon vaut autant le détour que l’assiette.',
    tip_en: 'My tip: book the terrace at sunset — the Luberon view is as memorable as the plate.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-les-bories',
  },
  {
    name: 'La Table de Xavier Mathieu — Le Phébus',
    name_en: 'La Table de Xavier Mathieu — Le Phébus',
    type: 'restaurant',
    category_fr: 'Restaurant gastronomique · étoilé MICHELIN',
    category_en: 'Gourmet restaurant · MICHELIN-starred',
    distance_meters: 5500,
    latitude: 43.926,
    longitude: 5.234,
    bucket: 'eat',
    description_fr:
      'Table étoilée du chef Xavier Mathieu, à l’hôtel Le Phébus & Spa à Joucas. Cuisine provençale créative et vue sur le massif du Luberon, à une dizaine de minutes en voiture de Gordes.',
    description_en:
      'Chef Xavier Mathieu’s MICHELIN-starred table at Le Phébus & Spa in Joucas. Creative Provençal cuisine with views over the Luberon massif, about ten minutes’ drive from Gordes.',
    website: 'https://www.lephebus.com',
    tip_fr:
      'Mon conseil : prévoyez la voiture et réservez tôt — la table de Xavier Mathieu affiche vite complet en saison.',
    tip_en:
      'My tip: plan to drive and book early — Xavier Mathieu’s table fills up fast in season.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-le-phebus',
  },
  {
    name: 'La Bartavelle',
    name_en: 'La Bartavelle',
    type: 'restaurant',
    category_fr: 'Bistrot de village',
    category_en: 'Village bistro',
    distance_meters: 9000,
    latitude: 43.864,
    longitude: 5.252,
    bucket: 'eat',
    description_fr:
      'Bistrot intime du village de Goult, salué par les amateurs de la région pour sa cuisine de saison à prix doux. Une adresse conviviale à une vingtaine de minutes de Gordes.',
    description_en:
      'Intimate bistro in the village of Goult, praised by regional food lovers for its gently-priced seasonal cooking. A convivial address about twenty minutes from Gordes.',
    tip_fr:
      'Mon conseil : parfait pour un déjeuner sans chichi entre deux villages perchés ; pensez à réserver le week-end.',
    tip_en: 'My tip: ideal for a relaxed lunch between hilltop villages; do book on weekends.',
    image_public_id: 'cct/hotels/les-airelles-gordes/poi-la-bartavelle',
  },
] as const;

// ---------------------------------------------------------------------------
// highlights — bilingues
// ---------------------------------------------------------------------------

export const AIRELLES_HIGHLIGHTS = [
  {
    label_fr: 'Palace 18e siècle dominant le village perché de Gordes',
    label_en: '18th-century Palace overlooking the hilltop village of Gordes',
  },
  {
    label_fr: '40 chambres et suites, parquets point de Hongrie et mobilier chiné',
    label_en: '40 rooms and suites, herringbone parquet and antique furniture',
  },
  {
    label_fr: 'Trois piscines : terrasse panoramique, piscine intérieure du spa, bassin enfants',
    label_en: 'Three pools: a panoramic terrace pool, an indoor spa pool and a children’s pool',
  },
  {
    label_fr: 'Clover Gordes, table provençale de Jean-François Piège',
    label_en: 'Clover Gordes, the Provençal table of Jean-François Piège',
  },
  {
    label_fr: 'Spa Airelles sous voûtes en pierre, vue sur la vallée du Luberon',
    label_en: 'Spa Airelles under stone vaults, with views over the Luberon valley',
  },
  {
    label_fr: 'Airelles Summer Camp : club enfants et piscine dédiée',
    label_en: 'Airelles Summer Camp: a children’s club and dedicated pool',
  },
] as const;

// ---------------------------------------------------------------------------
// faq_content — FAQ client (ton concierge digital, conversion) + Top 5 featured
// Source : FAQ Client Airelles Gordes ; faits alignés golden officiel
// ---------------------------------------------------------------------------

export const AIRELLES_FAQ_CONTENT_KIT = [
  // —— Top 5 Concierge (questions client → concierge, pas le catalogue) ——
  {
    category: 'during',
    featured: true,
    question_fr: 'Où dîner ce soir si Clover est complet ?',
    question_en: 'Where should we dine tonight if Clover is fully booked?',
    answer_fr:
      'Pas de panique : La Bastide de Pierres tient la route pour un dîner convivial, La Table reste sûre en terrasse. Je bloque une table pour vous — idéalement vers 19h45, lumière parfaite sur le Luberon.',
    answer_en:
      'No panic: La Bastide de Pierres works for a relaxed dinner; La Table is the safe terrace bet. I’ll lock a table for you — ideally around 7:45 pm, perfect Luberon light.',
    concierge_tip_fr:
      'Demandez la terrasse de Clover pour un autre soir : je surveille les créneaux pour vous.',
    concierge_tip_en: 'Ask for Clover’s terrace on another evening — I’ll watch the slots for you.',
  },
  {
    category: 'before',
    featured: true,
    question_fr: 'Pouvez-vous organiser un chauffeur depuis Marseille ou Avignon ?',
    question_en: 'Can you arrange a chauffeur from Marseille or Avignon?',
    answer_fr:
      'Avec plaisir. Avignon TGV est à 50 minutes, Marseille-Provence à environ une heure. Je programme le transfert privé avec accueil nominatif — envoyez-moi vos horaires de vol.',
    answer_en:
      'With pleasure. Avignon TGV is 50 minutes away; Marseille-Provence about an hour. I’ll schedule a private transfer with a personalised meet-and-greet — send me your flight times.',
    concierge_tip_fr:
      'Réservez le transfert retour dès l’arrivée : les créneaux matin partent vite en haute saison.',
    concierge_tip_en:
      'Book your return transfer on arrival — morning slots go fast in peak season.',
  },
  {
    category: 'during',
    featured: true,
    question_fr: 'Peut-on visiter l’abbaye de Sénanque en famille avec des enfants ?',
    question_en: 'Can we visit Sénanque Abbey as a family with children?',
    answer_fr:
      'Oui, c’est une sortie que les enfants adorent. Je réserve la visite guidée sur senanque.fr et organise le transfert depuis La Bastide — comptez 2 km, idéal en matinée avant la chaleur.',
    answer_en:
      'Yes — children love it. I’ll book the guided tour on senanque.fr and arrange the transfer from La Bastide — 2 km away, best in the morning before the heat.',
    concierge_tip_fr:
      'Mi-juin à mi-juillet : réservez la visite une semaine avant pour les champs en fleur.',
    concierge_tip_en: 'Mid-June to mid-July: book the tour a week ahead for fields in bloom.',
  },
  {
    category: 'during',
    featured: true,
    question_fr: 'Auriez-vous une disponibilité pour un soin spa ce soir ?',
    question_en: 'Do you have spa treatment availability tonight?',
    answer_fr:
      'Je vérifie tout de suite au Spa Airelles by Guerlain (10h–20h). Massage, rituel Guerlain ou soin duo en cabine VIP — je confirme par spa.labastide@airelles.com ou au 04 90 72 18 90.',
    answer_en:
      'I’ll check now at the Airelles Spa by Guerlain (10 am–8 pm). Massage, Guerlain ritual or couples VIP suite — I confirm via spa.labastide@airelles.com or +33 4 90 72 18 90.',
    concierge_tip_fr:
      'Les créneaux de fin de journée partent vite : je vous propose une alternative hammam si besoin.',
    concierge_tip_en: 'Late-day slots sell out fast — I’ll suggest the hammam if we need a plan B.',
  },
  {
    category: 'during',
    featured: true,
    question_fr: 'Comment organiser une montgolfière au lever du soleil ?',
    question_en: 'How do we arrange a sunrise hot-air balloon flight?',
    answer_fr:
      'Je contacte Montgolfière Luberon depuis Roussillon : réservez le créneau lever du soleil la veille. Prise en charge à La Bastide, comptez une heure dans les airs — un souvenir inoubliable sur le Luberon.',
    answer_en:
      'I’ll contact Montgolfière Luberon from Roussillon: book the sunrise slot the day before. Pick-up at La Bastide, about an hour in the air — an unforgettable Luberon memory.',
    concierge_tip_fr:
      'Combinez avec un déjeuner tardif en terrasse : je synchronise les horaires pour vous.',
    concierge_tip_en: 'Pair it with a late terrace lunch — I’ll sync the timings for you.',
  },
  // —— Arrivée & départ ——
  {
    category: 'before',
    question_fr: 'À quelle heure sont le check-in et le check-out ?',
    question_en: 'What are the check-in and check-out times?',
    answer_fr:
      'Check-in dès 15h, check-out jusqu’à 12h. Early check-in ou late check-out selon disponibilité — je m’en occupe avec la réception avant votre arrivée.',
    answer_en:
      'Check-in from 3 pm, check-out until noon. Early check-in or late check-out subject to availability — I’ll arrange it with reception before you arrive.',
  },
  {
    category: 'before',
    question_fr: 'Peut-on déposer les bagages avant le check-in ?',
    question_en: 'Can we leave luggage before check-in?',
    answer_fr:
      'Oui, la conciergerie garde vos bagages en toute sécurité. Vous explorez Gordes ou la vallée pendant que la chambre se prépare — je vous envoie un message dès qu’elle est prête.',
    answer_en:
      'Yes, the concierge stores your luggage securely. Explore Gordes or the valley while the room is prepared — I’ll message you once it’s ready.',
  },
  {
    category: 'before',
    question_fr: 'Y a-t-il un parking à l’hôtel ?',
    question_en: 'Is there parking at the hotel?',
    answer_fr:
      'Oui, parking privé sur place et service voiturier. À votre arrivée, laissez la clé au voiturier — je coordonne si vous avez besoin d’une voiture de location pour le Luberon.',
    answer_en:
      'Yes, private on-site parking and valet service. On arrival, leave the key with the valet — I’ll coordinate a rental car if you need one for the Luberon.',
  },
  {
    category: 'before',
    question_fr: 'Quels documents sont nécessaires à l’arrivée ?',
    question_en: 'What documents are required on arrival?',
    answer_fr:
      'Une pièce d’identité et une carte de bancaire pour la caution. Envoyez-moi vos préférences chambre avant l’arrivée : je prépare tout avec la réception.',
    answer_en:
      'An ID and a bank card for the deposit. Send me your room preferences before arrival — I’ll prepare everything with reception.',
  },
  // —— Chambres & confort ——
  {
    category: 'during',
    question_fr: 'Le Wi-Fi et le minibar sont-ils inclus ?',
    question_en: 'Is Wi-Fi and the minibar included?',
    answer_fr:
      'Oui, Wi-Fi gratuit dans tout l’hôtel et minibar réapprovisionné quotidiennement en chambre. Si vous souhaitez une attention particulière à l’arrivée, je la programme avec la conciergerie.',
    answer_en:
      'Yes, complimentary Wi-Fi throughout and a minibar replenished daily in-room. For a special arrival touch, I’ll arrange it with the concierge team.',
  },
  {
    category: 'during',
    question_fr: 'Les animaux sont-ils acceptés en chambre ?',
    question_en: 'Are pets allowed in the room?',
    answer_fr:
      'Chiens et chats acceptés sur demande, dans certaines chambres et suites — 30 € par animal et par jour. Signalez-le à la réservation : je confirme la chambre adaptée avec vous.',
    answer_en:
      'Dogs and cats accepted on request, in selected rooms and suites — €30 per pet per day. Flag it when booking: I’ll confirm the right room with you.',
  },
  {
    category: 'during',
    question_fr: 'Y a-t-il un room service ?',
    question_en: 'Is room service available?',
    answer_fr:
      'Oui, service en chambre disponible. Pour un dîner intimiste ou un brunch tardif, je recommande la carte de La Table — je passe la commande pour vous.',
    answer_en:
      'Yes, room service is available. For an intimate dinner or late brunch, I recommend La Table’s menu — I’ll place the order for you.',
  },
  // —— Restauration ——
  {
    category: 'during',
    question_fr: 'Quels restaurants trouve-t-on à La Bastide ?',
    question_en: 'What restaurants are there at La Bastide?',
    answer_fr:
      'Six adresses : Clover Gordes (Jean-François Piège), La Table de La Bastide, le Brunch du dimanche, La Bastide de Pierres, le salon Ladurée et le Beefbar (ouverture le 4 juin 2026). Je réserve vos tables via SevenRooms ou la conciergerie.',
    answer_en:
      'Six venues: Clover Gordes (Jean-François Piège), La Table de La Bastide, Sunday Brunch, La Bastide de Pierres, the Ladurée salon and Beefbar (opening 4 June 2026). I book your tables via SevenRooms or the concierge.',
  },
  {
    category: 'during',
    question_fr: 'Le petit-déjeuner est-il inclus ?',
    question_en: 'Is breakfast included?',
    answer_fr:
      'Le petit-déjeuner buffet est proposé chaque matin à La Table — terrasse ou salon. Je vous suggère l’horaire idéal selon vos excursions du jour.',
    answer_en:
      'A buffet breakfast is served each morning at La Table — terrace or salon. I’ll suggest the ideal time based on your day’s excursions.',
  },
  {
    category: 'during',
    question_fr: 'Menus végétariens ou allergies : comment s’organiser ?',
    question_en: 'Vegetarian menus or allergies — how do we arrange this?',
    answer_fr:
      'Prévenez-moi avant le dîner : je transmets au chef de Clover, La Table ou Pierres. Chaque table adapte son menu — votre séjour reste fluide et sans stress.',
    answer_en:
      'Tell me before dinner: I’ll brief the chef at Clover, La Table or Pierres. Each venue adapts its menu — your stay stays smooth and stress-free.',
  },
  // —— Spa ——
  {
    category: 'during',
    question_fr: 'Qu’est-ce qui est inclus au Spa Airelles ?',
    question_en: 'What is included at the Spa Airelles?',
    answer_fr:
      'Piscine intérieure, hammam, sauna et salle de fitness inclus pour les résidents. Soins Guerlain, Barbara Sturm et Seed to Skin sur réservation — je m’occupe du planning.',
    answer_en:
      'Indoor pool, hammam, sauna and fitness room included for residents. Guerlain, Barbara Sturm and Seed to Skin treatments on reservation — I’ll handle the schedule.',
  },
  {
    category: 'during',
    question_fr: 'Les enfants peuvent-ils accéder au spa ?',
    question_en: 'Can children access the spa?',
    answer_fr:
      'Le spa est réservé aux adultes ; les moins de 12 ans ne sont pas admis sans accompagnement. Le Summer Camp et sa piscine dédiée accueillent les enfants pendant vos soins.',
    answer_en:
      'The spa is for adults; under-12s are not admitted without an adult. Summer Camp and its dedicated pool welcome children while you enjoy your treatment.',
  },
  // —— Activités & famille ——
  {
    category: 'during',
    question_fr: 'Quelles activités sont incluses pendant le séjour ?',
    question_en: 'Which activities are included during the stay?',
    answer_fr:
      'Vélos électriques, piscines extérieures en saison, piscine spa, cours de yoga, tennis et Kids Club. Coach personnel ou baby-sitting en supplément — je réserve selon vos envies.',
    answer_en:
      'E-bikes, outdoor pools in season, spa pool, yoga classes, tennis and Kids Club. Personal coach or babysitting at extra cost — I’ll book according to your plans.',
  },
  {
    category: 'during',
    question_fr: 'Comment occuper les enfants pendant que nous déjeunons en terrasse ?',
    question_en: 'How can we keep the children busy while we lunch on the terrace?',
    answer_fr:
      'L’Airelles Summer Camp accueille les enfants : piscine sécurisée, ateliers et cinéma en plein air. Je gère l’inscription — vous déjeunez sereinement sur la terrasse.',
    answer_en:
      'Airelles Summer Camp welcomes children: secure pool, workshops and open-air cinema. I’ll handle registration — you lunch peacefully on the terrace.',
  },
  {
    category: 'during',
    question_fr: 'Peut-on réserver une baby-sitter pour ce soir ?',
    question_en: 'Can we book a babysitter for tonight?',
    answer_fr:
      'Oui, sur demande via la conciergerie. Indiquez-moi l’horaire et l’âge des enfants : je confirme une nounou de confiance pour votre soirée en toute tranquillité.',
    answer_en:
      'Yes, on request through the concierge. Tell me the time and children’s ages: I’ll confirm a trusted babysitter for a worry-free evening.',
  },
  // —— Conciergerie & occasions ——
  {
    category: 'during',
    question_fr: 'Peut-on préparer une surprise en chambre pour une occasion ?',
    question_en: 'Can you arrange a room surprise for a special occasion?',
    answer_fr:
      'Anniversaire, lune de miel ou étape : décoration florale, champagne, gâteau — je coordonne tout avec la conciergerie. Donnez-moi la date et l’ambiance souhaitée.',
    answer_en:
      'Birthday, honeymoon or milestone: floral décor, champagne, cake — I coordinate everything with the concierge team. Give me the date and the mood you want.',
  },
  {
    category: 'during',
    question_fr: 'Blanchisserie, pressing ou livraison de fleurs ?',
    question_en: 'Laundry, pressing or flower delivery?',
    answer_fr:
      'Pressing et blanchisserie disponibles pendant le séjour. Fleurs ou cadeau en chambre : je passe la commande et assure la livraison à l’heure que vous choisissez.',
    answer_en:
      'Pressing and laundry available during your stay. Flowers or a gift in-room: I’ll place the order and deliver at the time you choose.',
  },
  // —— Alentours ——
  {
    category: 'before',
    question_fr: 'Quels incontournables visiter depuis La Bastide ?',
    question_en: 'What must-see sights are there from La Bastide?',
    answer_fr:
      'À pied : Château de Gordes et Caves Saint-Firmin. En voiture : Abbaye de Sénanque, Village des Bories, Roussillon, Lourmarin. Je construis votre itinéraire Luberon sur 1 ou 2 jours.',
    answer_en:
      'On foot: Château de Gordes and Saint-Firmin caves. By car: Sénanque Abbey, Village des Bories, Roussillon, Lourmarin. I’ll build your 1- or 2-day Luberon itinerary.',
  },
  {
    category: 'before',
    question_fr: 'Y a-t-il un marché local à ne pas manquer ?',
    question_en: 'Is there a local market not to miss?',
    answer_fr:
      'Le marché de Gordes le mardi matin est incontournable. L’Isle-sur-la-Sorgue et Apt complètent la semaine — je vous envoie le calendrier et réserve le chauffeur si besoin.',
    answer_en:
      'Gordes market on Tuesday morning is unmissable. L’Isle-sur-la-Sorgue and Apt round out the week — I’ll send the calendar and book a driver if needed.',
  },
  {
    category: 'during',
    question_fr: 'Peut-on organiser une dégustation dans un vignoble du Luberon ?',
    question_en: 'Can we arrange a wine tasting in a Luberon vineyard?',
    answer_fr:
      'Oui, les Côtes du Luberon sont à portée de main. Je réserve une visite privée en cave — souvent couplée à un déjeuner au domaine ou un retour tardif à La Bastide.',
    answer_en:
      'Yes, the Luberon slopes are close by. I’ll book a private cellar visit — often paired with lunch at the estate or a late return to La Bastide.',
  },
  {
    category: 'during',
    question_fr: 'Peut-on privatiser un dîner face aux lavandes de Sénanque ?',
    question_en: 'Can we book a private dinner facing the Sénanque lavender fields?',
    answer_fr:
      'Oui, c’est une signature Airelles : dîner privatif sous les cèdres, champagne et produits du marché, vue sur Sénanque. Je bloque la date avec la conciergerie — réservation indispensable.',
    answer_en:
      'Yes, it’s an Airelles signature: private dinner under the cedars, champagne and market produce, Sénanque in view. I’ll lock the date with the concierge team — booking essential.',
  },
  {
    category: 'during',
    question_fr: 'Quelles animations sont prévues ce soir à l’hôtel ?',
    question_en: 'What’s on at the hotel tonight?',
    answer_fr:
      'Concerts, cinéma en plein air et soirées thématiques selon la saison. Je vous envoie le programme du jour et réserve vos places si vous le souhaitez.',
    answer_en:
      'Concerts, open-air cinema and themed evenings depending on the season. I’ll send today’s programme and reserve your seats if you wish.',
  },
  // —— Réservation & facturation ——
  {
    category: 'after',
    question_fr: 'Comment réserver un séjour ou une table ?',
    question_en: 'How do I book a stay or a restaurant table?',
    answer_fr:
      'Réservez votre séjour en ligne ou contactez-moi : +33 4 90 72 12 12, reservation.labastide@airelles.com. Tables, spa et excursions : je centralise tout pour vous.',
    answer_en:
      'Book your stay online or contact me: +33 4 90 72 12 12, reservation.labastide@airelles.com. Tables, spa and excursions: I centralise everything for you.',
  },
  {
    category: 'after',
    question_fr: 'Comment sont facturés les extras ?',
    question_en: 'How are extras billed?',
    answer_fr:
      'Les extras (restaurant, spa, transferts) s’ajoutent à votre note de chambre ou sont réglés sur place. Toutes les cartes internationales majeures sont acceptées.',
    answer_en:
      'Extras (dining, spa, transfers) are added to your room bill or settled on site. All major international cards are accepted.',
  },
  {
    category: 'agency',
    question_fr: 'À quelle période La Bastide est-elle ouverte ?',
    question_en: 'When is La Bastide open?',
    answer_fr:
      'Établissement saisonnier, ouvert du printemps à l’automne. Le Beefbar ouvre le 4 juin 2026. Pour les dates précises de votre séjour, je confirme avec la réception.',
    answer_en:
      'Seasonal property, open spring through autumn. Beefbar opens 4 June 2026. For your exact dates, I’ll confirm with reception.',
  },
] as const;

/** Full kit FAQ (30) — rendered on the DA fiche + JSON-LD extended set. */
export const AIRELLES_FAQ_CONTENT = AIRELLES_FAQ_CONTENT_KIT;

export const AIRELLES_HOTEL_DISPLAY_NAME = 'Airelles Gordes, La Bastide';

/**
 * CDC §2.11 promote payload (10–15 items): 5 featured situational + 10 canonical
 * questions (exact wording from `canonical-faq-questions.ts`). Supabase audit reads
 * this; {@link patchKitGoldenRow} swaps in {@link AIRELLES_FAQ_CONTENT_KIT} at runtime.
 */
export const AIRELLES_FAQ_CONTENT_PROMOTE = [
  ...AIRELLES_FAQ_CONTENT_KIT.filter(
    (item): item is (typeof AIRELLES_FAQ_CONTENT_KIT)[number] & { featured: true } =>
      'featured' in item && item.featured === true,
  ).slice(0, 5),
  {
    category: 'before',
    question_fr: "L'hôtel dispose-t-il d'un parking ?",
    question_en: 'Does the hotel have parking facilities?',
    answer_fr:
      'Oui, parking privé sur place et service voiturier. À votre arrivée, laissez la clé au voiturier — je coordonne si vous avez besoin d’une voiture de location pour le Luberon.',
    answer_en:
      'Yes, private on-site parking and valet service. On arrival, leave the key with the valet — I’ll coordinate a rental car if you need one for the Luberon.',
  },
  {
    category: 'during',
    question_fr: 'Quel type de petit-déjeuner est proposé ?',
    question_en: 'What kind of breakfast is served?',
    answer_fr:
      'Buffet provençal chaque matin à La Table — terrasse ou salon, produits locaux et viennoiseries artisanales. Je vous suggère l’horaire idéal selon vos excursions : tôt si Sénanque, plus tard si matinée piscine.',
    answer_en:
      'A Provençal buffet each morning at La Table — terrace or salon, local produce and artisan pastries. I’ll suggest the ideal time based on your plans: early for Sénanque, later for a pool morning.',
  },
  {
    category: 'during',
    question_fr: "Le Wi-Fi est-il disponible dans l'hôtel ?",
    question_en: 'Is Wi-Fi available throughout the hotel?',
    answer_fr:
      'Oui, Wi-Fi gratuit dans tout l’hôtel et minibar réapprovisionné quotidiennement en chambre. Pour une attention particulière à l’arrivée — champagne, fruits ou fleurs — je la programme avec la conciergerie avant votre check-in.',
    answer_en:
      'Yes, complimentary Wi-Fi throughout and a minibar replenished daily in-room. For a special arrival touch — champagne, fruit or flowers — I’ll arrange it with the concierge before your check-in.',
  },
  {
    category: 'during',
    question_fr: `Les animaux sont-ils acceptés à ${AIRELLES_HOTEL_DISPLAY_NAME} ?`,
    question_en: `Are pets allowed at ${AIRELLES_HOTEL_DISPLAY_NAME}?`,
    answer_fr:
      'Chiens et chats acceptés sur demande, dans certaines chambres et suites — 30 € par animal et par jour. Signalez-le à la réservation : je confirme la chambre adaptée et les modalités avec vous avant l’arrivée.',
    answer_en:
      'Dogs and cats accepted on request, in selected rooms and suites — €30 per pet per day. Flag it when booking: I’ll confirm the right room and terms with you before arrival.',
  },
  {
    category: 'before',
    question_fr: "Quelle est la distance entre l'hôtel et l'aéroport ?",
    question_en: 'How far is the hotel from the airport?',
    answer_fr:
      'Marseille-Provence est à environ une heure en voiture ; Avignon TGV à 50 minutes. Je programme le transfert privé avec accueil nominatif — envoyez-moi vos horaires de vol.',
    answer_en:
      'Marseille-Provence is about an hour by car; Avignon TGV 50 minutes. I’ll schedule a private transfer with a personalised meet-and-greet — send me your flight times.',
  },
  {
    category: 'during',
    question_fr: "L'hôtel dispose-t-il d'une piscine ?",
    question_en: 'Does the hotel have a pool?',
    answer_fr:
      'Trois piscines : terrasse panoramique sur la vallée, bassin intérieur voûté du spa et piscine dédiée au Summer Camp. Je vous indique les créneaux les plus calmes pour nager en toute sérénité, selon la saison.',
    answer_en:
      'Three pools: a panoramic terrace pool, the spa’s vaulted indoor pool and a Summer Camp children’s pool. I’ll point you to the quietest slots for a serene swim, depending on the season.',
  },
  {
    category: 'before',
    question_fr: 'Puis-je effectuer un check-in anticipé ?',
    question_en: 'Is early check-in available?',
    answer_fr:
      'Check-in dès 15h ; early check-in selon disponibilité — je m’en occupe avec la réception avant votre arrivée. Vos bagages sont gardés en sécurité pendant que la chambre se prépare.',
    answer_en:
      'Check-in from 3 pm; early check-in subject to availability — I’ll arrange it with reception before you arrive. Luggage is stored securely while your room is being prepared.',
  },
  {
    category: 'before',
    question_fr: "Des transferts vers l'aéroport sont-ils proposés ?",
    question_en: 'Are airport transfers offered?',
    answer_fr:
      'Oui, transferts privés depuis Marseille-Provence (environ 1 h) ou Avignon TGV (50 min). Donnez-moi vos horaires de vol : je confirme le chauffeur et l’accueil nominatif à l’arrivée.',
    answer_en:
      'Yes, private transfers from Marseille-Provence (about 1 hr) or Avignon TGV (50 min). Send me your flight times: I’ll confirm the driver and a personalised meet-and-greet on arrival.',
  },
  {
    category: 'before',
    question_fr: "Quelle est la politique d'annulation de l'hôtel ?",
    question_en: "What is the hotel's cancellation policy?",
    answer_fr:
      'Les conditions dépendent du tarif réservé. Avant de confirmer, je vous communique la politique exacte, les délais d’annulation et les éventuels frais — aucune mauvaise surprise à l’arrivée.',
    answer_en:
      'Terms depend on the rate booked. Before confirming, I’ll share the exact policy, cancellation deadlines and any fees — no surprises on arrival.',
  },
  {
    category: 'before',
    question_fr: 'Y a-t-il des taxes de séjour à payer ?',
    question_en: 'Are there any tourist taxes to pay?',
    answer_fr:
      'La taxe de séjour s’applique selon la réglementation en vigueur à Gordes. Elle est réglée à l’arrivée ou au départ — je vous indique le montant exact lors de la confirmation de votre séjour.',
    answer_en:
      'Tourist tax applies under Gordes local regulations. It is settled on arrival or departure — I’ll confirm the exact amount when booking your stay.',
  },
] as const;

// ---------------------------------------------------------------------------
// mice_info — CDC §2.14 (five meeting rooms, source: airelles.com seminars page)
// ---------------------------------------------------------------------------

export const AIRELLES_MICE_INFO = {
  summary_fr:
    'Cinq salles lumineuses jusqu’à 180 personnes, équipées des dernières technologies, avec restauration signée Clover et La Table — séminaires et événements privés face au Luberon.',
  summary_en:
    'Five naturally lit rooms for up to 180 guests, fully equipped, with Clover and La Table catering — seminars and private events facing the Luberon.',
  contact_email: 'as.maigne@airelles.com',
  total_capacity_seated: 180,
  spaces: [
    {
      key: 'salle-luberon',
      name: 'Salon Luberon',
      surface_sqm: 197,
      max_seated: 180,
      configurations: ['theatre', 'classroom', 'banquet', 'cocktail'],
      has_natural_light: true,
      notes_fr: 'Plus grande salle, cheminée et vue sur la vallée du Luberon.',
      notes_en: 'Largest room, fireplace and Luberon valley view.',
    },
    {
      key: 'salle-mistral',
      name: 'Salon Mistral',
      surface_sqm: 92,
      max_seated: 82,
      configurations: ['theatre', 'classroom', 'banquet', 'cocktail'],
      has_natural_light: true,
    },
    {
      key: 'salle-ventoux',
      name: 'Salon Ventoux',
      surface_sqm: 90,
      max_seated: 80,
      configurations: ['theatre', 'classroom', 'banquet', 'cocktail'],
      has_natural_light: true,
    },
    {
      key: 'salle-alpilles',
      name: 'Salon Alpilles',
      surface_sqm: 27,
      max_seated: 17,
      configurations: ['boardroom', 'u-shape'],
      has_natural_light: true,
    },
    {
      key: 'bibliotheque',
      name: 'Bibliothèque',
      surface_sqm: 27,
      max_seated: 12,
      configurations: ['boardroom'],
      has_natural_light: true,
    },
  ],
  event_types: ['corporate-meeting', 'wedding', 'gala-dinner', 'incentive'],
} as const;

// ---------------------------------------------------------------------------
// hotel_rooms — indexable sub-page seed (ADR-0009, Suite Vasarely)
// ---------------------------------------------------------------------------

export const AIRELLES_INDEXABLE_ROOM = {
  room_code: 'vasarely-suite',
  slug: 'suite-vasarely',
  name_fr: 'Suite Vasarely',
  name_en: 'Vasarely Suite',
  description_fr:
    'Suite signature de 60 m² avec terrasse de 33 m², hommage à Victor Vasarely et vue panoramique sur la vallée du Luberon.',
  description_en:
    'Signature 60 sq m suite with a 33 sq m terrace, tribute to Victor Vasarely and a panoramic Luberon valley view.',
  long_description_fr:
    'La Suite Vasarely rend hommage au maître optique qui fit de Gordes un village d’artistes dès 1948. À 60 m², elle déploie une chambre king size, un salon séparé et une terrasse privative de 33 m² orientée plein sud sur la vallée du Luberon, les Alpilles et, par temps clair, le Mont Ventoux.\n\nChristophe Tollemer a composé un décor où pierre de Bourgogne, mobilier provençal chiné et tissus Pierre Frey dialoguent avec des accents géométriques inspirés de l’œuvre de Vasarely. La salle de bain en pierre propose une baignoire et une douche à l’italienne ; le minibar, la machine Nespresso et la climatisation complètent le confort palace.\n\nDepuis la terrasse, le village de Gordes semble suspendu au-dessus des oliviers. C’est la suite que je réserve en premier pour un séjour où l’on veut à la fois l’intimité d’un mas provençal et la splendeur d’une vue qui ne se partage qu’avec le ciel du Luberon — idéale pour une lune de miel ou un anniversaire de mariage.',
  long_description_en:
    'The Vasarely Suite pays tribute to the optical master who made Gordes an artists’ village from 1948. At 60 sq m, it offers a king-size bedroom, a separate sitting room and a 33 sq m private south-facing terrace over the Luberon valley, the Alpilles and, on clear days, Mont Ventoux.\n\nChristophe Tollemer designed a décor where Burgundy stone, antique Provençal furniture and Pierre Frey fabrics converse with geometric accents inspired by Vasarely’s work. The stone bathroom has a bathtub and walk-in shower; minibar, Nespresso machine and air conditioning complete the palace comfort.\n\nFrom the terrace, the village of Gordes seems suspended above the olive groves. It is the suite I book first for a stay that combines the intimacy of a Provençal mas with a view shared only with the Luberon sky — ideal for a honeymoon or wedding anniversary.',
  max_occupancy: 3,
  bed_type: 'King size',
  size_sqm: 60,
  is_signature: true,
  display_order: 10,
  hero_image: `${AIRELLES_IMAGE_PREFIX}/press-13`,
  images: [
    {
      public_id: `${AIRELLES_IMAGE_PREFIX}/press-13`,
      alt_fr: 'Chambre de la Suite Vasarely, Airelles Gordes, Gordes',
      alt_en: 'Bedroom of the Vasarely Suite, Airelles Gordes, Gordes',
      category: 'suite',
    },
    {
      public_id: `${AIRELLES_IMAGE_PREFIX}/press-14`,
      alt_fr: 'Salon de la Suite Vasarely, Airelles Gordes, Gordes',
      alt_en: 'Living room of the Vasarely Suite, Airelles Gordes, Gordes',
      category: 'suite',
    },
    {
      public_id: `${AIRELLES_IMAGE_PREFIX}/press-25`,
      alt_fr: 'Junior Suite Prestige, chambre, Airelles Gordes, Gordes',
      alt_en: 'Prestige Junior Suite bedroom, Airelles Gordes, Gordes',
      category: 'suite',
    },
    {
      public_id: `${AIRELLES_IMAGE_PREFIX}/press-26`,
      alt_fr: 'Salle de bain en pierre, Airelles Gordes, Gordes',
      alt_en: 'Stone bathroom, Airelles Gordes, Gordes',
      category: 'detail',
    },
    {
      public_id: `${AIRELLES_IMAGE_PREFIX}/press-21`,
      alt_fr: 'Junior Suite côté vallée, Airelles Gordes, Gordes',
      alt_en: 'Valley-side Junior Suite, Airelles Gordes, Gordes',
      category: 'suite',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// concierge_advice + concierge_pick + concierge_hook
// ---------------------------------------------------------------------------

export const AIRELLES_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'timing',
    body: 'Mon conseil : La Bastide était au XVIIIe siècle la demeure de la famille de Simiane, et chaque suite de prestige en porte la mémoire. Réservez la suite Baron de Simiane pour son mobilier d’époque et sa terrasse panoramique, ou la suite Vasarely pour sa vue sur la vallée. À la tombée du jour, montez à la piscine en terrasse avant le dîner : le soleil glisse derrière les Alpilles et le village s’embrase de doré. C’est le moment que personne ne photographie, et c’est le plus beau.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'timing',
    body: 'My tip: in the 18th century La Bastide was the residence of the de Simiane family, and each prestige suite carries that memory. Book the Baron de Simiane suite for its period furniture and panoramic terrace, or the Vasarely suite for its valley view. At dusk, climb to the terrace pool before dinner: the sun slides behind the Alpilles and the village turns to gold. It is the moment no one photographs, and it is the finest.',
  },
} as const;

export const AIRELLES_CONCIERGE_PICK_SLUG = 'suite-baron-de-simiane';

export const AIRELLES_CONCIERGE_PICK_NOTE = {
  fr: 'Mobilier d’époque du XVIIIᵉ et terrasse panoramique sur la vallée — la suite que je réserve en premier.',
  en: '18th-century furniture and a panoramic valley terrace — the suite I book first.',
} as const;

/** DB column shape for `concierge_pick` (migration 0068). */
export const AIRELLES_CONCIERGE_PICK = {
  slug: AIRELLES_CONCIERGE_PICK_SLUG,
  note: AIRELLES_CONCIERGE_PICK_NOTE,
} as const;

export const AIRELLES_CONCIERGE_HOOK = {
  fr: 'La Provence dont on rêve sans le savoir : une bastide du XVIIIᵉ suspendue au-dessus de Gordes, trois piscines, spa voûté et la table de Jean-François Piège.',
  en: 'The Provence you dream of without knowing it: an 18th-century bastide perched above Gordes, three pools, a vaulted spa and Jean-François Piège’s table.',
} as const;

// ---------------------------------------------------------------------------
// instagram — teaser feed (@airellesgordes). Images = nos public_ids
// Cloudinary (jamais de hotlink scontent.cdninstagram).
// ---------------------------------------------------------------------------

export const AIRELLES_INSTAGRAM = {
  handle: 'airellesgordes',
  profile_url: 'https://www.instagram.com/airellesgordes/',
  followers: 135000,
  posts: [
    {
      permalink: 'https://www.instagram.com/p/DYtsX-ajWaN/',
      image_public_id: `${AIRELLES_IMAGE_PREFIX}/press-6`,
      caption_fr:
        'La Maison de Constance — le visage le plus intime de La Bastide, où l’esprit d’une maison de famille provençale rencontre l’art de vivre Airelles.',
      caption_en:
        'Maison de Constance — the most intimate side of La Bastide, where a Provençal family home meets the Airelles art of living.',
    },
    {
      permalink: 'https://www.instagram.com/p/DY9-L5XjbIW/',
      image_public_id: 'cct/hotels/les-airelles-gordes/places-6',
      caption_fr: 'Rien de tapageur, juste la Provence à son meilleur.',
      caption_en: 'Nothing loud, just Provence at its best.',
      posted_at: '2026-05-29',
    },
    {
      permalink: 'https://www.instagram.com/p/DY2Ez1pDXmP/',
      image_public_id: `${AIRELLES_IMAGE_PREFIX}/press-5`,
      caption_fr:
        'Quelques jours suspendus dans le temps à Airelles Gordes — les ruelles de pierre de Gordes au printemps et cette lumière provençale inimitable.',
      caption_en:
        'A few days suspended in time at Airelles Gordes — the stone streets of Gordes in spring and that unmistakable Provençal light.',
    },
    {
      permalink: 'https://www.instagram.com/airellesgordes/',
      image_public_id: 'cct/hotels/les-airelles-gordes/press-3',
      caption_fr:
        'Le salon de réception mêle mobilier d’époque et lumière de Provence sous les voûtes de La Bastide.',
      caption_en:
        'The reception lounge blends period furniture with Provençal light beneath the vaults of La Bastide.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Résumés factuels + méta-descriptions (corrigés : pas d'étoile Michelin)
// ---------------------------------------------------------------------------

export const AIRELLES_FACTUAL_SUMMARY_FR =
  'Palace du XVIIIe siècle à Gordes, à 50 min d’Avignon TGV : 40 chambres, trois piscines, spa Guerlain et table Jean-François Piège.';
export const AIRELLES_FACTUAL_SUMMARY_EN =
  'Palace overlooking hilltop Gordes, 50 min from Avignon TGV, with 40 rooms, three pools, a Guerlain spa and a Jean-François Piège table.';

/** Magazine lede for `#apropos` — voice & atmosphere only (no duplicate of structured blocks). */
export const AIRELLES_DESCRIPTION_FR =
  'Avec quarante chambres et suites, Airelles Gordes, La Bastide, cultive une atmosphère intime au sommet du Luberon. Chaque hébergement conjugue voûtes en pierre, lin et mobilier chiné dans l’esprit des bastides provençales, avec une conciergerie qui anticipe sans envahir — du premier café sur la terrasse au dernier soin au spa Guerlain, toujours au rythme lent du village perché.\n\nDepuis la terrasse, la vue court sur la vallée ; à l’intérieur, les parquets point de Hongrie et la pierre de Bourgogne composent un refuge où le silence du village enveloppe chaque matin. La conciergerie orchestre tables, spa et escapades dans le Luberon sans briser cette parenthèse — c’est l’essence d’un séjour à La Bastide, entre art de vivre provençal et palace discret.';
export const AIRELLES_DESCRIPTION_EN =
  'With forty rooms and suites, Airelles Gordes, La Bastide, cultivates an intimate atmosphere above the Luberon. Each accommodation pairs stone vaults, linen and antique furniture in the spirit of Provençal bastides, with a concierge who anticipates without intruding — from the first terrace coffee to the last Guerlain spa ritual, always at the unhurried pace of the hilltop village.\n\nFrom the terrace, the view sweeps across the valley; indoors, herringbone parquet and Burgundy stone shape a refuge where the village silence wraps each morning. The concierge orchestrates tables, spa and Luberon outings without breaking the spell — the essence of a stay at La Bastide, between Provençal art de vivre and discreet palace service.';
export const AIRELLES_META_DESC_FR =
  'Palace 5 étoiles à Gordes, sur les hauteurs du Luberon : vue sur la vallée, trois piscines, spa Airelles by Guerlain et table signée Jean-François Piège.';
export const AIRELLES_META_DESC_EN =
  'Five-star Palace in Gordes, high above the Luberon: valley views, three pools, an Airelles by Guerlain spa and a table by chef Jean-François Piège.';
export const AIRELLES_META_TITLE_FR =
  'Airelles Gordes La Bastide — Palace Gordes | MyConciergeHotel';
export const AIRELLES_META_TITLE_EN =
  'Airelles Gordes La Bastide — Palace Luberon | MyConciergeHotel';

// ---------------------------------------------------------------------------
// Narrative sanitiser — strip the FALSE "Clover Gordes is Michelin-starred"
// claim (EEAT — hotel-detail-page.mdc Hard Rule 7). Targeted replacements so
// the otherwise-good narrative is preserved verbatim.
// ---------------------------------------------------------------------------

const NARRATIVE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  [
    'Clover Gordes, signé par Jean-François Piège, compte 1 étoile au Guide Michelin.',
    'Clover Gordes, signé par le chef multi-étoilé Jean-François Piège, propose une cuisine provençale — le restaurant lui-même n’est pas étoilé.',
  ],
  [
    'Sur réservation, le séjour peut se prolonger par un dîner étoilé sur la terrasse du Luberon.',
    'Sur réservation, le séjour peut se prolonger par un dîner d’exception sur la terrasse du Luberon.',
  ],
  [
    'Vue sur le Luberon, distinction Palace et table étoilée donnent à La Bastide une place à part dans notre sélection de Gordes.',
    'Vue sur le Luberon, distinction Palace et tables signées par de grands chefs donnent à La Bastide une place à part dans notre sélection de Gordes.',
  ],
  [
    'Clover Gordes, by Jean-François Piège, holds 1 Michelin Star.',
    'Clover Gordes, by multi-Michelin-starred chef Jean-François Piège, serves Provençal cuisine — the restaurant itself is not starred.',
  ],
  [
    'They include a Michelin-starred dinner on the Luberon terrace and a cooking workshop',
    'They include a signature dinner on the Luberon terrace and a cooking workshop',
  ],
  [
    "Open views over the Luberon, Palace status and Michelin-starred dining explain La Bastide's place in our Gordes selection.",
    "Open views over the Luberon, Palace status and tables by acclaimed chefs explain La Bastide's place in our Gordes selection.",
  ],
  [
    'Restaurant supervisé par le chef étoilé Jean-François Piège ; son étoile Michelin témoigne d’une cuisine inventive ancrée dans les produits de saison.',
    'Table provençale supervisée par le chef multi-étoilé Jean-François Piège ; une cuisine inventive ancrée dans les produits de saison (le restaurant lui-même n’est pas étoilé au Guide Michelin).',
  ],
  [
    'Restaurant overseen by Michelin-starred chef Jean-François Piège; its Michelin star attests to inventive cuisine rooted in seasonal produce.',
    'Provençal table overseen by multi-Michelin-starred chef Jean-François Piège; inventive cuisine rooted in seasonal produce (the restaurant itself is not Michelin-starred).',
  ],
  ['Dîner étoilé sur la terrasse du Luberon', 'Dîner d’exception sur la terrasse du Luberon'],
  ['Michelin-starred dinner on the Luberon terrace', 'Signature dinner on the Luberon terrace'],
];

export function sanitizeAirellesText(text: string): string {
  let out = text;
  for (const [from, to] of NARRATIVE_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Deep-sanitise any jsonb value by round-tripping through JSON. */
export function sanitizeAirellesJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    const json = JSON.stringify(value);
    return JSON.parse(sanitizeAirellesText(json)) as unknown;
  } catch {
    return value;
  }
}

/**
 * True only for the FALSE "Michelin STAR" distinction once attributed to the
 * hotel/restaurant. Must NOT match the VERIFIED "Trois Clés MICHELIN"
 * (MICHELIN Keys) hotel distinction, which is a legitimate award — only the
 * fabricated restaurant *star* is dropped (hotel-detail-page.mdc Hard Rule 7).
 */
function isFabricatedMichelinStarAward(entry: unknown): boolean {
  if (entry === null || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  const haystack = [e['issuer'], e['name_fr'], e['name_en'], e['url']]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  if (!haystack.includes('michelin')) return false;
  // Keep MICHELIN Keys ("clé"/"key") — verified hotel distinction.
  if (haystack.includes('clé') || haystack.includes('cle') || haystack.includes('key')) {
    return false;
  }
  // Drop only entries asserting a STAR.
  return haystack.includes('étoile') || haystack.includes('etoile') || haystack.includes('star');
}

/**
 * Drop the FALSE "1 Michelin Star" award and stamp `verified: true` on the
 * distinctions we have sourced (Atout France Palace, Trois Clés MICHELIN,
 * Gault&Millau toques). The `verified` flag is what `hasVerifiedMichelinAward`
 * keys on — without it the fabricated-star sentinel cannot tell the legitimate
 * MICHELIN Keys from a hallucinated star, and the EEAT JSON-LD renderer treats
 * the award as unconfirmed.
 */
export function patchAirellesAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing
    .filter((entry) => !isFabricatedMichelinStarAward(entry))
    .map((entry) => {
      if (entry === null || typeof entry !== 'object') return entry;
      return { ...(entry as Record<string, unknown>), verified: true };
    });
}

/** CDC §2.6 — 80+ factual amenities (replaces sparse seed; drops false Michelin tag). */
export function patchAirellesAmenities(_existing: unknown): readonly AirellesAmenityRecord[] {
  return AIRELLES_AMENITIES;
}

/** Re-export for promote / audit consumers. */
export { AIRELLES_AMENITIES, type AirellesAmenityRecord } from './airelles-amenities';

/** Enrich `spa_info` with the concierge dossier (Guerlain partner, hours, tip). */
export function patchAirellesSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    name: 'Airelles Spa by Guerlain',
    treatment_rooms: 4,
    description_fr:
      'Sous de hauts plafonds voûtés en pierre de Bourgogne, le spa puise son inspiration dans les grandes abbatiales provençales, comme l’abbaye de Sénanque toute proche. On y trouve une piscine intérieure, un hammam, un sauna et quatre salles de soins dont une suite VIP double. Les rituels signés Guerlain — dont le soin signature « Le Joyau de La Bastide », visage et corps autour de l’olivier — se prolongent dans un espace fitness de 90 m² équipé Technogym.',
    description_en:
      'Under high vaulted ceilings in Burgundy stone, the spa draws on the great Provençal abbeys such as the nearby Abbaye de Sénanque. It holds an indoor pool, a hammam, a sauna and four treatment rooms including a double VIP suite. Guerlain rituals — among them the signature “Le Joyau de La Bastide” face-and-body treatment built around the olive tree — extend into a 90 m² Technogym-equipped fitness space.',
    hours_fr: 'Tous les jours de 10h à 20h',
    hours_en: 'Daily, 10:00–20:00',
    price_note_fr:
      'Soins signés Guerlain sur réservation (carte des soins 2026). Carte cadeau « soin d’une heure » disponible en ligne sur gifts.airelles.com.',
    price_note_en:
      'Guerlain treatments by reservation (2026 spa menu). A “one-hour treatment” gift card is available online at gifts.airelles.com.',
    website:
      'https://airelles.com/fr/destination/gordes-hotel/spa-airelles-soins-piscine-salle-fitness',
    phone: '+33 4 90 72 18 90',
    tip_fr:
      'Mon conseil : réservez le soin signature « Le Joyau de La Bastide » en fin d’après-midi, puis enchaînez sur la piscine intérieure voûtée avant le dîner. Le spa est au plus calme après 17h, une fois les familles remontées du bassin.',
    tip_en:
      'My tip: book the signature “Le Joyau de La Bastide” treatment in the late afternoon, then slip into the vaulted indoor pool before dinner. The spa is quietest after 5pm, once the families have headed up from the pool.',
  };
}

/** Pets "on request" (30 €/day), wifi whole-property. */
export function patchAirellesPolicies(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    check_in: {
      time: '15:00',
      notes_fr:
        'Arrivée dès 15h ; early check-in selon disponibilité sur demande auprès de la conciergerie.',
      notes_en:
        'Arrival from 3 pm; early check-in subject to availability on request through the concierge.',
    },
    check_out: {
      time: '12:00',
      notes_fr:
        'Départ jusqu’à 12h ; late check-out selon disponibilité — je m’en occupe avec la réception.',
      notes_en:
        'Departure until noon; late check-out subject to availability — I’ll arrange it with reception.',
    },
    cancellation: {
      notes_fr:
        'Conditions selon le tarif réservé. La conciergerie communique la politique exacte avant confirmation.',
      notes_en:
        'Terms depend on the rate booked. The concierge shares the exact policy before confirmation.',
    },
    pets: {
      allowed: true,
      fee_eur: 30,
      notes_fr:
        'Chiens et chats acceptés sur demande, dans certaines chambres et suites — 30 € par animal et par jour. À signaler à la réservation auprès de la conciergerie.',
      notes_en:
        'Dogs and cats accepted on request, in selected rooms and suites — €30 per animal, per day. Please flag at booking with the concierge.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

// ---------------------------------------------------------------------------
// long_description_sections — Histoire & art (kit DA § « L'hôtel en bref »)
// ---------------------------------------------------------------------------

export const AIRELLES_HISTORY_SECTION = {
  anchor: 'histoire-art',
  title_fr: 'Histoire & art de La Bastide',
  title_en: 'History & art of La Bastide',
  body_fr:
    'Une demeure du XVIIIᵉ siècle ancrée dans le Gordes des peintres, restaurée en 2015 par l’architecte Christophe Tollemer.\n\nLa bastide fut au XVIIIᵉ siècle la demeure de la famille de Simiane, dont la marquise — petite-fille de Madame de Sévigné — marqua l’histoire du village. Au XXᵉ siècle, Gordes devient un véritable village d’artistes : Victor Vasarely s’y installe dès 1948 et y ouvre un musée didactique au château, tandis que Marc Chagall, Serge Poliakoff, André Lhote et Jean Deyrolle font de la cité perchée un foyer de l’art moderne. La suite signature de l’hôtel, la Vasarely Suite, rend hommage à ce passé.\n\nRouverte en 2015 après une restauration menée par cent cinquante artisans, La Bastide doit son décor à l’architecte d’intérieur Christophe Tollemer : pierre de Bourgogne, mobilier provençal chiné, tissus de la maison Pierre Frey. Chaque pièce conjugue l’authenticité d’un mas du Luberon et le confort d’un palace 5 étoiles. Les voûtes en pierre, les parquets point de Hongrie et les cheminées d’époque composent une atmosphère intime où le temps semble suspendu — exactement l’esprit qu’Airelles souhaitait préserver en rouvrant cette bastide aixoise.\n\nQuarante chambres et suites, six adresses gastronomiques, un spa Guerlain voûté et trois piscines complètent cette bastide où l’art de vivre provençal se lit autant dans les pierres que dans l’accueil discret de la conciergerie — le palace le plus intime du Luberon.',
  body_en:
    'An 18th-century residence rooted in painterly Gordes, restored in 2015 by architect Christophe Tollemer.\n\nIn the 18th century the bastide was the home of the de Simiane family, whose marquise — granddaughter of Madame de Sévigné — left her mark on the village. In the 20th century Gordes became a true artists’ village: Victor Vasarely settled here from 1948 and opened a didactic museum in the castle, while Marc Chagall, Serge Poliakoff, André Lhote and Jean Deyrolle made the hilltop town a cradle of modern art. The hotel’s signature Vasarely Suite pays tribute to that past.\n\nReopened in 2015 after a restoration by a hundred and fifty craftspeople, La Bastide owes its décor to interior architect Christophe Tollemer: Burgundy stone, antique Provençal furniture, Pierre Frey fabrics. Every room blends the authenticity of a Luberon mas with five-star palace comfort. Stone vaults, herringbone parquet and period fireplaces create an intimate atmosphere where time seems to stand still — the spirit Airelles set out to preserve when reopening this Aix-en-Provence bastide.',
} as const;

/** Kit golden fiche — history (also in `#bref`) + location narrative only; rest lives in structured blocks. */
const AIRELLES_LONG_DESCRIPTION_SECTIONS = [
  AIRELLES_HISTORY_SECTION,
  {
    anchor: 'emplacement-gordes',
    title_fr: 'Emplacement & cadre',
    title_en: 'Location & setting',
    body_fr:
      'La Bastide domine Gordes depuis la Rue de la Combe, à quelques minutes à pied de la place du Château et des ruelles calcaires du village. La vue porte sur la vallée du Luberon, les Alpilles et, par temps clair, le Mont Ventoux.\n\nDepuis Avignon TGV (50 min) ou Marseille-Provence (1 h), la route serpente entre vignes, oliviers et villages perchés. Le parking de l’hôtel facilite l’arrivée ; la conciergerie coordonne transferts et excursions. En saison, trois piscines — terrasse panoramique, bassin spa voûté et piscine Summer Camp — invitent à alterner baignade et flânerie dans les jardins suspendus.\n\nGordes figure parmi les « Plus Beaux Villages de France » : calades, galeries et perspectives sur la vallée composent un décor que l’on explore à pied en quelques minutes depuis l’hôtel. La Bastide se situe à portée de l’abbaye de Sénanque, du Village des Bories et des domaines viticoles du Luberon — base idéale pour un séjour slow en Provence.\n\nLes jardins suspendus et la terrasse de La Table offrent le cadre le plus spectaculaire pour le petit-déjeuner ou un apéritif au coucher du soleil — un rituel que je recommande dès la première soirée.',
    body_en:
      'La Bastide overlooks Gordes from Rue de la Combe, a few minutes’ walk from the Château square and the village’s limestone lanes. The view sweeps across the Luberon valley, the Alpilles and, on clear days, Mont Ventoux.\n\nFrom Avignon TGV (50 min) or Marseille-Provence (1 hr), the road winds through vines, olive groves and hilltop villages. On-site parking eases arrival; the concierge arranges transfers and excursions. In season, three pools — a panoramic terrace pool, the vaulted spa pool and the Summer Camp pool — invite you to alternate swimming and strolling through the hanging gardens.\n\nGordes ranks among France’s “Most Beautiful Villages”: cobbled lanes, galleries and valley views form a setting you can explore on foot within minutes of the hotel. La Bastide is within reach of Sénanque Abbey, the Village des Bories and Luberon wine estates — an ideal base for a slow Provence stay.\n\nThe hanging gardens and La Table terrace offer the most spectacular setting for breakfast or a sunset aperitif — a ritual I recommend from your very first evening.',
  },
  {
    anchor: 'gordes-artistes',
    title_fr: 'Gordes, village d’artistes',
    title_en: 'Gordes, an artists’ village',
    body_fr:
      'Au XXᵉ siècle, Gordes devient un foyer de l’art moderne : Victor Vasarely s’y installe dès 1948 et ouvre un musée didactique au château ; Marc Chagall, Serge Poliakoff, André Lhote et Jean Deyrolle y trouvent refuge. La suite Vasarely de La Bastide rend hommage à cet héritage.\n\nFlâner dans le village, c’est croiser galeries, ateliers et perspectives sur la vallée. La conciergerie réserve les visites du château, des Caves Saint-Firmin ou de l’abbaye de Sénanque — chaque sortie prolonge le séjour sans quitter l’esprit provençal de La Bastide.\n\nLe marché du mardi matin, les sentiers du Luberon et les domaines viticoles voisins complètent l’expérience : Gordes n’est pas seulement un panorama depuis la terrasse, c’est un village vivant que l’on redécouvre à chaque promenade. Entre les galeries du centre et les ateliers disséminés dans les ruelles, l’hôtel s’inscrit dans cette lignée artistique — la Vasarely Suite en est la clé de voûte.\n\nC’est cette double lecture — palace suspendu et cité d’artistes — que La Bastide propose à ses hôtes, avec la conciergerie pour orchestrer chaque découverte.',
    body_en:
      'In the 20th century Gordes became a cradle of modern art: Victor Vasarely settled here from 1948 and opened a didactic museum in the castle; Marc Chagall, Serge Poliakoff, André Lhote and Jean Deyrolle found refuge here. The hotel’s Vasarely Suite pays tribute to that legacy.\n\nStrolling the village means galleries, studios and views over the valley. The concierge books castle visits, the Caves Saint-Firmin or Sénanque Abbey — each outing extends the stay without leaving La Bastide’s Provençal spirit.\n\nTuesday morning market, Luberon trails and neighbouring wine estates complete the experience: Gordes is not only a view from the terrace but a living village rediscovered on every walk. Between downtown galleries and studios tucked into the lanes, the hotel belongs to that artistic lineage — the Vasarely Suite is its keystone.\n\nThat dual reading — suspended palace and artists’ town — is what La Bastide offers its guests, with the concierge orchestrating every discovery.',
  },
] as const;

export const AIRELLES_TRANSPORTS = [
  {
    mode: 'train',
    station: 'Gare Avignon TGV',
    station_en: 'Avignon TGV station',
    distance_meters: 45_000,
    walk_minutes: 50,
    notes_fr:
      'Ligne TGV Paris–Marseille ; transfert privé ou location depuis la gare (environ 50 min).',
    notes_en:
      'TGV Paris–Marseille line; private transfer or car hire from the station (about 50 min).',
  },
  {
    mode: 'airport',
    station: 'Aéroport Marseille-Provence',
    station_en: 'Marseille Provence Airport',
    distance_meters: 90_000,
    walk_minutes: 60,
    notes_fr:
      'Vols internationaux et domestiques ; transfert privé sur réservation via la conciergerie (environ 1 h).',
    notes_en:
      'International and domestic flights; private transfer on reservation through the concierge (about 1 hr).',
  },
] as const;

function resolveAirellesLongDescriptionSections(existing: unknown, spaInfo: unknown): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    AIRELLES_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchAirellesLongDescriptionSections(dropDuplicateCategorySections(existing));
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: AIRELLES_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: AIRELLES_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchAirellesLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of AIRELLES_LONG_DESCRIPTION_SECTIONS) {
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

// ---------------------------------------------------------------------------
// featured_reviews — extraits presse (kit DA § « Ils en parlent »)
// ---------------------------------------------------------------------------

export const AIRELLES_FEATURED_REVIEWS = [
  {
    source: 'Guide MICHELIN',
    author: 'Guide MICHELIN',
    source_url:
      'https://guide.michelin.com/fr/fr/hotels-stays/gordes/airelles-gordes-la-bastide-6874',
    quote_fr:
      'Le village provençal perché de Gordes offre un cadre spectaculaire à l’un des hôtels les plus extraordinaires de la région — une distinction de taille, vu la concurrence.',
    quote_en:
      'The hilltop Provençal village of Gordes provides a spectacular setting for one of the most extraordinary hotels in the region — a major distinction given the competition.',
  },
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/french-riviera-france/airelles-gordes-la-bastide',
    quote_fr:
      'Accrochée aux abords du village de Gordes, avec une vue à couper le souffle sur la vallée du Luberon balayée par le mistral, La Bastide semble tout droit sortie d’un conte de fées médiéval français.',
    quote_en:
      'Clinging to the edge of Gordes village, with a breathtaking view over the Luberon valley swept by the mistral, La Bastide feels straight out of a French medieval fairy tale.',
  },
  {
    source: 'Presse spécialisée',
    author: 'Presse spécialisée',
    quote_fr:
      'Avec une adresse de premier choix au cœur de Gordes — « le plus beau village du monde » dominant les champs de lavande — La Bastide est à la hauteur de son cadre pittoresque.',
    quote_en:
      'With a prime address in the heart of Gordes — “the most beautiful village in the world” overlooking lavender fields — La Bastide lives up to its picturesque setting.',
  },
] as const;

// ---------------------------------------------------------------------------
// upcoming_events — « Ce qui se passe pendant votre séjour » (saison 2026)
// Coords = centre Gordes (~43.911, 5.200). Dates rolling — sync script
// overwrites from DATAtourisme; golden keeps the kit pilot readable.
// ---------------------------------------------------------------------------

const GORDES_LAT = 43.911;
const GORDES_LNG = 5.2;

export const AIRELLES_UPCOMING_EVENTS = [
  {
    name: 'Marché de Gordes',
    start_date: '2026-06-09',
    end_date: '2026-09-29',
    venue_name: 'Place du Monument',
    latitude: GORDES_LAT,
    longitude: GORDES_LNG,
    distance_meters: 350,
    category: 'festival',
    period_fr: 'Juin–septembre (mardis)',
    period_en: 'June–September (Tuesdays)',
    hours_fr: 'Mardi matin, 8h–13h',
    hours_en: 'Tuesday morning, 8 am–1 pm',
    description_fr:
      'L’un des marchés les plus courus du Luberon, au pied du château : primeurs, huiles d’olive, savons et poteries.',
    description_en:
      'One of the busiest markets in the Luberon, at the foot of the castle: produce, olive oils, soaps and pottery.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/press-5`,
  },
  {
    name: "Jazz'n Wine — Domaine des Peyre",
    start_date: '2026-06-15',
    end_date: '2026-08-31',
    venue_name: 'Domaine des Peyre',
    latitude: 43.898,
    longitude: 5.185,
    distance_meters: 4500,
    category: 'concert',
    period_fr: 'Juin–août',
    period_en: 'June–August',
    hours_fr: 'Jeudis 19h–23h (juillet–août)',
    hours_en: 'Thursdays 7–11 pm (July–August)',
    description_fr:
      'Soirées jazz et dégustation dans les vignes en agriculture biologique AOC Luberon, l’été. Ambiance unique : le vin bio du domaine, la musique live et les étoiles — réservez à l’avance, les soirées affichent complet.',
    description_en:
      'Summer jazz evenings and tastings in AOC Luberon organic vineyards. Unique atmosphere: estate organic wine, live music and stars — book ahead, evenings sell out.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/poi-domaine-des-peyre`,
  },
  {
    name: 'Marché de Lourmarin',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    venue_name: 'Lourmarin',
    latitude: 43.764,
    longitude: 5.362,
    distance_meters: 18000,
    category: 'festival',
    is_year_round: true,
    period_fr: 'Toute l’année',
    period_en: 'Year-round',
    hours_fr: 'Vendredi matin, 8h30–13h',
    hours_en: 'Friday morning, 8:30 am–1 pm',
    description_fr:
      'Marché provençal réputé du Luberon : produits alimentaires, vêtements et objets artisanaux, toute l’année.',
    description_en:
      'A renowned Provençal market in the Luberon: food, clothing and crafts, year-round.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/poi-marche-gordes`,
  },
  {
    name: "Les Soirées d'été de Gordes",
    start_date: '2026-06-20',
    end_date: '2026-08-31',
    venue_name: 'Château de Gordes',
    latitude: 43.9112,
    longitude: 5.2008,
    distance_meters: 400,
    category: 'concert',
    period_fr: 'Juin–août',
    period_en: 'June–August',
    hours_fr: 'Concerts en soirée (horaires variables)',
    hours_en: 'Evening concerts (times vary)',
    description_fr:
      'Concerts et spectacles au pied du Château de Gordes, dans la cour ou les jardins du village. Programme estival de juin à août.',
    description_en:
      'Concerts and shows at the foot of Château de Gordes, in the village courtyard or gardens. Summer programme from June to August.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/press-2`,
  },
  {
    name: 'Fête de la lavande',
    start_date: '2026-07-20',
    end_date: '2026-07-27',
    venue_name: 'Luberon (Sault, Valensole)',
    latitude: 44.091,
    longitude: 5.409,
    distance_meters: 35000,
    category: 'festival',
    period_fr: 'Fin juillet (dates variables par village)',
    period_en: 'Late July (dates vary by village)',
    hours_fr: 'Journée et après-midi',
    hours_en: 'Daytime and afternoon',
    description_fr:
      'Célébration de la lavande dans les villages du Luberon : défilés de chars fleuris, démonstrations de distillation, fin juillet.',
    description_en:
      'Lavender celebrations in Luberon villages: flower-float parades and distillation demos, late July.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/poi-abbaye-senanque`,
  },
  {
    name: 'Marché de Saint-Saturnin-lès-Apt',
    start_date: '2026-06-10',
    end_date: '2026-09-30',
    venue_name: 'Saint-Saturnin-lès-Apt',
    latitude: 43.928,
    longitude: 5.385,
    distance_meters: 20000,
    category: 'festival',
    period_fr: 'Juin–septembre',
    period_en: 'June–September',
    hours_fr: 'Mercredi matin',
    hours_en: 'Wednesday morning',
    description_fr:
      'Marché du mercredi matin dans ce village perché du Vaucluse : produits locaux, artisanat et ambiance authentique, à 20 km de Gordes.',
    description_en:
      'Wednesday-morning market in this Vaucluse hilltop village: local produce, crafts and authentic atmosphere, 20 km from Gordes.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${AIRELLES_IMAGE_PREFIX}/press-30`,
  },
] as const;

// ---------------------------------------------------------------------------
// signature_experiences — 6 expériences + Kid Club (kit DA § « L'hôtel en bref »)
// ---------------------------------------------------------------------------

export const AIRELLES_SIGNATURE_EXPERIENCES = [
  {
    key: 'montgolfiere-lever-soleil',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-montgolfiere-luberon`,
    title_fr: 'Montgolfière au lever du soleil',
    title_en: 'Sunrise hot-air balloon',
    description_fr:
      'Vol au départ de Roussillon, au-dessus des ocres de Roussillon, des villages perchés et des champs de lavande du Luberon. Environ une heure de vol, suivie du traditionnel verre de l’amitié. La conciergerie réserve le créneau et organise le transfert.',
    description_en:
      'A flight from Roussillon over the ochre cliffs, hilltop villages and Luberon lavender fields. About an hour aloft, followed by the traditional toast. The concierge books the slot and arranges transfer.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    price_note_fr: '290 €',
    price_note_en: '€290',
    tip_fr:
      'Le seul moment où l’on embrasse d’un regard les ocres, Gordes et les champs de lavande — partez au lever du jour, la lumière est irréelle.',
    tip_en:
      'The only moment when you take in the ochres, Gordes and lavender fields in one gaze — leave at daybreak, the light is unreal.',
    website: 'https://www.montgolfiere-luberon.com',
  },
  {
    key: 'degustation-domaine-peyre',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-domaine-des-peyre`,
    title_fr: 'Dégustation au Domaine des Peyre',
    title_en: 'Tasting at Domaine des Peyre',
    description_fr:
      'Domaine en agriculture biologique au pied du Luberon : dégustation de vins AOC Luberon, parcours d’art contemporain dans les vignes et, l’été, soirées Jazz’n Wine. Transfert organisé depuis l’hôtel.',
    description_en:
      'An organic estate at the foot of the Luberon: AOC Luberon wine tastings, contemporary art in the vines and, in summer, Jazz’n Wine evenings. Transfer arranged from the hotel.',
    booking_required: true,
    website: 'https://www.domainedespeyre.com',
  },
  {
    key: 'velo-electrique-luberon',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-electric-move`,
    title_fr: 'Balade à vélo électrique',
    title_en: 'E-bike ride',
    description_fr:
      'Electric Move à Coustellet : relier Gordes, Roussillon et les villages perchés du Luberon sans souffrir des dénivelés. La conciergerie organise la mise à disposition et l’itinéraire.',
    description_en:
      'Electric Move at Coustellet: link Gordes, Roussillon and Luberon hilltop villages without dreading the climbs. The concierge arranges bikes and the route.',
    booking_required: true,
    website: 'https://electricmove.fr',
  },
  {
    key: 'equitation-luberon',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-equitation-luberon`,
    title_fr: 'Équitation dans le Luberon',
    title_en: 'Horse riding in the Luberon',
    description_fr:
      'Balade à cheval dans les paysages du Luberon : garrigues, forêts de cèdres et panoramas sur les villages perchés. La conciergerie organise le transfert et la réservation.',
    description_en:
      'A ride through Luberon landscapes: garrigue, cedar forests and views over hilltop villages. The concierge arranges transfer and booking.',
    booking_required: true,
  },
  {
    key: 'diner-foret-cedres',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-abbaye-senanque`,
    title_fr: 'Dîner dans la Forêt des cèdres',
    title_en: 'Dinner in the Cedar Forest',
    description_fr:
      'Dîner privatif sous les cèdres avec vue sur les champs de lavande et l’Abbaye de Sénanque. Champagne, produits du marché, service à la table — un moment hors du temps organisé par la conciergerie.',
    description_en:
      'A private dinner under the cedars with views over lavender fields and Sénanque Abbey. Champagne, market produce, table service — a timeless moment arranged by the concierge.',
    booking_required: true,
  },
  {
    key: 'deux-cv-canoe-sorgue',
    image_public_id: `${AIRELLES_IMAGE_PREFIX}/poi-canoe-sorgue`,
    title_fr: 'Balade en 2CV ou canoë sur la Sorgue',
    title_en: '2CV or canoe on the Sorgue',
    description_fr:
      'Escapades provençales selon l’humeur : virée en 2CV Citroën dans les villages du Luberon, ou descente en canoë sur la Sorgue cristalline depuis Fontaine-de-Vaucluse. Organisé par la conciergerie.',
    description_en:
      'Provençal outings to suit the mood: a Citroën 2CV spin through Luberon villages, or a canoe descent on the crystal-clear Sorgue from Fontaine-de-Vaucluse. Arranged by the concierge.',
    booking_required: true,
  },
] as const;

// ---------------------------------------------------------------------------
// signature_experiences — Kid Club (kit `template-hotel.html` § « L'hôtel en
// bref », D4). Typed `kind: 'kid_club'` so the fiche surfaces it as a dedicated
// `.feature-block` rather than in the generic signature grid. Sourced from the
// official site (airelles.com — « Airelles Summer Camp » / children activities,
// Tavily 2026-06-09). The other 6 signature experiences stay row-driven; this
// entry is merged in (idempotent by `key`) by {@link withAirellesKidClub}.
// ---------------------------------------------------------------------------

export const AIRELLES_KID_CLUB = {
  key: 'airelles-summer-camp',
  kind: 'kid_club',
  image_public_id: `${AIRELLES_IMAGE_PREFIX}/press-9`,
  title_fr: 'Airelles Summer Camp — le club enfants',
  title_en: "Airelles Summer Camp — the kids' club",
  description_fr:
    'Le club enfants de La Bastide : piscine réservée aux petits, salle de jeux intérieure et extérieure, chasses au trésor, cinéma en plein air dans les jardins, ateliers cuisine et passages de magiciens. Pensé pour les enfants comme pour les ados.',
  description_en:
    "La Bastide's kids' club: a children-only swimming pool, indoor and outdoor games room, treasure hunts, an open-air cinema in the gardens, cookery workshops and visiting magicians. Designed for children and teens alike.",
  badge_fr: 'Pour les familles',
  badge_en: 'For families',
  booking_required: false,
  website: 'https://airelles.com/fr/destination/gordes-hotel/airelles-summer-camp-gordes-enfants',
} as const;

/**
 * Merges the golden Kid Club entry into the row's `signature_experiences`,
 * idempotently (matched on `key`). Accepts the unknown DB value: when it is
 * not an array, returns a single-element array with the Kid Club. Used by both
 * the promotion script and the apps/web local override so the entry is present
 * in prod and in the local sandbox.
 */
export function withAirellesKidClub(current: unknown): unknown[] {
  const base = Array.isArray(current) ? [...current] : [];
  const already = base.some(
    (e) =>
      typeof e === 'object' && e !== null && (e as { key?: unknown }).key === AIRELLES_KID_CLUB.key,
  );
  if (!already) base.push(AIRELLES_KID_CLUB);
  return base;
}

/** Full signature grid for the kit pilot: 6 concierge experiences + Kid Club. */
export function resolveAirellesSignatureExperiences(): unknown[] {
  return [...AIRELLES_SIGNATURE_EXPERIENCES, AIRELLES_KID_CLUB];
}

// ---------------------------------------------------------------------------
// gallery_images + hero — 30 photos / 10 catégories (CDC Hard Rule 9)
// press-1…22 = upload-airelles-gordes-gallery.ts ; press-23…30 = net-new
// Room carousels use press-31+ (see kit-airelles-display.ts).
// ---------------------------------------------------------------------------

export const AIRELLES_HERO_IMAGE = 'cct/hotels/les-airelles-gordes/press-1';

export const AIRELLES_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-1',
    category: 'exterior',
    alt_fr: 'Vue aérienne de la bastide Airelles Gordes et de ses jardins, Gordes',
    alt_en: 'Aerial view of the Airelles Gordes bastide and its gardens, Gordes',
    caption_fr:
      'La bastide du XVIIIe siècle et ses jardins en terrasses dominent le village perché de Gordes, dans le Luberon.',
    caption_en:
      'The 18th-century bastide and its terraced gardens overlook the hilltop village of Gordes, in the Luberon.',
    credit: 'HiddenCliff',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-2',
    category: 'exterior',
    alt_fr: 'Entrée en pierre de la bastide Airelles Gordes, Gordes',
    alt_en: 'Stone entrance of the Airelles Gordes bastide, Gordes',
    caption_fr:
      'L’entrée en pierre dorée de La Bastide, restaurée par 150 artisans lors de la réouverture de 2015.',
    caption_en:
      'The golden-stone entrance of La Bastide, restored by 150 craftspeople for its 2015 reopening.',
    credit: 'HiddenCliff',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-3',
    category: 'lobby',
    alt_fr: 'Salon de réception provençal de l’Airelles Gordes, Gordes',
    alt_en: 'Provençal reception lounge at Airelles Gordes, Gordes',
    caption_fr:
      'Le salon de réception mêle mobilier d’époque et lumière de Provence sous les voûtes de La Bastide.',
    caption_en:
      'The reception lounge blends period furniture with Provençal light beneath the vaults of La Bastide.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-4',
    category: 'concierge',
    alt_fr: 'Club Concierge et salon rouge de l’Airelles Gordes, Gordes',
    alt_en: 'Concierge Club and red lounge at Airelles Gordes, Gordes',
    caption_fr:
      'Le Club Concierge accueille les membres dans un salon rouge aux boiseries peintes et livres anciens.',
    caption_en:
      'The Concierge Club welcomes members in a red lounge with painted woodwork and antique books.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-5',
    category: 'view',
    alt_fr: 'Balade à vélo vers le village perché de Gordes depuis l’Airelles Gordes',
    alt_en: 'Cycling toward the hilltop village of Gordes from Airelles Gordes',
    caption_fr:
      'Le village perché de Gordes, à dix minutes de La Bastide, classé parmi les plus beaux villages de France.',
    caption_en:
      'The hilltop village of Gordes, ten minutes from La Bastide, ranks among France’s most beautiful villages.',
    credit: 'HiddenCliff',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-6',
    category: 'view',
    alt_fr: 'Jardins de la bastide Airelles Gordes face au Luberon, Gordes',
    alt_en: 'Airelles Gordes bastide gardens facing the Luberon, Gordes',
    caption_fr:
      'Les jardins en terrasses de La Bastide ouvrent sur la vallée du Luberon et les cyprès du village.',
    caption_en:
      'La Bastide’s terraced gardens open onto the Luberon valley and the village cypresses.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-7',
    category: 'pool',
    alt_fr: 'Piscine extérieure en terrasse de l’Airelles Gordes, Gordes',
    alt_en: 'Outdoor terrace pool at Airelles Gordes, Gordes',
    caption_fr:
      'La piscine en plein air, vue du ciel, est bordée de transats et de parasols face aux collines du Luberon.',
    caption_en:
      'The open-air pool, seen from above, is lined with loungers and umbrellas facing the Luberon hills.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-8',
    category: 'pool',
    alt_fr: 'Piscine bordée d’oliviers de l’Airelles Gordes, Gordes',
    alt_en: 'Olive-lined pool at Airelles Gordes, Gordes',
    caption_fr:
      'La piscine en terrasse, entourée d’oliviers et de cyprès centenaires, ouvre sur la vallée du Luberon.',
    caption_en:
      'The terrace pool, framed by olive trees and ancient cypresses, opens onto the Luberon valley.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-9',
    category: 'pool',
    alt_fr: 'Piscine familiale du Kids Club Airelles Gordes, Gordes',
    alt_en: 'Family pool at the Airelles Gordes Kids Club, Gordes',
    caption_fr:
      'La piscine du Kids Club accueille les familles dans un bassin dédié, à l’écart de la piscine principale.',
    caption_en:
      'The Kids Club pool welcomes families in a dedicated basin, away from the main pool.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-10',
    category: 'room',
    alt_fr: 'Chambre Supérieure Village de l’Airelles Gordes, Gordes',
    alt_en: 'Superior Village bedroom at Airelles Gordes, Gordes',
    caption_fr:
      'Les chambres Supérieures Village marient pierre, lin et bois patiné dans l’esprit des bastides provençales.',
    caption_en:
      'Superior Village rooms pair stone, linen and aged wood in the spirit of Provençal bastides.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-11',
    category: 'room',
    alt_fr: 'Chambre Deluxe Valley de l’Airelles Gordes, Gordes',
    alt_en: 'Deluxe Valley bedroom at Airelles Gordes, Gordes',
    caption_fr:
      'La Chambre Deluxe Valley ouvre sur la vallée du Luberon depuis une voûte en pierre et un parquet chevron.',
    caption_en:
      'The Deluxe Valley room opens onto the Luberon valley from a stone vault and herringbone parquet.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-12',
    category: 'suite',
    alt_fr: 'Chambre de la Suite Baron de Simiane, Airelles Gordes, Gordes',
    alt_en: 'Bedroom of the Baron de Simiane Suite, Airelles Gordes, Gordes',
    caption_fr:
      'La Suite Baron de Simiane, choix du Concierge, ouvre sur les toits de Gordes et la vallée.',
    caption_en:
      'The Baron de Simiane Suite, the Concierge’s pick, opens onto the rooftops of Gordes and the valley.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-13',
    category: 'suite',
    alt_fr: 'Salon de la Suite Vasarely de l’Airelles Gordes, Gordes',
    alt_en: 'Living room of the Vasarely Suite at Airelles Gordes, Gordes',
    caption_fr:
      'La Suite Vasarely rend hommage à l’artiste avec des motifs géométriques et des boiseries rouges.',
    caption_en:
      'The Vasarely Suite pays tribute to the artist with geometric patterns and red woodwork.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-14',
    category: 'view',
    alt_fr: 'Terrasse privée de la Suite Vasarely, Airelles Gordes, Gordes',
    alt_en: 'Private terrace of the Vasarely Suite, Airelles Gordes, Gordes',
    caption_fr:
      'La terrasse privée de la Suite Vasarely sert le thé face au village perché de Gordes.',
    caption_en:
      'The Vasarely Suite’s private terrace serves afternoon tea facing the hilltop village of Gordes.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-15',
    category: 'dining',
    alt_fr: 'Terrasse de La Bastide de Pierres, trattoria italienne, Airelles Gordes',
    alt_en: 'Terrace of La Bastide de Pierres Italian trattoria, Airelles Gordes',
    caption_fr:
      'La Bastide de Pierres installe ses tables colorées sous la pergola, esprit trattoria napolitaine.',
    caption_en:
      'La Bastide de Pierres sets its colourful tables under the pergola, in a Neapolitan trattoria spirit.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-16',
    category: 'dining',
    alt_fr: 'Table dressée sur la terrasse de La Table de La Bastide, Airelles Gordes',
    alt_en: 'Set table on the terrace of La Table de La Bastide, Airelles Gordes',
    caption_fr:
      'La terrasse de La Table de La Bastide sert une cuisine de terroir face à la vallée du Luberon.',
    caption_en:
      'The terrace of La Table de La Bastide serves terroir-driven cuisine facing the Luberon valley.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-17',
    category: 'dining',
    alt_fr: 'Terrasse panoramique du Clover Gordes par Jean-François Piège, Airelles Gordes',
    alt_en: 'Panoramic terrace of Clover Gordes by Jean-François Piège, Airelles Gordes',
    caption_fr:
      'La terrasse du Clover Gordes, table signée Jean-François Piège, surplombe les toits du village.',
    caption_en:
      'The Clover Gordes terrace, a table by Jean-François Piège, overlooks the village rooftops.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-18',
    category: 'dining',
    alt_fr: 'Terrasse colorée du Beefbar Gordes, Airelles Gordes',
    alt_en: 'Colourful terrace of Beefbar Gordes, Airelles Gordes',
    caption_fr:
      'Le Beefbar Gordes installe ses tables bistrot sous une pergola face à la vallée du Luberon.',
    caption_en: 'Beefbar Gordes sets its bistro tables under a pergola facing the Luberon valley.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-19',
    category: 'dining',
    alt_fr: 'Buffet brunch et pâtisseries de l’Airelles Gordes, Gordes',
    alt_en: 'Brunch buffet and pastries at Airelles Gordes, Gordes',
    caption_fr:
      'Le brunch dominical aligne tartes, éclairs et meringues dans le salon boisé de La Bastide.',
    caption_en:
      'The Sunday brunch lines tarts, éclairs and meringues in La Bastide’s wood-panelled salon.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-20',
    category: 'dining',
    alt_fr: 'Boutique Ladurée de l’Airelles Gordes, Gordes',
    alt_en: 'Ladurée boutique at Airelles Gordes, Gordes',
    caption_fr:
      'La boutique Ladurée, façade pistache, sert macarons et thé sur sa terrasse provençale.',
    caption_en:
      'The pistachio-fronted Ladurée boutique serves macarons and tea on its Provençal terrace.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-21',
    category: 'spa',
    alt_fr: 'Piscine intérieure du Spa Airelles par Guerlain, Gordes',
    alt_en: 'Indoor pool at the Airelles Spa by Guerlain, Gordes',
    caption_fr:
      'Le Spa Airelles par Guerlain occupe des salles voûtées en pierre, inspirées de l’abbaye de Sénanque.',
    caption_en:
      'The Airelles Spa by Guerlain unfolds across vaulted stone rooms inspired by Sénanque Abbey.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-22',
    category: 'spa',
    alt_fr: 'Accueil du Spa Airelles par Guerlain, Airelles Gordes, Gordes',
    alt_en: 'Reception of the Airelles Spa by Guerlain, Airelles Gordes, Gordes',
    caption_fr:
      'L’accueil du Spa Airelles par Guerlain, en boiseries chalets, expose les soins et parfums de la maison.',
    caption_en:
      'The Airelles Spa by Guerlain reception, in chalet woodwork, displays the house’s treatments and fragrances.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-23',
    category: 'dining',
    alt_fr: 'Salle du Clover Gordes signé Jean-François Piège, Airelles Gordes',
    alt_en: 'Dining room at Clover Gordes by Jean-François Piège, Airelles Gordes',
    caption_fr:
      'Clover Gordes installe sa cuisine provençale dans une salle voûtée aux accents contemporains.',
    caption_en:
      'Clover Gordes serves Provençal cuisine in a vaulted room with contemporary accents.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-24',
    category: 'exterior',
    alt_fr: 'Façade aérienne de La Bastide Airelles Gordes, Gordes',
    alt_en: 'Aerial facade of La Bastide Airelles Gordes, Gordes',
    caption_fr:
      'La bastide s’accroche aux falaises calcaires de Gordes, au-dessus de la vallée du Luberon.',
    caption_en: 'The bastide clings to Gordes’ limestone cliffs, above the Luberon valley.',
    credit: 'HiddenCliff',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-25',
    category: 'lobby',
    alt_fr: 'Salon boisé de La Bastide Airelles Gordes, Gordes',
    alt_en: 'Wood-panelled salon at La Bastide Airelles Gordes, Gordes',
    caption_fr: 'Le salon principal mêle boiseries, tapisseries et lumière dorée de Provence.',
    caption_en: 'The main salon blends wood panelling, tapestries and golden Provençal light.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-26',
    category: 'spa',
    alt_fr: 'Bassin du Spa Airelles sous voûtes en pierre, Gordes',
    alt_en: 'Spa Airelles pool under stone vaults, Gordes',
    caption_fr: 'La piscine intérieure du spa occupe une salle voûtée au calme absolu.',
    caption_en: 'The spa’s indoor pool fills a vaulted room in absolute calm.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-27',
    category: 'events',
    alt_fr: 'Réception événementielle dans les jardins de La Bastide, Gordes',
    alt_en: 'Event reception in the gardens of La Bastide, Gordes',
    caption_fr: 'Les jardins en terrasses accueillent cocktails et dîners privés face au Luberon.',
    caption_en: 'The terraced gardens host cocktails and private dinners facing the Luberon.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-28',
    category: 'dining',
    alt_fr: 'Table dressée à La Table de La Bastide, Airelles Gordes',
    alt_en: 'Set table at La Table de La Bastide, Airelles Gordes',
    caption_fr:
      'La Table de La Bastide sert une cuisine provençale de saison en salle ou en terrasse.',
    caption_en:
      'La Table de La Bastide serves seasonal Provençal cuisine indoors or on the terrace.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-29',
    category: 'detail',
    alt_fr: 'Détail de pierre et mobilier chiné à La Bastide, Gordes',
    alt_en: 'Stone and antique furniture detail at La Bastide, Gordes',
    caption_fr: 'Pierre de Bourgogne, lin et mobilier provençal chiné composent chaque pièce.',
    caption_en: 'Burgundy stone, linen and antique Provençal furniture shape every room.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-gordes/press-30',
    category: 'view',
    alt_fr: 'Village perché de Gordes vu depuis La Bastide, Luberon',
    alt_en: 'Hilltop village of Gordes seen from La Bastide, Luberon',
    caption_fr:
      'Depuis La Bastide, le village de Gordes se découpe en pierre dorée sur le ciel du Luberon.',
    caption_en:
      'From La Bastide, the village of Gordes cuts a golden-stone silhouette against the Luberon sky.',
    credit: 'HiddenCliff',
  },
] as const;

// ---------------------------------------------------------------------------
// external_sources — EEAT provenance (≥5 références publiques)
// ---------------------------------------------------------------------------

export const AIRELLES_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q22996844',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q22996844',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Gordes',
    source: 'wikipedia',
    source_url: 'https://fr.wikipedia.org/wiki/Gordes',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/Gordes',
    source: 'wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Gordes',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'https://airelles.com/fr/destination/gordes-hotel/la-bastide-5-star-provence-luberon',
    source: 'official',
    source_url:
      'https://airelles.com/fr/destination/gordes-hotel/la-bastide-5-star-provence-luberon',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'commons_category',
    value: 'Category:Gordes',
    source: 'commons',
    source_url: 'https://commons.wikimedia.org/wiki/Category:Gordes',
    confidence: 'medium',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'architect',
    value: ['Christophe Tollemer'],
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q22996844',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 2015,
    source: 'official',
    source_url:
      'https://airelles.com/fr/destination/gordes-hotel/la-bastide-5-star-provence-luberon',
    confidence: 'high',
    collected_at: '2026-06-09T00:00:00.000Z',
  },
] as const;

type AirellesExternalScalarField =
  | 'wikidata_id'
  | 'wikipedia_url_fr'
  | 'wikipedia_url_en'
  | 'official_url';

function airellesExternalScalar(field: AirellesExternalScalarField): string {
  const entry = AIRELLES_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

// ---------------------------------------------------------------------------
// buildAirellesGoldenFields — the full set of `public.hotels` columns to write
// when promoting the golden template into the DB. Transforms that depend on the
// existing row (sanitise / patch / dedup) take the current values as input.
// ---------------------------------------------------------------------------

export interface AirellesGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildAirellesGoldenFields(current: AirellesGoldenInput): Record<string, unknown> {
  const spaInfo = patchAirellesSpa(current.spa_info);
  return {
    highlights: AIRELLES_HIGHLIGHTS,
    faq_content: AIRELLES_FAQ_CONTENT_PROMOTE,
    transports: AIRELLES_TRANSPORTS,
    restaurant_info: AIRELLES_RESTAURANT_INFO,
    points_of_interest: AIRELLES_POINTS_OF_INTEREST,
    concierge_advice: AIRELLES_CONCIERGE_ADVICE,
    concierge_pick: AIRELLES_CONCIERGE_PICK,
    concierge_hook: AIRELLES_CONCIERGE_HOOK,
    instagram: AIRELLES_INSTAGRAM,
    policies: patchAirellesPolicies(current.policies),
    awards: patchAirellesAwards(current.awards),
    amenities: patchAirellesAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: AIRELLES_DESCRIPTION_FR,
    description_en: AIRELLES_DESCRIPTION_EN,
    long_description_sections: sanitizeAirellesJsonb(
      resolveAirellesLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeAirellesJsonb(resolveAirellesSignatureExperiences()),
    featured_reviews: AIRELLES_FEATURED_REVIEWS,
    upcoming_events: AIRELLES_UPCOMING_EVENTS,
    factual_summary_fr: AIRELLES_FACTUAL_SUMMARY_FR,
    factual_summary_en: AIRELLES_FACTUAL_SUMMARY_EN,
    meta_desc_fr: AIRELLES_META_DESC_FR,
    meta_desc_en: AIRELLES_META_DESC_EN,
    meta_title_fr: AIRELLES_META_TITLE_FR,
    meta_title_en: AIRELLES_META_TITLE_EN,
    hero_image: AIRELLES_HERO_IMAGE,
    gallery_images: AIRELLES_GALLERY_IMAGES,
    external_sources: AIRELLES_EXTERNAL_SOURCES,
    wikidata_id: airellesExternalScalar('wikidata_id'),
    wikipedia_url_fr: airellesExternalScalar('wikipedia_url_fr'),
    wikipedia_url_en: airellesExternalScalar('wikipedia_url_en'),
    official_url: airellesExternalScalar('official_url'),
    phone_e164: AIRELLES_PHONE_E164,
    address: AIRELLES_ADDRESS,
    postal_code: AIRELLES_POSTAL_CODE,
    email_reservations: AIRELLES_EMAIL_RESERVATIONS,
    mice_info: AIRELLES_MICE_INFO,
  };
}
