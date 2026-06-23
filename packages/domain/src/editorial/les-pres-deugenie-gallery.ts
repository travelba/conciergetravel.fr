/**
 * Phase 3 — curated 30-image gallery manifest for `les-pres-deugenie`.
 *
 * Re-sourced 2026-06-16 (full re-source pass): every pixel verified against
 * lespresdeugenie.com and captioned to match the photographed content. The
 * previous manifest had scrambled categories, an offsite beach-house aerial,
 * two logo plates and a broken hero (children on a bed). All slots are now
 * authentic estate imagery covering the five UI filter tabs
 * (Vue / Chambres / Piscine / Restaurant / Spa) plus a concierge pair.
 *
 * Upload sources live in
 * `scripts/editorial-pilot/src/photos/resource-les-pres-deugenie-gallery-batch.ts`.
 */

export const LES_PRES_DEUGENIE_HERO_IMAGE = 'cct/hotels/les-pres-deugenie/hero';

/** Official source for dedicated hero upload — Maison Rose façade + palm drive (Rule 7). */
export const LES_PRES_DEUGENIE_HERO_SOURCE_URL =
  'https://lespresdeugenie.com/wp-content/uploads/2019/09/lespresdeugenie_maisonrose_facade_ete-min.jpg';

/** Parallel to {@link LES_PRES_DEUGENIE_GALLERY_IMAGES} — provenance for kit audit gates. */
export const LES_PRES_DEUGENIE_GALLERY_SOURCE_URLS = [
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/maison-rose-jardins-sejour-vacances.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/pres-eugenie-les-bains-palace-maison-guerard-nouvelle-aquitaine.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/02/Les-pres-dEugenie-00522.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/chateau-de-bachen-1.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/08/DSC07115.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/03/Eugenie_chambres_CVTSUI_01.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/07/chambre-princiere-temps-cerise-jardins-eugenie-sud-ouest.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/06/pres-eugenie-suite-relais-chateaux-nouvelle-aquitaine-salons.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/07/imperatrice-suite-imperiale-petit-dejeuner-eugenie-sud-ouest.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2022/12/pres-d-eugenie_couvent_2022-15.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/03/Eugenie_chambres_LOGSUI_001.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2021/07/44AB6149-B6C2-476D-959C-EA53AD683C0A-scaled.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/08/Les-Pres-dEugenie-2025-@JoannPai-05870.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/03/Eugenie_chambres_GMJAC_03.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2021/07/2106-02_03_lpde_piscine_bd.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/11/1906-06_lamaisonrose_02_piscine_bd.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2020/09/8A5FD616-C640-47AC-82D7-6E19F516EDAD-scaled.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2021/05/les-pres-d-eugenie_cuisine-etoilee_012.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2021/05/les-pres-d-eugenie_cuisine-etoilee_03.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/Les-pres-dEugenie-00485.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/Les-pres-dEugenie-00245.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2020/04/1906-07_lespresdeugenie_08_terrasse_bd.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2023/01/les-pres-d-eugenie_orangerie_03-1-edited.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/2106-02_01_lpde_yoga_bd.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2018/10/pres-eugenie-ferme-thermale-soin-spa-jardins-nouvelle-aquitaine.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/08/Eugenie-La-Ferme-Thermale-E-Silobre-13.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/08/Eugenie-La-Ferme-Thermale-M-Hurstel.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2025/08/Les-Pres-dEugenie-2025-@JoannPai-06525.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/DSC06045.jpg',
  'https://lespresdeugenie.com/wp-content/uploads/2024/07/Les-pres-dEugenie-00373.jpg',
] as const;

