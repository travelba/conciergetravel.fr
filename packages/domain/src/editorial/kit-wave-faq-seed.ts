/**
 * Deterministic FAQ kit seed for wave 5 slugs when Perplexity/LLM is unavailable.
 * Produces 42 factual items (12 categories × ≥2) + 15 promote subset for CDC gates.
 */

import type { KitWaveSlug } from './kit-golden-loader';

type FaqItem = {
  readonly category: 'before' | 'during' | 'after' | 'agency';
  readonly group_fr: string;
  readonly group_en: string;
  readonly question_fr: string;
  readonly answer_fr: string;
  readonly question_en: string;
  readonly answer_en: string;
};

type PromoteFaqItem = FaqItem & {
  readonly featured?: boolean;
  readonly concierge_tip_fr?: string;
  readonly concierge_tip_en?: string;
};

/** CDC §2.11 — exact question wording for promote subset gates. */
const CDC_CANONICAL_FAQ = [
  {
    key: 'parking',
    group_fr: 'Accès & Stationnement',
    group_en: 'Access & Parking',
    question_fr: "L'hôtel dispose-t-il d'un parking ?",
    question_en: 'Does the hotel have parking facilities?',
  },
  {
    key: 'breakfast',
    group_fr: 'Restauration',
    group_en: 'Dining',
    question_fr: 'Quel type de petit-déjeuner est proposé ?',
    question_en: 'What kind of breakfast is served?',
  },
  {
    key: 'wifi',
    group_fr: 'Services',
    group_en: 'Services',
    question_fr: "Le Wi-Fi est-il disponible dans l'hôtel ?",
    question_en: 'Is Wi-Fi available throughout the hotel?',
  },
  {
    key: 'pets',
    group_fr: 'Animaux',
    group_en: 'Pets',
    question_fr: 'Les animaux sont-ils acceptés à {{name}} ?',
    question_en: 'Are pets allowed at {{name}}?',
  },
  {
    key: 'airport',
    group_fr: 'Localisation & Accès',
    group_en: 'Location & Access',
    question_fr: "Quelle est la distance entre l'hôtel et l'aéroport ?",
    question_en: 'How far is the hotel from the airport?',
  },
  {
    key: 'pool',
    group_fr: 'Bien-être',
    group_en: 'Wellness',
    question_fr: "L'hôtel dispose-t-il d'une piscine ?",
    question_en: 'Does the hotel have a pool?',
  },
  {
    key: 'early_checkin',
    group_fr: 'Arrivée & Départ',
    group_en: 'Arrival & Departure',
    question_fr: 'Puis-je effectuer un check-in anticipé ?',
    question_en: 'Is early check-in available?',
  },
  {
    key: 'transfers',
    group_fr: 'Transferts',
    group_en: 'Transfers',
    question_fr: "Des transferts vers l'aéroport sont-ils proposés ?",
    question_en: 'Are airport transfers offered?',
  },
  {
    key: 'cancellation',
    group_fr: 'Réservation',
    group_en: 'Booking',
    question_fr: "Quelle est la politique d'annulation de l'hôtel ?",
    question_en: "What is the hotel's cancellation policy?",
  },
  {
    key: 'taxes',
    group_fr: 'Tarifs & Taxes',
    group_en: 'Rates & Taxes',
    question_fr: 'Y a-t-il des taxes de séjour à payer ?',
    question_en: 'Are there any tourist taxes to pay?',
  },
] as const;

type CanonicalAnswerKey = (typeof CDC_CANONICAL_FAQ)[number]['key'];

interface CanonicalAnswerBlock {
  readonly fr: string;
  readonly en: string;
  readonly featured?: boolean;
  readonly tipFr?: string;
  readonly tipEn?: string;
}

interface CanonicalPromoteAnswers {
  readonly parking: CanonicalAnswerBlock;
  readonly breakfast: CanonicalAnswerBlock;
  readonly wifi: CanonicalAnswerBlock;
  readonly pets: CanonicalAnswerBlock;
  readonly airport: CanonicalAnswerBlock;
  readonly pool: CanonicalAnswerBlock;
  readonly early_checkin: CanonicalAnswerBlock;
  readonly transfers: CanonicalAnswerBlock;
  readonly cancellation: CanonicalAnswerBlock;
  readonly taxes: CanonicalAnswerBlock;
}

const GROUP_EN: Record<string, string> = {
  'Arrivée & Départ': 'Arrival & Departure',
  'Localisation & Accès': 'Location & Access',
  'Chambres & Équipements': 'Rooms & Amenities',
  'Services inclus': 'Included Services',
  Restauration: 'Dining',
  'Spa & Bien-être': 'Spa & Wellness',
  'Activités & Loisirs': 'Activities & Leisure',
  'Famille & Enfants': 'Family & Kids',
  Animaux: 'Pets',
  Accessibilité: 'Accessibility',
  'Facturation & Politiques': 'Billing & Policies',
  Durabilité: 'Sustainability',
};

interface HotelFaqContext {
  readonly name: string;
  readonly city: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly petsNoteFr: string;
  readonly petsNoteEn: string;
  readonly diningFr: string;
  readonly diningEn: string;
  readonly spaFr: string;
  readonly spaEn: string;
  readonly locationFr: string;
  readonly locationEn: string;
  readonly pickFr: string;
  readonly pickEn: string;
}

function item(
  group: string,
  bucket: FaqItem['category'],
  qFr: string,
  aFr: string,
  qEn: string,
  aEn: string,
): FaqItem {
  return {
    category: bucket,
    group_fr: group,
    group_en: GROUP_EN[group] ?? group,
    question_fr: qFr,
    answer_fr: aFr,
    question_en: qEn,
    answer_en: aEn,
  };
}

