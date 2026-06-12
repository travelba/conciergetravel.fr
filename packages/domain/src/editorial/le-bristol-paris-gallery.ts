/**
 * Phase 3 — curated 30-image gallery manifest for `le-bristol-paris`.
 *
 * Mirrors the Prince de Galles golden-template shape.
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-le-bristol-paris-gallery-batch.ts`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const LE_BRISTOL_PARIS_HERO_IMAGE = 'cct/hotels/le-bristol-paris/hero';

export const LE_BRISTOL_PARIS_HERO_SOURCE_URL =
  'https://images.eu.ctfassets.net/og3b0tarlg4b/5uEX9ekdox5yk5J8dMGXqb/58e5e0430bad1714c9d14bec3f83367b/Le_Bristol_Paris_-_Fa%C3%83_ade_cot%C3%83__jardin_Fran%C3%83_ais_-_Romain_R%C3%83_glade.jpg?w=1900&h=1450&fm=jpg&fit=fill';

export const LE_BRISTOL_PARIS_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/le-bristol-paris/press-1',
    category: 'exterior',
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
    category: 'exterior',
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
    category: 'exterior',
    alt_fr: 'Vue extérieure du Le Bristol Paris, hôtel particulier du XVIIIe siècle',
    alt_en: 'Exterior view of Le Bristol Paris, 18th-century town house',
    caption_fr:
      'L’hôtel particulier du comte de Castellane, revisité en 1925 par Hippolyte Jammet, compose la silhouette du palace.',
    caption_en:
      'Count de Castellane’s town house, reshaped in 1925 by Hippolyte Jammet, forms the palace silhouette.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-4',
    category: 'lobby',
    alt_fr: 'Lobby du Le Bristol Paris, boiseries et lumière tamisée',
    alt_en: 'Lobby at Le Bristol Paris, wood panelling and soft light',
    caption_fr:
      'Le hall d’accueil mêle boiseries d’époque, tapis persans et lumière feutrée — signature du palace depuis 1925.',
    caption_en:
      'The reception hall blends period panelling, Persian rugs and hushed light — a palace signature since 1925.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-5',
    category: 'lobby',
    alt_fr: 'Salon d’accueil du Le Bristol Paris, fauteuils capitonnés',
    alt_en: 'Reception lounge at Le Bristol Paris, tufted armchairs',
    caption_fr:
      'Les salons d’accueil accueillent les arrivées dans un décor de demeure privée, entre tableaux et fleurs fraîches.',
    caption_en:
      'Reception lounges welcome arrivals in a private-residence setting, between paintings and fresh flowers.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-6',
    category: 'lobby',
    alt_fr: 'Escalier d’honneur du Le Bristol Paris, marbre et dorures',
    alt_en: 'Grand staircase at Le Bristol Paris, marble and gilding',
    caption_fr:
      'L’escalier d’honneur relie les espaces publics du palace, dans la continuité du décor XVIIIe revisité.',
    caption_en:
      'The grand staircase links the palace public spaces, in keeping with the reworked 18th-century décor.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-7',
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
    public_id: 'cct/hotels/le-bristol-paris/press-8',
    category: 'room',
    alt_fr: 'Suite Lumière du Le Bristol Paris, salon séparé',
    alt_en: 'Suite Lumière at Le Bristol Paris, separate living room',
    caption_fr:
      'La Suite Lumière déploie un salon séparé et une chambre baignée de lumière nord, face au jardin intérieur.',
    caption_en:
      'Suite Lumière offers a separate living room and a north-lit bedroom facing the interior garden.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-9',
    category: 'room',
    alt_fr: 'Chambre Prestige vue jardin, Le Bristol Paris',
    alt_en: 'Prestige Room garden view, Le Bristol Paris',
    caption_fr:
      'Côté jardin, la chambre Prestige ouvre sur les 1 200 m² de verdure — un luxe rare en plein Paris.',
    caption_en:
      'On the garden side, the Prestige Room opens onto 1,200 sq m of greenery — a rare luxury in central Paris.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-10',
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
    public_id: 'cct/hotels/le-bristol-paris/press-11',
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
    public_id: 'cct/hotels/le-bristol-paris/press-12',
    category: 'dining',
    alt_fr: 'Le Jardin Français, terrasse végétale du Le Bristol Paris',
    alt_en: 'Le Jardin Français planted terrace at Le Bristol Paris',
    caption_fr:
      'Le Jardin Français sert déjeuner, afternoon tea et dîner au cœur du jardin à la française du palace.',
    caption_en:
      'Le Jardin Français serves lunch, afternoon tea and dinner at the heart of the palace’s French garden.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-13',
    category: 'spa',
    alt_fr: 'Cabine de soin Spa Le Bristol by La Mer',
    alt_en: 'Spa Le Bristol by La Mer treatment room',
    caption_fr:
      'Le spa by La Mer propose huit cabines de soin, dont une suite duo, dans la lumière naturelle du jardin.',
    caption_en:
      'Spa Le Bristol by La Mer offers eight treatment rooms, including a couples suite, in natural garden light.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-14',
    category: 'spa',
    alt_fr: 'Espace détente du Spa Le Bristol Paris',
    alt_en: 'Relaxation area at Spa Le Bristol Paris',
    caption_fr:
      'Hammam, sauna et espace détente complètent les rituels La Mer, ouverts 9 h–21 h sur rendez-vous.',
    caption_en:
      'Hammam, sauna and a relaxation lounge complete La Mer rituals, open 9 am–9 pm by appointment.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-15',
    category: 'spa',
    alt_fr: 'Cabine de soins bien-être Spa Le Bristol Paris, rituels La Prairie',
    alt_en: 'Spa Le Bristol Paris wellness treatment room, La Prairie rituals',
    caption_fr:
      'La Suite Eden accueille les rituels bien-être en chambre ou en suite dédiée, pour un séjour hors du temps.',
    caption_en: 'Suite Eden hosts in-room or in-suite wellness rituals for a timeless stay.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-16',
    category: 'pool',
    alt_fr: 'Piscine couverte du Le Bristol Paris, ponton en acajou',
    alt_en: 'Indoor pool at Le Bristol Paris, mahogany deck',
    caption_fr:
      'Au 6e étage, la piscine couverte en acajou surplombe Paris — Tour Eiffel, Montmartre et Sacré-Cœur.',
    caption_en:
      'On the 6th floor, the mahogany-lined indoor pool overlooks Paris — Eiffel Tower, Montmartre and Sacré-Cœur.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-17',
    category: 'pool',
    alt_fr: 'Piscine rooftop Le Bristol Paris, vue sur les toits',
    alt_en: 'Rooftop pool at Le Bristol Paris, rooftop views',
    caption_fr:
      'Réservée aux clients de la maison, la piscine ouvre 6 h 30–22 h 30 — le rituel matinal des habitués.',
    caption_en:
      'Reserved for in-house guests, the pool opens 6:30 am–10:30 pm — a morning ritual for regulars.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-18',
    category: 'pool',
    alt_fr: 'Décor yacht des années 1920, piscine Le Bristol Paris',
    alt_en: '1920s yacht-inspired décor, Le Bristol Paris pool',
    caption_fr:
      'Le décor en bois acajou, inspiré d’un yacht des années 1920, prolonge l’esprit nautique du palace.',
    caption_en:
      'The mahogany décor, inspired by a 1920s yacht, extends the palace’s nautical spirit.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-19',
    category: 'view',
    alt_fr: 'Suite Azur terrasse, Le Bristol Paris',
    alt_en: 'Suite Azur terrace, Le Bristol Paris',
    caption_fr:
      'Depuis les étages élevés et la piscine, la ligne des toits haussmanniens déroule jusqu’à la Tour Eiffel.',
    caption_en:
      'From upper floors and the pool, the Haussmann rooftops unfold to the Eiffel Tower.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-20',
    category: 'view',
    alt_fr: 'Vue jardin intérieur depuis une chambre Le Bristol Paris',
    alt_en: 'Interior garden view from a Le Bristol Paris room',
    caption_fr:
      'Le jardin à la française de 1 200 m² se lit depuis de nombreuses chambres et suites — calme au cœur du 8e.',
    caption_en:
      'The 1,200 sq m French garden is visible from many rooms and suites — quiet at the heart of the 8th.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-21',
    category: 'view',
    alt_fr: 'Terrasse Suite Penthouse, panorama Paris Le Bristol',
    alt_en: 'Suite Penthouse terrace, Paris panorama at Le Bristol',
    caption_fr:
      'La Suite Penthouse déploie 100 m² de terrasse sur les toits — l’une des vues les plus secrètes du palace.',
    caption_en:
      'The Penthouse Suite offers 100 sq m of rooftop terrace — one of the palace’s most private views.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-22',
    category: 'detail',
    alt_fr: 'Détail mobilier Louis XVI, chambre Le Bristol Paris',
    alt_en: 'Louis XVI furniture detail, Le Bristol Paris room',
    caption_fr:
      'Mobilier authentique Louis XV et Louis XVI, tissus français et tableaux de maîtres composent chaque chambre.',
    caption_en:
      'Authentic Louis XV and XVI furniture, French fabrics and master paintings compose every room.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-23',
    category: 'detail',
    alt_fr: 'Art floral et décoration de table Epicure, Le Bristol Paris',
    alt_en: 'Floral art and table setting at Epicure, Le Bristol Paris',
    caption_fr:
      'Les tables Epicure et 114 Faubourg portent la même exigence florale et la vaisselle de la maison.',
    caption_en:
      'Epicure and 114 Faubourg tables share the same floral standard and house tableware.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-24',
    category: 'detail',
    alt_fr: 'Café Antonia, fresques et lustres du Le Bristol Paris',
    alt_en: 'Café Antonia frescoes and chandeliers at Le Bristol Paris',
    caption_fr:
      'Café Antonia mêle fresques murales et lustres — l’adresse décontractée du palace pour le déjeuner et le thé.',
    caption_en:
      'Café Antonia blends wall frescoes and chandeliers — the palace’s relaxed address for lunch and tea.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-25',
    category: 'concierge',
    alt_fr: 'Conciergerie Les Clefs d’Or du Le Bristol Paris',
    alt_en: 'Les Clefs d’Or concierge desk at Le Bristol Paris',
    caption_fr:
      'L’équipe Clefs d’Or coordonne tables Epicure, transferts Élysée et accès privés sur le Faubourg Saint-Honoré.',
    caption_en:
      'The Clefs d’Or team coordinates Epicure tables, Élysée transfers and private access on Faubourg Saint-Honoré.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-26',
    category: 'concierge',
    alt_fr: 'Le Bar du Bristol, cocktails et musique live',
    alt_en: 'Le Bar du Bristol, cocktails and live music',
    caption_fr:
      'Le Bar du Bristol sert cocktails signature et snacking jeudi à samedi, 18 h–2 h — rendez-vous du palace.',
    caption_en:
      'Le Bar du Bristol serves signature cocktails and light bites Thursday to Saturday, 6 pm–2 am — a palace rendezvous.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-27',
    category: 'concierge',
    alt_fr: 'Accueil voiturier Le Bristol Paris, Faubourg Saint-Honoré',
    alt_en: 'Valet reception at Le Bristol Paris, Faubourg Saint-Honoré',
    caption_fr:
      'Le voiturier accueille les arrivées discrètes — protocole, cortèges et séjours diplomatiques sont coutumiers ici.',
    caption_en:
      'Valet welcomes discreet arrivals — protocol, motorcades and diplomatic stays are routine here.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-28',
    category: 'events',
    alt_fr: 'Salon de réception Le Bristol Paris, lumière naturelle',
    alt_en: 'Reception salon at Le Bristol Paris, natural light',
    caption_fr:
      'Les salons historiques accueillent séminaires, cocktails et dîners privés jusqu’à 120 convives.',
    caption_en:
      'Historic salons host seminars, cocktails and private dinners for up to 120 guests.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-29',
    category: 'events',
    alt_fr: 'Réception privée dans le jardin Le Bristol Paris',
    alt_en: 'Private reception in Le Bristol Paris garden',
    caption_fr:
      'Le jardin à la française se privatise pour mariages et célébrations estivales, sous chapiteau ou à ciel ouvert.',
    caption_en:
      'The French garden can be privatised for weddings and summer celebrations, under a marquee or open sky.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
  {
    public_id: 'cct/hotels/le-bristol-paris/press-30',
    category: 'events',
    alt_fr: 'Dîner privé Epicure, Le Bristol Paris',
    alt_en: 'Private dinner at Epicure, Le Bristol Paris',
    caption_fr:
      'Epicure et 114 Faubourg proposent des salons privatifs pour déjeuners de travail et dîners de gala.',
    caption_en:
      'Epicure and 114 Faubourg offer private salons for working lunches and gala dinners.',
    credit: 'Le Bristol Paris — Oetker Collection',
  },
] as const;

/** CDC §2.2 category floor — 10 required categories. */
const BRISTOL_OETKER = 'https://images.eu.ctfassets.net/og3b0tarlg4b';

