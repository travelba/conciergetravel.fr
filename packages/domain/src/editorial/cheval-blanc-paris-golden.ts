/**
 * Cheval Blanc Paris "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override and the catalogue promotion
 * script (`@mch/editorial-pilot`).
 *
 * Facts sourced from chevalblanc.com (official Maison Paris pages) and public
 * tourism references. Figures not confidently sourced are omitted (EEAT).
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import {
  CHEVAL_BLANC_PARIS_AMENITIES,
  type ChevalBlancParisAmenityRecord,
} from './cheval-blanc-paris-amenities';
import { CHEVAL_BLANC_PARIS_CONCIERGE_QUESTIONS_KIT } from './cheval-blanc-paris-concierge-questions';
import {
  CHEVAL_BLANC_PARIS_GALLERY_IMAGES,
  CHEVAL_BLANC_PARIS_HERO_IMAGE,
} from './cheval-blanc-paris-gallery';
import { buildKitWaveFaqKit, buildKitWaveFaqPromote } from './kit-wave-faq-seed';

export const CHEVAL_BLANC_PARIS_PROMOTE_SLUG = 'cheval-blanc-paris';

/** Google Places `place_id` — verified via Places API (2026-06-10). */
export const CHEVAL_BLANC_PARIS_GOOGLE_PLACE_ID = 'ChIJM5suurRz5kcRjU9xJPdZGRU';

/** Cloudinary folder prefix for all Cheval Blanc Paris kit / golden assets. */
export const CHEVAL_BLANC_PARIS_IMAGE_PREFIX = 'cct/hotels/cheval-blanc-paris';

/** Dedicated POI card asset — never reuse hotel gallery `press-*`. */
export function chevalBlancParisPoiImage(poiSlug: string): string {
  return `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/poi-${poiSlug}`;
}

const FNB_PHONE = '+33 1 40 28 00 00';

export const CHEVAL_BLANC_PARIS_PHONE_E164 = '+33140280000';
export const CHEVAL_BLANC_PARIS_ADDRESS = '8 Quai du Louvre';
export const CHEVAL_BLANC_PARIS_POSTAL_CODE = '75001';
export const CHEVAL_BLANC_PARIS_LATITUDE = 48.85947;
export const CHEVAL_BLANC_PARIS_LONGITUDE = 2.34213;
export const CHEVAL_BLANC_PARIS_EMAIL_RESERVATIONS = 'res.paris@chevalblanc.com';

// ---------------------------------------------------------------------------
// restaurant_info.venues — 7 official F&B outlets (CDC D7 — bars distincts)
// ---------------------------------------------------------------------------

