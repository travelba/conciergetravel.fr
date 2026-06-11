/**
 * Phase 3 — curated 30-image gallery manifest for `les-pres-deugenie`.
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-les-pres-deugenie-gallery-batch.ts`.
 *
 * CDC §2.2 — 10 category floor: exterior, lobby, room, dining, spa, pool,
 * view, detail, concierge, events (3 images each).
 */

export const LES_PRES_DEUGENIE_HERO_IMAGE = 'cct/hotels/les-pres-deugenie/hero';

/** Official source for dedicated hero upload — exterior overview (Rule 7). */
export const LES_PRES_DEUGENIE_HERO_SOURCE_URL =
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/2501-01_13_lpde_heurebleue_bd-edited.jpg';

/** Parallel to {@link LES_PRES_DEUGENIE_GALLERY_IMAGES} — provenance for kit audit gates. */
export const LES_PRES_DEUGENIE_GALLERY_SOURCE_URLS = [
  'https://lespresdeugenie.com/wp-content/uploads/2024/02/LPDE_nouvelle-reception_2024.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/EUG-FERME-THERMALE-VUE-EXT-059-YOAN-CHEVOJON-BD.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/02/imperatrice-eugenie_romantique.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/01/IMG2-edited.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/10/LPDE_vignette_chambre_couvent.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/08/eugenie_chambre_boutondor-600x600.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/86.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/72.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/76.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/tarte-tomate_lpde.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/61.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/2106-02_01_lpde_yoga_bd.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG9.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/70-1-2048x1152.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/IMG2-2048x1152.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG2.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG23.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/chateau-de-bachen-1.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/boucherie_lpde.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/IMG2-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG23-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/02/LPDE_nouvelle-reception_2024-768x1356.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/86-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/72-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2026/05/Barbagoa-2026-Logo.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/76-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/61-1536x864.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/2501-01_13_lpde_heurebleue_bd-edited-1536x1536.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2026/05/Barbagoa-2026-Logo.jpg?context=barbagoa-soiree',
  'https://lespresdeugenie.com/wp-content/uploads/2025/01/IMG2-edited-2048x2048.jpg',
] as const;

