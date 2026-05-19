/**
 * Editorial destinations catalog — single source of truth for the
 * `/guide/[slug]` route surface. Each entry drives one `editorial_guides`
 * row in Supabase + one generated long-form article.
 *
 * Coverage: French luxury-travel hotspots that actually host one or
 * more Palaces in our catalog (so each guide can naturally cross-link
 * to fiches via `<RelatedHotels>` and emit an `ItemList[Hotel]` JSON-LD
 * graph). Adding a destination here MUST be paired with at least one
 * published `hotels` row mapping to the same city / cluster.
 *
 * The `keywords` field feeds the IA prompts so the editorial copy
 * captures domain-specific facts (architects, palaces, gastronomic
 * heritage) — never a generic Wikipedia summary.
 */

export type GuideScope = 'city' | 'cluster' | 'region' | 'country';

export interface DestinationGuideSeed {
  /** URL slug — kebab-case ASCII, stable. */
  readonly slug: string;
  /** Display name FR. */
  readonly nameFr: string;
  /** Display name EN. */
  readonly nameEn: string;
  /** Editorial scope (drives the JSON-LD shape). */
  readonly scope: GuideScope;
  /** ISO 3166-1 alpha-2 country code. */
  readonly countryCode: string;
  /** Matching `hotels.city` values (case-insensitive) for cross-link. */
  readonly hotelCityKeys: readonly string[];
  /** Editorial keywords / facts the AI MUST anchor (palaces, history, gastronomy). */
  readonly keywordsFr: readonly string[];
  /** Editorial keywords / facts the AI MUST anchor (EN locale). */
  readonly keywordsEn: readonly string[];
  /** One-line "tone" hint for the AI ("intemporel", "alpin", "balnéaire"). */
  readonly toneFr: string;
  /** Optional Cloudinary hero `public_id` already curated by editorial. */
  readonly heroImage?: string;
}

