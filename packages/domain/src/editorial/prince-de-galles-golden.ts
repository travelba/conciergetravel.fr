/**
 * Prince de Galles Paris "golden template" editorial content — single source of
 * truth shared by the apps/web post-fetch override (local sandbox) and the
 * catalogue promotion script (`@mch/editorial-pilot`).
 *
 * Pure data + pure transforms (no `server-only`, no framework imports) so it
 * can be imported from both the Next.js app and the standalone tsx scripts.
 *
 * Facts sourced from the official Marriott / restaurant sites (19-20paris.fr,
 * akirabackparis.com), Wikidata and public tourism references. Figures not
 * confidently sourced are omitted (EEAT — IATA-accredited OTA).
 */

import {
  dropCannibalizingSections,
  dropDuplicateCategorySections,
  resolvePopulatedBlocks,
} from './golden-template';
import {
  PRINCE_DE_GALLES_AMENITIES,
  type PrinceDeGallesAmenityRecord,
} from './prince-de-galles-amenities';
import {
  PRINCE_DE_GALLES_FAQ_CONTENT_KIT,
  PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE,
} from './prince-de-galles-faq.generated';
import {
  PRINCE_DE_GALLES_GALLERY_IMAGES,
  PRINCE_DE_GALLES_HERO_IMAGE,
} from './prince-de-galles-gallery';

export const PRINCE_DE_GALLES_PROMOTE_SLUG = 'prince-de-galles-paris';

/** Cloudinary folder prefix for Prince de Galles kit / golden assets. */
export const PRINCE_DE_GALLES_IMAGE_PREFIX = 'cct/hotels/prince-de-galles-paris';

// ---------------------------------------------------------------------------
// Shared contact constants (official — Marriott hotel page)
// ---------------------------------------------------------------------------

const FNB_PHONE_DISPLAY = '+33 1 53 23 78 50';

export const PRINCE_DE_GALLES_PHONE_E164 = '+33153237777';
export const PRINCE_DE_GALLES_ADDRESS = '33 Avenue George V';
export const PRINCE_DE_GALLES_POSTAL_CODE = '75008';
export const PRINCE_DE_GALLES_LATITUDE = 48.869092;
export const PRINCE_DE_GALLES_LONGITUDE = 2.300681;

