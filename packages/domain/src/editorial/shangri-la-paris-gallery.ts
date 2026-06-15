/**
 * Phase 3 — curated 25-image gallery manifest for `shangri-la-paris`.
 *
 * CDC §2.2 kit (2026-06-10) — 5 UI categories × 5 photos :
 * Vue, Chambres, Piscine, Restaurant, Spa. Hero Vue is separate (`hero`).
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-shangri-la-paris-gallery-batch.ts`.
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const SHANGRI_LA_PARIS_HERO_IMAGE = 'cct/hotels/shangri-la-paris/hero';

export const SHANGRI_LA_PARIS_HERO_SOURCE_URL =
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/SLPR-legal-notices-1920x940.jpg';

export const SHANGRI_LA_PARIS_GALLERY_IMAGES = [
  /* ── Vue ×5 (press-1…5) ── */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-1',
    category: 'view',
    alt_fr: 'Entrée du palace Shangri-La Paris, enseigne et porte cochère avenue d’Iéna',
    alt_en: 'Shangri-La Paris entrance, sign and carriage porch on Avenue d’Iéna',
    caption_fr:
      'L’entrée du palace ouvre sur le 16e arrondissement, à deux pas du Trocadéro et de la Tour Eiffel.',
    caption_en:
      'The palace entrance opens onto the 16th arrondissement, steps from Trocadéro and the Eiffel Tower.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-2',
    category: 'view',
    alt_fr: 'Campagne visuelle du Shangri-La Paris — palace et jardins, vue d’ensemble',
    alt_en: 'Shangri-La Paris campaign visual — palace and gardens, overview',
    caption_fr:
      'Le palace déploie ses jardins et sa façade haussmannienne sur l’avenue d’Iéna, face au Trocadéro.',
    caption_en:
      'The palace unfolds its gardens and Haussmann facade on Avenue d’Iéna, facing the Trocadéro.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-3',
    category: 'view',
    alt_fr: 'Vue Tour Eiffel depuis une suite du Shangri-La Paris',
    alt_en: 'Eiffel Tower view from a Shangri-La Paris suite',
    caption_fr:
      'Quarante pour cent des chambres et soixante pour cent des suites offrent une vue directe sur la Tour Eiffel.',
    caption_en:
      'Forty per cent of rooms and sixty per cent of suites offer a direct Eiffel Tower view.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-4',
    category: 'view',
    alt_fr: 'Terrasse avec panorama Seine et Tour Eiffel, Shangri-La Paris',
    alt_en: 'Terrace with Seine and Eiffel Tower panorama, Shangri-La Paris',
    caption_fr:
      'Depuis les terrasses des suites signatures, la Seine et la Tour Eiffel composent le tableau parisien.',
    caption_en:
      'From signature suite terraces, the Seine and Eiffel Tower compose the Parisian tableau.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-5',
    category: 'view',
    alt_fr: 'Vue nocturne sur la Tour Eiffel depuis le Shangri-La Paris',
    alt_en: 'Night view of the Eiffel Tower from Shangri-La Paris',
    caption_fr:
      'Au crépuscule, les scintillements de la Tour Eiffel se lisent depuis les étages élevés du palace.',
    caption_en: 'At dusk, the Eiffel Tower’s sparkles unfold from the palace upper floors.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  /* ── Chambres ×5 (press-6…10) ── */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-6',
    category: 'room',
    alt_fr: 'Chambre Superior du Shangri-La Paris, volumes haussmanniens',
    alt_en: 'Superior Room at Shangri-La Paris, Haussmannian volumes',
    caption_fr:
      'La chambre Superior ouvre sur les volumes préservés du Palais d’Iéna — boiseries, lumière et confort contemporain.',
    caption_en:
      'The Superior Room opens onto preserved Palais d’Iéna volumes — panelling, light and contemporary comfort.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-7',
    category: 'room',
    alt_fr: 'Chambre Deluxe du Shangri-La Paris, décoration contemporaine et vue Paris',
    alt_en: 'Deluxe Room at Shangri-La Paris, contemporary décor and Paris view',
    caption_fr:
      'Les chambres Deluxe conjuguent volumes généreux, linge fin et palette sobre inspirée du patrimoine du palace.',
    caption_en:
      'Deluxe Rooms combine generous volumes, fine linen and a sober palette inspired by the palace heritage.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-8',
    category: 'room',
    alt_fr: 'Suite avec salon séparé, Shangri-La Paris',
    alt_en: 'Suite with separate living room, Shangri-La Paris',
    caption_fr:
      'Les suites déploient salon et chambre distincts — une rareté de surface dans le parc hôtelier parisien.',
    caption_en:
      'Suites unfold separate living room and bedroom — a rare footprint in the Parisian hotel landscape.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-9',
    category: 'room',
    alt_fr: 'Salle de bain marbre d’une chambre Shangri-La Paris',
    alt_en: 'Marble bathroom in a Shangri-La Paris guest room',
    caption_fr:
      'Marbre, baignoire profonde et produits d’accueil de luxe composent la signature des salles de bain du palace.',
    caption_en:
      'Marble, deep bathtub and luxury amenities form the signature of the palace bathrooms.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-10',
    category: 'room',
    alt_fr: 'Chambre avec vue Tour Eiffel, Shangri-La Paris',
    alt_en: 'Room with Eiffel Tower view, Shangri-La Paris',
    caption_fr:
      'Depuis plusieurs catégories de chambres, la Tour Eiffel se dévoile sans quitter son lit.',
    caption_en: 'From several room categories, the Eiffel Tower unfolds without leaving the bed.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  /* ── Piscine ×5 (press-11…15) ── */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-11',
    category: 'pool',
    alt_fr: 'Piscine intérieure de 17 m du CHI Spa, Shangri-La Paris',
    alt_en: '17-metre indoor pool at CHI Spa, Shangri-La Paris',
    caption_fr:
      'La piscine intérieure de 17 m, baignée de lumière naturelle, ouvre sur une terrasse végétalisée.',
    caption_en:
      'The 17-metre indoor pool, flooded with natural light, opens onto a landscaped terrace.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-12',
    category: 'pool',
    alt_fr: 'Bassin du CHI Spa avec baies vitrées, Shangri-La Paris',
    alt_en: 'CHI Spa pool with bay windows, Shangri-La Paris',
    caption_fr:
      'Les grandes baies vitrées du spa laissent entrer la lumière du 16e sur le bassin intérieur.',
    caption_en: 'The spa’s large bay windows bring 16th-arrondissement light into the indoor pool.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-13',
    category: 'pool',
    alt_fr: 'Terrasse végétalisée du spa CHI, Shangri-La Paris',
    alt_en: 'Landscaped CHI Spa terrace, Shangri-La Paris',
    caption_fr:
      'La terrasse du spa prolonge le rituel bien-être à l’extérieur, entre verdure et calme du palace.',
    caption_en:
      'The spa terrace extends the wellness ritual outdoors, between greenery and palace calm.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-14',
    category: 'pool',
    alt_fr: 'Accès au CHI Spa depuis les salons historiques, Shangri-La Paris',
    alt_en: 'CHI Spa access from historic salons, Shangri-La Paris',
    caption_fr:
      'Les salons d’apparat mènent au niveau spa — piscine, hammam et cabines de soin sous le Palais d’Iéna.',
    caption_en:
      'The reception salons lead to the spa level — pool, hammam and treatment rooms under the Palais d’Iéna.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-15',
    category: 'pool',
    alt_fr: 'Les Lounges, détente après la piscine du Shangri-La Paris',
    alt_en: 'Les Lounges, post-pool relaxation at Shangri-La Paris',
    caption_fr:
      'Les Lounges accueillent thés et pause après les longueurs — à deux pas du bassin du CHI Spa.',
    caption_en: 'Les Lounges host tea and a pause after laps — steps from the CHI Spa pool.',
    credit: 'Shangri-La Paris — Les Lounges',
  },
  /* ── Restaurant ×5 (press-16…20) ── */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-16',
    category: 'dining',
    alt_fr: 'Shang Palace, restaurant cantonais étoilé MICHELIN, Shangri-La Paris',
    alt_en: 'Shang Palace, MICHELIN-starred Cantonese restaurant, Shangri-La Paris',
    caption_fr:
      'Shang Palace, seule table chinoise étoilée MICHELIN de France, signe Tony Xu et sa brigade cantonaise.',
    caption_en:
      'Shang Palace, France’s only MICHELIN-starred Chinese table, led by Tony Xu and his Cantonese brigade.',
    credit: 'Shangri-La Paris — Shang Palace',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-17',
    category: 'dining',
    alt_fr: 'La Bauhinia sous sa verrière, restaurant du Shangri-La Paris',
    alt_en: 'La Bauhinia under its glass cupola, Shangri-La Paris restaurant',
    caption_fr:
      'La Bauhinia sert cuisine française et asiatique sous une verrière inspirée des jardins d’hiver du XIXe siècle.',
    caption_en:
      'La Bauhinia serves French and Asian cuisine under a cupola inspired by 19th-century winter gardens.',
    credit: 'Shangri-La Paris — La Bauhinia',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-18',
    category: 'dining',
    alt_fr: 'Le Bar Botaniste, bar cocktails botaniques du Shangri-La Paris',
    alt_en: 'Le Bar Botaniste, botanical cocktail bar at Shangri-La Paris',
    caption_fr:
      'Le Bar Botaniste revisite l’époque napoléonienne avec cocktails botaniques et spiritueux rares.',
    caption_en:
      'Le Bar Botaniste revisits the Napoleonic era with botanical cocktails and rare spirits.',
    credit: 'Shangri-La Paris — Le Bar Botaniste',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-19',
    category: 'dining',
    alt_fr: 'Plat signature du Shang Palace, homard et riz brun',
    alt_en: 'Shang Palace signature dish, lobster and brown rice',
    caption_fr:
      'La brigade cantonaise du Shang Palace compose des assiettes précises — homard, dim sum et thés d’exception.',
    caption_en:
      'The Shang Palace Cantonese brigade composes precise plates — lobster, dim sum and exceptional teas.',
    credit: 'Shangri-La Paris — Shang Palace',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-20',
    category: 'dining',
    alt_fr: 'Tea Story au Shang Palace, cérémonie du thé',
    alt_en: 'Tea Story at Shang Palace, tea ceremony',
    caption_fr:
      'Le Tea Story du Shang Palace célèbre les crus chinois dans un salon intime du palace.',
    caption_en: 'Shang Palace Tea Story celebrates Chinese teas in an intimate palace salon.',
    credit: 'Shangri-La Paris — Shang Palace',
  },
  /* ── Spa ×5 (press-21…25) ── */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-21',
    category: 'spa',
    alt_fr: 'CHI, The Spa at Shangri-La Paris, cabine de soin',
    alt_en: 'CHI, The Spa at Shangri-La Paris, treatment room',
    caption_fr:
      'CHI, The Spa conjugue rituels asiatiques et soins occidentaux dans l’ancien Palais d’Iéna.',
    caption_en:
      'CHI, The Spa blends Asian rituals and Western treatments in the former Palais d’Iéna.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-22',
    category: 'spa',
    alt_fr: 'Hammam du CHI Spa, Shangri-La Paris',
    alt_en: 'Hammam at CHI Spa, Shangri-La Paris',
    caption_fr:
      'Le hammam complète l’offre bien-être du palace, entre piscine intérieure et salle de fitness.',
    caption_en:
      'The hammam completes the palace wellness offer, between the indoor pool and fitness room.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-23',
    category: 'spa',
    alt_fr: 'Salle de fitness du Shangri-La Paris',
    alt_en: 'Fitness room at Shangri-La Paris',
    caption_fr:
      'La salle de fitness ouvre tôt le matin — pratique avant un petit-déjeuner face à la Tour Eiffel.',
    caption_en: 'The fitness room opens early — handy before breakfast facing the Eiffel Tower.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-24',
    category: 'spa',
    alt_fr: 'Salon Maison Roland, espace bien-être du Shangri-La Paris',
    alt_en: 'Maison Roland salon, Shangri-La Paris wellness space',
    caption_fr:
      'Maison Roland accueille rituels privés et expériences sensorielles complémentaires au CHI Spa.',
    caption_en:
      'Maison Roland hosts private rituals and sensory experiences complementing CHI Spa.',
    credit: 'Shangri-La Paris — Maison Roland',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-25',
    category: 'spa',
    alt_fr: 'Les Salons du Prince, réception privée bien-être, Shangri-La Paris',
    alt_en: 'Les Salons du Prince, private wellness reception, Shangri-La Paris',
    caption_fr:
      'Les Salons du Prince accueillent soirées privées et rituels sur mesure dans le cadre historique.',
    caption_en:
      'Les Salons du Prince host private evenings and bespoke rituals in the historic setting.',
    credit: 'Shangri-La Paris — Les Salons du Prince',
  },
] as const;