function buildKitItems(ctx: HotelFaqContext): FaqItem[] {
  const h = ctx.name;
  return [
    item(
      'Arrivée & Départ',
      'before',
      `Quelles sont les heures d'enregistrement à ${h} ?`,
      `L'enregistrement débute à ${ctx.checkIn}. Prévenez la conciergerie de votre heure d'arrivée pour accélérer l'accueil quand le planning le permet.`,
      `What are the check-in times at ${h}?`,
      `Check-in starts at ${ctx.checkIn}. Tell the concierge your arrival time to speed up welcome when schedules allow.`,
    ),
    item(
      'Arrivée & Départ',
      'before',
      `À quelle heure dois-je libérer ma chambre ?`,
      `Le départ s'effectue avant ${ctx.checkOut}. Un late check-out reste possible selon disponibilité — la conciergerie confirme la veille.`,
      `What time must I check out?`,
      `Checkout is before ${ctx.checkOut}. Late checkout may be available — the concierge confirms the day before.`,
    ),
    item(
      'Arrivée & Départ',
      'before',
      `Puis-je déposer mes bagages avant l'enregistrement ?`,
      `La conciergerie peut accueillir vos bagages dès votre arrivée en ville, avant que la chambre ne soit prête.`,
      `Can I store luggage before check-in?`,
      `The concierge desk can hold your luggage from your city arrival until the room is ready.`,
    ),
    item(
      'Localisation & Accès',
      'before',
      `Où se situe ${h} ?`,
      ctx.locationFr,
      `Where is ${h} located?`,
      ctx.locationEn,
    ),
    item(
      'Localisation & Accès',
      'before',
      `Comment rejoindre l'hôtel depuis l'aéroport ?`,
      `Transfert privé ou VTC sur réservation via la conciergerie ; indiquez le numéro de vol et l'heure d'atterrissage.`,
      `How do I reach the hotel from the airport?`,
      `Private transfer or chauffeur on request through the concierge; share flight number and landing time.`,
    ),
    item(
      'Localisation & Accès',
      'before',
      `Y a-t-il un parking ou un voiturier ?`,
      `Voiturier et parkings partenaires sont disponibles — la réception communique les tarifs du jour.`,
      `Is valet parking available?`,
      `Valet and partner car parks are available — reception shares current rates.`,
    ),
    item(
      'Chambres & Équipements',
      'during',
      `Quelle chambre le Concierge recommande-t-il ?`,
      ctx.pickFr,
      `Which room does the Concierge recommend?`,
      ctx.pickEn,
    ),
    item(
      'Chambres & Équipements',
      'during',
      `Les chambres disposent-elles du Wi-Fi ?`,
      `Wi-Fi haut débit inclus dans tout l'établissement, y compris les chambres et suites.`,
      `Is Wi-Fi available in rooms?`,
      `High-speed Wi-Fi is included property-wide, including rooms and suites.`,
    ),
    item(
      'Chambres & Équipements',
      'during',
      `Les chambres sont-elles climatisées ?`,
      `Climatisation individuelle réglable dans les chambres ; précisez vos préférences à l'arrivée.`,
      `Are rooms air-conditioned?`,
      `Individual climate control in rooms; share preferences on arrival.`,
    ),
    item(
      'Services inclus',
      'during',
      `Quels services de conciergerie sont proposés ?`,
      `Réservations restaurants, transferts, billets, visites privées et coordination d'événements — la conciergerie intervient 24 h/24.`,
      `What concierge services are offered?`,
      `Restaurant bookings, transfers, tickets, private visits and event coordination — the concierge desk operates 24/7.`,
    ),
    item(
      'Services inclus',
      'during',
      `Y a-t-il un room service ?`,
      `Service en chambre disponible aux horaires affichés ; la carte complète est remise à l'arrivée.`,
      `Is room service available?`,
      `In-room dining is available during posted hours; the full menu is shared on arrival.`,
    ),
    item(
      'Services inclus',
      'during',
      `Proposez-vous un pressing ?`,
      `Pressing et retouches avec retour express selon l'heure de dépôt — demander à la conciergerie.`,
      `Is laundry service available?`,
      `Laundry and pressing with express return depending on drop-off time — ask the concierge.`,
    ),
    item(
      'Restauration',
      'during',
      `Quels restaurants compte l'hôtel ?`,
      ctx.diningFr,
      `Which restaurants are on site?`,
      ctx.diningEn,
    ),
    item(
      'Restauration',
      'during',
      `Faut-il réserver les tables à l'avance ?`,
      `Pour les tables signature et le week-end, réservez dès la confirmation de séjour — la conciergerie transmet la demande.`,
      `Should I book restaurant tables in advance?`,
      `For signature tables and weekends, book when confirming your stay — the concierge forwards the request.`,
    ),
    item(
      'Restauration',
      'during',
      `Proposez-vous un petit-déjeuner ?`,
      `Petit-déjeuner en chambre ou en salle selon les horaires de l'établissement — précisez allergies et horaire souhaité.`,
      `Is breakfast served?`,
      `Breakfast in-room or in the dining room per hotel hours — note allergies and preferred time.`,
    ),
    item(
      'Spa & Bien-être',
      'during',
      `L'hôtel dispose-t-il d'un spa ?`,
      ctx.spaFr,
      `Does the hotel have a spa?`,
      ctx.spaEn,
    ),
    item(
      'Spa & Bien-être',
      'during',
      `Faut-il réserver les soins à l'avance ?`,
      `Les créneaux spa se confirment sur réservation — contactez la conciergerie bien-être 24 à 48 h avant.`,
      `Should spa treatments be booked ahead?`,
      `Spa slots are confirmed on reservation — contact the wellness concierge 24–48 hours ahead.`,
    ),
    item(
      'Spa & Bien-être',
      'during',
      `Y a-t-il une salle de fitness ?`,
      `Espace fitness accessible aux horaires affichés ; équipements cardio et musculation disponibles.`,
      `Is there a fitness room?`,
      `Fitness space open during posted hours; cardio and strength equipment available.`,
    ),
    item(
      'Activités & Loisirs',
      'during',
      `Quelles expériences propose la conciergerie ?`,
      `Visites privées, accès coulisses, partenaires locaux et activités saisonnières — le programme est affiné à l'arrivée.`,
      `What experiences does the concierge arrange?`,
      `Private tours, behind-the-scenes access, local partners and seasonal activities — refined on arrival.`,
    ),
    item(
      'Activités & Loisirs',
      'during',
      `Organisez-vous des visites culturelles ?`,
      `La conciergerie réserve musées, galeries et monuments avec créneaux matinaux hors affluence quand c'est possible.`,
      `Do you arrange cultural visits?`,
      `The concierge books museums, galleries and monuments with off-peak morning slots when possible.`,
    ),
    item(
      'Activités & Loisirs',
      'during',
      `Peut-on louer un véhicule avec chauffeur ?`,
      `Chauffeur ou VTC sur demande — précisez horaires, bagages et nombre de passagers.`,
      `Can I hire a chauffeur-driven car?`,
      `Chauffeur or private car on request — share schedule, luggage and party size.`,
    ),
    item(
      'Famille & Enfants',
      'during',
      `L'hôtel convient-il aux familles ?`,
      `Lits bébé, menus enfant et services adaptés sur demande — indiquez l'âge des enfants à la réservation.`,
      `Is the hotel family-friendly?`,
      `Cribs, children's menus and tailored services on request — note children's ages when booking.`,
    ),
    item(
      'Famille & Enfants',
      'during',
      `Proposez-vous des lits bébé ?`,
      `Lit bébé et chauffe-biberon disponibles sans frais selon stock — à demander avant l'arrivée.`,
      `Are cribs available?`,
      `Crib and bottle warmer available at no extra charge subject to stock — request before arrival.`,
    ),
    item(
      'Famille & Enfants',
      'during',
      `Y a-t-il une piscine adaptée aux enfants ?`,
      `Accès piscine selon règlement de l'établissement ; la conciergerie précise horaires et accompagnement requis.`,
      `Is the pool suitable for children?`,
      `Pool access per house rules; the concierge clarifies hours and supervision requirements.`,
    ),
    item(
      'Animaux',
      'during',
      `Les animaux sont-ils acceptés ?`,
      ctx.petsNoteFr,
      `Are pets allowed?`,
      ctx.petsNoteEn,
    ),
    item(
      'Animaux',
      'during',
      `Y a-t-il des frais pour les animaux ?`,
      ctx.petsNoteFr,
      `Are there pet fees?`,
      ctx.petsNoteEn,
    ),
    item(
      'Accessibilité',
      'during',
      `L'hôtel est-il accessible PMR ?`,
      `Chambres et accès adaptés sur demande — contactez la conciergerie avant l'arrivée pour préparer le parcours.`,
      `Is the hotel accessible for reduced mobility?`,
      `Accessible rooms and routes on request — contact the concierge before arrival to prepare the path.`,
    ),
    item(
      'Accessibilité',
      'during',
      `Des chambres communicantes existent-elles ?`,
      `Communicantes selon disponibilité — indiquez la composition du groupe à la réservation.`,
      `Are connecting rooms available?`,
      `Connecting rooms subject to availability — share party composition when booking.`,
    ),
    item(
      'Facturation & Politiques',
      'agency',
      `Quelle est la politique d'annulation ?`,
      `Les conditions dépendent du tarif réservé — la conciergerie communique la politique exacte avant confirmation.`,
      `What is the cancellation policy?`,
      `Terms depend on the rate booked — the concierge shares the exact policy before confirmation.`,
    ),
    item(
      'Facturation & Politiques',
      'agency',
      `Les prix affichés incluent-ils les taxes ?`,
      `Les tarifs s'entendent TTC pour la clientèle française ; le détail est confirmé sur le devis.`,
      `Do displayed prices include taxes?`,
      `Rates are quoted VAT-inclusive for French guests; details are confirmed on the quote.`,
    ),
    item(
      'Facturation & Politiques',
      'agency',
      `Acceptez-vous les paiements par carte ?`,
      `Cartes bancaires majeures acceptées ; la conciergerie précise les garanties selon le type de séjour.`,
      `Do you accept card payments?`,
      `Major credit cards accepted; the concierge clarifies guarantees per stay type.`,
    ),
    item(
      'Durabilité',
      'agency',
      `Quelles démarches durables menez-vous ?`,
      `Gestion responsable des ressources, partenariats locaux et réduction du plastique à usage unique — détail sur demande.`,
      `What sustainability measures do you take?`,
      `Responsible resource management, local partnerships and reduced single-use plastic — details on request.`,
    ),
    item(
      'Durabilité',
      'agency',
      `Provenance des produits alimentaires ?`,
      `Cuisine et bars privilégient producteurs locaux et de saison — carte alignée sur l'origine des produits.`,
      `Where do food products come from?`,
      `Kitchens and bars favour local, seasonal producers — menus reflect product origin.`,
    ),
    item(
      'Durabilité',
      'agency',
      `Réduisez-vous le linge à usage unique ?`,
      `Programme de renouvellement du linge sur demande pour limiter les lavages inutiles.`,
      `Do you reduce single-use linens?`,
      `Linen refresh on request to limit unnecessary laundry.`,
    ),
    item(
      'Chambres & Équipements',
      'during',
      `Y a-t-il un coffre-fort en chambre ?`,
      `Coffre-fort individuel dans chaque chambre ; format adapté aux ordinateurs portables selon catégorie.`,
      `Is there an in-room safe?`,
      `Individual in-room safe; laptop-sized in selected categories.`,
    ),
    item(
      'Services inclus',
      'during',
      `Proposez-vous une borne de recharge pour véhicule électrique ?`,
      `Recharge véhicule électrique via partenaires ou bornes à proximité — la conciergerie oriente selon le modèle.`,
      `Is EV charging available?`,
      `EV charging via partners or nearby stations — the concierge guides based on your vehicle.`,
    ),
    item(
      'Restauration',
      'during',
      `Des options végétariennes sont-elles disponibles ?`,
      `Menus végétariens et adaptations possibles — signalez vos restrictions à la réservation des tables.`,
      `Are vegetarian options available?`,
      `Vegetarian menus and adaptations possible — note restrictions when booking tables.`,
    ),
    item(
      'Spa & Bien-être',
      'during',
      `Le spa est-il ouvert aux non-résidents ?`,
      `Accès spa réservé aux clients de l'hôtel et sur rendez-vous — la conciergerie confirme les créneaux.`,
      `Is the spa open to non-guests?`,
      `Spa access for hotel guests by appointment — the concierge confirms slots.`,
    ),
    item(
      'Activités & Loisirs',
      'during',
      `Peut-on organiser un dîner privé ?`,
      `Salons et suites peuvent accueillir dîners privés selon capacité — la conciergerie chiffre menu et service.`,
      `Can a private dinner be arranged?`,
      `Salons and suites can host private dinners subject to capacity — the concierge quotes menu and service.`,
    ),
    item(
      'Localisation & Accès',
      'before',
      `Quels monuments sont accessibles à pied ?`,
      `Points d'intérêt majeurs de ${ctx.city} accessibles à pied ou en courte voiture — itinéraire personnalisé à l'arrivée.`,
      `Which landmarks are within walking distance?`,
      `Major ${ctx.city} sights are walkable or a short drive — personalised route on arrival.`,
    ),
    item(
      'Facturation & Politiques',
      'agency',
      `Proposez-vous des tarifs long séjour ?`,
      `Séjours prolongés sur devis — la conciergerie transmet une proposition adaptée à la durée et à la chambre.`,
      `Are long-stay rates available?`,
      `Extended stays on quote — the concierge shares a proposal matched to duration and room.`,
    ),
  ];
}