export const DESTINATIONS: readonly DestinationGuideSeed[] = [
  // ── Paris ─────────────────────────────────────────────────────────────────
  {
    slug: 'paris',
    nameFr: 'Paris',
    nameEn: 'Paris',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['paris'],
    keywordsFr: [
      'Palaces parisiens Atout France',
      'Plaza Athénée, Le Bristol, Le Meurice, Ritz, Crillon, Cheval Blanc, George V, Lutetia, Mandarin Oriental',
      "Triangle d'or — Avenue Montaigne, rue Saint-Honoré, Champs-Élysées",
      'Rive gauche : Saint-Germain-des-Prés, Lutetia, Le Pavillon de la Reine',
      'Gastronomie : Alléno, Ducasse, Anne-Sophie Pic, Cyril Lignac',
      'Musées : Louvre, Orsay, Orangerie, Picasso, Rodin',
      "Saisons : Fashion Weeks, Roland-Garros, Salon de l'Aéronautique",
      'Aéroports : CDG (32 km), Orly (18 km), Le Bourget (jet privé)',
    ],
    keywordsEn: [
      'Parisian Palaces awarded by Atout France',
      'Plaza Athénée, Le Bristol, Le Meurice, Ritz, Crillon, Cheval Blanc Paris',
      'Golden Triangle: Avenue Montaigne, Rue Saint-Honoré, Champs-Élysées',
      'Left Bank: Saint-Germain-des-Prés, Lutetia',
      'Gastronomy: Alléno, Ducasse, Pic, Lignac',
      'Museums: Louvre, Orsay, Orangerie, Picasso, Rodin',
    ],
    toneFr: 'intemporel, élégant, parisien',
    heroImage: 'editorial/destinations/paris-hero',
  },

  // ── Côte d'Azur (cluster) ─────────────────────────────────────────────────
  {
    slug: 'cote-d-azur',
    nameFr: "Côte d'Azur",
    nameEn: 'French Riviera',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'cannes',
      'nice',
      'antibes',
      "cap d'antibes",
      'saint-jean-cap-ferrat',
      'cap-ferrat',
      'menton',
      'eze',
      'saint-tropez',
      'ramatuelle',
      'monaco',
      'monte-carlo',
      'beaulieu-sur-mer',
      'roquebrune-cap-martin',
    ],
    keywordsFr: [
      'Riviera française — de Saint-Tropez à Menton',
      'Palaces emblématiques : Hôtel du Cap-Eden-Roc, Grand-Hôtel du Cap-Ferrat, La Réserve Ramatuelle, Cheval Blanc Saint-Tropez, Le Negresco, Château Saint-Martin, Cap-Estel',
      'Climat méditerranéen — 300 jours de soleil',
      'Festival de Cannes (mai), Grand Prix de Monaco (mai), Yachting',
      "Gastronomie : Mauro Colagreco (Mirazur), Argilla, La Vague d'Or",
      "Aéroport : Nice-Côte d'Azur (NCE), héliport de Monaco",
    ],
    keywordsEn: [
      'French Riviera — from Saint-Tropez to Menton',
      'Iconic Palaces: Hôtel du Cap-Eden-Roc, Grand-Hôtel du Cap-Ferrat, La Réserve, Cheval Blanc Saint-Tropez',
      'Mediterranean climate — 300 sunny days',
      'Cannes Film Festival, Monaco Grand Prix, yachting',
      'Gastronomy: Mauro Colagreco (Mirazur)',
    ],
    toneFr: 'balnéaire, lumineux, méditerranéen',
    heroImage: 'editorial/destinations/cote-d-azur-hero',
  },

  // ── Alpes (cluster) ───────────────────────────────────────────────────────
  {
    slug: 'alpes',
    nameFr: 'Alpes françaises',
    nameEn: 'French Alps',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'courchevel',
      'megève',
      'megeve',
      "val d'isère",
      "val d'isere",
      'chamonix',
      'chamonix-mont-blanc',
      'tignes',
      'val thorens',
      "l'alpe d'huez",
      'avoriaz',
      'morzine',
    ],
    keywordsFr: [
      "Stations 5 étoiles — Courchevel 1850, Megève, Val d'Isère, Chamonix",
      'Palaces alpins : Les Airelles, Cheval Blanc Courchevel, Le K2 Palace, Six Senses Courchevel, Four Seasons Megève, Le Strato',
      'Domaine skiable des 3 Vallées (600 km de pistes)',
      'Ski-in / ski-out, hélicoptère privé, dameuse de nuit',
      'Gastronomie alpine : Le 1947 (Yannick Alléno, Cheval Blanc), Pierre Gagnaire',
      'Saisons : ski (décembre-avril), été montagne (juin-septembre)',
    ],
    keywordsEn: [
      "Five-star resorts: Courchevel 1850, Megève, Val d'Isère, Chamonix",
      'Alpine Palaces: Les Airelles, Cheval Blanc Courchevel, Le K2 Palace, Six Senses',
      '3 Valleys ski domain (600 km of slopes)',
      'Alpine gastronomy: Le 1947 (Yannick Alléno)',
    ],
    toneFr: 'alpin, sportif, exclusif',
    heroImage: 'editorial/destinations/alpes-hero',
  },

  // ── Courchevel (city) ─────────────────────────────────────────────────────
  {
    slug: 'courchevel',
    nameFr: 'Courchevel',
    nameEn: 'Courchevel',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['courchevel'],
    keywordsFr: [
      'Courchevel 1850 — station la plus prestigieuse des Alpes',
      "Palaces : Les Airelles, Cheval Blanc Courchevel, Le K2 Palace, Six Senses Courchevel, L'Apogée, Le Strato, Aman Le Mélézin",
      'Domaine skiable des 3 Vallées — 600 km, ski-in / ski-out',
      'Altiport (privatif), héliport, Genève à 2h en voiture',
      "Gastronomie : Le 1947 (Yannick Alléno), La Table de l'Hubert",
      'Saison : 15 décembre - 15 avril (hiver), été restreint',
    ],
    keywordsEn: [
      'Courchevel 1850 — most prestigious resort in the Alps',
      'Palaces: Les Airelles, Cheval Blanc Courchevel, Le K2 Palace',
      'Altiport, helipad, 2h from Geneva',
    ],
    toneFr: 'altitudes, raffiné, exclusivité absolue',
  },

  // ── Megève ────────────────────────────────────────────────────────────────
  {
    slug: 'megeve',
    nameFr: 'Megève',
    nameEn: 'Megève',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['megève', 'megeve'],
    keywordsFr: [
      'Megève — village 5* aux portes du Mont-Blanc',
      'Palaces : Four Seasons Megève, Le Fer à Cheval, Les Fermes de Marie',
      'Patrimoine Noémie de Rothschild — esprit village authentique',
      'Domaine Évasion Mont-Blanc — 445 km de pistes',
      'Aéroport de Genève (1h30)',
      "Gastronomie : La Table de l'Alpaga, 1920 (Edouard Loubet)",
    ],
    keywordsEn: [
      'Megève — 5-star village at the gates of Mont-Blanc',
      'Palaces: Four Seasons Megève, Le Fer à Cheval, Les Fermes de Marie',
      'Évasion Mont-Blanc ski domain (445 km)',
    ],
    toneFr: 'authentique, village, chaleureux',
  },

  // ── Cannes ────────────────────────────────────────────────────────────────
  {
    slug: 'cannes',
    nameFr: 'Cannes',
    nameEn: 'Cannes',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['cannes'],
    keywordsFr: [
      'Cannes — capitale du cinéma et des yachts',
      'Palaces : Carlton Cannes, Majestic Barrière, Martinez, JW Marriott',
      'Boulevard de la Croisette, Palais des Festivals',
      'Îles de Lérins (Sainte-Marguerite, Saint-Honorat)',
      'Festival de Cannes (mai), MIPIM, Cannes Lions',
      "Aéroport Nice-Côte d'Azur (30 min), héliport (15 min)",
    ],
    keywordsEn: [
      'Cannes — capital of cinema and yachts',
      'Palaces: Carlton, Majestic, Martinez, JW Marriott',
      'Croisette, Palais des Festivals, Lérins Islands',
    ],
    toneFr: 'cinématographique, méditerranéen, glamour',
  },

  // ── Saint-Tropez ──────────────────────────────────────────────────────────
  {
    slug: 'saint-tropez',
    nameFr: 'Saint-Tropez',
    nameEn: 'Saint-Tropez',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['saint-tropez', 'ramatuelle'],
    keywordsFr: [
      'Saint-Tropez — village mythique du golfe',
      'Palaces : Cheval Blanc Saint-Tropez (ex-Résidence de la Pinède), La Réserve Ramatuelle, Lou Pinet, Byblos',
      'Plages de Pampelonne — Club 55, Nikki Beach, La Plage des Jumeaux',
      'Citadelle, place des Lices, port',
      'Yachting, Voiles de Saint-Tropez (octobre)',
      'Aéroport Saint-Tropez La Môle (jet privé) ou Nice (1h30)',
    ],
    keywordsEn: [
      'Saint-Tropez — legendary village of the gulf',
      'Palaces: Cheval Blanc Saint-Tropez, La Réserve Ramatuelle, Byblos',
      'Pampelonne beaches: Club 55, Nikki Beach',
    ],
    toneFr: 'estival, festif, méditerranéen',
  },

  // ── Saint-Jean-Cap-Ferrat ─────────────────────────────────────────────────
  {
    slug: 'cap-ferrat',
    nameFr: 'Cap-Ferrat',
    nameEn: 'Cap-Ferrat',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['saint-jean-cap-ferrat', 'cap-ferrat'],
    keywordsFr: [
      "Saint-Jean-Cap-Ferrat — presqu'île la plus chère du monde",
      "Palaces : Grand-Hôtel du Cap-Ferrat (Four Seasons), Cap-Estel, La Voile d'Or",
      'Villa Ephrussi de Rothschild, Villa Santo Sospir',
      'Sentier des douaniers, plage de Passable',
      'Aéroport Nice (20 min), héliport Monaco (8 min)',
    ],
    keywordsEn: [
      'Saint-Jean-Cap-Ferrat — most expensive peninsula in the world',
      'Palaces: Grand-Hôtel du Cap-Ferrat (Four Seasons), Cap-Estel',
      'Villa Ephrussi de Rothschild',
    ],
    toneFr: 'serein, exclusif, intime',
  },

  // ── Cap d'Antibes ────────────────────────────────────────────────────────
  {
    slug: 'cap-d-antibes',
    nameFr: "Cap d'Antibes",
    nameEn: "Cap d'Antibes",
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ["cap d'antibes", 'cap-d-antibes', 'antibes'],
    keywordsFr: [
      "Cap d'Antibes — entre Cannes et Nice",
      'Palaces : Hôtel du Cap-Eden-Roc (1870)',
      'Plage de la Garoupe, Phare de la Garoupe',
      'Musée Picasso, Vieil Antibes, Port Vauban',
      "Aéroport Nice-Côte d'Azur (20 min)",
    ],
    keywordsEn: [
      "Cap d'Antibes — between Cannes and Nice",
      'Palace: Hôtel du Cap-Eden-Roc (1870)',
      'Musée Picasso, Old Antibes',
    ],
    toneFr: 'discret, prestigieux, intemporel',
  },

  // ── Biarritz ──────────────────────────────────────────────────────────────
  {
    slug: 'biarritz',
    nameFr: 'Biarritz',
    nameEn: 'Biarritz',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['biarritz'],
    keywordsFr: [
      'Biarritz — perle de la Côte basque',
      "Palace : Hôtel du Palais (1854, ancien palais d'été d'Eugénie de Montijo)",
      'Plages : Grande Plage, Plage Miramar, Côte des Basques',
      'Surf, golf, thalasso',
      'Pays basque, Bayonne, San Sebastián (45 min)',
      'Aéroport BIQ',
    ],
    keywordsEn: [
      'Biarritz — pearl of the Basque coast',
      'Palace: Hôtel du Palais (1854)',
      'Grande Plage, surf, thalasso',
    ],
    toneFr: 'atlantique, basque, raffiné',
  },

  // ── Bordeaux ──────────────────────────────────────────────────────────────
  {
    slug: 'bordeaux',
    nameFr: 'Bordeaux',
    nameEn: 'Bordeaux',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['bordeaux', 'martillac', 'saint-emilion', 'saint-émilion', 'pauillac'],
    keywordsFr: [
      'Bordeaux — capitale mondiale du vin (UNESCO)',
      'Palaces : Les Sources de Caudalie (Martillac), Château Hôtel Grand Barrail (Saint-Émilion), InterContinental Bordeaux',
      'Vignobles : Médoc, Saint-Émilion, Pessac-Léognan, Pomerol',
      "Cité du Vin, Place de la Bourse, Miroir d'Eau",
      'Châteaux : Margaux, Lafite Rothschild, Cheval Blanc',
      'Œnotourisme, vendanges (septembre-octobre)',
      'Aéroport BOD, TGV Paris (2h)',
    ],
    keywordsEn: [
      'Bordeaux — world wine capital (UNESCO)',
      'Palace: Les Sources de Caudalie (Martillac)',
      'Vineyards: Médoc, Saint-Émilion, Pessac-Léognan',
    ],
    toneFr: 'viticole, gastronomique, art de vivre',
  },

  // ── Reims / Champagne ─────────────────────────────────────────────────────
  {
    slug: 'reims-champagne',
    nameFr: 'Reims & Champagne',
    nameEn: 'Reims & Champagne',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: ['reims', 'épernay', 'epernay'],
    keywordsFr: [
      'Reims — cité des sacres, capitale du Champagne',
      'Palaces : Domaine Les Crayères (Reims), Royal Champagne (Champillon)',
      'Maisons : Pommery, Veuve Clicquot, Krug, Ruinart, Moët & Chandon, Dom Pérignon',
      'Cathédrale Notre-Dame de Reims (UNESCO), Palais du Tau',
      'Caves visitables, vendanges (septembre)',
      'TGV Paris (45 min)',
    ],
    keywordsEn: [
      'Reims — city of coronations, capital of Champagne',
      'Palaces: Domaine Les Crayères, Royal Champagne',
      'Maisons: Pommery, Veuve Clicquot, Krug, Moët & Chandon',
    ],
    toneFr: 'effervescent, royal, gastronomique',
  },

  // ── Provence ──────────────────────────────────────────────────────────────
  {
    slug: 'provence',
    nameFr: 'Provence',
    nameEn: 'Provence',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'le puy-sainte-réparade',
      'le puy sainte réparade',
      'gordes',
      'lourmarin',
      'ménerbes',
      'menerbes',
    ],
    keywordsFr: [
      'Provence — Luberon, Alpilles, plateau de Valensole',
      'Palaces : Villa La Coste (Le Puy-Sainte-Réparade), La Coquillade Provence Resort, Capelongue (Beaumes)',
      'Villages perchés : Gordes, Roussillon, Bonnieux, Lourmarin',
      'Lavande (juillet-août), oliviers, marchés provençaux',
      "Festival d'Aix-en-Provence, vendanges",
      'Aéroport Marseille (1h), TGV Avignon',
    ],
    keywordsEn: [
      'Provence — Luberon, Alpilles, Valensole plateau',
      'Palaces: Villa La Coste, La Coquillade Provence Resort',
      'Hilltop villages: Gordes, Roussillon, Lourmarin',
    ],
    toneFr: 'rural, lumineux, art de vivre',
  },

  // ── Corse ─────────────────────────────────────────────────────────────────
  {
    slug: 'corse',
    nameFr: 'Corse',
    nameEn: 'Corsica',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: ['porto-vecchio', 'calvi', 'ajaccio', 'bonifacio'],
    keywordsFr: [
      'Corse — île de beauté, GR20, plages Lavezzi',
      'Adresses : Domaine de Murtoli, Cala Rossa (Porto-Vecchio), Casadelmar',
      'Bonifacio (falaises calcaires), Calvi (citadelle génoise), Ajaccio (Napoléon)',
      'Cuisine : charcuterie corse, brocciu, vins AOP, miel',
      'Aéroport Figari / Calvi / Ajaccio, ferry Marseille-Toulon-Nice',
    ],
    keywordsEn: [
      'Corsica — island of beauty, GR20 trail, Lavezzi beaches',
      'Domaine de Murtoli, Cala Rossa, Casadelmar',
      'Bonifacio cliffs, Calvi citadel, Ajaccio',
    ],
    toneFr: 'sauvage, méditerranéen, intemporel',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Sprint 6 — combler le delta Yonder : 16 nouvelles destinations FR
  // Couverture demandée pour aligner notre maillage interne (top-down)
  // avec celui des comparateurs éditoriaux (Yonder, Magazine du Voyageur).
  // ─────────────────────────────────────────────────────────────────────────

  // ── Deauville ─────────────────────────────────────────────────────────────
  {
    slug: 'deauville',
    nameFr: 'Deauville',
    nameEn: 'Deauville',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['deauville', 'trouville', 'trouville-sur-mer'],
    keywordsFr: [
      'Deauville — reine de la Côte Fleurie depuis 1860 (Duc de Morny)',
      'Adresses : Hôtel Barrière Le Normandy, Hôtel Barrière Le Royal, Les Manoirs de Tourgéville',
      'Planches, casino, hippodromes (La Touques, Clairefontaine)',
      'American Film Festival (septembre), Polo Gold Cup, Lancel Trophy',
      'Cinéma : Un homme et une femme (Lelouch), Coco Chanel',
      'Côte Fleurie : Honfleur, Trouville, Cabourg (Proust)',
      'Aéroport Deauville-Saint-Gatien, Paris (2h en voiture)',
    ],
    keywordsEn: [
      'Deauville — queen of the Côte Fleurie since 1860 (Duke of Morny)',
      'Hôtel Barrière Le Normandy, Hôtel Barrière Le Royal',
      'Boardwalks, casino, racecourses, American Film Festival',
    ],
    toneFr: 'normand, équestre, chic balnéaire',
  },

  // ── Marseille ─────────────────────────────────────────────────────────────
  {
    slug: 'marseille',
    nameFr: 'Marseille',
    nameEn: 'Marseille',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['marseille', 'cassis'],
    keywordsFr: [
      'Marseille — plus ancienne ville de France (Phocée, 600 av. J.-C.)',
      'Adresses : InterContinental Hôtel-Dieu, Sofitel Vieux-Port, NH Collection Marseille, C2 Hotel, Les Bords de Mer',
      'Vieux-Port, MUCEM, Notre-Dame de la Garde, Le Panier',
      'Calanques : Sormiou, Morgiou, En-Vau, Cassis',
      'Gastronomie : bouillabaisse, Gérald Passédat (Le Petit Nice ***), AM par Alexandre Mazzia ***',
      "Îles du Frioul, Château d'If",
      'Aéroport Marseille-Provence, TGV Paris (3h)',
    ],
    keywordsEn: [
      'Marseille — oldest city in France (600 BC)',
      'InterContinental Hôtel-Dieu, Sofitel Vieux-Port',
      'Vieux-Port, MUCEM, Notre-Dame de la Garde, Calanques',
    ],
    toneFr: 'méditerranéen, phocéen, authentique',
  },

  // ── Lyon ──────────────────────────────────────────────────────────────────
  {
    slug: 'lyon',
    nameFr: 'Lyon',
    nameEn: 'Lyon',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['lyon'],
    keywordsFr: [
      'Lyon — capitale mondiale de la gastronomie (Curnonsky, 1935)',
      'Adresses : InterContinental Lyon Hôtel-Dieu, Villa Maïa, Cour des Loges, Sofitel Bellecour',
      "Vieux Lyon (UNESCO), traboules, Croix-Rousse, presqu'île",
      'Gastronomie : Paul Bocuse ***, Mère Brazier **, Têtedoie *, bouchons lyonnais',
      'Fête des Lumières (8 décembre), Quais du Polar',
      'Vignobles : Beaujolais, Côtes-du-Rhône (Côte-Rôtie, Condrieu)',
      'Aéroport Saint-Exupéry, TGV Paris (2h)',
    ],
    keywordsEn: [
      'Lyon — world gastronomy capital (Curnonsky, 1935)',
      'InterContinental Lyon Hôtel-Dieu, Villa Maïa, Cour des Loges',
      'Old Lyon (UNESCO), traboules, Paul Bocuse',
    ],
    toneFr: 'gastronomique, soyeux, historique',
  },

  // ── Aix-en-Provence ──────────────────────────────────────────────────────
  {
    slug: 'aix-en-provence',
    nameFr: 'Aix-en-Provence',
    nameEn: 'Aix-en-Provence',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['aix-en-provence'],
    keywordsFr: [
      'Aix-en-Provence — ville de Cézanne, capitale historique de la Provence',
      'Adresses : Villa Gallici, Hôtel Renoir, Le Pigonnet, La Bastide de Tourtour, Château de la Gaude',
      'Cours Mirabeau, atelier Cézanne, fondation Vasarely, hôtels particuliers XVIIIᵉ',
      "Festival d'Art Lyrique (juillet), marché provençal",
      'Montagne Sainte-Victoire (peinte 87 fois par Cézanne)',
      "Vignobles Coteaux d'Aix, Cassis, Bandol à proximité",
      'Aéroport Marseille-Provence (30 min), TGV Aix (3h Paris)',
    ],
    keywordsEn: [
      "Aix-en-Provence — Cézanne's city, historic Provençal capital",
      'Villa Gallici, Le Pigonnet, Château de la Gaude',
      "Cours Mirabeau, Cézanne studio, Festival d'Art Lyrique",
    ],
    toneFr: 'cézannien, provençal, raffiné',
  },

  // ── Arles ─────────────────────────────────────────────────────────────────
  {
    slug: 'arles',
    nameFr: 'Arles',
    nameEn: 'Arles',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['arles', 'le paradou', 'paradou'],
    keywordsFr: [
      'Arles — ville romaine UNESCO, ville de Van Gogh (200 toiles)',
      "Adresses : L'Hôtel Particulier, Le Cloître, Hôtel Jules César MGallery, Le Mas de Peint",
      'Arènes romaines, théâtre antique, Cryptoportiques, Alyscamps',
      'Rencontres de la Photographie (juillet), LUMA Arles (Frank Gehry, 2021)',
      'Camargue : manades, flamants roses, Parc Naturel Régional',
      'Vignobles : Costières de Nîmes, Côtes du Rhône méridionales',
      'TGV Avignon ou Aix (15-25 min), aéroport Marseille (1h)',
    ],
    keywordsEn: [
      "Arles — Roman UNESCO city, Van Gogh's city",
      "L'Hôtel Particulier, Hôtel Jules César MGallery",
      'Roman amphitheatre, Rencontres de la Photographie, LUMA Arles',
    ],
    toneFr: 'romain, artistique, camarguais',
  },

  // ── Dinard ────────────────────────────────────────────────────────────────
  {
    slug: 'dinard',
    nameFr: 'Dinard',
    nameEn: 'Dinard',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['dinard'],
    keywordsFr: [
      "Dinard — station Belle Époque, élue 'Nice du Nord' (XIXᵉ)",
      'Adresses : Grand Hôtel Barrière de Dinard, Hôtel Castelbrac (ex-Musée de la Mer)',
      'Villas Belle Époque (407 répertoriées), Pointe du Moulinet',
      'Festival du Film Britannique (octobre), Coupes Internationales de Pétanque',
      'Plages : Écluse, Saint-Énogat, Prieuré',
      'Saint-Malo (15 min en navette maritime), Cap Fréhel, Cancale',
      'Aéroport Dinard-Pleurtuit-Saint-Malo, TGV Saint-Malo (2h15 Paris)',
    ],
    keywordsEn: [
      'Dinard — Belle Époque resort, "Nice of the North"',
      'Grand Hôtel Barrière de Dinard, Hôtel Castelbrac',
      'Belle Époque villas, Pointe du Moulinet, Saint-Malo',
    ],
    toneFr: 'belle époque, balnéaire, britannique',
  },

  // ── La Baule ──────────────────────────────────────────────────────────────
  {
    slug: 'la-baule',
    nameFr: 'La Baule',
    nameEn: 'La Baule',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['la baule', 'la-baule', 'la baule-escoublac'],
    keywordsFr: [
      "La Baule — plus belle baie d'Europe selon le Club des Plus Belles Baies du Monde",
      "Adresses : Hôtel Barrière Le Royal La Baule, Hôtel Barrière L'Hermitage, Castel Marie-Louise",
      'Plage de sable fin (9 km), villas Belle Époque, casino',
      'Golf international de La Baule, hippodrome, thalasso',
      'Parc Naturel Régional de Brière (zone humide), Guérande (sel)',
      'Saint-Nazaire (chantiers Atlantique), Nantes (45 min)',
      'TGV Paris (3h), aéroport Nantes-Atlantique (1h)',
    ],
    keywordsEn: [
      "La Baule — Europe's finest bay (Club des Plus Belles Baies)",
      "Hôtel Barrière Le Royal, Hôtel Barrière L'Hermitage, Castel Marie-Louise",
      'Belle Époque villas, golf, thalasso, Briere wetlands',
    ],
    toneFr: 'atlantique, balnéaire, élégant',
  },

  // ── Saint-Rémy-de-Provence ───────────────────────────────────────────────
  {
    slug: 'saint-remy-de-provence',
    nameFr: 'Saint-Rémy-de-Provence',
    nameEn: 'Saint-Rémy-de-Provence',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['saint-rémy-de-provence', 'saint-remy-de-provence', 'maussane'],
    keywordsFr: [
      "Saint-Rémy — village d'Alpilles, lieu d'asile de Van Gogh (1889-1890)",
      "Adresses : Hôtel de Tourrel, Le Vallon de Valrugues, Château des Alpilles, Hôtel L'Image",
      'Saint-Paul-de-Mausole (cloître où séjourna Van Gogh)',
      'Glanum (cité gallo-romaine), Mausolée et Arc municipal',
      "Marché du mercredi (l'un des plus beaux de Provence), oliviers AOP",
      'Les Baux-de-Provence (Carrières de Lumières), Mausanne, Maussane',
      'TGV Avignon (25 min), aéroport Marseille-Provence (1h)',
    ],
    keywordsEn: [
      'Saint-Rémy — Alpilles village, Van Gogh asylum (1889-1890)',
      'Hôtel de Tourrel, Le Vallon de Valrugues, Château des Alpilles',
      'Saint-Paul-de-Mausole, Glanum Roman city, Les Baux-de-Provence',
    ],
    toneFr: 'alpilles, provençal, art de vivre',
  },

  // ── Bourgogne ────────────────────────────────────────────────────────────
  {
    slug: 'bourgogne',
    nameFr: 'Bourgogne',
    nameEn: 'Burgundy',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'beaune',
      'dijon',
      'gevrey-chambertin',
      'chassagne-montrachet',
      'puligny-montrachet',
      'levernois',
      'gilly-lès-cîteaux',
    ],
    keywordsFr: [
      'Bourgogne — Climats du vignoble UNESCO (2015), Grands Crus mondialement uniques',
      'Adresses : Hostellerie Cèdre & Spa Beaune, Hôtel le Cep, Les Sources de Cheverny, Domaine de Rymska, Levernois, Hôtel Como Le Montrachet',
      'Côte de Nuits (Romanée-Conti, Chambertin, Vougeot), Côte de Beaune (Montrachet, Corton)',
      'Hospices de Beaune (1443), Cité Internationale de la Gastronomie et du Vin (Dijon)',
      'Gastronomie : Bernard Loiseau ***, William Frachot (Hostellerie du Chapeau Rouge)',
      'Vendanges (septembre), Vente aux enchères des Hospices (3ᵉ dimanche novembre)',
      'TGV Dijon (1h35 Paris), aéroport Lyon (1h45)',
    ],
    keywordsEn: [
      'Burgundy — UNESCO Climats vineyard, unique Grands Crus',
      'Hostellerie Cèdre & Spa Beaune, Hôtel le Cep, Domaine de Rymska',
      'Côte de Nuits, Côte de Beaune, Hospices de Beaune, Bernard Loiseau',
    ],
    toneFr: 'viticole, climats, gastronomique',
  },

  // ── Bretagne ─────────────────────────────────────────────────────────────
  {
    slug: 'bretagne',
    nameFr: 'Bretagne',
    nameEn: 'Brittany',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'saint-malo',
      'dinard',
      'rennes',
      'quiberon',
      'arzon',
      'perros-guirec',
      'kervignac',
    ],
    keywordsFr: [
      'Bretagne — région maritime, 2 700 km de côtes, identité celtique',
      "Adresses : Sofitel Quiberon Thalassa Sea & Spa, Le Grand Hôtel des Thermes Saint-Malo, Hôtel Spa L'Agapa Perros-Guirec, Hôtel le Domaine de Locguénole & Spa",
      "Côte de Granit Rose (Perros-Guirec, Ploumanac'h), Cap Fréhel, Pointe du Raz",
      'Mont-Saint-Michel (Manche/Bretagne frontière), Saint-Malo (cité corsaire)',
      'Gastronomie : huîtres de Cancale, crêpes, beurre Bordier, cidre',
      'Festival Interceltique de Lorient (août), Tour de Bretagne',
      'TGV Rennes (1h30 Paris), aéroport Rennes / Brest / Nantes',
    ],
    keywordsEn: [
      'Brittany — maritime region, 2,700 km coastline, Celtic identity',
      "Sofitel Quiberon Thalassa, Le Grand Hôtel des Thermes Saint-Malo, L'Agapa Perros-Guirec",
      'Côte de Granit Rose, Cap Fréhel, Mont-Saint-Michel, Saint-Malo',
    ],
    toneFr: 'maritime, celtique, authentique',
  },

  // ── Normandie ────────────────────────────────────────────────────────────
  {
    slug: 'normandie',
    nameFr: 'Normandie',
    nameEn: 'Normandy',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: ['deauville', 'trouville', 'honfleur', 'cabourg', 'bayeux'],
    keywordsFr: [
      'Normandie — région impressionniste, plages du Débarquement, falaises',
      'Adresses : Hôtel Barrière Le Normandy Deauville, Hôtel Barrière Le Royal, Domaine de Primard',
      "Côte Fleurie (Deauville, Trouville, Honfleur, Cabourg), Côte d'Albâtre (Étretat)",
      'Plages du Débarquement (Omaha, Utah, Juno, Gold, Sword), Cimetière américain',
      'Mont-Saint-Michel (UNESCO), abbaye, baie',
      'Gastronomie : camembert, calvados, cidre, fruits de mer, agneau de pré-salé',
      'Festival du Cinéma Américain Deauville, Impressionnisme route',
    ],
    keywordsEn: [
      'Normandy — Impressionist region, D-Day beaches, cliffs',
      'Hôtel Barrière Le Normandy Deauville, Domaine de Primard',
      "Côte Fleurie, Côte d'Albâtre, D-Day beaches, Mont-Saint-Michel",
    ],
    toneFr: 'impressionniste, mémoriel, balnéaire',
  },

  // ── Châteaux de la Loire ─────────────────────────────────────────────────
  {
    slug: 'chateaux-de-la-loire',
    nameFr: 'Châteaux de la Loire',
    nameEn: 'Loire Valley Châteaux',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'amboise',
      'blois',
      'chenonceaux',
      'montbazon',
      'noizay',
      'onzain',
      'cheverny',
      'tours',
      'reugny',
    ],
    keywordsFr: [
      'Vallée de la Loire — Patrimoine mondial UNESCO (2000), 280 km de Sully à Chalonnes',
      "Adresses : Hôtel Fleur de Loire (Christophe Hay), Domaine des Hauts de Loire, Château d'Artigny, Auberge du Bon Laboureur, Les Sources de Cheverny, Château Louise de la Vallière",
      'Châteaux royaux : Chambord, Chenonceau, Amboise, Blois, Cheverny, Villandry, Azay-le-Rideau',
      'Vignobles : Vouvray, Chinon, Bourgueil, Sancerre, Sauvignon de Touraine',
      'Gastronomie : Christophe Hay (Fleur de Loire **), Bon Laboureur',
      'Loire à vélo (900 km), jardins de Villandry, Forteresse royale de Loches',
      'TGV Tours-Saint-Pierre-des-Corps (1h Paris), aéroport Tours',
    ],
    keywordsEn: [
      'Loire Valley — UNESCO World Heritage (2000), 280 km of châteaux',
      "Hôtel Fleur de Loire, Domaine des Hauts de Loire, Château d'Artigny",
      'Chambord, Chenonceau, Amboise, Blois, Cheverny, Villandry',
    ],
    toneFr: 'royal, fluvial, jardins',
  },

  // ── Vaucluse / Luberon ───────────────────────────────────────────────────
  {
    slug: 'luberon',
    nameFr: 'Luberon',
    nameEn: 'Luberon',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'gordes',
      'ménerbes',
      'menerbes',
      'bonnieux',
      'lourmarin',
      'isle-sur-la-sorgue',
    ],
    keywordsFr: [
      'Luberon — Parc Naturel Régional, plus beaux villages de France',
      'Adresses : Airelles Gordes La Bastide, La Coquillade Village, Capelongue Beaumier Bonnieux, Le Phébus & Spa',
      'Villages perchés : Gordes, Ménerbes, Bonnieux, Roussillon (ocres), Lacoste',
      'Abbaye de Sénanque (cisterciens, lavandes), Fontaine-de-Vaucluse',
      'Marchés provençaux : Isle-sur-la-Sorgue (antiquaires), Apt (samedi)',
      'Vignobles : Côtes du Luberon AOC, Ventoux',
      'TGV Avignon (40 min), aéroport Marseille-Provence (1h15)',
    ],
    keywordsEn: [
      'Luberon — Natural Regional Park, most beautiful villages of France',
      'Airelles Gordes La Bastide, La Coquillade, Capelongue Bonnieux',
      'Gordes, Ménerbes, Bonnieux, Roussillon, Sénanque Abbey',
    ],
    toneFr: 'provençal, lavandes, perché',
  },

  // ── Alsace ───────────────────────────────────────────────────────────────
  {
    slug: 'alsace',
    nameFr: 'Alsace',
    nameEn: 'Alsace',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'strasbourg',
      'colmar',
      'kaysersberg',
      'illhaeusern',
      'barr',
      'ostwald',
      'colroy-la-roche',
    ],
    keywordsFr: [
      'Alsace — région bilingue, route des vins (170 km, 67 villages viticoles)',
      "Adresses : Hôtel le Chambard (Olivier Nasti **), Auberge de l'Ill (Haeberlin ***), Hôtel des Berges, Maison des Têtes, Château de l'Île Strasbourg",
      'Strasbourg (UNESCO, Parlement européen), Colmar (Petite Venise, Schongauer)',
      'Route des Vins : Riesling, Gewürztraminer, Pinot Gris, Crémant',
      "Gastronomie : Auberge de l'Ill ***, Olivier Nasti **, choucroute, tarte flambée, Munster",
      'Marchés de Noël (Strasbourg, Colmar, Kaysersberg, Riquewihr)',
      'TGV Strasbourg (1h45 Paris), aéroport Strasbourg / Bâle-Mulhouse',
    ],
    keywordsEn: [
      'Alsace — bilingual region, Wine Route (170 km, 67 wine villages)',
      "Hôtel le Chambard (Olivier Nasti), Auberge de l'Ill (Haeberlin)",
      'Strasbourg, Colmar, Riesling, Christmas markets',
    ],
    toneFr: 'alsacien, viticole, mitteleuropa',
  },

  // ── Méribel ──────────────────────────────────────────────────────────────
  {
    slug: 'meribel',
    nameFr: 'Méribel',
    nameEn: 'Méribel',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['méribel', 'meribel', 'les allues'],
    keywordsFr: [
      'Méribel — station alpine du domaine des 3 Vallées (600 km de pistes)',
      'Adresses : Le Coucou Méribel (Maja Hoffmann), Le Kaïla, La Chaudanne, Allodis',
      'Architecture chalets traditionnels (Peter Lindsay, 1936 — fondateur britannique)',
      'Domaine skiable : Trois Vallées (Courchevel, Méribel, Val Thorens, Brides-les-Bains)',
      'Gastronomie : Le Cèpe Méribel, La Table du Coucou',
      'Saison hiver : décembre - avril, été : juin - août (rando, VTT)',
      'Aéroport Genève (2h30), Lyon (2h), Chambéry (1h45)',
    ],
    keywordsEn: [
      'Méribel — Alpine resort, Trois Vallées domain (600 km of slopes)',
      'Le Coucou Méribel (Maja Hoffmann), Le Kaïla, La Chaudanne',
      'British heritage (Peter Lindsay, 1936), Trois Vallées',
    ],
    toneFr: 'alpin, chalets, britannique',
  },

  // ── Annecy ───────────────────────────────────────────────────────────────
  {
    slug: 'annecy',
    nameFr: 'Annecy',
    nameEn: 'Annecy',
    scope: 'city',
    countryCode: 'FR',
    hotelCityKeys: ['annecy', 'talloires', 'veyrier-du-lac'],
    keywordsFr: [
      "Annecy — 'Venise des Alpes', lac le plus pur d'Europe (LCSQA)",
      "Adresses : Hôtel Black Bass, La Maison Bleue (Veyrier-du-Lac), Hôtel de l'Abbaye (Talloires), Hôtel Beauregard",
      "Vieille ville, Palais de l'Isle (XIIᵉ), Pont des Amours",
      'Lac (27 km de tour à vélo), plages de Saint-Jorioz, Doussard',
      'Gastronomie : Yoann Conte ** (Veyrier-du-Lac), Le Clos des Sens *** (Annecy-le-Vieux)',
      "Fête du Lac (premier samedi août), Festival International du Film d'Animation (juin)",
      'Aéroport Genève (45 min), Lyon (1h45), Chambéry (50 min)',
    ],
    keywordsEn: [
      'Annecy — "Venice of the Alps", purest lake in Europe',
      'Hôtel Black Bass, La Maison Bleue (Veyrier-du-Lac)',
      "Old town, Palais de l'Isle, Yoann Conte, Le Clos des Sens",
    ],
    toneFr: 'lacustre, alpin, romantique',
  },

  // ── Phase F seeds (May 2026) ─ Yonder-derived drafts ─────────────────────
  // Ten guide drafts scaffolded overnight in `editorial_guides`. Seeds added
  // here so `run-guides-v2.ts --all` can regenerate them. Several have zero
  // matching published hotels today — the `<RelatedHotels>` section will
  // render empty until the corresponding hotels publish, but the guide body,
  // FAQ and JSON-LD remain valuable for SEO and topic authority.

  {
    slug: 'pays-basque',
    nameFr: 'Pays Basque',
    nameEn: 'Basque Country',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'biarritz',
      'saint-jean-de-luz',
      'bayonne',
      'anglet',
      'bidart',
      'hendaye',
      'ciboure',
      'guéthary',
      'guethary',
      'ainhoa',
      'sare',
      'cambo-les-bains',
    ],
    keywordsFr: [
      'Pays Basque français — côte Labourd, montagne Soule, intérieur Basse-Navarre',
      'Adresses : Hôtel du Palais Biarritz (Hyatt — ancienne villa Eugénie 1855), Hôtel Régina Biarritz, Grand Hôtel Saint-Jean-de-Luz, Hôtel du Palais Saint-Jean-de-Luz, La Réserve Saint-Jean-de-Luz',
      "Surf : Côte des Basques (Biarritz), spot historique de l'Europe (1957), Grande Plage, Hossegor à 30 min",
      "Gastronomie : Brikéténia *, Briketenia (Guéthary), Argi Eder, Auberge Basque, piment d'Espelette AOP, jambon de Bayonne IGP",
      'Patrimoine : Villa Eugénie, Rocher de la Vierge, port de Saint-Jean-de-Luz (mariage de Louis XIV, 1660), maisons labourdines à colombages rouges',
      'Saisons : Biarritz Surf Festival (juillet), Fêtes de Bayonne (août, 1 M visiteurs), Big Wave Hossegor (octobre)',
      'Aéroport Biarritz-Pays Basque (BIQ, 7 km Biarritz), TGV Paris-Biarritz (4h, 2h Bordeaux)',
    ],
    keywordsEn: [
      'French Basque Country — Labourd coast, Soule mountains, Basse-Navarre inland',
      'Hôtel du Palais Biarritz (Hyatt, Empress Eugénie 1855), Grand Hôtel Saint-Jean-de-Luz',
      'Surf: Côte des Basques (Biarritz, 1957), gastronomy: Espelette pepper PDO, Bayonne ham PGI',
    ],
    toneFr: 'océanique, basque, élégance balnéaire',
  },

  {
    slug: 'sologne',
    nameFr: 'Sologne',
    nameEn: 'Sologne',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'cheverny',
      'chambord',
      'romorantin',
      'romorantin-lanthenay',
      'lamotte-beuvron',
      'salbris',
      'aubigny-sur-nère',
      'aubigny-sur-nere',
      'argent-sur-sauldre',
      'boismorand',
    ],
    keywordsFr: [
      'Sologne — 500 000 hectares de forêts, étangs et landes au sud de la Loire (Loir-et-Cher, Loiret, Cher)',
      'Adresses : Les Sources de Cheverny (Caudalie), Hôtel Grand Saint-Michel (Chambord), Domaine des Hauts de Loire, Auberge de la Croix Blanche',
      'Chasse présidentielle de Chambord (1948-2010, devenue gestion cynégétique), tradition de la chasse à courre, brame du cerf (septembre-octobre)',
      'Châteaux : Chambord (UNESCO, 440 pièces, escalier Léonard de Vinci), Cheverny (résidence Hurault depuis 6 siècles), Beauregard (galerie 327 portraits), Villesavin (1537)',
      'Gastronomie : tarte Tatin (créée à Lamotte-Beuvron 1898), gibier (sanglier, chevreuil, faisan), carpe de Sologne IGP, fromage Selles-sur-Cher AOP',
      "Activités : équitation, golf (Les Bordes 18 trous classé 1er d'Europe Continentale), randonnée (5 000 km de chemins balisés)",
      'Accès : 1h30-2h Paris (A10 / A71), aéroport Tours (TUF) ou Paris-Orly (ORY)',
    ],
    keywordsEn: [
      'Sologne — 500,000 hectares of forests, ponds and heaths south of the Loire',
      'Les Sources de Cheverny (Caudalie), Hôtel Grand Saint-Michel (Chambord)',
      'Châteaux: Chambord (UNESCO), Cheverny, Villesavin — hunting tradition, deer rutting season',
    ],
    toneFr: 'forestier, cynégétique, aristocratique',
  },

  {
    slug: 'sud-ouest',
    nameFr: 'Sud-Ouest',
    nameEn: 'South-West France',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'bordeaux',
      'saint-emilion',
      'saint-émilion',
      'martillac',
      'sauternes',
      'pauillac',
      'biarritz',
      'saint-jean-de-luz',
      'hossegor',
      'soorts-hossegor',
      'cognac',
      'eugénie-les-bains',
      'eugenie-les-bains',
      'mont-de-marsan',
      'pau',
      'dax',
    ],
    keywordsFr: [
      'Sud-Ouest — Gironde + Landes + Pyrénées-Atlantiques + Charente, climat océanique tempéré',
      "Adresses : Les Sources de Caudalie (Martillac, Mathilde Cathiard-Thomas), Hôtel du Palais Biarritz, Les Prés d'Eugénie (Michel Guérard ***), Château Cordeillan-Bages, La Co(o)rniche (Pyla)",
      'Vignobles : Bordeaux (1er vignoble AOC mondial), Saint-Émilion (UNESCO 1999), Médoc, Sauternes, Pessac-Léognan, Pomerol — 60 grands crus classés',
      "Gastronomie : foie gras IGP Sud-Ouest, magret, confit, canard, agneau de Pauillac, huîtres d'Arcachon, jambon de Bayonne, piment d'Espelette",
      'Surf : Hossegor (mondial), La Gravière, Plage Centrale Biarritz, océan Atlantique, dune du Pilat (110 m)',
      'Patrimoine : Bordeaux (UNESCO 2007), Cognac (maisons Hennessy / Martell / Rémy Martin), Saint-Émilion souterrain',
      'Accès : TGV Paris-Bordeaux 2h04, aéroports Bordeaux-Mérignac (BOD), Biarritz-Pays Basque (BIQ), Pau-Pyrénées (PUF)',
    ],
    keywordsEn: [
      'South-West France — Gironde, Landes, Pyrénées-Atlantiques, Charente',
      "Les Sources de Caudalie (Martillac), Les Prés d'Eugénie (Michel Guérard), Château Cordeillan-Bages",
      'Bordeaux vineyards (UNESCO), Saint-Émilion, surf at Hossegor / Biarritz, foie gras territory',
    ],
    toneFr: 'gourmand, vinicole, atlantique',
  },

  {
    slug: 'hauts-de-france',
    nameFr: 'Hauts-de-France',
    nameEn: 'Hauts-de-France',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'lille',
      'chantilly',
      'compiègne',
      'compiegne',
      'senlis',
      'amiens',
      'arras',
      'le touquet',
      'le touquet-paris-plage',
      'pierrefonds',
      'gerberoy',
    ],
    keywordsFr: [
      'Hauts-de-France — fusion 2016 Nord-Pas-de-Calais + Picardie, 6 M habitants, façade Manche',
      'Adresses : Auberge du Jeu de Paume (Chantilly, Oetker Collection), Westminster Le Touquet, Hôtel Hermitage Gantois Lille, La Cour Carrée (Senlis), Château de Montvillargenne',
      'Châteaux royaux : Chantilly (Musée Condé, 2ᵉ collection peintures anciennes après le Louvre), Compiègne (résidence Napoléon III), Pierrefonds (Viollet-le-Duc), Domaine de Chaalis',
      "Patrimoine : Cathédrale Notre-Dame d'Amiens (UNESCO, plus vaste de France), Vieux-Lille (Vieille Bourse 1653), Beffrois (UNESCO), citadelle Vauban d'Arras",
      'Gastronomie : maroilles, carbonade flamande, welsh, ficelle picarde, gaufres, bière artisanale (3 Brasseurs, Goudale), endives (Nord, 1ᵉʳ producteur Europe)',
      'Hippodrome de Chantilly (Prix de Diane, Prix du Jockey Club), Grandes Écuries (musée du Cheval), Le Touquet (golf, polo, racing)',
      'Accès : Eurostar Paris-Lille 1h, Paris-Chantilly 25 min (RER + TER), aéroport Lille-Lesquin (LIL)',
    ],
    keywordsEn: [
      'Hauts-de-France — northern region, English Channel coast',
      'Auberge du Jeu de Paume (Chantilly, Oetker Collection), Westminster Le Touquet',
      'Châteaux: Chantilly (Musée Condé), Compiègne, Pierrefonds — Amiens Cathedral (UNESCO)',
    ],
    toneFr: 'royal, équestre, septentrional',
  },

  {
    slug: 'occitanie',
    nameFr: 'Occitanie',
    nameEn: 'Occitanie',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'toulouse',
      'carcassonne',
      'albi',
      'narbonne',
      'perpignan',
      'sète',
      'sete',
      'collioure',
      'cordes-sur-ciel',
      'cahors',
      'montpellier',
      'nîmes',
      'nimes',
      'rocamadour',
      'lourdes',
      'saint-cirq-lapopie',
    ],
    keywordsFr: [
      'Occitanie — fusion 2016 Languedoc-Roussillon + Midi-Pyrénées, 6 M habitants, façade méditerranéenne',
      'Adresses : La Réserve Saint-Jean-de-Luz (proche frontière), Domaine de Verchant (Montpellier), Hôtel La Cité (Carcassonne), Le Château de la Treyne (Lacave)',
      'Patrimoine UNESCO : Cité de Carcassonne (Viollet-le-Duc), Canal du Midi (Riquet, 1681, 240 km), chemins de Saint-Jacques, Pont du Gard, citadelle de Mont-Louis (Vauban)',
      'Pays cathare : châteaux de Quéribus, Peyrepertuse, Puilaurens, Termes, Aguilar, Lastours — résistance albigeoise XIIIᵉ',
      'Gastronomie : cassoulet (Castelnaudary, Carcassonne, Toulouse — guerre triangulaire), foie gras du Sud-Ouest IGP, magret, vins de Languedoc (Pic Saint-Loup, Faugères, Minervois, Corbières)',
      'Pyrénées : Cirque de Gavarnie (UNESCO), Lourdes (sanctuaire marial, 6 M pèlerins/an), Pic du Midi (observatoire 2877 m), Andorre frontière',
      "Toulouse 'la Ville rose' (briques foraines), Airbus, Cité de l'Espace, basilique Saint-Sernin (plus grande romane d'Europe)",
    ],
    keywordsEn: [
      'Occitanie — southern region, Mediterranean and Pyrénées',
      'La Cité (Carcassonne), Domaine de Verchant (Montpellier), Château de la Treyne',
      'UNESCO Carcassonne, Canal du Midi, Pont du Gard — Cathar castles, cassoulet rivalries',
    ],
    toneFr: 'occitan, cathare, ensoleillé',
  },

  {
    slug: 'pays-de-la-loire',
    nameFr: 'Pays de la Loire',
    nameEn: 'Pays de la Loire',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'nantes',
      'la baule',
      'la baule-escoublac',
      'pornic',
      'le croisic',
      'piriac-sur-mer',
      'angers',
      'le mans',
      'saumur',
      'noirmoutier',
      'saint-jean-de-monts',
      'les sables-d-olonne',
      'sables-d-olonne',
    ],
    keywordsFr: [
      'Pays de la Loire — 5 départements (Loire-Atlantique, Maine-et-Loire, Mayenne, Sarthe, Vendée), façade atlantique',
      "Adresses : Hôtel Barrière L'Hermitage La Baule, Hôtel Royal-Thalasso Barrière La Baule, Hôtel de Loire (Angers), Domaine du Hézo, Hôtel Anne d'Anjou (Saumur)",
      "La Baule — plus belle baie d'Europe (Saint-Brévin à Le Croisic, 9 km de sable fin), thalasso pionnière (Barrière 1978), golf (3 parcours), tennis (futur Open féminin)",
      "Châteaux d'Anjou : Saumur (Apocalypse, 7 m de tapisserie), Brissac (plus haut de France), Angers (forteresse Capétienne, tenture de l'Apocalypse 104 m), Cunault",
      'Gastronomie : muscadet (sur lie, 13 000 ha), Anjou Coteaux du Layon, beurre blanc nantais, fouace, rillettes du Mans IGP, sel de Guérande IGP',
      "Patrimoine : Nantes (Machines de l'Île, château des Ducs), 24 Heures du Mans (juin, automobile), Vendée Globe (tous les 4 ans, départ Sables-d'Olonne)",
      'Accès : TGV Paris-Nantes 2h, Paris-Le Mans 55 min, aéroport Nantes Atlantique (NTE)',
    ],
    keywordsEn: [
      'Pays de la Loire — Atlantic coast, Anjou châteaux, Loire estuary',
      "Hôtel Barrière L'Hermitage La Baule, Royal-Thalasso Barrière",
      'La Baule beach, Angers / Saumur châteaux, 24 Hours of Le Mans, Vendée Globe',
    ],
    toneFr: 'atlantique, élégant, ligérien',
  },

  {
    slug: 'lac-leman',
    nameFr: 'Lac Léman',
    nameEn: 'Lake Geneva',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'évian-les-bains',
      'evian-les-bains',
      'évian',
      'evian',
      'thonon-les-bains',
      'yvoire',
      'amphion-les-bains',
      'publier',
    ],
    keywordsFr: [
      "Lac Léman — plus grand lac alpin d'Europe (582 km², 73 km de long), rive française du Chablais",
      'Adresses : Hôtel Royal Evian (Mauresque, 1909, Resort 5 étoiles), Hôtel Ermitage Evian (Belle Époque), Hilton Evian, La Verniaz et ses Chalets, Cottage Bise (Talloires côté français)',
      'Évian-les-Bains — eau minérale Evian (Source Cachat, embouteillée depuis 1859), thermes (Évian Resort), Casino Évian Palais Lumière',
      "Patrimoine : Yvoire (Plus Beau Village de France, médiéval XIVᵉ), Château de Ripaille (résidence du duc Amédée VIII de Savoie), villas Belle Époque d'Évian",
      'Activités : navigation lac (compagnie CGN, ferries Évian-Lausanne 35 min), golf Royal Évian (Evian Championship LPGA), thermes, Mont-Blanc en arrière-plan',
      'Gastronomie : féra du Léman, omble chevalier, perche meunière, vins de Savoie (Chignin, Roussette, Mondeuse), tomme des Bauges',
      'Accès : 1h Genève (GVA), 2h Lyon (LYS), Mont-Blanc à 1h, frontière suisse à Saint-Gingolph',
    ],
    keywordsEn: [
      'Lake Geneva — largest Alpine lake (582 km²), French Chablais shore',
      'Hôtel Royal Evian (1909), Ermitage Evian, La Verniaz et ses Chalets',
      'Evian mineral water source, Yvoire medieval village, Evian Championship LPGA',
    ],
    toneFr: 'lacustre, thermal, Belle Époque',
  },

  {
    slug: 'vexin',
    nameFr: 'Vexin Français',
    nameEn: 'French Vexin',
    scope: 'cluster',
    countryCode: 'FR',
    hotelCityKeys: [
      'giverny',
      'la roche-guyon',
      'vétheuil',
      'vetheuil',
      'magny-en-vexin',
      'auvers-sur-oise',
      "l'isle-adam",
      'isle-adam',
      'beauvais',
      'gerberoy',
    ],
    keywordsFr: [
      "Vexin Français — Parc Naturel Régional (1995, 71 000 ha), plateau calcaire entre Seine et Epte (Val-d'Oise + Yvelines)",
      "Adresses : Le Moulin de Fourges (Fourges, restaurant gastronomique), Domaine de Villiers (Saint-Jean-aux-Bois), Hôtel de la Chaîne d'Or (Les Andelys, vue Château-Gaillard)",
      'Giverny — Maison et jardins de Claude Monet (1883-1926, restaurés 1980), Musée des Impressionnismes (15 expositions), Bassin aux Nymphéas, pont japonais',
      'Auvers-sur-Oise — dernière demeure de Vincent Van Gogh (mai-juillet 1890, 70 toiles), Maison-Atelier de Daubigny, Auberge Ravoux (chambre Van Gogh préservée)',
      'Patrimoine : Château de La Roche-Guyon (donjon XIIᵉ, salle à manger Rochefoucauld), Abbaye de Royaumont, Gerberoy (Plus Beau Village de France, rosiers de Henri Le Sidaner)',
      'Activités : Route des Crêtes du Vexin, randonnée GR2, peinture en plein air (terrain de prédilection des impressionnistes 1860-1910), Seine en canoë',
      'Accès : 1h Paris (A15 + A14), gare Mantes-la-Jolie SNCF (40 min Paris-Saint-Lazare), Roissy-CDG à 50 min',
    ],
    keywordsEn: [
      'French Vexin — Regional Nature Park (1995), chalk plateau between Seine and Epte',
      "Le Moulin de Fourges, Hôtel de la Chaîne d'Or (Les Andelys)",
      'Giverny (Monet 1883-1926), Auvers-sur-Oise (Van Gogh, May-July 1890), La Roche-Guyon castle',
    ],
    toneFr: 'impressionniste, bucolique, francilien',
  },

  {
    slug: 'ile-de-france-region',
    nameFr: 'Île-de-France (région)',
    nameEn: 'Île-de-France region',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'versailles',
      'fontainebleau',
      'chantilly',
      'barbizon',
      'rambouillet',
      'saint-germain-en-laye',
      'auvers-sur-oise',
      'magny-en-vexin',
      'gouvieux',
      'guainville',
      'augerville-la-rivière',
      'augerville-la-riviere',
    ],
    keywordsFr: [
      'Île-de-France — région capitale, 12 M habitants (1/5 de la population française), 8 départements + Paris',
      'Adresses (hors Paris) : Auberge du Jeu de Paume (Chantilly), Domaine de Fontenille (Versailles à 30 min), Domaine des Étangs (Massignac frontière), Château de Versailles Le Grand Contrôle (Airelles)',
      'Châteaux royaux et résidences : Versailles (UNESCO 1979, 800 ha, Galerie des Glaces 73 m), Fontainebleau (UNESCO 1981, 9 siècles résidence royale), Chantilly (Musée Condé), Vaux-le-Vicomte (Le Nôtre / Le Vau / Le Brun, 1656-1661), Rambouillet',
      "Forêts royales : Fontainebleau (25 000 ha, paradis de l'escalade et site impressionniste), Rambouillet (14 000 ha), Chantilly (6 300 ha), Saint-Germain (3 500 ha)",
      'Patrimoine artistique : Barbizon (école 1830, Millet / Rousseau / Daubigny), Auvers-sur-Oise (Van Gogh), Médan (Zola)',
      'Provins (UNESCO 2001, cité médiévale champenoise), Maisons-Laffitte (Mansart 1651, course hippique), Disneyland Paris (Marne-la-Vallée)',
      'Accès : RER A/B/C/D, Transilien, TGV depuis Paris (Massy, Roissy), aéroports Paris-CDG / Orly / Beauvais',
    ],
    keywordsEn: [
      'Île-de-France region — capital region (12 M people), 8 departments around Paris',
      'Auberge du Jeu de Paume (Chantilly), Le Grand Contrôle (Versailles, Airelles)',
      'Royal châteaux: Versailles (UNESCO), Fontainebleau (UNESCO), Vaux-le-Vicomte, Rambouillet',
    ],
    toneFr: 'royal, francilien, monumental',
  },

  {
    slug: 'auvergne-rhone-alpes',
    nameFr: 'Auvergne-Rhône-Alpes',
    nameEn: 'Auvergne-Rhône-Alpes',
    scope: 'region',
    countryCode: 'FR',
    hotelCityKeys: [
      'lyon',
      'annecy',
      'talloires',
      'veyrier-du-lac',
      'chamonix',
      'chamonix-mont-blanc',
      'megève',
      'megeve',
      'courchevel',
      "val d'isère",
      "val d'isere",
      'méribel',
      'meribel',
      'evian-les-bains',
      'évian-les-bains',
      'vichy',
      'le-puy-en-velay',
      'puy-en-velay',
      'aix-les-bains',
      'chamonix',
    ],
    keywordsFr: [
      'Auvergne-Rhône-Alpes — fusion 2016, 8,1 M habitants (2ᵉ région française), 12 départements, Massif Central + Alpes + couloir rhodanien',
      "Adresses Alpes : Les Airelles Courchevel, Cheval Blanc Courchevel, Hôtel du Cap (Cap-Ferrat) côté azuréen, Four Seasons Megève, Le K2 Palace, Six Senses Courchevel — voir guides 'alpes' et 'courchevel' / 'megeve' / 'val-d-isere'",
      'Lyon — capitale gastronomique mondiale (Paul Bocuse Collonges 1965-2018, 19 étoiles Michelin), Vieux Lyon (UNESCO 1998), Confluence, mère de Lyon (Brazier 1933 première triplement étoilée)',
      "Annecy — 'Venise des Alpes', lac le plus pur d'Europe, Veyrier-du-Lac (Yoann Conte **), Annecy-le-Vieux (Laurent Petit *** Clos des Sens)",
      "Stations 5 étoiles : Courchevel 1850 (la plus prestigieuse, altiport), Val d'Isère + Tignes (Espace Killy 300 km), Megève (Rothschild 1920), Méribel (3 Vallées 600 km), Chamonix-Mont-Blanc (aiguille du Midi 3842 m)",
      "Thermes historiques : Vichy (Reine des villes d'eaux, Napoléon III), Aix-les-Bains, Évian, Brides-les-Bains, Allevard",
      "Patrimoine UNESCO : Lyon Vieux + Croix-Rousse, abbaye de Cluny (Saône-et-Loire frontière), grottes Chauvet (Pont d'Arc), pèlerinage du Puy-en-Velay (Saint-Jacques)",
    ],
    keywordsEn: [
      'Auvergne-Rhône-Alpes — 8.1 M people, Massif Central + Alps + Rhône corridor',
      'Lyon (gastronomic capital, Bocuse), Courchevel (Les Airelles, Cheval Blanc), Megève (Four Seasons)',
      'Lake Annecy (Yoann Conte, Le Clos des Sens), Vichy thermal baths, Mont-Blanc',
    ],
    toneFr: 'alpin, gourmand, lyonnais',
  },
];

export function findDestinationBySlug(slug: string): DestinationGuideSeed | null {
  return DESTINATIONS.find((d) => d.slug === slug) ?? null;
}