export const CHEVAL_BLANC_PARIS_RESTAURANT_INFO = {
  count: 7,
  michelin_stars: 6,
  venues: [
    {
      name: 'Plénitude',
      type_fr: 'Gastronomique · 3 étoiles MICHELIN · Chef Arnaud Donckele',
      type_en: 'Fine dining · 3 MICHELIN Stars · Chef Arnaud Donckele',
      chef: 'Arnaud Donckele',
      features: ['Absolues', '5 toques Gault&Millau', 'Note 19/20'],
      hours_fr: 'Mar–sam à partir de 19h30',
      hours_en: 'Tue–Sat from 7:30 pm',
      description_fr:
        'Assemblage d’Absolues au premier étage : le restaurant triplement étoilé d’Arnaud Donckele, cinq toques et 19/20 au Gault & Millau.',
      description_en:
        'Blending Absolues on the first floor: Arnaud Donckele’s three-star restaurant, five toques and 19/20 in Gault & Millau.',
      website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/plenitude/',
      phone: '+33 1 79 35 50 11',
      price_note_fr: 'Menus dégustation · sur réservation',
      price_note_en: 'Tasting menus · reservation required',
      tip_fr:
        'Mon conseil : pour une première venue, demandez le comptoir face à la cuisine — la mise en scène des Absolues vaut le spectacle.',
      tip_en:
        'My tip: for a first visit, ask for counter seats facing the kitchen — the Absolues staging is worth the show.',
    },
    {
      name: 'Hakuba',
      type_fr: 'Japonais · 2 étoiles MICHELIN · Chef Takuya Watanabe',
      type_en: 'Japanese · 2 MICHELIN Stars · Chef Takuya Watanabe',
      chef: 'Takuya Watanabe',
      features: ['Japon ritualisé', 'Poissons de saison', 'Salle intimiste'],
      hours_fr: 'Mar–sam dîner à partir de 18h30',
      hours_en: 'Tue–Sat dinner from 6:30 pm',
      description_fr:
        'Immersion gastronomique dans un Japon des terroirs : Hakuba, deux étoiles MICHELIN, par le chef Takuya Watanabe.',
      description_en:
        'Gastronomic immersion into ritualised Japan: Hakuba, two MICHELIN Stars, by chef Takuya Watanabe.',
      website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/hakuba/',
      phone: FNB_PHONE,
      price_note_fr: 'Menus omakase · sur réservation',
      price_note_en: 'Omakase menus · reservation required',
      tip_fr:
        'Mon conseil : réservez trois semaines à l’avance le week-end. Les places au comptoir partent en premier.',
      tip_en: 'My tip: book three weeks ahead for weekends. Counter seats go first.',
    },
    {
      name: 'Langosteria',
      type_fr: 'Italien · fine dining · Langosteria Paris',
      type_en: 'Italian · fine dining · Langosteria Paris',
      features: ['Fruits de mer', 'Terrasse 7e étage', 'Cuisine italienne contemporaine'],
      hours_fr: 'Dîner tous les soirs 18h–23h · Déj. mer–dim 12h–15h',
      hours_en: 'Dinner nightly 6–11 pm · Lunch Wed–Sun 12–3 pm',
      description_fr:
        'L’Italie contemporaine au 7e étage : langoustes, pasta et dolce vita sur la terrasse arborée face à Paris.',
      description_en:
        'Contemporary Italy on the 7th floor: lobster, pasta and dolce vita on the planted terrace facing Paris.',
      website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/langosteria/',
      phone: '+33 1 79 35 50 33',
      price_note_fr: 'À la carte · menus',
      price_note_en: 'À la carte · menus',
      tip_fr:
        'Mon conseil : aux beaux jours, réservez côté terrasse pour le déjeuner du mercredi — la vue sur les toits est la plus nette à midi.',
      tip_en:
        'My tip: in fine weather, book terrace-side for Wednesday lunch — rooftop views are clearest at noon.',
    },
    {
      name: 'Le Tout-Paris',
      type_fr: 'Brasserie · 1 étoile MICHELIN · 7e étage',
      type_en: 'Brasserie · 1 MICHELIN Star · 7th floor',
      features: ['Vue Seine', 'Brunch dominical', 'Terrasse rooftop'],
      hours_fr: 'Tous les jours 7h–1h · Déj. 12h15–14h30 · Dîner 19h–22h',
      hours_en: 'Daily 7 am–1 am · Lunch 12:15–2:30 pm · Dinner 7–10 pm',
      description_fr:
        'Brasserie d’un nouvel esprit au 7e étage : cuisine française réinventée, une étoile MICHELIN, vue spectaculaire sur la Seine.',
      description_en:
        'A new-spirit brasserie on the 7th floor: reinvented French cuisine, one MICHELIN Star, spectacular Seine views.',
      website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/le-tout-paris/',
      phone: '+33 1 79 35 50 22',
      price_note_fr: 'Brunch · à la carte',
      price_note_en: 'Brunch · à la carte',
      tip_fr:
        'Mon conseil : le brunch dominical se remplit vite — réservez deux semaines à l’avance et demandez la terrasse par beau temps.',
      tip_en:
        'My tip: Sunday brunch fills fast — book two weeks ahead and ask for the terrace in fine weather.',
    },
    {
      name: 'Bar Le Tout-Paris',
      type_fr: 'Bar cocktails · 7e étage · sans réservation',
      type_en: 'Cocktail bar · 7th floor · no reservations',
      features: ['Cocktails signature', 'Goûter', 'Vue Paris'],
      hours_fr: 'Tous les jours 12h–00h · Goûter 15h30–18h',
      hours_en: 'Daily 12 pm–midnight · Afternoon tea 3:30–6 pm',
      description_fr:
        'Le bar met en lumière des cocktails d’exception et des classiques revisités — sans réservation, selon la politique officielle.',
      description_en:
        'The bar spotlights exceptional cocktails and revisited classics — no reservations, per official policy.',
      website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/le-tout-paris/',
      phone: '+33 1 79 35 50 22',
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : passez vers 18 h en semaine — le bar capte la lumière dorée sans l’affluence du dîner.',
      tip_en:
        'My tip: stop by around 6 pm on weekdays — the bar catches golden light without dinner crowds.',
    },
    {
      name: 'Le Jardin',
      type_fr: 'Restaurant & bar rooftop · saison estivale',
      type_en: 'Rooftop restaurant & bar · summer season',
      features: ['Écrin de verdure', 'Vue Tour Eiffel', 'Saisonnier'],
      hours_fr: 'Mer–dim (mai–sept.) · Déj. 12h–13h30 · Dîner 18h30–21h',
      hours_en: 'Wed–Sun (May–Sept.) · Lunch 12–1:30 pm · Dinner 6:30–9 pm',
      description_fr:
        'Havre luxuriant suspendu au 7e étage : Le Jardin invite à savourer l’été par beau temps, du mercredi au dimanche.',
      description_en:
        'A lush suspended haven on the 7th floor: Le Jardin invites you to savour summer in fine weather, Wednesday to Sunday.',
      website:
        'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/le-jardin-de-cheval-blanc-paris/',
      phone: FNB_PHONE,
      price_note_fr: 'Ouverture saisonnière · selon météo',
      price_note_en: 'Seasonal opening · weather permitting',
      tip_fr:
        'Mon conseil : consultez la conciergerie la veille — Le Jardin n’ouvre que par beau temps, et les tables partent en une heure.',
      tip_en:
        'My tip: check with the concierge the day before — Le Jardin opens only in fine weather, and tables go within an hour.',
    },
    {
      name: 'Bar Le Jardin',
      type_fr: 'Bar rooftop · 14h30–18h30 · saison estivale',
      type_en: 'Rooftop bar · 2:30–6:30 pm · summer season',
      features: ['Cocktails en plein air', 'Vue Tour Eiffel', 'Saisonnier'],
      hours_fr: 'Mer–dim 14h30–18h30 (sous réserve de beau temps)',
      hours_en: 'Wed–Sun 2:30–6:30 pm (weather permitting)',
      description_fr:
        'Le bar du Jardin prolonge l’après-midi estival entre verdure et horizon parisien — ouverture liée à la météo.',
      description_en:
        'Le Jardin bar extends the summer afternoon between greenery and the Paris horizon — opening depends on weather.',
      website:
        'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/le-jardin-de-cheval-blanc-paris/',
      phone: FNB_PHONE,
      price_note_fr: 'Cocktails à la carte',
      price_note_en: 'Cocktails à la carte',
      tip_fr:
        'Mon conseil : arrivez à l’ouverture du bar, 14 h 30 — vous aurez la terrasse presque pour vous avant le service du soir.',
      tip_en:
        'My tip: arrive when the bar opens, 2:30 pm — you’ll have the terrace almost to yourself before evening service.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — visit / do / shop (1er arrondissement, Quai du Louvre)
// ---------------------------------------------------------------------------

export const CHEVAL_BLANC_PARIS_POINTS_OF_INTEREST = [
  {
    name: 'Musée du Louvre',
    name_en: 'Louvre Museum',
    type: 'museum',
    category_fr: 'Musée & patrimoine',
    category_en: 'Museum & heritage',
    distance_meters: 450,
    walk_minutes: 6,
    latitude: 48.860611,
    longitude: 2.337644,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('musee-du-louvre'),
    description_fr:
      'Plus grand musée du monde, de l’Antiquité à 1848. Pyramide Ieoh Ming Pei, ailes Denon, Sully et Richelieu.',
    description_en:
      'World’s largest museum, from Antiquity to 1848. I.M. Pei pyramid, Denon, Sully and Richelieu wings.',
    website: 'https://www.louvre.fr/',
    address: 'Rue de Rivoli, 75001 Paris',
    hours_fr: 'Mer–lun 9h–18h · nocturnes ven jusqu’à 21h45',
    hours_en: 'Wed–Mon 9 am–6 pm · Fri late opening until 9:45 pm',
    price_note_fr: '17 € adulte · gratuit -18 ans UE',
    price_note_en: '€17 adult · free under 18 EU',
    tip_fr:
      'Mon conseil : entrez par la porte des Lions côté Seine à l’ouverture — la Joconde se visite avant 10 h.',
    tip_en:
      'My tip: enter via the Lions gate on the Seine side at opening — the Mona Lisa is best before 10 am.',
  },
  {
    name: 'Pont Neuf',
    name_en: 'Pont Neuf',
    type: 'monument',
    category_fr: 'Monument historique',
    category_en: 'Historic monument',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 48.8575,
    longitude: 2.3414,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('pont-neuf'),
    description_fr:
      'Plus ancien pont de Paris encore debout (1607). Douze arches, mascarons de Germain Pilon, vue sur l’Île de la Cité.',
    description_en:
      'Oldest bridge still standing in Paris (1607). Twelve arches, Germain Pilon mascarons, views over Île de la Cité.',
    address: 'Pont Neuf, 75001 Paris',
    tip_fr:
      'Mon conseil : trois minutes depuis l’hôtel. Traversez au coucher du soleil — la lumière sur la Seine vaut chaque pas.',
    tip_en:
      'My tip: three minutes from the hotel. Cross at sunset — light on the Seine rewards every step.',
  },
  {
    name: 'Sainte-Chapelle',
    name_en: 'Sainte-Chapelle',
    type: 'monument',
    category_fr: 'Gothique rayonnant',
    category_en: 'Rayonnant Gothic',
    distance_meters: 900,
    walk_minutes: 12,
    latitude: 48.855378,
    longitude: 2.345028,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('sainte-chapelle'),
    description_fr:
      'Joyau gothique du XIIIe siècle : 1 113 vitraux sur 15 m de haut, commandés par Saint Louis.',
    description_en:
      '13th-century Gothic jewel: 1,113 stained-glass panels rising 15 m, commissioned by Saint Louis.',
    website: 'https://www.sainte-chapelle.fr/',
    address: '8 Boulevard du Palais, 75001 Paris',
    hours_fr: 'Tous les jours 9h–19h (horaires variables)',
    hours_en: 'Daily 9 am–7 pm (hours vary)',
    price_note_fr: '11,50 € adulte',
    price_note_en: '€11.50 adult',
    tip_fr:
      'Mon conseil : visitez entre 11 h et 13 h par temps ensoleillé — les vitraux supérieurs prennent feu.',
    tip_en: 'My tip: visit between 11 am and 1 pm on a sunny day — the upper windows catch fire.',
  },
  {
    name: 'Musée d’Orsay',
    name_en: 'Musée d’Orsay',
    type: 'museum',
    category_fr: 'Impressionnisme & XIXe siècle',
    category_en: 'Impressionism & 19th century',
    distance_meters: 800,
    walk_minutes: 10,
    latitude: 48.859961,
    longitude: 2.326561,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('musee-orsay'),
    description_fr:
      'Ancienne gare d’Orsay reconvertie : impressionnistes, Van Gogh, Monet, Degas et architecture Belle Époque.',
    description_en:
      'Former Orsay station converted: Impressionists, Van Gogh, Monet, Degas and Belle Époque architecture.',
    website: 'https://www.musee-orsay.fr/',
    address: '1 Rue de la Légion d’Honneur, 75007 Paris',
    hours_fr: 'Mar–dim 9h30–18h · nocturne jeu jusqu’à 21h45',
    hours_en: 'Tue–Sun 9:30 am–6 pm · Thu late until 9:45 pm',
    price_note_fr: '16 € adulte',
    price_note_en: '€16 adult',
    tip_fr:
      'Mon conseil : dix minutes via le Pont Royal. Commencez par le 5e étage impressionniste avant la foule.',
    tip_en:
      'My tip: ten minutes via Pont Royal. Start on the 5th-floor Impressionist gallery before crowds.',
  },
  {
    name: 'Jardin des Tuileries',
    name_en: 'Tuileries Garden',
    type: 'garden',
    category_fr: 'Jardin historique',
    category_en: 'Historic garden',
    distance_meters: 650,
    walk_minutes: 8,
    latitude: 48.863492,
    longitude: 2.327494,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('jardin-tuileries'),
    description_fr:
      'Jardin à la française entre le Louvre et la place de la Concorde, conçu par Le Nôtre. Fontaines, statues et allées ombragées.',
    description_en:
      'Formal French garden between the Louvre and Place de la Concorde, designed by Le Nôtre. Fountains, statues and shaded alleys.',
    address: 'Place de la Concorde, 75001 Paris',
    tip_fr:
      'Mon conseil : huit minutes à pied. Les chaises vertes face aux bassins offrent la pause la plus parisienne après le Louvre.',
    tip_en:
      'My tip: eight minutes on foot. Green chairs by the pools offer the most Parisian break after the Louvre.',
  },
  {
    name: 'Bourse de Commerce — Pinault Collection',
    name_en: 'Bourse de Commerce — Pinault Collection',
    type: 'museum',
    category_fr: 'Art contemporain',
    category_en: 'Contemporary art',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 48.8628,
    longitude: 2.3428,
    bucket: 'visit',
    image_public_id: chevalBlancParisPoiImage('bourse-de-commerce'),
    description_fr:
      'Dôme du XIXe siècle restauré par Tadao Ando : collection Pinault d’art contemporain au cœur des Halles.',
    description_en:
      '19th-century dome restored by Tadao Ando: Pinault contemporary art collection at the heart of Les Halles.',
    website: 'https://www.pinaultcollection.com/fr/bourse-de-commerce',
    address: '2 Rue de Viarmes, 75001 Paris',
    tip_fr:
      'Mon conseil : cinq minutes à pied. Montez à la coupole en fin de journée — la lumière y est spectaculaire.',
    tip_en:
      'My tip: five minutes on foot. Head to the dome late afternoon — the light there is spectacular.',
  },
  {
    name: 'Croisière sur la Seine',
    name_en: 'Seine river cruise',
    type: 'cruise',
    category_fr: 'Croisière commentée',
    category_en: 'Sightseeing cruise',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 48.8578,
    longitude: 2.3412,
    bucket: 'do',
    image_public_id: chevalBlancParisPoiImage('croisiere-seine'),
    description_fr:
      'Embarquement au Pont-Neuf ou Port des Saints-Pères. Croisières d’une heure ou dîners sur la Seine.',
    description_en:
      'Boarding at Pont Neuf or Port des Saints-Pères. One-hour cruises or dinner cruises on the Seine.',
    website: 'https://www.bateauxparisiens.com/',
    tip_fr:
      'Mon conseil : embarquez au crépuscule depuis le Pont-Neuf — la Tour Eiffel s’illumine pendant la croisière.',
    tip_en: 'My tip: board at dusk from Pont Neuf — the Eiffel Tower lights up during the cruise.',
  },
  {
    name: 'Palais-Royal',
    name_en: 'Palais-Royal',
    type: 'garden',
    category_fr: 'Jardin & colonnes de Buren',
    category_en: 'Garden & Buren columns',
    distance_meters: 900,
    walk_minutes: 11,
    latitude: 48.8638,
    longitude: 2.3369,
    bucket: 'do',
    image_public_id: chevalBlancParisPoiImage('palais-royal'),
    description_fr:
      'Jardin à la française, colonnes de Buren et galeries couvertes : havre de calme à deux pas du Louvre.',
    description_en:
      'Formal garden, Buren columns and covered arcades: a calm haven steps from the Louvre.',
    address: 'Jardin du Palais-Royal, 75001 Paris',
    tip_fr:
      'Mon conseil : onze minutes à pied. Flânez dans les galeries couvertes par temps de pluie — cafés et librairies abrités.',
    tip_en:
      'My tip: eleven minutes on foot. Stroll the covered arcades on rainy days — sheltered cafés and bookshops.',
  },
  {
    name: 'Marché aux fleurs Reine-Elizabeth-II',
    name_en: 'Reine-Elizabeth-II Flower Market',
    type: 'market',
    category_fr: 'Marché couvert',
    category_en: 'Covered market',
    distance_meters: 700,
    walk_minutes: 9,
    latitude: 48.8554,
    longitude: 2.3447,
    bucket: 'do',
    image_public_id: chevalBlancParisPoiImage('marche-fleurs-cite'),
    description_fr:
      'Marché aux fleurs sur l’Île de la Cité, pavillons en fonte du XIXe siècle. Oiseaux le dimanche.',
    description_en:
      'Flower market on Île de la Cité, 19th-century iron pavilions. Birds on Sundays.',
    address: 'Place Louis-Lépine, 75004 Paris',
    hours_fr: 'Mar–sam 8h–19h30 · dim 8h–13h',
    hours_en: 'Tue–Sat 8 am–7:30 pm · Sun 8 am–1 pm',
    tip_fr:
      'Mon conseil : le dimanche matin, le marché mêle fleurs et oiseaux — l’atmosphère la plus singulière de Paris.',
    tip_en:
      'My tip: Sunday morning, the market mixes flowers and birds — Paris at its most singular.',
  },
  {
    name: 'La Samaritaine',
    name_en: 'La Samaritaine',
    type: 'store',
    category_fr: 'Grand magasin & art déco',
    category_en: 'Department store & Art Deco',
    distance_meters: 0,
    walk_minutes: 1,
    latitude: 48.8594,
    longitude: 2.3421,
    bucket: 'shop',
    image_public_id: chevalBlancParisPoiImage('la-samaritaine'),
    description_fr:
      'Grand magasin historique LVMH dans le même bâtiment : mode, beauté, restauration et verrière Art déco.',
    description_en:
      'Historic LVMH department store in the same building: fashion, beauty, dining and Art Deco glass roof.',
    website: 'https://www.samaritaine.com/',
    address: '9 Rue de la Monnaie, 75001 Paris',
    hours_fr: 'Lun–sam 10h–20h · dim 11h–19h',
    hours_en: 'Mon–Sat 10 am–8 pm · Sun 11 am–7 pm',
    tip_fr:
      'Mon conseil : un ascenseur depuis la Maison — la verrière et le rooftop se visitent avant les vitrines.',
    tip_en:
      'My tip: a lift from the Maison — the glass roof and rooftop are worth seeing before the shop floors.',
  },
  {
    name: 'Place Vendôme',
    name_en: 'Place Vendôme',
    type: 'shopping',
    category_fr: 'Haute joaillerie',
    category_en: 'High jewellery',
    distance_meters: 1100,
    walk_minutes: 14,
    latitude: 48.8675,
    longitude: 2.3295,
    bucket: 'shop',
    image_public_id: chevalBlancParisPoiImage('place-vendome'),
    description_fr:
      'Place octogonale et colonne Vendôme : joailliers, horlogers et maisons de luxe au cœur du 1er.',
    description_en:
      'Octagonal square and Vendôme column: jewellers, watchmakers and luxury houses in the 1st.',
    address: 'Place Vendôme, 75001 Paris',
    tip_fr:
      'Mon conseil : flânez en semaine vers 11 h — les salons joailliers sont plus disponibles qu’en fin d’après-midi.',
    tip_en:
      'My tip: stroll on a weekday around 11 am — jewellery salons are more available than late afternoon.',
  },
  {
    name: 'Le Bon Marché',
    name_en: 'Le Bon Marché',
    type: 'store',
    category_fr: 'Grand magasin Rive Gauche',
    category_en: 'Left Bank department store',
    distance_meters: 1500,
    walk_minutes: 18,
    latitude: 48.8512,
    longitude: 2.3235,
    bucket: 'shop',
    image_public_id: chevalBlancParisPoiImage('le-bon-marche'),
    description_fr:
      'Premier grand magasin du monde (1852) : mode, épicerie fine La Grande Épicerie et librairie.',
    description_en:
      'World’s first department store (1852): fashion, La Grande Épicerie fine food hall and bookshop.',
    website: 'https://www.lebonmarche.com/',
    address: '24 Rue de Sèvres, 75007 Paris',
    hours_fr: 'Lun–sam 10h–20h · dim 11h–19h',
    hours_en: 'Mon–Sat 10 am–8 pm · Sun 11 am–7 pm',
    tip_fr:
      'Mon conseil : la Grande Épicerie vaut le détour pour les cadeaux — passez avant 17 h, l’affluence est plus douce.',
    tip_en:
      'My tip: La Grande Épicerie is worth the trip for gifts — go before 5 pm, crowds are gentler.',
  },
  {
    name: 'Galerie Vivienne',
    name_en: 'Galerie Vivienne',
    type: 'store',
    category_fr: 'Passage couvert',
    category_en: 'Covered passage',
    distance_meters: 600,
    walk_minutes: 8,
    latitude: 48.8667,
    longitude: 2.3397,
    bucket: 'shop',
    image_public_id: chevalBlancParisPoiImage('galerie-vivienne'),
    description_fr:
      'Passage couvert de 1823 : mosaïques au sol, verrière et boutiques indépendantes près de la Bourse.',
    description_en:
      '1823 covered passage: floor mosaics, glass roof and independent boutiques near the Bourse.',
    address: '4 Rue des Petits-Champs, 75002 Paris',
    tip_fr:
      'Mon conseil : huit minutes à pied. Jérôme L’Huillier et les librairies voisines offrent des cadeaux nets à rapporter.',
    tip_en:
      'My tip: eight minutes on foot. Jérôme L’Huillier and nearby bookshops offer clear gifts to bring back.',
  },
] as const;

export const CHEVAL_BLANC_PARIS_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez la Suite Seine avec jardin d’hiver côté quai. Le secret opérationnel : réservez le soin Dior Spa à 17 h, puis rejoignez Le Tout-Paris à 19 h 30 — la terrasse du 7e étage capte la lumière dorée sur la Seine sans quitter la Maison. Précisez votre heure d’arrivée : la conciergerie prépare le jardin d’hiver avant le check-in.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for Suite Seine with a quay-side winter garden. The operational secret: book a Dior Spa treatment at 5 pm, then head to Le Tout-Paris at 7:30 pm — the 7th-floor terrace catches golden light on the Seine without leaving the Maison. Share your arrival time: the concierge readies the winter garden before check-in.',
  },
} as const;

export const CHEVAL_BLANC_PARIS_CONCIERGE_PICK_SLUG = 'seine-junior-suite';

export const CHEVAL_BLANC_PARIS_CONCIERGE_PICK_NOTE = {
  fr: 'Jardin d’hiver face à la Seine — la suite que je recommande en premier pour une première venue.',
  en: 'Winter garden facing the Seine — the suite I recommend first for a first stay.',
} as const;

export const CHEVAL_BLANC_PARIS_CONCIERGE_PICK = {
  slug: CHEVAL_BLANC_PARIS_CONCIERGE_PICK_SLUG,
  note: CHEVAL_BLANC_PARIS_CONCIERGE_PICK_NOTE,
} as const;

export const CHEVAL_BLANC_PARIS_CONCIERGE_HOOK = {
  fr: 'Maison Cheval Blanc sur le quai du Louvre : 72 clefs face au Louvre, tables étoilées Plénitude et Hakuba, Dior Spa et piscine à débordement.',
  en: 'Cheval Blanc Maison on Quai du Louvre: 72 keys facing the Louvre, starred Plénitude and Hakuba tables, Dior Spa and infinity pool.',
} as const;

export const CHEVAL_BLANC_PARIS_FACTUAL_SUMMARY_FR =
  'Maison Cheval Blanc Paris, 72 clefs face au Louvre : Plénitude 3 étoiles, Dior Spa, piscine mosaïque et terrasse Le Tout-Paris sur la Seine.';
export const CHEVAL_BLANC_PARIS_FACTUAL_SUMMARY_EN =
  'Cheval Blanc Maison Paris, 72 keys facing the Louvre: 3-star Plénitude, Dior Spa, mosaic pool and Le Tout-Paris terrace over the Seine.';

export const CHEVAL_BLANC_PARIS_DESCRIPTION_FR =
  'Sur le quai du Louvre, Cheval Blanc Paris réinvente l’art de vivre à la française dans l’écrin de la Samaritaine. Soixante-douze clefs — 26 chambres et 46 suites — signées Peter Marino prolongent la promenade vers la Seine et le Pont Neuf.\n\nLa conciergerie orchestre sans envahir : table à Plénitude, brunch au Le Tout-Paris, rituel Dior Spa en fin d’après-midi. C’est l’essence d’un séjour au cœur du 1er : le Louvre à six minutes, la rive gauche face à face, et cinq tables qui font de la Maison une destination gastronomique à part entière.';
export const CHEVAL_BLANC_PARIS_DESCRIPTION_EN =
  'On Quai du Louvre, Cheval Blanc Paris reinvents the French art of living in the Samaritaine setting. Seventy-two keys — 26 rooms and 46 suites — by Peter Marino extend the walk toward the Seine and Pont Neuf.\n\nThe concierge orchestrates without intruding: a table at Plénitude, brunch at Le Tout-Paris, a Dior Spa ritual late afternoon. That is the essence of a stay in the heart of the 1st: the Louvre six minutes away, the Left Bank opposite, and five tables that make the Maison a gastronomic destination in its own right.';

export const CHEVAL_BLANC_PARIS_META_DESC_FR =
  'Cheval Blanc Paris, 8 quai du Louvre : Plénitude 3 étoiles, Hakuba, Le Tout-Paris, Dior Spa et piscine. Face au Louvre et à la Seine.';
export const CHEVAL_BLANC_PARIS_META_DESC_EN =
  'Cheval Blanc Paris, 8 Quai du Louvre: 3-star Plénitude, Hakuba, Le Tout-Paris, Dior Spa and pool. Facing the Louvre and the Seine.';

export const CHEVAL_BLANC_PARIS_META_TITLE_FR =
  'Cheval Blanc Paris — Maison LVMH face au Louvre | MyConciergeHotel';
export const CHEVAL_BLANC_PARIS_META_TITLE_EN =
  'Cheval Blanc Paris — LVMH Maison facing the Louvre | MyConciergeHotel';

export const CHEVAL_BLANC_PARIS_AFFILIATIONS = [
  {
    kind: 'brand',
    source: 'cheval_blanc',
    display_name: 'Cheval Blanc',
    verified: true,
    facet_slug: 'cheval-blanc',
    source_url: 'https://www.chevalblanc.com/en/maison/paris/',
    since_year: 2021,
  },
  {
    kind: 'label',
    source: 'forbes_5_star',
    display_name: 'Forbes Travel Guide Five-Star',
    verified: true,
    facet_slug: 'forbes-5-star',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/cheval-blanc-paris',
  },
] as const;

export const CHEVAL_BLANC_PARIS_HIGHLIGHTS = [
  {
    label_fr: 'Maison Cheval Blanc inaugurée en septembre 2021 dans la Samaritaine',
    label_en: 'Cheval Blanc Maison opened September 2021 in Samaritaine',
  },
  {
    label_fr: '72 clefs — 26 chambres et 46 suites signées Peter Marino',
    label_en: '72 keys — 26 rooms and 46 suites by Peter Marino',
  },
  {
    label_fr: 'Plénitude — 3 étoiles MICHELIN, Arnaud Donckele',
    label_en: 'Plénitude — 3 MICHELIN Stars, Arnaud Donckele',
  },
  {
    label_fr: 'Hakuba — 2 étoiles MICHELIN, Takuya Watanabe',
    label_en: 'Hakuba — 2 MICHELIN Stars, Takuya Watanabe',
  },
  {
    label_fr: 'Le Tout-Paris — brasserie 1 étoile, terrasse 7e étage sur la Seine',
    label_en: 'Le Tout-Paris — 1-star brasserie, 7th-floor terrace over the Seine',
  },
  {
    label_fr: 'Dior Spa Cheval Blanc — piscine à débordement en mosaïque',
    label_en: 'Dior Spa Cheval Blanc — mosaic infinity pool',
  },
] as const;

export const CHEVAL_BLANC_PARIS_WELLNESS_INFO = {
  name: 'Dior Spa Cheval Blanc',
  partner: 'Parfums Christian Dior',
  treatment_rooms: 6,
  description_fr:
    'Le Dior Spa Cheval Blanc invite à une immersion holistique dans l’univers Dior : suites de soins exclusives, rituels visage et corps, piscine à débordement en mosaïque et centre de fitness.',
  description_en:
    'Dior Spa Cheval Blanc invites holistic immersion in the Dior universe: exclusive treatment suites, face and body rituals, mosaic infinity pool and fitness centre.',
  hours_fr: 'Sur rendez-vous (horaires communiqués à la réservation)',
  hours_en: 'By appointment (hours shared when booking)',
  price_note_fr: 'Soins Dior sur rendez-vous — tarifs selon le rituel choisi.',
  price_note_en: 'Dior treatments by appointment — rates depend on the ritual selected.',
  website: 'https://www.chevalblanc.com/fr/maison/paris/bien-etre/',
  phone: FNB_PHONE,
  tip_fr:
    'Mon conseil : enchaînez un soin à 17 h et la piscine mosaïque avant un dîner à Plénitude — le spa est au plus calme entre 17 h et 19 h.',
  tip_en:
    'My tip: follow a 5 pm treatment with the mosaic pool before dinner at Plénitude — the spa is quietest between 5 and 7 pm.',
} as const;

export const CHEVAL_BLANC_PARIS_MICE_INFO = {
  summary_fr:
    'Le Tout-Paris et les suites L’Appartement accueillent cocktails, réceptions et boardrooms privatifs face à la Seine.',
  summary_en:
    'Le Tout-Paris and L’Appartement suites host cocktails, receptions and private boardrooms facing the Seine.',
  contact_email: CHEVAL_BLANC_PARIS_EMAIL_RESERVATIONS,
  total_capacity_seated: 120,
  spaces: [
    {
      key: 'le-tout-paris-privatisation',
      name: 'Le Tout-Paris',
      surface_sqm: 350,
      max_seated: 120,
      configurations: ['reception', 'dinner', 'cocktail'],
      has_natural_light: true,
      notes_fr: 'Privatisation totale ou partielle du 7e étage — terrasse et salle.',
      notes_en: 'Full or partial privatisation of the 7th floor — terrace and dining room.',
    },
    {
      key: 'l-appartement',
      name: 'L’Appartement',
      surface_sqm: 200,
      max_seated: 40,
      configurations: ['reception', 'boardroom', 'private-dinner'],
      has_natural_light: true,
      notes_fr: 'Suite réception pour réunions intimes et dîners privés.',
      notes_en: 'Reception suite for intimate meetings and private dinners.',
    },
  ],
  event_types: ['corporate-meeting', 'cocktail', 'private-dinner', 'product-launch'],
} as const;

export const CHEVAL_BLANC_PARIS_INSTAGRAM = {
  handle: 'chevalblancparis',
  profile_url: 'https://www.instagram.com/chevalblancparis/',
  posts: [
    {
      permalink: 'https://www.instagram.com/chevalblancparis/',
      image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-11`,
      caption_fr: 'Le Tout-Paris au coucher du soleil — la terrasse du 7e étage embrasse la Seine.',
      caption_en: 'Le Tout-Paris at sunset — the 7th-floor terrace embraces the Seine.',
    },
    {
      permalink: 'https://www.instagram.com/chevalblancparis/',
      image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-16`,
      caption_fr: 'La piscine mosaïque du Dior Spa — lumière et eau au-dessus de Paris.',
      caption_en: 'The Dior Spa mosaic pool — light and water above Paris.',
    },
    {
      permalink: 'https://www.instagram.com/chevalblancparis/',
      image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-10`,
      caption_fr: 'Plénitude — les Absolues d’Arnaud Donckele au cœur de la Samaritaine.',
      caption_en: 'Plénitude — Arnaud Donckele’s Absolues at the heart of Samaritaine.',
    },
    {
      permalink: 'https://www.instagram.com/chevalblancparis/',
      image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-1`,
      caption_fr:
        'La Samaritaine renaît — façade historique et entrée de la Maison Cheval Blanc sur le quai du Louvre.',
      caption_en:
        'The Samaritaine reborn — historic façade and Cheval Blanc Maison entrance on Quai du Louvre.',
    },
  ],
} as const;

export const CHEVAL_BLANC_PARIS_FEATURED_REVIEWS = [
  {
    source: 'MICHELIN Hotels',
    author: 'MICHELIN Hotels',
    source_url: 'https://guide.michelin.com/fr/fr/hotels-stays/paris/cheval-blanc-paris-12286',
    quote_fr:
      'Maison Cheval Blanc face au Louvre : cinq tables, Dior Spa et piscine à débordement dans l’écrin de la Samaritaine.',
    quote_en:
      'Cheval Blanc Maison facing the Louvre: five tables, Dior Spa and infinity pool in the Samaritaine setting.',
  },
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url: 'https://www.forbestravelguide.com/hotels/paris-france/cheval-blanc-paris',
    quote_fr:
      'Adresse LVMH où l’art de vivre français se lit dans chaque suite Peter Marino — entre Seine, Louvre et tables étoilées.',
    quote_en:
      'An LVMH address where French art of living shows in every Peter Marino suite — between Seine, Louvre and starred tables.',
  },
] as const;

