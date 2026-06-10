import { describe, expect, it } from 'vitest';

import { CONCIERGE_QUESTIONS_MIN, FAQ_KIT_MIN_ITEMS } from './faq-perplexity-taxonomy.js';
import { evaluateFaqKitRowEnrichment } from './faq-kit-row-enrichment.js';

function buildMinimalKit(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    category: 'before' as const,
    group_fr: 'Arrivée & Départ',
    group_en: 'Arrival & Departure',
    question_fr: `Question kit ${i} ?`,
    answer_fr: 'Réponse factuelle avec assez de mots pour le gate GEO du catalogue.',
    question_en: `Kit question ${i}?`,
    answer_en: 'Factual answer with enough words for the catalogue GEO gate.',
  }));
}

describe('evaluateFaqKitRowEnrichment', () => {
  it('skips enrichment gates when kit is below volume threshold', () => {
    const result = evaluateFaqKitRowEnrichment({
      hotelName: 'Le Meurice',
      faq_content_kit: buildMinimalKit(5),
      faq_content: [],
      concierge_questions: [],
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags missing EN on kit when enrichment surface is present', () => {
    const kit = buildMinimalKit(FAQ_KIT_MIN_ITEMS);
    const withoutEn = kit.map((item) => ({
      category: item.category,
      group_fr: item.group_fr,
      group_en: item.group_en,
      question_fr: item.question_fr,
      answer_fr: item.answer_fr,
    }));
    const result = evaluateFaqKitRowEnrichment({
      hotelName: 'Le Meurice',
      faq_content_kit: withoutEn,
      faq_content: [],
      concierge_questions: Array.from({ length: CONCIERGE_QUESTIONS_MIN }, () => ({
        category_fr: 'Transferts & Transport',
        category_en: 'Transfers & Transport',
        question_fr: 'Transfert ?',
        reply_fr: 'Je réserve un VTC sous vingt-quatre heures.',
        question_en: 'Transfer?',
        reply_en: 'I book a chauffeur within twenty-four hours.',
      })),
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'kit.en_parity')).toBe(true);
  });
});