const WAVE_FAQ_CONTEXT: Readonly<Record<KitWaveSlug, HotelFaqContext>> = {
  'cheval-blanc-paris': {
    name: 'Cheval Blanc Paris',
    city: 'Paris',
    checkIn: '15h00',
    checkOut: '12h00',
    petsNoteFr:
      "Animaux acceptés selon conditions de la maison — prévenir la conciergerie avant l'arrivée.",
    petsNoteEn: 'Pets welcome per house rules — notify the concierge before arrival.',
    diningFr:
      'Plénitude (3⭐), Hakuba (2⭐), Le Tout-Paris (1⭐), Langosteria, Le Jardin et leurs bars — chaque adresse est distincte.',
    diningEn:
      'Plénitude (3 Stars), Hakuba (2 Stars), Le Tout-Paris (1 Star), Langosteria, Le Jardin and their bars — each outlet is separate.',
    spaFr:
      'Dior Spa Cheval Blanc : soins Dior, piscine mosaïque à débordement et fitness au cœur de la Samaritaine.',
    spaEn:
      'Dior Spa Cheval Blanc: Dior treatments, mosaic infinity pool and fitness in the Samaritaine.',
    locationFr:
      '8 quai du Louvre, 75001 Paris — face au Pont Neuf et au Louvre, dans la Samaritaine historique.',
    locationEn:
      '8 Quai du Louvre, 75001 Paris — facing Pont Neuf and the Louvre in the historic Samaritaine.',
    pickFr:
      "La Junior Suite Seine — jardin d'hiver et vue sur le fleuve ; le pick du Concierge pour un séjour romantique.",
    pickEn:
      'The Seine Junior Suite — winter garden and river view; the Concierge pick for a romantic stay.',
  },
  'le-bristol-paris': {
    name: 'Hôtel Le Bristol Paris',
    city: 'Paris',
    checkIn: '15h00',
    checkOut: '12h00',
    petsNoteFr: "Chiens et chats acceptés moyennant 70 € par séjour — prévenir avant l'arrivée.",
    petsNoteEn: 'Dogs and cats welcome for €70 per stay — notify before arrival.',
    diningFr:
      'Le Bristol Restaurant (3⭐), Epicure (3⭐), 114 Faubourg (1⭐) et le Bar du Bristol.',
    diningEn:
      'Le Bristol Restaurant (3 Stars), Epicure (3 Stars), 114 Faubourg (1 Star) and Bar du Bristol.',
    spaFr: 'Spa Le Bristol by La Prairie : soins suisses, piscine intérieure et rooftop vue Paris.',
    spaEn: 'Spa Le Bristol by La Prairie: Swiss treatments, indoor pool and Paris-view rooftop.',
    locationFr:
      "112 rue du Faubourg Saint-Honoré, 75008 Paris — Triangle d'Or, jardin de 1 200 m².",
    locationEn:
      '112 Rue du Faubourg Saint-Honoré, 75008 Paris — Golden Triangle, 1,200 sq m garden.',
    pickFr: 'La Suite Eden — double orientation et salon séparé ; le pick du Concierge au Bristol.',
    pickEn: 'Suite Eden — dual aspect and separate living room; the Concierge pick at Le Bristol.',
  },
  'les-airelles-courchevel': {
    name: 'Les Airelles Courchevel',
    city: 'Courchevel 1850',
    checkIn: '15h00',
    checkOut: '12h00',
    petsNoteFr:
      'Animaux non acceptés en chambre — la conciergerie oriente vers des pensions partenaires.',
    petsNoteEn: 'Pets not allowed in rooms — the concierge directs to partner kennels.',
    diningFr:
      'La Table des Airelles, Le Restaurant de Pierre Gagnaire, Le Bar du Airelles et La Laiterie.',
    diningEn:
      'La Table des Airelles, Le Restaurant de Pierre Gagnaire, Le Bar du Airelles and La Laiterie.',
    spaFr: 'Spa Nuxe avec piscine intérieure, hammam et soins alpine — rendez-vous recommandé.',
    spaEn: 'Nuxe Spa with indoor pool, hammam and alpine treatments — booking recommended.',
    locationFr: 'Le Jardin Alpin, 73120 Courchevel — ski-in / ski-out aux 3 Vallées.',
    locationEn: 'Le Jardin Alpin, 73120 Courchevel — ski-in / ski-out on the Three Valleys.',
    pickFr: 'La Suite sur pistes — accès direct aux pistes et cheminée ; le pick du Concierge.',
    pickEn: 'Slope-side Suite — direct slope access and fireplace; the Concierge pick.',
  },
  'les-pres-deugenie': {
    name: "Les Prés d'Eugénie",
    city: 'Eugénie-les-Bains',
    checkIn: '15h00',
    checkOut: '12h00',
    petsNoteFr: 'Animaux acceptés sur demande — prévenir la conciergerie pour une chambre adaptée.',
    petsNoteEn: 'Pets welcome on request — notify the concierge for a suitable room.',
    diningFr: "Les Prés d'Eugénie (3⭐ Michel Guérard), La Ferme aux Grives et La Cuisine d'Amour.",
    diningEn:
      "Les Prés d'Eugénie (3 Stars Michel Guérard), La Ferme aux Grives and La Cuisine d'Amour.",
    spaFr: 'Sources thermales Eugénie : bains, soins et parcours bien-être aux sources naturelles.',
    spaEn: 'Eugénie thermal springs: baths, treatments and wellness circuits at natural springs.',
    locationFr:
      "Place de l'Impératrice Eugénie, 40320 Eugénie-les-Bains — Landes, entre Bordeaux et Toulouse.",
    locationEn:
      "Place de l'Impératrice Eugénie, 40320 Eugénie-les-Bains — Landes, between Bordeaux and Toulouse.",
    pickFr: 'La Terrace Room with Onzen — bain Onzen privatif en terrasse ; le pick du Concierge.',
    pickEn: 'Terrace Room with Onzen — private Onzen bath on the terrace; the Concierge pick.',
  },
  'shangri-la-paris': {
    name: 'Shangri-La Paris',
    city: 'Paris',
    checkIn: '15h00',
    checkOut: '12h00',
    petsNoteFr: "Un animal jusqu'à 10 kg accepté sans supplément — signaler avant l'arrivée.",
    petsNoteEn: 'One pet up to 10 kg welcome at no extra charge — notify before arrival.',
    diningFr: "Shang Palace (1⭐), La Bauhinia, Le Bar Botaniste et L'Orangerie.",
    diningEn: "Shang Palace (1 Star), La Bauhinia, Le Bar Botaniste and L'Orangerie.",
    spaFr: "CHI, The Spa : rituels asiatiques, piscine de 17 m et fitness avenue d'Iéna.",
    spaEn: "CHI, The Spa: Asian rituals, 17-metre pool and fitness on Avenue d'Iéna.",
    locationFr:
      "10 avenue d'Iéna, 75116 Paris — ancien palais de Roland Bonaparte, vue Tour Eiffel.",
    locationEn:
      "10 Avenue d'Iéna, 75116 Paris — former Roland Bonaparte palace, Eiffel Tower views.",
    pickFr:
      'La Terrace Eiffel View Room — terrasse privée et vue Tour Eiffel ; le pick du Concierge.',
    pickEn: 'Terrace Eiffel View Room — private terrace and Eiffel Tower view; the Concierge pick.',
  },
};

