/**
 * Phase 3 — curated 30-image gallery manifest for `prince-de-galles-paris`.
 *
 * Mirrors the Airelles golden-template shape (`AIRELLES_GALLERY_IMAGES`).
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-prince-de-galles-gallery-batch.ts`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 *
 * Pool: the heritage building has no on-site pool (reviews + Marriott copy);
 * press-16 → press-18 are metadata-only placeholders pending a PO decision
 * (skip category vs. honest “no pool” editorial note).
 */

export const PRINCE_DE_GALLES_HERO_IMAGE = 'cct/hotels/prince-de-galles-paris/press-1';

export const PRINCE_DE_GALLES_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-1',
    category: 'exterior',
    alt_fr: 'Façade Art déco du Prince de Galles, avenue George V, Paris',
    alt_en: 'Art Deco facade of Prince de Galles on Avenue George V, Paris',
    caption_fr:
      'La façade en pierre claire du palace, inauguré en 1929, domine l’avenue George V à deux pas des Champs-Élysées.',
    caption_en:
      'The pale-stone palace facade, opened in 1929, overlooks Avenue George V steps from the Champs-Élysées.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-2',
    category: 'exterior',
    alt_fr: 'Entrée du Prince de Galles Paris, palace du Triangle d’Or',
    alt_en: 'Entrance of Prince de Galles Paris, Golden Triangle palace',
    caption_fr:
      'L’entrée du palace ouvre sur l’avenue George V, adresse discrète du Triangle d’Or depuis près d’un siècle.',
    caption_en:
      'The palace entrance opens onto Avenue George V, a discreet Golden Triangle address for nearly a century.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-3',
    category: 'exterior',
    alt_fr: 'Vue extérieure du Prince de Galles Paris, style Art déco',
    alt_en: 'Exterior view of Prince de Galles Paris, Art Deco style',
    caption_fr:
      'Les lignes géométriques de la façade incarnent l’Art déco parisien des années 1920, restaurées en 2014.',
    caption_en: 'The facade’s geometric lines embody 1920s Parisian Art Deco, restored in 2014.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-4',
    category: 'lobby',
    alt_fr: 'Lobby Art déco du Prince de Galles Paris, lustres et marbre',
    alt_en: 'Art Deco lobby at Prince de Galles Paris, chandeliers and marble',
    caption_fr:
      'Le lobby mêle marbre noir, bois de Macassar et lustres dorés, dans l’esprit d’un salon parisien des années 1920.',
    caption_en:
      'The lobby blends black marble, Macassar wood and gilded chandeliers, in the spirit of a 1920s Parisian salon.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-5',
    category: 'lobby',
    alt_fr: 'Escalier en marbre du Prince de Galles Paris',
    alt_en: 'Marble staircase at Prince de Galles Paris',
    caption_fr:
      'L’escalier en marbre relie les espaces publics du palace, entre photographies noir et blanc et lumière tamisée.',
    caption_en:
      'The marble staircase links the palace public spaces, between black-and-white photography and soft light.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-6',
    category: 'lobby',
    alt_fr: 'Salon d’accueil du Prince de Galles Paris, fauteuils capitonnés',
    alt_en: 'Reception lounge at Prince de Galles Paris, tufted armchairs',
    caption_fr:
      'Le salon d’accueil accueille les arrivées dans un décor feutré : velours, boiseries laquées et lumière dorée.',
    caption_en:
      'The reception lounge welcomes arrivals in a hushed setting: velvet, lacquered panelling and golden light.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-7',
    category: 'room',
    alt_fr: 'Chambre Art Déco Deluxe du Prince de Galles Paris, tête de lit miroitée',
    alt_en: 'Art Deco Deluxe Room at Prince de Galles Paris with a mirrored headboard',
    caption_fr:
      'La chambre Art Déco Deluxe signe la maison : lignes géométriques, tête de lit miroitée et linge fin.',
    caption_en:
      'The Art Deco Deluxe Room carries the house signature: geometric lines, a mirrored headboard and fine linen.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-8',
    category: 'room',
    alt_fr: 'Coin nuit d’une chambre Art déco, lit king size, Prince de Galles Paris',
    alt_en: 'Sleeping area of an Art Deco room with a king bed, Prince de Galles Paris',
    caption_fr:
      'Le coin nuit, habillé d’un lit king size, prolonge la palette sobre et lumineuse des 116 chambres du palace.',
    caption_en:
      'The sleeping area, dressed with a king-size bed, extends the sober, bright palette of the palace’s 116 rooms.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-9',
    category: 'room',
    alt_fr: 'Chambre avec vue sur la cour intérieure, Prince de Galles Paris',
    alt_en: 'Guest room with a courtyard view, Prince de Galles Paris',
    caption_fr:
      'Côté cour, la chambre ouvre sur Le Patio, la cour intérieure mosaïquée au calme du cœur d’îlot parisien.',
    caption_en:
      'On the courtyard side, the room opens onto Le Patio, the mosaic inner courtyard quiet at the heart of the block.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-10',
    category: 'dining',
    alt_fr: 'Le Patio du Prince de Galles Paris, cour mosaïquée',
    alt_en: 'Le Patio at Prince de Galles Paris, mosaic courtyard',
    caption_fr:
      'Le Patio, cour mosaïquée au cœur du palace, sert petits déjeuners, déjeuners et cocktails à l’abri de l’avenue.',
    caption_en:
      'Le Patio, the mosaic courtyard at the heart of the palace, serves breakfast, lunch and cocktails sheltered from the avenue.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-11',
    category: 'dining',
    alt_fr: 'Terrasse végétalisée de Le Patio, Prince de Galles Paris',
    alt_en: 'Planted terrace of Le Patio, Prince de Galles Paris',
    caption_fr:
      'La terrasse de Le Patio mêle mosaïques Art déco et verdure, refuge estival à deux pas des Champs-Élysées.',
    caption_en:
      'Le Patio terrace blends Art Deco mosaics and greenery, a summer refuge steps from the Champs-Élysées.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-12',
    category: 'dining',
    alt_fr: 'Brunch dominical au Prince de Galles Paris',
    alt_en: 'Sunday brunch at Prince de Galles Paris',
    caption_fr:
      'Le brunch du palace aligne pâtisseries fines, créations salées et bulles, servi au Akira Back ou sur Le Patio.',
    caption_en:
      'The palace brunch lines fine pastries, savoury creations and sparkling wine, served at Akira Back or on Le Patio.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-13',
    category: 'spa',
    alt_fr: 'Salle de bain de la Wellness Suite, Prince de Galles Paris',
    alt_en: 'Bathroom of the Wellness Suite, Prince de Galles Paris',
    caption_fr:
      'La Wellness Suite accueille soins et hammam sur rendez-vous, dans l’intimité d’une salle de bain en marbre.',
    caption_en:
      'The Wellness Suite hosts treatments and a hammam by appointment, in the privacy of a marble bathroom.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-14',
    category: 'spa',
    alt_fr: 'Salle de bain à mosaïque colorée de la Suite Mosaïque, Prince de Galles Paris',
    alt_en: 'Colourful mosaic bathroom of the Mosaic Suite, Prince de Galles Paris',
    caption_fr:
      'La mosaïque de céramique aux teintes Art déco habille la salle de bain, l’une des plus photogéniques de la maison.',
    caption_en:
      'Ceramic mosaic in Art Deco hues dresses the bathroom, one of the most photogenic in the house.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-15',
    category: 'spa',
    alt_fr: 'Salle de bain en marbre d’une suite signature, Prince de Galles Paris',
    alt_en: 'Marble bathroom of a signature suite, Prince de Galles Paris',
    caption_fr:
      'Douche et baignoire séparées, marbre et produits Lalique composent le rituel bien-être des suites du palace.',
    caption_en:
      'Separate shower and bath, marble and Lalique amenities make up the wellness ritual in the palace suites.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-16',
    category: 'pool',
    alt_fr: 'Salle de fitness 24h/24 du Prince de Galles Paris',
    alt_en: '24-hour fitness room at Prince de Galles Paris',
    caption_fr:
      'Pas de piscine sur site : le palace équipe une salle de fitness ouverte vingt-quatre heures sur vingt-quatre ; la conciergerie oriente vers les clubs voisins pour la natation.',
    caption_en:
      'No on-site pool: the palace offers a twenty-four-hour fitness room; the concierge directs guests to nearby clubs for swimming.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-17',
    category: 'pool',
    alt_fr: 'Wellness Suite CALMA au Prince de Galles Paris',
    alt_en: 'CALMA Wellness Suite at Prince de Galles Paris',
    caption_fr:
      'La Wellness Suite CALMA accueille soins et hammam sur rendez-vous — alternative bien-être lorsque le palace ne dispose pas de bassin.',
    caption_en:
      'The CALMA Wellness Suite hosts treatments and a hammam by appointment — the wellness alternative where the palace has no pool.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-18',
    category: 'pool',
    alt_fr: 'Cour Le Patio du Prince de Galles Paris, refuge estival',
    alt_en: 'Le Patio courtyard at Prince de Galles Paris, summer retreat',
    caption_fr:
      'Le Patio mosaïqué offre fraîcheur et intimité au cœur du palace — le Concierge y installe petits déjeuners et cocktails loin de l’agitation de l’avenue.',
    caption_en:
      'The mosaic Patio offers cool intimacy at the heart of the palace — the Concierge sets breakfast and cocktails away from avenue bustle.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-19',
    category: 'view',
    alt_fr:
      'Balcon de la Suite Patrick Hellmann avec vue sur la tour Eiffel, Prince de Galles Paris',
    alt_en: 'Balcony of the Patrick Hellmann Suite with Eiffel Tower view, Prince de Galles Paris',
    caption_fr:
      'Depuis le balcon de la suite signature, les toits de Paris et la tour Eiffel se dévoilent au-dessus de l’avenue George V.',
    caption_en:
      'From the signature suite balcony, the Paris rooftops and the Eiffel Tower unfold above Avenue George V.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-20',
    category: 'view',
    alt_fr: 'Vue sur l’avenue George V depuis une chambre, Prince de Galles Paris',
    alt_en: 'View over Avenue George V from a guest room, Prince de Galles Paris',
    caption_fr:
      'Côté avenue, la chambre attrape l’animation du Triangle d’Or et la lumière du boulevard George V.',
    caption_en:
      'On the avenue side, the room catches the Golden Triangle energy and the light of George V.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-21',
    category: 'view',
    alt_fr: 'Tour Eiffel vue depuis le Prince de Galles Paris',
    alt_en: 'Eiffel Tower seen from Prince de Galles Paris',
    caption_fr:
      'Depuis les étages supérieurs, la tour Eiffel domine l’horizon parisien, à quelques minutes à pied du palace.',
    caption_en:
      'From the upper floors, the Eiffel Tower dominates the Paris skyline, a few minutes’ walk from the palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-22',
    category: 'detail',
    alt_fr: 'Salle de bain en marbre et mosaïque Art déco, Prince de Galles Paris',
    alt_en: 'Marble and Art Deco mosaic bathroom, Prince de Galles Paris',
    caption_fr:
      'Le marbre et la mosaïque d’inspiration Art déco composent les salles de bain, signature tactile du palace.',
    caption_en:
      'Marble and Art Deco-inspired mosaic shape the bathrooms, a tactile signature of the palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-23',
    category: 'detail',
    alt_fr: 'Détail de mosaïque Art déco de la salle de bain, Prince de Galles Paris',
    alt_en: 'Art Deco mosaic bathroom detail, Prince de Galles Paris',
    caption_fr:
      'Les motifs géométriques de la mosaïque reprennent la grammaire décorative des années 1920, restaurée en 2014.',
    caption_en:
      'The mosaic’s geometric patterns echo the 1920s decorative grammar, restored in 2014.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-24',
    category: 'detail',
    alt_fr: 'Détail de décoration en cristal Lalique de la suite signature, Prince de Galles Paris',
    alt_en: 'Lalique crystal decorative detail of the signature suite, Prince de Galles Paris',
    caption_fr:
      'Le cristal Lalique habille la Suite Patrick Hellmann, né d’une collaboration avec la maison Lalique.',
    caption_en:
      'Lalique crystal dresses the Patrick Hellmann Suite, born of a collaboration with Maison Lalique.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-25',
    category: 'concierge',
    alt_fr: 'Lobby et conciergerie Clefs d’Or du Prince de Galles Paris',
    alt_en: 'Lobby and Clefs d’Or concierge desk at Prince de Galles Paris',
    caption_fr:
      'La conciergerie Clefs d’Or ouvre sur le lobby : réservations, billets et accès privilégiés à Paris, de jour comme de nuit.',
    caption_en:
      'The Clefs d’Or concierge desk opens onto the lobby: reservations, tickets and privileged Paris access, day or night.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-26',
    category: 'concierge',
    alt_fr: 'Salon d’accueil et conciergerie Clefs d’Or, Prince de Galles Paris',
    alt_en: 'Reception lounge and Clefs d’Or concierge at Prince de Galles Paris',
    caption_fr:
      'Le salon d’accueil prolonge le lobby : fauteuils capitonnés, lumière tamisée et conciergerie Clefs d’Or joignable de jour comme de nuit.',
    caption_en:
      'The reception lounge extends the lobby: tufted armchairs, soft light and Clefs d’Or concierge reachable day and night.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-27',
    category: 'concierge',
    alt_fr: 'Suite Prince avec salon privé, Prince de Galles Paris',
    alt_en: 'Prince Suite with private lounge, Prince de Galles Paris',
    caption_fr:
      'La Suite Prince illustre le service sur mesure du palace : salon séparé, art déco et accès direct à la conciergerie pour les demandes de dernière minute.',
    caption_en:
      'The Prince Suite illustrates bespoke palace service: separate lounge, Art Deco details and direct concierge access for last-minute requests.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-28',
    category: 'events',
    alt_fr: 'Espace de réception de la Suite Or, Prince de Galles Paris',
    alt_en: 'Reception space of the Suite Or, Prince de Galles Paris',
    caption_fr:
      'Le double salon de la Suite Or accueille réceptions privées et célébrations, jusqu’à quarante invités.',
    caption_en:
      'The Suite Or double living room hosts private receptions and celebrations, for up to forty guests.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-29',
    category: 'events',
    alt_fr: 'Salon séparé de la Suite Mosaïque, Prince de Galles Paris',
    alt_en: 'Separate living room of the Mosaic Suite, Prince de Galles Paris',
    caption_fr:
      'Le salon de la Suite Mosaïque se prête aux dîners intimistes et aux réunions en petit comité, loin de l’agitation.',
    caption_en:
      'The Mosaic Suite living room suits intimate dinners and small meetings, away from the bustle.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
  {
    public_id: 'cct/hotels/prince-de-galles-paris/press-30',
    category: 'events',
    alt_fr: 'Le Patio du Prince de Galles Paris, réceptions en plein air',
    alt_en: 'Le Patio at Prince de Galles Paris, outdoor receptions',
    caption_fr:
      'Le Patio mosaïqué accueille cocktails et dîners privés en plein air, au cœur du palace de l’avenue George V.',
    caption_en:
      'The mosaic Patio hosts cocktails and private outdoor dinners, at the heart of the Avenue George V palace.',
    credit: 'Prince de Galles, a Luxury Collection Hotel, Paris (Marriott)',
  },
] as const;

/** CDC §2.2 category floor — 10 required categories. */
export const PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES = [
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
