/**
 * Phase 3 — curated 30-image gallery manifest for `shangri-la-paris`.
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-shangri-la-paris-gallery-batch.ts`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 */

import { buildKitGallerySourceUrlsPerPressSlot } from './kit-gallery-promote';

export const SHANGRI_LA_PARIS_HERO_IMAGE = 'cct/hotels/shangri-la-paris/hero';

export const SHANGRI_LA_PARIS_HERO_SOURCE_URL =
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/SLPR-legal-notices-1920x940.jpg';

export const SHANGRI_LA_PARIS_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/shangri-la-paris/press-1',
    category: 'exterior',
    alt_fr: 'Façade haussmannienne du Shangri-La Paris, ancien Palais d’Iéna, avenue d’Iéna',
    alt_en: 'Haussmann facade of Shangri-La Paris, former Palais d’Iéna, Avenue d’Iéna',
    caption_fr:
      'L’ancien hôtel particulier du prince Roland Bonaparte, érigé en 1896, domine l’avenue d’Iéna face à la Seine.',
    caption_en:
      'Prince Roland Bonaparte’s former town house, built in 1896, overlooks Avenue d’Iéna facing the Seine.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-2',
    category: 'exterior',
    alt_fr: 'Entrée du palace Shangri-La Paris, 16e arrondissement',
    alt_en: 'Entrance of Shangri-La Paris palace, 16th arrondissement',
    caption_fr:
      'L’entrée du palace ouvre sur le 16e arrondissement, à deux pas du Trocadéro et de la Tour Eiffel.',
    caption_en:
      'The palace entrance opens onto the 16th arrondissement, steps from Trocadéro and the Eiffel Tower.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-3',
    category: 'exterior',
    alt_fr: 'Vue extérieure du Shangri-La Paris, monument historique et palace',
    alt_en: 'Exterior view of Shangri-La Paris, historic monument and palace',
    caption_fr:
      'Classé monument historique, le bâtiment mêle héritage du XIXe siècle et rénovation palace ouverte en 2010.',
    caption_en:
      'Listed as a historic monument, the building blends 19th-century heritage with the palace renovation opened in 2010.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-4',
    category: 'lobby',
    alt_fr: 'Grand salon du Shangri-La Paris, moulures et lumière du Palais d’Iéna',
    alt_en: 'Grand salon at Shangri-La Paris, mouldings and light of the Palais d’Iéna',
    caption_fr:
      'Les salons d’apparat conservent moulures, fresques et volumes d’origine du Palais d’Iéna.',
    caption_en:
      'The reception salons keep the Palais d’Iéna’s original mouldings, frescoes and generous volumes.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-5',
    category: 'lobby',
    alt_fr: 'Escalier d’honneur du Shangri-La Paris, marbre et dorures',
    alt_en: 'Grand staircase at Shangri-La Paris, marble and gilding',
    caption_fr:
      'L’escalier d’honneur relie les espaces historiques du palace, entre marbre clair et dorures discretement restaurées.',
    caption_en:
      'The grand staircase links the palace historic spaces, between pale marble and discreetly restored gilding.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-6',
    category: 'lobby',
    alt_fr: 'Hall d’accueil du Shangri-La Paris, fauteuils et lumière tamisée',
    alt_en: 'Reception hall at Shangri-La Paris, armchairs and soft light',
    caption_fr:
      'Le hall d’accueil accueille les arrivées dans un décor feutré, entre boiseries et lumière dorée.',
    caption_en:
      'The reception hall welcomes arrivals in a hushed setting, between panelling and golden light.',
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
    public_id: 'cct/hotels/shangri-la-paris/press-11',
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
    public_id: 'cct/hotels/shangri-la-paris/press-12',
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
    public_id: 'cct/hotels/shangri-la-paris/press-13',
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
    public_id: 'cct/hotels/shangri-la-paris/press-14',
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
    public_id: 'cct/hotels/shangri-la-paris/press-15',
    category: 'spa',
    alt_fr: 'Salle de fitness du Shangri-La Paris',
    alt_en: 'Fitness room at Shangri-La Paris',
    caption_fr:
      'La salle de fitness ouvre tôt le matin — pratique avant un petit-déjeuner face à la Tour Eiffel.',
    caption_en: 'The fitness room opens early — handy before breakfast facing the Eiffel Tower.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-16',
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
    public_id: 'cct/hotels/shangri-la-paris/press-17',
    category: 'pool',
    alt_fr: 'Bassin du CHI Spa avec baies vitrées, Shangri-La Paris',
    alt_en: 'CHI Spa pool with bay windows, Shangri-La Paris',
    caption_fr:
      'Les grandes baies vitrées du spa laissent entrer la lumière du 16e sur le bassin intérieur.',
    caption_en: 'The spa’s large bay windows bring 16th-arrondissement light into the indoor pool.',
    credit: 'Shangri-La Paris — CHI, The Spa',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-18',
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
    public_id: 'cct/hotels/shangri-la-paris/press-19',
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
    public_id: 'cct/hotels/shangri-la-paris/press-20',
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
    public_id: 'cct/hotels/shangri-la-paris/press-21',
    category: 'view',
    alt_fr: 'Vue nocturne sur la Tour Eiffel depuis le Shangri-La Paris',
    alt_en: 'Night view of the Eiffel Tower from Shangri-La Paris',
    caption_fr:
      'Au crépuscule, les scintillements de la Tour Eiffel se lisent depuis les étages élevés du palace.',
    caption_en: 'At dusk, the Eiffel Tower’s sparkles unfold from the palace upper floors.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-22',
    category: 'detail',
    alt_fr: 'Détail de moulures et fresques historiques, Shangri-La Paris',
    alt_en: 'Detail of historic mouldings and frescoes, Shangri-La Paris',
    caption_fr:
      'Moulures, fresques et boiseries d’origine ont été préservées lors de la conversion palace.',
    caption_en:
      'Original mouldings, frescoes and panelling were preserved during the palace conversion.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-23',
    category: 'detail',
    alt_fr: 'Art de la table et vaisselle fine, Shangri-La Paris',
    alt_en: 'Table setting and fine china, Shangri-La Paris',
    caption_fr: 'La table du palace conjugue porcelaine fine et art de recevoir à la française.',
    caption_en: 'The palace table pairs fine porcelain with French hospitality craft.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-24',
    category: 'detail',
    alt_fr: 'Bouquet et décoration florale du Shangri-La Paris',
    alt_en: 'Floral arrangement at Shangri-La Paris',
    caption_fr:
      'Les compositions florales rythment les salons historiques et les chambres préparées à l’arrivée.',
    caption_en: 'Floral compositions punctuate the historic salons and rooms prepared on arrival.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-25',
    category: 'concierge',
    alt_fr: 'Conciergerie du Shangri-La Paris, desk et équipe',
    alt_en: 'Concierge desk and team at Shangri-La Paris',
    caption_fr:
      'La conciergerie Clefs d’Or coordonne réservations, transferts et visites du patrimoine du Palais d’Iéna.',
    caption_en:
      'The Les Clefs d’Or concierge desk coordinates bookings, transfers and Palais d’Iéna heritage tours.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-26',
    category: 'concierge',
    alt_fr: 'Service voiturier à l’entrée du Shangri-La Paris',
    alt_en: 'Valet service at Shangri-La Paris entrance',
    caption_fr:
      'Le voiturier accueille les arrivées avenue d’Iéna — pratique avant un dîner au Shang Palace.',
    caption_en: 'Valet welcomes arrivals on Avenue d’Iéna — handy before dinner at Shang Palace.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-27',
    category: 'concierge',
    alt_fr: 'Salon privé pour réceptions intimes, Shangri-La Paris',
    alt_en: 'Private salon for intimate receptions, Shangri-La Paris',
    caption_fr:
      'Les Salons du Prince accueillent réceptions privées et dîners sur mesure dans le cadre historique.',
    caption_en:
      'Les Salons du Prince host private receptions and bespoke dinners in the historic setting.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-28',
    category: 'events',
    alt_fr: 'Salle de réception historique du Shangri-La Paris',
    alt_en: 'Historic reception room at Shangri-La Paris',
    caption_fr:
      'Les salons classés du Palais d’Iéna accueillent mariages, galas et boardrooms jusqu’à 280 convives.',
    caption_en:
      'The listed Palais d’Iéna salons host weddings, galas and boardrooms for up to 280 guests.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-29',
    category: 'events',
    alt_fr: 'Cocktail dans un salon du Shangri-La Paris',
    alt_en: 'Cocktail reception in a Shangri-La Paris salon',
    caption_fr:
      'Cocktails et dîners de gala se déploient dans les volumes d’origine du prince Roland Bonaparte.',
    caption_en: 'Cocktails and gala dinners unfold in Prince Roland Bonaparte’s original volumes.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
  {
    public_id: 'cct/hotels/shangri-la-paris/press-30',
    category: 'events',
    alt_fr: 'Mariage et réception au Shangri-La Paris, verrière La Bauhinia',
    alt_en: 'Wedding reception at Shangri-La Paris, La Bauhinia cupola',
    caption_fr:
      'La verrière de La Bauhinia et les salons historiques composent un cadre MICE au cœur du 16e.',
    caption_en:
      'La Bauhinia’s cupola and historic salons form a MICE setting at the heart of the 16th.',
    credit: 'Shangri-La Paris (Shangri-La Hotels & Resorts)',
  },
] as const;

