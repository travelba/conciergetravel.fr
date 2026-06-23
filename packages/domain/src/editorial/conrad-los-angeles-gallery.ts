/**
 * Conrad Los Angeles — honest kit gallery manifest (CDC §2.2 kit, 2026-06-16).
 *
 * 19 slots across 4 genuine UI filter categories — Vue, Chambres, Piscine,
 * Restaurant. No spa frame is published: Conrad Los Angeles has a spa, but no
 * real treatment-room pixel is available from the official Hilton DAM, the
 * official site or quality third-party sources (only a fitness room), so the
 * spa tab honestly stays empty rather than padding with a mislabelled photo
 * (honest-gallery gate, `KIT_GALLERY_MIN_SLOT_COUNT`).
 *
 * Sources (PO derogation 2026-06-16 — official-only waived for this fiche):
 *   - Hilton official DAM (`hilton.com/im/...`) + Hilton Stories — rooms, tower
 *   - Google Places re-host (`places-*`, real Conrad imagery) — pool, dining, room, lobby
 *   - Quality third-party (resortpass, urbanize, modernluxury, prnewswire,
 *     squarespace, qtxasset) — pool, terrace, rooftop lounge, lobby, bar
 *
 * Hero is a dedicated `cct/hotels/conrad-los-angeles/hero` exterior shot, kept
 * out of `gallery_images[]` (D20 / `kit.02.hero_not_in_gallery`). Alt + captions
 * are hand-authored after visual inspection of each frame (Hard Rule 16).
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const CONRAD_LOS_ANGELES_IMAGE_PREFIX = 'cct/hotels/conrad-los-angeles';

const HILTON_CREDIT = 'Conrad Los Angeles — Hilton';
const PLACES_CREDIT = 'Conrad Los Angeles (Hilton) — via Google Maps';

/** Cloudinary re-host base for the existing Google Places assets (real Conrad pixels). */
const PLACES_REHOST = `https://res.cloudinary.com/dvbjwh5wy/image/upload/${CONRAD_LOS_ANGELES_IMAGE_PREFIX}`;

/** Hero = official exterior of the Conrad tower at The Grand LA, sunset (overview). */
export const CONRAD_LOS_ANGELES_HERO_IMAGE = `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/hero`;

export const CONRAD_LOS_ANGELES_HERO_SOURCE_URL =
  'https://stories.hilton.com/uploads/2022/07/Exterior-Courtesy-of-Conrad-Los-Angeles.jpg';

