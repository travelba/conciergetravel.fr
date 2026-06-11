/**
 * Phase 3 — curated 30-image gallery manifest for `cheval-blanc-paris`.
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-cheval-blanc-paris-gallery-batch.ts`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const CHEVAL_BLANC_PARIS_HERO_IMAGE = 'cct/hotels/cheval-blanc-paris/hero';

export const CHEVAL_BLANC_PARIS_HERO_SOURCE_URL =
  'https://images.prismic.io/lvmh-chevalblanc/aiKrfQeQX7-eW2iQ_Light-ChevalBlancParis_PontNeufJR_OliverFly2026-1-.jpg?auto=format,compress&w=2880';

export const CHEVAL_BLANC_PARIS_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-1',
    category: 'exterior',
    alt_fr: 'Façade du Cheval Blanc Paris sur le quai du Louvre, face à la Seine',
    alt_en: 'Cheval Blanc Paris facade on Quai du Louvre, facing the Seine',
    caption_fr:
      'La Maison Cheval Blanc occupe le bâtiment historique de la Samaritaine, inaugurée en septembre 2021 face au Pont Neuf.',
    caption_en:
      'Cheval Blanc Maison occupies the historic Samaritaine building, opened in September 2021 facing Pont Neuf.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-2',
    category: 'exterior',
    alt_fr: 'Vue du Cheval Blanc Paris et du Pont Neuf depuis la Seine',
    alt_en: 'View of Cheval Blanc Paris and Pont Neuf from the Seine',
    caption_fr:
      'Sur Seine, côté cœur : la Maison se lit depuis le fleuve, entre le Louvre et la rive gauche.',
    caption_en:
      'On the Seine, heart-side: the Maison reads from the river, between the Louvre and the Left Bank.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-3',
    category: 'exterior',
    alt_fr: 'Architecture du Cheval Blanc Paris, quai du Louvre 75001',
    alt_en: 'Cheval Blanc Paris architecture, Quai du Louvre 75001',
    caption_fr:
      'Edouard François a repensé l’enveloppe ; Peter Marino signe les intérieurs contemporains de la Maison parisienne.',
    caption_en:
      'Edouard François reshaped the envelope; Peter Marino signs the contemporary interiors of the Paris Maison.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-4',
    category: 'lobby',
    alt_fr: 'Salon d’accueil du Cheval Blanc Paris, lumière tamisée',
    alt_en: 'Reception lounge at Cheval Blanc Paris, soft light',
    caption_fr:
      'Le salon d’accueil accueille les arrivées dans un décor feutré signé Peter Marino, entre art contemporain et lumière dorée.',
    caption_en:
      'The reception lounge welcomes arrivals in a hushed Peter Marino setting, between contemporary art and golden light.',
    credit: 'Cheval Blanc Paris (LVMH) — Alexandre Tabaste',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-5',
    category: 'lobby',
    alt_fr: 'Lobby du Cheval Blanc Paris, escalier et œuvres d’art',
    alt_en: 'Cheval Blanc Paris lobby, staircase and artworks',
    caption_fr:
      'Le lobby mêle marbre, bronze et pièces d’art choisies — la promenade commence dès l’entrée sur le quai du Louvre.',
    caption_en:
      'The lobby blends marble, bronze and selected artworks — the walk begins at the Quai du Louvre entrance.',
    credit: 'Cheval Blanc Paris (LVMH)',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-6',
    category: 'lobby',
    alt_fr: 'Accueil familial au lobby du Cheval Blanc Paris',
    alt_en: 'Family welcome at Cheval Blanc Paris lobby',
    caption_fr:
      'Le Carrousel et la conciergerie prolongent l’accueil : la Maison cultive l’esprit famille au cœur du 1er arrondissement.',
    caption_en:
      'Le Carrousel and the concierge extend the welcome: the Maison cultivates a family spirit in the 1st arrondissement.',
    credit: 'Cheval Blanc Paris (LVMH) — Chloé Gassian',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-7',
    category: 'room',
    alt_fr: 'Chambre Deluxe du Cheval Blanc Paris, décoration Peter Marino',
    alt_en: 'Deluxe Room at Cheval Blanc Paris, Peter Marino décor',
    caption_fr:
      'Les 26 chambres et 46 suites portent la grammaire Cheval Blanc : lignes pures, matières nobles et lumière travaillée.',
    caption_en:
      'The 26 rooms and 46 suites carry Cheval Blanc grammar: clean lines, noble materials and crafted light.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-8',
    category: 'room',
    alt_fr: 'Chambre Deluxe Balcon du Cheval Blanc Paris',
    alt_en: 'Deluxe Balcony Room at Cheval Blanc Paris',
    caption_fr:
      'La catégorie Deluxe Balcon ouvre sur les toits parisiens — un luxe discret au-dessus du quai du Louvre.',
    caption_en:
      'The Deluxe Balcony category opens onto Paris rooftops — discreet luxury above Quai du Louvre.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-9',
    category: 'room',
    alt_fr: 'Suite Seine avec jardin d’hiver, Cheval Blanc Paris',
    alt_en: 'Seine Suite with winter garden, Cheval Blanc Paris',
    caption_fr:
      'Le jardin d’hiver prolonge la chambre vers la Seine — l’écrin le plus demandé pour un séjour romantique.',
    caption_en:
      'The winter garden extends the room toward the Seine — the most requested setting for a romantic stay.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-10',
    category: 'dining',
    alt_fr: 'Salle du restaurant Plénitude, Cheval Blanc Paris',
    alt_en: 'Plénitude restaurant dining room, Cheval Blanc Paris',
    caption_fr:
      'Plénitude, trois étoiles MICHELIN : Arnaud Donckele assemble les Absolues au premier étage de la Maison.',
    caption_en:
      'Plénitude, three MICHELIN Stars: Arnaud Donckele blends the Absolues on the Maison’s first floor.',
    credit: 'Cheval Blanc Paris (LVMH) — Ilya Food Stories',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-11',
    category: 'dining',
    alt_fr: 'Terrasse du Le Tout-Paris, vue sur les toits de Paris',
    alt_en: 'Le Tout-Paris terrace with Paris rooftop views',
    caption_fr:
      'Le Tout-Paris, brasserie étoilée au 7e étage : la terrasse embrasse la Seine et les toits parisiens du petit-déjeuner au dîner.',
    caption_en:
      'Le Tout-Paris, starred brasserie on the 7th floor: the terrace embraces the Seine and Paris rooftops from breakfast to dinner.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-12',
    category: 'dining',
    alt_fr: 'Terrasse de Langosteria au Cheval Blanc Paris',
    alt_en: 'Langosteria terrace at Cheval Blanc Paris',
    caption_fr:
      'Langosteria décline l’Italie contemporaine sur la terrasse arborée — déjeuner du mercredi au dimanche, dîner tous les soirs.',
    caption_en:
      'Langosteria serves contemporary Italy on the planted terrace — lunch Wednesday to Sunday, dinner every evening.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-13',
    category: 'spa',
    alt_fr: 'Suite de soins Dior Spa Cheval Blanc Paris',
    alt_en: 'Dior Spa Cheval Blanc Paris treatment suite',
    caption_fr:
      'Le Dior Spa Cheval Blanc invite à une immersion holistique dans l’univers de la Maison Dior, en suites exclusives.',
    caption_en:
      'Dior Spa Cheval Blanc invites a holistic immersion in the House of Dior world, in exclusive suites.',
    credit: 'Cheval Blanc Paris (LVMH) — Mathieu Salvaing',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-14',
    category: 'spa',
    alt_fr: 'Espace Dior Spa Cheval Blanc Paris, ambiance sérénité',
    alt_en: 'Dior Spa Cheval Blanc Paris space, serene mood',
    caption_fr:
      'Matériaux nobles et rituels Dior composent l’atmosphère du spa — rendez-vous personnalisés pour chaque hôte.',
    caption_en:
      'Noble materials and Dior rituals shape the spa atmosphere — personalised appointments for each guest.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-15',
    category: 'spa',
    alt_fr: 'Soin visage Dior Spa Cheval Blanc Paris',
    alt_en: 'Dior Spa Cheval Blanc Paris facial treatment',
    caption_fr:
      'Les soins visage et corps Dior complètent la piscine à débordement — le bien-être se vit sur mesure à la Maison.',
    caption_en:
      'Dior face and body treatments complement the infinity pool — wellness is bespoke at the Maison.',
    credit: 'Cheval Blanc Paris (LVMH) — Dior',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-16',
    category: 'pool',
    alt_fr: 'Piscine à débordement en mosaïque, Cheval Blanc Paris',
    alt_en: 'Mosaic infinity pool at Cheval Blanc Paris',
    caption_fr:
      'La piscine aux ondes de mosaïques scintille au cœur du Dior Spa — refuge lumineux au-dessus de Paris.',
    caption_en:
      'The mosaic-tiled pool shimmers at the heart of Dior Spa — a luminous refuge above Paris.',
    credit: 'Cheval Blanc Paris (LVMH) — Alexandre Tabaste',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-17',
    category: 'pool',
    alt_fr: 'Piscine du Cheval Blanc Paris, vue intérieure',
    alt_en: 'Cheval Blanc Paris pool, interior view',
    caption_fr:
      'L’eau et la lumière composent un écrin sensoriel réservé aux hôtes — le contraste avec le quai du Louvre est saisissant.',
    caption_en:
      'Water and light form a sensory setting reserved for guests — the contrast with Quai du Louvre is striking.',
    credit: 'Cheval Blanc Paris (LVMH) — Oliver Fly Photography',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-18',
    category: 'pool',
    alt_fr: 'Bassin mosaïque du Dior Spa Cheval Blanc Paris',
    alt_en: 'Mosaic basin at Dior Spa Cheval Blanc Paris',
    caption_fr:
      'La piscine à débordement prolonge les rituels Dior — idéale en fin d’après-midi avant un dîner au Le Tout-Paris.',
    caption_en:
      'The infinity pool extends Dior rituals — ideal late afternoon before dinner at Le Tout-Paris.',
    credit: 'Cheval Blanc Paris (LVMH) — Alexandre Tabaste',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-19',
    category: 'view',
    alt_fr: 'Suite Eiffel, salon avec vue sur Paris, Cheval Blanc Paris',
    alt_en: 'Eiffel Suite living room with Paris view, Cheval Blanc Paris',
    caption_fr:
      'Depuis la Suite Eiffel, la tour se dévoile au-dessus des toits — l’horizon parisien comme tableau de chambre.',
    caption_en:
      'From Suite Eiffel, the tower unfolds above the rooftops — the Paris skyline as a bedroom painting.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-20',
    category: 'view',
    alt_fr: 'Le Jardin rooftop, vue Tour Eiffel, Cheval Blanc Paris',
    alt_en: 'Le Jardin rooftop with Eiffel Tower view, Cheval Blanc Paris',
    caption_fr:
      'Le Jardin suspendu au 7e étage capte la Tour Eiffel en saison estivale — table en plein ciel par beau temps.',
    caption_en:
      'Le Jardin, suspended on the 7th floor, catches the Eiffel Tower in summer — an open-sky table in fine weather.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-21',
    category: 'view',
    alt_fr: 'Balcon du Le Tout-Paris, panorama sur la Seine',
    alt_en: 'Le Tout-Paris balcony, panorama over the Seine',
    caption_fr:
      'Le balcon du Le Tout-Paris offre l’une des vues les plus nettes sur la Seine depuis le 1er arrondissement.',
    caption_en:
      'Le Tout-Paris balcony offers one of the clearest Seine views from the 1st arrondissement.',
    credit: 'Cheval Blanc Paris (LVMH) — Ilya Food Stories',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-22',
    category: 'detail',
    alt_fr: 'Création du chef à Plénitude, Cheval Blanc Paris',
    alt_en: 'Chef’s creation at Plénitude, Cheval Blanc Paris',
    caption_fr:
      'Les Absolues de Donckele se lisent en assiettes — partition maraîchère et sauces longuement travaillées.',
    caption_en:
      'Donckele’s Absolues read on the plate — vegetable partitions and long-worked sauces.',
    credit: 'Cheval Blanc Paris (LVMH) — Ilya Food Stories',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-23',
    category: 'detail',
    alt_fr: 'Salle du restaurant Hakuba, Cheval Blanc Paris',
    alt_en: 'Hakuba restaurant room, Cheval Blanc Paris',
    caption_fr:
      'Hakuba, deux étoiles MICHELIN : Takuya Watanabe invite à un Japon ritualisé au cœur de la Samaritaine.',
    caption_en:
      'Hakuba, two MICHELIN Stars: Takuya Watanabe invites ritualised Japan at the heart of Samaritaine.',
    credit: 'Cheval Blanc Paris (LVMH) — Caroline Dutrey',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-24',
    category: 'detail',
    alt_fr: 'Suite L’Appartement, détail décoratif, Cheval Blanc Paris',
    alt_en: 'L’Appartement Suite decorative detail, Cheval Blanc Paris',
    caption_fr:
      'Les suites L’Appartement déploient volumes généreux et finitions sur mesure — signature Peter Marino.',
    caption_en:
      'L’Appartement suites unfold generous volumes and bespoke finishes — Peter Marino signature.',
    credit: 'Cheval Blanc Paris (LVMH) — Alexandre Tabaste',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-25',
    category: 'concierge',
    alt_fr: 'Conciergerie du Cheval Blanc Paris',
    alt_en: 'Concierge desk at Cheval Blanc Paris',
    caption_fr:
      'La conciergerie coordonne tables étoilées, billets Louvre et accès Dior Spa — de jour comme de nuit.',
    caption_en:
      'The concierge coordinates starred tables, Louvre tickets and Dior Spa access — day or night.',
    credit: 'Cheval Blanc Paris (LVMH)',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-26',
    category: 'concierge',
    alt_fr: 'Ambassadrice Dior Spa Cheval Blanc Paris',
    alt_en: 'Dior Spa Cheval Blanc Paris ambassador',
    caption_fr:
      'Les Artisans de la Maison personnalisent chaque séjour : spa, restauration et surprises discrètes en chambre.',
    caption_en:
      'Maison Artisans personalise each stay: spa, dining and discreet in-room surprises.',
    credit: 'Cheval Blanc Paris (LVMH) — Adrien Vigreux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-27',
    category: 'concierge',
    alt_fr: 'Service sur mesure en suite, Cheval Blanc Paris',
    alt_en: 'Bespoke in-suite service, Cheval Blanc Paris',
    caption_fr:
      'Majordomes et conciergerie anticipent les demandes de dernière minute — tables, transferts et privatisations.',
    caption_en:
      'Butlers and concierge anticipate last-minute requests — tables, transfers and privatisations.',
    credit: 'Cheval Blanc Paris (LVMH)',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-28',
    category: 'events',
    alt_fr: 'Salon privatisable Le Tout-Paris, Cheval Blanc Paris',
    alt_en: 'Privatisable Le Tout-Paris salon, Cheval Blanc Paris',
    caption_fr:
      'Le Tout-Paris se privatise en totalité ou partiellement pour cocktails et dîners sur la terrasse du 7e étage.',
    caption_en:
      'Le Tout-Paris can be fully or partially privatised for cocktails and dinners on the 7th-floor terrace.',
    credit: 'Cheval Blanc Paris (LVMH) — Ilya Food Stories',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-29',
    category: 'events',
    alt_fr: 'Suite L’Appartement pour réception privée, Cheval Blanc Paris',
    alt_en: 'L’Appartement Suite for private reception, Cheval Blanc Paris',
    caption_fr:
      'Les suites L’Appartement accueillent réceptions intimes et célébrations familiales loin de l’agitation du quai.',
    caption_en:
      'L’Appartement suites host intimate receptions and family celebrations away from quayside bustle.',
    credit: 'Cheval Blanc Paris (LVMH) — Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/cheval-blanc-paris/press-30',
    category: 'events',
    alt_fr: 'Dîner dominical au Le Tout-Paris, Cheval Blanc Paris',
    alt_en: 'Sunday lunch at Le Tout-Paris, Cheval Blanc Paris',
    caption_fr:
      'Le déjeuner dominical au Le Tout-Paris rassemble familles et amis — brasserie étoilée avec vue sur Paris.',
    caption_en:
      'Sunday lunch at Le Tout-Paris brings families and friends together — starred brasserie with a Paris view.',
    credit: 'Cheval Blanc Paris (LVMH) — Ilya Food Stories',
  },
] as const;

/** CDC §2.2 category floor — 10 required categories. */
const CHEVAL_BLANC_PRISMIC_W = 'auto=format,compress&w=2880';