export const CHEVAL_BLANC_PARIS_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q110622983',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q110622983',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value: 'https://www.chevalblanc.com/en/maison/paris/',
    source: 'official',
    source_url: 'https://www.chevalblanc.com/en/maison/paris/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 2021,
    source: 'official',
    source_url: 'https://www.chevalblanc.com/en/maison/paris/careers/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'architect',
    value: ['Edouard François', 'Peter Marino'],
    source: 'official',
    source_url: 'https://www.chevalblanc.com/en/maison/paris/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type ChevalBlancParisExternalScalarField = 'wikidata_id' | 'official_url';

function chevalBlancParisExternalScalar(field: ChevalBlancParisExternalScalarField): string {
  const entry = CHEVAL_BLANC_PARIS_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

export const CHEVAL_BLANC_PARIS_FAQ_CONTENT_PROMOTE = buildKitWaveFaqPromote('cheval-blanc-paris');
export const CHEVAL_BLANC_PARIS_FAQ_CONTENT_KIT = buildKitWaveFaqKit('cheval-blanc-paris');

export const CHEVAL_BLANC_PARIS_TRANSPORTS = [
  {
    mode: 'airport',
    station: 'Aéroport Paris-Charles-de-Gaulle',
    station_en: 'Paris Charles de Gaulle Airport',
    distance_meters: 28_000,
    walk_minutes: 55,
    notes_fr:
      'Vols internationaux ; RER B ou transfert privé via la conciergerie (environ 50 min).',
    notes_en:
      'International flights; RER B or private transfer through the concierge (about 50 min).',
  },
  {
    mode: 'airport',
    station: 'Aéroport Paris-Orly',
    station_en: 'Paris Orly Airport',
    distance_meters: 18_000,
    walk_minutes: 45,
    notes_fr: 'Orlyval + RER ou métro ; transfert privé sur réservation (35–45 min).',
    notes_en: 'Orlyval + RER or metro; private transfer on reservation (35–45 min).',
  },
  {
    mode: 'metro',
    station: 'Châtelet',
    station_en: 'Châtelet',
    distance_meters: 400,
    walk_minutes: 6,
    notes_fr: 'Lignes 1, 4, 7, 11, 14 — accès direct Louvre, Marais et Rive Gauche.',
    notes_en: 'Lines 1, 4, 7, 11, 14 — direct access to Louvre, Marais and Left Bank.',
  },
] as const;

const CHEVAL_BLANC_PARIS_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire — Samaritaine & naissance 2021',
    title_en: 'History — Samaritaine & 2021 birth',
    body_fr:
      'Cheval Blanc Paris s’installe en septembre 2021 dans l’emblématique bâtiment de la Samaritaine, entre le quai du Louvre et la Seine. Edouard François repense l’enveloppe ; Peter Marino signe les intérieurs audacieux de la Maison citadine LVMH.\n\nSoixante-douze clefs se déploient sur plusieurs niveaux, entre art contemporain, laiton et lumière travaillée. La Maison ne se contente pas d’héberger : elle aligne cinq tables et un Dior Spa pour devenir une destination à part entière au cœur du 1er arrondissement.',
    body_en:
      'Cheval Blanc Paris opened in September 2021 in the emblematic Samaritaine building, between Quai du Louvre and the Seine. Edouard François reshaped the envelope; Peter Marino signed the bold interiors of the LVMH city Maison.\n\nSeventy-two keys unfold across several levels, between contemporary art, brass and crafted light. The Maison does not only host: it lines up five tables and a Dior Spa to become a destination in its own right in the 1st arrondissement.',
  },
  {
    anchor: 'emplacement-paris',
    title_fr: 'Emplacement — Quai du Louvre & Seine',
    title_en: 'Location — Quai du Louvre & Seine',
    body_fr:
      'Le 8 quai du Louvre place la Maison face au Pont Neuf et au Louvre — six minutes à pied du musée, trois du fleuve. Le Marais et la rive gauche se rejoignent en une promenade.\n\nChâtelet (lignes 1, 4, 7, 11, 14) est à six minutes ; la Samaritaine partage le même bâtiment. La conciergerie coordonne taxis, VTC et itinéraires piétons selon vos rendez-vous culturels ou gastronomiques.',
    body_en:
      '8 Quai du Louvre places the Maison facing Pont Neuf and the Louvre — six minutes’ walk to the museum, three to the river. Le Marais and the Left Bank join in one stroll.\n\nChâtelet (lines 1, 4, 7, 11, 14) is six minutes away; Samaritaine shares the same building. The concierge coordinates taxis, private cars and walking routes around your cultural or dining appointments.',
  },
  {
    anchor: 'heritage-design',
    title_fr: 'Design Peter Marino & art de vivre',
    title_en: 'Peter Marino design & art of living',
    body_fr:
      'Peter Marino compose une grammaire immédiatement lisible : volumes généreux, matières nobles, œuvres d’art choisies et jardins d’hiver dans les suites les plus demandées. Chaque chambre prolonge l’expérience vers l’extérieur — Seine, toits ou cour intérieure.\n\nLes Artisans de la Maison personnalisent chaque séjour : majordomes pour les suites, Carte Blanche en chambre, Le Carrousel pour les enfants. L’accueil cultive la discrétion et la précision, signature Cheval Blanc.',
    body_en:
      'Peter Marino composes an immediately readable grammar: generous volumes, noble materials, selected artworks and winter gardens in the most requested suites. Each room extends the experience outward — Seine, rooftops or inner courtyard.\n\nMaison Artisans personalise each stay: butlers for suites, Carte Blanche in-room, Le Carrousel for children. The welcome cultivates discretion and precision, Cheval Blanc signature.',
  },
  {
    anchor: 'gastronomie',
    title_fr: 'Gastronomie — Plénitude, Hakuba & Le Tout-Paris',
    title_en: 'Dining — Plénitude, Hakuba & Le Tout-Paris',
    body_fr:
      'Cheval Blanc Paris aligne sept adresses F&B : Plénitude triplement étoilé, Hakuba deux étoiles, Le Tout-Paris une étoile, Langosteria, Le Jardin saisonnier et leurs bars distincts. Maxime Frédéric supervise l’offre sucrée.\n\nLa conciergerie réserve les tables, tient les listes d’attente et coordonne la Carte Blanche pour les dîners en chambre. Le 7e étage concentre la vie gastronomique avec la terrasse la plus spectaculaire sur la Seine.',
    body_en:
      'Cheval Blanc Paris lines up seven F&B addresses: three-star Plénitude, two-star Hakuba, one-star Le Tout-Paris, Langosteria, seasonal Le Jardin and their distinct bars. Maxime Frédéric oversees the sweet offer.\n\nThe concierge books tables, manages waitlists and coordinates Carte Blanche for in-room dinners. The 7th floor concentrates gastronomic life with the most spectacular terrace over the Seine.',
  },
  {
    anchor: 'chambres-suites',
    title_fr: 'Chambres & suites — 72 clefs',
    title_en: 'Rooms & suites — 72 keys',
    body_fr:
      'Vingt-six chambres et quarante-six suites composent un palace à l’échelle intime. Les catégories Deluxe et Deluxe Balcon ouvrent sur les toits ; les suites Seine et Eiffel déploient jardins d’hiver et horizons parisiens.\n\nL’Appartement et la Suite Quintessence accueillent les séjours les plus exigeants — volumes, salons séparés et service majordome. Le critère décisif : jardin d’hiver côté Seine pour le calme, ou terrasse 7e étage pour la vue.',
    body_en:
      'Twenty-six rooms and forty-six suites make an intimate-scale palace. Deluxe and Deluxe Balcony categories open onto rooftops; Seine and Eiffel suites unfold winter gardens and Paris horizons.\n\nL’Appartement and Suite Quintessence host the most demanding stays — volumes, separate living rooms and butler service. The decisive criterion: Seine-side winter garden for calm, or 7th-floor terrace for the view.',
  },
] as const;