function parisAirportAnswers(): Pick<CanonicalPromoteAnswers, 'airport' | 'transfers'> {
  return {
    airport: {
      fr: "Orly (ORY) est le plus proche — environ quinze kilomètres. Charles-de-Gaulle (CDG) reste le hub long-courrier, à une quarantaine de kilomètres selon l'itinéraire. Comptez quarante-cinq à soixante-quinze minutes en voiture selon l'heure.",
      en: 'Orly (ORY) is closest — roughly fifteen kilometres. Charles-de-Gaulle (CDG) remains the main long-haul hub, about forty kilometres depending on route. Allow forty-five to seventy-five minutes by car depending on time of day.',
    },
    transfers: {
      fr: "Pas de navette régulière depuis les aéroports. La conciergerie réserve limousine, VTC ou transfert privé sur devis — à commander vingt-quatre à quarante-huit heures avant l'arrivée quand c'est possible, avec suivi de vol.",
      en: 'There is no scheduled airport shuttle. The concierge books limousine, chauffeur or private transfer on quote — order twenty-four to forty-eight hours ahead when possible, with flight tracking.',
      featured: true,
      tipFr:
        'Mon conseil : transmettez le numéro de vol dès la confirmation — la conciergerie aligne l’heure d’accueil voiturier sur l’atterrissage réel.',
      tipEn:
        'My tip: share the flight number when you confirm — the concierge aligns valet greeting with actual landing time.',
    },
  };
}