export const LES_PRES_DEUGENIE_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-1',
    category: 'exterior',
    alt_fr: 'Façade de la Grande Maison, Les Prés d’Eugénie, Eugénie-les-Bains',
    alt_en: 'Grande Maison facade, Les Prés d’Eugénie, Eugénie-les-Bains',
    caption_fr:
      'La Grande Maison coloniale domine le domaine de 8 hectares : 45 chambres, trois restaurants étoilés et La Ferme Thermale au cœur des Landes.',
    caption_en:
      'The colonial Grande Maison overlooks the eight-hectare estate: 45 rooms, three starred restaurants and La Ferme Thermale in the heart of the Landes.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-2',
    category: 'exterior',
    alt_fr: 'Domaine Les Prés d’Eugénie au crépuscule, vallée des Landes',
    alt_en: 'Les Prés d’Eugénie estate at dusk, Landes valley',
    caption_fr:
      'Au crépuscule, le petit palace landais se fond dans la vallée de Gascogne — lumière dorée sur les jardins et les toitures coloniales.',
    caption_en:
      'At dusk, the Landes palace blends into the Gascogne valley — golden light on the gardens and colonial rooftops.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-3',
    category: 'exterior',
    alt_fr: 'La Ferme Thermale vue extérieure, Les Prés d’Eugénie',
    alt_en: 'La Ferme Thermale exterior, Les Prés d’Eugénie',
    caption_fr:
      'L’ancienne ferme landaise du XVIIIe siècle abrite La Ferme Thermale — 1 000 m² de soins aux sources millénaires, partenaire Sisley.',
    caption_en:
      'The 18th-century Landes farm houses La Ferme Thermale — 1,000 sq m of treatments at millennia-old springs, Sisley partner.',
    credit: 'Les Prés d’Eugénie — Yoan Chevojon (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-4',
    category: 'lobby',
    alt_fr: 'Réception des Prés d’Eugénie, style colonial et boiseries',
    alt_en: 'Les Prés d’Eugénie reception, colonial wood panelling',
    caption_fr:
      'La réception accueille les arrivées dans un décor colonial : bois ciré, lumière tamisée et vue sur les jardins poétiques.',
    caption_en:
      'The reception welcomes arrivals in a colonial setting: polished wood, soft light and views over the poetic gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-5',
    category: 'lobby',
    alt_fr: 'Salons Historiques de l’Impératrice, Les Prés d’Eugénie',
    alt_en: 'Salons Historiques de l’Impératrice, Les Prés d’Eugénie',
    caption_fr:
      'Les Salons de l’Impératrice, musée vivant de la Maison, abritent le restaurant Michel Guérard triplement étoilé depuis 1977.',
    caption_en:
      'The Impératrice salons, a living museum of the house, host the Michel Guérard restaurant, three MICHELIN Stars since 1977.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-6',
    category: 'lobby',
    alt_fr: 'Hall d’accueil de la Grande Maison, Eugénie-les-Bains',
    alt_en: 'Grande Maison entrance hall, Eugénie-les-Bains',
    caption_fr:
      'Platanes, bananiers et boiseries coloniales composent le hall — première impression avant les sept jardins.',
    caption_en:
      'Plane trees, banana plants and colonial panelling shape the hall — the first impression before the seven gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-7',
    category: 'room',
    alt_fr: 'Chambre Bouton d’Or, mobilier ancien, Les Prés d’Eugénie',
    alt_en: 'Bouton d’Or room with antique furniture, Les Prés d’Eugénie',
    caption_fr:
      'Chaque chambre porte un nom poétique et un mobilier d’époque : tapis persans, linge fin et vue sur les roseraies.',
    caption_en:
      'Each room carries a poetic name and period furniture: Persian rugs, fine linen and views over the rose gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-8',
    category: 'room',
    alt_fr: 'Chambre au Couvent des Herbes, Les Prés d’Eugénie',
    alt_en: 'Room at Couvent des Herbes, Les Prés d’Eugénie',
    caption_fr:
      'Au Couvent des Herbes, poutres apparentes, lits à baldaquin et jardins ombragés composent une retraite champêtre.',
    caption_en:
      'At Couvent des Herbes, exposed beams, four-poster beds and shaded gardens form a country retreat.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-9',
    category: 'room',
    alt_fr: 'Suite avec salon séparé, Les Prés d’Eugénie',
    alt_en: 'Suite with separate lounge, Les Prés d’Eugénie',
    caption_fr:
      'Les suites déploient salon indépendant, salle de bains en marbre et banquette pour un enfant jusqu’à 12 ans.',
    caption_en:
      'Suites offer a separate lounge, marble bathroom and sofa bed for a child up to 12.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-10',
    category: 'dining',
    alt_fr: 'Restaurant Michel Guérard trois étoiles, Eugénie-les-Bains',
    alt_en: 'Michel Guérard three-star restaurant, Eugénie-les-Bains',
    caption_fr:
      'Hugo Souchet et la brigade prolongent la cuisine naturaliste de Michel Guérard dans les Salons Historiques.',
    caption_en:
      'Hugo Souchet and the brigade extend Michel Guérard’s naturalist cuisine in the historic salons.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-11',
    category: 'dining',
    alt_fr: 'L’Orangerie, jardin d’hiver et cheminée, Les Prés d’Eugénie',
    alt_en: 'L’Orangerie winter garden and fireplace, Les Prés d’Eugénie',
    caption_fr:
      'L’Orangerie, une étoile MICHELIN depuis 2025, sert la Grande Cuisine Minceur® et des grillades en terrasse l’été.',
    caption_en:
      'L’Orangerie, one MICHELIN Star since 2025, serves Grande Cuisine Minceur® and terrace grillades in summer.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-12',
    category: 'dining',
    alt_fr: 'La Ferme aux Grives, cheminée et cuisine landaise',
    alt_en: 'La Ferme aux Grives, fireplace and Landes cooking',
    caption_fr:
      'Dans l’auberge du XVIIIe siècle, cochons de lait et pintades de Saint-Sever mijotent autour de la cheminée.',
    caption_en:
      'In the 18th-century inn, suckling pigs and Saint-Sever guinea fowl simmer around the fireplace.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-13',
    category: 'spa',
    alt_fr: 'Cabine de soins thermaux, La Ferme Thermale d’Eugénie',
    alt_en: 'Thermal treatment cabin, La Ferme Thermale d’Eugénie',
    caption_fr:
      'Vingt-et-une cabines individuelles accueillent cures et soins aux eaux captées à grande profondeur.',
    caption_en:
      'Twenty-one individual cabins host cures and treatments with deeply sourced thermal water.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-14',
    category: 'spa',
    alt_fr: 'Yoga dans les jardins, Les Prés d’Eugénie',
    alt_en: 'Yoga in the gardens, Les Prés d’Eugénie',
    caption_fr:
      'Le programme Mind Body & Soul inclut yoga et marche méditative entre potagers et roseraies.',
    caption_en:
      'The Mind Body & Soul programme includes yoga and mindful walks between vegetable plots and rose beds.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-15',
    category: 'spa',
    alt_fr: 'Institut beauté Sisley, La Ferme Thermale',
    alt_en: 'Sisley beauty institute, La Ferme Thermale',
    caption_fr:
      'Deux cabines Sisley déploient les Soins Phyto-Aromatiques exclusifs aux Prés d’Eugénie.',
    caption_en:
      'Two Sisley cabins offer Phyto-Aromatic treatments exclusive to Les Prés d’Eugénie.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-16',
    category: 'pool',
    alt_fr: 'Piscine extérieure chauffée 26 °C, Les Prés d’Eugénie',
    alt_en: 'Heated outdoor pool at 26 °C, Les Prés d’Eugénie',
    caption_fr:
      'La piscine chauffée s’installe entre les massifs — ouverte toute l’année, encas healthy en juillet-août.',
    caption_en:
      'The heated pool sits among the shrubbery — open year-round, healthy snacks in July and August.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-17',
    category: 'pool',
    alt_fr: 'Bord de piscine et jardins ombragés, Eugénie-les-Bains',
    alt_en: 'Poolside and shaded gardens, Eugénie-les-Bains',
    caption_fr:
      'Entre deux soins ou avant un déjeuner à L’Orangerie, la piscine offre une pause estivale paisible.',
    caption_en:
      'Between treatments or before lunch at L’Orangerie, the pool offers a peaceful summer break.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-18',
    category: 'pool',
    alt_fr: 'Piscine, bain nordique et sauna extérieur en prairie',
    alt_en: 'Pool, Nordic bath and outdoor sauna in the meadow',
    caption_fr:
      'Le rituel estival enchaîne piscine, bain nordique et sauna extérieur — inclus pour les hôtes du domaine.',
    caption_en:
      'The summer ritual links pool, Nordic bath and outdoor sauna — included for estate guests.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-19',
    category: 'view',
    alt_fr: 'Jardins de roses et d’eau, domaine Les Prés d’Eugénie',
    alt_en: 'Rose and water gardens, Les Prés d’Eugénie estate',
    caption_fr: 'Sept jardins poétiques ponctuent les 8 hectares entre Landes, Gers et Béarn.',
    caption_en: 'Seven poetic gardens mark the eight hectares between Landes, Gers and Béarn.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-20',
    category: 'view',
    alt_fr: 'Terrasse et jardins vus depuis une chambre',
    alt_en: 'Terrace and gardens seen from a guest room',
    caption_fr:
      'Depuis les balcons, la roseraie et le jardin d’eau se dévoilent au rythme de l’angélus du village.',
    caption_en:
      'From balconies, the rose garden and water garden unfold to the rhythm of the village angelus.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-21',
    category: 'view',
    alt_fr: 'Vallée landaise autour d’Eugénie-les-Bains',
    alt_en: 'Landes valley around Eugénie-les-Bains',
    caption_fr:
      'Blotti dans une vallée de Gascogne, le domaine ouvre sur la forêt des Landes — déconnexion assurée.',
    caption_en:
      'Nestled in a Gascogne valley, the estate opens onto the Landes forest — guaranteed disconnection.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-22',
    category: 'detail',
    alt_fr: 'Dressage gastronomique, Restaurant Michel Guérard',
    alt_en: 'Gastronomic plating, Michel Guérard restaurant',
    caption_fr:
      'La partition naturaliste célèbre le terroir aquitain — patience, entrée, plat et dessert comme des bijoux.',
    caption_en:
      'The naturalist score celebrates Aquitaine terroir — amuse-bouche, starter, main and dessert like jewels.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-23',
    category: 'detail',
    alt_fr: 'Produits du potager du domaine, Les Prés d’Eugénie',
    alt_en: 'Estate kitchen garden produce, Les Prés d’Eugénie',
    caption_fr:
      'Asperges des Landes, foie gras Lafitte et légumes de Monsieur Bastelica nourrissent les fourneaux.',
    caption_en:
      'Landes asparagus, Lafitte foie gras and Monsieur Bastelica’s vegetables feed the kitchens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-24',
    category: 'detail',
    alt_fr: 'Pâtisseries du Café Mère Poule',
    alt_en: 'Café Mère Poule pastries',
    caption_fr:
      'Gâteaux de grand-mère, samovar et chocolat chaud composent le goûter au Café Mère Poule.',
    caption_en: 'Grandmother’s cakes, samovar and hot chocolate make tea time at Café Mère Poule.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-25',
    category: 'concierge',
    alt_fr: 'Conciergerie 24h/24, Les Prés d’Eugénie',
    alt_en: '24-hour concierge, Les Prés d’Eugénie',
    caption_fr:
      'La conciergerie coordonne tables étoilées, cures thermales et transferts Pau-Biarritz.',
    caption_en:
      'The concierge coordinates starred tables, thermal cures and Pau-Biarritz transfers.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-26',
    category: 'concierge',
    alt_fr: 'Accueil à la réception, Eugénie-les-Bains',
    alt_en: 'Reception welcome, Eugénie-les-Bains',
    caption_fr:
      'Check-in dès 15h : la réception note préférences de table et créneaux spa avant l’installation.',
    caption_en:
      'Check-in from 3 pm: reception notes table preferences and spa slots before settling in.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-27',
    category: 'concierge',
    alt_fr: 'Chambre Indigo terrasse Onzen privatif',
    alt_en: 'Indigo room private Onzen terrace',
    caption_fr:
      'La conciergerie recommande la chambre Indigo pour une première venue en couple — terrasse 85 m².',
    caption_en:
      'The concierge recommends the Indigo room for a first couple’s stay — 85 sq m terrace.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-28',
    category: 'events',
    alt_fr: 'Réception privée dans les jardins',
    alt_en: 'Private reception in the gardens',
    caption_fr:
      'Mariages et séminaires se privatise dans les jardins — evenements@lespresdeugenie.com.',
    caption_en:
      'Weddings and seminars can be privatised in the gardens — evenements@lespresdeugenie.com.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-29',
    category: 'events',
    alt_fr: 'Soirée BarbaGoa barbecue et DJ, L’Orangerie',
    alt_en: 'BarbaGoa barbecue and DJ evening, L’Orangerie',
    caption_fr:
      'L’été, L’Orangerie accueille BarbaGoa : grillades, champagne sous les arbres et DJ ElectroChill.',
    caption_en:
      'In summer, L’Orangerie hosts BarbaGoa: grillades, champagne under the trees and an ElectroChill DJ.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-30',
    category: 'events',
    alt_fr: 'Dîner Al Fresco en terrasse, L’Orangerie',
    alt_en: 'Al Fresco terrace dinner, L’Orangerie',
    caption_fr:
      'Dîners Al Fresco et événements œnologiques ponctuent la saison — dates via la conciergerie.',
    caption_en: 'Al Fresco dinners and wine events mark the season — dates through the concierge.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
] as const;

export const LES_PRES_DEUGENIE_GALLERY_CDC_CATEGORIES = [
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
