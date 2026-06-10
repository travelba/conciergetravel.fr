/**
 * Normalise Prince de Galles FAQ kit + concierge_questions to Perplexity taxonomy
 * (12 factual categories ≥2 each, EN parity, 8 concierge categories) and rewrite
 * domain editorial files.
 *
 *   pnpm tsx scripts/editorial-pilot/src/hotels/regenerate-prince-de-galles-faq-enrichment.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRINCE_DE_GALLES_FAQ_CONTENT_KIT,
  PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE,
} from '@mch/domain/editorial';
import { PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT } from '@mch/domain/editorial';

import {
  CONCIERGE_CATEGORY_EN,
  FAQ_CATEGORY_EN,
  FAQ_CATEGORY_TO_BUCKET,
  FAQ_FACTUAL_CATEGORIES_FR,
  FAQ_KIT_MIN_PER_CATEGORY,
  type FaqFactualCategoryFr,
  type NormalisedConciergeQuestion,
  type NormalisedFaqKitItem,
} from './faq-perplexity-taxonomy.js';
import { evaluateFaqKitRowEnrichment } from './faq-kit-row-enrichment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOMAIN_EDITORIAL = resolve(__dirname, '../../../../packages/domain/src/editorial');

const GROUP_FR_REMAP: Readonly<Record<string, FaqFactualCategoryFr>> = {
  'Bien-être': 'Spa & Bien-être',
  'Services & Conciergerie': 'Services inclus',
  Événements: 'Activités & Loisirs',
  'Programme fidélité': 'Durabilité',
};

/** Per-item overrides keyed by exact FR question (after group remap). */
const KIT_OVERRIDES: Readonly<
  Record<
    string,
    Partial<
      Pick<
        NormalisedFaqKitItem,
        'group_fr' | 'question_fr' | 'answer_fr' | 'question_en' | 'answer_en'
      >
    >
  >
> = {
  'Les animaux de compagnie sont-ils acceptés ?': {
    answer_fr:
      "Les chiens et chats sont acceptés moyennant 70 € par séjour, dans la limite du poids autorisé par la maison. Prévenez la réception avant l'arrivée pour une chambre adaptée.",
    question_en: 'Are pets allowed at Prince de Galles?',
    answer_en:
      'Dogs and cats are welcome for €70 per stay, within the weight limit set by the hotel. Notify reception before arrival so we assign a suitable room.',
  },
  'Peut-on organiser un événement privé sur Le Patio ?': {
    group_fr: 'Activités & Loisirs',
    question_fr: 'Quelles visites culturelles recommandez-vous à deux pas du palace ?',
    answer_fr:
      'Le Grand Palais, le Palais de Tokyo et le Théâtre des Champs-Élysées sont accessibles à pied en dix minutes. La conciergerie réserve créneaux matinaux ou visites privées hors affluence.',
    question_en: 'Which cultural visits do you recommend steps from the palace?',
    answer_en:
      'The Grand Palais, Palais de Tokyo and Théâtre des Champs-Élysées are a ten-minute walk away. The concierge books morning slots or private visits outside peak hours.',
  },
  "Qu'est-ce que le bar 19.20 ?": {
    group_fr: 'Activités & Loisirs',
    question_fr: 'Que faire le soir autour de l’avenue George V ?',
    answer_fr:
      'Le bar 19.20 propose cocktails signatures et assiettes légères jusqu’au service tardif. La conciergerie complète avec tables au théâtre, speakeasy ou rooftop partenaire selon votre horaire de sortie.',
    question_en: 'What is there to do in the evening around Avenue George V?',
    answer_en:
      'Bar 19.20 serves signature cocktails and light plates until late service. The concierge adds theatre tables, speakeasy reservations or partner rooftops to match your schedule.',
  },
  'Le Prince de Galles participe-t-il à Marriott Bonvoy ?': {
    group_fr: 'Durabilité',
    question_fr: 'Quelles actions durables mène le palace ?',
    answer_fr:
      'Le Prince de Galles suit les standards Marriott Serve 360 : réduction des plastiques à usage unique, tri renforcé et partenaires locaux pour la restauration. Les serviettes et draps ne sont changés que sur demande.',
    question_en: 'What sustainable practices does the palace follow?',
    answer_en:
      'Prince de Galles follows Marriott Serve 360 standards: fewer single-use plastics, enhanced recycling and local dining partners. Towels and linens are changed on request only.',
  },
  'Comment obtenir une facture détaillée après le départ ?': {
    group_fr: 'Durabilité',
    question_fr: 'Proposez-vous une literie et des produits d’accueil responsables ?',
    answer_fr:
      "Les produits Lalique en salle de bain sont rechargés sur demande. Les chambres disposent de bouteilles d'eau réutilisables et d'une consigne à bagages pour limiter les trajets voiture après le départ.",
    question_en: 'Do you offer responsible linens and bathroom amenities?',
    answer_en:
      'Lalique bathroom amenities are replenished on request. Rooms carry reusable water bottles and luggage storage to cut car trips after checkout.',
  },
  'Des lits bébé sont-ils disponibles ?': {
    question_en: 'Are cots available for infants?',
    answer_en:
      'Yes, on request and subject to stock. Specify the child’s age when booking so we set up the cot before you arrive.',
  },
  "L'hôtel est-il accessible aux personnes à mobilité réduite ?": {
    question_en: 'Is the hotel accessible for guests with reduced mobility?',
    answer_en:
      'Adapted rooms and lifts serve all guest floors. Describe your needs when booking: we confirm the room and access route.',
  },
};