function parisTaxesCancellation(): Pick<CanonicalPromoteAnswers, 'cancellation' | 'taxes'> {
  return {
    cancellation: {
      fr: "La politique dépend du tarif et du canal de réservation. Les tarifs flexibles permettent une annulation sans frais jusqu'à vingt-quatre ou quarante-huit heures avant l'arrivée ; les tarifs prépayés sont non remboursables. La conciergerie communique les conditions exactes avant confirmation.",
      en: 'Policy depends on rate and booking channel. Flexible rates allow free cancellation until twenty-four or forty-eight hours before arrival; prepaid rates are non-refundable. The concierge states exact terms before confirmation.',
    },
    taxes: {
      fr: "La taxe de séjour parisienne s'applique par nuit et par personne majeure, collectée à l'enregistrement en plus du tarif chambre. Le montant suit le barème municipal en vigueur pour les hôtels cinq étoiles de la capitale.",
      en: 'The Paris tourist tax applies per night per adult, collected at check-in in addition to the room rate. The amount follows the current municipal schedule for five-star hotels in the capital.',
    },
  };
}

function canonicalAnswersForSlug(slug: KitWaveSlug, ctx: HotelFaqContext): CanonicalPromoteAnswers {
  const parisBase = { ...parisAirportAnswers(), ...parisTaxesCancellation() };
  const wifi = {
    fr: "Le Wi‑Fi haut débit est inclus dans tout l'établissement : chambres, suites, lobby et espaces de restauration. Les identifiants sont remis à l'enregistrement ; aucun surcoût pour plusieurs appareils en chambre.",
    en: 'High-speed Wi‑Fi is included property-wide: rooms, suites, lobby and dining areas. Credentials are issued at check-in; no extra charge for multiple devices in the room.',
  };
  const earlyCheckin = {
    fr: "Un early check-in est possible selon la disponibilité de la nuit précédente, souvent à partir de midi. Signalez votre heure d'arrivée quarante-huit heures à l'avance : la demande est enregistrée et confirmée le jour J. Sinon, la consigne à bagages reste gratuite.",
    en: 'Early check-in is possible subject to the previous night’s availability, often from noon. Share your arrival time forty-eight hours ahead: the request is logged and confirmed on the day. Otherwise, complimentary luggage storage is available.',
    featured: true,
    tipFr:
      'Mon conseil : prévenez la conciergerie dès la confirmation — une chambre libérée tôt peut être bloquée pour votre catégorie.',
    tipEn:
      'My tip: alert the concierge when you confirm — an early-released room can be held for your category.',
  };

  switch (slug) {
    case 'cheval-blanc-paris':
      return {
        parking: {
          fr: "Voiturier sur le quai du Louvre et parkings partenaires en rive droite — tarifs selon durée et occupation. Confirmez à la réservation pour accélérer l'accueil à l'arrivée, surtout en période de salon.",
          en: 'Valet on Quai du Louvre and partner car parks on the Right Bank — rates vary with length of stay and occupancy. Confirm when booking to speed up arrival, especially during trade fairs.',
          featured: true,
          tipFr:
            'Mon conseil : demandez le voiturier dès la confirmation — la place est réservée et l’enregistrement se fait à la descente de voiture.',
          tipEn:
            'My tip: request valet when you confirm — the space is held and check-in happens as you step out.',
        },
        breakfast: {
          fr: "Petit-déjeuner à la carte au Jardin, en chambre ou au Tout-Paris selon horaires — viennoiseries, options salées et jus pressés. Un supplément s'applique selon le tarif réservé ; précisez allergies et horaire souhaité.",
          en: 'À la carte breakfast at Le Jardin, in-room or at Le Tout-Paris per hours — pastries, savoury options and pressed juices. A supplement applies depending on your rate; note allergies and preferred time.',
          featured: true,
        },
        wifi,
        pets: { fr: ctx.petsNoteFr, en: ctx.petsNoteEn, featured: true },
        ...parisBase,
        pool: {
          fr: 'Dior Spa Cheval Blanc intègre une piscine mosaïque à débordement réservée aux clients sur rendez-vous bien-être — accès coordonné avec les soins ou le fitness.',
          en: 'Dior Spa Cheval Blanc includes a mosaic infinity pool for guests by wellness appointment — access coordinated with treatments or fitness.',
        },
        early_checkin: earlyCheckin,
      };
    case 'le-bristol-paris':
      return {
        parking: {
          fr: "Voiturier rue du Faubourg Saint-Honoré et parkings partenaires du Triangle d'Or — places limitées, tarifs selon durée. Prévenez la conciergerie à l'avance en période de Fashion Week ou de salon.",
          en: 'Valet on Rue du Faubourg Saint-Honoré and Golden Triangle partner car parks — limited spaces, rates by duration. Alert the concierge in advance during Fashion Week or trade fairs.',
          featured: true,
        },
        breakfast: {
          fr: 'Petit-déjeuner au 114 Faubourg, Epicure ou en chambre — buffet et carte, pâtisseries maison et options salées. Supplément selon tarif ; la terrasse du jardin ouvre aux beaux jours dès 7h30.',
          en: 'Breakfast at 114 Faubourg, Epicure or in-room — buffet and à la carte, house pastries and savoury options. Supplement per rate; the garden terrace opens from 7:30 a.m. on fine days.',
          featured: true,
        },
        wifi,
        pets: { fr: ctx.petsNoteFr, en: ctx.petsNoteEn, featured: true },
        ...parisBase,
        pool: {
          fr: 'Piscine couverte chauffée au cœur du palace, avec ponton en acajou et vue sur le jardin — accès réservé aux clients, horaires affichés à la réception.',
          en: 'Heated indoor pool at the heart of the palace, with mahogany deck and garden view — guest access only, hours posted at reception.',
        },
        early_checkin: earlyCheckin,
      };
    case 'les-airelles-courchevel':
      return {
        parking: {
          fr: "Parking couvert et voiturier au Jardin Alpin — indispensable en haute saison. Réservez à l'avance pour un emplacement proche de l'entrée ski-in / ski-out.",
          en: 'Covered parking and valet at Le Jardin Alpin — essential in peak season. Book ahead for a space close to the ski-in / ski-out entrance.',
          featured: true,
        },
        breakfast: {
          fr: 'Petit-déjeuner buffet et à la carte à La Laiterie et La Table des Airelles — produits montagnards, viennoiseries et jus frais. Horaires adaptés aux départs piste ; room-service possible sur demande.',
          en: 'Buffet and à la carte breakfast at La Laiterie and La Table des Airelles — mountain produce, pastries and fresh juices. Hours suit slope departures; room service on request.',
          featured: true,
        },
        wifi,
        pets: { fr: ctx.petsNoteFr, en: ctx.petsNoteEn },
        airport: {
          fr: "L'aéroport de Genève (GVA) est le plus pratique — environ cent trente kilomètres, une heure trente à deux heures en transfert privé selon la météo. Chambéry et Lyon restent des alternatives ; la conciergerie chiffre chaque option.",
          en: 'Geneva Airport (GVA) is most practical — about one hundred thirty kilometres, ninety minutes to two hours by private transfer depending on weather. Chambéry and Lyon are alternatives; the concierge quotes each option.',
        },
        pool: {
          fr: 'Piscine intérieure chauffée au Spa Nuxe, avec hammam et espace détente — accès sur rendez-vous ou selon créneaux affichés, réservation recommandée en semaine de ski.',
          en: 'Heated indoor pool at Nuxe Spa, with hammam and relaxation lounge — access by appointment or posted slots, booking recommended during ski week.',
        },
        early_checkin: earlyCheckin,
        transfers: {
          fr: "Transferts privés depuis Genève, Chambéry ou Lyon sur réservation — véhicule adapté aux skis et bagages. Commandez quarante-huit heures à l'avance avec l'heure d'atterrissage pour chaînes ou pneus neige si besoin.",
          en: 'Private transfers from Geneva, Chambéry or Lyon on reservation — vehicle suited to skis and luggage. Order forty-eight hours ahead with landing time for chains or snow tyres if needed.',
          featured: true,
        },
        cancellation: parisTaxesCancellation().cancellation,
        taxes: {
          fr: "La taxe de séjour s'applique par nuit et par adulte selon le barème communal de Courchevel, collectée à l'enregistrement en sus du tarif chambre.",
          en: 'The tourist tax applies per night per adult per Courchevel municipal schedule, collected at check-in in addition to the room rate.',
        },
      };
    case 'les-pres-deugenie':
      return {
        parking: {
          fr: "Parking gratuit sur le domaine des Prés d'Eugénie — voiturier à l'arrivée pour les suites et villas. Places couvertes limitées : prévenir la conciergerie pour un emplacement proche du spa thermal.",
          en: "Complimentary parking on the Les Prés d'Eugénie estate — valet on arrival for suites and villas. Covered spaces are limited: notify the concierge for a spot near the thermal spa.",
          featured: true,
        },
        breakfast: {
          fr: "Petit-déjeuner gastronomique à La Cuisine d'Amour ou en terrasse — produits des Landes, confitures maison et options bien-être. Horaires de 7h30 à 10h30 ; room-service sur demande la veille.",
          en: "Gastronomic breakfast at La Cuisine d'Amour or on the terrace — Landes produce, house jams and wellness options. Served 7:30–10:30 a.m.; room service on request the day before.",
          featured: true,
        },
        wifi,
        pets: { fr: ctx.petsNoteFr, en: ctx.petsNoteEn, featured: true },
        airport: {
          fr: 'Pau-Pyrénées (PUF) est le plus proche — environ quarante-cinq kilomètres, quarante-cinq minutes en voiture. Bordeaux et Toulouse restent accessibles en une heure trente à deux heures ; transfert privé sur devis.',
          en: 'Pau-Pyrénées (PUF) is closest — about forty-five kilometres, forty-five minutes by car. Bordeaux and Toulouse are reachable in ninety minutes to two hours; private transfer on quote.',
        },
        pool: {
          fr: "Pas de piscine classique : les bains thermaux Eugénie et les parcours d'eau chauffée composent l'offre aquatique — accès selon forfait spa et créneaux réservés.",
          en: 'No conventional pool: Eugénie thermal baths and heated water circuits form the aquatic offer — access per spa package and booked slots.',
        },
        early_checkin: earlyCheckin,
        transfers: {
          fr: 'Transferts depuis Pau, Bordeaux ou Toulouse sur réservation — la conciergerie coordonne VTC ou limousine selon horaire TGV ou vol. Préavis de quarante-huit heures recommandé.',
          en: 'Transfers from Pau, Bordeaux or Toulouse on reservation — the concierge coordinates chauffeur or limousine per train or flight schedule. Forty-eight hours’ notice recommended.',
          featured: true,
        },
        cancellation: {
          fr: "Conditions selon tarif et saison thermale — annulation flexible jusqu'à sept jours avant l'arrivée sur les offres publiques ; forfaits cure et séjours gastronomiques peuvent être non remboursables. La conciergerie précise avant confirmation.",
          en: 'Terms depend on rate and thermal season — flexible cancellation up to seven days before arrival on public offers; cure packages and gastronomic stays may be non-refundable. The concierge clarifies before confirmation.',
        },
        taxes: {
          fr: "Taxe de séjour communale d'Eugénie-les-Bains collectée à l'enregistrement, en sus du tarif chambre, selon le barème en vigueur.",
          en: 'Eugénie-les-Bains municipal tourist tax collected at check-in, in addition to the room rate, per current schedule.',
        },
      };
    case 'shangri-la-paris':
      return {
        parking: {
          fr: "Voiturier avenue d'Iéna et parkings partenaires du 16e — places limitées vue Tour Eiffel. Confirmez à la réservation pour un accueil coordonné à l'arrivée.",
          en: 'Valet on Avenue d’Iéna and 16th-arrondissement partner car parks — limited spaces with Eiffel Tower views. Confirm when booking for coordinated arrival.',
          featured: true,
        },
        breakfast: {
          fr: 'Petit-déjeuner sous la verrière de La Bauhinia ou en chambre — buffet international, dim sum le week-end et options asiatiques. Supplément selon tarif ; réservez la verrière la veille aux beaux jours.',
          en: 'Breakfast under La Bauhinia’s cupola or in-room — international buffet, dim sum at weekends and Asian options. Supplement per rate; book the cupola the day before on fine days.',
          featured: true,
        },
        wifi,
        pets: { fr: ctx.petsNoteFr, en: ctx.petsNoteEn, featured: true },
        ...parisBase,
        pool: {
          fr: 'Piscine intérieure de 17 m au CHI, The Spa, avec rituels asiatiques — accès clients sur rendez-vous ou créneaux affichés, enfants accompagnés selon règlement.',
          en: 'Seventeen-metre indoor pool at CHI, The Spa, with Asian rituals — guest access by appointment or posted slots, children supervised per house rules.',
        },
        early_checkin: earlyCheckin,
      };
    default: {
      const _exhaustive: never = slug;
      return _exhaustive;
    }
  }
}

