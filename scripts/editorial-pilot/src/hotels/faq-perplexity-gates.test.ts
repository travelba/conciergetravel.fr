import { describe, expect, it } from 'vitest';

import {
  evaluateFaqKitCoverage,
  evaluatePaaCoverage,
  isEditoriallyRelevantPaa,
  parsePerplexityHotelFaqResearch,
} from './faq-perplexity-gates.js';
import { transformPerplexityHotelFaq } from './faq-perplexity-transform.js';
import {
  FAQ_FACTUAL_CATEGORIES_FR,
  FAQ_KIT_MIN_ITEMS,
  CONCIERGE_QUESTION_CATEGORIES_FR,
  CONCIERGE_QUESTIONS_MIN,
} from './faq-perplexity-taxonomy.js';

function buildMinimalRaw() {
  const faq = [];
  let idx = 0;
  for (const category of FAQ_FACTUAL_CATEGORIES_FR) {
    for (let i = 0; i < 4; i += 1) {
      faq.push({
        category,
        question: `Question ${idx} sur ${category} ?`,
        answer: `Réponse factuelle ${idx} en une ou deux phrases complètes pour le voyageur.`,
      });
      idx += 1;
    }
  }

  const concierge_questions = CONCIERGE_QUESTION_CATEGORIES_FR.flatMap((category, cIdx) =>
    Array.from({ length: 3 }, (_, i) => ({
      category,
      question: `Pouvez-vous m'aider pour ${category} (${cIdx}-${i}) ?`,
      concierge_reply: `Je m'en occupe immédiatement : je vérifie les disponibilités et je vous confirme par message.`,
    })),
  );

  return { faq, concierge_questions };
}

describe('parsePerplexityHotelFaqResearch', () => {
  it('accepts a kit in the target volume band', () => {
    const raw = buildMinimalRaw();
    expect(raw.faq.length).toBeGreaterThanOrEqual(FAQ_KIT_MIN_ITEMS);
    expect(raw.concierge_questions.length).toBeGreaterThanOrEqual(CONCIERGE_QUESTIONS_MIN);
    const parsed = parsePerplexityHotelFaqResearch(raw);
    expect(parsed.ok).toBe(true);
  });

  it('rejects a kit below the minimum volume', () => {
    const parsed = parsePerplexityHotelFaqResearch({ faq: [], concierge_questions: [] });
    expect(parsed.ok).toBe(false);
  });
});

describe('transformPerplexityHotelFaq', () => {
  it('maps categories to CDC buckets and builds a promote subset', () => {
    const raw = buildMinimalRaw();
    const parsed = parsePerplexityHotelFaqResearch(raw);
    if (!parsed.ok) throw new Error('expected parse success');
    const transformed = transformPerplexityHotelFaq(parsed.data, { hotelName: 'Test Palace' });
    expect(transformed.kit.length).toBeGreaterThanOrEqual(FAQ_KIT_MIN_ITEMS);
    expect(transformed.promote.length).toBeGreaterThanOrEqual(10);
    expect(transformed.promote.length).toBeLessThanOrEqual(15);
    expect(transformed.kit[0]?.category).toBe('before');
    expect(transformed.kit[0]?.group_fr).toBe('Arrivée & Départ');
  });
});

describe('evaluateFaqKitCoverage', () => {
  it('reports blocker when promote subset is too short', () => {
    const gate = evaluateFaqKitCoverage([], [], 'Test Palace', []);
    expect(gate.ok).toBe(false);
    expect(gate.issues.some((i) => i.code === 'promote.count')).toBe(true);
  });
});

describe('isEditoriallyRelevantPaa', () => {
  const NOISE = [
    'Where does Kim Kardashian stay in Dubai?',
    "Quel est le salaire d'une femme de chambre chez Ritz Paris ?",
    'Is entry to Palm Jumeirah free?',
    'Who owns the Ritz Paris?',
    'What is the net worth of the owner?',
    'Quelle star habite à Gordes ?',
    'Où séjourne Brad Pitt à Paris ?',
    'How much do hotel staff earn in Dubai?',
    // EN celebrity "what/which hotel did <Name> stay" shape (2026-06-29).
    'Which hotel did Kim Kardashian stay in Paris?',
    'What hotel did Meghan Markle stay in London?',
    'What hotel does Taylor Swift stay in in London?',
    'What hotel did Kate Middleton stay in the night before her wedding?',
    // Wealth-class gossip without a capitalised name.
    'Where do rich people stay in Paris?',
    'Where do the wealthy stay in Dubai?',
    // Travel-etiquette trivia.
    'What is the 5 minute rule in Japan?',
    'What is the 15-5 rule?',
  ];
  const EDITORIAL = [
    'Combien coûte une nuit au Ritz Paris ?',
    'Le petit-déjeuner est-il inclus ?',
    "L'hôtel accepte-t-il les animaux ?",
    'Is there a spa at the hotel?',
    'How much is a room at Burj Al Arab?',
    "Y a-t-il un parking gratuit à l'hôtel ?",
    'Le wifi est-il gratuit dans les chambres ?',
    "Où se situe l'hôtel par rapport à la plage ?",
    // Must stay counted: legit lodging questions that look superficially close.
    'What hotels should I stay at if visiting London for the first time?',
    'What is the most prestigious hotel in Paris?',
    'Where to avoid staying in Tokyo?',
    'Which area is best to stay in Rome?',
  ];

  it.each(NOISE)('excludes off-topic PAA noise: %s', (q) => {
    expect(isEditoriallyRelevantPaa(q)).toBe(false);
  });

  it.each(EDITORIAL)('keeps editorial PAA: %s', (q) => {
    expect(isEditoriallyRelevantPaa(q)).toBe(true);
  });
});

describe('evaluatePaaCoverage', () => {
  it('returns degraded (grounded=false) when no PAA were supplied', () => {
    const r = evaluatePaaCoverage(['Le petit-déjeuner est inclus.'], []);
    expect(r.grounded).toBe(false);
    expect(r.coveragePct).toBe(100);
  });

  it('coverage rises once PAA noise is excluded from the denominator', () => {
    // A good fiche that answers every editorial question but none of the noise.
    const faqBlobs = [
      'Combien coûte une nuit au Ritz Paris ? Une nuit débute autour de 1500 euros.',
      'Le petit-déjeuner est-il inclus ? Le petit-déjeuner est servi en supplément.',
      "L'hôtel accepte-t-il les animaux ? Les animaux sont acceptés sur demande.",
    ];
    const editorialPaa = [
      'Combien coûte une nuit au Ritz Paris ?',
      'Le petit-déjeuner est-il inclus ?',
      "L'hôtel accepte-t-il les animaux ?",
    ];
    const noisePaa = [
      'Where does Kim Kardashian stay in Dubai?',
      "Quel est le salaire d'une femme de chambre chez Ritz Paris ?",
      'Who owns the Ritz Paris?',
    ];

    const withNoise = evaluatePaaCoverage(faqBlobs, [...editorialPaa, ...noisePaa]);
    const filteredOnly = evaluatePaaCoverage(faqBlobs, editorialPaa);

    // Noise is dropped from the denominator → same total as editorial-only.
    expect(withNoise.total).toBe(filteredOnly.total);
    expect(withNoise.total).toBe(editorialPaa.length);
    // KPI is no longer dragged down by the 3 ignored noise questions.
    expect(withNoise.coveragePct).toBe(filteredOnly.coveragePct);
    expect(withNoise.coveragePct).toBeGreaterThanOrEqual(66);
  });
});
