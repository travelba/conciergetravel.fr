/**
 * Phase 3 — curated 25-image gallery manifest for `le-bristol-paris`.
 *
 * CDC §2.2 kit (2026-06-10) — 5 UI categories × 5 photos :
 * Vue, Chambres, Piscine, Restaurant, Spa. Hero Vue is separate (`hero`).
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-le-bristol-paris-gallery-batch.ts`.
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const LE_BRISTOL_PARIS_HERO_IMAGE = 'cct/hotels/le-bristol-paris/hero';

export const LE_BRISTOL_PARIS_HERO_SOURCE_URL =
  'https://images.eu.ctfassets.net/og3b0tarlg4b/5uEX9ekdox5yk5J8dMGXqb/58e5e0430bad1714c9d14bec3f83367b/Le_Bristol_Paris_-_Fa%C3%83_ade_cot%C3%83__jardin_Fran%C3%83_ais_-_Romain_R%C3%83_glade.jpg?w=1900&h=1450&fm=jpg&fit=fill';

export const LE_BRISTOL_PARIS_GALLERY_IMAGES = [
  /* ── Vue ×5 (press-1…5) ── */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-1',
    category: 'view',
    alt_fr: 'Façade néoclassique du Le Bristol Paris, rue du Faubourg Saint-Honoré',
    alt_en: 'Neoclassical facade of Le Bristol Paris on Rue du Faubourg Saint-Honoré',
    caption_fr:
      'La façade en pierre de taille du palace s’inscrit discrètement sur le Faubourg Saint-Honoré, à deux pas de l’Élysée.',
    caption_en:
      'The palace’s ashlar facade sits discreetly on Faubourg Saint-Honoré, steps from the Élysée.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-2',
    category: 'view',
    alt_fr: 'Entrée du Le Bristol Paris, palace Oetker Collection',
    alt_en: 'Entrance of Le Bristol Paris, Oetker Collection palace',
    caption_fr:
      'L’entrée du palace ouvre sur l’une des adresses les plus confidentielles du 8e arrondissement.',
    caption_en:
      'The palace entrance opens onto one of the most discreet addresses in the 8th arrondissement.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-3',
    category: 'view',
    alt_fr: 'Vue extérieure du Le Bristol Paris, hôtel particulier du XVIIIe siècle',
    alt_en: 'Exterior view of Le Bristol Paris, 18th-century town house',
    caption_fr:
      'L’hôtel particulier du comte de Castellane compose la silhouette du palace sur le Faubourg Saint-Honoré.',
    caption_en:
      'Count de Castellane’s town house forms the palace silhouette on Faubourg Saint-Honoré.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-4',
    category: 'view',
    alt_fr: 'Façade et jardin à la française, Le Bristol Paris',
    alt_en: 'Facade and French garden, Le Bristol Paris',
    caption_fr:
      'La façade côté jardin dévoile les balcons et le parc à la française — 1 200 m² de verdure en plein Paris.',
    caption_en:
      'The garden-side facade reveals balconies and the French garden — 1,200 sq m of greenery in central Paris.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-5',
    category: 'view',
    alt_fr: 'Terrasse privée plantée de la Suite Azur, Le Bristol Paris',
    alt_en: 'Planted private terrace of the Suite Azur, Le Bristol Paris',
    caption_fr:
      'La terrasse privée plantée de la Suite Azur ouvre sur le jardin du palace — un balcon de verdure en plein 8e.',
    caption_en:
      'The Suite Azur’s planted private terrace opens onto the palace garden — a green balcony in the 8th arrondissement.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  /* ── Chambres ×5 (press-6…10) ── */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-6',
    category: 'room',
    alt_fr: 'Chambre Deluxe du Le Bristol Paris, mobilier Louis XV',
    alt_en: 'Deluxe Room at Le Bristol Paris, Louis XV furniture',
    caption_fr:
      'La chambre Deluxe porte la signature Bristol : tissus Pierre Frey, mobilier d’époque et salle de bain en marbre.',
    caption_en:
      'The Deluxe Room carries the Bristol signature: Pierre Frey fabrics, period furniture and a marble bathroom.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-7',
    category: 'room',
    alt_fr: 'Chambre Executive du Le Bristol Paris',
    alt_en: 'Executive Room at Le Bristol Paris',
    caption_fr:
      'La chambre Executive conjugue volumes généreux et confort contemporain dans le décor XVIIIe du palace.',
    caption_en:
      'The Executive Room combines generous volumes and contemporary comfort in the palace’s 18th-century décor.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-8',
    category: 'room',
    alt_fr: 'Chambre Deluxe vue jardin, Le Bristol Paris',
    alt_en: 'Deluxe Room garden view, Le Bristol Paris',
    caption_fr:
      'Côté jardin, la chambre Deluxe ouvre sur les 1 200 m² de verdure — un luxe rare en plein Paris.',
    caption_en:
      'On the garden side, the Deluxe Room opens onto 1,200 sq m of greenery — a rare luxury in central Paris.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-9',
    category: 'room',
    alt_fr: 'Chambre Supérieure du Le Bristol Paris',
    alt_en: 'Superior Room at Le Bristol Paris',
    caption_fr:
      'La chambre Supérieure offre l’essentiel Bristol : confort feutré, linge fin et service discret.',
    caption_en:
      'The Superior Room offers Bristol essentials: hushed comfort, fine linen and discreet service.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-10',
    category: 'room',
    alt_fr: 'Suite Deluxe balcon, Le Bristol Paris',
    alt_en: 'Deluxe Suite with balcony, Le Bristol Paris',
    caption_fr:
      'La Suite Deluxe balcon déploie un salon séparé et une terrasse sur les toits parisiens.',
    caption_en:
      'The Deluxe Suite with balcony offers a separate living room and a terrace over Paris rooftops.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  /* ── Piscine (press-12 — seule piscine réelle du palace : rooftop intérieure) ── */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-12',
    category: 'pool',
    alt_fr: 'Piscine intérieure rooftop en acajou, Le Bristol Paris',
    alt_en: 'Mahogany rooftop indoor pool, Le Bristol Paris',
    caption_fr:
      'Au 6e étage, la piscine intérieure habillée d’acajou surplombe les toits — Tour Eiffel, Montmartre et Sacré-Cœur.',
    caption_en:
      'On the 6th floor, the mahogany-lined indoor pool overlooks the rooftops — Eiffel Tower, Montmartre and Sacré-Cœur.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  /* press-11, press-13, press-14 retirés (2026-06-16) : piscines extérieures
   * méditerranéennes mal attribuées — Le Bristol n’a qu’une piscine intérieure.
   * Voir docs honnêteté galerie kit. */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-15',
    category: 'view',
    alt_fr: 'Vue aérienne du Le Bristol Paris et de son jardin à la française',
    alt_en: 'Aerial view of Le Bristol Paris and its French garden',
    caption_fr:
      'Vue aérienne du palace : la façade classique encadre les 1 200 m² du jardin à la française, rare en plein Paris.',
    caption_en:
      'Aerial view of the palace: the classical facade frames the 1,200 sq m French garden, rare in central Paris.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  /* ── Restaurant ×5 (press-16…20) ── */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-16',
    category: 'dining',
    alt_fr: 'Salle Epicure du Le Bristol Paris, 3 étoiles MICHELIN',
    alt_en: 'Epicure dining room at Le Bristol Paris, 3 MICHELIN Stars',
    caption_fr:
      'Epicure, table trois étoiles MICHELIN d’Arnaud Faye, sert une cuisine française d’exception face au jardin.',
    caption_en:
      'Epicure, Arnaud Faye’s three-MICHELIN-star table, serves outstanding French cuisine facing the garden.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-17',
    category: 'dining',
    alt_fr: 'Détail de table Epicure, Le Bristol Paris',
    alt_en: 'Epicure table detail, Le Bristol Paris',
    caption_fr:
      'Les tables Epicure portent la même exigence florale et la vaisselle de la maison — chaque service est scénographié.',
    caption_en:
      'Epicure tables share the same floral standard and house tableware — every service is staged.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-18',
    category: 'dining',
    alt_fr: '114 Faubourg, brasserie étoilée du Le Bristol Paris',
    alt_en: '114 Faubourg, starred brasserie at Le Bristol Paris',
    caption_fr:
      '114 Faubourg, une étoile MICHELIN, revisite la brasserie parisienne sous la direction de Vincent Schmit.',
    caption_en:
      '114 Faubourg, one MICHELIN Star, reworks the Parisian brasserie under Vincent Schmit.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-19',
    category: 'dining',
    alt_fr: 'Le Bar du Bristol, cocktails et musique live',
    alt_en: 'Le Bar du Bristol, cocktails and live music',
    caption_fr:
      'Le Bar du Bristol sert cocktails signature et snacking jeudi à samedi, 18 h–2 h — rendez-vous du palace.',
    caption_en:
      'Le Bar du Bristol serves signature cocktails and light bites Thursday to Saturday, 6 pm–2 am — a palace rendezvous.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-20',
    category: 'dining',
    alt_fr: 'Le Jardin Français, terrasse végétale du Le Bristol Paris',
    alt_en: 'Le Jardin Français planted terrace at Le Bristol Paris',
    caption_fr:
      'Le Jardin Français sert déjeuner, afternoon tea et dîner au cœur du jardin à la française du palace.',
    caption_en:
      'Le Jardin Français serves lunch, afternoon tea and dinner at the heart of the palace’s French garden.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  /* ── Spa + chambres signature (press-21…25) — un seul vrai espace bien-être ── */
  {
    public_id: 'cct/hotels/le-bristol-paris/press-21',
    category: 'room',
    alt_fr: 'Chambre Deluxe 102, Le Bristol Paris',
    alt_en: 'Deluxe Room 102, Le Bristol Paris',
    caption_fr:
      'La chambre Deluxe 102 décline les codes du palace — tissus Pierre Frey, lit habillé et lumière du Faubourg.',
    caption_en:
      'Deluxe Room 102 reprises the palace codes — Pierre Frey fabrics, a dressed bed and Faubourg light.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-22',
    category: 'spa',
    alt_fr: 'Spa Le Bristol by La Mer — bassin et table de massage de la Suite Eden',
    alt_en: 'Spa Le Bristol by La Mer — Suite Eden plunge pool and massage table',
    caption_fr:
      'La Suite Eden abrite un espace bien-être privé : bassin de nage à contre-courant et table de massage face au jardin suspendu.',
    caption_en:
      'Suite Eden holds a private wellness space: counter-current plunge pool and massage table facing the suspended garden.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-23',
    category: 'lobby',
    alt_fr: 'Salon du Le Bristol Paris, tapisserie et mobilier d’époque',
    alt_en: 'Salon at Le Bristol Paris, tapestry and period furniture',
    caption_fr:
      'Le salon du palace réunit tapisserie ancienne et mobilier d’époque — l’un des décors signés Castellane.',
    caption_en:
      'The palace salon gathers an antique tapestry and period furniture — one of the Castellane settings.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-24',
    category: 'room',
    alt_fr: 'Coin salon d’une chambre du Le Bristol Paris',
    alt_en: 'Sitting corner of a room at Le Bristol Paris',
    caption_fr:
      'Le coin salon de la chambre prolonge le confort feutré du palace — fauteuil, photographie et lumière tamisée.',
    caption_en:
      'The room’s sitting corner extends the palace’s hushed comfort — armchair, photograph and soft light.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-25',
    category: 'room',
    alt_fr: 'Suite Penthouse du Le Bristol Paris, balcon sur le Sacré-Cœur',
    alt_en: 'Penthouse Suite at Le Bristol Paris, balcony over Sacré-Cœur',
    caption_fr:
      'La Suite Penthouse coiffe le palace — salon, terrasse et balcon ouvert sur le Sacré-Cœur et les toits parisiens.',
    caption_en:
      'The Penthouse Suite crowns the palace — living room, terrace and a balcony onto Sacré-Cœur and the Paris rooftops.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
] as const;

