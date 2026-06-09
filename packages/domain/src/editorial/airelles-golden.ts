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

import { dropDuplicateCategorySections } from './golden-template';

export const AIRELLES_PROMOTE_SLUG = 'les-airelles-gordes';

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
      type_fr: 'Cuisine provençale par Jean-François Piège',
      type_en: 'Provençal cuisine by Jean-François Piège',
      chef: 'Jean-François Piège',
      features: ['Terrasse panoramique', 'Vue vallée du Luberon', 'Produits du terroir'],
      hours_fr: 'Tous les jours, 12h15–14h et 19h15–21h45',
      hours_en: 'Daily, 12:15–2:00 pm and 7:15–9:45 pm',
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/clover-gordes-jean-francois-piege-cuisine-terroir-terrasse',
      reservation_url: 'https://www.sevenrooms.com/reservations/clovergordes',
      phone: '+33 4 90 72 18 80',
      price_note_fr: 'Carte à la sélection — menu sur demande (clovergordes@airelles.com)',
      price_note_en: 'À-la-carte — menu on request (clovergordes@airelles.com)',
      tip_fr:
        'Mon conseil : réservez une table en terrasse vers 19h45 pour dîner pendant que le soleil glisse sur la vallée. Jean-François Piège est multi-étoilé ailleurs — ici la cuisine est provençale, sans étoile au guide, mais l’adresse est la plus courue de La Bastide.',
      tip_en:
        'My tip: book a terrace table around 7:45 pm to dine as the sun slides over the valley. Jean-François Piège is multi-starred elsewhere — here the cooking is Provençal, with no Michelin star, but it is the most sought-after table at La Bastide.',
    },
    {
      name: 'La Table de La Bastide',
      type_fr: 'Cuisine provençale raffinée',
      type_en: 'Refined Provençal cuisine',
      chef: 'Pierre Marty',
      features: ['Terrasse panoramique', 'Jardins suspendus'],
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/la-table-de-la-bastide-restaurant',
      phone: HOTEL_PHONE,
      tip_fr:
        'Mon conseil : c’est ici que se prend le petit-déjeuner et le déjeuner face aux Alpilles. Demandez la table d’angle des jardins suspendus, à l’ombre en milieu de journée.',
      tip_en:
        'My tip: this is where breakfast and lunch are served facing the Alpilles. Ask for the corner table in the hanging gardens — shaded at midday.',
    },
    {
      name: 'Le Brunch du Dimanche',
      type_fr: 'Brunch dominical dans les jardins suspendus',
      type_en: 'Sunday brunch in the hanging gardens',
      features: ['Buffet sucré & salé', 'Le dimanche uniquement'],
      hours_fr: 'Le dimanche, en saison',
      hours_en: 'Sundays, in season',
      website: 'https://airelles.com/fr/destination/gordes-hotel/restaurants/brunch-dimanche',
      phone: HOTEL_PHONE,
      tip_fr:
        'Mon conseil : le brunch du dimanche est ouvert aux visiteurs extérieurs — réservez 48 h à l’avance, les tables partent vite en été.',
      tip_en:
        'My tip: the Sunday brunch is open to outside guests — book 48 h ahead, tables fill fast in summer.',
    },
    {
      name: 'La Bastide de Pierres',
      type_fr: 'Trattoria italienne',
      type_en: 'Italian trattoria',
      features: ['Pizza napolitaine', 'Pasta', 'Cadre convivial'],
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/la-bastide-pierres-restaurant-italien',
      phone: HOTEL_PHONE,
      tip_fr:
        'Mon conseil : l’adresse décontractée de La Bastide, parfaite pour un dîner en famille. La pasta alle vongole et la pizza napolitaine valent le détour.',
      tip_en:
        'My tip: La Bastide’s relaxed address, perfect for a family dinner. The pasta alle vongole and the Neapolitan pizza are worth the detour.',
    },
    {
      name: 'Ladurée',
      type_fr: 'Salon de thé & pâtisserie',
      type_en: 'Tea room & patisserie',
      features: ['Macarons', 'Pause gourmande au village'],
      website:
        'https://airelles.com/fr/destination/gordes-hotel/restaurants/salon-de-the-laduree-gordes',
      phone: HOTEL_PHONE,
      tip_fr:
        'Mon conseil : la seule terrasse Ladurée du Luberon. Idéale pour une pause à 17h après avoir flâné dans les ruelles caladées de Gordes.',
      tip_en:
        'My tip: the only Ladurée terrace in the Luberon. Ideal for a 5 pm break after wandering Gordes’ cobbled lanes.',
    },
    {
      name: 'Beefbar Gordes',
      type_fr: 'Grill & viandes au feu (ouverture 4 juin 2026)',
      type_en: 'Fire grill & meats (opens 4 June 2026)',
      features: ['Cuissons au feu', 'Saison estivale'],
      reservation_url:
        'https://www.sevenrooms.com/explore/beefbargordes/reservations/create/search/',
      phone: HOTEL_PHONE,
      tip_fr:
        'Mon conseil : la nouveauté de l’été 2026. Ouverture le 4 juin — réservez dès maintenant via SevenRooms, l’adresse fera le plein dès l’ouverture.',
      tip_en:
        'My tip: the summer 2026 newcomer. Opens 4 June — book now via SevenRooms; the place will fill from day one.',
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
// faq_content — 12 entrées réconciliées avec les faits
// ---------------------------------------------------------------------------

export const AIRELLES_FAQ_CONTENT = [
  {
    category: 'before',
    featured: true,
    question_fr: 'Où se situe exactement Airelles Gordes, La Bastide ?',
    question_en: 'Where exactly is Airelles Gordes, La Bastide located?',
    answer_fr:
      'La Bastide se trouve au 61 Rue de la Combe, 84220 Gordes, dans le village perché, dominant la vallée du Luberon. Comptez 50 minutes depuis la gare d’Avignon TGV et environ 1 h depuis l’aéroport Marseille-Provence.',
    answer_en:
      'La Bastide is at 61 Rue de la Combe, 84220 Gordes, in the hilltop village overlooking the Luberon valley. Allow 50 minutes from Avignon TGV station and about 1 hour from Marseille-Provence airport.',
  },
  {
    category: 'before',
    featured: true,
    question_fr: 'Combien de piscines y a-t-il à La Bastide ?',
    question_en: 'How many pools does La Bastide have?',
    answer_fr:
      'L’hôtel compte trois piscines : la piscine en terrasse extérieure cernée d’oliviers, la piscine intérieure sous les voûtes du Spa Airelles, et une piscine dédiée aux enfants au Summer Camp.',
    answer_en:
      'The hotel has three pools: the outdoor terrace pool framed by olive trees, the indoor pool under the vaults of the Spa Airelles, and a dedicated children’s pool at the Summer Camp.',
  },
  {
    category: 'during',
    featured: true,
    question_fr: 'Le restaurant Clover Gordes a-t-il une étoile Michelin ?',
    question_en: 'Does the Clover Gordes restaurant hold a Michelin star?',
    answer_fr:
      'Non. Clover Gordes est la table provençale du chef multi-étoilé Jean-François Piège, mais le restaurant lui-même n’est pas étoilé. Il est ouvert tous les jours, de 12h15 à 14h et de 19h15 à 21h45 ; réservation sur SevenRooms.',
    answer_en:
      'No. Clover Gordes is the Provençal table of multi-starred chef Jean-François Piège, but the restaurant itself does not hold a star. It is open daily, 12:15–2 pm and 7:15–9:45 pm; book via SevenRooms.',
  },
  {
    category: 'during',
    question_fr: 'Quels restaurants trouve-t-on à l’hôtel ?',
    question_en: 'What restaurants are there at the hotel?',
    answer_fr:
      'La Bastide réunit six adresses : Clover Gordes (J-F Piège), La Table de La Bastide (cuisine provençale), le Brunch du Dimanche, La Bastide de Pierres (trattoria italienne), un salon de thé Ladurée et le Beefbar (ouverture le 4 juin 2026).',
    answer_en:
      'La Bastide brings together six venues: Clover Gordes (J-F Piège), La Table de La Bastide (Provençal cuisine), the Sunday Brunch, La Bastide de Pierres (Italian trattoria), a Ladurée tea room and the Beefbar (opening 4 June 2026).',
  },
  {
    category: 'before',
    question_fr: 'Les animaux de compagnie sont-ils acceptés ?',
    question_en: 'Are pets allowed?',
    answer_fr:
      'Chiens et chats sont acceptés sur demande, dans certaines chambres et suites, moyennant 30 € par animal et par jour. À signaler lors de la réservation auprès de la conciergerie ; contactez l’hôtel au +33 4 90 72 12 12 pour confirmer les conditions.',
    answer_en:
      'Dogs and cats are accepted on request, in selected rooms and suites, for €30 per animal, per day. Please flag it at the time of booking with the concierge, and contact the hotel at +33 4 90 72 12 12 to confirm the conditions.',
  },
  {
    category: 'before',
    question_fr: 'Combien de chambres et de suites compte l’hôtel ?',
    question_en: 'How many rooms and suites does the hotel have?',
    answer_fr:
      'La Bastide dispose de 40 chambres et suites, des Chambres Supérieures aux suites de prestige (Vasarely, Baron de Simiane, Duc de Soubise), ainsi que la Maison de Constance, une villa privée de quatre chambres avec piscine.',
    answer_en:
      'La Bastide offers 40 rooms and suites, from Superior Rooms to prestige suites (Vasarely, Baron de Simiane, Duc de Soubise), plus the Maison de Constance, a private four-bedroom villa with a pool.',
  },
  {
    category: 'during',
    question_fr: 'Quels services de bien-être propose le Spa Airelles ?',
    question_en: 'What wellness services does the Spa Airelles offer?',
    answer_fr:
      'Le Spa Airelles, installé sous des voûtes en pierre, propose soins du visage, massages, sauna, hammam et une piscine intérieure. Les soins se réservent auprès de la conciergerie.',
    answer_en:
      'The Spa Airelles, set under stone vaults, offers facials, massages, a sauna, a hammam and an indoor pool. Treatments are booked through the concierge.',
  },
  {
    category: 'during',
    question_fr: 'L’hôtel accueille-t-il les familles ?',
    question_en: 'Is the hotel family-friendly?',
    answer_fr:
      'Oui. L’Airelles Summer Camp accueille les enfants dans un espace dédié aux jeux et activités, avec sa propre piscine sécurisée. Plusieurs suites et la Maison de Constance conviennent aux familles.',
    answer_en:
      'Yes. The Airelles Summer Camp welcomes children in a space dedicated to games and activities, with its own secure pool. Several suites and the Maison de Constance suit families.',
  },
  {
    category: 'before',
    question_fr: 'Quelles sont les principales choses à voir autour de Gordes ?',
    question_en: 'What are the main things to see around Gordes?',
    answer_fr:
      'À pied : le Château de Gordes (6 min) et les Caves du Palais Saint-Firmin (5 min). En voiture : le Village des Bories, l’Abbaye de Sénanque et ses lavandes, et le Musée du Moulin des Bouillons.',
    answer_en:
      'On foot: the Château de Gordes (6 min) and the Caves du Palais Saint-Firmin (5 min). By car: the Village des Bories, the Sénanque Abbey and its lavender, and the Moulin des Bouillons museum.',
  },
  {
    category: 'before',
    question_fr: 'Quand la lavande de l’Abbaye de Sénanque est-elle en fleur ?',
    question_en: 'When is the lavender at Sénanque Abbey in bloom?',
    answer_fr:
      'Les champs de lavande devant l’abbaye fleurissent généralement de la mi-juin à la mi-juillet. La visite de l’abbaye se fait sur réservation (senanque.fr), comptez 8 € la visite guidée.',
    answer_en:
      'The lavender fields in front of the abbey usually bloom from mid-June to mid-July. Visiting the abbey is by reservation (senanque.fr); a guided tour costs €8.',
  },
  {
    category: 'after',
    question_fr: 'Comment réserver une table ou un séjour ?',
    question_en: 'How do I book a table or a stay?',
    answer_fr:
      'Notre conciergerie organise l’ensemble de votre séjour : chambres, tables, soins et excursions. Contactez-nous au +33 4 90 72 12 12 ou par e-mail à reservation.labastide@airelles.com.',
    answer_en:
      'Our concierge arranges your entire stay: rooms, tables, treatments and excursions. Contact us at +33 4 90 72 12 12 or by email at reservation.labastide@airelles.com.',
  },
  {
    category: 'agency',
    question_fr: 'À quelle période l’hôtel est-il ouvert ?',
    question_en: 'What is the hotel’s opening season?',
    answer_fr:
      'La Bastide est un établissement saisonnier, ouvert du printemps à l’automne. Le Beefbar ouvre le 4 juin 2026. Pour les dates exactes d’ouverture et de fermeture, contactez la conciergerie.',
    answer_en:
      'La Bastide is a seasonal property, open from spring to autumn. The Beefbar opens on 4 June 2026. For exact opening and closing dates, contact the concierge.',
  },
] as const;

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
      image_public_id: 'cct/hotels/les-airelles-gordes/places-2',
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
      image_public_id: 'cct/hotels/les-airelles-gordes/places-3',
      caption_fr:
        'Quelques jours suspendus dans le temps à Airelles Gordes — les ruelles de pierre de Gordes au printemps et cette lumière provençale inimitable.',
      caption_en:
        'A few days suspended in time at Airelles Gordes — the stone streets of Gordes in spring and that unmistakable Provençal light.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Résumés factuels + méta-descriptions (corrigés : pas d'étoile Michelin)
