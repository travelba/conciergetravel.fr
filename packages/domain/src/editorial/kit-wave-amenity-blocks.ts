/**
 * Curated amenity blocks for `#hotel-en-bref` on kit wave-5 fiches.
 * Mirrors `PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS` / `AIRELLES_KIT_AMENITY_BLOCKS`.
 */

export type KitWaveAmenityIcon = 'concierge' | 'spa' | 'dining' | 'room' | 'daily' | 'access';

export interface KitWaveAmenityBlock {
  readonly icon: KitWaveAmenityIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

export const CHEVAL_BLANC_PARIS_KIT_AMENITY_BLOCKS: readonly KitWaveAmenityBlock[] = [
  {
    icon: 'concierge',
    titleFr: 'Conciergerie & majordomes',
    titleEn: 'Concierge & butlers',
    descFr:
      'Réception 24h/24, conciergerie multilingue, majordomes pour les suites et Artisans de la Maison.',
    descEn: '24-hour reception, multilingual concierge, butlers for suites and Maison Artisans.',
  },
  {
    icon: 'spa',
    titleFr: 'Dior Spa & piscine mosaïque',
    titleEn: 'Dior Spa & mosaic pool',
    descFr:
      'Soins Dior en suite exclusive, piscine à débordement en mosaïque, fitness et sauna — sur rendez-vous.',
    descEn:
      'Dior treatments in a private suite, mosaic infinity pool, fitness and sauna — by appointment.',
  },
  {
    icon: 'dining',
    titleFr: 'Cinq tables & bars',
    titleEn: 'Five tables & bars',
    descFr:
      'Plénitude (3 étoiles), Hakuba (2 étoiles), Le Tout-Paris (1 étoile), Langosteria, Le Jardin et leurs bars.',
    descEn:
      'Plénitude (3 Stars), Hakuba (2 Stars), Le Tout-Paris (1 Star), Langosteria, Le Jardin and their bars.',
  },
  {
    icon: 'room',
    titleFr: '72 clefs Peter Marino',
    titleEn: '72 keys by Peter Marino',
    descFr:
      'Vingt-six chambres et quarante-six suites dans la Samaritaine — jardins d’hiver, art contemporain et laiton.',
    descEn:
      'Twenty-six rooms and forty-six suites in the Samaritaine — winter gardens, contemporary art and brass.',
  },
  {
    icon: 'daily',
    titleFr: 'Carte Blanche & quotidien',
    titleEn: 'Carte Blanche & daily',
    descFr:
      'Room service 24h/24, Carte Blanche en chambre, couverture, blanchisserie et Le Carrousel pour les enfants.',
    descEn:
      '24-hour room service, in-room Carte Blanche, turndown, laundry and Le Carrousel for children.',
  },
  {
    icon: 'access',
    titleFr: 'Quai du Louvre & Seine',
    titleEn: 'Quai du Louvre & Seine',
    descFr:
      'Face au Pont Neuf et au Louvre — métro Châtelet à six minutes, Samaritaine dans le même bâtiment.',
    descEn:
      'Facing Pont Neuf and the Louvre — Châtelet metro six minutes away, Samaritaine in the same building.',
  },
];

export const LE_BRISTOL_PARIS_KIT_AMENITY_BLOCKS: readonly KitWaveAmenityBlock[] = [
  {
    icon: 'concierge',
    titleFr: 'Conciergerie Les Clefs d’Or',
    titleEn: 'Les Clefs d’Or concierge',
    descFr:
      'Réception et conciergerie 24h/24, voiturier, limousine, fleuriste et bureau d’excursions.',
    descEn: '24-hour reception and concierge, valet, limousine, florist and tour desk.',
  },
  {
    icon: 'spa',
    titleFr: 'Spa La Mer & piscine rooftop',
    titleEn: 'La Mer spa & rooftop pool',
    descFr:
      'Spa Le Bristol by La Mer (9 h–21 h), cabines duo, piscine couverte en acajou au 6e avec vue Paris.',
    descEn:
      'Spa Le Bristol by La Mer (9 am–9 pm), couples suites, 6th-floor mahogany indoor pool with Paris views.',
  },
  {
    icon: 'dining',
    titleFr: 'Epicure & 114 Faubourg',
    titleEn: 'Epicure & 114 Faubourg',
    descFr:
      'Epicure trois étoiles MICHELIN, 114 Faubourg une étoile, Le Jardin Français, Café Antonia et Le Bar du Bristol.',
    descEn:
      'Three-MICHELIN-star Epicure, one-star 114 Faubourg, Le Jardin Français, Café Antonia and Le Bar du Bristol.',
  },
  {
    icon: 'room',
    titleFr: 'Jardin secret de 1 200 m²',
    titleEn: '1,200 sq m secret garden',
    descFr:
      'Hôtel particulier du XVIIIe siècle — chambres et suites sur le jardin à la française ou les toits parisiens.',
    descEn: '18th-century town house — rooms and suites over the French garden or Paris rooftops.',
  },
  {
    icon: 'daily',
    titleFr: 'Services du quotidien',
    titleEn: 'Daily services',
    descFr:
      'Service de chambre quotidien, couverture, blanchisserie, cirage et presse internationale.',
    descEn: 'Daily housekeeping, turndown, laundry, shoeshine and international press.',
  },
  {
    icon: 'access',
    titleFr: 'Faubourg Saint-Honoré',
    titleEn: 'Faubourg Saint-Honoré',
    descFr:
      '112 rue du Faubourg Saint-Honoré — métro Madeleine à huit minutes, Élysée à trois cents mètres.',
    descEn:
      '112 Rue du Faubourg Saint-Honoré — Madeleine metro eight minutes away, Élysée three hundred metres.',
  },
];

export const LES_AIRELLES_COURCHEVEL_KIT_AMENITY_BLOCKS: readonly KitWaveAmenityBlock[] = [
  {
    icon: 'access',
    titleFr: 'Ski-in / ski-out 1850',
    titleEn: 'Ski-in / ski-out 1850',
    descFr:
      'Accès direct au Jardin Alpin — ski valet Bernard Orcel, salle de ski chauffée et forfaits 3 Vallées.',
    descEn:
      'Direct access to Le Jardin Alpin — Bernard Orcel ski valet, heated ski room and Three Valleys passes.',
  },
  {
    icon: 'spa',
    titleFr: 'Spa La Mer & cryothérapie',
    titleEn: 'La Mer spa & cryotherapy',
    descFr:
      'Piscine azur, grotte de neige, cryothérapie et soins La Mer — le rituel récupération après la ski.',
    descEn:
      'Azure pool, snow cave, cryotherapy and La Mer treatments — the post-ski recovery ritual.',
  },
  {
    icon: 'dining',
    titleFr: 'Six adresses gastronomiques',
    titleEn: 'Six dining addresses',
    descFr:
      'La Table des Airelles (étoilée), Matsuhisa, La Folie Douce, bar, salon et room service montagnard.',
    descEn:
      'La Table des Airelles (starred), Matsuhisa, La Folie Douce, bar, lounge and mountain room service.',
  },
  {
    icon: 'room',
    titleFr: 'Château des neiges',
    titleEn: 'Snow castle',
    descFr:
      'Quarante-quatre chambres et suites au décor austro-hongrois — cheminées, boiseries et vues sur les sommets.',
    descEn:
      'Forty-four Austro-Hungarian-decor rooms and suites — fireplaces, panelling and peak views.',
  },
  {
    icon: 'concierge',
    titleFr: 'Conciergerie montagne',
    titleEn: 'Mountain concierge',
    descFr:
      'Conciergerie 24h/24, hors-piste, héli-ski, motoneige, patinoire et cinéma privé sur réservation.',
    descEn:
      '24-hour concierge, off-piste, heli-ski, snowmobile, ice rink and private cinema by reservation.',
  },
  {
    icon: 'daily',
    titleFr: 'Winter Camp & enfants',
    titleEn: 'Winter Camp & children',
    descFr:
      'Animations enfants, piscine dédiée, ski école et garderie — le palace suit la famille du matin au soir.',
    descEn:
      'Children’s activities, dedicated pool, ski school and childcare — the palace follows the family dawn to dusk.',
  },
];

export const LES_PRES_DEUGENIE_KIT_AMENITY_BLOCKS: readonly KitWaveAmenityBlock[] = [
  {
    icon: 'dining',
    titleFr: 'Michel Guérard 3 étoiles',
    titleEn: 'Michel Guérard 3 Stars',
    descFr:
      'Salons de l’Impératrice triplement étoilés, L’Orangerie une étoile, La Ferme aux Grives et La Ferme Thermale.',
    descEn:
      'Three-star Impératrice salons, one-star L’Orangerie, La Ferme aux Grives and La Ferme Thermale.',
  },
  {
    icon: 'spa',
    titleFr: 'La Ferme Thermale Sisley',
    titleEn: 'Sisley La Ferme Thermale',
    descFr:
      'Sources millénaires, bains de kaolin, soins Sisley et piscine chauffée — sur rendez-vous, 16 ans et plus.',
    descEn:
      'Millennia-old springs, kaolin baths, Sisley rituals and heated pool — by appointment, ages 16+.',
  },
  {
    icon: 'room',
    titleFr: 'Huit hectares de jardins',
    titleEn: 'Eight hectares of gardens',
    descFr:
      'Roseraies, potagers, jardin d’eau et prairies landaises — chambres au couvent ou terrasses Onzen.',
    descEn:
      'Rose beds, kitchen gardens, water garden and Landes meadows — convent rooms or Onzen terraces.',
  },
  {
    icon: 'concierge',
    titleFr: 'Conciergerie Relais & Châteaux',
    titleEn: 'Relais & Châteaux concierge',
    descFr:
      'Réception 24h/24, conciergerie multilingue, transferts océan, forêt des Landes et Pays basque.',
    descEn:
      '24-hour reception, multilingual concierge, transfers to the ocean, Landes forest and Basque Country.',
  },
  {
    icon: 'daily',
    titleFr: 'Grande Cuisine Minceur®',
    titleEn: 'Grande Cuisine Minceur®',
    descFr:
      'Menus healthy (~550 kcal) à L’Orangerie, room service gastronomique et couverture quotidienne.',
    descEn: 'Healthy menus (~550 kcal) at L’Orangerie, gourmet room service and daily turndown.',
  },
  {
    icon: 'access',
    titleFr: 'Eugénie-les-Bains & Landes',
    titleEn: 'Eugénie-les-Bains & Landes',
    descFr: '334 rue René Vielle — Dax TGV à vingt minutes, Pau à 45 km, Biarritz à 100 km.',
    descEn: '334 Rue René Vielle — Dax TGV twenty minutes away, Pau 45 km, Biarritz 100 km.',
  },
];

export const SHANGRI_LA_PARIS_KIT_AMENITY_BLOCKS: readonly KitWaveAmenityBlock[] = [
  {
    icon: 'dining',
    titleFr: 'Shang Palace étoilé',
    titleEn: 'Starred Shang Palace',
    descFr:
      'Shang Palace (1 étoile MICHELIN), La Bauhinia sous verrière, L’Oiseau Blanc et le Bar Botaniste.',
    descEn:
      'Shang Palace (1 MICHELIN Star), La Bauhinia under its cupola, L’Oiseau Blanc and Bar Botaniste.',
  },
  {
    icon: 'spa',
    titleFr: 'CHI, The Spa',
    titleEn: 'CHI, The Spa',
    descFr:
      'Rituels Prince Bonaparte, piscine intérieure et soins asiatiques — cabines duo sur rendez-vous.',
    descEn:
      'Prince Bonaparte rituals, indoor pool and Asian-inspired treatments — couples suites by appointment.',
  },
  {
    icon: 'room',
    titleFr: 'Vue Tour Eiffel',
    titleEn: 'Eiffel Tower views',
    descFr:
      'Cent chambres dont trente-sept suites — terrasses et balcons face à la Tour Eiffel depuis le 16e.',
    descEn:
      'One hundred rooms including thirty-seven suites — terraces and balconies facing the Eiffel Tower from the 16th.',
  },
  {
    icon: 'concierge',
    titleFr: 'Conciergerie palace',
    titleEn: 'Palace concierge',
    descFr:
      'Réception 24h/24, conciergerie Clefs d’Or, visites patrimoine du Palais d’Iéna et privatisation salons.',
    descEn:
      '24-hour reception, Clefs d’Or concierge, Palais d’Iéna heritage tours and salon privatisation.',
  },
  {
    icon: 'daily',
    titleFr: 'Petit-déjeuner signature',
    titleEn: 'Signature breakfast',
    descFr:
      'Room service 24h/24, petit-déjeuner terrasse pour certaines suites, blanchisserie et couverture.',
    descEn: '24-hour room service, terrace breakfast for select suites, laundry and turndown.',
  },
  {
    icon: 'access',
    titleFr: 'Palais d’Iéna & Trocadéro',
    titleEn: 'Palais d’Iéna & Trocadéro',
    descFr:
      '10 avenue d’Iéna — métro Iéna (ligne 9), Trocadéro et Seine à quelques minutes à pied.',
    descEn: '10 Avenue d’Iéna — Iéna metro (line 9), Trocadéro and the Seine a few minutes’ walk.',
  },
];
