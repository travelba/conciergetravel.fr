import { describe, expect, it } from 'vitest';

import { evaluateFaqKitCoverage, parsePerplexityHotelFaqResearch } from './faq-perplexity-gates.js';
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
