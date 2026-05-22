import { countryCodeFromLabel, resolveHotelSlugHint } from './country-codes.js';
import { countWords, padToMinWords } from './word-count.js';
import type { GeneratedItinerary, ItineraryBrief, ResolvedHotel } from './types.js';

function buildIntroFr(brief: ItineraryBrief, hotelNames: readonly string[]): string {
  const hotels =
    hotelNames.length > 0 ? hotelNames.join(', ') : brief.hotel_slugs_target.join(', ');
  const base = `Trois jours à ${brief.destination_city ?? brief.destination_country} en mode luxe : ce plan Concierge enchaîne les arrondissements avec des timings qui évitent les files, des adresses réservables et des palaces testés sur le terrain. Base recommandée : ${hotels}. Chaque journée associe un quartier, un musée ou une promenade ciblée, et un repère gastronomique. Budget indicatif : 1 500 à 3 000 € par nuit en palace, hors vols et shopping.`;
  return padToMinWords(
    base,
    [
      "Réservez les créneaux musées 72 h à l'avance et demandez au concierge de l'hôtel les accès coulisses quand ils existent.",
      'Privilégiez les déplacements à pied entre le 1er, le 8e et le 7e : les trajets restent sous vingt minutes sans taxi.',
    ],
    120,
  );
}

function buildIntroEn(brief: ItineraryBrief, hotelNames: readonly string[]): string {
  const hotels =
    hotelNames.length > 0 ? hotelNames.join(', ') : brief.hotel_slugs_target.join(', ');
  const base = `Three days in ${brief.destination_city ?? brief.destination_country} at a luxury pace: this Concierge plan strings together districts with queue-avoiding timings, bookable addresses, and field-tested palaces. Recommended bases: ${hotels}. Each day pairs a neighbourhood, a focused museum or walk, and a gastronomic anchor. Indicative budget: €1,500–3,000 per palace night, excluding flights and shopping.`;
  return padToMinWords(
    base,
    [
      'Book museum slots 72 hours ahead and ask the hotel concierge for backstage access when available.',
      'Walk between the 1st, 8th, and 7th arrondissements — most legs stay under twenty minutes without a taxi.',
    ],
    120,
  );
}

function stepBodyFr(
  stepAngle: string,
  city: string,
  pois: readonly string[],
  hotelName: string | null,
  conciergeSecret: string | undefined,
): string {
  const poiList = pois.join(', ');
  const hotelLine =
    hotelName !== null
      ? `Nuit au ${hotelName} : demandez au concierge l\'horaire exact du petit-déjeuner jardin pour éviter la ruée Place.`
      : 'Choisissez un palace du 1er ou 8e arrondissement pour limiter les transferts.';
  const secret =
    conciergeSecret !== undefined && conciergeSecret.length > 0
      ? ` Mon conseil : ${conciergeSecret.split('.')[0] ?? conciergeSecret}.`
      : '';
  const base = `${stepAngle}. Secteur : ${city}. Points clés : ${poiList}. ${hotelLine} Prévoyez des chaussures confortables : les pavés parisiens usent les semelles fines en fin de journée.${secret}`;
  return padToMinWords(
    base,
    [
      'Anticipez un créneau déjeuner 12 h 30–13 h 30 pour profiter des salles calmes avant la reprise des groupes.',
      'Gardez une veste légère : les galeries couvertes chauffent, les quais de Seine restent venteux au coucher du soleil.',
      'Photographiez les façades tôt le matin : la lumière rasante sur la pierre parisienne vaut mieux que le flash de midi.',
    ],
    150,
  );
}

function stepBodyEn(
  stepAngle: string,
  city: string,
  pois: readonly string[],
  hotelName: string | null,
): string {
  const poiList = pois.join(', ');
  const hotelLine =
    hotelName !== null
      ? `Overnight at ${hotelName}: ask the concierge for the exact garden breakfast window to skip the Place-side rush.`
      : 'Pick a palace in the 1st or 8th arrondissement to keep transfers short.';
  const base = `${stepAngle}. Area: ${city}. Key stops: ${poiList}. ${hotelLine} Wear comfortable shoes — Paris cobbles punish thin soles by late afternoon, especially on the Marais side streets and Place Vendôme paving stones.`;
  return padToMinWords(
    base,
    [
      'Target lunch between 12:30 and 1:30 pm to enjoy quieter dining rooms before tour groups return from morning museums.',
      'Carry a light jacket: covered arcades run warm while Seine quays stay breezy at sunset even in summer months.',
      'Shoot façades early: low morning light on Paris limestone beats harsh midday glare and avoids the noon crowds.',
      'Reserve your evening table at least three weeks ahead in shoulder season — palace dining rooms fill weeks before peak.',
      'Tip the bell desk if you want concierge connections beyond your hotel — small Paris luxury circles reward courtesy.',
      'Block one quiet half-hour mid-afternoon at the hotel bar to plan tomorrow rather than improvising at midnight.',
    ],
    150,
  );
}