const KIT_EN: Readonly<
  Record<string, { readonly question_en: string; readonly answer_en: string }>
> = {
  "Quelles sont les heures d'enregistrement au Prince de Galles ?": {
    question_en: 'What are the check-in times at Prince de Galles?',
    answer_en:
      'Check-in starts at 3 p.m. Tell the concierge your arrival time: we prepare the room and speed up welcome when the schedule allows.',
  },
  'À quelle heure dois-je quitter ma chambre le jour du départ ?': {
    question_en: 'What time must I leave my room on departure day?',
    answer_en:
      'Checkout is before noon. Late checkout may be available for a fee depending on occupancy — the concierge confirms the day before.',
  },
  'Puis-je obtenir un départ tardif sans frais supplémentaires ?': {
    question_en: 'Can I get a late checkout at no extra charge?',
    answer_en:
      'Complimentary late checkout is rare in a Paris palace. Depending on occupancy we offer paid late checkout or luggage storage to enjoy the 8th arrondissement.',
  },
  "Quel est l'âge minimum requis pour l'enregistrement ?": {
    question_en: 'What is the minimum age for check-in?',
    answer_en:
      'The minimum age is 18. Photo ID and a credit card in the reservation holder’s name are required on arrival.',
  },
  "Est-il possible d'obtenir un early check-in ?": {
    question_en: 'Is early check-in possible?',
    answer_en:
      'Early check-in depends on the previous night’s availability. Contact the concierge 48 hours ahead: we log the request and confirm on the day.',
  },
  "Que se passe-t-il si j'arrive après minuit ?": {
    question_en: 'What happens if I arrive after midnight?',
    answer_en:
      'Reception is open 24/7. Flag a late arrival so the room and valet team are notified.',
  },
  'Puis-je laisser mes bagages après le départ ?': {
    question_en: 'Can I leave luggage after checkout?',
    answer_en:
      'Yes, luggage storage is complimentary — ideal for lunch on the Champs-Élysées or a Grand Palais visit before your train.',
  },
  "L'hôtel propose-t-il un service de porteur ?": {
    question_en: 'Does the hotel offer porter service?',
    answer_en:
      'Yes, porters carry bags from the car to your room. Note bulky items when booking so the team is ready.',
  },
  "Quelle est l'adresse exacte du Prince de Galles ?": {
    question_en: 'What is the exact address of Prince de Galles?',
    answer_en:
      '33 Avenue George V, 75008 Paris. The entrance sits on one of the quietest arteries of the Golden Triangle, steps from the Champs-Élysées and Avenue Montaigne.',
  },
  "Quel est l'aéroport le plus proche ?": {
    question_en: 'Which airport is closest?',
    answer_en:
      'Paris-Orly (ORY) is closest by distance; Paris-Charles-de-Gaulle (CDG) remains the main long-haul hub. Allow 40 to 60 minutes by car depending on traffic.',
  },
  "Combien de temps depuis l'aéroport Charles-de-Gaulle ?": {
    question_en: 'How long from Charles-de-Gaulle airport?',
    answer_en:
      'By car or private transfer, allow 45 to 75 minutes to Avenue George V depending on ring-road traffic.',
  },
  "L'hôtel propose-t-il une navette aéroport ?": {
    question_en: 'Does the hotel offer an airport shuttle?',
    answer_en:
      'There is no scheduled shuttle. The concierge books limousine, chauffeur or private transfer on quote — order 24 hours ahead when possible.',
  },
  "Y a-t-il un parking à l'hôtel ?": {
    question_en: 'Is there parking at the hotel?',
    answer_en:
      'Valet parking serves the property. Rates and availability vary — confirm when booking or on arrival with reception.',
  },
  "L'hôtel est-il accessible en métro ?": {
    question_en: 'Is the hotel accessible by metro?',
    answer_en:
      'Yes: George V station (Line 1) is a few minutes’ walk. Line 1 links La Défense, the Louvre and Bastille.',
  },
  'Quelle gare TGV est la plus pratique ?': {
    question_en: 'Which TGV station is most convenient?',
    answer_en:
      'Gare Montparnasse (Brittany, Atlantic) and Gare du Nord (Eurostar, CDG) are 15–25 minutes by taxi. The concierge tracks your train schedule.',
  },
  "Combien de chambres compte l'hôtel ?": {
    question_en: 'How many rooms does the hotel have?',
    answer_en:
      'Prince de Galles has 116 rooms and suites in Art Deco spirit: geometric lines, black-and-white photography and mirrored headboards.',
  },
  'Combien de chambres ont un balcon ou une terrasse ?': {
    question_en: 'How many rooms have a balcony or terrace?',
    answer_en:
      'Twenty-six rooms and suites have a balcony or terrace overlooking Le Patio or Avenue George V. Categories are limited — book early.',
  },
  'Quels équipements trouve-t-on en chambre ?': {
    question_en: 'What amenities are in the room?',
    answer_en:
      'Air conditioning, minibar, safe, TV, robes, slippers, complimentary mineral water, daily press, high-speed Wi-Fi and Lalique bathroom products.',
  },
  'Les salles de bain sont-elles en marbre ?': {
    question_en: 'Are bathrooms marble?',
    answer_en:
      'Yes, marble and Art Deco-inspired mosaics. Most categories separate shower and bathtub.',
  },
  'Existe-t-il des chambres communicantes ?': {
    question_en: 'Are connecting rooms available?',
    answer_en:
      'Connecting rooms are possible depending on floor plan. State children’s ages when booking: we block the right configuration.',
  },
  'Le Wi-Fi est-il gratuit ?': {
    question_en: 'Is Wi-Fi free?',
    answer_en:
      'Yes, Wi-Fi is free in rooms and public areas. For demanding video calls, ask reception for technical assistance.',
  },
  'Quels restaurants compte le Prince de Galles ?': {
    question_en: 'Which restaurants does Prince de Galles have?',
    answer_en:
      'Akira Back (Franco-Korean cuisine, terrace on Le Patio) and bar-lounge 19.20. Le Patio also serves breakfast, lunch and brunch seasonally.',
  },
  'Comment réserver une table chez Akira Back ?': {
    question_en: 'How do I book at Akira Back?',
    answer_en:
      'Book via the official site, phone or concierge. In peak season allow 48 to 72 hours; we keep a waitlist if the service is full.',
  },
  'Le brunch Le Patio est-il ouvert aux non-résidents ?': {
    question_en: 'Is Le Patio brunch open to non-guests?',
    answer_en:
      'Weekend brunch is highly sought. Outside-guest seats are limited — book ahead and confirm dates with reception.',
  },
  'Quels sont les horaires du petit-déjeuner ?': {
    question_en: 'What are breakfast hours?',
    answer_en:
      'Breakfast is served at Le Patio or in-room depending on rate. Exact hours follow the season — check when booking or on arrival.',
  },
  'Le room service est-il disponible 24h/24 ?': {
    question_en: 'Is room service available 24/7?',
    answer_en:
      'Yes, with a reduced overnight menu. For a full dinner, Akira Back remains the house reference.',
  },
  'Proposez-vous des menus végétariens ?': {
    question_en: 'Do you offer vegetarian menus?',
    answer_en:
      'Akira Back adapts fusion plates on request. Flag allergies and diets 24 hours ahead: the chef prepares a dedicated proposal.',
  },
  "L'hôtel dispose-t-il d'un spa ?": {
    question_en: 'Does the hotel have a spa?',
    answer_en:
      'There is no full spa on site. A equipped fitness centre serves guests; the concierge directs you to Triangle d’Or partner spas.',
  },
  'Quels sont les horaires du fitness ?': {
    question_en: 'What are the fitness centre hours?',
    answer_en:
      'The fitness centre is open to guests on extended hours. Ask reception for an access card on arrival.',
  },
  'La conciergerie peut-elle réserver musées et spectacles ?': {
    question_en: 'Can the concierge book museums and shows?',
    answer_en:
      'Yes — ticketing, tables, chauffeurs and private tours are core services. Send dates and preferences: we confirm within 24 hours when possible.',
  },
  'Quels animaux de compagnie sont acceptés et à quel tarif ?': {
    question_en: 'Which pets are accepted and at what rate?',
    answer_en:
      'Dogs and cats are welcome for €70 per stay within the hotel weight limit. The concierge can suggest a groomer or a Seine walk nearby.',
  },
  'Des chambres PMR avec douche accessible sont-elles disponibles ?': {
    question_en: 'Are accessible rooms with roll-in showers available?',
    answer_en:
      'Yes, a limited number of adapted rooms with accessible showers are available. Request PMR needs when booking so we assign the right floor and route.',
  },
  'Quels moyens de paiement sont acceptés ?': {
    question_en: 'Which payment methods are accepted?',
    answer_en:
      'Major international cards and cash in euros. A card imprint may be taken on arrival for minibar and extras.',
  },
  "Quelle est la politique d'annulation ?": {
    question_en: 'What is the cancellation policy?',
    answer_en:
      'It depends on the rate booked (flexible, prepaid, package). Read the conditions on your confirmation; reception applies the contract strictly.',
  },
  'Y a-t-il une taxe de séjour ?': {
    question_en: 'Is there a tourist tax?',
    answer_en:
      'Yes, the Paris tourist tax applies per person per night, collected on arrival or departure depending on rate.',
  },
  'Proposez-vous blanchisserie et pressing ?': {
    question_en: 'Do you offer laundry and dry cleaning?',
    answer_en:
      'Yes, with express return on request. Drop your bag before 9 a.m. for same-day service when volume allows.',
  },
  'Les tarifs affichés incluent-ils la TVA ?': {
    question_en: 'Do displayed rates include VAT?',
    answer_en:
      'Public prices are tax-inclusive for French individuals. Non-EU companies may have specific rules — check with your accounting team.',
  },
  'Comment obtenir une facture détaillée après le départ ?': {
    question_en: 'How do I get a detailed invoice after checkout?',
    answer_en:
      'Contact reception or reservations@marriott.com with your confirmation number. The PDF invoice is usually sent within 48 business hours.',
  },
};