export const CONRAD_LOS_ANGELES_GALLERY_IMAGES = [
  /* ── Vue ×5 (press-1…5) ── */
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-1`,
    category: 'view',
    alt_fr:
      'Tour du Conrad Los Angeles signée Frank Gehry sur Grand Avenue, façade de verre et terrasses végétalisées',
    alt_en:
      'Frank Gehry-designed Conrad Los Angeles tower on Grand Avenue, glass facade and planted terraces',
    caption_fr:
      'La tour du Conrad coiffe The Grand LA sur Grand Avenue, ses terrasses plantées face au Walt Disney Concert Hall.',
    caption_en:
      'The Conrad tower crowns The Grand LA on Grand Avenue, its planted terraces facing the Walt Disney Concert Hall.',
    credit: HILTON_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-2`,
    category: 'view',
    alt_fr:
      'Façade de verre du Conrad Los Angeles entourée de jardins paysagers et de la piscine extérieure',
    alt_en:
      'Glass facade of Conrad Los Angeles surrounded by landscaped gardens and the outdoor pool',
    caption_fr:
      'La silhouette de verre de la tour domine les jardins paysagers et le pool deck du quartier de Bunker Hill.',
    caption_en:
      'The glass tower rises above the landscaped gardens and pool deck of the Bunker Hill district.',
    credit: 'Conrad Los Angeles — via The Hotel Guru',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-3`,
    category: 'view',
    alt_fr:
      'Salon rooftop du Conrad Los Angeles avec foyer extérieur et vue sur les gratte-ciel au coucher du soleil',
    alt_en:
      'Rooftop lounge at Conrad Los Angeles with an outdoor fire pit and skyline view at sunset',
    caption_fr:
      'Au rooftop, canapés et foyer extérieur cadrent l’horizon de Downtown Los Angeles à la tombée du jour.',
    caption_en:
      'On the rooftop, sofas and an outdoor fire pit frame the Downtown Los Angeles skyline at dusk.',
    credit: 'Conrad Los Angeles — via Modern Luxury',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-4`,
    category: 'view',
    alt_fr:
      'Lobby-salon du 10e étage du Conrad Los Angeles avec cheminée, au niveau du Music Center',
    alt_en:
      '10th-floor lobby lounge at Conrad Los Angeles with a fireplace, level with the Music Center',
    caption_fr:
      'Le lobby du 10e étage, au niveau des auditoriums du Music Center, mêle cheminée, sofas et fauteuils tressés.',
    caption_en:
      'The 10th-floor lobby, level with the Music Center auditoriums, blends a fireplace, sofas and woven armchairs.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-5`,
    category: 'view',
    alt_fr:
      'Lobby du Conrad Los Angeles, baies vitrées toute hauteur ouvertes sur le patio et les jardins',
    alt_en:
      'Conrad Los Angeles lobby with floor-to-ceiling windows opening onto the patio and gardens',
    caption_fr:
      'Le lobby ouvre par des baies toute hauteur sur le patio paysager — mobilier contemporain et cheminée.',
    caption_en:
      'The lobby opens through floor-to-ceiling windows onto the landscaped patio — contemporary furniture and a fireplace.',
    credit: HILTON_CREDIT,
  },
  /* ── Chambres ×5 (press-6…10) ── */
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-6`,
    category: 'room',
    alt_fr: 'Chambre King du Conrad Los Angeles avec baie vitrée sur le Walt Disney Concert Hall',
    alt_en:
      'King guest room at Conrad Los Angeles with a floor-to-ceiling window onto the Walt Disney Concert Hall',
    caption_fr:
      'Boiseries de chêne, lit king et fenêtre toute hauteur cadrant les courbes d’acier du Walt Disney Concert Hall signé Frank Gehry.',
    caption_en:
      'Oak panelling, a king bed and a full-height window framing the steel curves of Frank Gehry’s Walt Disney Concert Hall.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-7`,
    category: 'room',
    alt_fr: 'Salon et cuisine ouverte d’une suite du Conrad Los Angeles avec vue sur la ville',
    alt_en: 'Open-plan living room and kitchen of a Conrad Los Angeles suite with city view',
    caption_fr:
      'Les suites déploient salon, cuisine en chêne et îlot de marbre, baies vitrées ouvertes sur l’horizon de Los Angeles.',
    caption_en:
      'Suites unfold a living room, oak kitchen and marble island, with picture windows opening onto the Los Angeles horizon.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-8`,
    category: 'room',
    alt_fr:
      'Suite d’angle Mountain View du Conrad Los Angeles, salon avec banquette et vue sur la ville et les montagnes',
    alt_en:
      'Mountain View corner suite at Conrad Los Angeles, living area with a sectional sofa and city-and-mountain view',
    caption_fr:
      'La suite d’angle Mountain View ouvre par une baie panoramique sur la ville et les montagnes — banquette beige et table basse en chêne.',
    caption_en:
      'The Mountain View corner suite opens through a panoramic window onto the city and mountains — beige sectional and oak coffee table.',
    credit: HILTON_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-9`,
    category: 'room',
    alt_fr:
      'Chambre du Conrad Los Angeles avec lit king, tête de lit en bois et salle de bains séparée par une paroi vitrée',
    alt_en:
      'Conrad Los Angeles guest room with a king bed, wooden headboard and a glass-walled bathroom',
    caption_fr:
      'Lit king, tête de lit en noyer et salle de bains séparée par une paroi de verre : la chambre joue les volumes ouverts.',
    caption_en:
      'A king bed, walnut headboard and a glass-walled bathroom: the room plays with open volumes.',
    credit: HILTON_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-10`,
    category: 'room',
    alt_fr:
      'Chambre double du Conrad Los Angeles avec deux lits, lambris de bois et coin salon près de la fenêtre',
    alt_en:
      'Double guest room at Conrad Los Angeles with two beds, wood panelling and a seating corner by the window',
    caption_fr:
      'La chambre double aligne deux lits habillés de lin blanc, lambris de bois et fauteuil vert près de la baie voilée.',
    caption_en:
      'The double room lines up two linen-dressed beds, wood panelling and a green armchair by the sheer-curtained window.',
    credit: HILTON_CREDIT,
  },
  /* ── Piscine ×4 (press-11…14) ── */
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-11`,
    category: 'pool',
    alt_fr:
      'Piscine extérieure sur le rooftop du Conrad Los Angeles avec vue sur les gratte-ciel de Downtown',
    alt_en: 'Rooftop outdoor pool at Conrad Los Angeles overlooking the Downtown LA skyline',
    caption_fr:
      'La piscine du pool deck domine Downtown Los Angeles, transats alignés face aux tours de Bunker Hill.',
    caption_en:
      'The pool deck rises above Downtown Los Angeles, loungers lined up facing the Bunker Hill towers.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-12`,
    category: 'pool',
    alt_fr: 'Cabanas et transats au bord de la piscine rooftop du Conrad Los Angeles',
    alt_en: 'Cabanas and loungers by the rooftop pool at Conrad Los Angeles',
    caption_fr:
      'Sous la pergola de bois, cabanas et bains de soleil bordent le bassin extérieur du pool deck.',
    caption_en:
      'Under the timber pergola, cabanas and sun loungers line the outdoor pool on the deck.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-13`,
    category: 'pool',
    alt_fr:
      'Pool deck du Conrad Los Angeles, transats et parasols alignés au pied de la tour de verre',
    alt_en: 'Conrad Los Angeles pool deck, loungers and umbrellas lined up beneath the glass tower',
    caption_fr:
      'Le pool deck déroule transats et parasols au pied de la tour, jardins paysagers et structure de bois en arrière-plan.',
    caption_en:
      'The pool deck unrolls loungers and umbrellas beneath the tower, landscaped gardens and a timber pavilion behind.',
    credit: 'Conrad Los Angeles — via Urbanize LA',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-14`,
    category: 'pool',
    alt_fr: 'Bassin extérieur du Conrad Los Angeles, rangée de transats et parasols face au jardin',
    alt_en: 'Outdoor pool at Conrad Los Angeles, a row of loungers and umbrellas facing the garden',
    caption_fr:
      'Une rangée de transats et de parasols longe le bassin extérieur, face au jardin paysager et au pavillon de bois.',
    caption_en:
      'A row of loungers and umbrellas runs along the outdoor pool, facing the landscaped garden and timber pavilion.',
    credit: 'Conrad Los Angeles — via ResortPass',
  },
  /* ── Restaurant ×5 (press-15…19) ── */
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-15`,
    category: 'dining',
    alt_fr: 'Salle du restaurant San Laurel du chef José Andrés au Conrad Los Angeles',
    alt_en: 'Chef José Andrés’s San Laurel dining room at Conrad Los Angeles',
    caption_fr:
      'Tables de marbre et banquettes de San Laurel, la table signature de José Andrés, ouvertes sur le Walt Disney Concert Hall.',
    caption_en:
      'Marble tables and banquettes at San Laurel, José Andrés’s signature restaurant, opening onto the Walt Disney Concert Hall.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-16`,
    category: 'dining',
    alt_fr: 'Planches à partager d’Agua Viva, le rooftop du Conrad Los Angeles',
    alt_en: 'Sharing boards at Agua Viva, the Conrad Los Angeles rooftop restaurant',
    caption_fr:
      'Sliders, croquettes et bouchées de thon : les planches à partager d’Agua Viva, le rooftop façon beach club.',
    caption_en:
      'Sliders, croquettes and tuna bites: the sharing boards at Agua Viva, the beach-club-style rooftop.',
    credit: PLACES_CREDIT,
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-17`,
    category: 'dining',
    alt_fr:
      'Terrasse de San Laurel au Conrad Los Angeles, tables en bois face au Walt Disney Concert Hall',
    alt_en:
      'San Laurel terrace at Conrad Los Angeles, wooden tables facing the Walt Disney Concert Hall',
    caption_fr:
      'La terrasse de San Laurel aligne tables de bois et banquettes capitonnées face aux courbes du Walt Disney Concert Hall.',
    caption_en:
      'The San Laurel terrace lines up wooden tables and cushioned seating facing the curves of the Walt Disney Concert Hall.',
    credit: 'San Laurel — Conrad Los Angeles',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-18`,
    category: 'bar',
    alt_fr:
      'The Beaudry Room, le bar-salon du Conrad Los Angeles, comptoir et grandes baies vitrées',
    alt_en: 'The Beaudry Room, the bar-lounge at Conrad Los Angeles, counter and large windows',
    caption_fr:
      'The Beaudry Room déroule un bar-salon contemporain, fauteuils confortables et baies vitrées sur la ville.',
    caption_en:
      'The Beaudry Room unfolds a contemporary bar-lounge, comfortable seating and windows onto the city.',
    credit: 'The Beaudry Room — Conrad Los Angeles',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-19`,
    category: 'dining',
    alt_fr: 'Plats signature et champagne servis à San Laurel, Conrad Los Angeles',
    alt_en: 'Signature plates and champagne served at San Laurel, Conrad Los Angeles',
    caption_fr:
      'La cuisine espagnole de José Andrés revisitée au prisme californien : assiettes ciselées et champagne à San Laurel.',
    caption_en:
      'José Andrés’s Spanish cuisine through a Californian lens: refined plates and champagne at San Laurel.',
    credit: PLACES_CREDIT,
  },
  /* ── Spa ×4 (press-20…23) ── */
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-20`,
    category: 'spa',
    alt_fr: 'Réception du Conrad Spa Los Angeles, accueil chaleureux et boiseries contemporaines',
    alt_en: 'Conrad Spa Los Angeles reception, warm welcome and contemporary wood joinery',
    caption_fr:
      'Le Conrad Spa s’ouvre sur une réception feutrée, boiseries claires et lumière tamisée — 650 m² dédiés au bien-être.',
    caption_en:
      'The Conrad Spa opens onto a hushed reception, light wood and soft lighting — 650 sq m devoted to wellbeing.',
    credit: 'Conrad Spa Los Angeles — Hilton',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-21`,
    category: 'spa',
    alt_fr: 'Salon de relaxation du Conrad Spa Los Angeles, fauteuils cocon et éclairage tamisé',
    alt_en: 'Relaxation lounge at Conrad Spa Los Angeles, cocoon chairs and soft lighting',
    caption_fr:
      'Le salon de relaxation aligne fauteuils cocon et alcôves tendues de rideaux, sous des lampes cylindriques tamisées.',
    caption_en:
      'The relaxation lounge lines up cocoon chairs and curtained alcoves beneath soft cylindrical lamps.',
    credit: 'Conrad Spa Los Angeles — via Forbes Travel Guide',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-22`,
    category: 'spa',
    alt_fr: 'Cabine de soin du Conrad Spa Los Angeles, table de massage et boiseries chaleureuses',
    alt_en: 'Treatment room at Conrad Spa Los Angeles, massage bed and warm wood panelling',
    caption_fr:
      'La cabine de soin épurée déploie une table de massage habillée de blanc, boiseries chaudes, bougies et fleurs.',
    caption_en:
      'The minimalist treatment room unfolds a white-dressed massage bed, warm wood, candles and flowers.',
    credit: 'Conrad Spa Los Angeles — via Forbes Travel Guide',
  },
  {
    public_id: `${CONRAD_LOS_ANGELES_IMAGE_PREFIX}/press-23`,
    category: 'wellness',
    alt_fr: 'Salle de fitness du Conrad Los Angeles, cardio et musculation face aux baies vitrées',
    alt_en: 'Fitness centre at Conrad Los Angeles, cardio and strength equipment by the windows',
    caption_fr:
      'La salle de fitness aligne cardio et musculation devant de grandes baies vitrées baignées de lumière naturelle.',
    caption_en:
      'The fitness centre lines up cardio and strength equipment before large daylit windows.',
    credit: 'Conrad Los Angeles — via Forbes Travel Guide',
  },
] as const;