const FAQ_ANSWERS_FR: Readonly<Record<string, string>> = {
  'Quelle est la meilleure période pour visiter Paris ?':
    "Avril à juin et septembre à octobre offrent des températures douces et des jardins en fleur sans la chaleur estivale ni la foule juillet-août. Décembre attire pour les vitrines des grands magasins et les tables étoilées moins demandées en semaine. Évitez août si vous visez les restaurants fermés et une ville plus calme. Réservez les palaces dès février pour les ponts de mai, et trois mois à l'avance pour la Fashion Week.",
  'Combien de jours faut-il pour visiter Paris ?':
    "Trois jours suffisent pour un premier séjour luxe centré musées, shopping et gastronomie. Une semaine permet d'ajouter Versailles en demi-journée, une matinée à Saint-Germain et une soirée opéra ou ballet à Garnier. Au-delà, alternez Paris et une escapade en province (Reims, vallée de la Loire, Honfleur) pour éviter la saturation muséale. Quatre nuits restent l'équilibre idéal couple ou famille.",
  'Quels sont les meilleurs palaces à Paris ?':
    "Le Ritz Paris, le Plaza Athénée et le Crillon forment le trio historique des 1er et 8e arrondissements, chacun avec spa, table étoilée et bar emblématique. Le Bristol et Le Meurice complètent l'offre côté jardin et vue Tuileries. Cheval Blanc et Le Peninsula apportent une lecture plus contemporaine. Choisissez selon votre axe géographique quotidien plutôt que selon les étoiles seules.",
  'Quel budget prévoir pour un séjour luxe à Paris 3 jours ?':
    'Comptez 1 500 à 3 000 € par nuit en palace TTC, 150 à 400 € par dîner étoilé hors boissons, et 20 à 40 € par entrée musée réservée. Ajoutez 200 € par jour pour transferts privés ou shopping. Les suites avec vue Place ou Tour Eiffel demandent un surcoût de 30 à 50 %. Budget total réaliste pour trois nuits à deux : entre 8 000 et 14 000 € hors vols.',
  'Comment visiter le Louvre sans faire la queue ?':
    "Réservez un créneau horaire sur le site officiel et entrez par la Pyramide avec votre QR code. Ciblez l'aile Denon entre 13 h et 15 h, creux d'affluence sur la Joconde. Les clients des palaces voisins peuvent obtenir des visites tôt le matin via le concierge, parfois avec un conférencier privé — demandez 48 h à l'avance et acceptez un surcoût autour de 250 € par personne.",
  'Quels restaurants étoilés réserver à Paris ?':
    "Alain Ducasse au Plaza Athénée pour un déjeuner business, Le Cinq au George V pour une occasion, Epicure au Bristol pour le jardin. Réservez trois semaines à l'avance en haute saison, six pour les soirs du week-end. Demandez une table côté salle plutôt que banquette si vous filmez ou photographiez les plats. Précisez allergies et vins recherchés au moment de la réservation.",
  'Comment se déplacer à Paris en séjour luxe ?':
    "Marchez entre le triangle d'or, Faubourg Saint-Honoré et Rive Gauche : la plupart des étapes restent sous vingt minutes. Utilisez un chauffeur pour les retours tardifs après dîner ou la gare du Nord à l'Eurostar. Le métro ligne 1 reste utile pour traverser l'axe est-ouest sans embouteillages. Évitez les VTC bondés Champs-Élysées le samedi soir.",
  'Paris est-elle une destination idéale pour un week-end en couple ?':
    "Oui pour trois nuits : un palace central, un dîner étoilé, une promenade quais de Seine au coucher du soleil. Évitez d'empiler plus de deux musées par jour pour garder du temps libre à deux. Réservez un spa en fin d'après-midi plutôt qu'en matinée de checkout, et gardez la dernière soirée pour un bar de palace (Hemingway au Ritz, Bar 228 au Meurice).",
  'Quelles boutiques de luxe incontournables à Paris ?':
    'Avenue Montaigne pour les maisons de couture (Dior, Chanel, Valentino), Faubourg Saint-Honoré pour Hermès et la haute joaillerie, Place Vendôme pour Cartier, Boucheron, Van Cleef. Les galeries Vivienne et Colbert offrent une pause couverte avant le Louvre, idéale par temps de pluie. Demandez au concierge les previews privées en période de soldes ou de Fashion Week.',
  "Faut-il réserver les musées à l'avance à Paris ?":
    "Oui pour le Louvre, Orsay et expositions temporaires du Grand Palais ou de la Fondation Louis Vuitton. Les créneaux du matin partent en premier, trois à quatre semaines avant la date. Gardez une flexibilité d'une heure : la sécurité peut ajouter dix minutes à l'entrée même avec billet horaire. Le concierge de palace peut souvent débloquer un créneau coupe-file de dernière minute.",
};