export const LES_PRES_DEUGENIE_GALLERY_IMAGES = [
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-1',
    category: 'view',
    alt_fr: 'Allée de palmiers vers la Maison Rose, Les Prés d’Eugénie, Eugénie-les-Bains',
    alt_en: 'Palm-lined drive to the Maison Rose, Les Prés d’Eugénie, Eugénie-les-Bains',
    caption_fr:
      'L’allée de palmiers mène à la Maison Rose, cœur du domaine de Michel et Christine Guérard à Eugénie-les-Bains.',
    caption_en:
      'The palm-lined drive leads to the Maison Rose, heart of Michel and Christine Guérard’s estate at Eugénie-les-Bains.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-2',
    category: 'view',
    alt_fr: 'Façade de la Maison Rose illuminée à l’heure bleue, Les Prés d’Eugénie',
    alt_en: 'Maison Rose façade lit at blue hour, Les Prés d’Eugénie',
    caption_fr:
      'À l’heure bleue, la verrière et la véranda coloniale de la Maison Rose s’illuminent au-dessus des jardins taillés.',
    caption_en:
      'At blue hour, the Maison Rose conservatory and colonial veranda glow above the clipped gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-3',
    category: 'view',
    alt_fr: 'Pergola en fer forgé vert de l’Orangerie, Les Prés d’Eugénie',
    alt_en: 'Green wrought-iron Orangerie pergola, Les Prés d’Eugénie',
    caption_fr:
      'La pergola verte de l’Orangerie ouvre sur les jardins ; l’été, on y dîne lors des soirées Al Fresco.',
    caption_en:
      'The Orangerie’s green pergola opens onto the gardens; in summer it hosts the Al Fresco dinners.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-4',
    category: 'exterior',
    alt_fr: 'Allée d’arbres du Château de Bachen, vignoble des Guérard',
    alt_en: 'Tree-lined alley at Château de Bachen, the Guérard vineyard',
    caption_fr:
      'À vingt minutes, le Château de Bachen produit le Baron de Bachen ; la conciergerie organise la visite du chai.',
    caption_en:
      'Twenty minutes away, Château de Bachen makes the Baron de Bachen; the concierge arranges the cellar visit.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-5',
    category: 'exterior',
    alt_fr: 'Auberge landaise en pierre parmi les prairies fleuries, Les Prés d’Eugénie',
    alt_en: 'Stone Landes auberge among wildflower meadows, Les Prés d’Eugénie',
    caption_fr:
      'L’ancienne ferme landaise abrite La Ferme aux Grives, l’auberge de campagne de Michel Guérard, entourée de prairies fleuries.',
    caption_en:
      'The old Landes farmhouse holds La Ferme aux Grives, Michel Guérard’s country inn, ringed by wildflower meadows.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-6',
    category: 'room',
    alt_fr: 'Lit à baldaquin et toile de Jouy jaune, chambre du Couvent aux Herbes',
    alt_en: 'Canopy bed with yellow toile de Jouy, Couvent aux Herbes room',
    caption_fr:
      'Baldaquin, toile de Jouy jaune et petit-déjeuner servi en chambre : le couvent restauré cultive l’esprit maison de campagne.',
    caption_en:
      'Canopy, yellow toile de Jouy and breakfast in the room: the restored convent keeps a country-house spirit.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-7',
    category: 'room',
    alt_fr: 'Chambre Princière en toile rose côté jardins, Les Prés d’Eugénie',
    alt_en: 'Princière room in pink toile facing the gardens, Les Prés d’Eugénie',
    caption_fr:
      'La chambre Princière, toile rose et vue sur les jardins, compte parmi les chambres romantiques de la Maison Rose.',
    caption_en:
      'The Princière room, in pink toile with garden views, is among the romantic rooms of the Maison Rose.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-8',
    category: 'room',
    alt_fr: 'Salon de la suite Impératrice, Les Prés d’Eugénie',
    alt_en: 'Salon of the Impératrice suite, Les Prés d’Eugénie',
    caption_fr:
      'La suite Impératrice ajoute un salon indépendant à la chambre ; idéale pour une cure de plusieurs jours.',
    caption_en:
      'The Impératrice suite adds a separate salon to the bedroom — ideal for a multi-day cure stay.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-9',
    category: 'room',
    alt_fr: 'Petit-déjeuner dans la Suite Impériale, Eugénie-les-Bains',
    alt_en: 'Breakfast in the Imperial Suite, Eugénie-les-Bains',
    caption_fr:
      'Petit-déjeuner minceur ou gourmand servi dans la Suite Impériale ; la cuisine de Guérard décline les deux cartes.',
    caption_en:
      'A light or indulgent breakfast served in the Imperial Suite; the Guérard kitchen offers both menus.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-10',
    category: 'room',
    alt_fr: 'Chambre du Couvent aux poutres apparentes, Les Prés d’Eugénie',
    alt_en: 'Beamed Couvent room, Les Prés d’Eugénie',
    caption_fr:
      'Le Couvent aux Herbes, ancien couvent du XVIIIe siècle, offre des chambres à poutres apparentes parmi les jardins d’aromatiques.',
    caption_en:
      'Le Couvent aux Herbes, an 18th-century convent, offers beamed rooms set among the herb gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-11',
    category: 'room',
    alt_fr: 'Chambre à baldaquin drapé jaune, Les Logis de la Ferme aux Grives',
    alt_en: 'Yellow draped four-poster room, Les Logis de la Ferme aux Grives',
    caption_fr:
      'Les Logis de la Ferme aux Grives, baldaquins drapés et bois peint, prolongent l’auberge côté campagne.',
    caption_en:
      'Les Logis de la Ferme aux Grives — draped four-posters and painted wood — extend the country inn.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-12',
    category: 'detail',
    alt_fr: 'Bouquet de roses et lion en faïence, décor des Prés d’Eugénie',
    alt_en: 'Rose bouquet and faience lion, Les Prés d’Eugénie decor',
    caption_fr:
      'Bouquets champêtres et faïences chinées signent la décoration de Christine Guérard, pièce après pièce.',
    caption_en:
      'Country bouquets and antique faience define Christine Guérard’s decoration, room after room.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-13',
    category: 'room',
    alt_fr: 'Chambre aux poutres et tissus fleuris, Les Prés d’Eugénie',
    alt_en: 'Beamed room with floral fabrics, Les Prés d’Eugénie',
    caption_fr:
      'Poutres patinées, tissus fleuris et lumière landaise : chaque chambre est meublée d’ancien, sans deux décors identiques.',
    caption_en:
      'Patinated beams, floral fabrics and Landes light: every room is furnished with antiques, no two alike.',
    credit: 'Les Prés d’Eugénie — JoannPai (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-14',
    category: 'pool',
    alt_fr: 'Bassin privatif et transats sur la terrasse d’une suite, Les Prés d’Eugénie',
    alt_en: 'Private plunge pool and loungers on a suite terrace, Les Prés d’Eugénie',
    caption_fr:
      'Certaines suites jardin disposent d’un bassin privatif et de transats face aux prairies — demandez-le à la conciergerie.',
    caption_en:
      'Some garden suites have a private plunge pool and loungers facing the meadows — ask the concierge.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-15',
    category: 'pool',
    alt_fr: 'Piscine extérieure bordée de pierre, vue aérienne, Les Prés d’Eugénie',
    alt_en: 'Stone-edged outdoor pool, aerial view, Les Prés d’Eugénie',
    caption_fr:
      'La piscine extérieure, bordée de pierre et de parasols, se niche entre les jardins de la Maison Rose.',
    caption_en:
      'The stone-edged outdoor pool, framed by parasols, nestles among the Maison Rose gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-16',
    category: 'pool',
    alt_fr: 'Piscine et transats devant la façade rose de la Maison Rose',
    alt_en: 'Pool and loungers before the pink Maison Rose façade',
    caption_fr:
      'Au pied de la Maison Rose, la piscine et ses transats jaunes prolongent la détente après La Ferme Thermale.',
    caption_en:
      'At the foot of the Maison Rose, the pool and its yellow loungers extend the calm after La Ferme Thermale.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-17',
    category: 'dining',
    alt_fr: 'Plat signature aux langoustines, restaurant Michel Guérard',
    alt_en: 'Langoustine signature dish, Michel Guérard restaurant',
    caption_fr:
      'Au restaurant trois étoiles Michel Guérard, les langoustines illustrent grande cuisine et cuisine minceur réunies.',
    caption_en:
      'At the three-star Michel Guérard restaurant, langoustines embody grande cuisine and cuisine minceur together.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-18',
    category: 'dining',
    alt_fr: 'Brigade en cuisine, restaurant étoilé Michel Guérard',
    alt_en: 'Brigade plating in the Michel Guérard starred kitchen',
    caption_fr:
      'La brigade dresse en cuisine ; l’École de Cuisine Minceur ouvre ces fourneaux aux hôtes plusieurs fois par an.',
    caption_en:
      'The brigade plates in the kitchen; the Cuisine Minceur school opens these stoves to guests several times a year.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-19',
    category: 'dining',
    alt_fr: 'Dôme au caviar, table trois étoiles d’Eugénie',
    alt_en: 'Caviar dome, the three-star table at Eugénie',
    caption_fr:
      'Le menu dégustation alterne créations minceur et plats de fête, comme ce dôme au caviar dressé à l’assiette.',
    caption_en:
      'The tasting menu alternates light creations and festive plates, like this caviar dome served to the plate.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-20',
    category: 'dining',
    alt_fr: 'Assiette gastronomique, restaurant Les Prés d’Eugénie',
    alt_en: 'Gastronomic plate, Les Prés d’Eugénie restaurant',
    caption_fr:
      'Légumes du potager, foie gras de Lafitte et produits landais composent la carte des Prés d’Eugénie.',
    caption_en:
      'Kitchen-garden vegetables, Lafitte foie gras and Landes produce shape the Prés d’Eugénie menu.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-21',
    category: 'dining',
    alt_fr: 'Tartelette aux fruits sur planche de bois, Les Prés d’Eugénie',
    alt_en: 'Fruit tartlet on a wooden board, Les Prés d’Eugénie',
    caption_fr:
      'Les desserts, hérités de la nouvelle cuisine, jouent l’acidité des fruits du Sud-Ouest plutôt que le sucre.',
    caption_en:
      'The desserts, born of nouvelle cuisine, favour the acidity of South-West fruit over sugar.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-22',
    category: 'dining',
    alt_fr: 'Terrasse de restaurant aux fauteuils blancs, jardins d’Eugénie',
    alt_en: 'Restaurant terrace with white chairs, Eugénie gardens',
    caption_fr:
      'Aux beaux jours, le déjeuner se prend en terrasse, fauteuils blancs et nappes safran sous les arbres.',
    caption_en:
      'In fine weather lunch moves to the terrace — white chairs and saffron linen under the trees.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-23',
    category: 'dining',
    alt_fr: 'Table dressée à l’Orangerie, faïences et bouquet, Les Prés d’Eugénie',
    alt_en: 'Set table at the Orangerie, faience and bouquet, Les Prés d’Eugénie',
    caption_fr:
      'À l’Orangerie, les tables dressées de faïences anciennes accueillent petits-déjeuners et déjeuners face aux jardins.',
    caption_en:
      'At the Orangerie, tables laid with antique faience host breakfasts and lunches facing the gardens.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-24',
    category: 'spa',
    alt_fr: 'Séance de yoga en plein air dans les jardins, La Ferme Thermale',
    alt_en: 'Outdoor yoga in the gardens, La Ferme Thermale',
    caption_fr:
      'Le programme bien-être ajoute yoga et marche aux jardins ; les séances matinales se réservent à La Ferme Thermale.',
    caption_en:
      'The wellness programme adds yoga and walks in the gardens; morning sessions book at La Ferme Thermale.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-25',
    category: 'spa',
    alt_fr: 'La Ferme Thermale dans ses jardins, Eugénie-les-Bains',
    alt_en: 'La Ferme Thermale in its gardens, Eugénie-les-Bains',
    caption_fr:
      'La Ferme Thermale, 1 000 m² de soins partenaires Sisley, puise aux sources thermales d’Eugénie-les-Bains.',
    caption_en:
      'La Ferme Thermale — 1,000 sq m of Sisley-partner treatments — draws on the Eugénie-les-Bains thermal springs.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-26',
    category: 'spa',
    alt_fr: 'Bain thermal rond en bois en extérieur, La Ferme Thermale',
    alt_en: 'Round outdoor wooden thermal bath, La Ferme Thermale',
    caption_fr:
      'Les bains en bois, en plein air face aux prairies, ponctuent le parcours sensoriel de La Ferme Thermale.',
    caption_en:
      'Outdoor wooden baths, facing the meadows, punctuate La Ferme Thermale’s sensory circuit.',
    credit: 'Les Prés d’Eugénie — Emilie Silobre (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-27',
    category: 'spa',
    alt_fr: 'Bain bouillonnant en bois, soins de La Ferme Thermale',
    alt_en: 'Wooden hot tub, La Ferme Thermale treatments',
    caption_fr:
      'Entre deux soins, le bain bouillonnant prolonge la cure ; serviettes et tisanerie attendent au calme.',
    caption_en:
      'Between treatments, the hot tub extends the cure; towels and a herbal-tea room wait nearby.',
    credit: 'Les Prés d’Eugénie — M. Hurstel (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-28',
    category: 'spa',
    alt_fr: 'Salle de repos et massage, La Ferme Thermale',
    alt_en: 'Relaxation and massage room, La Ferme Thermale',
    caption_fr:
      'Les cabines de soins et la salle de repos closent le parcours ; réservez les massages signature à l’arrivée.',
    caption_en:
      'Treatment cabins and the relaxation room close the circuit; book the signature massages on arrival.',
    credit: 'Les Prés d’Eugénie — JoannPai (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-29',
    category: 'concierge',
    alt_fr: 'Michel Guérard en cuisine avec son chef, Les Prés d’Eugénie',
    alt_en: 'Michel Guérard in the kitchen with his chef, Les Prés d’Eugénie',
    caption_fr:
      'Michel Guérard, père de la cuisine minceur, a façonné ici une table trois étoiles que sa brigade perpétue.',
    caption_en:
      'Michel Guérard, father of cuisine minceur, shaped a three-star table here that his brigade still upholds.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
  {
    public_id: 'cct/hotels/les-pres-deugenie/press-30',
    category: 'concierge',
    alt_fr: 'Maître d’hôtel en livrée, service des Prés d’Eugénie',
    alt_en: 'Maître d’hôtel in livery, Les Prés d’Eugénie service',
    caption_fr:
      'Le maître d’hôtel coordonne tables étoilées, créneaux de cure et transferts depuis Pau ou Mont-de-Marsan.',
    caption_en:
      'The maître d’hôtel coordinates starred tables, cure slots and transfers from Pau or Mont-de-Marsan.',
    credit: 'Les Prés d’Eugénie — Maison Guérard (lespresdeugenie.com)',
  },
] as const;

export const LES_PRES_DEUGENIE_GALLERY_CDC_CATEGORIES = [
  'view',
  'exterior',
  'room',
  'detail',
  'pool',
  'dining',
  'spa',
  'concierge',
] as const;