// ---------------------------------------------------------------------------

export const AIRELLES_FACTUAL_SUMMARY_FR =
  'Palace du XVIIIe siècle dominant le village perché de Gordes, à 50 min d’Avignon TGV, avec 40 chambres, trois piscines, spa voûté et table de Jean-François Piège.';
export const AIRELLES_FACTUAL_SUMMARY_EN =
  '18th-century Palace overlooking the hilltop village of Gordes, 50 min from Avignon TGV, with 40 rooms, three pools, a vaulted spa and a Jean-François Piège table.';
export const AIRELLES_META_DESC_FR =
  'Palace 5 étoiles à Gordes, sur les hauteurs du Luberon : vue sur la vallée, trois piscines, spa Airelles by Guerlain et table signée Jean-François Piège.';
export const AIRELLES_META_DESC_EN =
  'Five-star Palace in Gordes, high above the Luberon: valley views, three pools, an Airelles by Guerlain spa and a table by chef Jean-François Piège.';

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

/** Drop the FALSE "michelin_restaurant" amenity tag (fine_dining stays). */
export function patchAirellesAmenities(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.filter((entry) => {
    if (entry === null || typeof entry !== 'object') return true;
    return (entry as Record<string, unknown>)['key'] !== 'michelin_restaurant';
  });
}

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
  title_fr: 'Airelles Summer Camp — le club enfants',
  title_en: "Airelles Summer Camp — the kids' club",
  description_fr:
    'Le club enfants de La Bastide : piscine réservée aux petits, salle de jeux intérieure et extérieure, chasses au trésor, cinéma en plein air dans les jardins, ateliers cuisine et passages de magiciens. Pensé pour les enfants comme pour les ados.',
  description_en:
    "La Bastide's kids' club: a children-only swimming pool, indoor and outdoor games room, treasure hunts, an open-air cinema in the gardens, cookery workshops and visiting magicians. Designed for children and teens alike.",
  badge_fr: 'Pour les familles',
  badge_en: 'For families',
  booking_required: false,
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
  return {
    highlights: AIRELLES_HIGHLIGHTS,
    faq_content: AIRELLES_FAQ_CONTENT,
    restaurant_info: AIRELLES_RESTAURANT_INFO,
    points_of_interest: AIRELLES_POINTS_OF_INTEREST,
    concierge_advice: AIRELLES_CONCIERGE_ADVICE,
    concierge_pick: AIRELLES_CONCIERGE_PICK,
    concierge_hook: AIRELLES_CONCIERGE_HOOK,
    instagram: AIRELLES_INSTAGRAM,
    policies: patchAirellesPolicies(current.policies),
    awards: patchAirellesAwards(current.awards),
    amenities: patchAirellesAmenities(current.amenities),
    spa_info: patchAirellesSpa(current.spa_info),
    description_fr:
      typeof current.description_fr === 'string'
        ? sanitizeAirellesText(current.description_fr)
        : current.description_fr,
    description_en:
      typeof current.description_en === 'string'
        ? sanitizeAirellesText(current.description_en)
        : current.description_en,
    long_description_sections: sanitizeAirellesJsonb(
      dropDuplicateCategorySections(current.long_description_sections),
    ),
    signature_experiences: sanitizeAirellesJsonb(
      withAirellesKidClub(current.signature_experiences),
    ),
    factual_summary_fr: AIRELLES_FACTUAL_SUMMARY_FR,
    factual_summary_en: AIRELLES_FACTUAL_SUMMARY_EN,
    meta_desc_fr: AIRELLES_META_DESC_FR,
    meta_desc_en: AIRELLES_META_DESC_EN,
    phone_e164: AIRELLES_PHONE_E164,
    address: AIRELLES_ADDRESS,
    postal_code: AIRELLES_POSTAL_CODE,
    email_reservations: AIRELLES_EMAIL_RESERVATIONS,
  };
}