/** CDC §2.2 category floor — 10 required categories. */
export const SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS = [
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/SLPR-legal-notices-1920x940.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/202510_SLPR_Awards_1920x940.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/SLPR-legal-notices-1920x940.jpg',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/about/SLPR-Lobby.jpg?width=1200&quality=90',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/SLPR-bg-Dining.jpg',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/C/C/2/%7BCC23F5E5-41CB-4537-8CBD-39699580275C%7DSLPR-AppartementPrinceBonaparte.JPG',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/6/B/F/%7B6BFC2F77-9EAB-45FC-A30C-57AF66AD6F77%7D012026-Deluxe-Room-1.jpg?w=1200&mode=crop&scale=both',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/9/8/7/%7B9871D466-193E-45D8-B05B-5600A80C157D%7DSLPR-DeluxeSuite.JPG',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/7/9/%7B279B78FD-40AE-4194-9AFF-A14E5B29CEED%7D012026-Junior-Suite-Paris-View-1.jpg',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/SLPR-bg-Dining.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/39-La-Suite-Shangri-La.jpg',
  'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox2_Desktop_1140x760.JPG?w=1140',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/D/4/%7B2D4595ED-B36A-4A48-BA8D-D44F682E02D7%7D202411-enchanted-wonders-paris-1180x535.jpg?w=1180&mode=crop&quality=100&scale=both',
  'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox1_Desktop_1140x760.JPG?w=1140',
  'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox1_Desktop_1140x760.JPG?w=1140',
  'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox1_Desktop_1140x760.JPG?w=1140',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/D/4/%7B2D4595ED-B36A-4A48-BA8D-D44F682E02D7%7D202411-enchanted-wonders-paris-1180x535.jpg?w=1180&mode=crop&quality=100&scale=both',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/6/B/9/%7B6B98157F-601B-4B2D-987A-E34023334662%7D012026-Duplex-Terrace-Eiffel-View-Suite-1.jpg',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/7/9/%7B279B78FD-40AE-4194-9AFF-A14E5B29CEED%7D012026-Junior-Suite-Paris-View-1.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/39-La-Suite-Shangri-La.jpg',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/C/C/2/%7BCC23F5E5-41CB-4537-8CBD-39699580275C%7DSLPR-AppartementPrinceBonaparte.JPG',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/about/SLPR-Lobby.jpg?width=1200&quality=90',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/about/SLPR-Lobby.jpg?width=1200&quality=90',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/202510_SLPR_Awards_1920x940.jpg',
  'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/C/C/2/%7BCC23F5E5-41CB-4537-8CBD-39699580275C%7DSLPR-AppartementPrinceBonaparte.JPG',
  'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/SLPR-bg-Dining.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg',
  'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/39-La-Suite-Shangri-La.jpg',
] as const;

export const SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS = buildKitGallerySourceUrlsPerPressSlot(
  SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
);

export const SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES = [
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