/** 19 unique source URLs — one per press slot (hero excluded). */
export const CONRAD_LOS_ANGELES_GALLERY_PRESS_SLOT_URLS = [
  // Vue
  'https://stories-editor.hilton.com/wp-content/uploads/2021/09/CNRD-ConradLosAng-grandAve_HR.jpg',
  'https://www.thehotelguru.com/_images/dc/46/dc4686feb402ca6de80e63e37a4a18f1/original.jpg',
  'https://media.modernluxury.com/ntgpghfuax/styles/article-hero-reg/2024/05/31/conrad_exterior.jpg.webp?t=05a76faa.webp',
  `${PLACES_REHOST}/places-8`,
  'https://mma.prnewswire.com/media/1854520/Lobby___Courtesy_of_Conrad_Los_Angeles.jpg?p=facebook',
  // Chambres
  `${PLACES_REHOST}/places-2`,
  `${PLACES_REHOST}/places-7`,
  'https://www.hilton.com/im/en/LAXAVCI/19315545/mountain-view-corner-suite-lr.jpg?impolicy=crop&cw=4500&ch=2693&gravity=NorthWest&xposition=0&yposition=153&rw=1600&rh=957',
  'https://www.hilton.com/im/en/LAXAVCI/17284796/conrad-room-1227-065922.jpg?impolicy=crop&cw=4700&ch=2813&gravity=NorthWest&xposition=149&yposition=0&rw=1600&rh=957',
  'https://www.hilton.com/im/en/LAXAVCI/17289779/conrad-room-1210-065817.jpg?impolicy=crop&cw=4700&ch=2813&gravity=NorthWest&xposition=149&yposition=0&rw=1600&rh=957',
  // Piscine
  `${PLACES_REHOST}/places-1`,
  `${PLACES_REHOST}/places-3`,
  'https://la.urbanize.city/sites/default/files/styles/1140w/public/2021-09/Conrad%20Los%20Angeles_Pool%20Deck%20-%20Credit_Related-CHEC.jpg?itok=DiiwjkPC',
  'https://resortpass.com/cdn-cgi/image/dpr=1,fit=cover,format=auto,quality=65,width=960/https://s3.us-west-2.amazonaws.com/assets.resortpass.com/uploads/image/picture/29143/ConradLosAngeles_Pool2.jpg',
  // Restaurant
  `${PLACES_REHOST}/places-6`,
  `${PLACES_REHOST}/places-9`,
  'https://images.squarespace-cdn.com/content/v1/5a5596188dd0411a8df1b41a/1676182885226-NDAS7TWR1ABG1INJ37W6/San+Laurel+Terrace+resized.jpg',
  'https://qtxasset.com/quartz/qcloud1/media/image/5.%20Conrad%20Los%20Angeles_The%20Beaudry%20Room_Courtesy%20of%20Conrad%20Los%20Angeles.jpg?VersionId=kS4xAO3fpR7Q_evvtpNG1QchFtnF0dm_',
  `${PLACES_REHOST}/places-10`,
  // Spa
  'https://assets.hiltonstatic.com/hilton-asset-cache/image/upload/c_fill,w_1920,h_1080,q_70,f_auto,g_auto/Imagery/Lifestyle%20Photography/Conrad/L/LAXAVCI/CONRAD_LA_01_SPA_Landscape_JPG_1.jpg',
  'https://secure.s.forbestravelguide.com/img/properties/conrad-spa-los-angeles/conrad-spa-los-angeles-spa.jpg',
  'https://secure.s.forbestravelguide.com/img/properties/conrad-spa-los-angeles/conrad-spa-los-angeles-treatment-room.jpg',
  'https://secure.s.forbestravelguide.com/img/properties/conrad-spa-los-angeles/conrad-spa-los-angeles-fitness-center.jpg',
] as const;

export const CONRAD_LOS_ANGELES_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  CONRAD_LOS_ANGELES_GALLERY_PRESS_SLOT_URLS,
  CONRAD_LOS_ANGELES_HERO_SOURCE_URL,
);

/** Honest filter categories represented in the manifest (no fabricated spa padding). */
export const CONRAD_LOS_ANGELES_GALLERY_CDC_CATEGORIES = [
  'view',
  'room',
  'pool',
  'dining',
  'bar',
  'spa',
  'wellness',
] as const;
