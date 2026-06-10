/**
 * Les Airelles Courchevel "golden template" editorial content — single source of
 * truth shared by apps/web kit override and `promote:les-airelles-courchevel-golden`.
 *
 * Facts sourced from airelles.com (Courchevel hotel pages, spa, restaurants,
 * informations pratiques) and Forbes Travel Guide. Omitted when not confidently sourced.
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import {
  LES_AIRELLES_COURCHEVEL_AMENITIES,
  type LesAirellesCourchevelAmenityRecord,
} from './les-airelles-courchevel-amenities';
import { LES_AIRELLES_COURCHEVEL_CONCIERGE_QUESTIONS_KIT } from './les-airelles-courchevel-concierge-questions';
import {
  LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES,
  LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
} from './les-airelles-courchevel-gallery';

export const LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG = 'les-airelles-courchevel';

/** Cloudinary folder prefix for Les Airelles Courchevel kit / golden assets. */
export const LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX = 'cct/hotels/les-airelles-courchevel';

/** Dedicated POI card asset — never reuse gallery `press-*`. */
export function lesAirellesCourchevelPoiImage(poiSlug: string): string {
  return `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/poi-${poiSlug}`;
}

const HOTEL_PHONE = '+33 4 79 00 38 38';
export const LES_AIRELLES_COURCHEVEL_PHONE_E164 = '+33479003838';
export const LES_AIRELLES_COURCHEVEL_ADDRESS = 'Le Jardin Alpin';
export const LES_AIRELLES_COURCHEVEL_POSTAL_CODE = '73120';
export const LES_AIRELLES_COURCHEVEL_LATITUDE = 45.4118;
export const LES_AIRELLES_COURCHEVEL_LONGITUDE = 6.6296;
export const LES_AIRELLES_COURCHEVEL_EMAIL_RESERVATIONS = 'reservation.lesairelles@airelles.com';

export const LES_AIRELLES_COURCHEVEL_HOTEL_DISPLAY_NAME = 'Les Airelles Courchevel';

// ---------------------------------------------------------------------------
// restaurant_info.venues — 6 restaurants + 2 bars (official airelles.com, CDC D7)
// ---------------------------------------------------------------------------