const WAVE_PROMOTE_EXTRAS: Readonly<Record<KitWaveSlug, readonly PromoteFaqItem[]>> = {
  'cheval-blanc-paris': [
    {
      category: 'during',
      group_fr: 'Restauration',
      group_en: 'Dining',
      question_fr: 'Comment réserver une table chez Plénitude ?',
      question_en: 'How do I book a table at Plénitude?',
      answer_fr:
        "Plénitude (3 étoiles MICHELIN) se réserve des semaines à l'avance. La conciergerie transmet la demande avec date, nombre de couverts et restrictions alimentaires — liste d'attente possible en haute saison.",
      answer_en:
        'Plénitude (3 MICHELIN Stars) books weeks ahead. The concierge forwards the request with date, party size and dietary restrictions — waitlist possible in peak season.',
    },
    {
      category: 'during',
      group_fr: 'Chambres & Équipements',
      group_en: 'Rooms & Amenities',
      question_fr: 'Quelle chambre le Concierge recommande-t-il ?',
      question_en: 'Which room does the Concierge recommend?',
      answer_fr:
        "La Junior Suite Seine — jardin d'hiver et vue sur le fleuve ; le pick du Concierge pour un séjour romantique face au Pont Neuf.",
      answer_en:
        'The Seine Junior Suite — winter garden and river view; the Concierge pick for a romantic stay facing Pont Neuf.',
    },
    {
      category: 'before',
      group_fr: 'Adresse',
      group_en: 'Address',
      question_fr: "Quelle est l'adresse exacte du Cheval Blanc Paris ?",
      question_en: 'What is the exact address of Cheval Blanc Paris?',
      answer_fr:
        '8 quai du Louvre, 75001 Paris — dans la Samaritaine historique, face au Pont Neuf. Le voiturier accueille les arrivées côté quai.',
      answer_en:
        '8 Quai du Louvre, 75001 Paris — in the historic Samaritaine, facing Pont Neuf. Valet greets arrivals on the quay side.',
    },
    {
      category: 'during',
      group_fr: 'Spa & Bien-être',
      group_en: 'Spa & Wellness',
      question_fr: 'Comment réserver un soin au Dior Spa ?',
      question_en: 'How do I book a treatment at Dior Spa?',
      answer_fr:
        "Les soins Dior se réservent vingt-quatre à quarante-huit heures à l'avance — la conciergerie bien-être transmet le créneau et la carte des rituels.",
      answer_en:
        'Dior treatments are booked twenty-four to forty-eight hours ahead — the wellness concierge forwards the slot and ritual menu.',
    },
    {
      category: 'before',
      group_fr: 'Localisation & Accès',
      group_en: 'Location & Access',
      question_fr: "L'hôtel est-il accessible en métro ?",
      question_en: 'Is the hotel accessible by metro?',
      answer_fr:
        'Station Pont Neuf (ligne 7) et Louvre-Rivoli (ligne 1) à quelques minutes à pied — accès direct au Louvre, Opéra et rive gauche.',
      answer_en:
        'Pont Neuf (Line 7) and Louvre-Rivoli (Line 1) are a few minutes’ walk — direct access to the Louvre, Opéra and Left Bank.',
    },
  ],
  'le-bristol-paris': [
    {
      category: 'during',
      group_fr: 'Restauration',
      group_en: 'Dining',
      question_fr: 'Comment réserver une table chez Epicure ?',
      question_en: 'How do I book a table at Epicure?',
      answer_fr:
        'Epicure (3 étoiles MICHELIN) exige une réservation anticipée. La conciergerie transmet date, nombre de couverts et préférences — alternative 114 Faubourg si complet.',
      answer_en:
        'Epicure (3 MICHELIN Stars) requires advance booking. The concierge forwards date, party size and preferences — 114 Faubourg as an alternative if full.',
    },
    {
      category: 'during',
      group_fr: 'Chambres & Équipements',
      group_en: 'Rooms & Amenities',
      question_fr: 'Quelle chambre le Concierge recommande-t-il ?',
      question_en: 'Which room does the Concierge recommend?',
      answer_fr:
        'La Suite Eden — double orientation et salon séparé ; le pick du Concierge au Bristol pour un séjour prolongé.',
      answer_en:
        'Suite Eden — dual aspect and separate living room; the Concierge pick at Le Bristol for an extended stay.',
    },
    {
      category: 'before',
      group_fr: 'Adresse',
      group_en: 'Address',
      question_fr: "Quelle est l'adresse exacte du Le Bristol Paris ?",
      question_en: 'What is the exact address of Le Bristol Paris?',
      answer_fr:
        "112 rue du Faubourg Saint-Honoré, 75008 Paris — Triangle d'Or, entrée voiturier côté rue.",
      answer_en:
        '112 Rue du Faubourg Saint-Honoré, 75008 Paris — Golden Triangle, valet entrance on the street side.',
    },
    {
      category: 'during',
      group_fr: 'Événements',
      group_en: 'Events',
      question_fr: 'Le Bristol accueille-t-il des réunions et événements ?',
      question_en: 'Does Le Bristol host meetings and events?',
      answer_fr:
        "Salons modulables jusqu'à deux cents convives selon configuration — la conciergerie événements chiffre plan de salle, catering Epicure ou 114 Faubourg et flux voiturier.",
      answer_en:
        'Modular salons for up to two hundred guests depending on layout — the events concierge quotes floor plan, Epicure or 114 Faubourg catering and valet flow.',
    },
    {
      category: 'before',
      group_fr: 'Localisation & Accès',
      group_en: 'Location & Access',
      question_fr: "L'hôtel est-il accessible en métro ?",
      question_en: 'Is the hotel accessible by metro?',
      answer_fr:
        'Station Saint-Philippe du Roule (ligne 9) à cinq minutes — correspondance vers Champs-Élysées, Opéra et gares.',
      answer_en:
        'Saint-Philippe du Roule (Line 9) five minutes away — connections toward Champs-Élysées, Opéra and stations.',
    },
  ],
  'les-airelles-courchevel': [
    {
      category: 'during',
      group_fr: 'Activités & Loisirs',
      group_en: 'Activities & Leisure',
      question_fr: "L'hôtel est-il ski-in / ski-out ?",
      question_en: 'Is the hotel ski-in / ski-out?',
      answer_fr:
        'Accès direct aux pistes des 3 Vallées depuis le Jardin Alpin — remontées Courchevel 1850 et liaison vers Méribel et Val Thorens. La conciergerie ski affine forfaits et cours.',
      answer_en:
        'Direct slope access to the Three Valleys from Le Jardin Alpin — Courchevel 1850 lifts and links to Méribel and Val Thorens. The ski concierge refines passes and lessons.',
    },
    {
      category: 'during',
      group_fr: 'Chambres & Équipements',
      group_en: 'Rooms & Amenities',
      question_fr: 'Quelle chambre le Concierge recommande-t-il ?',
      question_en: 'Which room does the Concierge recommend?',
      answer_fr:
        'La Suite sur pistes — accès direct aux pistes et cheminée ; le pick du Concierge pour un séjour ski.',
      answer_en:
        'Slope-side Suite — direct slope access and fireplace; the Concierge pick for a ski stay.',
    },
    {
      category: 'during',
      group_fr: 'Restauration',
      group_en: 'Dining',
      question_fr: 'Comment réserver chez Pierre Gagnaire ?',
      question_en: 'How do I book Pierre Gagnaire?',
      answer_fr:
        "Le Restaurant de Pierre Gagnaire se réserve à l'avance en haute saison — la conciergerie transmet la demande avec nombre de couverts et préférences.",
      answer_en:
        'Le Restaurant de Pierre Gagnaire books ahead in peak season — the concierge forwards the request with party size and preferences.',
    },
    {
      category: 'during',
      group_fr: 'Spa & Bien-être',
      group_en: 'Spa & Wellness',
      question_fr: 'Comment réserver un soin au Spa Nuxe ?',
      question_en: 'How do I book a treatment at Nuxe Spa?',
      answer_fr:
        "Soins et créneaux piscine-hammam se réservent vingt-quatre heures à l'avance — la conciergerie bien-être confirme le planning du jour.",
      answer_en:
        'Treatments and pool-hammam slots are booked twenty-four hours ahead — the wellness concierge confirms the day’s schedule.',
    },
    {
      category: 'before',
      group_fr: 'Localisation & Accès',
      group_en: 'Location & Access',
      question_fr: "Peut-on louer du matériel de ski à l'hôtel ?",
      question_en: 'Can ski equipment be rented at the hotel?',
      answer_fr:
        "Partenaires skis et boots à Courchevel 1850 — la conciergerie ski réserve à l'avance tailles et niveau pour éviter la file aux sports d'hiver.",
      answer_en:
        'Ski and boot partners in Courchevel 1850 — the ski concierge books sizes and level ahead to skip rental-shop queues.',
    },
  ],
  'les-pres-deugenie': [
    {
      category: 'during',
      group_fr: 'Spa & Bien-être',
      group_en: 'Spa & Wellness',
      question_fr: 'Comment accéder aux sources thermales ?',
      question_en: 'How do I access the thermal springs?',
      answer_fr:
        'Parcours thermal et bains Eugénie sur réservation — forfaits cure ou à la carte. La conciergerie bien-être compose le planning dès la confirmation de séjour.',
      answer_en:
        'Thermal circuit and Eugénie baths by reservation — cure packages or à la carte. The wellness concierge builds the schedule from stay confirmation.',
    },
    {
      category: 'during',
      group_fr: 'Chambres & Équipements',
      group_en: 'Rooms & Amenities',
      question_fr: 'Quelle chambre le Concierge recommande-t-il ?',
      question_en: 'Which room does the Concierge recommend?',
      answer_fr:
        'La Terrace Room with Onzen — bain Onzen privatif en terrasse ; le pick du Concierge pour un séjour thermal.',
      answer_en:
        'Terrace Room with Onzen — private Onzen bath on the terrace; the Concierge pick for a thermal stay.',
    },
    {
      category: 'during',
      group_fr: 'Restauration',
      group_en: 'Dining',
      question_fr: "Comment réserver au restaurant Les Prés d'Eugénie ?",
      question_en: "How do I book Les Prés d'Eugénie restaurant?",
      answer_fr:
        "La table trois étoiles Michel Guérard se réserve des semaines à l'avance — la conciergerie transmet date, menu dégustation et restrictions.",
      answer_en:
        'Michel Guérard’s three-star table books weeks ahead — the concierge forwards date, tasting menu and restrictions.',
    },
    {
      category: 'during',
      group_fr: 'Activités & Loisirs',
      group_en: 'Activities & Leisure',
      question_fr: 'Proposez-vous des ateliers cuisine ?',
      question_en: 'Do you offer cooking workshops?',
      answer_fr:
        "Ateliers et démonstrations gastronomiques selon le calendrier du domaine — la conciergerie communique les dates et places disponibles à l'arrivée.",
      answer_en:
        'Workshops and gastronomic demonstrations per the estate calendar — the concierge shares dates and available places on arrival.',
    },
    {
      category: 'before',
      group_fr: 'Adresse',
      group_en: 'Address',
      question_fr: "Quelle est l'adresse exacte des Prés d'Eugénie ?",
      question_en: "What is the exact address of Les Prés d'Eugénie?",
      answer_fr:
        "Place de l'Impératrice Eugénie, 40320 Eugénie-les-Bains — domaine thermal au cœur des Landes.",
      answer_en:
        "Place de l'Impératrice Eugénie, 40320 Eugénie-les-Bains — thermal estate in the Landes.",
    },
  ],
  'shangri-la-paris': [
    {
      category: 'during',
      group_fr: 'Restauration',
      group_en: 'Dining',
      question_fr: 'Comment réserver une table au Shang Palace ?',
      question_en: 'How do I book a table at Shang Palace?',
      answer_fr:
        "Shang Palace (1 étoile MICHELIN) se remplit vite le week-end — réservez deux semaines à l'avance ; la conciergerie transmet la demande et confirme sous vingt-quatre heures.",
      answer_en:
        'Shang Palace (1 MICHELIN Star) fills quickly on weekends — book two weeks ahead; the concierge forwards the request and confirms within twenty-four hours.',
    },
    {
      category: 'during',
      group_fr: 'Chambres & Équipements',
      group_en: 'Rooms & Amenities',
      question_fr: 'Quelle chambre le Concierge recommande-t-il ?',
      question_en: 'Which room does the Concierge recommend?',
      answer_fr:
        'La Terrace Eiffel View Room — terrasse privée et vue Tour Eiffel ; le pick du Concierge pour un séjour romantique.',
      answer_en:
        'Terrace Eiffel View Room — private terrace and Eiffel Tower view; the Concierge pick for a romantic stay.',
    },
    {
      category: 'before',
      group_fr: 'Adresse',
      group_en: 'Address',
      question_fr: "Quelle est l'adresse exacte du Shangri-La Paris ?",
      question_en: 'What is the exact address of Shangri-La Paris?',
      answer_fr:
        "10 avenue d'Iéna, 75116 Paris — ancien palais de Roland Bonaparte, voiturier côté avenue.",
      answer_en:
        '10 Avenue d’Iéna, 75116 Paris — former Roland Bonaparte palace, valet on the avenue side.',
    },
    {
      category: 'during',
      group_fr: 'Spa & Bien-être',
      group_en: 'Spa & Wellness',
      question_fr: 'Comment réserver un rituel au CHI Spa ?',
      question_en: 'How do I book a ritual at CHI Spa?',
      answer_fr:
        "Rituels asiatiques et créneaux piscine se réservent vingt-quatre heures à l'avance — la conciergerie bien-être transmet le soin et l'horaire souhaité.",
      answer_en:
        'Asian rituals and pool slots are booked twenty-four hours ahead — the wellness concierge forwards treatment and preferred time.',
    },
    {
      category: 'before',
      group_fr: 'Localisation & Accès',
      group_en: 'Location & Access',
      question_fr: "L'hôtel est-il accessible en métro ?",
      question_en: 'Is the hotel accessible by metro?',
      answer_fr:
        'Station Iéna (ligne 9) à deux minutes — ligne 9 vers Trocadéro, Opéra et Grands Magasins.',
      answer_en:
        'Iéna station (Line 9) two minutes away — Line 9 toward Trocadéro, Opéra and department stores.',
    },
  ],
};