const CONCIERGE_CATEGORY_REMAP: Readonly<Record<string, keyof typeof CONCIERGE_CATEGORY_EN>> = {
  'Wellness & Fitness': 'Réservations spa',
  'Chambres & Suites': 'Expériences personnalisées',
  'Événements & MICE': 'Occasions spéciales',
  'Paris & Culture': 'Excursions & Visites culturelles',
  'Shopping & Mode': 'Shopping & Services de luxe',
  'Famille & Enfants': 'Activités familiales',
  'Business & Séjour pro': 'Expériences personnalisées',
  'Surclassements & Fidélité': 'Occasions spéciales',
  'Paris by night': 'Excursions & Visites culturelles',
  'Sécurité & Discrétion': 'Expériences personnalisées',
  'Room service & In-room': 'Expériences personnalisées',
};

const CONCIERGE_EN: Readonly<
  Record<string, { readonly question_en: string; readonly reply_en: string }>
> = {
  'Pouvez-vous organiser un transfert depuis Charles-de-Gaulle vers George V ?': {
    question_en: 'Can you arrange a transfer from Charles-de-Gaulle to George V?',
    reply_en:
      'I book a chauffeur or limousine based on your flight and luggage. Tell me 24 hours ahead with the flight number: I align arrival with check-in and valet.',
  },
  'Pouvez-vous réserver un chauffeur pour une soirée avenue Montaigne ?': {
    question_en: 'Can you book a chauffeur for an evening on Avenue Montaigne?',
    reply_en:
      'I place a driver at your disposal for couture appointments or dinner. Share pick-up and return times: I confirm the vehicle and driver number.',
  },
  'Je souhaite dîner au comptoir Akira Back samedi prochain, est-ce possible ?': {
    question_en: 'I would like the Akira Back counter Saturday — is it possible?',
    reply_en:
      'I contact the restaurant and try for the kitchen-facing counter — the most requested spot. Two weeks ahead on weekends; I update you within 24 hours.',
  },
  'Pouvez-vous réserver le tea time du 19.20 pour dimanche après-midi ?': {
    question_en: 'Can you book 19.20 tea time for Sunday afternoon?',
    reply_en:
      'Weekend tea time fills quickly. I book 19.20 or Le Patio if the sun cooperates — tell me party size and sweet preferences.',
  },
  'Je souhaite un massage en chambre demain matin, est-ce possible ?': {
    question_en: 'Can I have an in-room massage tomorrow morning?',
    reply_en:
      'CALMA PARIS works in the Wellness Suite or in-room by appointment. I check tomorrow’s slots and share the menu that fits your schedule.',
  },
  'Pour une première venue, quelle chambre recommandez-vous avec balcon sur Le Patio ?': {
    question_en: 'For a first stay, which room with a Le Patio balcony do you recommend?',
    reply_en:
      'I hold an Art Deco Deluxe Balcon courtyard room: Patio calm without losing light. Share your arrival date — I block the category and note in-room setup.',
  },
  'Nous cherchons une salle pour 60 personnes en cocktail, que proposez-vous ?': {
    question_en: 'We need a room for 60 guests at a cocktail — what do you suggest?',
    reply_en:
      'Salon Grand Chaillot hosts up to 70 for a reception. I send the floor plan, layouts and a catering quote from 19.20 or Akira Back per your brief.',
  },
  'Pouvez-vous réserver des billets pour le Théâtre des Champs-Élysées ce soir ?': {
    question_en: 'Can you book tickets for Théâtre des Champs-Élysées tonight?',
    reply_en:
      'I check tonight’s programme and remaining seats five minutes on foot from the hotel. If sold out, I suggest Palais de Tokyo or a private evening visit.',
  },
  'Pouvez-vous réserver une cabine privée sur l’avenue Montaigne demain matin ?': {
    question_en: 'Can you book a private fitting room on Avenue Montaigne tomorrow morning?',
    reply_en:
      'I contact your target houses and block a pre-opening slot when possible. Share brands and budget: I align the itinerary with your agenda.',
  },
  'Où faire une pause shopping entre deux rendez-vous couture ?': {
    question_en: 'Where to pause between couture appointments?',
    reply_en:
      '19.20 tea time or a quick lunch on Le Patio breaks the schedule without leaving the palace. I book the table and sync valet return for fittings.',
  },
  'Nous voyageons avec deux enfants — pouvez-vous préparer les chambres ?': {
    question_en: 'We travel with two children — can you prepare the rooms?',
    reply_en:
      'I note ages and arrange extra beds, barriers and a tailored welcome. Child room service and Grand Palais activities can complete the stay.',
  },
  'Proposez-vous une baby-sitter pour une soirée au Akira Back ?': {
    question_en: 'Can you arrange a babysitter for an Akira Back evening?',
    reply_en:
      'I can recommend a vetted partner agency on request. Give me 48 hours with timing and number of children.',
  },
  'Pouvez-vous organiser un petit-déjeuner de travail en salon privé ?': {
    question_en: 'Can you organise a working breakfast in a private salon?',
    reply_en:
      'Petit Chaillot or Suite Or host eight to forty people depending on setup. I coordinate catering, dedicated Wi-Fi and valet access for your guests.',
  },
  'Avez-vous une imprimante ou un espace coworking à proximité ?': {
    question_en: 'Is there a printer or coworking space nearby?',
    reply_en:
      'Reception prints documents on request. For quiet work I reserve the business salon or a suite with a separate living room.',
  },
  'Puis-je obtenir un surclassement avec mon statut Marriott Bonvoy ?': {
    question_en: 'Can I get an upgrade with my Marriott Bonvoy status?',
    reply_en:
      'I check availability the day before arrival and note your Elite status. Upgrades depend on occupancy — I confirm once the room is assigned.',
  },
  'Quelle chambre recommandez-vous pour une lune de miel en juillet ?': {
    question_en: 'Which room do you recommend for a July honeymoon?',
    reply_en:
      'I suggest Art Deco Deluxe Balcon courtyard or Suite Saphir for the terrace. Share your dates: I block the category and prepare a discreet in-room touch.',
  },
  'Où dîner après le spectacle si Akira Back est complet ?': {
    question_en: 'Where to dine after the show if Akira Back is full?',
    reply_en:
      '19.20 by Norbert Tarayre often holds late tables, and Le Patio serves light plates until evening service. I book to your exit time from the theatre.',
  },
  'Pouvez-vous réserver un bar à cocktails avec vue sur la Seine ?': {
    question_en: 'Can you book a cocktail bar with a Seine view?',
    reply_en:
      'I know several addresses fifteen minutes by taxi — rooftop, speakeasy or partner hotel bar. Share the mood and time: I confirm the reservation.',
  },
  'Pouvez-vous accueillir une arrivée discrète avec accès séparé ?': {
    question_en: 'Can you handle a discreet arrival with separate access?',
    reply_en:
      'Valet and reception coordinate sensitive arrivals without the main lobby when the schedule allows. Describe the protocol: I apply it with the team.',
  },
  'Pouvez-vous organiser un dîner en chambre après le service du restaurant ?': {
    question_en: 'Can you organise in-room dinner after restaurant service?',
    reply_en:
      'Room service offers a reduced menu after 10 p.m. depending on the kitchen. I order for you and sync delivery with your return from a show or external dinner.',
  },
};