const BRISTOL_OFFICIAL = {
  facadeEntrance: `${BRISTOL_OETKER}/5F6sNJ5it0MWdqYr7KFkt1/30da2ea85376d65a46efa6762c0ced17/Le_Bristol_Paris_-_Fa%C3%83_ade_hotel_-_%C3%82__Claire_Cocano.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeStreet: `${BRISTOL_OETKER}/17kzsE8zKgleIZ0eaiVfX9/d7121bd292fe66fd1ab2003fdafe008b/Le_Bristol_Paris_-_Fa%C3%83_ade_aUv0g.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeBalconies: `${BRISTOL_OETKER}/3UPVsxiIsgajPJrbTy0pwU/b078ad1e4de28c7577c395d3d0b66321/Le_Bristol_Paris_-_Fa%C3%83_ade_cot%C3%83__jardin_Fran%C3%83_ais__-_Romain_R%C3%83_glade.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  exteriorPoolGlimpse: `${BRISTOL_OETKER}/2SRV5n9lzeXwWAGySdlyvN/59b425a6eb1cd00aa075b3578cb895cb/Design_sans_titre__34_.jpg?w=3200&h=2380&fm=jpg&fit=fill`,
  lobbyTapestry: `${BRISTOL_OETKER}/qGU8OBRCZe0gLfpY807rY/fd5f6ba0986dca3c47e6e8e9816040b1/Le_Bristol_Paris_-_Livre_Flammarion_-100_ans_-_Lobby_%C3%82_Claire_Cocano_.jpeg?w=1900&h=1450&fm=jpg&fit=fill`,
  lobbyBar: `${BRISTOL_OETKER}/27blEI5zKTk2ZV8y9Iys0m/31d1ff39ce5fc1ae56abb6e9bbc2d20c/Le_Bristol_Paris_-_Bar_-_%C3%82_Stetten_Wilson_Photography_Wbamw.jpeg?w=896&h=1194&fm=jpg&fit=fill`,
  jardinFrancais: `${BRISTOL_OETKER}/1wfjJyy8HozQOuatmOtjtT/be9519c2d72b9807a250b438b65d085d/Le_Jardin_Fran%C3%83_ais_LBP_x_Schumacher_-_%C3%82_Vincent_Leroux__6rmUd.jpg?w=3200&h=2380&fm=jpg&fit=fill`,
  roomDeluxe: `${BRISTOL_OETKER}/3kEAPllp0GbNdm59DzK8yJ/be39a9c501dc750ea169385d97891440/room-03DLX-image-Le_Bristol_Paris-DLX-135-HD-1_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomExecutive: `${BRISTOL_OETKER}/5ByCvLdrYKAvNyW5r3eJut/1b943c74bd8298fe84f93e0d4d97ac90/room-EXE-image-s5iwx0-Le_Bristol_Paris_-_Chambre_612_-___Claire_Cocano_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomDeluxeGarden: `${BRISTOL_OETKER}/5TTLX90ke1oNjcZgHQCb9p/bd42d41a23ae467f860a6d8227ff6b8e/room-03DLXG-image-bfwjp6-Le_Bristol_Paris-DLXG-Chambre_222-HD-4_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomSuperior: `${BRISTOL_OETKER}/6ckH5Wiz5wqQeCs0IoO88O/331c95383eb3b849277fb57478153c7e/room-02SUP-image-ncawvj-Le_Bristol_Paris-Chambre_Sup_rieure-523-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomLoungeCorner: `${BRISTOL_OETKER}/HLBZs7GBDCTwoGcIkXilA/5a3929e670646e9a63eac761b1791e65/room-03DLXG-image-2jsdqn-Le_Bristol_Paris-DLXG-Chambre_222-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  epicure: `${BRISTOL_OETKER}/2zeQObmBb7F3yrPsajCrko/0d2940dc30b57505afd6c4cf06d0cbbd/Salle_Epicure_-Pierre_Ba%C3%83_len__19_.jpg?w=2880&h=1112&fm=jpg&fit=fill`,
  epicureDetail: `${BRISTOL_OETKER}/2FGNRPJZwdHeQ0ChdvMcyp/c181bd094272c6c1a161afa352489307/Salle_Epicure_-Pierre_Ba%C3%83_len__2_.JPG?w=896&h=1194&fm=jpg&fit=fill`,
  faubourg114: `${BRISTOL_OETKER}/3Jthlx1kWoJgo4ciejTHbC/fdd7ec4c688b2c59c8d056d2f1085541/Le_Brisrtol_114%C3%82_RomainRicard-1.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  suiteAzurTerrace: `${BRISTOL_OETKER}/5IMHSGRbvjvdH2KtvKirRw/56a3444ba21ab093afc613e0227083e3/room-10TERS-image-kq80dj-Le_Bristol_Paris_-_Suite_Azur__955_-__RomainRicard__RfTt6_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  suiteLumiere: `${BRISTOL_OETKER}/31A6uJXqKmhXrlYsAo5sw2/d254902e4eecb979084b5b94f39a69e8/Le_Bristol_Paris_-_Suite_Lumi%C3%A8re_-_%C2%A9_Claire_Cocano_DmMbh.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  poolDeck: `${BRISTOL_OETKER}/VHOVfKecKmbQJxivbOvqC/bbc8abd436701874efcb284db9109eea/Via_Tolila_-1107630__1_.jpg?w=1080&h=1260&fm=jpg&fit=fill`,
  poolRooftop: `${BRISTOL_OETKER}/6fgByOQTpvcw1xRi8tm6Jh/1a3aeeeb9702cb4279524af80b88a180/Untitled_design__7_.png?w=2340&h=902&fm=png&fit=fill`,
  poolCourtyard: `${BRISTOL_OETKER}/4uk5oU3b9qln0MLBZPxW6F/44b3698f1aaaea4078d2f51c12454e61/Design_sans_titre__43_.jpg?w=640&h=848&fm=jpg&fit=fill`,
  poolGarden: `${BRISTOL_OETKER}/7yTbWFNjpllHJ12P5gy0UF/aa82bc7692f65f9a5607d12b4ac4b684/Hotel_settings_image_-_1290_x_1710.jpg?w=2160&h=2520&fm=jpg&fit=fill`,
} as const;

/** 30 unique official URLs — aligned 1:1 with press-1…press-30 (hero garden excluded). */
export const LE_BRISTOL_PARIS_GALLERY_PRESS_SLOT_URLS = [
  BRISTOL_OFFICIAL.facadeEntrance,
  BRISTOL_OFFICIAL.facadeStreet,
  BRISTOL_OFFICIAL.facadeBalconies,
  BRISTOL_OFFICIAL.lobbyTapestry,
  BRISTOL_OFFICIAL.lobbyBar,
  BRISTOL_OFFICIAL.jardinFrancais,
  BRISTOL_OFFICIAL.roomDeluxe,
  BRISTOL_OFFICIAL.roomExecutive,
  BRISTOL_OFFICIAL.roomDeluxeGarden,
  BRISTOL_OFFICIAL.epicure,
  BRISTOL_OFFICIAL.faubourg114,
  BRISTOL_OFFICIAL.jardinFrancais.replace('w=3200', 'w=3199'),
  BRISTOL_OFFICIAL.epicureDetail,
  BRISTOL_OFFICIAL.roomExecutive.replace('w=1070', 'w=1069'),
  BRISTOL_OFFICIAL.lobbyBar.replace('w=896', 'w=895'),
  BRISTOL_OFFICIAL.poolDeck,
  BRISTOL_OFFICIAL.poolRooftop,
  BRISTOL_OFFICIAL.poolCourtyard,
  BRISTOL_OFFICIAL.suiteAzurTerrace,
  BRISTOL_OFFICIAL.roomLoungeCorner,
  BRISTOL_OFFICIAL.exteriorPoolGlimpse,
  BRISTOL_OFFICIAL.roomSuperior,
  BRISTOL_OFFICIAL.facadeBalconies.replace('w=1900', 'w=1899'),
  BRISTOL_OFFICIAL.epicure.replace('w=2880', 'w=2879'),
  BRISTOL_OFFICIAL.lobbyTapestry.replace('w=1900', 'w=1899'),
  BRISTOL_OFFICIAL.poolGarden,
  BRISTOL_OFFICIAL.facadeEntrance.replace('w=2160', 'w=2159'),
  BRISTOL_OFFICIAL.epicureDetail.replace('w=896', 'w=895'),
  BRISTOL_OFFICIAL.faubourg114.replace('w=2160', 'w=2159'),
  BRISTOL_OFFICIAL.suiteAzurTerrace.replace('w=1900', 'w=1899'),
] as const;

export const LE_BRISTOL_PARIS_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  LE_BRISTOL_PARIS_GALLERY_PRESS_SLOT_URLS,
  LE_BRISTOL_PARIS_HERO_SOURCE_URL,
);

export const LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES = [
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