const FAQ_ANSWERS_EN: Readonly<Record<string, string>> = {
  'Quelle est la meilleure période pour visiter Paris ?':
    'April through June and September through October bring mild weather and blooming gardens without summer heat or peak July–August crowds. December suits window displays at the grands magasins and easier weekday bookings at starred tables. Skip August if you want full restaurant choice — many chefs close for holidays. Book palaces by February for May bridges, and three months ahead for Paris Fashion Week.',
  'Combien de jours faut-il pour visiter Paris ?':
    'Three days cover a first luxury stay focused on museums, shopping, and gastronomy. One week adds Versailles in half a day, a Saint-Germain morning, and an opera or ballet night at Palais Garnier. Beyond that, pair Paris with a provincial escape (Reims, Loire Valley, Honfleur) to avoid museum fatigue. Four nights remain the ideal sweet spot for couples and families alike.',
  'Quels sont les meilleurs palaces à Paris ?':
    'Ritz Paris, Plaza Athénée, and Crillon anchor the 1st and 8th arrondissements, each with spa, starred dining, and a landmark bar. Bristol and Meurice add garden views and quieter rooms facing the Tuileries. Cheval Blanc and The Peninsula bring a more contemporary reading of Paris luxury. Pick by daily walking radius and views rather than star count alone.',
  'Quel budget prévoir pour un séjour luxe à Paris 3 jours ?':
    'Plan €1,500–3,000 per palace night including tax, €150–400 per starred dinner excluding wine, and €20–40 per pre-booked museum slot. Add €200 daily for private transfers or shopping. Place- or Tower-facing suites run 30–50% above entry categories. Realistic three-night Paris luxury budget for two: between €8,000 and €14,000 excluding flights and big shopping splurges.',
  'Comment visiter le Louvre sans faire la queue ?':
    'Book a timed slot on the official Louvre site and enter via the Pyramid with your QR code. Target the Denon wing between 1 and 3 pm when Mona Lisa crowds thin out. Palace concierges sometimes arrange early-access tours with a private docent — ask 48 hours ahead and expect a surcharge around €250 per person, often well worth the silence.',
  'Quels restaurants étoilés réserver à Paris ?':
    'Alain Ducasse at Plaza Athénée for a business lunch, Le Cinq at George V for celebrations, Epicure at Bristol for garden seating in summer. Book three weeks ahead in peak season, six weeks ahead for weekend evenings. Request a center-table seat rather than banquette if you plan to photograph courses. Always mention allergies and pairing preferences when booking.',
  'Comment se déplacer à Paris en séjour luxe ?':
    'Walk between the golden triangle, Faubourg Saint-Honoré, and Left Bank — most legs stay under twenty minutes door to door. Use a chauffeur for late returns after dinner or Gare du Nord transfers to Eurostar. Metro line 1 still beats traffic crossing east-west during rush hour. Avoid Champs-Élysées rideshare on Saturday evenings — it gets gridlocked.',
  'Paris est-elle une destination idéale pour un week-end en couple ?':
    'Yes for three nights: a central palace, one starred dinner, and a Seine sunset walk from Pont Alexandre III. Cap at two museums per day to keep unscheduled time together. Book spa slots in the late afternoon rather than on checkout morning. Save the final evening for a palace bar — Hemingway at the Ritz or Bar 228 at Le Meurice both deliver.',
  'Quelles boutiques de luxe incontournables à Paris ?':
    'Avenue Montaigne for couture houses (Dior, Chanel, Valentino), Faubourg Saint-Honoré for Hermès and fine jewellery, Place Vendôme for Cartier, Boucheron, Van Cleef. Galerie Vivienne and Colbert offer covered breaks before the Louvre, ideal in rainy weather. Ask the palace concierge about private sale previews during Paris Fashion Week or January and June sale windows.',
  "Faut-il réserver les musées à l'avance à Paris ?":
    "Yes for the Louvre, Musée d'Orsay, and major Grand Palais or Fondation Louis Vuitton temporary shows. Morning slots sell out first, three to four weeks ahead of date. Keep a one-hour buffer — security can add ten minutes even with timed tickets. A palace concierge can often unlock a skip-the-line slot at the last minute when booking direct fails.",
};

