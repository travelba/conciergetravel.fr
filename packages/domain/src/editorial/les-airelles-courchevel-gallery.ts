/**
 * Phase 3 — curated 30-image gallery manifest for `les-airelles-courchevel`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 *
 * Upload sources: `scripts/editorial-pilot/src/photos/resource-les-airelles-courchevel-gallery-batch.ts`
 * (assets.airelles.com / airelles.com official DAM).
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const LES_AIRELLES_COURCHEVEL_HERO_IMAGE = 'cct/hotels/les-airelles-courchevel/hero';

export const LES_AIRELLES_COURCHEVEL_HERO_SOURCE_URL =
  'https://assets.airelles.com/images/airelles2023/abREoVxvIZEnjqaN_ARLVUEDRONE.png?auto=format%2Ccompress&w=2600';

export const LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-1',
    category: 'exterior',
    alt_fr: 'Façade austro-hongroise de Les Airelles Courchevel, Jardin Alpin',
    alt_en: 'Austro-Hungarian facade of Les Airelles Courchevel, Le Jardin Alpin',
    caption_fr:
      'Le palais des neiges aux tours enneigées et fresques peintes à la main domine Courchevel 1850, ski-in depuis le Jardin Alpin.',
    caption_en:
      'The snow palace with snow-capped turrets and hand-painted frescoes overlooks Courchevel 1850, ski-in from Le Jardin Alpin.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-2',
    category: 'exterior',
    alt_fr: 'Vue aérienne du palace Les Airelles Courchevel, 3 Vallées',
    alt_en: 'Aerial view of Les Airelles Courchevel palace, Three Valleys',
    caption_fr:
      'Vue drone du château austro-hongrois au cœur du domaine skiable des 3 Vallées — 600 km de pistes à portée de ski.',
    caption_en:
      'Drone view of the Austro-Hungarian castle at the heart of the Three Valleys ski domain — 600 km of slopes within reach.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-3',
    category: 'exterior',
    alt_fr: 'Façade côté pistes de Les Airelles Courchevel',
    alt_en: 'Slope-side facade of Les Airelles Courchevel',
    caption_fr:
      'Côté pistes, le palace ouvre directement sur le Jardin Alpin et les remontées de Courchevel 1850.',
    caption_en:
      'On the slope side, the palace opens directly onto Le Jardin Alpin and Courchevel 1850 lifts.',
    credit: 'Jetlag',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-4',
    category: 'lobby',
    alt_fr: 'Bar principal de Les Airelles Courchevel',
    alt_en: 'Main bar at Les Airelles Courchevel',
    caption_fr:
      'Le bar au boiseries peintes et lumière dorée prolonge l’ambiance château après une journée de ski.',
    caption_en:
      'The bar with painted woodwork and golden light extends the castle mood after a day on the slopes.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-5',
    category: 'lobby',
    alt_fr: 'Bar avec mixologue, Les Airelles Courchevel',
    alt_en: 'Bar with mixologist, Les Airelles Courchevel',
    caption_fr:
      'Le comptoir du bar accueille cocktails signature et snacking avant le dîner en montagne.',
    caption_en:
      'The bar counter serves signature cocktails and light bites before dinner in the mountains.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-6',
    category: 'concierge',
    alt_fr: 'Fumoir de Les Airelles Courchevel',
    alt_en: 'Smoking lounge at Les Airelles Courchevel',
    caption_fr:
      'Le fumoir feutré, aux boiseries et fauteuils capitonnés, invite à un cigare au coin du feu.',
    caption_en:
      'The hushed smoking lounge, with wood panelling and tufted armchairs, invites a cigar by the fire.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-7',
    category: 'room',
    alt_fr: 'Chambre Deluxe Les Airelles Courchevel, boiseries et fresques',
    alt_en: 'Deluxe Room at Les Airelles Courchevel, woodwork and frescoes',
    caption_fr:
      'Plafonds à caisson, fresques pastel et lits confortables composent les 44 chambres et suites du palace.',
    caption_en:
      'Coffered ceilings, pastel frescoes and cloud-soft beds shape the palace’s 44 rooms and suites.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-8',
    category: 'room',
    alt_fr: 'Chambre Deluxe coin nuit, Les Airelles Courchevel',
    alt_en: 'Deluxe Room sleeping area, Les Airelles Courchevel',
    caption_fr:
      'Mobilier chiné, vitraux et parquet ciré rappellent les châteaux austro-hongrois du XIXe siècle.',
    caption_en:
      'Antique furniture, stained glass and waxed parquet recall 19th-century Austro-Hungarian castles.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-9',
    category: 'room',
    alt_fr: 'Suite sur pistes, Les Airelles Courchevel',
    alt_en: 'Slope Suite, Les Airelles Courchevel',
    caption_fr:
      'La Suite sur Pistes permet de rejoindre le domaine skis aux pieds depuis le Jardin Alpin.',
    caption_en: 'The Slope Suite lets you reach the ski area ski-in from Le Jardin Alpin.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-10',
    category: 'dining',
    alt_fr: 'Salle La Table des Airelles, Courchevel',
    alt_en: 'La Table des Airelles dining room, Courchevel',
    caption_fr:
      'La Table des Airelles, 1 étoile MICHELIN, sert petit-déjeuner, Le Festin et dîners aux chandelles.',
    caption_en:
      'La Table des Airelles, 1 MICHELIN Star, serves breakfast, Le Festin lunch and candlelit dinners.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-11',
    category: 'dining',
    alt_fr: 'Salle Matsuhisa Courchevel, Les Airelles',
    alt_en: 'Matsuhisa Courchevel dining room, Les Airelles',
    caption_fr:
      'Matsuhisa fusionne élégance japonaise et accents péruviens de Nobu Matsuhisa dans le palace.',
    caption_en:
      'Matsuhisa blends Japanese elegance with Nobu Matsuhisa’s Peruvian accents in the palace.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-12',
    category: 'lobby',
    alt_fr: 'Le Coin Savoyard, Les Airelles Courchevel',
    alt_en: 'Le Coin Savoyard, Les Airelles Courchevel',
    caption_fr:
      'Le Coin Savoyard sert reblochon, diots et plats savoyards dans un cadre bois et velours.',
    caption_en:
      'Le Coin Savoyard serves reblochon, diots and Savoyard classics in a wood-and-velvet setting.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-13',
    category: 'spa',
    alt_fr: 'Spa privatif de l’Appartement, Les Airelles Courchevel',
    alt_en: 'Private spa of the Apartment, Les Airelles Courchevel',
    caption_fr:
      'L’Appartement Privé intègre un spa mosaic avec cascade, sauna et fontaine à glace.',
    caption_en:
      'The Private Apartment includes a mosaic spa with waterfall, sauna and ice fountain.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-14',
    category: 'spa',
    alt_fr: 'Hammam du Chalet 1908, Les Airelles Courchevel',
    alt_en: 'Hammam at Chalet 1908, Les Airelles Courchevel',
    caption_fr:
      'Le hammam du Chalet 1908 prolonge le rituel bien-être après une journée de ski en altitude.',
    caption_en:
      'The Chalet 1908 hammam extends the wellness ritual after a day skiing at altitude.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-15',
    category: 'spa',
    alt_fr: 'Piscine du spa Airelles Courchevel',
    alt_en: 'Pool at Airelles Spa Courchevel',
    caption_fr:
      'Piscine azur, douches sensorielles et grotte de neige composent le Spa Airelles by La Mer.',
    caption_en: 'Azure pool, sensory showers and snow cave shape Airelles Spa by La Mer.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-16',
    category: 'pool',
    alt_fr: 'Piscine du Chalet 1908, Les Airelles Courchevel',
    alt_en: 'Pool at Chalet 1908, Les Airelles Courchevel',
    caption_fr:
      'Le Chalet 1908 offre piscine et jacuzzi privatifs pour les familles en quête d’intimité.',
    caption_en: 'Chalet 1908 offers a private pool and jacuzzi for families seeking intimacy.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-17',
    category: 'pool',
    alt_fr: 'Terrasse jacuzzi Suite Aubépine Cardamine, Les Airelles',
    alt_en: 'Jacuzzi terrace Suite Aubépine Cardamine, Les Airelles',
    caption_fr:
      'Certaines suites alpines ouvrent sur un jacuzzi privatif face aux sommets de la Tarentaise.',
    caption_en: 'Select alpine suites open onto a private jacuzzi facing the Tarentaise peaks.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-18',
    category: 'pool',
    alt_fr: 'Piscine enfants du Winter Camp, Les Airelles Courchevel',
    alt_en: 'Winter Camp children’s pool, Les Airelles Courchevel',
    caption_fr:
      'Le spa accueille une piscine dédiée aux enfants du Winter Camp, chauffée en saison.',
    caption_en: 'The spa holds a dedicated pool for Winter Camp children, heated in season.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-19',
    category: 'view',
    alt_fr: 'Vue montagne depuis Les Airelles Courchevel',
    alt_en: 'Mountain view from Les Airelles Courchevel',
    caption_fr:
      'Depuis les suites, la vue porte sur les sommets de la Tarentaise et les pistes du Jardin Alpin.',
    caption_en:
      'From the suites, the view sweeps over Tarentaise peaks and Le Jardin Alpin slopes.',
    credit: 'Yoann et Marco',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-20',
    category: 'view',
    alt_fr: 'Vue drone du palace Les Airelles et Courchevel 1850',
    alt_en: 'Drone view of Les Airelles palace and Courchevel 1850',
    caption_fr:
      'Le palace se découpe en pierre claire au-dessus de la station la plus exclusive des Alpes.',
    caption_en: 'The palace cuts a pale-stone silhouette above the Alps’ most exclusive resort.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-21',
    category: 'view',
    alt_fr: 'Terrasse panoramique de l’Appartement Privé, Les Airelles',
    alt_en: 'Panoramic terrace of the Private Apartment, Les Airelles',
    caption_fr:
      'L’Appartement Privé offre 150 m² de terrasse et un bain nordique face au domaine skiable.',
    caption_en:
      'The Private Apartment offers 150 sq m of terrace and a Norwegian bath facing the ski area.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-22',
    category: 'detail',
    alt_fr: 'Détail décor Suite Gentiane, Les Airelles Courchevel',
    alt_en: 'Décor detail Suite Gentiane, Les Airelles Courchevel',
    caption_fr:
      'Antiquités, fresques peintes à la main et boiseries sculptées composent chaque suite.',
    caption_en: 'Antiques, hand-painted frescoes and carved woodwork shape every suite.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-23',
    category: 'detail',
    alt_fr: 'Détail chambre Suite Lys Martagon, Les Airelles Courchevel',
    alt_en: 'Room detail Suite Lys Martagon, Les Airelles Courchevel',
    caption_fr:
      'Lin fin, têtes de lit sculptées et vitraux colorent l’atmosphère intime des chambres palace.',
    caption_en: 'Fine linen, carved headboards and stained glass colour the intimate palace rooms.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-24',
    category: 'detail',
    alt_fr: 'Salle de bain chambre Les Airelles Courchevel',
    alt_en: 'Bathroom at Les Airelles Courchevel room',
    caption_fr:
      'Marbre, douche hammam et produits de toilette premium complètent les salles de bain des suites.',
    caption_en: 'Marble, hammam shower and premium toiletries complete suite bathrooms.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-25',
    category: 'concierge',
    alt_fr: 'Boutique Vanille & Lilas, Les Airelles Courchevel',
    alt_en: 'Vanille & Lilas boutique, Les Airelles Courchevel',
    caption_fr:
      'La boutique Vanille & Lilas propose mode alpine, accessoires et cadeaux signés Airelles.',
    caption_en:
      'The Vanille & Lilas boutique offers alpine fashion, accessories and Airelles gifts.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-26',
    category: 'concierge',
    alt_fr: 'Service restaurant La Table des Airelles, Courchevel',
    alt_en: 'Service at La Table des Airelles, Courchevel',
    caption_fr:
      'Le service en salle reflète l’art de recevoir Airelles : précis, chaleureux, jamais protocolaire.',
    caption_en: 'Table service reflects the Airelles art of hosting: precise, warm, never stiff.',
    credit: 'Yoann et Marco',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-27',
    category: 'events',
    alt_fr: 'La Folie Douce, expérience Les Airelles Courchevel',
    alt_en: 'La Folie Douce experience, Les Airelles Courchevel',
    caption_fr:
      'La Folie Douce et La Fruitière complètent l’offre festive de la maison en altitude.',
    caption_en: 'La Folie Douce and La Fruitière extend the house’s festive alpine offer.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-28',
    category: 'events',
    alt_fr: 'Balade en motoneige, Les Airelles Courchevel',
    alt_en: 'Snowmobile outing, Les Airelles Courchevel',
    caption_fr:
      'Motoneige, chiens de traîneau et patinoire composent les expériences hivernales orchestrées par la conciergerie.',
    caption_en:
      'Snowmobile, dog-sled and ice rink outings are among winter experiences arranged by the concierge.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-29',
    category: 'events',
    alt_fr: 'Patinoire de Les Airelles Courchevel',
    alt_en: 'Ice rink at Les Airelles Courchevel',
    caption_fr: 'La patinoire du palace accueille glisse libre et séances familiales après le ski.',
    caption_en: 'The palace ice rink hosts free skating and family sessions after skiing.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-30',
    category: 'dining',
    alt_fr: 'Salle Palladio, Les Airelles Courchevel',
    alt_en: 'Palladio dining room, Les Airelles Courchevel',
    caption_fr:
      'Palladio installe une trattoria italienne au velours émeraude et lustres dorés du palace.',
    caption_en:
      'Palladio sets an Italian trattoria in the palace’s emerald velvet and gilded chandeliers.',
    credit: 'Vincent Leroux',
  },
] as const;

/** CDC §2.2 category floor — 10 required categories. */
const ARL_CV_IMGIX = 'https://assets.airelles.com/images/airelles2023/';
const ARL_CV_IMGIX_Q = '?auto=format%2Ccompress&w=2600';