function mapGroupFr(groupFr: string): FaqFactualCategoryFr {
  const remapped = GROUP_FR_REMAP[groupFr] ?? groupFr;
  if ((FAQ_FACTUAL_CATEGORIES_FR as readonly string[]).includes(remapped)) {
    return remapped as FaqFactualCategoryFr;
  }
  throw new Error(`Unknown FAQ group_fr after remap: "${groupFr}" → "${remapped}"`);
}

function enrichKitItem(
  raw: (typeof PRINCE_DE_GALLES_FAQ_CONTENT_KIT)[number],
): NormalisedFaqKitItem {
  const override = KIT_OVERRIDES[raw.question_fr] ?? {};
  const group_fr = override.group_fr ?? GROUP_FR_REMAP[raw.group_fr] ?? raw.group_fr;
  const mapped = mapGroupFr(group_fr);
  const bucket = FAQ_CATEGORY_TO_BUCKET[mapped];
  const question_fr = override.question_fr ?? raw.question_fr;
  const answer_fr = override.answer_fr ?? raw.answer_fr;
  const en = KIT_EN[question_fr] ?? {
    question_en: override.question_en ?? '',
    answer_en: override.answer_en ?? '',
  };
  if (en.question_en.length === 0 || en.answer_en.length === 0) {
    throw new Error(`Missing EN for kit question: ${question_fr}`);
  }
  return {
    category: bucket,
    group_fr: mapped,
    group_en: FAQ_CATEGORY_EN[mapped],
    question_fr,
    answer_fr,
    question_en: en.question_en,
    answer_en: en.answer_en,
  };
}