export const LES_AIRELLES_COURCHEVEL_RESTAURANT_INFO = {
  count: 8,
  michelin_stars: 1,
  venues: [
    {
      name: 'La Table des Airelles',
      type_fr: 'Gastronomique · 1 étoile MICHELIN · Chef Adrien Trouilloud',
      type_en: 'Gourmet · 1 MICHELIN Star · Chef Adrien Trouilloud',
      chef: 'Adrien Trouilloud',
      features: ['Petit-déjeuner buffet', 'Le Festin', 'Dîner aux chandelles'],
      description_fr:
        'Table signature du palace : petit-déjeuner gourmand, déjeuner Le Festin et dîners orchestrés par le chef exécutif Adrien Trouilloud, 1 étoile MICHELIN.',
      description_en:
        'Palace signature table: gourmet breakfast, Le Festin lunch and dinners led by executive chef Adrien Trouilloud, 1 MICHELIN Star.',
      website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
      phone: HOTEL_PHONE,
      price_note_fr: 'Menus gastronomiques · demi-pension selon forfait',
      price_note_en: 'Gourmet menus · half-board per package',
      tip_fr:
        'Mon conseil : réservez Le Festin le week-end — le buffet midi est l’expérience la plus spectaculaire du Jardin Alpin.',
      tip_en:
        'My tip: book Le Festin at weekends — the midday buffet is the most spectacular experience in Le Jardin Alpin.',
    },
    {
      name: 'Matsuhisa Courchevel',
      type_fr: 'Japonaise-péruvienne · Nobu Matsuhisa',
      type_en: 'Japanese-Peruvian · Nobu Matsuhisa',
      chef: 'Nobu Matsuhisa',
      features: ['Black Cod Miso', 'Sashimi', 'Robata grill'],
      hours_fr: 'Tous les jours 19h–22h',
      hours_en: 'Daily 7 pm–10 pm',
      description_fr:
        'Fusion japonaise et péruvienne signée Nobu : Yellowtail Jalapeño, Black Cod Miso et sushi dans une ambiance bois et lumière ambrée.',
      description_en:
        'Nobu’s Japanese-Peruvian fusion: Yellowtail Jalapeño, Black Cod Miso and sushi in an amber-lit wood setting.',
      website:
        'https://airelles.com/fr/destination/courchevel-hotel/restaurants/matsuhisa-courchevel',
      phone: HOTEL_PHONE,
      reservation_url: 'mailto:restaurants.airelles@airelles.com',
      price_note_fr: 'À la carte · menus dégustation',
      price_note_en: 'À la carte · tasting menus',
      tip_fr:
        'Mon conseil : commencez par le Black Cod Miso — c’est la signature qui a fait la maison Nobu.',
      tip_en: 'My tip: start with Black Cod Miso — the signature that built the Nobu house.',
    },
    {
      name: 'Palladio',
      type_fr: 'Trattoria italienne · Courchevel',
      type_en: 'Italian trattoria · Courchevel',
      features: ['Arancini', 'Pasta', 'Tiramisu'],
      description_fr:
        'Velours émeraude et lustres dorés pour une trattoria italienne : antipasti, pâtes fraîches et desserts maison.',
      description_en:
        'Emerald velvet and gilded chandeliers for an Italian trattoria: antipasti, fresh pasta and house desserts.',
      website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : parfait pour un déjeuner convivial entre deux descentes — réservez côté salon pour le feu de cheminée.',
      tip_en:
        'My tip: ideal for a convivial lunch between runs — book a salon table near the fireplace.',
    },
    {
      name: 'Le Coin Savoyard',
      type_fr: 'Cuisine savoyarde · coin montagne',
      type_en: 'Savoyard cuisine · alpine nook',
      features: ['Reblochon', 'Diots', 'Plats montagnards'],
      description_fr:
        'Classiques savoyards au coin du feu : fondues, viandes rôties et ambiance boiseries pour les soirées froides.',
      description_en:
        'Savoyard classics by the fire: fondues, roasted meats and wood-panelled mood for cold evenings.',
      website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : la table la plus réconfortante après une journée de neige — demandez les diots du jour.',
      tip_en: 'My tip: the most comforting table after a snowy day — ask for the diots of the day.',
    },
    {
      name: 'Le Chalet de Pierres',
      type_fr: 'Restaurant sur pistes · skis aux pieds',
      type_en: 'On-slope restaurant · ski-in',
      features: ['Terrasse pistes', 'Cuisine alpine'],
      description_fr:
        'Adresse sur les pistes du Jardin Alpin, accessible en ski ou à pied — déjeuner en terrasse plein soleil.',
      description_en:
        'A slope-side address in Le Jardin Alpin, reachable on skis or on foot — sunny terrace lunch.',
      website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
      phone: HOTEL_PHONE,
      price_note_fr: 'À la carte',
      price_note_en: 'À la carte',
      tip_fr:
        'Mon conseil : partez skis aux pieds vers 12 h 30 — la terrasse part vite en haute saison.',
      tip_en: 'My tip: ski out around 12:30 pm — the terrace fills fast in peak season.',
    },
    {
      name: 'La Folie Douce · La Fruitière',
      type_fr: 'Restaurant festif · altitude',
      type_en: 'Festive mountain restaurant',
      features: ['Ambiance festive', 'DJ', 'Terrasse'],
      description_fr:
        'Expérience festive en altitude gérée par Les Airelles — déjeuner animé et panorama sur les 3 Vallées.',
      description_en:
        'Festive altitude experience managed by Les Airelles — lively lunch and Three Valleys panorama.',
      website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
      phone: HOTEL_PHONE,
      price_note_fr: 'Selon programme · demi-pension selon forfait',
      price_note_en: 'Per schedule · half-board per package',
      tip_fr:
        'Mon conseil : réservez via la conciergerie pour coordonner transfert et tenue — l’ambiance vaut le détour une fois dans le séjour.',
      tip_en:
        'My tip: book through the concierge to coordinate transfer and dress code — the atmosphere is worth one stay highlight.',
    },
    {
      name: 'Le Bar',
      type_fr: 'Bar cocktails · mixologue',
      type_en: 'Cocktail bar · mixologist',
      features: ['Cocktails signature', 'Snacking', 'Après-ski'],
      description_fr:
        'Bar principal au boiseries peintes : cocktails, snacking et apéritifs avant les tables du palace.',
      description_en:
        'Main bar with painted woodwork: cocktails, light bites and apéritifs before the palace tables.',
      phone: HOTEL_PHONE,
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : vers 18 h, le comptoir capte la lumière dorée — idéal avant Matsuhisa.',
      tip_en: 'My tip: around 6 pm the counter catches golden light — ideal before Matsuhisa.',
    },
    {
      name: 'Le Fumoir',
      type_fr: 'Salon fumoir · cigars & spiritueux',
      type_en: 'Smoking lounge · cigars & spirits',
      features: ['Fumoir', 'Spiritueux', 'Cheminée'],
      description_fr:
        'Fumoir feutré aux fauteuils capitonnés, pour un cigare ou un digestif au coin du feu après le dîner.',
      description_en:
        'Hushed smoking lounge with tufted armchairs, for a cigar or digestif by the fire after dinner.',
      phone: HOTEL_PHONE,
      price_note_fr: 'Spiritueux à la carte',
      price_note_en: 'Spirits à la carte',
      tip_fr:
        'Mon conseil : le fumoir est le prolongement naturel d’un dîner à La Table — réservez un fauteuil près de la cheminée.',
      tip_en:
        'My tip: the smoking lounge naturally extends a Table dinner — reserve an armchair near the fireplace.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — Courchevel 1850 / 3 Vallées buckets
// ---------------------------------------------------------------------------

export const LES_AIRELLES_COURCHEVEL_POINTS_OF_INTEREST = [
  {
    name: 'Altiport de Courchevel',
    name_en: 'Courchevel Altiport',
    type: 'airport',
    category_fr: 'Altitude · transferts',
    category_en: 'Altiport · transfers',
    distance_meters: 800,
    walk_minutes: 12,
    latitude: 45.3967,
    longitude: 6.6347,
    bucket: 'visit',
    description_fr:
      'Altiplan le plus haut d’Europe (2 007 m) : liaisons hélicoptère et avions légers pour arrivées directes au sommet de Courchevel.',
    description_en:
      'Europe’s highest altiport (2,007 m): helicopter and light-aircraft links for direct arrivals atop Courchevel.',
    tip_fr:
      'Mon conseil : pour un transfert hélico depuis Lyon ou Genève, la conciergerie aligne l’heure d’arrivée sur le check-in du palace.',
    tip_en:
      'My tip: for a helicopter transfer from Lyon or Geneva, the concierge aligns arrival with palace check-in.',
    image_public_id: lesAirellesCourchevelPoiImage('altiport-courchevel'),
  },
  {
    name: 'Piste olympique de Courchevel',
    name_en: 'Courchevel Olympic ski jump',
    type: 'landmark',
    category_fr: 'Patrimoine sportif',
    category_en: 'Sporting heritage',
    distance_meters: 1500,
    latitude: 45.4145,
    longitude: 6.6365,
    bucket: 'visit',
    description_fr:
      'Tremplin olympique emblématique visible depuis la station — panorama sur Courchevel 1850 et la vallée.',
    description_en:
      'Emblematic Olympic ski jump visible from the resort — panorama over Courchevel 1850 and the valley.',
    tip_fr:
      'Mon conseil : accessible en ski ou en navette ; la vue depuis le belvédère vaut la pause photo en fin de matinée.',
    tip_en:
      'My tip: reachable on skis or by shuttle; the belvedere view rewards a late-morning photo stop.',
    image_public_id: lesAirellesCourchevelPoiImage('piste-olympique'),
  },
  {
    name: 'Église Saint-Bon-Tarentaise',
    name_en: 'Saint-Bon-Tarentaise church',
    type: 'church',
    category_fr: 'Patrimoine savoyard',
    category_en: 'Savoyard heritage',
    distance_meters: 2000,
    latitude: 45.403,
    longitude: 6.635,
    bucket: 'visit',
    description_fr:
      'Église baroque de l’ancien village de Saint-Bon, à quelques minutes en voiture de Courchevel 1850.',
    description_en:
      'Baroque church of the old Saint-Bon village, a few minutes by car from Courchevel 1850.',
    tip_fr:
      'Mon conseil : combinez avec un déjeuner au Coin Savoyard — le village est calme en milieu de journée.',
    tip_en: 'My tip: combine with lunch at Le Coin Savoyard — the village is quiet at midday.',
    image_public_id: lesAirellesCourchevelPoiImage('eglise-saint-bon'),
  },
  {
    name: 'Domaine skiable des 3 Vallées',
    name_en: 'Three Valleys ski area',
    type: 'ski',
    category_fr: '600 km de pistes',
    category_en: '600 km of slopes',
    distance_meters: 0,
    latitude: 45.412,
    longitude: 6.63,
    bucket: 'do',
    description_fr:
      'Plus grand domaine skiable relié au monde : Courchevel, Méribel, Val Thorens et Les Menuires — ski-in depuis le Jardin Alpin.',
    description_en:
      'World’s largest linked ski area: Courchevel, Méribel, Val Thorens and Les Menuires — ski-in from Le Jardin Alpin.',
    tip_fr:
      'Mon conseil : achetez le forfait 3 Vallées dès l’arrivée — la conciergerie prépare les skipass et le ski valet aligne les skis.',
    tip_en:
      'My tip: buy the Three Valleys pass on arrival — the concierge prepares passes and the ski valet aligns skis.',
    image_public_id: lesAirellesCourchevelPoiImage('trois-vallees'),
  },
  {
    name: 'Le 1947 — Cheval Blanc Courchevel',
    name_en: 'Le 1947 — Cheval Blanc Courchevel',
    type: 'restaurant',
    category_fr: '2 étoiles MICHELIN',
    category_en: '2 MICHELIN Stars',
    distance_meters: 900,
    latitude: 45.4138,
    longitude: 6.6315,
    bucket: 'do',
    description_fr:
      'Table deux étoiles MICHELIN de Sébastien Vauxion au Cheval Blanc — expérience gastronomique à deux pas du Jardin Alpin.',
    description_en:
      'Sébastien Vauxion’s two-MICHELIN-star table at Cheval Blanc — a gastronomic experience steps from Le Jardin Alpin.',
    website: 'https://www.chevalblanc.com/courchevel/',
    tip_fr:
      'Mon conseil : réservez trois semaines à l’avance en haute saison — la conciergerie gère la demande et le transfert.',
    tip_en:
      'My tip: book three weeks ahead in peak season — the concierge handles the request and transfer.',
    image_public_id: lesAirellesCourchevelPoiImage('le-1947'),
  },
  {
    name: 'Héli-ski Tarentaise',
    name_en: 'Tarentaise heli-ski',
    type: 'activity',
    category_fr: 'Hors-piste · hélicoptère',
    category_en: 'Off-piste · helicopter',
    distance_meters: 800,
    latitude: 45.3967,
    longitude: 6.6347,
    bucket: 'do',
    description_fr:
      'Sorties héli-ski au départ de l’altiport avec guides agréés — powder sur les versants de la Tarentaise.',
    description_en:
      'Heli-ski outings from the altiport with licensed guides — powder on Tarentaise slopes.',
    tip_fr:
      'Mon conseil : réservez quarante-huit heures à l’avance et partagez le niveau technique du groupe — la météo décide le créneau.',
    tip_en:
      'My tip: book forty-eight hours ahead and share the group’s technical level — weather sets the slot.',
    image_public_id: lesAirellesCourchevelPoiImage('heli-ski'),
  },
  {
    name: 'Patinoire olympique Courchevel 1850',
    name_en: 'Courchevel 1850 Olympic ice rink',
    type: 'activity',
    category_fr: 'Patinoire publique',
    category_en: 'Public ice rink',
    distance_meters: 600,
    walk_minutes: 8,
    latitude: 45.415,
    longitude: 6.632,
    bucket: 'do',
    description_fr:
      'Patinoire olympique au centre de Courchevel 1850 — glisse libre et sessions familiales en soirée.',
    description_en:
      'Olympic ice rink in Courchevel 1850 centre — public skating and family sessions in the evening.',
    tip_fr:
      'Mon conseil : après le dîner, la patinoire du palace est plus pratique ; celle de la station offre l’ambiance locale.',
    tip_en:
      'My tip: after dinner the palace rink is handier; the resort rink offers local atmosphere.',
    image_public_id: lesAirellesCourchevelPoiImage('patinoire-olympique'),
  },
  {
    name: 'Balade en chiens de traîneau',
    name_en: 'Dog-sled excursion',
    type: 'activity',
    category_fr: 'Expérience nordique',
    category_en: 'Nordic experience',
    distance_meters: 3000,
    latitude: 45.42,
    longitude: 6.64,
    bucket: 'do',
    description_fr:
      'Randonnées en chiens de traîneau dans la vallée de la Tarentaise — créneaux matinaux recommandés.',
    description_en: 'Dog-sled rides in the Tarentaise valley — morning slots recommended.',
    tip_fr:
      'Mon conseil : réservez la veille pour un départ à 9 h — la lumière rasante sur la neige est irréelle.',
    tip_en: 'My tip: book the day before for a 9 am start — raking light on the snow is unreal.',
    image_public_id: lesAirellesCourchevelPoiImage('chiens-traineau'),
  },
  {
    name: 'Village de Courchevel 1850',
    name_en: 'Courchevel 1850 village',
    type: 'shopping',
    category_fr: 'Luxury shopping',
    category_en: 'Luxury shopping',
    distance_meters: 400,
    walk_minutes: 6,
    latitude: 45.414,
    longitude: 6.634,
    bucket: 'shop',
    bucket_tip_fr:
      'Mon conseil : flânez en semaine vers 11 h — les boutiques sont plus disponibles qu’en après-ski.',
    bucket_tip_en:
      'My tip: stroll on a weekday around 11 am — boutiques are more available than at après-ski.',
    description_fr:
      'Artères piétonnes de Courchevel 1850 : Chanel, Dior, Louis Vuitton et maisons de joaillerie au cœur des Alpes.',
    description_en:
      'Courchevel 1850 pedestrian streets: Chanel, Dior, Louis Vuitton and jewellery houses in the Alps.',
    tip_fr:
      'Mon conseil : la conciergerie peut réserver des cabines privées si vous ciblez plusieurs maisons le même jour.',
    tip_en:
      'My tip: the concierge can book private fitting rooms if you target several houses the same day.',
    image_public_id: lesAirellesCourchevelPoiImage('village-1850'),
  },
  {
    name: 'Boutique Vanille & Lilas',
    name_en: 'Vanille & Lilas boutique',
    type: 'store',
    category_fr: 'Boutique palace',
    category_en: 'Palace boutique',
    distance_meters: 0,
    latitude: 45.4118,
    longitude: 6.6296,
    bucket: 'shop',
    description_fr:
      'Boutique signature au palace : mode alpine, accessoires et cadeaux Airelles — Vanille & Lilas.',
    description_en:
      'Signature boutique at the palace: alpine fashion, accessories and Airelles gifts — Vanille & Lilas.',
    tip_fr:
      'Mon conseil : passez après le ski pour les cadeaux de départ — macarons et objets Airelles partent vite en saison.',
    tip_en:
      'My tip: stop after skiing for departure gifts — macarons and Airelles objects sell fast in season.',
    image_public_id: lesAirellesCourchevelPoiImage('boutique-vanille-lilas'),
  },
  {
    name: 'Bernard Orcel Ski Room',
    name_en: 'Bernard Orcel Ski Room',
    type: 'shop',
    category_fr: 'Ski & équipement',
    category_en: 'Ski & equipment',
    distance_meters: 50,
    latitude: 45.4118,
    longitude: 6.6296,
    bucket: 'shop',
    description_fr:
      'Ski valet Bernard Orcel au palace : préparation des skis, affûtage et stockage à l’arrivée.',
    description_en:
      'Bernard Orcel ski valet at the palace: ski prep, tuning and storage on arrival.',
    tip_fr:
      'Mon conseil : envoyez vos mensurations et niveau avant l’arrivée — les skis sont prêts à la première descente.',
    tip_en:
      'My tip: send measurements and level before arrival — skis are ready for the first run.',
    image_public_id: lesAirellesCourchevelPoiImage('ski-valet'),
  },
  {
    name: 'La Mangeoire',
    name_en: 'La Mangeoire',
    type: 'restaurant',
    category_fr: 'Bistrot festif · Courchevel 1850',
    category_en: 'Festive bistro · Courchevel 1850',
    distance_meters: 500,
    latitude: 45.4142,
    longitude: 6.6335,
    bucket: 'eat',
    description_fr:
      'Institution de Courchevel 1850 : ambiance cabaret et cuisine savoyarde généreuse, à quelques minutes à pied.',
    description_en:
      'Courchevel 1850 institution: cabaret mood and generous Savoyard cooking, a few minutes on foot.',
    tip_fr:
      'Mon conseil : réservez pour un dîner festif en groupe — l’ambiance vaut le détour une fois dans le séjour.',
    tip_en: 'My tip: book for a festive group dinner — the atmosphere is worth one stay highlight.',
    image_public_id: lesAirellesCourchevelPoiImage('la-mangeoire'),
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_HIGHLIGHTS = [
  {
    label_fr: 'Palace ski-in/ski-out au Jardin Alpin · Courchevel 1850',
    label_en: 'Ski-in/ski-out Palace in Le Jardin Alpin · Courchevel 1850',
  },
  {
    label_fr: '44 chambres et suites style château austro-hongrois',
    label_en: '44 Austro-Hungarian castle-style rooms and suites',
  },
  {
    label_fr: 'La Table des Airelles — 1 étoile MICHELIN (Adrien Trouilloud)',
    label_en: 'La Table des Airelles — 1 MICHELIN Star (Adrien Trouilloud)',
  },
  {
    label_fr: 'Spa Airelles by La Mer · piscine · cryothérapie · grotte de neige',
    label_en: 'Airelles Spa by La Mer · pool · cryotherapy · snow cave',
  },
  {
    label_fr: 'Six restaurants + Matsuhisa Nobu · demi-pension disponible',
    label_en: 'Six restaurants + Nobu Matsuhisa · half-board available',
  },
  {
    label_fr: 'Winter Camp · patinoire · cinéma privé · domaine 3 Vallées',
    label_en: 'Winter Camp · ice rink · private cinema · Three Valleys domain',
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'ski',
    body: 'Mon conseil : réservez la Suite sur Pistes ou une Junior Suite Prestige côté sud — vous rejoignez le Jardin Alpin skis aux pieds sans passer par la rue. Le rituel que je recommande : ski valet Bernard Orcel prépare les skis la veille, première descente à 8 h 30 quand la piste est encore fraîche, puis cryothérapie au spa avant le dîner à La Table. C’est le rythme qui transforme un week-end en séjour de champion.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'ski',
    body: 'My tip: book the Slope Suite or a south-facing Prestige Junior Suite — you reach Le Jardin Alpin ski-in without crossing the road. The ritual I recommend: Bernard Orcel ski valet prepares skis the night before, first run at 8:30 am while the slope is still fresh, then spa cryotherapy before dinner at La Table. That rhythm turns a weekend into a champion’s stay.',
  },
} as const;

export const LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG = 'suite-sur-pistes';

export const LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_NOTE = {
  fr: 'Ski-in direct depuis le Jardin Alpin — la suite que je bloque en premier pour les skieurs exigeants.',
  en: 'Direct ski-in from Le Jardin Alpin — the suite I hold first for demanding skiers.',
} as const;

export const LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK = {
  slug: LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_SLUG,
  note: LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK_NOTE,
} as const;

export const LES_AIRELLES_COURCHEVEL_CONCIERGE_HOOK = {
  fr: 'Palais des neiges austro-hongrois à Courchevel 1850 : ski-in, six tables, spa La Mer et 600 km de pistes aux pieds du palace.',
  en: 'Austro-Hungarian snow palace in Courchevel 1850: ski-in, six dining addresses, La Mer spa and 600 km of slopes at the palace door.',
} as const;

export const LES_AIRELLES_COURCHEVEL_FACTUAL_SUMMARY_FR =
  'Palace ski-in à Courchevel 1850 : 44 chambres, spa La Mer, La Table des Airelles (1 étoile MICHELIN) et accès direct aux 3 Vallées.';
export const LES_AIRELLES_COURCHEVEL_FACTUAL_SUMMARY_EN =
  'Ski-in Palace in Courchevel 1850: 44 rooms, La Mer spa, La Table des Airelles (1 MICHELIN Star) and direct Three Valleys access.';

export const LES_AIRELLES_COURCHEVEL_DESCRIPTION_FR =
  'Au Jardin Alpin, Les Airelles Courchevel cultive l’atmosphère d’un château austro-hongrois où chaque détail — fresques, boiseries, cheminées — évoque les contes de fées alpine. Quarante-quatre chambres et suites offrent un cocon feutré entre deux descentes, avec conciergerie qui anticipe sans envahir : ski valet, tables, spa et transferts hélicoptère.\n\nLe palace ouvre sur 600 km de pistes reliées. Entre Matsuhisa, Le Coin Savoyard et la patinoire, la maison compose un séjour où l’on ne quitte jamais vraiment la montagne — même au spa, entre grotte de neige et piscine azur.';
export const LES_AIRELLES_COURCHEVEL_DESCRIPTION_EN =
  'In Le Jardin Alpin, Les Airelles Courchevel cultivates an Austro-Hungarian castle atmosphere where every detail — frescoes, woodwork, fireplaces — evokes an alpine fairy tale. Forty-four rooms and suites offer a hushed cocoon between runs, with a concierge who anticipates without intruding: ski valet, tables, spa and helicopter transfers.\n\nThe palace opens onto 600 km of linked slopes. Between Matsuhisa, Le Coin Savoyard and the ice rink, the house shapes a stay where you never truly leave the mountain — even at the spa, between snow cave and azure pool.';

export const LES_AIRELLES_COURCHEVEL_META_DESC_FR =
  'Palace Les Airelles Courchevel 1850 : ski-in, spa La Mer, La Table des Airelles étoilée, Matsuhisa et domaine des 3 Vallées.';
export const LES_AIRELLES_COURCHEVEL_META_DESC_EN =
  'Les Airelles Courchevel 1850 Palace: ski-in, La Mer spa, starred La Table des Airelles, Matsuhisa and Three Valleys ski domain.';
export const LES_AIRELLES_COURCHEVEL_META_TITLE_FR =
  'Les Airelles Courchevel — Palace ski Courchevel 1850 | MyConciergeHotel';
export const LES_AIRELLES_COURCHEVEL_META_TITLE_EN =
  'Les Airelles Courchevel — Ski Palace Courchevel 1850 | MyConciergeHotel';

export const LES_AIRELLES_COURCHEVEL_AFFILIATIONS = [
  {
    kind: 'label',
    source: 'atout_france',
    display_name: 'Palace — Atout France',
    verified: true,
    facet_slug: 'palace-atout-france',
    source_url: 'https://www.atout-france.fr/',
    since_year: 2011,
  },
  {
    kind: 'brand',
    source: 'airelles',
    display_name: 'Airelles Collection',
    verified: true,
    facet_slug: 'airelles',
    source_url: 'https://airelles.com/fr/destination/courchevel-hotel',
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_WELLNESS_INFO = {
  name: 'Spa Airelles by La Mer',
  partner: 'La Mer · LBA',
  treatment_rooms: 6,
  description_fr:
    'Au cœur du Jardin Alpin, le spa marie La Mer et LBA (Laboratoires Botanique Avancée) : piscine azur, grotte de neige, hammam, jacuzzi 40 °C, douches sensorielles et salle fitness Technogym. Cryothérapie, coiffure et manucure complètent l’offre.',
  description_en:
    'At the heart of Le Jardin Alpin, the spa pairs La Mer and LBA (Laboratoires Botanique Avancée): azure pool, snow cave, hammam, 40 °C jacuzzi, sensory showers and Technogym fitness. Cryotherapy, hairdressing and manicures complete the offer.',
  hours_fr: 'Sur rendez-vous · soins selon planning saisonnier',
  hours_en: 'By appointment · treatments per seasonal schedule',
  price_note_fr: 'Soins La Mer et LBA sur réservation — spa.lesairelles@airelles.com',
  price_note_en: 'La Mer and LBA treatments by reservation — spa.lesairelles@airelles.com',
  website: 'https://airelles.com/fr/destination/courchevel-hotel/spa-swimming-pool-jacuzzi-fitness',
  phone: HOTEL_PHONE,
  tip_fr:
    'Mon conseil : enchaînez cryothérapie et piscine après la dernière descente — le spa est au plus calme entre 16 h et 18 h.',
  tip_en:
    'My tip: chain cryotherapy and the pool after the last run — the spa is quietest between 4 and 6 pm.',
} as const;

export const LES_AIRELLES_COURCHEVEL_MICE_INFO = {
  summary_fr:
    'Salons lumineux au cœur du palace pour cocktails, séminaires et dîners privés — restauration signée Les Airelles et accès ski pour incentives.',
  summary_en:
    'Naturally lit salons at the palace heart for cocktails, seminars and private dinners — Les Airelles catering and ski access for incentives.',
  contact_email: LES_AIRELLES_COURCHEVEL_EMAIL_RESERVATIONS,
  total_capacity_seated: 80,
  spaces: [
    {
      key: 'salon-jardin-alpin',
      name: 'Salon Jardin Alpin',
      surface_sqm: 120,
      max_seated: 80,
      configurations: ['cocktail', 'banquet', 'theatre'],
      has_natural_light: true,
      notes_fr: 'Vue montagne · cocktails jusqu’à 80 personnes.',
      notes_en: 'Mountain view · cocktails for up to 80 guests.',
    },
  ],
  event_types: ['corporate-meeting', 'incentive', 'private-dinner', 'wedding'],
} as const;

export const LES_AIRELLES_COURCHEVEL_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Aéroport Genève-Cointrin',
    station_en: 'Geneva Airport',
    distance_meters: 190_000,
    walk_minutes: 135,
    notes_fr:
      'Vols internationaux ; transfert privé environ 2 h 15, liaison hélicoptère possible vers l’altiport.',
    notes_en:
      'International flights; private transfer about 2 hr 15 min, optional helicopter link to the altiport.',
  },
  {
    mode: 'airport',
    station: 'Aéroport Lyon Saint-Exupéry',
    station_en: 'Lyon Saint-Exupéry Airport',
    distance_meters: 180_000,
    walk_minutes: 120,
    notes_fr: 'Transfert privé environ 2 h ; option hélicoptère sur demande.',
    notes_en: 'Private transfer about 2 hr; helicopter option on request.',
  },
  {
    mode: 'train',
    station: 'Gare de Moûtiers',
    station_en: 'Moûtiers station',
    distance_meters: 30_000,
    walk_minutes: 60,
    notes_fr:
      'TGV depuis Paris (environ 4 h 30) ; transfert privé ou navette environ 1 h jusqu’au Jardin Alpin.',
    notes_en:
      'TGV from Paris (about 4 hr 30 min); private transfer or shuttle about 1 hr to Le Jardin Alpin.',
  },
] as const;

const LES_AIRELLES_COURCHEVEL_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire-palais-neiges',
    title_fr: 'Histoire du palais des neiges',
    title_en: 'History of the snow palace',
    body_fr:
      'Inauguré en 1990 par Madame Raymonde Fenestraz, Les Airelles est la première Maison de la collection Airelles et le premier palace de Courchevel. Distinction Palace en 2011, membre du Comité Colbert depuis 2021.\n\nInspiré des châteaux austro-hongrois du XIXe siècle, le bâtiment aux tours enneigées et fresques peintes à la main incarne l’âme alpine de la maison : générosité, service discret et art de recevoir à la française en altitude.\n\nQuarante-quatre chambres et suites, chalets Ormello et 1908, six restaurants et un spa La Mer composent aujourd’hui l’établissement le plus emblématique de Courchevel 1850.',
    body_en:
      'Opened in 1990 by Madame Raymonde Fenestraz, Les Airelles is the first Airelles maison and Courchevel’s first palace. Palace distinction in 2011, Comité Colbert member since 2021.\n\nInspired by 19th-century Austro-Hungarian castles, the snow-capped turrets and hand-painted frescoes embody the house’s alpine soul: generosity, discreet service and French hospitality at altitude.\n\nForty-four rooms and suites, Ormello and 1908 chalets, six restaurants and a La Mer spa now form Courchevel 1850’s most emblematic address.',
  },
  {
    anchor: 'emplacement-courchevel-1850',
    title_fr: 'Emplacement · Courchevel 1850',
    title_en: 'Location · Courchevel 1850',
    body_fr:
      'Le palace occupe le Jardin Alpin, adresse ski-in la plus exclusive de Courchevel 1850. Depuis Genève (2 h 15), Lyon (2 h) ou la gare de Moûtiers (1 h), la conciergerie coordonne transferts, hélicoptère et voiturier.\n\nÀ pied : boutiques de luxe, patinoire olympique et altiport (2 007 m). Le domaine des 3 Vallées — 600 km de pistes — commence au pied du palace.',
    body_en:
      'The palace sits in Le Jardin Alpin, Courchevel 1850’s most exclusive ski-in address. From Geneva (2 hr 15), Lyon (2 hr) or Moûtiers station (1 hr), the concierge coordinates transfers, helicopter and valet.\n\nOn foot: luxury boutiques, Olympic ice rink and altiport (2,007 m). The Three Valleys domain — 600 km of slopes — starts at the palace door.',
  },
  {
    anchor: 'ski-trois-vallees',
    title_fr: 'Ski & 3 Vallées',
    title_en: 'Ski & Three Valleys',
    body_fr:
      'Ski-in/ski-out depuis le Jardin Alpin : ski valet Bernard Orcel, salle de ski chauffée et forfaits 3 Vallées préparés à l’arrivée. Hors-piste, héli-ski, motoneige et chiens de traîneau s’organisent via la conciergerie.\n\nAprès la ski : cryothérapie au spa, patinoire du palace ou dîner à Matsuhisa. C’est le rythme Airelles — la montagne du matin au soir, sans rupture.',
    body_en:
      'Ski-in/ski-out from Le Jardin Alpin: Bernard Orcel ski valet, heated ski room and Three Valleys passes prepared on arrival. Off-piste, heli-ski, snowmobile and dog-sled are arranged through the concierge.\n\nAfter skiing: spa cryotherapy, palace ice rink or dinner at Matsuhisa. That is the Airelles rhythm — mountain from morning to night, without a break.',
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_SIGNATURE_EXPERIENCES = [
  {
    key: 'table-des-airelles-festin',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-10`,
    title_fr: 'Le Festin — La Table des Airelles',
    title_en: 'Le Festin — La Table des Airelles',
    description_fr:
      'Buffet déjeuner spectaculaire à la table étoilée du chef Adrien Trouilloud — fruits de mer, viandes rôties et desserts signature.',
    description_en:
      'Spectacular lunch buffet at starred chef Adrien Trouilloud’s table — seafood, roasts and signature desserts.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://airelles.com/fr/destination/courchevel-hotel/restaurants',
    tip_fr:
      'Mon conseil : réservez le week-end en haute saison — arrivez à l’ouverture pour la terrasse ensoleillée.',
    tip_en: 'My tip: book weekends in peak season — arrive at opening for the sunny terrace.',
  },
  {
    key: 'matsuhisa-black-cod',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-11`,
    title_fr: 'Black Cod Miso à Matsuhisa',
    title_en: 'Black Cod Miso at Matsuhisa',
    description_fr:
      'Dîner fusion Nobu de 19 h à 22 h — commencez par le Black Cod Miso, signature mondiale de la maison.',
    description_en:
      'Nobu fusion dinner from 7 pm to 10 pm — start with Black Cod Miso, the house’s global signature.',
    booking_required: true,
    website:
      'https://airelles.com/fr/destination/courchevel-hotel/restaurants/matsuhisa-courchevel',
    tip_fr:
      'Mon conseil : pour un groupe, demandez le salon — le service y est plus fluide qu’en pleine saison.',
    tip_en: 'My tip: for a group, ask for the salon — service flows better there in peak season.',
  },
  {
    key: 'spa-la-mer-cryo',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-13`,
    title_fr: 'Rituel spa La Mer + cryothérapie',
    title_en: 'La Mer spa ritual + cryotherapy',
    description_fr:
      'Soin La Mer sur rendez-voi, puis cryothérapie et piscine azur — le combo récupération après une journée de ski.',
    description_en:
      'La Mer treatment by appointment, then cryotherapy and azure pool — the recovery combo after a ski day.',
    booking_required: true,
    phone: HOTEL_PHONE,
    tip_fr:
      'Mon conseil : bloquez 16 h–18 h après la dernière descente — le spa se vide avant le dîner.',
    tip_en: 'My tip: hold 4–6 pm after the last run — the spa empties before dinner.',
    website:
      'https://airelles.com/fr/destination/courchevel-hotel/spa-swimming-pool-jacuzzi-fitness',
  },
  {
    key: 'ski-in-first-run',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-9`,
    title_fr: 'Première descente ski-in',
    title_en: 'First ski-in run',
    description_fr:
      'Ski valet Bernard Orcel prépare les skis la veille — rejoignez le Jardin Alpin à 8 h 30 pour la piste encore fraîche.',
    description_en:
      'Bernard Orcel ski valet prepares skis the night before — reach Le Jardin Alpin at 8:30 am for still-fresh slopes.',
    tip_fr:
      'Mon conseil : indiquez niveau et type de ski à la réservation — les skis sont affûtés selon la météo du matin.',
    tip_en:
      'My tip: share level and ski type when booking — skis are tuned to the morning weather.',
  },
  {
    key: 'winter-camp-cinema',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-28`,
    title_fr: 'Winter Camp & cinéma privé',
    title_en: 'Winter Camp & private cinema',
    description_fr:
      'Animations enfants, piscine dédiée au spa et séance de cinéma privée en famille après le dîner.',
    description_en:
      'Children’s activities, dedicated spa pool and private family cinema after dinner.',
    booking_required: true,
    tip_fr:
      'Mon conseil : réservez le cinéma la veille — les enfants repartent avec le titre choisi en tête.',
    tip_en:
      'My tip: book the cinema the day before — children leave with their chosen title in mind.',
  },
  {
    key: 'folie-douce-experience',
    image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-27`,
    title_fr: 'Déjeuner La Folie Douce',
    title_en: 'La Folie Douce lunch',
    description_fr:
      'Expérience festive en altitude incluse dans l’écosystème Airelles — déjeuner animé sur les pistes.',
    description_en:
      'Festive altitude experience within the Airelles ecosystem — lively lunch on the slopes.',
    booking_required: true,
    tip_fr:
      'Mon conseil : une fois dans le séjour suffit — la conciergerie coordonne transfert et tenue.',
    tip_en: 'My tip: once per stay is enough — the concierge coordinates transfer and dress code.',
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_FEATURED_REVIEWS = [
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/the-alps-switzerland/airelles-courchevel-les-airelles',
    quote_fr:
      'Façade magique austro-hongroise, ski-in/ski-out : Les Airelles est impressionnant et accueillant — le premier palace de Courchevel.',
    quote_en:
      'Magical Austro-Hungarian facade, ski-in/ski-out: Les Airelles is impressive and inviting — Courchevel’s first palace.',
  },
  {
    source: 'MICHELIN Hotels',
    author: 'MICHELIN Hotels',
    source_url: 'https://guide.michelin.com/',
    quote_fr:
      'Première Maison Airelles : 44 chambres et suites au décor de château, spa La Mer et table étoilée au cœur des 3 Vallées.',
    quote_en:
      'First Airelles maison: 44 castle-decor rooms and suites, La Mer spa and starred table at the heart of the Three Valleys.',
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_UPCOMING_EVENTS = [
  {
    name: 'Ouverture saison ski Courchevel 1850',
    start_date: '2026-12-06',
    end_date: '2026-12-06',
    venue_name: 'Courchevel 1850',
    latitude: 45.414,
    longitude: 6.634,
    distance_meters: 400,
    category: 'sport',
    period_fr: 'Début décembre (variable)',
    period_en: 'Early December (varies)',
    description_fr:
      'Réouverture du domaine des 3 Vallées — le palace accueille les premières descentes ski-in depuis le Jardin Alpin.',
    description_en:
      'Three Valleys domain reopening — the palace welcomes first ski-in runs from Le Jardin Alpin.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-2`,
  },
  {
    name: 'Festival Sancy à Courchevel',
    start_date: '2026-03-15',
    end_date: '2026-03-22',
    venue_name: 'Courchevel 1850',
    latitude: 45.414,
    longitude: 6.634,
    distance_meters: 500,
    category: 'culture',
    period_fr: 'Mi-mars',
    period_en: 'Mid-March',
    description_fr:
      'Concerts et animations en altitude — la conciergerie réserve places et transferts depuis le palace.',
    description_en:
      'Concerts and mountain events — the concierge books seats and transfers from the palace.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-19`,
  },
] as const;

export const LES_AIRELLES_COURCHEVEL_INSTAGRAM = {
  handle: 'airellescourchevel',
  profile_url: 'https://www.instagram.com/airellescourchevel/',
  posts: [
    {
      permalink: 'https://www.instagram.com/airellescourchevel/',
      image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-1`,
      caption_fr:
        'Le palais des neiges aux tours enneigées — première Maison Airelles au cœur de Courchevel 1850.',
      caption_en:
        'The snow palace with snow-capped turrets — the first Airelles maison at the heart of Courchevel 1850.',
    },
    {
      permalink: 'https://www.instagram.com/airellescourchevel/',
      image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-10`,
      caption_fr:
        'La Table des Airelles — gastronomie étoilée et Le Festin face aux sommets de la Tarentaise.',
      caption_en:
        'La Table des Airelles — starred gastronomy and Le Festin facing Tarentaise peaks.',
    },
    {
      permalink: 'https://www.instagram.com/airellescourchevel/',
      image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-15`,
      caption_fr:
        'Spa Airelles by La Mer : piscine azur, grotte de neige et cryothérapie après la ski.',
      caption_en: 'Airelles Spa by La Mer: azure pool, snow cave and cryotherapy after skiing.',
    },
    {
      permalink: 'https://www.instagram.com/airellescourchevel/',
      image_public_id: `${LES_AIRELLES_COURCHEVEL_IMAGE_PREFIX}/press-9`,
      caption_fr:
        'Suite sur pistes — skis aux pieds depuis le Jardin Alpin, le rituel du skieur exigeant.',
      caption_en: 'Slope Suite — ski-in from Le Jardin Alpin, the demanding skier’s ritual.',
    },
  ],
} as const;

export const LES_AIRELLES_COURCHEVEL_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q3230437',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q3230437',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Courchevel',
    source: 'wikipedia',
    source_url: 'https://fr.wikipedia.org/wiki/Courchevel',
    confidence: 'medium',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/Courchevel',
    source: 'wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Courchevel',
    confidence: 'medium',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'https://airelles.com/fr/destination/courchevel-hotel',
    source: 'official',
    source_url: 'https://airelles.com/fr/destination/courchevel-hotel',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 1990,
    source: 'official',
    source_url:
      'https://airelles.com/fr/destination/courchevel-hotel/palace-les-airelles-5-etoiles',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type CourchevelExternalScalarField =
  | 'wikidata_id'
  | 'wikipedia_url_fr'
  | 'wikipedia_url_en'
  | 'official_url';

function courchevelExternalScalar(field: CourchevelExternalScalarField): string {
  const entry = LES_AIRELLES_COURCHEVEL_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

export function sanitizeLesAirellesCourchevelJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

export function patchLesAirellesCourchevelAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchLesAirellesCourchevelAmenities(
  _existing: unknown,
): readonly LesAirellesCourchevelAmenityRecord[] {
  return LES_AIRELLES_COURCHEVEL_AMENITIES;
}

export { LES_AIRELLES_COURCHEVEL_AMENITIES, type LesAirellesCourchevelAmenityRecord };

export function patchLesAirellesCourchevelSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...LES_AIRELLES_COURCHEVEL_WELLNESS_INFO };
}

export function patchLesAirellesCourchevelPolicies(existing: unknown): Record<string, unknown> {
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
        'Départ jusqu’à 12h ; late check-out selon disponibilité — la conciergerie coordonne avec la réception.',
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
        'Animaux acceptés avec accueil VIP sur demande — signaler à la réservation pour confirmer la chambre adaptée.',
      notes_en:
        'Pets welcome with VIP welcome on request — flag at booking to confirm a suitable room.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

function resolveLesAirellesCourchevelLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    LES_AIRELLES_COURCHEVEL_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchLesAirellesCourchevelLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: LES_AIRELLES_COURCHEVEL_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: LES_AIRELLES_COURCHEVEL_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchLesAirellesCourchevelLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of LES_AIRELLES_COURCHEVEL_LONG_DESCRIPTION_SECTIONS) {
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

export function resolveLesAirellesCourchevelSignatureExperiences(): unknown[] {
  return [...LES_AIRELLES_COURCHEVEL_SIGNATURE_EXPERIENCES];
}

export {
  LES_AIRELLES_COURCHEVEL_CONCIERGE_QUESTIONS_KIT,
  type LesAirellesCourchevelConciergeQuestionKit,
} from './les-airelles-courchevel-concierge-questions';

export interface LesAirellesCourchevelGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildLesAirellesCourchevelGoldenFields(
  current: LesAirellesCourchevelGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchLesAirellesCourchevelSpa(current.spa_info);
  return {
    highlights: LES_AIRELLES_COURCHEVEL_HIGHLIGHTS,
    concierge_questions: LES_AIRELLES_COURCHEVEL_CONCIERGE_QUESTIONS_KIT,
    transports: LES_AIRELLES_COURCHEVEL_TRANSPORTS,
    restaurant_info: LES_AIRELLES_COURCHEVEL_RESTAURANT_INFO,
    points_of_interest: LES_AIRELLES_COURCHEVEL_POINTS_OF_INTEREST,
    concierge_advice: LES_AIRELLES_COURCHEVEL_CONCIERGE_ADVICE,
    concierge_pick: LES_AIRELLES_COURCHEVEL_CONCIERGE_PICK,
    concierge_hook: LES_AIRELLES_COURCHEVEL_CONCIERGE_HOOK,
    instagram: LES_AIRELLES_COURCHEVEL_INSTAGRAM,
    policies: patchLesAirellesCourchevelPolicies(current.policies),
    awards: patchLesAirellesCourchevelAwards(current.awards),
    amenities: patchLesAirellesCourchevelAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: LES_AIRELLES_COURCHEVEL_DESCRIPTION_FR,
    description_en: LES_AIRELLES_COURCHEVEL_DESCRIPTION_EN,
    long_description_sections: sanitizeLesAirellesCourchevelJsonb(
      resolveLesAirellesCourchevelLongDescriptionSections(
        current.long_description_sections,
        spaInfo,
      ),
    ),
    signature_experiences: sanitizeLesAirellesCourchevelJsonb(
      resolveLesAirellesCourchevelSignatureExperiences(),
    ),
    featured_reviews: LES_AIRELLES_COURCHEVEL_FEATURED_REVIEWS,
    upcoming_events: LES_AIRELLES_COURCHEVEL_UPCOMING_EVENTS,
    factual_summary_fr: LES_AIRELLES_COURCHEVEL_FACTUAL_SUMMARY_FR,
    factual_summary_en: LES_AIRELLES_COURCHEVEL_FACTUAL_SUMMARY_EN,
    meta_desc_fr: LES_AIRELLES_COURCHEVEL_META_DESC_FR,
    meta_desc_en: LES_AIRELLES_COURCHEVEL_META_DESC_EN,
    meta_title_fr: LES_AIRELLES_COURCHEVEL_META_TITLE_FR,
    meta_title_en: LES_AIRELLES_COURCHEVEL_META_TITLE_EN,
    hero_image: LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
    gallery_images: LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES,
    external_sources: LES_AIRELLES_COURCHEVEL_EXTERNAL_SOURCES,
    wikidata_id: courchevelExternalScalar('wikidata_id'),
    wikipedia_url_fr: courchevelExternalScalar('wikipedia_url_fr'),
    wikipedia_url_en: courchevelExternalScalar('wikipedia_url_en'),
    official_url: courchevelExternalScalar('official_url'),
    phone_e164: LES_AIRELLES_COURCHEVEL_PHONE_E164,
    address: LES_AIRELLES_COURCHEVEL_ADDRESS,
    postal_code: LES_AIRELLES_COURCHEVEL_POSTAL_CODE,
    latitude: LES_AIRELLES_COURCHEVEL_LATITUDE,
    longitude: LES_AIRELLES_COURCHEVEL_LONGITUDE,
    email_reservations: LES_AIRELLES_COURCHEVEL_EMAIL_RESERVATIONS,
    mice_info: LES_AIRELLES_COURCHEVEL_MICE_INFO,
    affiliations: LES_AIRELLES_COURCHEVEL_AFFILIATIONS,
    opened_at: '1990-01-01',
  };
}
