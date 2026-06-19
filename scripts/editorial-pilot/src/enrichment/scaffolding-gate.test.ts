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
  ];

  // Legitimate editorial prose that MUST NOT be flagged.
  const CLEAN = [
    'The known services create that framework of confidence for guests.',
    'An air of quiet confidence pervades the lobby.',
    'Guests can book with complete confidence and peace of mind.',
    'Un palace au cœur de Paris, face aux jardins des Tuileries.',
    'Le spa de 1000 m² propose soins signature et hammam traditionnel.',
    'The rooftop bar offers a brief but memorable cocktail list at sunset.',
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
