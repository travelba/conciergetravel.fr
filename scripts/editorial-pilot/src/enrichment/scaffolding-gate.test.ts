import { describe, expect, it } from 'vitest';

import { hasLeak } from './scaffolding-gate.js';

describe('hasLeak — scaffolding / pipeline meta-commentary detector', () => {
  // Real leaks observed in published fiches (2026-06-19 catalogue audit).
  const LEAKS = [
    'Le brief confirme seulement 5 étoiles, la distinction Palace.',
    'La section `dining[]` contient un placeholder, AUTO_DRAFT — dining outlets.',
    'avec un niveau de confiance `low`. Aucun restaurant confirmé.',
    'La rubrique `wellness` est `pending`. Le brief ne confirme pas le spa.',
    'via la fiche Q122595825 consultée le 2026-05-20.',
    'Wikidata apparaît bien dans les sources.',
    'With service details still pending, I would not plan transfers.',
    'The brief usefully notes that watersports are worth planning.',
    'avec une confidence low sur la saisie manuelle.',
    'rated confidence: high in the source table.',
    // "dossier narration" class (2026-06-21 audit) — leaked on ~424 fiches.
    'Aman New York avance ici avec un dossier encore incomplet sur l’histoire.',
    'Les équipements connus du brief dessinent déjà une base solide.',
    'Date de consultation des sources du brief : 2026-05-20.',
    'Plusieurs rubriques attendent encore une vérification manuelle.',
    'Capacité, bien-être et services demandent un contrôle manuel avant publication.',
    'Le dossier reste incomplet sur l’architecture détaillée.',
    'Même l’histoire reste en attente, avec une année 0 qui signale un placeholder.',
    'La référence culturelle manque encore au brief, malgré une recherche Wikipédia.',
    'Une documentation en attente d’enrichissement via Wikipedia et le site officiel.',
    // English "dossier narration" — leaked on ~1.2k /en section bodies (2026-06-21).
    'The spa is a defining feature, and the brief rightly emphasises its purpose.',
    'In this brief, a limited but clear factual basis is provided.',
    'The dossier confirms a 5-star rating and Palace status.',
    'No verified information is provided regarding airport transfers.',
    'The architecture, still to be confirmed, illustrates its modern allure.',
    'Several sections are awaiting verification before publication.',
    'The wellness area pending confirmation in the current sources.',
    'The conviviality mentioned in the brief finds an obvious expression here.',
    'The dining outlets listed in the brief include two Michelin tables.',
    // generalised "dossier"/"file" narration (2026-06-21 second sweep).
    'Le dossier historique reste incomplet sur l’architecture.',
    'Ce dossier tient sur peu de certitudes de repérage.',
    'Il faut lire entre les lignes du dossier pour situer la maison.',
    'Le dossier manque encore de profondeur sur le voisinage.',
    'This dossier relies more on location than on atmosphere.',
    'The historical file remains incomplete on the architecture.',
    // data-gap narration class (2026-06-21 third sweep).
    'Aucun fait vérifié ne permet de confirmer le spa ou la piscine.',
    'Aucune donnée vérifiée n’est disponible sur le service de majordome.',
    'Le bien-être reste non documenté dans cette fiche.',
    'La rubrique de voisinage est en attente.',
    'Le Grand Hyatt présente dans ce brief un profil factuel centré sur trois points.',
    'Année de première distinction Palace : non renseignée dans ce brief.',
    'Le rattachement exact est indiqué sous réserve de confirmer la fiche.',
    'No verified fact confirms the languages spoken or the airport transfer.',
    'The wellness offering remains undocumented.',
    'This hotel is not selected for a grand heritage narrative, yet to be documented here.',
    // data-gap narration class (2026-06-21 fifth sweep — "reste à documenter").
    'L’histoire détaillée du Domaine reste à documenter.',
    'Le spa du Domaine reste à documenter avec précision.',
    'Aucune information précise sur l’architecture n’est actuellement disponible.',
    'Les précisions sur les langues parlées restent à confirmer.',
    'The architectural details remain to be confirmed.',
    'No precise information is available on the spa facilities.',
    'Le spa, encore à documenter, promet un espace de bien-être raffiné.',
    'Les prestations restent encore à préciser pour ce Palace.',
    // word-count bookkeeping class (2026-06-22 editorial_guides audit).
    'Une escale hors du temps face à la baie. Compte mots: 434',
    'Le terroir breton se savoure lentement. Compteur de mots: 435',
    'La côte atlantique au crépuscule. Compte: 479 mots.',
    'Une enfilade de châteaux ligériens. Compteur mots: 510',
    'Le littoral mauricien invite au repos. Nombre de mots: 600',
    'The harbour glows at dusk over the bay. Word count: 512',
    'A slow loop through the Rockies. Estimated word count: 473.',
  ];

  // Legitimate editorial prose that MUST NOT be flagged.
  const CLEAN = [
    'The known services create that framework of confidence for guests.',
    'An air of quiet confidence pervades the lobby.',
    'Guests can book with complete confidence and peace of mind.',
    'Un palace au cœur de Paris, face aux jardins des Tuileries.',
    'Le spa de 1000 m² propose soins signature et hammam traditionnel.',
    'The rooftop bar offers a brief but memorable cocktail list at sunset.',
    'The concierge handles every request with brief, precise efficiency.',
    'Le bar propose une carte brève mais mémorable au coucher du soleil.',
    'Les jardins en terrasses dominent la baie depuis le belvédère.',
    // EN clean: "the brief" as an adjective must NOT trip the verb-anchored rule.
    'The brief encounter with the head sommelier sets the tone for dinner.',
    'After a brief stroll, the terrace opens onto the bay.',
    'The suites confirm a sense of calm rare in the city centre.',
    'In this brief overview, the property reveals its quiet confidence.',
    'In the brief moment between courses, the sommelier returns.',
    // legit "dossier"/"file" uses must stay clean.
    'Le dossier de presse est disponible sur demande à la conciergerie.',
    'Votre dossier de réservation sera confirmé par email sous 24 heures.',
    'The file at reception holds your dining preferences for each visit.',
    // data-gap guards: "rubrique"/"documenté" without the meta context stay clean.
    'La carte propose une rubrique végétarienne complète et inventive.',
    'Un savoir-faire documenté depuis 1850 se perpétue dans chaque suite.',
    'The history is well documented in the hotel’s private archive.',
    // "non renseignée" alone is a legitimate "field unspecified" state in the
    // en-pratique block — only the "…dans ce brief" tail makes it a leak.
    'Année de première distinction Palace : non renseignée.',
    'Classement : 5 étoiles ; Palace, date de première distinction non renseignée.',
    // data-gap guards: legit "available"/"reste" phrasings stay clean.
    'Le room service n’est pas disponible la nuit, mais un plateau froid attend en chambre.',
    'Le petit-déjeuner reste à la carte, servi jusqu’à 11 heures.',
    'Twenty-four-hour room service is available throughout the stay.',
    'A detailed spa menu is available at reception on arrival.',
    // word-count guards: a bona-fide count of words in prose stays clean —
    // only the label keyword ("compte/compteur/nombre de mots", "word count")
    // marks the bookkeeping artefact.
    'Le concierge rédige un récit de 434 mots sur l’histoire du domaine.',
    'Compte tenu de la saison, mieux vaut réserver tôt sur la presqu’île.',
    'On compte près de 500 chambres réparties dans les trois ailes.',
    'Le livre d’or recense quelques mots manuscrits des grands habitués.',
    'The tasting menu spans five words of Breton on each handwritten card.',
  ];

  it.each(LEAKS)('flags leak: %s', (text) => {
    expect(hasLeak(text)).toBe(true);
  });

  it.each(CLEAN)('keeps clean: %s', (text) => {
    expect(hasLeak(text)).toBe(false);
  });

  it('handles null / empty', () => {
    expect(hasLeak(null)).toBe(false);
    expect(hasLeak('')).toBe(false);
  });
});
