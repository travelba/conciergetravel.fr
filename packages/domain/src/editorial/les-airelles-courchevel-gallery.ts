/**
 * Phase 3 — honest gallery manifest for `les-airelles-courchevel` (29 slots).
 *
 * 2026-06-16 — re-audited against the live Cloudinary pixels. The original
 * 10-category template order did NOT match the uploaded press-N pixels (upload
 * followed the URL array, not the manifest), so nearly every slot's category and
 * caption contradicted its photo. Each slot is now categorised by its real
 * subject. Dropped press-14 (a green summer garden — foreign to a snowbound
 * alpine palace). No genuine spa-treatment pixel survives, so the Spa tab stays
 * empty rather than showing a bathroom or a pool labelled "spa".
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
    category: 'dining',
    alt_fr: 'Cave à vins de Les Airelles Courchevel, sommelier au travail',
    alt_en: 'Wine cellar at Les Airelles Courchevel, sommelier at work',
    caption_fr:
      'Le sommelier veille sur une cave taillée pour les grands crus — accords sur mesure pour les dîners du palace.',
    caption_en:
      'The sommelier tends a cellar built for grands crus — bespoke pairings for the palace dinners.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-2',
    category: 'exterior',
    alt_fr: 'Façade enneigée de Les Airelles Courchevel, palais des neiges austro-hongrois',
    alt_en: 'Snow-covered facade of Les Airelles Courchevel, Austro-Hungarian snow palace',
    caption_fr:
      'Le palais des neiges aux tours enneigées domine Courchevel 1850, ski-in depuis le Jardin Alpin.',
    caption_en:
      'The snow palace with its snow-capped turrets overlooks Courchevel 1850, ski-in from Le Jardin Alpin.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-3',
    category: 'lobby',
    alt_fr: 'Salon de Les Airelles Courchevel, velours vert et cheminée',
    alt_en: 'Lounge at Les Airelles Courchevel, green velvet and fireplace',
    caption_fr:
      'Le salon habillé de velours vert et de boiseries réchauffe les retours de piste autour de la cheminée.',
    caption_en:
      'The green-velvet, wood-panelled lounge warms post-slope returns around the fireplace.',
    credit: 'Jonathan Ducrest',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-4',
    category: 'lobby',
    alt_fr: 'Bar principal de Les Airelles Courchevel, mixologue au comptoir',
    alt_en: 'Main bar at Les Airelles Courchevel, mixologist at the counter',
    caption_fr:
      'Le bar aux boiseries peintes sert cocktails signature et snacking — l’ambiance château après une journée de ski.',
    caption_en:
      'The bar with painted woodwork serves signature cocktails and light bites — the castle mood after a day on the slopes.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-5',
    category: 'lobby',
    alt_fr: 'Salon boisé de Les Airelles Courchevel',
    alt_en: 'Wood-panelled salon at Les Airelles Courchevel',
    caption_fr:
      'Les boiseries peintes et la lumière dorée prolongent l’esprit château jusque dans les salons du palace.',
    caption_en:
      'Painted woodwork and golden light extend the castle spirit through the palace salons.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-6',
    category: 'room',
    alt_fr: 'Chambre de Les Airelles Courchevel, lit à baldaquin et tapis rouge',
    alt_en: 'Bedroom at Les Airelles Courchevel, canopy bed and red carpet',
    caption_fr:
      'Plafonds peints, lit à baldaquin et tapis profond composent l’atmosphère feutrée des 44 chambres et suites.',
    caption_en:
      'Painted ceilings, a canopy bed and deep carpet shape the hushed mood of the 44 rooms and suites.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-7',
    category: 'room',
    alt_fr: 'Chambre de Les Airelles Courchevel, fenêtre drapée sur la neige',
    alt_en: 'Room at Les Airelles Courchevel, draped window onto the snow',
    caption_fr: 'Depuis la chambre, la fenêtre drapée encadre les sapins enneigés du Jardin Alpin.',
    caption_en: 'From the room, the draped window frames the snow-laden firs of Le Jardin Alpin.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-8',
    category: 'room',
    alt_fr: 'Chambre de Les Airelles Courchevel, fenêtre cintrée et papier peint fleuri',
    alt_en: 'Room at Les Airelles Courchevel, arched window and floral wallpaper',
    caption_fr:
      'Le papier peint fleuri et la fenêtre cintrée signent les chambres inspirées des châteaux austro-hongrois.',
    caption_en:
      'Floral wallpaper and an arched window mark the rooms inspired by Austro-Hungarian castles.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-9',
    category: 'room',
    alt_fr: 'Salon d’une suite de Les Airelles Courchevel, tons bleu-vert',
    alt_en: 'Suite living room at Les Airelles Courchevel, blue-green tones',
    caption_fr:
      'Le salon de la suite, aux tons bleu-vert et mobilier chiné, ouvre le séjour sur l’esprit alpin du palace.',
    caption_en:
      'The suite living room, in blue-green tones with antique furniture, opens the stay onto the palace’s alpine spirit.',
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
    alt_fr: 'Table dressée sous les vitraux, Les Airelles Courchevel',
    alt_en: 'Table set beneath stained glass, Les Airelles Courchevel',
    caption_fr:
      'La table dressée sous les vitraux colorés prolonge le décor château jusque dans l’assiette.',
    caption_en:
      'The table set beneath coloured stained glass carries the castle décor onto the plate.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-12',
    category: 'room',
    alt_fr: 'Chambre de Les Airelles Courchevel, rideaux rouges sur la neige',
    alt_en: 'Room at Les Airelles Courchevel, red drapes onto the snow',
    caption_fr:
      'Les rideaux de velours rouge encadrent une fenêtre ouverte sur les sapins enneigés de Courchevel 1850.',
    caption_en: 'Red velvet drapes frame a window onto the snow-laden firs of Courchevel 1850.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-13',
    category: 'detail',
    alt_fr: 'Salle de bain d’une chambre, Les Airelles Courchevel',
    alt_en: 'Room bathroom at Les Airelles Courchevel',
    caption_fr:
      'La salle de bain marie papier peint fleuri, baignoire et marbre — le confort palace jusque dans les détails.',
    caption_en:
      'The bathroom marries floral wallpaper, a bathtub and marble — palace comfort down to the details.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-15',
    category: 'pool',
    alt_fr: 'Piscine intérieure du spa cernée de verdure, Les Airelles Courchevel',
    alt_en: 'Greenery-framed indoor spa pool, Les Airelles Courchevel',
    caption_fr:
      'La piscine intérieure du spa, cernée de verdure, prolonge le rituel bien-être après une journée de ski.',
    caption_en:
      'The greenery-framed indoor spa pool extends the wellness ritual after a day on the slopes.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-16',
    category: 'pool',
    alt_fr: 'Piscine turquoise du Chalet 1908, Les Airelles Courchevel',
    alt_en: 'Turquoise pool at Chalet 1908, Les Airelles Courchevel',
    caption_fr:
      'Le Chalet 1908 offre piscine et transats privatifs pour les familles en quête d’intimité.',
    caption_en: 'Chalet 1908 offers a private pool and loungers for families seeking intimacy.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-17',
    category: 'exterior',
    alt_fr: 'Façade illuminée de Les Airelles Courchevel au crépuscule',
    alt_en: 'Illuminated facade of Les Airelles Courchevel at dusk',
    caption_fr:
      'Au crépuscule, les fenêtres du palace s’illuminent au-dessus des pistes enneigées du Jardin Alpin.',
    caption_en: 'At dusk, the palace windows light up above the snowy slopes of Le Jardin Alpin.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-18',
    category: 'view',
    alt_fr: 'Sommets enneigés de la Tarentaise depuis Les Airelles Courchevel',
    alt_en: 'Snow-capped Tarentaise peaks from Les Airelles Courchevel',
    caption_fr:
      'Le panorama porte sur les sommets enneigés de la Tarentaise et les 600 km de pistes des 3 Vallées.',
    caption_en:
      'The panorama sweeps over the snow-capped Tarentaise peaks and the 600 km of Three Valleys slopes.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-19',
    category: 'dining',
    alt_fr: 'Terrasse de restaurant face aux sommets, Les Airelles Courchevel',
    alt_en: 'Restaurant terrace facing the peaks, Les Airelles Courchevel',
    caption_fr:
      'La terrasse aux parasols rouges sert les déjeuners face aux sommets — pause ensoleillée entre deux descentes.',
    caption_en:
      'The red-parasol terrace serves lunch facing the peaks — a sunlit pause between two runs.',
    credit: 'Via Tolila',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-20',
    category: 'room',
    alt_fr: 'Chambre boisée de Les Airelles Courchevel, applique et lit',
    alt_en: 'Wood-clad bedroom at Les Airelles Courchevel, sconce and bed',
    caption_fr:
      'Le bois clair et le linge fin habillent une chambre tournée vers le calme du domaine skiable.',
    caption_en:
      'Pale wood and fine linen dress a bedroom turned toward the quiet of the ski domain.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-21',
    category: 'exterior',
    alt_fr: 'Tour du palace Les Airelles Courchevel au coucher du soleil',
    alt_en: 'Palace turret of Les Airelles Courchevel at sunset',
    caption_fr:
      'La tour austro-hongroise du palace se découpe sur le ciel rose de Courchevel 1850 au crépuscule.',
    caption_en:
      'The palace’s Austro-Hungarian turret cuts against the pink Courchevel 1850 sky at dusk.',
    credit: 'Via Tolila',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-22',
    category: 'pool',
    alt_fr: 'Piscine intérieure voûtée du spa, Les Airelles Courchevel',
    alt_en: 'Vaulted indoor spa pool, Les Airelles Courchevel',
    caption_fr:
      'La piscine intérieure voûtée, bordée de transats, ancre le Spa Airelles by La Mer au cœur du palace.',
    caption_en:
      'The vaulted indoor pool, lined with loungers, anchors Spa Airelles by La Mer at the heart of the palace.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-23',
    category: 'detail',
    alt_fr: 'Boutique de mode alpine, Les Airelles Courchevel',
    alt_en: 'Alpine fashion boutique, Les Airelles Courchevel',
    caption_fr:
      'La boutique du palace présente mode alpine et accessoires dans un écrin de bois et de velours rouge.',
    caption_en:
      'The palace boutique presents alpine fashion and accessories in a wood-and-red-velvet setting.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-24',
    category: 'dining',
    alt_fr: 'Comptoir gourmand avec chef, Les Airelles Courchevel',
    alt_en: 'Gourmet counter with chef, Les Airelles Courchevel',
    caption_fr:
      'Au comptoir, le chef dresse une sélection de mets — la cuisine du palace se vit aussi en tête-à-tête.',
    caption_en:
      'At the counter, the chef plates a selection of dishes — the palace kitchen also plays out one-to-one.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-25',
    category: 'events',
    alt_fr: 'Ambiance après-ski en altitude, Les Airelles Courchevel',
    alt_en: 'Après-ski atmosphere at altitude, Les Airelles Courchevel',
    caption_fr:
      'L’après-ski en altitude réunit les hôtes autour de la fête, face aux sommets de Courchevel.',
    caption_en:
      'High-altitude après-ski gathers guests around the party, facing the Courchevel peaks.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-26',
    category: 'events',
    alt_fr: 'Sortie en motoneige, Les Airelles Courchevel',
    alt_en: 'Snowmobile outing, Les Airelles Courchevel',
    caption_fr:
      'La conciergerie orchestre motoneige, chiens de traîneau et patinoire — les expériences hivernales du palace.',
    caption_en:
      'The concierge arranges snowmobile, dog-sled and ice-rink outings — the palace’s winter experiences.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-27',
    category: 'events',
    alt_fr: 'Cours de ski en famille, Winter Camp, Les Airelles Courchevel',
    alt_en: 'Family ski lesson, Winter Camp, Les Airelles Courchevel',
    caption_fr:
      'Le Winter Camp initie les enfants au ski sur le Jardin Alpin, skis aux pieds depuis le palace.',
    caption_en:
      'Winter Camp introduces children to skiing on Le Jardin Alpin, ski-in from the palace.',
    credit: 'Airelles',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-28',
    category: 'dining',
    alt_fr: 'Salle à manger du palace sous les lustres, Les Airelles Courchevel',
    alt_en: 'Palace dining room beneath chandeliers, Les Airelles Courchevel',
    caption_fr:
      'Sous les lustres dorés, la salle à manger dresse ses tables pour les dîners aux chandelles du palace.',
    caption_en:
      'Beneath gilded chandeliers, the dining room sets its tables for the palace’s candlelit dinners.',
    credit: 'Vincent Leroux',
  },
  {
    public_id: 'cct/hotels/les-airelles-courchevel/press-29',
    category: 'events',
    alt_fr: 'Enfants en tenue de ski au pied du palace, Les Airelles Courchevel',
    alt_en: 'Children in ski gear at the foot of the palace, Les Airelles Courchevel',
    caption_fr:
      'Le Winter Camp accompagne les enfants sur les pistes — la maison cultive l’esprit famille en altitude.',
    caption_en:
      'Winter Camp guides children onto the slopes — the house cultivates a family spirit at altitude.',
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

/**
 * Provenance URLs (assets.airelles.com DAM). 29 entries to match the manifest.
 * NB: this array is upload-order provenance only and is intentionally NOT
 * re-aligned to the current public_ids — the live pixels are corrected by
 * re-categorising the manifest above, not by re-uploading.
 */