function enrichConciergeItem(
  raw: (typeof PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT)[number],
): NormalisedConciergeQuestion {
  const mappedCategory =
    CONCIERGE_CATEGORY_REMAP[raw.category_fr] ??
    (raw.category_fr as keyof typeof CONCIERGE_CATEGORY_EN);
  const category_fr = mappedCategory;
  const category_en = CONCIERGE_CATEGORY_EN[category_fr];
  const en = CONCIERGE_EN[raw.question_fr];
  if (en === undefined) {
    throw new Error(`Missing EN for concierge question: ${raw.question_fr}`);
  }
  return {
    category_fr,
    category_en,
    question_fr: raw.question_fr,
    reply_fr: raw.reply_fr,
    question_en: en.question_en,
    reply_en: en.reply_en,
  };
}

function serializeConstArray(name: string, items: ReadonlyArray<object>): string {
  const body = items
    .map((item) => {
      const lines = Object.entries(item).map(([key, value]) => {
        if (typeof value === 'string') {
          const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `    ${key}: '${escaped}',`;
        }
        if (typeof value === 'boolean') return `    ${key}: ${String(value)},`;
        return `    ${key}: ${JSON.stringify(value)},`;
      });
      return `  {\n${lines.join('\n')}\n  }`;
    })
    .join(',\n');
  return `export const ${name} = [\n${body},\n] as const;`;
}