function buildCanonicalPromoteItems(
  ctx: HotelFaqContext,
  answers: CanonicalPromoteAnswers,
): PromoteFaqItem[] {
  return CDC_CANONICAL_FAQ.map((canonical) => {
    const ans = answers[canonical.key as CanonicalAnswerKey];
    const qFr = canonical.question_fr.replaceAll('{{name}}', ctx.name);
    const qEn = canonical.question_en.replaceAll('{{name}}', ctx.name);
    const base: PromoteFaqItem = {
      category: 'before',
      group_fr: canonical.group_fr,
      group_en: canonical.group_en,
      question_fr: qFr,
      question_en: qEn,
      answer_fr: ans.fr,
      answer_en: ans.en,
    };
    if (ans.featured === true) {
      return {
        ...base,
        featured: true,
        ...(typeof ans.tipFr === 'string' && ans.tipFr.length > 0
          ? { concierge_tip_fr: ans.tipFr }
          : {}),
        ...(typeof ans.tipEn === 'string' && ans.tipEn.length > 0
          ? { concierge_tip_en: ans.tipEn }
          : {}),
      };
    }
    return base;
  });
}

export function buildKitWaveFaqKit(slug: KitWaveSlug): readonly FaqItem[] {
  return buildKitItems(WAVE_FAQ_CONTEXT[slug]);
}

export function buildKitWaveFaqPromote(slug: KitWaveSlug): readonly PromoteFaqItem[] {
  const ctx = WAVE_FAQ_CONTEXT[slug];
  const canonical = buildCanonicalPromoteItems(ctx, canonicalAnswersForSlug(slug, ctx));
  const extras = WAVE_PROMOTE_EXTRAS[slug];
  return [...canonical, ...extras];
}