export const LES_AIRELLES_COURCHEVEL_GALLERY_PRESS_SLOT_URLS = [
  `${ARL_CV_IMGIX}abwDDbbci2UF6Rqd_VIDEOHEADERHOMEARL.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}abREoVxvIZEnjqaN_ARLVUEDRONE.png${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}abRDdVxvIZEnjqZa_DRONEARLVF.png${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNztf55xUNkB1VA3_ARL-Lieucommun-Salonavecservice%C2%A9JonathanDucrest.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZiojZvPdc1huKx1J_LesAirelles-LeBaravecmixologue.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zg_IRxrFxhpPBU9o_ARL-Fumoir.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aXN9SgIvOtkhB3ey_ARL-Chambre-L%27Appartement%C2%A9VincentLeroux.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZkdQfiol0Zci9PdA_LesAirelles-LYS315-Chambre2-D%C3%A9tail.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqBqJ5xUNkB1OEv_2m.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZharrjjCgu4jzuwV_BLOG-ARL-TabledesAirelles-Salle.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0ME3NYClf9o0Zi_ARL-Salle-Matsuhisa%C2%A9VincentLeroux.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZiogKfPdc1huKxvn_Moyen-LesAirelles-CoinSavoyard-Table%C2%A9ViaTolila.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aQtMirpReVYa4F1T_ShootingExportWebseq3-7.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zkx5lyol0Zci9UIU_SuiteNecker-De%CC%81tails.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNzWJJ5xUNkB1Ujy_SPA.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZjoJh0MTzAJOCmvG_Moyen-Piscine-Vued%27ensemble-1.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqCCZ5xUNkB1OFK_4m.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqCgp5xUNkB1OFX_lastm.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqINp5xUNkB1OKW_ARL-Vuemontagne%C2%A9YoannetMarco.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}abRDdVxvIZEnjqZa_DRONEARLVF.png${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZuQVhrVsGrYSvVEv_ChaletdePierres-Terrasse%C2%A9ViaTolila.-2.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zkxhmiol0Zci9T4T_Chambres%26Suites.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqBhZ5xUNkB1OEm_1m.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNup2Z5xUNkB1Q6I_4m.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZgPr27LRO5ile6wB_LesAirelles-BoutiqueV%26L.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aQMnHrpReVYa30xx_ARL-Service-TabledesAirelles%C2%A9Yoannetmarco.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0K2nNYClf9o0Yr_ARL-FOLIEDOUCE.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zes593Uurf2G3N5n_ARL-MotoneigeExpe%CC%81rience.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZgPrBrLRO5ile6vt_Patinoire.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0M6HNYClf9o0Z3_ARL-Salle-Palladio%C2%A9VincentLeroux-1.jpg${ARL_CV_IMGIX_Q}`,
] as const;

export const LES_AIRELLES_COURCHEVEL_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  LES_AIRELLES_COURCHEVEL_GALLERY_PRESS_SLOT_URLS,
  LES_AIRELLES_COURCHEVEL_HERO_SOURCE_URL,
);

export const LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES = [
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