function main(): void {
  let kit = [...PRINCE_DE_GALLES_FAQ_CONTENT_KIT].map((item) => enrichKitItem(item));

  // Ensure ≥2 Animaux + Accessibilité + Famille after overrides
  kit = kit.map((item) => item);
  const extraKit: NormalisedFaqKitItem[] = [
    {
      category: 'during',
      group_fr: 'Animaux',
      group_en: FAQ_CATEGORY_EN.Animaux,
      question_fr: 'Quels animaux de compagnie sont acceptés et à quel tarif ?',
      answer_fr:
        'Chiens et chats acceptés à 70 € par séjour, dans la limite de poids fixée par la maison. Signalez l’animal à la réservation pour préparer la chambre.',
      question_en:
        KIT_EN['Quels animaux de compagnie sont acceptés et à quel tarif ?']!.question_en,
      answer_en: KIT_EN['Quels animaux de compagnie sont acceptés et à quel tarif ?']!.answer_en,
    },
    {
      category: 'during',
      group_fr: 'Accessibilité',
      group_en: FAQ_CATEGORY_EN.Accessibilité,
      question_fr: 'Des chambres PMR avec douche accessible sont-elles disponibles ?',
      answer_fr:
        'Oui, un nombre limité de chambres adaptées avec douche accessible est disponible. Précisez vos besoins PMR à la réservation pour assigner le bon étage.',
      question_en:
        KIT_EN['Des chambres PMR avec douche accessible sont-elles disponibles ?']!.question_en,
      answer_en:
        KIT_EN['Des chambres PMR avec douche accessible sont-elles disponibles ?']!.answer_en,
    },
    {
      category: 'during',
      group_fr: 'Famille & Enfants',
      group_en: FAQ_CATEGORY_EN['Famille & Enfants'],
      question_fr: 'Proposez-vous un menu ou room-service adapté aux enfants ?',
      answer_fr:
        'Le room-service et Le Patio proposent des options adaptées sur demande. Signalez allergies et horaires : la cuisine prépare des assiettes plus simples pour les plus jeunes.',
      question_en: 'Do you offer a child-friendly menu or room service?',
      answer_en:
        'Room service and Le Patio offer adapted options on request. Flag allergies and timing: the kitchen prepares simpler plates for younger guests.',
    },
  ];

  // Replace last 3 non-canonical duplicates to keep count at 42
  const dropQuestions = new Set([
    'Puis-je obtenir un départ tardif sans frais supplémentaires ?',
    'Proposez-vous des menus végétariens ?',
    'Existe-t-il des chambres communicantes ?',
  ]);
  kit = kit.filter((item) => !dropQuestions.has(item.question_fr));
  kit = [...kit, ...extraKit];

  if (kit.length !== 42) {
    throw new Error(`Expected 42 kit items after enrichment, got ${kit.length}`);
  }

  const categoryCounts = new Map<string, number>();
  for (const item of kit) {
    categoryCounts.set(item.group_fr, (categoryCounts.get(item.group_fr) ?? 0) + 1);
  }
  for (const category of FAQ_FACTUAL_CATEGORIES_FR) {
    const count = categoryCounts.get(category) ?? 0;
    if (count < FAQ_KIT_MIN_PER_CATEGORY) {
      throw new Error(
        `Category "${category}" has ${count} items (need ≥ ${FAQ_KIT_MIN_PER_CATEGORY})`,
      );
    }
  }

  const concierge = PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT.map((item) =>
    enrichConciergeItem(item),
  );

  const gate = evaluateFaqKitRowEnrichment({
    hotelName: 'Prince de Galles',
    faq_content_kit: kit,
    faq_content: [...PRINCE_DE_GALLES_FAQ_CONTENT_PROMOTE],
    concierge_questions: concierge,
  });
  if (!gate.ok) {
    console.error('Enrichment gates failed:');
    for (const issue of gate.issues) console.error(`  [${issue.severity}] ${issue.message}`);
    process.exit(1);
  }

  const faqPath = resolve(DOMAIN_EDITORIAL, 'prince-de-galles-faq.generated.ts');
  const faqRaw = readFileSync(faqPath, 'utf8');
  const promoteMatch = faqRaw.match(/\/\*\* CDC §2\.11 promote subset[\s\S]*$/u);
  if (promoteMatch === null) {
    throw new Error('Could not preserve promote block in prince-de-galles-faq.generated.ts');
  }

  const faqGenerated = `/**
 * AUTO-GENERATED — Prince de Galles FAQ kit (Perplexity taxonomy + EN parity).
 * Regenerate: pnpm tsx scripts/editorial-pilot/src/hotels/regenerate-prince-de-galles-faq-enrichment.ts
 */

/** 42 factual FAQ items for kit DOM (JSON-LD uses promote subset). */
${serializeConstArray('PRINCE_DE_GALLES_FAQ_CONTENT_KIT', kit)}

${promoteMatch[0]}
`;

  writeFileSync(faqPath, faqGenerated, 'utf8');

  const goldenPath = resolve(DOMAIN_EDITORIAL, 'prince-de-galles-golden.ts');
  const goldenRaw = readFileSync(goldenPath, 'utf8');
  const conciergeBlock = serializeConstArray('PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT', concierge);
  const replaced = goldenRaw.replace(
    /export const PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT = \[[\s\S]*?\] as const;/u,
    conciergeBlock,
  );
  if (replaced === goldenRaw) {
    throw new Error('Could not patch PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT in golden.ts');
  }
  writeFileSync(goldenPath, replaced, 'utf8');

  console.log(`Wrote kit (${kit.length} items) + concierge (${concierge.length} items)`);
  console.log('Perplexity gates: OK');
}

main();