export const CHEVAL_BLANC_PARIS_SIGNATURE_EXPERIENCES = [
  {
    key: 'plenitude-degustation',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-10`,
    title_fr: 'Dîner aux Absolues — Plénitude',
    title_en: 'Dinner with the Absolues — Plénitude',
    description_fr:
      'Table triplement étoilée d’Arnaud Donckele, du mardi au samedi à partir de 19 h 30. Réservation indispensable.',
    description_en:
      'Arnaud Donckele’s three-star table, Tuesday to Saturday from 7:30 pm. Reservation essential.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/plenitude/',
    tip_fr:
      'Mon conseil : demandez le comptoir cuisine — la mise en scène des Absolues vaut le spectacle.',
    tip_en: 'My tip: ask for kitchen counter seats — the Absolues staging is worth the show.',
  },
  {
    key: 'tout-paris-brunch',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-30`,
    title_fr: 'Brunch dominical au Le Tout-Paris',
    title_en: 'Sunday brunch at Le Tout-Paris',
    description_fr:
      'Brunch sur la terrasse du 7e étage quand le calendrier l’ouvre — vue Seine et toits parisiens.',
    description_en:
      'Brunch on the 7th-floor terrace when the calendar allows — Seine and Paris rooftop views.',
    booking_required: true,
    website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/le-tout-paris/',
    tip_fr:
      'Mon conseil : réservez deux semaines à l’avance et demandez la terrasse par beau temps.',
    tip_en: 'My tip: book two weeks ahead and ask for the terrace in fine weather.',
  },
  {
    key: 'dior-spa-ritual',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-13`,
    title_fr: 'Rituel Dior Spa & piscine mosaïque',
    title_en: 'Dior Spa ritual & mosaic pool',
    description_fr: 'Soins Dior en suite exclusive, puis piscine à débordement — sur rendez-vous.',
    description_en: 'Dior treatments in an exclusive suite, then infinity pool — by appointment.',
    booking_required: true,
    tip_fr: 'Mon conseil : enchaînez soin et bain à 17 h avant un dîner à Plénitude.',
    tip_en: 'My tip: follow treatment and pool at 5 pm before dinner at Plénitude.',
  },
  {
    key: 'hakuba-omakase',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-12`,
    title_fr: 'Omakase au comptoir Hakuba',
    title_en: 'Omakase at the Hakuba counter',
    description_fr:
      'Table japonaise deux étoiles — comptoir limité, service du mardi au samedi soir sur réservation.',
    description_en:
      'Two-star Japanese table — limited counter seats, Tuesday to Saturday evenings by reservation.',
    booking_required: true,
    website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/hakuba/',
    tip_fr:
      'Mon conseil : demandez le créneau 20 h 30 — le rythme du comptoir y est le plus fluide.',
    tip_en: 'My tip: ask for the 8:30 pm slot — the counter rhythm flows best then.',
  },
  {
    key: 'langosteria-seafood',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-14`,
    title_fr: 'Crudo & homard — Langosteria',
    title_en: 'Crudo & lobster — Langosteria',
    description_fr:
      'Restaurant italien de la Maison — fruits de mer crus, pâtes fraîches et vue sur la cour Samaritaine.',
    description_en:
      'The Maison’s Italian restaurant — raw seafood, fresh pasta and views over the Samaritaine courtyard.',
    booking_required: true,
    website: 'https://www.chevalblanc.com/fr/maison/paris/restaurants-et-bars/langosteria/',
    tip_fr: 'Mon conseil : ouvrez par le crudo du jour — la carte change selon l’arrivage.',
    tip_en: 'My tip: start with the crudo of the day — the menu shifts with the catch.',
  },
  {
    key: 'seine-croisiere-privee',
    image_public_id: `${CHEVAL_BLANC_PARIS_IMAGE_PREFIX}/press-17`,
    title_fr: 'Croisière privée sur la Seine',
    title_en: 'Private Seine cruise',
    description_fr:
      'Péniche ou yacht charter au départ du quai — champagne et vue Louvre organisés par la conciergerie.',
    description_en:
      'Barge or yacht charter from the quay — champagne and Louvre views arranged by the concierge.',
    booking_required: true,
    tip_fr:
      'Mon conseil : partez au coucher du soleil après Le Tout-Paris — la lumière sur les quais est irréelle.',
    tip_en: 'My tip: leave at sunset after Le Tout-Paris — the light on the embankments is unreal.',
  },
] as const;

export function resolveChevalBlancParisSignatureExperiences(): unknown[] {
  return [...CHEVAL_BLANC_PARIS_SIGNATURE_EXPERIENCES];
}

function resolveChevalBlancParisLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    CHEVAL_BLANC_PARIS_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchChevalBlancParisLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: CHEVAL_BLANC_PARIS_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: CHEVAL_BLANC_PARIS_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchChevalBlancParisLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of CHEVAL_BLANC_PARIS_LONG_DESCRIPTION_SECTIONS) {
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

export function sanitizeChevalBlancParisJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

export function patchChevalBlancParisAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

export function patchChevalBlancParisAmenities(
  _existing: unknown,
): readonly ChevalBlancParisAmenityRecord[] {
  return CHEVAL_BLANC_PARIS_AMENITIES;
}

export { CHEVAL_BLANC_PARIS_AMENITIES, type ChevalBlancParisAmenityRecord };
export {
  CHEVAL_BLANC_PARIS_CONCIERGE_QUESTIONS_KIT,
  type ChevalBlancParisConciergeQuestionKit,
} from './cheval-blanc-paris-concierge-questions';

export function patchChevalBlancParisSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...CHEVAL_BLANC_PARIS_WELLNESS_INFO };
}

export function patchChevalBlancParisPolicies(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    check_in: {
      time: '15:00',
      notes_fr: 'Arrivée dès 15 h ; early check-in selon disponibilité sur demande.',
      notes_en: 'Arrival from 3 pm; early check-in subject to availability on request.',
    },
    check_out: {
      time: '12:00',
      notes_fr: 'Départ jusqu’à 12 h ; late check-out selon disponibilité.',
      notes_en: 'Departure until noon; late checkout subject to availability.',
    },
    cancellation: {
      notes_fr:
        'Conditions selon le tarif réservé. La conciergerie communique la politique exacte.',
      notes_en: 'Terms depend on the rate booked. The concierge shares the exact policy.',
    },
    pets: {
      allowed: true,
      notes_fr: 'Animaux acceptés sur demande — contactez la Maison avant l’arrivée.',
      notes_en: 'Pets allowed on request — contact the Maison before arrival.',
    },
    wifi: { included: true, scope: 'whole_property' },
  };
}

export interface ChevalBlancParisGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildChevalBlancParisGoldenFields(
  current: ChevalBlancParisGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchChevalBlancParisSpa(current.spa_info);
  return {
    highlights: CHEVAL_BLANC_PARIS_HIGHLIGHTS,
    faq_content: CHEVAL_BLANC_PARIS_FAQ_CONTENT_PROMOTE,
    faq_content_kit: CHEVAL_BLANC_PARIS_FAQ_CONTENT_KIT,
    concierge_questions: CHEVAL_BLANC_PARIS_CONCIERGE_QUESTIONS_KIT,
    opened_at: '2021-09-07',
    transports: CHEVAL_BLANC_PARIS_TRANSPORTS,
    restaurant_info: CHEVAL_BLANC_PARIS_RESTAURANT_INFO,
    points_of_interest: CHEVAL_BLANC_PARIS_POINTS_OF_INTEREST,
    concierge_advice: CHEVAL_BLANC_PARIS_CONCIERGE_ADVICE,
    concierge_pick: CHEVAL_BLANC_PARIS_CONCIERGE_PICK,
    concierge_hook: CHEVAL_BLANC_PARIS_CONCIERGE_HOOK,
    instagram: CHEVAL_BLANC_PARIS_INSTAGRAM,
    policies: patchChevalBlancParisPolicies(current.policies),
    awards: patchChevalBlancParisAwards(current.awards),
    amenities: patchChevalBlancParisAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: CHEVAL_BLANC_PARIS_DESCRIPTION_FR,
    description_en: CHEVAL_BLANC_PARIS_DESCRIPTION_EN,
    long_description_sections: sanitizeChevalBlancParisJsonb(
      resolveChevalBlancParisLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizeChevalBlancParisJsonb(
      resolveChevalBlancParisSignatureExperiences(),
    ),
    featured_reviews: CHEVAL_BLANC_PARIS_FEATURED_REVIEWS,
    mice_info: CHEVAL_BLANC_PARIS_MICE_INFO,
    factual_summary_fr: CHEVAL_BLANC_PARIS_FACTUAL_SUMMARY_FR,
    factual_summary_en: CHEVAL_BLANC_PARIS_FACTUAL_SUMMARY_EN,
    meta_desc_fr: CHEVAL_BLANC_PARIS_META_DESC_FR,
    meta_desc_en: CHEVAL_BLANC_PARIS_META_DESC_EN,
    meta_title_fr: CHEVAL_BLANC_PARIS_META_TITLE_FR,
    meta_title_en: CHEVAL_BLANC_PARIS_META_TITLE_EN,
    hero_image: CHEVAL_BLANC_PARIS_HERO_IMAGE,
    gallery_images: CHEVAL_BLANC_PARIS_GALLERY_IMAGES,
    external_sources: CHEVAL_BLANC_PARIS_EXTERNAL_SOURCES,
    wikidata_id: chevalBlancParisExternalScalar('wikidata_id'),
    official_url: chevalBlancParisExternalScalar('official_url'),
    phone_e164: CHEVAL_BLANC_PARIS_PHONE_E164,
    address: CHEVAL_BLANC_PARIS_ADDRESS,
    postal_code: CHEVAL_BLANC_PARIS_POSTAL_CODE,
    latitude: CHEVAL_BLANC_PARIS_LATITUDE,
    longitude: CHEVAL_BLANC_PARIS_LONGITUDE,
    email_reservations: CHEVAL_BLANC_PARIS_EMAIL_RESERVATIONS,
    affiliations: CHEVAL_BLANC_PARIS_AFFILIATIONS,
    google_place_id: CHEVAL_BLANC_PARIS_GOOGLE_PLACE_ID,
  };
}