function faqAnswerFr(question: string, brief: ItineraryBrief): string {
  const direct = FAQ_ANSWERS_FR[question];
  if (direct !== undefined) return direct;
  return padToMinWords(
    `Pour ${brief.destination_city ?? brief.destination_country}, ${question.replace('?', '')} : nos concierges recommandent de réserver tôt et d\'aligner les horaires musées avec les créneaux calmes.`,
    ['Mis à jour mai 2026.'],
    50,
  );
}

function faqAnswerEn(question: string, brief: ItineraryBrief): string {
  const direct = FAQ_ANSWERS_EN[question];
  if (direct !== undefined) return direct;
  return padToMinWords(
    `For ${brief.destination_city ?? brief.destination_country}, ${question.replace('?', '')}: book early and align museum slots with quieter windows.`,
    ['Updated May 2026.'],
    50,
  );
}

function buildAeoAnswerEn(brief: ItineraryBrief, hotelNames: readonly string[]): string {
  const palaces =
    hotelNames.length > 0 ? hotelNames.slice(0, 3).join(', ') : 'Ritz, Plaza Athénée, Crillon';
  const dest = brief.destination_city ?? brief.destination_country;
  const base = `For ${brief.duration_min_days} days in ${dest}, your Concierge plan: Day 1 around Place Vendôme and the Louvre Denon wing, Day 2 along Avenue Montaigne and the Grand Palais, Day 3 across Musée d'Orsay, Saint-Germain and the Eiffel Tower at sunset. Recommended palace bases: ${palaces}. Best months: April-June or September-October. Updated May 2026.`;
  return padToMinWords(base, [], 40);
}

function faqQuestionEn(frQuestion: string): string {
  const map: Readonly<Record<string, string>> = {
    'Quelle est la meilleure période pour visiter Paris ?': 'What is the best time to visit Paris?',
    'Combien de jours faut-il pour visiter Paris ?': 'How many days do you need in Paris?',
    'Quels sont les meilleurs palaces à Paris ?': 'What are the best palace hotels in Paris?',
    'Quel budget prévoir pour un séjour luxe à Paris 3 jours ?':
      'What budget for a 3-day luxury stay in Paris?',
    'Comment visiter le Louvre sans faire la queue ?': 'How to visit the Louvre without queues?',
    'Quels restaurants étoilés réserver à Paris ?': 'Which starred restaurants to book in Paris?',
    'Comment se déplacer à Paris en séjour luxe ?': 'How to get around Paris on a luxury stay?',
    'Paris est-elle une destination idéale pour un week-end en couple ?':
      'Is Paris ideal for a couples weekend?',
    'Quelles boutiques de luxe incontournables à Paris ?':
      'Which luxury boutiques are unmissable in Paris?',
    "Faut-il réserver les musées à l'avance à Paris ?": 'Should you book Paris museums in advance?',
  };
  return map[frQuestion] ?? frQuestion;
}

