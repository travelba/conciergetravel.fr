import { describe, expect, it } from 'vitest';

import { pageHasLeak } from './page-leak.js';

describe('pageHasLeak — flags prose scaffolding', () => {
  it.each([
    'Le brief confirme un positionnement palace.',
    'Aman New York avance ici avec un dossier encore incomplet.',
    'Niveau de confiance low sur cette rubrique.',
    'Capacité de la salle : non renseignée.',
    'Plusieurs rubriques attendent une vérification manuelle.',
    'AUTO_DRAFT',
    'Aucun fait vérifié ne permet de confirmer le spa.',
    'En attente d’enrichissement éditorial.',
    'Compte mots: 434',
    'Estimated word count: 473.',
    'The dossier confirms a 1907 opening.',
    'still to be confirmed',
  ])('flags %j', (text) => {
    expect(pageHasLeak(text)).toBe(true);
  });
});

describe('pageHasLeak — does NOT flag legitimate rendered chrome', () => {
  it.each([
    // EEAT provenance footer labels + reference links — the confirmed
    // false positive that the full editorial gate produced on every fiche.
    'Faits vérifiés Références externes Wikidata Wikipédia (FR) Wikipédia (EN) Site officiel',
    'Source : Wikidata Q19877 — consulter la fiche.',
    // Methodology / docs that legitimately show a URL template (the
    // backtick token the full gate would flag).
    'Les classements suivent le motif /classements/{axe}/{valeur}.',
    // Ordinary editorial prose using neighbouring words.
    'Un court séjour, le temps d’un week-end à la montagne.',
    'Le dossier de presse de l’hôtel est disponible sur demande.',
    'A brief stroll from the Tuileries gardens.',
    'The hotel keeps a record of your preferences at reception.',
    'Une cuisine bien documentée par les guides gastronomiques.',
  ])('keeps clean: %j', (text) => {
    expect(pageHasLeak(text)).toBe(false);
  });
});
