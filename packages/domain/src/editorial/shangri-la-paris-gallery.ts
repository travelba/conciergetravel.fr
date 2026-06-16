/**
 * Phase 3 — honest gallery manifest for `shangri-la-paris` (23 slots).
 *
 * 2026-06-16 — re-audited against the live Cloudinary pixels. Dropped press-5
 * (Tower Bridge composite, foreign) and press-12 (generic « CBD OIL » stock);
 * recategorised mislabelled salons/panoramas/desserts to their real subject.
 * Categories without genuine pixels (only one true pool) shrink rather than
 * being padded with mislabelled photos. Hero Vue is separate (`hero`).
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
    category: 'room',
    alt_fr: 'Salon d’une suite signature avec vue Tour Eiffel, Shangri-La Paris',
    alt_en: 'Signature suite living room with Eiffel Tower view, Shangri-La Paris',
    caption_fr:
      'Le salon des suites signatures ouvre par ses baies sur la Tour Eiffel — un séjour parisien sur mesure.',
    caption_en:
      'The signature suite living room opens through its bays onto the Eiffel Tower — a bespoke Parisian stay.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  /* press-5 retiré (2026-06-16) : visuel composite Tower Bridge (Londres) +
   * Tour Eiffel — illustration étrangère au palace parisien. */
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
    alt_fr: 'Chambre du Shangri-La Paris, lit habillé et œuvre encadrée',
    alt_en: 'Guest room at Shangri-La Paris, dressed bed and framed artwork',
    caption_fr:
      'Les chambres déclinent le confort feutré du palace — linge fin, lumière douce et patrimoine du Palais d’Iéna.',
    caption_en:
      'The rooms reprise the palace’s hushed comfort — fine linen, soft light and Palais d’Iéna heritage.',
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
  /* ── Piscine (press-11 — seule piscine réelle : bassin intérieur 17 m du CHI Spa) ── */
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
  /* press-12 retiré (2026-06-16) : flacon générique « CBD OIL » — visuel
   * stock non représentatif du palace, retiré par honnêteté. */
  {
    public_id: 'cct/hotels/shangri-la-paris/press-13',
    category: 'view',
    alt_fr: 'Panorama parisien et Tour Eiffel au crépuscule depuis le Shangri-La Paris',
    alt_en: 'Parisian skyline and Eiffel Tower at dusk from Shangri-La Paris',
    caption_fr:
      'Depuis les étages élevés, Paris se déploie jusqu’à la Tour Eiffel — le panorama qui fait la réputation du palace.',
    caption_en:
      'From the upper floors, Paris unfolds to the Eiffel Tower — the panorama that built the palace’s reputation.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-14',
    category: 'lobby',
    alt_fr: 'Salon d’apparat du Shangri-La Paris, sol marbre et composition florale',
    alt_en: 'Reception salon at Shangri-La Paris, marble floor and floral display',
    caption_fr:
      'Les salons d’apparat du Palais d’Iéna conservent marbres, dorures et compositions florales signées.',
    caption_en:
      'The Palais d’Iéna reception salons keep their marble, gilding and signature floral displays.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-15',
    category: 'dining',
    alt_fr: 'Les Lounges du Shangri-La Paris, pâtisseries et salon de thé',
    alt_en: 'Les Lounges at Shangri-La Paris, pastries and tea salon',
    caption_fr:
      'Les Lounges servent thés et pâtisseries de la maison dans un salon feutré ouvert sur le palace.',
    caption_en:
      'Les Lounges serve house teas and pastries in a hushed salon opening onto the palace.',
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
    category: 'dining',
    alt_fr: 'Dessert glacé aux fruits rouges, restauration du Shangri-La Paris',
    alt_en: 'Iced red-fruit dessert, dining at Shangri-La Paris',
    caption_fr:
      'La pâtisserie du palace signe desserts glacés et fruits rouges — une douceur servie en salle ou en suite.',
    caption_en:
      'The palace pastry kitchen signs iced desserts and red fruits — a sweet served in the dining room or in-suite.',
    credit: 'Shangri-La Paris',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-25',
    category: 'lobby',
    alt_fr: 'Les Salons du Prince, salon historique boisé du Shangri-La Paris',
    alt_en: 'Les Salons du Prince, panelled historic salon at Shangri-La Paris',
    caption_fr:
      'Les Salons du Prince conservent boiseries, miroirs et lustres du Palais d’Iéna — cadre des réceptions privées.',
    caption_en:
      'Les Salons du Prince keep the Palais d’Iéna panelling, mirrors and chandeliers — the setting for private events.',
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
  // press-5 retiré : composite Tower Bridge (Londres) — étranger au palace parisien.
  SHANGRI_OFFICIAL.superiorRoom,
  SHANGRI_OFFICIAL.deluxeRoom,
  SHANGRI_OFFICIAL.deluxeSuite,
  SHANGRI_OFFICIAL.juniorSuite,
  SHANGRI_OFFICIAL.womanRoomView,
  SHANGRI_OFFICIAL.chiSpaPool,
  // press-12 retiré : flacon générique « CBD OIL » — visuel stock non représentatif.
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

/** Honest filter categories represented in the manifest (no fabricated pool/spa padding). */
export const SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES = [
  'view',
  'room',
  'lobby',
  'pool',
  'dining',
  'spa',
] as const;