/** CDC §2.2 kit — 5 UI filter categories. */
const BRISTOL_OETKER = 'https://images.eu.ctfassets.net/og3b0tarlg4b';

const BRISTOL_OFFICIAL = {
  facadeEntrance: `${BRISTOL_OETKER}/5F6sNJ5it0MWdqYr7KFkt1/30da2ea85376d65a46efa6762c0ced17/Le_Bristol_Paris_-_Fa%C3%83_ade_hotel_-_%C3%82__Claire_Cocano.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeStreet: `${BRISTOL_OETKER}/17kzsE8zKgleIZ0eaiVfX9/d7121bd292fe66fd1ab2003fdafe008b/Le_Bristol_Paris_-_Fa%C3%83_ade_aUv0g.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeBalconies: `${BRISTOL_OETKER}/3UPVsxiIsgajPJrbTy0pwU/b078ad1e4de28c7577c395d3d0b66321/Le_Bristol_Paris_-_Fa%C3%83_ade_cot%C3%83__jardin_Fran%C3%83_ais__-_Romain_R%C3%83_glade.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  exteriorPoolGlimpse: `${BRISTOL_OETKER}/2SRV5n9lzeXwWAGySdlyvN/59b425a6eb1cd00aa075b3578cb895cb/Design_sans_titre__34_.jpg?w=3200&h=2380&fm=jpg&fit=fill`,
  suiteAzurTerrace: `${BRISTOL_OETKER}/5IMHSGRbvjvdH2KtvKirRw/56a3444ba21ab093afc613e0227083e3/room-10TERS-image-kq80dj-Le_Bristol_Paris_-_Suite_Azur__955_-__RomainRicard__RfTt6_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  roomDeluxe: `${BRISTOL_OETKER}/3kEAPllp0GbNdm59DzK8yJ/be39a9c501dc750ea169385d97891440/room-03DLX-image-Le_Bristol_Paris-DLX-135-HD-1_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomExecutive: `${BRISTOL_OETKER}/5ByCvLdrYKAvNyW5r3eJut/1b943c74bd8298fe84f93e0d4d97ac90/room-EXE-image-s5iwx0-Le_Bristol_Paris_-_Chambre_612_-___Claire_Cocano_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomDeluxeGarden: `${BRISTOL_OETKER}/5TTLX90ke1oNjcZgHQCb9p/bd42d41a23ae467f860a6d8227ff6b8e/room-03DLXG-image-bfwjp6-Le_Bristol_Paris-DLXG-Chambre_222-HD-4_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomSuperior: `${BRISTOL_OETKER}/6ckH5Wiz5wqQeCs0IoO88O/331c95383eb3b849277fb57478153c7e/room-02SUP-image-ncawvj-Le_Bristol_Paris-Chambre_Sup_rieure-523-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  deluxeSuiteBalcon: `${BRISTOL_OETKER}/59NIxWxsJlUXcuU3hzk5sp/1af6ab0d84bab96a874964eb4cbbac1c/room-SDLXB-image-ajeod3-Le_Bristol_Paris_-_Suite_Deluxe_balcon___602_-___Claire_C_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  poolDeck: `${BRISTOL_OETKER}/VHOVfKecKmbQJxivbOvqC/bbc8abd436701874efcb284db9109eea/Via_Tolila_-1107630__1_.jpg?w=1080&h=1260&fm=jpg&fit=fill`,
  poolRooftop: `${BRISTOL_OETKER}/6fgByOQTpvcw1xRi8tm6Jh/1a3aeeeb9702cb4279524af80b88a180/Untitled_design__7_.png?w=2340&h=902&fm=png&fit=fill`,
  poolCourtyard: `${BRISTOL_OETKER}/4uk5oU3b9qln0MLBZPxW6F/44b3698f1aaaea4078d2f51c12454e61/Design_sans_titre__43_.jpg?w=640&h=848&fm=jpg&fit=fill`,
  poolGarden: `${BRISTOL_OETKER}/7yTbWFNjpllHJ12P5gy0UF/aa82bc7692f65f9a5607d12b4ac4b684/Hotel_settings_image_-_1290_x_1710.jpg?w=2160&h=2520&fm=jpg&fit=fill`,
  suitePanoramique: `${BRISTOL_OETKER}/3u6johFlyxJIxS3FxmABSV/077654b54beb801c8e1bd2960bc27ff1/Le_Bristol_Paris_-_Suite_Panoramique_%C3%82_Romain_Ricard.jpeg?w=1900&h=1450&fm=jpg&fit=fill`,
  epicure: `${BRISTOL_OETKER}/2zeQObmBb7F3yrPsajCrko/0d2940dc30b57505afd6c4cf06d0cbbd/Salle_Epicure_-Pierre_Ba%C3%83_len__19_.jpg?w=2880&h=1112&fm=jpg&fit=fill`,
  epicureDetail: `${BRISTOL_OETKER}/2FGNRPJZwdHeQ0ChdvMcyp/c181bd094272c6c1a161afa352489307/Salle_Epicure_-Pierre_Ba%C3%83_len__2_.JPG?w=896&h=1194&fm=jpg&fit=fill`,
  faubourg114: `${BRISTOL_OETKER}/3Jthlx1kWoJgo4ciejTHbC/fdd7ec4c688b2c59c8d056d2f1085541/Le_Brisrtol_114%C3%82_RomainRicard-1.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  lobbyBar: `${BRISTOL_OETKER}/27blEI5zKTk2ZV8y9Iys0m/31d1ff39ce5fc1ae56abb6e9bbc2d20c/Le_Bristol_Paris_-_Bar_-_%C3%82_Stetten_Wilson_Photography_Wbamw.jpeg?w=896&h=1194&fm=jpg&fit=fill`,
  jardinFrancais: `${BRISTOL_OETKER}/1wfjJyy8HozQOuatmOtjtT/be9519c2d72b9807a250b438b65d085d/Le_Jardin_Fran%C3%83_ais_LBP_x_Schumacher_-_%C3%82_Vincent_Leroux__6rmUd.jpg?w=3200&h=2380&fm=jpg&fit=fill`,
  suiteEdenWellness: `${BRISTOL_OETKER}/5N67rO1TxjwDczzilOm4rO/f0fafea568a84e2b860c003862bfe060/Le_Bristol_Paris_-_Chambre_Deluxe_-_102_uncO8.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  suiteEdenFranck: `${BRISTOL_OETKER}/1CT2wpl7Q6Rfo1w5zrTPjH/83520a9ef2dc526401cdce68aa9e52ef/room-10TERX-image-LBP_-_SUITE_EDEN_-_FRANCK_BOHBOT_-_1_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  roomDeluxe102: `${BRISTOL_OETKER}/5N67rO1TxjwDczzilOm4rO/f0fafea568a84e2b860c003862bfe060/Le_Bristol_Paris_-_Chambre_Deluxe_-_102_uncO8.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  lobbyTapestry: `${BRISTOL_OETKER}/qGU8OBRCZe0gLfpY807rY/fd5f6ba0986dca3c47e6e8e9816040b1/Le_Bristol_Paris_-_Livre_Flammarion_-100_ans_-_Lobby_%C3%82_Claire_Cocano_.jpeg?w=1900&h=1450&fm=jpg&fit=fill`,
  roomLoungeCorner: `${BRISTOL_OETKER}/HLBZs7GBDCTwoGcIkXilA/5a3929e670646e9a63eac761b1791e65/room-03DLXG-image-2jsdqn-Le_Bristol_Paris-DLXG-Chambre_222-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  suitePenthouse: `${BRISTOL_OETKER}/3f0j4T70JRvohqp0GGGBLC/5fc6731aabe7d146610689b80c4d1cb0/room-12PENT-image-agxwyv-Le_Bristol_Paris_-_Suite_Penthouse_-___Claire_Cocano_-_HD_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
} as const;

/** 25 unique official URLs — one canonical path per press slot (hero excluded). */
export const LE_BRISTOL_PARIS_GALLERY_PRESS_SLOT_URLS = [
  BRISTOL_OFFICIAL.facadeEntrance,
  BRISTOL_OFFICIAL.facadeStreet,
  BRISTOL_OFFICIAL.facadeBalconies,
  BRISTOL_OFFICIAL.exteriorPoolGlimpse,
  BRISTOL_OFFICIAL.suiteAzurTerrace,
  BRISTOL_OFFICIAL.roomDeluxe,
  BRISTOL_OFFICIAL.roomExecutive,
  BRISTOL_OFFICIAL.roomDeluxeGarden,
  BRISTOL_OFFICIAL.roomSuperior,
  BRISTOL_OFFICIAL.deluxeSuiteBalcon,
  // press-11/13/14 retirés : piscines extérieures méditerranéennes mal
  // attribuées (Le Bristol n'a qu'une piscine intérieure = poolRooftop).
  BRISTOL_OFFICIAL.poolRooftop,
  BRISTOL_OFFICIAL.suitePanoramique,
  BRISTOL_OFFICIAL.epicure,
  BRISTOL_OFFICIAL.epicureDetail,
  BRISTOL_OFFICIAL.faubourg114,
  BRISTOL_OFFICIAL.lobbyBar,
  BRISTOL_OFFICIAL.jardinFrancais,
  BRISTOL_OFFICIAL.suiteEdenWellness,
  BRISTOL_OFFICIAL.suiteEdenFranck,
  BRISTOL_OFFICIAL.lobbyTapestry,
  BRISTOL_OFFICIAL.roomLoungeCorner,
  BRISTOL_OFFICIAL.suitePenthouse,
] as const;

export const LE_BRISTOL_PARIS_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  LE_BRISTOL_PARIS_GALLERY_PRESS_SLOT_URLS,
  LE_BRISTOL_PARIS_HERO_SOURCE_URL,
);

/** Honest filter categories represented in the manifest (no fabricated pool/spa padding). */
export const LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES = [
  'view',
  'room',
  'lobby',
  'pool',
  'dining',
  'spa',
] as const;