const SHANGRI_SITE = 'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila';
const SHANGRI_CORE = 'https://sitecore-cd-imgr.shangri-la.com/MediaFiles';
const SHANGRI_SPA =
  'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris';
const SHANGRI_GALLERY = `${SHANGRI_SITE}/settings/gallery/images`;

/** Official Sitecore / press assets — one distinct path per press slot (Rule 10). */
const SHANGRI_OFFICIAL = {
  legalNotices: `${SHANGRI_SITE}/about/SLPR-legal-notices-1920x940.jpg`,
  entrance: `${SHANGRI_CORE}/2/D/1/{2D1D57FF-8839-45D0-BCFA-6CC9A94207AF}202109_SLPR_HP-Carousel_Entrance.JPG`,
  enchanted: `${SHANGRI_CORE}/2/D/4/{2D4595ED-B36A-4A48-BA8D-D44F682E02D7}202411-enchanted-wonders-paris-1180x535.jpg`,
  eiffelTerrace: `${SHANGRI_CORE}/6/B/9/{6B98157F-601B-4B2D-987A-E34023334662}012026-Duplex-Terrace-Eiffel-View-Suite-1.jpg`,
  suiteShangri: `${SHANGRI_GALLERY}/39-La-Suite-Shangri-La.jpg`,
  twinOffer: `${SHANGRI_CORE}/7/1/8/{71885595-BAAC-4CB1-826D-FA22485E2C00}202603_SLLN-SLPR_Twin-Offer_1920x940.jpg`,
  superiorRoom: `${SHANGRI_CORE}/C/C/2/{CC23F5E5-41CB-4537-8CBD-39699580275C}SLPR-AppartementPrinceBonaparte.JPG`,
  deluxeRoom: `${SHANGRI_CORE}/6/B/F/{6BFC2F77-9EAB-45FC-A30C-57AF66AD6F77}012026-Deluxe-Room-1.jpg`,
  deluxeSuite: `${SHANGRI_CORE}/9/8/7/{9871D466-193E-45D8-B05B-5600A80C157D}SLPR-DeluxeSuite.JPG`,
  juniorSuite: `${SHANGRI_CORE}/2/7/9/{279B78FD-40AE-4194-9AFF-A14E5B29CEED}012026-Junior-Suite-Paris-View-1.jpg`,
  womanRoomView: `${SHANGRI_CORE}/C/8/B/{C8B53512-F5F8-43D9-8A67-84506C810E20}202101_SLPR_Woman-Room-View_Generic-Offers.jpg`,
  chiSpaPool: `${SHANGRI_SPA}/202306_SLPR_DLP_ContentBox1_Desktop_1140x760.JPG`,
  chiSpaPoolAlt: `${SHANGRI_SPA}/202306_SLPR_DLP_ContentBox5_Desktop_1140x760.JPG`,
  parisianEscape: `${SHANGRI_CORE}/1/F/A/{1FA9479D-D4FF-4FBC-BB7D-1B1004A40DDA}202604_SLPR_PArasian-Escape_1180x535.jpg`,
  lobby:
    'https://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/about/SLPR-Lobby.jpg',
  lounges: `${SHANGRI_SITE}/dining/bars-lounges/les-lounges/SLPR-LesLounges2-1920x500.jpg`,
  shangPalace: `${SHANGRI_SITE}/dining/restaurants/shang-palace/shangpalace-image2-630x364.jpg`,
  bauhinia: `${SHANGRI_GALLERY}/47-La-Bauhinia.jpg`,
  barBotaniste: `${SHANGRI_SITE}/dining/banners/SLPR-LeBarBotaniste-1920x500.JPG`,
  shangPalaceDish: `${SHANGRI_SITE}/dining/restaurants/shang-palace/fried-lobster-brown-rice-restaurant-story-630x364.jpg`,
  teaStory: `${SHANGRI_SITE}/dining/restaurants/shang-palace/202510_SLPR_Tea-Story_630x364.jpg`,
  chiSpaTreatment: `${SHANGRI_SPA}/202306_SLPR_DLP_ContentBox2_Desktop_1140x760.JPG`,
  chiSpaHammam: `${SHANGRI_SPA}/202306_SLPR_DLP_ContentBox3_Desktop_1140x760.JPG`,
  chiSpaFitness: `${SHANGRI_SPA}/202306_SLPR_DLP_ContentBox4_Desktop_1140x760.JPG`,
  conciergeSalon: `${SHANGRI_SITE}/dining/restaurants/maison-roland/202606_SLPR_LM-Story.jpg`,
  salonsPrince: `${SHANGRI_SITE}/dining/restaurants/les-salons-du-prince/restaurant-story-image-630x364.jpg`,
} as const;