/** Raw press-slot URLs (press-2 = hero source — deduped in {@link CHEVAL_BLANC_PARIS_GALLERY_SOURCE_URLS}). */
export const CHEVAL_BLANC_PARIS_GALLERY_PRESS_SLOT_URLS = [
  `https://images.prismic.io/lvmh-chevalblanc/aEb52Lh8WN-LV5rR_ChevalBlancParis_Fa%C3%A7ade3_Oliver_Fly_Photography_32025.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aiKrfQeQX7-eW2iQ_Light-ChevalBlancParis_PontNeufJR_OliverFly2026-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aGUCC3fc4bHWi86A_Light-ChevalBlancParis_Fa%C3%A7ade_OliverFly.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z8_85hsAHJWomUB3_WebRGB-ChevalBlancParis_Salond%27Accueil_AlexandreTabaste.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-WJyndAxsiBwAPn_WebRGB-ChevalBlancParis-LeToutParis-salle-EdouardFran%C3%A7ois-2021.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z9wuHDiBA97Giuw3_WebRGB-ChevalBlancParis-Shootingphotosenfants-Lobby-Chlo%C3%A9Gassian-5avril2023-02.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aUKCeHNYClf9oV2O_Light-ChevalBlancParis_ChambreDeluxe_VincentLeroux.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aUPKtnNYClf9oYj-_Light-ChevalBlancParis_ChambreDeluxeBalcon_2025_VincentLeroux-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z9AApRsAHJWomUFu_WebRGB-ChevalBlancParis_SuiteSeine_Jardind%27Hiver_511_VincentLeroux.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-1uLHdAxsiBwPQC_WebRGB-ChevalBlancParis_Pl%C3%A9nitude_AmbianceCuisine_Ilyafoodstories.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aQzQT7pReVYa4I6K_Z-WI03dAxsiBwAOx_WebRGB-ChevalBlancParis_LeTout-Paris_Terrasse_VincentLeroux-3--1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/ah2JdgeQX7-eWfRM_Light-ChevalBlancParis_Langosteria_Terrasse_OliverFly-5-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z9AAjRsAHJWomUFh_WebRGB-ChevalBlancParis_DiorSpa_SuiteSauvage_MathieuSalvaing.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-0HyndAxsiBwNsN_WebRGB-ChevalBlancParis-DiorSpa-OliverFly-1.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/ahVcebK9tuLqEI3b_ChevalBlancParis_MassageVisage_DiorSpa_2026_VisuelDior-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-0KendAxsiBwNuW_WebRGB-ChevalBlancParis_Piscineinfinie_AlexandreTabaste-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-0KhndAxsiBwNua_WebRGB-ChevalBlancParis_Piscine_OliverFly.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-0KaXdAxsiBwNuR_WebRGB-ChevalBlancParis_Piscineinfinie_AlexandreTabaste-2-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z_kS8evxEdbNO6gd_WebRGB-ChevalBlancParis_SuiteEiffel_Salon_VincentLeroux-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/ad3-xp1ZCF7ETKac_Light-ChevalBlancParis_LeJardin_VueEiffel_VincentLeroux-2-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/agRTtaYofJOwHLYf_Light-ChevalBlancParis_LeTout-Paris_Balcon_Ilyafoodstories-8-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aTlGTHNYClf9oARl_Light-ChevalBlancParis_Pl%C3%A9nitude_Grousec%C3%A9leripassion_2025_Ilyafoodstories-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aTk673NYClf9oAFB_Light-ChevalBlancParis_Hakuba_Salle_Carolinedutrey-2-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z_d33uvxEdbNO1Ed_WebRGB-ChevalBlancParis_L%27Appartement_SuiteQuintessence_VincentLeroux.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z-0MmHdAxsiBwNwL_WebRGB-ChevalBlancParis_AmbassadriceDiorSpa_KiaraBaratta_AdrienVigreux-2-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aP-H6bpReVYa3tgg_Beauty%26bodymamanb%C3%A9b%C3%A9_DiorSpaChevalBlanc-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z_d3quvxEdbNO1EV_WebRGB-ChevalBlancParis_L%27Appartement_SuiteRavel-AlexandreTabaste-3-_0535.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/aftDdsBOoF08xrK3_ChevalBlancParis_Salle_LeTout-Paris_2026_IlyaFoodStories-3-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z_d44OvxEdbNO1Fv_WebRGB-ChevalBlancParis_L%27Appartement_SuiteQuintessence_VincentLeroux-2.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
  `https://images.prismic.io/lvmh-chevalblanc/Z_kXyuvxEdbNO6v-_WebRGB-ChevalBlancParis_LeTout-Paris_D%C3%A9jeunerDominical_ilyafoodstories-1-.jpg?${CHEVAL_BLANC_PRISMIC_W}`,
] as const;

/** Provenance URLs for promote + `kit.02.gallery_source_url_tracked` (hero excluded). */
export const CHEVAL_BLANC_PARIS_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  CHEVAL_BLANC_PARIS_GALLERY_PRESS_SLOT_URLS,
  CHEVAL_BLANC_PARIS_HERO_SOURCE_URL,
);

export const CHEVAL_BLANC_PARIS_GALLERY_CDC_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
] as const;