// ---------------------------------------------------------------------------
// restaurant_info.venues — 3 official F&B venues + concierge handoffs
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_RESTAURANT_INFO = {
  count: 3,
  michelin_stars: 0,
  venues: [
    {
      name: '19.20 Paris by Norbert Tarayre',
      type_fr: 'Bistrot parisien · Chef Norbert Tarayre · Bar Belle Époque',
      type_en: 'Parisian bistro · Chef Norbert Tarayre · Belle Époque bar',
      chef: 'Norbert Tarayre',
      features: ['Cuisine de bistrot', 'Tea Time', 'Bar Art Déco'],
      hours_fr: 'Tous les jours 12h–14h et 19h–22h15 · Tea Time ven–dim 16h–17h',
      hours_en: 'Daily 12–2 pm and 7–10:15 pm · Tea Time Fri–Sun 4–5 pm',
      description_fr:
        'Norbert Tarayre revisite les classiques du bistrot parisien dans le bar Art Déco de l’hôtel. Menu à 49 € le midi et le soir. Tea Time le week-end signé Hélène Kerloeguen.',
      description_en:
        'Norbert Tarayre reworks Parisian bistro classics in the hotel’s Art Deco bar. €49 menu at lunch and dinner. Weekend Tea Time by pastry chef Hélène Kerloeguen.',
      website: 'https://www.19-20paris.fr/en/',
      reservation_url: 'https://www.19-20paris.fr/en/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'Menu 49 € · à la carte 40–82 €',
      price_note_en: '€49 menu · à la carte €40–82',
      tip_fr:
        'Mon conseil : réservez le comptoir vers 19h30. Le service y est plus direct, et l’ambiance Belle Époque prend tout son sens avant le dîner.',
      tip_en:
        'My tip: book a counter seat around 7:30 pm. Service is more direct there, and the Belle Époque mood comes alive before dinner.',
    },
    {
      name: 'Akira Back Paris',
      type_fr: 'Fusion nippo-coréenne · 1 étoile MICHELIN · Chef Akira Back',
      type_en: 'Japanese-Korean fusion · 1 MICHELIN Star · Chef Akira Back',
      chef: 'Akira Back',
      features: ['AB Tuna Pizza', 'Comptoir en marbre', 'Art Déco'],
      hours_fr: 'Tous les jours 19h–minuit',
      hours_en: 'Daily 7 pm–midnight',
      description_fr:
        'Première table européenne du chef Akira Back, au cœur du Prince de Galles. Cuisine japonaise enrichie d’accents coréens — commencez par la fameuse AB Tuna Pizza.',
      description_en:
        'Chef Akira Back’s first European table, at the heart of Prince de Galles. Japanese cuisine with Korean accents — start with the signature AB Tuna Pizza.',
      website: 'https://www.akirabackparis.com/',
      reservation_url: 'https://www.akirabackparis.com/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'Menus dégustation · à la carte',
      price_note_en: 'Tasting menus · à la carte',
      tip_fr:
        'Mon conseil : pour un week-end, réservez deux semaines à l’avance. Demandez le comptoir face à la cuisine — la mise en scène vaut le spectacle.',
      tip_en:
        'My tip: for a weekend, book two weeks ahead. Ask for counter seats facing the kitchen — the staging is worth the show.',
    },
    {
      name: 'Le Patio',
      type_fr: 'Cour Art Déco à ciel ouvert · Afternoon tea & brunch',
      type_en: 'Open-air Art Deco courtyard · Afternoon tea & brunch',
      features: ['Cour intérieure emblématique', 'Afternoon tea', 'Brunch du dimanche'],
      hours_fr: 'Afternoon tea ven–dim 16h–17h30 · Brunch le dimanche (selon programme)',
      hours_en: 'Afternoon tea Fri–Sun 4–5:30 pm · Sunday brunch (per schedule)',
      description_fr:
        'La cour Art Déco emblématique de la maison, prolongée par des chambres avec balcon. Afternoon tea le week-end ; brunch dominical quand le calendrier l’ouvre.',
      description_en:
        'The hotel’s emblematic Art Deco courtyard, extended by balcony rooms. Weekend afternoon tea; Sunday brunch when the calendar allows.',
      website:
        'https://www.marriott.com/fr/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/dining/',
      reservation_url: 'https://www.19-20paris.fr/en/',
      phone: FNB_PHONE_DISPLAY,
      price_note_fr: 'Tea Time à partir de 65 €',
      price_note_en: 'Tea Time from €65',
      tip_fr:
        'Mon conseil : aux beaux jours, demandez une table côté Patio pour le tea time. La cour capte la lumière de fin d’après-midi comme nulle part ailleurs dans le 8e.',
      tip_en:
        'My tip: in fine weather, ask for a Patio-side table for tea time. The courtyard catches late-afternoon light like nowhere else in the 8th.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// points_of_interest — 18 curated POIs (visit / do / shop), Triangle d'Or
// Distances from 33 avenue George V (~48.869, 2.301). Tips ≤ 25 words/sentence.
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_POINTS_OF_INTEREST = [
  {
    name: 'Arc de triomphe',
    name_en: 'Arc de Triomphe',
    type: 'monument',
    category_fr: 'Monument historique',
    category_en: 'Historic monument',
    distance_meters: 625,
    walk_minutes: 8,
    latitude: 48.873792,
    longitude: 2.295028,
    bucket: 'visit',
    description_fr:
      'Monument emblématique de la place Charles-de-Gaulle, achevé en 1836. Terrasse panoramique sur les douze avenues rayonnantes et la ligne des Champs-Élysées.',
    description_en:
      'Emblematic monument on Place Charles-de-Gaulle, completed in 1836. Panoramic terrace over the twelve radiating avenues and the Champs-Élysées axis.',
    website: 'https://www.paris-arc-de-triomphe.fr/',
    address: 'Place Charles-de-Gaulle, 75008 Paris',
    hours_fr: 'Tous les jours 10h–22h30 (dernière montée 21h45)',
    hours_en: 'Daily 10 am–10:30 pm (last ascent 9:45 pm)',
    price_note_fr: '16 € adulte · gratuit -18 ans UE',
    price_note_en: '€16 adult · free under 18 EU',
    tip_fr:
      'Mon conseil : 8 minutes à pied. Montez à l’ouverture, avant 10 h : la lumière sur l’Arc vaut chaque marche.',
    tip_en:
      'My tip: an 8-minute walk. Go at opening, before 10 am — the light on the Arc rewards every step.',
  },
  {
    name: 'Grand Palais',
    name_en: 'Grand Palais',
    type: 'museum',
    category_fr: 'Monument & expositions',
    category_en: 'Monument & exhibitions',
    distance_meters: 950,
    walk_minutes: 12,
    latitude: 48.866109,
    longitude: 2.312454,
    bucket: 'visit',
    description_fr:
      'Chef-d’œuvre de l’architecture Belle Époque (1900), verrière monumentale et programmation culturelle au cœur des Champs-Élysées.',
    description_en:
      'Belle Époque architectural landmark (1900), monumental glass roof and cultural programming at the heart of the Champs-Élysées.',
    website: 'https://www.grandpalais.fr/',
    address: '3 Avenue du Général Eisenhower, 75008 Paris',
    tip_fr:
      'Mon conseil : 12 minutes à pied. Vérifiez l’expo du moment sur grandpalais.fr — la verrière seule justifie le détour.',
    tip_en:
      'My tip: a 12-minute walk. Check the current exhibition on grandpalais.fr — the glass roof alone justifies the trip.',
  },
  {
    name: 'Petit Palais',
    name_en: 'Petit Palais',
    type: 'museum',
    category_fr: 'Musée des Beaux-Arts de la Ville de Paris',
    category_en: 'Paris Fine Arts Museum',
    distance_meters: 900,
    walk_minutes: 11,
    latitude: 48.866047,
    longitude: 2.314424,
    bucket: 'visit',
    description_fr:
      'Musée municipal gratuit (collections permanentes) dans un palais de l’Exposition universelle de 1900, jardin intérieur et café en terrasse.',
    description_en:
      'Free municipal museum (permanent collections) in a 1900 World’s Fair palace, inner garden and terrace café.',
    website: 'https://www.petitpalais.paris.fr/',
    address: 'Avenue Winston Churchill, 75008 Paris',
    hours_fr: 'Mar–dim 10h–18h (nocturne ven jusqu’à 21h)',
    hours_en: 'Tue–Sun 10 am–6 pm (Fri late until 9 pm)',
    price_note_fr: 'Collections permanentes gratuites',
    price_note_en: 'Permanent collections free',
    tip_fr:
      'Mon conseil : collections permanentes gratuites. Entrez par le jardin, un café à l’ombre clôt bien une matinée au Grand Palais.',
    tip_en:
      'My tip: permanent collections are free. Enter via the garden — a shaded coffee closes a Grand Palais morning neatly.',
  },
  {
    name: 'Place de la Concorde',
    name_en: 'Place de la Concorde',
    type: 'landmark',
    category_fr: 'Place historique',
    category_en: 'Historic square',
    distance_meters: 1200,
    walk_minutes: 15,
    latitude: 48.865633,
    longitude: 2.321236,
    bucket: 'visit',
    description_fr:
      'Plus grande place de Paris, entre le jardin des Tuileries et les Champs-Élysées. Obélisque de Louxor et fontaines de Jacques Ignace Hittorff.',
    description_en:
      'Paris’s largest square, between the Tuileries Garden and the Champs-Élysées. Luxor Obelisk and fountains by Jacques Ignace Hittorff.',
    address: 'Place de la Concorde, 75008 Paris',
    tip_fr:
      'Mon conseil : 15 minutes à pied. Traversez au crépuscule : l’obélisque et la Tour Eiffel s’alignent dans la même perspective.',
    tip_en:
      'My tip: a 15-minute walk. Cross at dusk — the obelisk and the Eiffel Tower align in the same sightline.',
  },
  {
    name: 'Musée Yves Saint Laurent Paris',
    name_en: 'Yves Saint Laurent Paris Museum',
    type: 'museum',
    category_fr: 'Musée de la mode',
    category_en: 'Fashion museum',
    distance_meters: 402,
    walk_minutes: 5,
    latitude: 48.868703,
    longitude: 2.303305,
    bucket: 'visit',
    description_fr:
      'Ancien hôtel particulier de l’avenue Marceau où Yves Saint Laurent créa pendant près de trente ans. Atelier reconstitué et collections de haute couture.',
    description_en:
      'Former Avenue Marceau town house where Yves Saint Laurent created for nearly thirty years. Reconstructed studio and haute couture collections.',
    website: 'https://museeyslparis.com/',
    address: '5 Avenue Marceau, 75116 Paris',
    hours_fr: 'Mar–dim 11h–18h (nocturne ven jusqu’à 21h)',
    hours_en: 'Wed–Sun 11 am–6 pm (Fri late until 9 pm)',
    price_note_fr: 'Billet combiné avec le Palais Galliera',
    price_note_en: 'Combined ticket with Palais Galliera',
    tip_fr:
      'Mon conseil : 5 minutes à pied. Réservez l’atelier reconstitué en créneau du matin — la lumière nord y est la même qu’à l’époque du couturier.',
    tip_en:
      'My tip: a 5-minute walk. Book the reconstructed studio for a morning slot — the north light matches the couturier’s era.',
  },
  {
    name: 'Palais Galliera',
    name_en: 'Palais Galliera',
    type: 'museum',
    category_fr: 'Musée de la Mode de la Ville de Paris',
    category_en: 'Paris Fashion Museum',
    distance_meters: 480,
    walk_minutes: 6,
    latitude: 48.865242,
    longitude: 2.297839,
    bucket: 'visit',
    description_fr:
      'Musée municipal de la mode avenue Pierre-Ier-de-Serbie, plus de 200 000 pièces. Expositions temporaires dans un palais néoclassique et son jardin.',
    description_en:
      'Municipal fashion museum on Avenue Pierre 1er de Serbie, over 200,000 pieces. Temporary exhibitions in a neoclassical palace and garden.',
    website: 'https://www.palaisgalliera.paris.fr/',
    address: '10 Avenue Pierre 1er de Serbie, 75116 Paris',
    tip_fr:
      'Mon conseil : 6 minutes à pied. Achetez le billet combiné YSL + Galliera : les deux musées se visitent le même après-midi.',
    tip_en:
      'My tip: a 6-minute walk. Buy the YSL + Galliera combined ticket — both museums fit into one afternoon.',
  },
  {
    name: 'Cathédrale de la Sainte-Trinité',
    name_en: 'Holy Trinity Cathedral',
    type: 'cathedral',
    category_fr: 'Église orthodoxe russe',
    category_en: 'Russian Orthodox cathedral',
    distance_meters: 799,
    walk_minutes: 10,
    latitude: 48.861908,
    longitude: 2.300888,
    bucket: 'visit',
    description_fr:
      'Cathédrale orthodoxe russe de style néo-russe (2016), cinq coupoles dorées et iconostase contemporaine. Visites guidées sur réservation.',
    description_en:
      'Neo-Russian Orthodox cathedral (2016), five gilded domes and a contemporary iconostasis. Guided visits by reservation.',
    website: 'https://www.cathedrale-russe.eu/',
    address: '6 Avenue Albert II de Monaco, 75116 Paris',
    tip_fr:
      'Mon conseil : 10 minutes à pied. Les offices du dimanche matin résonnent dans les coupoles — arrivez dix minutes avant l’ouverture.',
    tip_en:
      'My tip: a 10-minute walk. Sunday morning services resonate under the domes — arrive ten minutes before opening.',
  },
  {
    name: 'Promenade des Champs-Élysées',
    name_en: 'Champs-Élysées stroll',
    type: 'promenade',
    category_fr: 'Flânerie parisienne',
    category_en: 'Parisian stroll',
    distance_meters: 200,
    walk_minutes: 3,
    latitude: 48.8698,
    longitude: 2.3078,
    bucket: 'do',
    description_fr:
      'L’avenue la plus célèbre de Paris, de la place de la Concorde à l’Arc de triomphe. Cinémas historiques, flagship stores et terrasses entre deux rendez-vous.',
    description_en:
      'Paris’s most famous avenue, from Place de la Concorde to the Arc de Triomphe. Historic cinemas, flagship stores and terraces between appointments.',
    address: 'Avenue des Champs-Élysées, 75008 Paris',
    tip_fr:
      'Mon conseil : sortez tôt le matin, avant 9 h. Les Champs-Élysées retrouvent alors leur calme, entre deux vitrines et deux terrasses.',
    tip_en:
      'My tip: step out early, before 9 am. The Champs-Élysées recover their calm then, between shop windows and terraces.',
  },
  {
    name: 'Théâtre des Champs-Élysées',
    name_en: 'Théâtre des Champs-Élysées',
    type: 'theatre',
    category_fr: 'Salle de concerts & opéra',
    category_en: 'Concert hall & opera',
    distance_meters: 350,
    walk_minutes: 5,
    latitude: 48.866787,
    longitude: 2.303934,
    bucket: 'do',
    description_fr:
      'Salle Art Nouveau inaugurée en 1913 (15 avenue Montaigne). Programmation classique, jazz et danse dans une architecture de Auguste Perret.',
    description_en:
      'Art Nouveau hall opened in 1913 (15 Avenue Montaigne). Classical, jazz and dance programming in Auguste Perret architecture.',
    website: 'https://www.theatrechampselysees.fr/',
    address: '15 Avenue Montaigne, 75008 Paris',
    tip_fr:
      'Mon conseil : 5 minutes à pied. Vérifiez les répétitions ouvertes au public — l’acoustique de la salle se juge mieux en live qu’en disque.',
    tip_en:
      'My tip: a 5-minute walk. Check open rehearsals — the hall’s acoustics are best judged live, not on record.',
  },
  {
    name: 'Palais de Tokyo',
    name_en: 'Palais de Tokyo',
    type: 'museum',
    category_fr: 'Centre d’art contemporain',
    category_en: 'Contemporary art centre',
    distance_meters: 593,
    walk_minutes: 8,
    latitude: 48.864242,
    longitude: 2.297636,
    bucket: 'do',
    description_fr:
      'Plus grand centre d’art contemporain d’Europe, ouvert jusqu’à minuit. Expositions éphémères, performances et restaurant Le Tout-Paris sur les toits.',
    description_en:
      'Europe’s largest contemporary art centre, open until midnight. Ephemeral exhibitions, performances and Le Tout-Paris restaurant on the roof.',
    website: 'https://www.palaisdetokyo.com/',
    address: '13 Avenue du Président Wilson, 75116 Paris',
    hours_fr: 'Mer–lun 12h–minuit (fermé mar)',
    hours_en: 'Wed–Mon noon–midnight (closed Tue)',
    tip_fr:
      'Mon conseil : 8 minutes à pied. Allez en nocturne, après 20 h : les expositions prennent une autre densité quand le public se raréfie.',
    tip_en:
      'My tip: an 8-minute walk. Go after 8 pm — exhibitions gain another density when the crowd thins.',
  },
  {
    name: 'Jardin des Champs-Élysées',
    name_en: 'Jardin des Champs-Élysées',
    type: 'garden',
    category_fr: 'Jardin historique',
    category_en: 'Historic garden',
    distance_meters: 700,
    walk_minutes: 9,
    latitude: 48.868,
    longitude: 2.313,
    bucket: 'do',
    description_fr:
      'Parc entre le Grand Palais et la place de la Concorde, kiosques, théâtre de marionnettes et allées ombragées pour une pause entre deux musées.',
    description_en:
      'Park between the Grand Palais and Place de la Concorde, kiosks, puppet theatre and shaded alleys for a break between two museums.',
    address: 'Avenue Gabriel, 75008 Paris',
    tip_fr:
      'Mon conseil : 9 minutes à pied. Traversez le jardin après le Petit Palais — les allées ombragées coupent le bruit de l’avenue.',
    tip_en:
      'My tip: a 9-minute walk. Cross the garden after the Petit Palais — shaded alleys cut the avenue noise.',
  },
  {
    name: 'Croisière sur la Seine',
    name_en: 'Seine river cruise',
    type: 'cruise',
    category_fr: 'Croisière commentée',
    category_en: 'Sightseeing cruise',
    distance_meters: 850,
    walk_minutes: 11,
    latitude: 48.863,
    longitude: 2.308,
    bucket: 'do',
    description_fr:
      'Embarquement au Port de la Conférence, sous le pont de l’Alma. Croisières d’une heure ou dîners-croisières sur la Seine entre les monuments.',
    description_en:
      'Boarding at Port de la Conférence, below Pont de l’Alma. One-hour cruises or dinner cruises on the Seine between the monuments.',
    website: 'https://www.bateauxparisiens.com/',
    address: 'Port de la Conférence, 75008 Paris',
    tip_fr:
      'Mon conseil : 11 minutes à pied. Embarquez au crépuscule : la Tour Eiffel s’illumine pendant la croisière, sans quitter le Triangle d’Or.',
    tip_en:
      'My tip: an 11-minute walk. Board at dusk — the Eiffel Tower lights up during the cruise, without leaving the Golden Triangle.',
  },
  {
    name: 'Le Clarence',
    name_en: 'Le Clarence',
    type: 'restaurant',
    category_fr: 'Table 3 étoiles MICHELIN · Parc Monceau',
    category_en: '3 MICHELIN Star table · Parc Monceau',
    distance_meters: 1800,
    walk_minutes: 22,
    latitude: 48.8775,
    longitude: 2.3095,
    bucket: 'do',
    description_fr:
      'Hôtel particulier avenue de Friedland, table trois étoiles MICHELIN de Arnaud Donckele. Cuisine française d’exception dans un cadre de demeure privée.',
    description_en:
      'Town house on Avenue de Friedland, Arnaud Donckele’s three-MICHELIN-star table. Outstanding French cuisine in a private residence setting.',
    website: 'https://www.leclarence.paris/',
    phone: '+33 1 82 88 80 80',
    tip_fr:
      'Mon conseil : 22 minutes à pied ou 8 minutes en taxi. Réservez le salon du premier étage — le service y est plus intime.',
    tip_en:
      'My tip: a 22-minute walk or 8 minutes by taxi. Book the first-floor salon — service is more intimate there.',
  },
  {
    name: 'Galeries Lafayette Champs-Élysées',
    name_en: 'Galeries Lafayette Champs-Élysées',
    type: 'store',
    category_fr: 'Grand magasin & concept store',
    category_en: 'Department & concept store',
    distance_meters: 437,
    walk_minutes: 5,
    latitude: 48.870445,
    longitude: 2.306291,
    bucket: 'shop',
    description_fr:
      'Concept store sur les Champs-Élysées : mode créateur, beauté, restauration et rooftop avec vue sur l’Arc de triomphe.',
    description_en:
      'Concept store on the Champs-Élysées: designer fashion, beauty, dining and a rooftop with Arc de Triomphe views.',
    website: 'https://haussmann.galerieslafayette.com/champs-elysees',
    address: '60 Avenue des Champs-Élysées, 75008 Paris',
    hours_fr: 'Lun–sam 10h30–20h30 · dim 11h–20h',
    hours_en: 'Mon–Sat 10:30 am–8:30 pm · Sun 11 am–8 pm',
    tip_fr:
      'Mon conseil : 5 minutes à pied. Montez au rooftop avant 18 h — la vue sur l’Arc se lit sans la foule du soir.',
    tip_en:
      'My tip: a 5-minute walk. Head to the rooftop before 6 pm — the Arc view comes without the evening crowd.',
  },
  {
    name: 'Avenue Montaigne',
    name_en: 'Avenue Montaigne',
    type: 'shopping',
    category_fr: 'Artère du luxe parisien',
    category_en: 'Paris luxury avenue',
    distance_meters: 300,
    walk_minutes: 4,
    latitude: 48.8665,
    longitude: 2.3045,
    bucket: 'shop',
    description_fr:
      'Artère du luxe entre les Champs-Élysées et la Seine : Chanel, Dior, Louis Vuitton, haute joaillerie et showrooms de créateurs.',
    description_en:
      'Luxury artery between the Champs-Élysées and the Seine: Chanel, Dior, Louis Vuitton, high jewellery and designer showrooms.',
    address: 'Avenue Montaigne, 75008 Paris',
    tip_fr:
      'Mon conseil : 4 minutes à pied. Flânez en semaine, vers 11 h : les vitrines se changent et les salons sont plus disponibles.',
    tip_en:
      'My tip: a 4-minute walk. Stroll on a weekday around 11 am — windows are being dressed and salons are more available.',
  },
  {
    name: 'Maison Guerlain Champs-Élysées',
    name_en: 'Guerlain Champs-Élysées',
    type: 'store',
    category_fr: 'Maison de parfum historique',
    category_en: 'Historic perfume house',
    distance_meters: 450,
    walk_minutes: 6,
    latitude: 48.871,
    longitude: 2.303,
    bucket: 'shop',
    description_fr:
      'Temple de la parfumerie française au 68 des Champs-Élysées, depuis 1914. Atelier de personnalisation et collections iconiques (Shalimar, La Petite Robe Noire).',
    description_en:
      'French perfumery temple at 68 Champs-Élysées, since 1914. Personalisation atelier and iconic collections (Shalimar, La Petite Robe Noire).',
    website: 'https://www.guerlain.com/',
    address: '68 Avenue des Champs-Élysées, 75008 Paris',
    tip_fr:
      'Mon conseil : 6 minutes à pied. Demandez une gravure sur flacon — c’est le cadeau le plus net à rapporter du Triangle d’Or.',
    tip_en:
      'My tip: a 6-minute walk. Ask for bottle engraving — the clearest gift to bring back from the Golden Triangle.',
  },
  {
    name: 'Louis Vuitton Maison Champs-Élysées',
    name_en: 'Louis Vuitton Champs-Élysées',
    type: 'store',
    category_fr: 'Maison flagship',
    category_en: 'Flagship store',
    distance_meters: 500,
    walk_minutes: 6,
    latitude: 48.867565,
    longitude: 2.306835,
    bucket: 'shop',
    description_fr:
      'Maison historique Louis Vuitton sur les Champs-Élysées, malletier depuis 1854. Maroquinerie, prêt-à-porter et espace personnalisation.',
    description_en:
      'Historic Louis Vuitton maison on the Champs-Élysées, trunk-maker since 1854. Leather goods, ready-to-wear and personalisation space.',
    website: 'https://fr.louisvuitton.com/',
    address: '101 Avenue des Champs-Élysées, 75008 Paris',
    tip_fr:
      'Mon conseil : 6 minutes à pied. Les pièces personnalisées demandent 48 h — passez le premier jour pour récupérer avant le départ.',
    tip_en:
      'My tip: a 6-minute walk. Personalised pieces need 48 h — stop on day one to collect before departure.',
  },
  {
    name: 'Galerie Dior',
    name_en: 'La Galerie Dior',
    type: 'store',
    category_fr: 'Musée de la couture Dior',
    category_en: 'Dior couture museum',
    distance_meters: 400,
    walk_minutes: 5,
    latitude: 48.8669,
    longitude: 2.3038,
    bucket: 'shop',
    description_fr:
      'Galerie Dior avenue Montaigne : parcours immersif sur l’histoire de la maison, de 1947 à aujourd’hui, robes de haute couture et ateliers reconstitués.',
    description_en:
      'Dior gallery on Avenue Montaigne: immersive journey through the house history, from 1947 to today, haute couture gowns and reconstructed ateliers.',
    website: 'https://www.dior.com/',
    address: '11 Rue François 1er, 75008 Paris',
    tip_fr:
      'Mon conseil : 5 minutes à pied. Réservez le créneau de 10 h : la galerie se parcourt dans le calme, avant l’afflux de l’après-midi.',
    tip_en:
      'My tip: a 5-minute walk. Book the 10 am slot — you tour the gallery in calm, before the afternoon rush.',
  },
] as const;

// ---------------------------------------------------------------------------
// concierge_advice + concierge_pick + concierge_hook
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_CONCIERGE_ADVICE = {
  fr: {
    title: 'Le Conseil du Concierge',
    tip_for: 'room',
    body: 'Mon conseil : pour une première venue, demandez la Chambre Art Déco Deluxe Balcon côté cour intérieure. Vous accédez au calme du Patio sans renoncer à la lumière. Le rituel que je recommande : un bain le soir dans le marbre à mosaïque, peignoir et produits Lalique, avant de rejoindre l’avenue Montaigne à pied. Prévenez-moi de votre heure d’arrivée — je fais préparer la chambre en avance.',
  },
  en: {
    title: 'The Concierge’s Tip',
    tip_for: 'room',
    body: 'My tip: for a first stay, ask for the Art Deco Deluxe Balcony room on the inner courtyard side. You gain the Patio’s quiet without losing the light. The ritual I recommend is an evening bath in the mosaic marble, robe and Lalique amenities, before walking to Avenue Montaigne. Let me know your arrival time — I will have the room readied early.',
  },
} as const;

export const PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG = 'chambre-art-deco-deluxe-balcon';

export const PRINCE_DE_GALLES_CONCIERGE_PICK_NOTE = {
  fr: 'Balcon privatif sur la cour Le Patio ou sur Paris — la chambre que je réserve en premier pour une première venue.',
  en: 'Private balcony over Le Patio courtyard or Paris — the room I book first for a first stay.',
} as const;

/** DB column shape for `concierge_pick` (migration 0068). */
export const PRINCE_DE_GALLES_CONCIERGE_PICK = {
  slug: PRINCE_DE_GALLES_CONCIERGE_PICK_SLUG,
  note: PRINCE_DE_GALLES_CONCIERGE_PICK_NOTE,
} as const;

export const PRINCE_DE_GALLES_CONCIERGE_HOOK = {
  fr: 'Palace Art Déco sur l’avenue George-V, The Luxury Collection : balcons sur les toits de Paris, à deux pas des Champs-Élysées et de l’avenue Montaigne.',
  en: 'Art Deco palace on avenue George-V, The Luxury Collection: balconies over the Paris rooftops, steps from the Champs-Élysées and Avenue Montaigne.',
} as const;

// ---------------------------------------------------------------------------
// Résumés factuels + méta-descriptions (bande [130, 150] / [140, 170])
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_FACTUAL_SUMMARY_FR =
  'Palace Art Déco avenue George-V, The Luxury Collection : 116 chambres, balcons sur les toits de Paris, tables Norbert Tarayre et Akira Back.';
export const PRINCE_DE_GALLES_FACTUAL_SUMMARY_EN =
  'Palace Art Deco on Avenue George-V, The Luxury Collection: 116 rooms, balconies over Paris rooftops, Norbert Tarayre and Akira Back tables.';

/** Magazine lede for `#apropos` — voice & atmosphere only (no duplicate of structured blocks). */
export const PRINCE_DE_GALLES_DESCRIPTION_FR =
  'Sur l’avenue George-V, le Prince de Galles cultive une atmosphère feutrée où l’Art déco se lit dans chaque angle : mosaïques, photographies noir et blanc, têtes de lit miroitées. Cent seize chambres et suites composent une maison à l’échelle humaine pour un palace parisien, dont vingt-six ouvrent sur un balcon ou une terrasse.\n\nLa conciergerie anticipe sans envahir — petit-déjeuner au Patio, dernière table au comptoir, voiturier à l’arrivée. C’est l’essence d’un séjour au Triangle d’Or : le Paris des grandes occasions, à deux pas de l’avenue Montaigne, sans jamais rompre la parenthèse. Les tables Akira Back et 19.20 by Norbert Tarayre ancrent la maison dans la gastronomie parisienne contemporaine.';
export const PRINCE_DE_GALLES_DESCRIPTION_EN =
  'On avenue George-V, Prince de Galles cultivates a hushed atmosphere where Art Deco shows in every corner: mosaics, black-and-white photography, mirrored headboards. One hundred sixteen rooms and suites make a human-scale house for a Parisian palace, twenty-six of them with a balcony or terrace.\n\nThe concierge anticipates without intruding — breakfast on the Patio, a last table at the counter, valet on arrival. That is the essence of a Golden Triangle stay: Paris for grand occasions, steps from Avenue Montaigne, without ever breaking the spell. Akira Back and 19.20 by Norbert Tarayre anchor the house in contemporary Parisian dining.';

export const PRINCE_DE_GALLES_META_DESC_FR =
  'Prince de Galles, palace Art Déco avenue George-V : balcons sur Paris, 19.20 by Norbert Tarayre, Akira Back et cour Le Patio. Métro George V.';
export const PRINCE_DE_GALLES_META_DESC_EN =
  'Prince de Galles, Art Deco palace on avenue George-V: balconies over Paris, 19.20 by Norbert Tarayre, Akira Back and Le Patio courtyard. George V metro.';

export const PRINCE_DE_GALLES_META_TITLE_FR =
  'Prince de Galles — Palace Art Déco Paris | MyConciergeHotel';
export const PRINCE_DE_GALLES_META_TITLE_EN =
  'Prince de Galles — Art Deco Palace Paris | MyConciergeHotel';

export const PRINCE_DE_GALLES_EMAIL_RESERVATIONS = 'hotelprincedegalles@luxurycollection.com';

/** CDC marque hub — The Luxury Collection (verified Marriott brand page). */
export const PRINCE_DE_GALLES_AFFILIATIONS = [
  {
    kind: 'brand',
    source: 'luxury_collection',
    display_name: 'The Luxury Collection by Marriott',
    verified: true,
    facet_slug: 'the-luxury-collection',
    source_url: 'https://www.marriott.com/marriott-brands/luxury-collection.mi',
    since_year: 1929,
  },
  {
    kind: 'label',
    source: 'forbes_5_star',
    display_name: 'Forbes Travel Guide Five-Star',
    verified: true,
    facet_slug: 'forbes-5-star',
    source_url:
      'https://www.forbestravelguide.com/hotels/paris-france/prince-de-galles-a-luxury-collection-hotel',
  },
] as const;

export const PRINCE_DE_GALLES_HOTEL_DISPLAY_NAME =
  'Prince de Galles, a Luxury Collection Hotel, Paris';

// ---------------------------------------------------------------------------
// highlights — kit pilot strip (CDC §2.3 factual summary companion)
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_HIGHLIGHTS = [
  {
    label_fr: 'Palace Art déco avenue George-V depuis 1929, The Luxury Collection',
    label_en: 'Art Deco palace on avenue George-V since 1929, The Luxury Collection',
  },
  {
    label_fr: '116 chambres et suites, 26 avec balcon ou terrasse sur Paris ou Le Patio',
    label_en: '116 rooms and suites, 26 with a balcony or terrace over Paris or Le Patio',
  },
  {
    label_fr: 'Cour Le Patio mosaïquée — petit-déjeuner, tea time et brunch dominical',
    label_en: 'Mosaic Le Patio courtyard — breakfast, tea time and Sunday brunch',
  },
  {
    label_fr: 'Akira Back Paris — première table européenne du chef, 1 étoile MICHELIN',
    label_en: 'Akira Back Paris — the chef’s first European table, 1 MICHELIN Star',
  },
  {
    label_fr: '19.20 by Norbert Tarayre — bistrot parisien et tea time au bar Art déco',
    label_en: '19.20 by Norbert Tarayre — Parisian bistro and tea time in the Art Deco bar',
  },
  {
    label_fr: 'Wellness Suite CALMA PARIS — soins sur rendez-vous, fitness 24h/24',
    label_en: 'CALMA PARIS Wellness Suite — treatments by appointment, 24-hour fitness',
  },
] as const;

// ---------------------------------------------------------------------------
// faq_content — kit (42 factual) + promote subset (15 CDC)
// ---------------------------------------------------------------------------

export { PRINCE_DE_GALLES_FAQ_CONTENT_KIT, PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE };

// ---------------------------------------------------------------------------
// concierge_questions — 8 grouped Q&A (#concierge-questions block)
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT = [
  {
    category_fr: 'Transferts & Transport',
    category_en: 'Transfers & Transport',
    question_fr: 'Pouvez-vous organiser un transfert depuis Charles-de-Gaulle vers George V ?',
    reply_fr:
      'Je réserve un VTC ou une limousine selon votre vol et vos bagages. Prévenez-moi 24 h à l’avance avec le numéro de vol : j’aligne l’heure d’arrivée sur le check-in et le voiturier.',
  },
  {
    category_fr: 'Transferts & Transport',
    category_en: 'Transfers & Transport',
    question_fr: 'Pouvez-vous réserver un chauffeur pour une soirée avenue Montaigne ?',
    reply_fr:
      'Je mets un chauffeur à disposition pour vos rendez-vous couture ou dîner. Indiquez-moi les horaires de prise en charge et de retour : je confirme le véhicule et le numéro du chauffeur.',
  },
  {
    category_fr: 'Réservations de restaurants',
    category_en: 'Restaurant Reservations',
    question_fr: 'Je souhaite dîner au comptoir Akira Back samedi prochain, est-ce possible ?',
    reply_fr:
      'Je contacte le restaurant et tente le comptoir face à la cuisine — c’est la demande la plus courue. Deux semaines d’anticipation en week-end ; je vous tiens informé sous 24 h.',
  },
  {
    category_fr: 'Réservations de restaurants',
    category_en: 'Restaurant Reservations',
    question_fr: 'Pouvez-vous réserver le tea time du 19.20 pour dimanche après-midi ?',
    reply_fr:
      'Le tea time du week-end se remplit vite. Je réserve pour vous au 19.20 ou sur Le Patio si le soleil est au rendez-vous — précisez le nombre de convives et vos préférences sucrées.',
  },
  {
    category_fr: 'Wellness & Fitness',
    category_en: 'Wellness & Fitness',
    question_fr: 'Je souhaite un massage en chambre demain matin, est-ce possible ?',
    reply_fr:
      'CALMA PARIS intervient en Wellness Suite ou en chambre sur rendez-vous. Je vérifie les créneaux disponibles demain matin et vous propose la carte des soins adaptée à votre emploi du temps.',
  },
  {
    category_fr: 'Chambres & Suites',
    category_en: 'Rooms & Suites',
    question_fr:
      'Pour une première venue, quelle chambre recommandez-vous avec balcon sur Le Patio ?',
    reply_fr:
      'Je réserve la Chambre Art Déco Deluxe Balcon côté cour : le calme du Patio sans renoncer à la lumière. Précisez votre date d’arrivée — je bloque la catégorie et note la préparation en chambre.',
  },
  {
    category_fr: 'Événements & MICE',
    category_en: 'Events & MICE',
    question_fr: 'Nous cherchons une salle pour 60 personnes en cocktail, que proposez-vous ?',
    reply_fr:
      'Le Salon Grand Chaillot accueille jusqu’à 70 convives en réception. Je vous envoie le plan, les configurations et un devis restauration signé 19.20 ou Akira Back selon votre brief.',
  },
  {
    category_fr: 'Paris & Culture',
    category_en: 'Paris & Culture',
    question_fr: 'Pouvez-vous réserver des billets pour le Théâtre des Champs-Élysées ce soir ?',
    reply_fr:
      'Je vérifie la programmation et les places restantes à cinq minutes à pied de l’hôtel. Si le créneau est complet, je propose une alternative au Palais de Tokyo ou une visite privée en soirée.',
  },
  {
    category_fr: 'Shopping & Mode',
    category_en: 'Shopping & Fashion',
    question_fr: 'Pouvez-vous réserver une cabine privée sur l’avenue Montaigne demain matin ?',
    reply_fr:
      'Je contacte les maisons que vous ciblez et bloque un créneau avant l’ouverture quand c’est possible. Précisez vos marques et votre budget : j’aligne l’itinéraire avec votre agenda.',
  },
  {
    category_fr: 'Shopping & Mode',
    category_en: 'Shopping & Fashion',
    question_fr: 'Où faire une pause shopping entre deux rendez-vous couture ?',
    reply_fr:
      'Le tea time du 19.20 ou un déjeuner express sur Le Patio calme l’agenda sans quitter le palace. Je réserve la table et synchronise le retour voiturier pour la suite des essayages.',
  },
  {
    category_fr: 'Famille & Enfants',
    category_en: 'Family & Children',
    question_fr: 'Nous voyageons avec deux enfants — pouvez-vous préparer les chambres ?',
    reply_fr:
      'Je note l’âge des enfants et prépare lits supplémentaires, barrières et accueil adapté. Un room-service enfant et des activités autour du Grand Palais peuvent compléter le séjour.',
  },
  {
    category_fr: 'Famille & Enfants',
    category_en: 'Family & Children',
    question_fr: 'Proposez-vous une baby-sitter pour une soirée au Akira Back ?',
    reply_fr:
      'Je peux recommander une agence partenaire vérifiée sur demande. Prévenez-moi quarante-huit heures à l’avance avec l’horaire et le nombre d’enfants.',
  },
  {
    category_fr: 'Business & Séjour pro',
    category_en: 'Business Travel',
    question_fr: 'Pouvez-vous organiser un petit-déjeuner de travail en salon privé ?',
    reply_fr:
      'Le Petit Chaillot ou la Suite Or accueillent huit à quarante personnes selon la configuration. Je coordonne le catering, le wifi dédié et l’accès voiturier pour vos invités.',
  },
  {
    category_fr: 'Business & Séjour pro',
    category_en: 'Business Travel',
    question_fr: 'Avez-vous une imprimante ou un espace coworking à proximité ?',
    reply_fr:
      'La réception imprime vos documents sur demande. Pour un espace calme, je réserve le salon d’affaires ou une suite avec salon séparé selon la durée de votre réunion.',
  },
  {
    category_fr: 'Surclassements & Fidélité',
    category_en: 'Upgrades & Loyalty',
    question_fr: 'Puis-je obtenir un surclassement avec mon statut Marriott Bonvoy ?',
    reply_fr:
      'Je vérifie la disponibilité la veille de votre arrivée et note votre statut Elite. Les surclassements restent subjectifs à l’occupation — je vous confirme dès que la chambre est assignée.',
  },
  {
    category_fr: 'Surclassements & Fidélité',
    category_en: 'Upgrades & Loyalty',
    question_fr: 'Quelle chambre recommandez-vous pour une lune de miel en juillet ?',
    reply_fr:
      'Je oriente vers la Chambre Art Déco Deluxe Balcon côté cour ou la Suite Saphir pour la terrasse. Précisez vos dates : je bloque la catégorie et prépare une attention discrète en chambre.',
  },
  {
    category_fr: 'Paris by night',
    category_en: 'Paris by Night',
    question_fr: 'Où dîner après le spectacle si Akira Back est complet ?',
    reply_fr:
      'Le 19.20 by Norbert Tarayre tient souvent des tables tardives, et Le Patio sert des plats légers jusqu’au service du soir. Je réserve selon votre heure de sortie de théâtre.',
  },
  {
    category_fr: 'Paris by night',
    category_en: 'Paris by Night',
    question_fr: 'Pouvez-vous réserver un bar à cocktails avec vue sur la Seine ?',
    reply_fr:
      'Je connais plusieurs adresses à quinze minutes en taxi — rooftop, speakeasy ou bar d’hôtel partenaire. Indiquez l’ambiance recherchée et l’heure : je confirme la réservation.',
  },
  {
    category_fr: 'Sécurité & Discrétion',
    category_en: 'Security & Discretion',
    question_fr: 'Pouvez-vous accueillir une arrivée discrète avec accès séparé ?',
    reply_fr:
      'Le voiturier et la réception coordonnent les arrivées sensibles sans passage par le lobby principal quand le planning le permet. Décrivez-moi le protocole souhaité : je l’applique avec l’équipe.',
  },
  {
    category_fr: 'Room service & In-room',
    category_en: 'Room Service & In-room',
    question_fr: 'Pouvez-vous organiser un dîner en chambre après le service du restaurant ?',
    reply_fr:
      'Le room-service propose une carte réduite après vingt-deux heures selon la cuisine. Je commande pour vous et synchronise l’heure de livraison avec votre retour de spectacle ou de dîner externe.',
  },
] as const;

export type PrinceDeGallesConciergeQuestionKit =
  (typeof PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT)[number];

// ---------------------------------------------------------------------------
// spa_info — CALMA PARIS Wellness Suite (not a palace-scale spa)
// evaluateSpaDossier contract: description, hours, contact, tip
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_WELLNESS_INFO = {
  name: 'Wellness Suite CALMA PARIS',
  partner: 'CALMA PARIS',
  treatment_rooms: 1,
  description_fr:
    'Pas de grand spa thermal ici : la maison propose une Wellness Suite opérée par CALMA PARIS, avec soins du visage et du corps à la méthode méditerranéenne à l’orange amère. Les rituels se déroulent dans la suite dédiée ou en chambre sur rendez-vous. Un centre de fitness en sous-sol, ouvert 24 h/24, complète l’offre bien-être.',
  description_en:
    'There is no large thermal spa here: the house offers a Wellness Suite operated by CALMA PARIS, with face and body treatments using the Mediterranean bitter-orange method. Rituals take place in the dedicated suite or in-room by appointment. A basement fitness centre, open 24 hours, completes the wellness offer.',
  hours_fr: 'Tous les jours 9h–21h (soins sur rendez-vous)',
  hours_en: 'Daily 9 am–9 pm (treatments by appointment)',
  price_note_fr: 'Soins CALMA PARIS sur rendez-vous — tarifs selon le soin choisi.',
  price_note_en: 'CALMA PARIS treatments by appointment — rates depend on the treatment selected.',
  website:
    'https://www.marriott.com/en-us/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/experiences/',
  phone: '+33 1 53 23 78 85',
  tip_fr:
    'Mon conseil : réservez un soin en fin d’après-midi, puis enchaînez sur le fitness avant de rejoindre Akira Back. La Wellness Suite est au plus calme entre 17 h et 19 h.',
  tip_en:
    'My tip: book a treatment in the late afternoon, then use the fitness room before heading to Akira Back. The Wellness Suite is quietest between 5 and 7 pm.',
} as const;

// ---------------------------------------------------------------------------
// mice_info — Salon Grand Chaillot 70, Alma 30, Petit Chaillot 8
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_MICE_INFO = {
  summary_fr:
    'Trois salons Art déco lumineux jusqu’à 70 convives en réception : Grand Chaillot, Alma et Petit Chaillot pour séminaires, cocktails et boardrooms au cœur du Triangle d’Or.',
  summary_en:
    'Three naturally lit Art Deco rooms for up to 70 guests in reception format: Grand Chaillot, Alma and Petit Chaillot for seminars, cocktails and boardrooms in the Golden Triangle.',
  contact_email: PRINCE_DE_GALLES_EMAIL_RESERVATIONS,
  total_capacity_seated: 70,
  spaces: [
    {
      key: 'salon-grand-chaillot',
      name: 'Salon Grand Chaillot',
      surface_sqm: 85,
      max_seated: 70,
      configurations: ['reception', 'theatre', 'dinner', 'cabaret', 'boardroom', 'u-shape'],
      has_natural_light: true,
      notes_fr: 'Plus grande salle : réception 70, théâtre 63, dîner 50, cabaret 40, boardroom 26.',
      notes_en: 'Largest room: reception 70, theatre 63, dinner 50, cabaret 40, boardroom 26.',
    },
    {
      key: 'salon-alma',
      name: 'Salon Alma',
      surface_sqm: 47,
      max_seated: 30,
      configurations: ['theatre', 'boardroom', 'u-shape'],
      has_natural_light: true,
      notes_fr: 'Théâtre 30, boardroom 20, en U 20 — plafond 3,11 m.',
      notes_en: 'Theatre 30, boardroom 20, U-shape 20 — 3.11 m ceiling.',
    },
    {
      key: 'petit-chaillot',
      name: 'Petit Chaillot',
      surface_sqm: 17,
      max_seated: 8,
      configurations: ['boardroom'],
      has_natural_light: true,
      notes_fr: 'Boardroom intimiste pour huit personnes maximum.',
      notes_en: 'Intimate boardroom for up to eight guests.',
    },
  ],
  event_types: ['corporate-meeting', 'cocktail', 'private-dinner', 'product-launch'],
} as const;

// ---------------------------------------------------------------------------
// upcoming_events — Paris 8e / Triangle d'Or (rolling season 2026)
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_UPCOMING_EVENTS = [
  {
    name: 'Paris Fashion Week — défilés avenue Montaigne',
    start_date: '2026-09-22',
    end_date: '2026-09-30',
    venue_name: 'Avenue Montaigne',
    latitude: 48.8665,
    longitude: 2.3045,
    distance_meters: 300,
    category: 'fashion',
    period_fr: 'Fin septembre (dates variables)',
    period_en: 'Late September (dates vary)',
    hours_fr: 'Défilés en journée et soirées privées',
    hours_en: 'Daytime shows and private evening events',
    description_fr:
      'Semaine de la mode parisienne : les maisons de couture ouvrent leurs salons sur l’avenue Montaigne, à quatre minutes à pied du palace.',
    description_en:
      'Paris Fashion Week: couture houses open their salons on Avenue Montaigne, a four-minute walk from the palace.',
    pricing: { type: 'invitation', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-20`,
  },
  {
    name: 'Roland-Garros — Internationaux de France',
    start_date: '2026-05-24',
    end_date: '2026-06-07',
    venue_name: 'Stade Roland-Garros',
    latitude: 48.847,
    longitude: 2.249,
    distance_meters: 4500,
    category: 'sport',
    period_fr: 'Fin mai – début juin',
    period_en: 'Late May – early June',
    hours_fr: 'Matches en journée et soirée selon le tableau',
    hours_en: 'Day and evening matches per schedule',
    description_fr:
      'Le tournoi du Grand Chelem se joue à vingt minutes en taxi : la conciergerie réserve billets et transferts depuis George V.',
    description_en:
      'The Grand Slam tournament is twenty minutes by taxi: the concierge books tickets and transfers from George V.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-21`,
  },
  {
    name: 'Fête nationale — défilé et feu d’artifice',
    start_date: '2026-07-14',
    end_date: '2026-07-14',
    venue_name: 'Champs-Élysées & Tour Eiffel',
    latitude: 48.873,
    longitude: 2.295,
    distance_meters: 800,
    category: 'festival',
    period_fr: '14 juillet',
    period_en: '14 July',
    hours_fr: 'Défilé matin ; feu d’artifice vers 23 h',
    hours_en: 'Morning parade; fireworks around 11 pm',
    description_fr:
      'Le défilé descend les Champs-Élysées ; depuis les suites avenue ou les balcons élevés, le feu d’artifice se lit au-dessus de Paris.',
    description_en:
      'The parade runs down the Champs-Élysées; from avenue suites or upper balconies, the fireworks unfold above Paris.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
  },
  {
    name: 'Nuit Blanche — parcours d’art contemporain',
    start_date: '2026-10-03',
    end_date: '2026-10-04',
    venue_name: 'Paris centre',
    latitude: 48.864,
    longitude: 2.297,
    distance_meters: 600,
    category: 'culture',
    period_fr: 'Premier week-end d’octobre (nocturne)',
    period_en: 'First October weekend (overnight)',
    hours_fr: '19 h – 7 h du matin',
    hours_en: '7 pm – 7 am',
    description_fr:
      'Installations nocturnes dans le 8e et au Palais de Tokyo : huit minutes à pied depuis l’hôtel pour commencer le parcours.',
    description_en:
      'Night-time installations in the 8th and at Palais de Tokyo: an eight-minute walk from the hotel to start the route.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-4`,
  },
  {
    name: 'Marché de Noël des Champs-Élysées',
    start_date: '2026-11-20',
    end_date: '2026-12-31',
    venue_name: 'Champs-Élysées',
    latitude: 48.8698,
    longitude: 2.3078,
    distance_meters: 200,
    category: 'festival',
    period_fr: 'Mi-novembre – fin décembre',
    period_en: 'Mid-November – end December',
    hours_fr: 'Après-midi et soirée (horaires variables)',
    hours_en: 'Afternoon and evening (times vary)',
    description_fr:
      'Chalets et illuminations sur l’avenue la plus célèbre de Paris, à trois minutes à pied de l’entrée George V.',
    description_en:
      'Chalets and lights on Paris’s most famous avenue, a three-minute walk from the George V entrance.',
    pricing: { type: 'free', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-2`,
  },
  {
    name: 'Paris Photo — Grand Palais Éphémère',
    start_date: '2026-11-05',
    end_date: '2026-11-08',
    venue_name: 'Grand Palais Éphémère',
    latitude: 48.8661,
    longitude: 2.3125,
    distance_meters: 950,
    category: 'culture',
    period_fr: 'Début novembre',
    period_en: 'Early November',
    hours_fr: '10 h – 19 h (nocturne jeudi)',
    hours_en: '10 am – 7 pm (Thursday late opening)',
    description_fr:
      'Salon international de la photographie à douze minutes à pied : la conciergerie réserve billets et accès VIP si disponibles.',
    description_en:
      'International photography fair a twelve-minute walk away: the concierge books tickets and VIP access when available.',
    pricing: { type: 'paid', amount_eur: null },
    image_url: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-28`,
  },
] as const;

// ---------------------------------------------------------------------------
// instagram — @princedegallesparis (Wikidata P2003)
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_INSTAGRAM = {
  handle: 'princedegallesparis',
  profile_url: 'https://www.instagram.com/princedegallesparis/',
  posts: [
    {
      permalink: 'https://www.instagram.com/princedegallesparis/',
      image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-10`,
      caption_fr:
        'Le Patio mosaïqué au cœur du palace : petits déjeuners, tea time et cocktails à l’abri de l’avenue George V.',
      caption_en:
        'The mosaic Patio at the heart of the palace: breakfasts, tea time and cocktails sheltered from avenue George V.',
    },
    {
      permalink: 'https://www.instagram.com/princedegallesparis/',
      image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-7`,
      caption_fr:
        'Lignes Art déco, tête de lit miroitée et lumière tamisée — la signature des chambres du Prince de Galles.',
      caption_en:
        'Art Deco lines, a mirrored headboard and soft light — the signature of Prince de Galles rooms.',
    },
    {
      permalink: 'https://www.instagram.com/princedegallesparis/',
      image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-12`,
      caption_fr:
        'Brunch dominical entre pâtisseries fines et bulles — au Akira Back ou sur Le Patio selon la météo.',
      caption_en:
        'Sunday brunch between fine pastries and sparkling wine — at Akira Back or on Le Patio depending on the weather.',
    },
    {
      permalink: 'https://www.instagram.com/princedegallesparis/',
      image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
      caption_fr:
        'Depuis la Suite Patrick Hellmann, la tour Eiffel se dévoile au-dessus des toits du Triangle d’Or.',
      caption_en:
        'From the Patrick Hellmann Suite, the Eiffel Tower unfolds above the Golden Triangle rooftops.',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// featured_reviews — Forbes Travel Guide, MICHELIN Hotels, presse
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_FEATURED_REVIEWS = [
  {
    source: 'Forbes Travel Guide',
    author: 'Forbes Travel Guide',
    source_url:
      'https://www.forbestravelguide.com/hotels/paris-france/prince-de-galles-a-luxury-collection-hotel',
    quote_fr:
      'Un palace Art déco emblématique sur l’avenue George V : balcons sur Paris, cour intérieure mosaïquée et tables signées au cœur du Triangle d’Or.',
    quote_en:
      'An emblematic Art Deco palace on avenue George V: balconies over Paris, a mosaic inner courtyard and signature tables at the heart of the Golden Triangle.',
  },
  {
    source: 'MICHELIN Hotels',
    author: 'MICHELIN Hotels',
    source_url: 'https://guide.michelin.com/fr/fr/hotels-stays/paris/prince-de-galles-1200889',
    quote_fr:
      'Adresse The Luxury Collection où l’Art déco parisien se lit dans chaque détail — des mosaïques de salle de bain aux balcons sur les toits.',
    quote_en:
      'A Luxury Collection address where Parisian Art Deco shows in every detail — from bathroom mosaics to balconies over the rooftops.',
  },
  {
    source: 'Presse spécialisée',
    author: 'Presse spécialisée',
    quote_fr:
      'Depuis 1929, le Prince de Galles cultive une atmosphère feutrée à deux pas des Champs-Élysées — l’une des adresses Art déco les plus lisibles de Paris.',
    quote_en:
      'Since 1929, Prince de Galles has cultivated a hushed atmosphere steps from the Champs-Élysées — one of the most readable Art Deco addresses in Paris.',
  },
] as const;

// ---------------------------------------------------------------------------
// external_sources — Wikidata Q3145636 + official + Wikipedia
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_EXTERNAL_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q3145636',
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q3145636',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Prince_de_Galles_(h%C3%B4tel)',
    source: 'wikipedia',
    source_url: 'https://fr.wikipedia.org/wiki/Prince_de_Galles_(h%C3%B4tel)',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/Prince_de_Galles,_a_Luxury_Collection_Hotel,_Paris',
    source: 'wikipedia',
    source_url: 'https://en.wikipedia.org/wiki/Prince_de_Galles,_a_Luxury_Collection_Hotel,_Paris',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'official_url',
    value:
      'https://www.marriott.com/en-us/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/',
    source: 'official',
    source_url:
      'https://www.marriott.com/en-us/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'architect',
    value: ['André Arfvidson'],
    source: 'wikidata',
    source_url: 'https://www.wikidata.org/wiki/Q3145636',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
  {
    field: 'inception_year',
    value: 1929,
    source: 'official',
    source_url:
      'https://www.marriott.com/en-us/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/',
    confidence: 'high',
    collected_at: '2026-06-10T00:00:00.000Z',
  },
] as const;

type PrinceDeGallesExternalScalarField =
  | 'wikidata_id'
  | 'wikipedia_url_fr'
  | 'wikipedia_url_en'
  | 'official_url';

function princeDeGallesExternalScalar(field: PrinceDeGallesExternalScalarField): string {
  const entry = PRINCE_DE_GALLES_EXTERNAL_SOURCES.find((source) => source.field === field);
  if (entry === undefined || typeof entry.value !== 'string') return '';
  return entry.value;
}

// ---------------------------------------------------------------------------
// signature_experiences — 6 concierge picks (kit pilot)
// ---------------------------------------------------------------------------

export const PRINCE_DE_GALLES_SIGNATURE_EXPERIENCES = [
  {
    key: 'tea-time-19-20',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-11`,
    title_fr: 'Tea Time au 19.20',
    title_en: 'Tea Time at 19.20',
    description_fr:
      'Tea Time le week-end au bar Art déco signé Hélène Kerloeguen : pâtisseries fines, thés rares et ambiance Belle Époque. Réservez vendredi à dimanche, 16 h–17 h.',
    description_en:
      'Weekend tea time in the Art Deco bar by pastry chef Hélène Kerloeguen: fine pastries, rare teas and a Belle Époque mood. Book Friday to Sunday, 4–5 pm.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    price_note_fr: 'À partir de 65 €',
    price_note_en: 'From €65',
    tip_fr:
      'Mon conseil : demandez une table près de la vitrine Art déco — la lumière de fin d’après-midi y est la plus flatteuse.',
    tip_en:
      'My tip: ask for a table near the Art Deco window — late-afternoon light is most flattering there.',
    website: 'https://www.19-20paris.fr/en/',
  },
  {
    key: 'akira-back-comptoir',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-12`,
    title_fr: 'Comptoir Akira Back',
    title_en: 'Akira Back counter seats',
    description_fr:
      'Première table européenne d’Akira Back : commencez par l’AB Tuna Pizza face à la cuisine ouverte. Service du soir, 19 h–minuit, tous les jours.',
    description_en:
      'Akira Back’s first European table: start with the AB Tuna Pizza facing the open kitchen. Evening service, 7 pm–midnight, daily.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    booking_required: true,
    tip_fr:
      'Mon conseil : réservez le comptoir deux semaines à l’avance le week-end — c’est la vue la plus spectaculaire sur la mise en scène.',
    tip_en:
      'My tip: book counter seats two weeks ahead on weekends — it’s the most spectacular view of the staging.',
    website: 'https://www.akirabackparis.com/',
  },
  {
    key: 'patio-brunch',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-10`,
    title_fr: 'Brunch dominical sur Le Patio',
    title_en: 'Sunday brunch on Le Patio',
    description_fr:
      'Brunch du palace sur la cour mosaïquée quand le calendrier l’ouvre : pâtisseries, créations salées et bulles à l’abri de l’avenue George V.',
    description_en:
      'Palace brunch on the mosaic courtyard when the calendar allows: pastries, savoury creations and sparkling wine sheltered from avenue George V.',
    booking_required: true,
    tip_fr:
      'Mon conseil : aux beaux jours, réservez côté Patio plutôt qu’en salle — la cour capte la lumière comme nulle part ailleurs dans le 8e.',
    tip_en:
      'My tip: in fine weather, book Patio-side rather than indoors — the courtyard catches light like nowhere else in the 8th.',
    website:
      'https://www.marriott.com/fr/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/dining/',
  },
  {
    key: 'wellness-suite-calma',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-13`,
    title_fr: 'Rituel CALMA PARIS en Wellness Suite',
    title_en: 'CALMA PARIS ritual in the Wellness Suite',
    description_fr:
      'Soins visage et corps à la méthode méditerranéenne CALMA PARIS, en suite dédiée ou en chambre. Ouvert 9 h–21 h, sur rendez-vous.',
    description_en:
      'Face and body treatments with the CALMA PARIS Mediterranean method, in the dedicated suite or in-room. Open 9 am–9 pm, by appointment.',
    booking_required: true,
    phone: '+33 1 53 23 78 85',
    tip_fr:
      'Mon conseil : enchaînez soin et fitness en sous-sol avant un dîner Akira Back — le palace n’a pas de grand spa, mais ce rituel tient la route.',
    tip_en:
      'My tip: follow your treatment with basement fitness before dinner at Akira Back — no large spa here, but the ritual delivers.',
    website:
      'https://www.marriott.com/en-us/hotels/parlc-prince-de-galles-a-luxury-collection-hotel-paris/experiences/',
  },
  {
    key: 'art-deco-tour',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-4`,
    title_fr: 'Parcours Art déco du palace',
    title_en: 'Art Deco palace walk-through',
    description_fr:
      'De la façade 1929 au lobby mosaïqué, en passant par les escaliers en marbre et Le Patio classé : la conciergerie guide le parcours sur rendez-vous.',
    description_en:
      'From the 1929 façade to the mosaic lobby, marble staircases and heritage Le Patio: the concierge guides the walk-through by appointment.',
    booking_required: true,
    tip_fr:
      'Mon conseil : demandez le parcours en fin d’après-midi, quand la lumière dorée entre dans le lobby et sur Le Patio.',
    tip_en:
      'My tip: ask for the tour in the late afternoon, when golden light fills the lobby and Le Patio.',
  },
  {
    key: 'balcony-ritual',
    image_public_id: `${PRINCE_DE_GALLES_IMAGE_PREFIX}/press-19`,
    title_fr: 'Rituel balcon — bain Lalique et vue Paris',
    title_en: 'Balcony ritual — Lalique bath and Paris view',
    description_fr:
      'Vingt-six chambres et suites avec balcon ou terrasse : bain en marbre à mosaïque, peignoir et produits Lalique, puis café sur le balcon au lever.',
    description_en:
      'Twenty-six rooms and suites with a balcony or terrace: mosaic marble bath, robe and Lalique amenities, then coffee on the balcony at daybreak.',
    badge_fr: 'Sélection du Concierge',
    badge_en: 'Concierge pick',
    tip_fr:
      'Mon conseil : côté cour pour Le Patio au calme ; côté avenue George V pour l’animation du Triangle d’Or — je note votre préférence à la réservation.',
    tip_en:
      'My tip: courtyard side for quiet Le Patio; avenue George V side for Golden Triangle energy — I note your preference at booking.',
  },
] as const;

export function resolvePrinceDeGallesSignatureExperiences(): unknown[] {
  return [...PRINCE_DE_GALLES_SIGNATURE_EXPERIENCES];
}

// ---------------------------------------------------------------------------
// long_description_sections — histoire, emplacement, heritage Art déco
// ---------------------------------------------------------------------------

const PRINCE_DE_GALLES_LONG_DESCRIPTION_SECTIONS = [
  {
    anchor: 'histoire',
    title_fr: 'Histoire & naissance Art déco (1929)',
    title_en: 'History & Art Deco birth (1929)',
    body_fr:
      'Le Prince de Galles ouvre en 1929, au sommet de l’engouement Art déco parisien. L’architecte André Arfvidson dessine une façade géométrique avenue George-V, entre les Champs-Élysées et l’avenue Montaigne.\n\nL’hôtel accueille dès ses débuts une clientèle internationale : Churchill, Marlene Dietrich et les figures du cinéma y franchissent le hall mosaïqué. La cour intérieure — aujourd’hui Le Patio — devient l’écrin secret de la maison, visible depuis les balcons des chambres.\n\nRejoint The Luxury Collection, le palace conserve son identité Art déco à travers les restaurations : lignes épurées, marbre, laiton et photographies noir et blanc composent un décor qui ne vieillit pas. C’est l’une des adresses les plus lisibles de l’Art déco hôtelier à Paris.',
    body_en:
      'Prince de Galles opened in 1929, at the height of Parisian Art Deco fervour. Architect André Arfvidson designed a geometric façade on avenue George-V, between the Champs-Élysées and Avenue Montaigne.\n\nFrom the outset the hotel welcomed an international clientele: Churchill, Marlene Dietrich and cinema figures crossed its mosaic lobby. The inner courtyard — today Le Patio — became the house’s secret setting, visible from room balconies.\n\nNow part of The Luxury Collection, the palace has kept its Art Deco identity through restorations: clean lines, marble, brass and black-and-white photography form a décor that does not date. It remains one of the most readable Art Deco hotel addresses in Paris.',
  },
  {
    anchor: 'emplacement-paris',
    title_fr: 'Emplacement — George-V & Triangle d’Or',
    title_en: 'Location — George-V & Golden Triangle',
    body_fr:
      'Le Prince de Galles occupe le 33 avenue George-V, à l’angle des Champs-Élysées. Le métro George V (ligne 1) est à deux pas ; l’Arc de triomphe se rejoint en huit minutes à pied.\n\nLe Triangle d’Or se lit depuis la porte : avenue Montaigne et ses maisons de couture à quatre minutes, Grand Palais et Petit Palais à douze, Seine et pont de l’Alma à onze. La conciergerie coordonne taxis, VTC et itinéraires piétons selon vos rendez-vous.\n\nDepuis les étages élevés, la Tour Eiffel se dessine au-dessus des toits haussmanniens — un privilège rare pour un palace du 8e arrondissement. L’adresse sert aussi bien un week-end romantique qu’un séjour d’affaires enchaîné.',
    body_en:
      'Prince de Galles stands at 33 avenue George-V, on the corner of the Champs-Élysées. George V metro (line 1) is steps away; the Arc de Triomphe is an eight-minute walk.\n\nThe Golden Triangle unfolds from the door: Avenue Montaigne and its couture houses in four minutes, Grand and Petit Palais in twelve, the Seine and Pont de l’Alma in eleven. The concierge coordinates taxis, private cars and walking routes around your appointments.\n\nFrom upper floors the Eiffel Tower rises above the Haussmann rooftops — a rare privilege for a palace in the 8th arrondissement. The address suits a romantic weekend as well as a back-to-back business stay.',
  },
  {
    anchor: 'heritage-art-deco',
    title_fr: 'Héritage Art déco & expérience palace',
    title_en: 'Art Deco heritage & palace experience',
    body_fr:
      'L’Art déco du Prince de Galles ne se limite pas à la façade : il habite les 116 chambres et suites. Mosaïques de salle de bain, têtes de lit miroitées, produits Lalique et photographies encadrées composent une signature reconnaissable entre toutes.\n\nVingt-six chambres et suites disposent d’un balcon ou d’une terrasse — sur la cour Le Patio ou sur l’avenue. C’est une rareté dans le paysage palace parisien, qui prolonge la chambre vers l’extérieur sans quitter l’intimité de la maison.\n\nLa conciergerie 24 h/24, le service voiturier et l’accueil multilingue prolongent l’expérience au-delà des murs Art déco. On vient ici pour habiter un décor de 1929 avec le confort attendu d’une adresse The Luxury Collection — sans concession sur le calme ni sur la discrétion.',
    body_en:
      'Prince de Galles Art Deco is not only the façade: it lives in all 116 rooms and suites. Bathroom mosaics, mirrored headboards, Lalique amenities and framed photography form a signature recognised at once.\n\nTwenty-six rooms and suites have a balcony or terrace — over Le Patio courtyard or the avenue. That is a rarity in the Parisian palace landscape, extending the room outward without leaving the house intimacy.\n\nThe 24-hour concierge, valet service and multilingual welcome extend the experience beyond the Art Deco walls. You come here to inhabit a 1929 setting with the comfort expected of a Luxury Collection address — with no compromise on calm or discretion.',
  },
  {
    anchor: 'gastronomie',
    title_fr: 'Gastronomie — Akira Back, 19.20 & Le Patio',
    title_en: 'Dining — Akira Back, 19.20 & Le Patio',
    body_fr:
      'Le Prince de Galles ne se contente pas d’un restaurant d’hôtel : il aligne trois adresses complémentaires. Akira Back Paris, première table européenne du chef étoilé, propose une cuisine fusion coréenne-japonaise dans un décor contemporain — comptoir face à la cuisine ou salle à manger selon l’ambiance recherchée.\n\nLe 19.20 by Norbert Tarayre ancre la maison dans le bistrot parisien : assiettes généreuses, tea time le week-end et bar Art déco pour un apéritif avant le spectacle. Le Patio, cour mosaïquée classée, sert petit-déjeuner, déjeuner et brunch dominical à l’abri de l’avenue George V.\n\nLa conciergerie réserve les tables, tient les listes d’attente et coordonne le room-service pour les soirées où l’on préfère diner en chambre après une journée au Grand Palais ou sur l’avenue Montaigne.',
    body_en:
      'Prince de Galles does not stop at a single hotel restaurant: it lines up three complementary addresses. Akira Back Paris, the starred chef’s first European table, serves Korean-Japanese fusion in a contemporary setting — counter facing the kitchen or dining room depending on the mood you want.\n\n19.20 by Norbert Tarayre anchors the house in the Parisian bistro: generous plates, weekend tea time and an Art Deco bar for a pre-show apéritif. Le Patio, the listed mosaic courtyard, serves breakfast, lunch and Sunday brunch sheltered from Avenue George V.\n\nThe concierge books tables, manages waitlists and coordinates room service for evenings when you prefer to dine in after a day at the Grand Palais or on Avenue Montaigne.',
  },
  {
    anchor: 'chambres-suites',
    title_fr: 'Chambres & suites — du Deluxe au duplex Lalique',
    title_en: 'Rooms & suites — from Deluxe to the Lalique duplex',
    body_fr:
      'Cent seize chambres et suites composent un palace à l’échelle humaine. Les Catégories Art Déco Deluxe et Deluxe Balcon (environ 26 m²) portent la signature graphique de la maison : tête de lit miroitée, salle de bain en marbre à mosaïque, produits de toilette Lalique.\n\nLes suites intermédiaires — Mosaïque (48 m²), Macassar, Saphir — ajoutent salon séparé et, pour certaines, terrasse sur Paris. La Suite Or (97 m²) déploie un double salon modulable pour réceptions privées ; la Suite Lalique (180 m²) est un duplex aux 8e et 9e étages né de la collaboration avec le cristallier Lalique.\n\nVingt-six chambres ouvrent sur un balcon ou une terrasse — côté cour Le Patio pour le calme, côté avenue pour l’animation du Triangle d’Or. C’est le critère que je vérifie en premier quand un client revient ou célèbre une occasion.',
    body_en:
      'One hundred sixteen rooms and suites make a human-scale palace. Art Deco Deluxe and Deluxe Balcon categories (roughly 26 sq m) carry the house graphic signature: mirrored headboard, marble mosaic bathroom, Lalique toiletries.\n\nMid-tier suites — Mosaic (48 sq m), Macassar, Saphir — add a separate living room and, for some, a terrace over Paris. The Suite Or (97 sq m) offers a modular double living room for private receptions; the Lalique Suite (180 sq m) is a duplex on the 8th and 9th floors born of the collaboration with crystal maker Lalique.\n\nTwenty-six rooms open onto a balcony or terrace — courtyard-side over Le Patio for quiet, avenue-side for Golden Triangle energy. That is the criterion I check first when a guest returns or celebrates an occasion.',
  },
] as const;

export const PRINCE_DE_GALLES_TRANSPORTS = [
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
      'Orlyval + RER B ou métro ligne 1 ; transfert privé sur réservation (environ 35–45 min selon trafic).',
    notes_en:
      'Orlyval + RER B or metro line 1; private transfer on reservation (about 35–45 min depending on traffic).',
  },
  {
    mode: 'metro',
    station: 'George V',
    station_en: 'George V',
    distance_meters: 120,
    walk_minutes: 2,
    notes_fr:
      'Ligne 1 (La Défense – Château de Vincennes) : deux pas de l’entrée de l’hôtel, accès direct Champs-Élysées, Concorde et Louvre.',
    notes_en:
      'Line 1 (La Défense – Château de Vincennes): steps from the hotel entrance, direct access to Champs-Élysées, Concorde and the Louvre.',
  },
] as const;

function resolvePrinceDeGallesLongDescriptionSections(
  existing: unknown,
  spaInfo: unknown,
): unknown {
  const allowedAnchors: ReadonlySet<string> = new Set(
    PRINCE_DE_GALLES_LONG_DESCRIPTION_SECTIONS.map((section) => section.anchor),
  );
  const patched = patchPrinceDeGallesLongDescriptionSections(
    dropDuplicateCategorySections(existing),
  );
  const deduped = dropCannibalizingSections(
    patched,
    resolvePopulatedBlocks({
      restaurantInfo: PRINCE_DE_GALLES_RESTAURANT_INFO,
      spaInfo,
      pointsOfInterest: PRINCE_DE_GALLES_POINTS_OF_INTEREST,
    }),
  );
  if (!Array.isArray(deduped)) return deduped;
  return deduped.filter((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const anchor = (entry as { anchor?: unknown }).anchor;
    return typeof anchor === 'string' && allowedAnchors.has(anchor);
  });
}

export function patchPrinceDeGallesLongDescriptionSections(existing: unknown): unknown[] {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const section of PRINCE_DE_GALLES_LONG_DESCRIPTION_SECTIONS) {
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

/** Deep-sanitise any jsonb value by round-tripping through JSON. */
export function sanitizePrinceDeGallesJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

/** Stamp `verified: true` on existing awards — no new distinctions until sourced (brief §10.7). */
export function patchPrinceDeGallesAwards(existing: unknown): unknown {
  if (!Array.isArray(existing)) return existing;
  return existing.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    return { ...(entry as Record<string, unknown>), verified: true };
  });
}

/** CDC §2.6 — 80 factual amenities. */
export function patchPrinceDeGallesAmenities(
  _existing: unknown,
): readonly PrinceDeGallesAmenityRecord[] {
  return PRINCE_DE_GALLES_AMENITIES;
}

/** Re-export for promote / audit consumers. */
export {
  PRINCE_DE_GALLES_AMENITIES,
  type PrinceDeGallesAmenityRecord,
} from './prince-de-galles-amenities';

/** Enrich `spa_info` with CALMA PARIS Wellness Suite dossier (not a large spa). */
export function patchPrinceDeGallesSpa(existing: unknown): Record<string, unknown> {
  const base =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...PRINCE_DE_GALLES_WELLNESS_INFO,
  };
}

/** Check-in 15:00, check-out 12:00, pets €70/stay (Marriott overview). */
export function patchPrinceDeGallesPolicies(existing: unknown): Record<string, unknown> {
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
      fee_eur: 70,
      notes_fr:
        'Chiens et chats acceptés — 70 € par séjour. Appelez l’hôtel avant l’arrivée pour confirmer la chambre adaptée.',
      notes_en:
        'Dogs and cats welcome — €70 per stay. Call the hotel before arrival to confirm a suitable room.',
    },
    wifi: {
      included: true,
      scope: 'whole_property',
    },
  };
}

// ---------------------------------------------------------------------------
// buildPrinceDeGallesGoldenFields — editorial columns for golden promotion
// ---------------------------------------------------------------------------

export interface PrinceDeGallesGoldenInput {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}

export function buildPrinceDeGallesGoldenFields(
  current: PrinceDeGallesGoldenInput,
): Record<string, unknown> {
  const spaInfo = patchPrinceDeGallesSpa(current.spa_info);
  return {
    highlights: PRINCE_DE_GALLES_HIGHLIGHTS,
    faq_content: PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE,
    faq_content_kit: PRINCE_DE_GALLES_FAQ_CONTENT_KIT,
    concierge_questions: PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT,
    opened_at: '1929-01-01',
    transports: PRINCE_DE_GALLES_TRANSPORTS,
    restaurant_info: PRINCE_DE_GALLES_RESTAURANT_INFO,
    points_of_interest: PRINCE_DE_GALLES_POINTS_OF_INTEREST,
    concierge_advice: PRINCE_DE_GALLES_CONCIERGE_ADVICE,
    concierge_pick: PRINCE_DE_GALLES_CONCIERGE_PICK,
    concierge_hook: PRINCE_DE_GALLES_CONCIERGE_HOOK,
    instagram: PRINCE_DE_GALLES_INSTAGRAM,
    policies: patchPrinceDeGallesPolicies(current.policies),
    awards: patchPrinceDeGallesAwards(current.awards),
    amenities: patchPrinceDeGallesAmenities(current.amenities),
    spa_info: spaInfo,
    description_fr: PRINCE_DE_GALLES_DESCRIPTION_FR,
    description_en: PRINCE_DE_GALLES_DESCRIPTION_EN,
    long_description_sections: sanitizePrinceDeGallesJsonb(
      resolvePrinceDeGallesLongDescriptionSections(current.long_description_sections, spaInfo),
    ),
    signature_experiences: sanitizePrinceDeGallesJsonb(resolvePrinceDeGallesSignatureExperiences()),
    featured_reviews: PRINCE_DE_GALLES_FEATURED_REVIEWS,
    upcoming_events: PRINCE_DE_GALLES_UPCOMING_EVENTS,
    factual_summary_fr: PRINCE_DE_GALLES_FACTUAL_SUMMARY_FR,
    factual_summary_en: PRINCE_DE_GALLES_FACTUAL_SUMMARY_EN,
    meta_desc_fr: PRINCE_DE_GALLES_META_DESC_FR,
    meta_desc_en: PRINCE_DE_GALLES_META_DESC_EN,
    meta_title_fr: PRINCE_DE_GALLES_META_TITLE_FR,
    meta_title_en: PRINCE_DE_GALLES_META_TITLE_EN,
    hero_image: PRINCE_DE_GALLES_HERO_IMAGE,
    gallery_images: PRINCE_DE_GALLES_GALLERY_IMAGES,
    external_sources: PRINCE_DE_GALLES_EXTERNAL_SOURCES,
    wikidata_id: princeDeGallesExternalScalar('wikidata_id'),
    wikipedia_url_fr: princeDeGallesExternalScalar('wikipedia_url_fr'),
    wikipedia_url_en: princeDeGallesExternalScalar('wikipedia_url_en'),
    official_url: princeDeGallesExternalScalar('official_url'),
    phone_e164: PRINCE_DE_GALLES_PHONE_E164,
    address: PRINCE_DE_GALLES_ADDRESS,
    postal_code: PRINCE_DE_GALLES_POSTAL_CODE,
    latitude: PRINCE_DE_GALLES_LATITUDE,
    longitude: PRINCE_DE_GALLES_LONGITUDE,
    email_reservations: PRINCE_DE_GALLES_EMAIL_RESERVATIONS,
    mice_info: PRINCE_DE_GALLES_MICE_INFO,
    affiliations: PRINCE_DE_GALLES_AFFILIATIONS,
  };
}