/** 25 unique official URLs — one canonical path per press slot (hero excluded). */
export const SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS = [
  SHANGRI_OFFICIAL.entrance,
  SHANGRI_OFFICIAL.enchanted,
  SHANGRI_OFFICIAL.eiffelTerrace,
  SHANGRI_OFFICIAL.suiteShangri,
  SHANGRI_OFFICIAL.twinOffer,
  SHANGRI_OFFICIAL.superiorRoom,
  SHANGRI_OFFICIAL.deluxeRoom,
  SHANGRI_OFFICIAL.deluxeSuite,
  SHANGRI_OFFICIAL.juniorSuite,
  SHANGRI_OFFICIAL.womanRoomView,
  SHANGRI_OFFICIAL.chiSpaPool,
  SHANGRI_OFFICIAL.chiSpaPoolAlt,
  SHANGRI_OFFICIAL.parisianEscape,
  SHANGRI_OFFICIAL.lobby,
  SHANGRI_OFFICIAL.lounges,
  SHANGRI_OFFICIAL.shangPalace,
  SHANGRI_OFFICIAL.bauhinia,
  SHANGRI_OFFICIAL.barBotaniste,
  SHANGRI_OFFICIAL.shangPalaceDish,
  SHANGRI_OFFICIAL.teaStory,
  SHANGRI_OFFICIAL.chiSpaTreatment,
  SHANGRI_OFFICIAL.chiSpaHammam,
  SHANGRI_OFFICIAL.chiSpaFitness,
  SHANGRI_OFFICIAL.conciergeSalon,
  SHANGRI_OFFICIAL.salonsPrince,
] as const;

export const SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
);

/** Kit 5×5 filter categories represented in the manifest. */
export const SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES = [
  'view',
  'room',
  'pool',
  'dining',
  'spa',
] as const;