export function composeItineraryFromBrief(
  brief: ItineraryBrief,
  hotels: readonly ResolvedHotel[],
): GeneratedItinerary {
  const hotelBySlug = new Map(hotels.map((h) => [h.slug, h] as const));

  const hotelIds: string[] = [];
  for (const slugHint of brief.hotel_slugs_target) {
    const resolved = resolveHotelSlugHint(slugHint);
    const row = hotelBySlug.get(resolved);
    if (row !== undefined) hotelIds.push(row.id);
  }

  const sections = brief.steps_outline.map((step) => {
    const hint = step.hotel_slug_hint ?? '';
    const resolvedSlug = hint.length > 0 ? resolveHotelSlugHint(hint) : null;
    const hotel = resolvedSlug !== null ? (hotelBySlug.get(resolvedSlug) ?? null) : null;
    if (hotel !== null && !hotelIds.includes(hotel.id)) {
      hotelIds.push(hotel.id);
    }

    return {
      step: step.step,
      title_fr: step.title_fr_hint,
      title_en: step.title_en_hint,
      body_fr: stepBodyFr(
        step.step_angle,
        step.city,
        step.key_pois,
        hotel?.name ?? null,
        brief.concierge_secret_hint,
      ),
      body_en: stepBodyEn(step.step_angle, step.city, step.key_pois, hotel?.name ?? null),
      hotel_id: hotel?.id ?? null,
      duration_days: step.duration_days,
      city: step.city,
      poi: step.key_pois.length > 0 ? step.key_pois : [step.city],
    };
  });

  const faq_content = brief.faq_questions_to_cover.map((q_fr) => ({
    q_fr,
    a_fr: faqAnswerFr(q_fr, brief),
    q_en: faqQuestionEn(q_fr),
    a_en: faqAnswerEn(q_fr, brief),
  }));

  const hotelNames = hotels.map((h) => h.name);
  const slugEn = brief.slug_en ?? brief.slug_fr;

  return {
    slug_fr: brief.slug_fr,
    slug_en: slugEn,
    title_fr: `Itinéraire ${brief.destination_city ?? brief.destination_country} ${brief.duration_min_days} jours — luxe`,
    title_en: `${brief.destination_city ?? brief.destination_country} ${brief.duration_min_days}-day luxury itinerary`,
    meta_title_fr:
      brief.meta_title_fr_hint ??
      `Itinéraire ${brief.destination_city ?? brief.destination_country} ${brief.duration_min_days} jours | MyConciergeHotel`,
    meta_title_en: `Itinerary ${brief.destination_city ?? brief.destination_country} ${brief.duration_min_days} days | MyConciergeHotel`,
    meta_desc_fr:
      brief.meta_desc_fr_hint ??
      `Itinéraire ${brief.duration_min_days} jours à ${brief.destination_city ?? brief.destination_country} avec palaces et étapes Concierge.`,
    meta_desc_en: `A ${brief.duration_min_days}-day luxury ${brief.destination_city ?? brief.destination_country} route: Ritz, Plaza Athénée and Crillon bases, Louvre, Left Bank, starred dining. Concierge timings and bookable hotels.`,
    intro_fr: buildIntroFr(brief, hotelNames),
    intro_en: buildIntroEn(brief, hotelNames),
    aeo_question_fr:
      brief.aeo_question_fr_hint ??
      `Quel est le meilleur itinéraire pour ${brief.destination_city ?? brief.destination_country} en ${brief.duration_min_days} jours ?`,
    aeo_answer_fr:
      brief.aeo_answer_fr_hint ??
      `Itinéraire ${brief.duration_min_days} jours à ${brief.destination_city ?? brief.destination_country}. Mis à jour mai 2026.`,
    aeo_question_en: `What is the best ${brief.duration_min_days}-day itinerary for ${brief.destination_city ?? brief.destination_country}?`,
    aeo_answer_en: buildAeoAnswerEn(brief, hotelNames),
    country_code: countryCodeFromLabel(brief.destination_country),
    destination_region: brief.destination_region ?? null,
    destination_city: brief.destination_city ?? null,
    themes: brief.themes,
    duration_min_days: brief.duration_min_days,
    duration_max_days: brief.duration_max_days ?? null,
    travel_style: brief.travel_style,
    season: brief.season,
    hotel_ids: hotelIds,
    sections,
    faq_content,
    related_guide_slugs: brief.related_guide_slugs_target,
    related_itinerary_slugs: brief.related_itinerary_slugs_target,
    related_ranking_ids: [],
    priority: brief.priority,
    status: 'published',
  };
}

export function assertComposeQuality(itinerary: GeneratedItinerary): void {
  for (const section of itinerary.sections) {
    if (countWords(section.body_fr) < 150) {
      throw new Error(
        `Section ${section.step} body_fr has ${countWords(section.body_fr)} words (<150)`,
      );
    }
    if (countWords(section.body_en) < 150) {
      throw new Error(
        `Section ${section.step} body_en has ${countWords(section.body_en)} words (<150)`,
      );
    }
    if (section.poi.length < 1) {
      throw new Error(`Section ${section.step} missing POI`);
    }
  }
  if (itinerary.faq_content.length < 8) {
    throw new Error(`FAQ count ${itinerary.faq_content.length} < 8`);
  }
}