const ARL_CV_IMGIX = 'https://assets.airelles.com/images/airelles2023/';
const ARL_CV_IMGIX_Q = '?auto=format%2Ccompress&w=2600';

export const LES_AIRELLES_COURCHEVEL_GALLERY_PRESS_SLOT_URLS = [
  `${ARL_CV_IMGIX}abwDDbbci2UF6Rqd_VIDEOHEADERHOMEARL.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqINp5xUNkB1OKW_ARL-Vuemontagne%C2%A9YoannetMarco.jpg${ARL_CV_IMGIX_Q}`,
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
  `${ARL_CV_IMGIX}aNzWJJ5xUNkB1Ujy_SPA.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZjoJh0MTzAJOCmvG_Moyen-Piscine-Vued%27ensemble-1.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqCCZ5xUNkB1OFK_4m.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqCgp5xUNkB1OFX_lastm.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZgPr27LRO5ile6wB_LesAirelles-BoutiqueV%26L.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aQMnHrpReVYa30xx_ARL-Service-TabledesAirelles%C2%A9Yoannetmarco.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZuQVhrVsGrYSvVEv_ChaletdePierres-Terrasse%C2%A9ViaTolila.-2.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zkxhmiol0Zci9T4T_Chambres%26Suites.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNqBhZ5xUNkB1OEm_1m.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aNup2Z5xUNkB1Q6I_4m.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0K2nNYClf9o0Yr_ARL-FOLIEDOUCE.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}Zes593Uurf2G3N5n_ARL-MotoneigeExpe%CC%81rience.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}ZgPrBrLRO5ile6vt_Patinoire.jpeg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0M6HNYClf9o0Z3_ARL-Salle-Palladio%C2%A9VincentLeroux-2.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aQtMirpReVYa4F1T_ShootingExportWebseq3-8.jpg${ARL_CV_IMGIX_Q}`,
  `${ARL_CV_IMGIX}aV0M6HNYClf9o0Z3_ARL-Salle-Palladio%C2%A9VincentLeroux-1.jpg${ARL_CV_IMGIX_Q}`,
] as const;

export const LES_AIRELLES_COURCHEVEL_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  LES_AIRELLES_COURCHEVEL_GALLERY_PRESS_SLOT_URLS,
  LES_AIRELLES_COURCHEVEL_HERO_SOURCE_URL,
);

/** Honest categories represented in the manifest (no genuine spa-treatment pixel survives). */
export const LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'pool',
  'view',
  'detail',
  'events',
] as const;
