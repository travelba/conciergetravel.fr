import { describe, expect, it } from 'vitest';

import { buildRankingPlan, reviseMetaDesc, shouldDropFaq } from './patch-dataseo-p0-rankings';

describe('shouldDropFaq', () => {
  it('drops celebrity / net-worth noise', () => {
    expect(shouldDropFaq({ question_fr: 'Quelle star habite à Saint-Tropez ?' }).drop).toBe(true);
    expect(shouldDropFaq({ question_en: 'What is the net worth of the owner?' }).drop).toBe(true);
  });
  it('drops the four named Phase-6 angles (refund/promo/live-price/availability)', () => {
    expect(shouldDropFaq({ question_en: 'What is the refund policy?' }).reason).toBe('phase6');
    expect(shouldDropFaq({ question_fr: 'Y a-t-il un code promo ?' }).reason).toBe('phase6');
    expect(shouldDropFaq({ question_fr: 'Le tarif est-il remboursable ?' }).reason).toBe('phase6');
    expect(shouldDropFaq({ question_en: 'Is there a best rate guarantee?' }).reason).toBe('phase6');
  });
  it('drops the cancellation / refundable-rate angle', () => {
    expect(
      shouldDropFaq({
        question_fr:
          'Les hôtels de luxe à Rome proposent-ils des conditions d’annulation flexibles ?',
      }).reason,
    ).toBe('phase6');
    expect(
      shouldDropFaq({
        question_en: 'Do luxury hotels in Rome offer flexible cancellation policies?',
      }).reason,
    ).toBe('phase6');
  });
  it('KEEPS loyalty + concierge-CTA questions (on-brand, allowed by the freeze)', () => {
    expect(
      shouldDropFaq({ question_fr: 'Comment réserver ces hôtels via MyConciergeHotel.com ?' }).drop,
    ).toBe(false);
    expect(
      shouldDropFaq({
        question_fr: 'Existe-t-il des programmes de fidélité à réserver en direct ?',
      }).drop,
    ).toBe(false);
  });
  it('keeps legitimate editorial questions', () => {
    expect(
      shouldDropFaq({ question_fr: 'Quels sont les meilleurs hôtels spa à Nice ?' }).drop,
    ).toBe(false);
    expect(
      shouldDropFaq({ question_fr: 'Quel hôtel choisir pour un séjour romantique ?' }).drop,
    ).toBe(false);
    expect(shouldDropFaq({ question_en: 'Which hotels have the best sea views?' }).drop).toBe(
      false,
    );
  });
  it('keeps seasonality + methodology questions (answers ignored)', () => {
    // "réserver un hôtel" (generic) must NOT trip the booking-how-to pattern.
    expect(
      shouldDropFaq({
        question_fr: 'Quel est le meilleur moment pour réserver un hôtel de luxe à Lisbonne ?',
        question_en: 'What is the best time to book a luxury hotel in Lisbon?',
        answer_fr: 'Les meilleurs tarifs se trouvent en basse saison.',
      }).drop,
    ).toBe(false);
    expect(
      shouldDropFaq({
        question_fr:
          'Sur quels critères établissez-vous ce classement des meilleurs hôtels à Phuket ?',
      }).drop,
    ).toBe(false);
    expect(
      shouldDropFaq({
        question_fr: 'Quel budget prévoir pour une nuit dans un 5 étoiles à Bordeaux ?',
      }).drop,
    ).toBe(false);
  });
});

describe('reviseMetaDesc', () => {
  it('trims an over-band description to <=170 at a boundary', () => {
    const long =
      'Notre sélection des meilleurs hôtels spa à Nice réunit palaces et adresses de charme. ' +
      'Chaque établissement a été choisi pour son spa signature, sa table et son service. ' +
      'Découvrez notre classement complet ci-dessous en détail.';
    const { value, changed } = reviseMetaDesc(long);
    expect(changed).toBe(true);
    expect(value.length).toBeLessThanOrEqual(170);
    expect(value.length).toBeGreaterThanOrEqual(140);
  });
  it('strips a Phase-6 promo clause', () => {
    const src =
      'Les meilleurs hôtels spa de Paris 8e, sélectionnés par notre Concierge pour leur excellence. Réservez au meilleur prix garanti dès maintenant.';
    const { value } = reviseMetaDesc(src);
    expect(value.toLowerCase()).not.toContain('meilleur prix');
    expect(value.toLowerCase()).not.toContain('réservez');
  });
  it('leaves an in-band description untouched', () => {
    const ok =
      'Notre sélection des meilleurs hôtels spa à Nice : palaces et adresses de charme choisis par le Concierge pour leur excellence absolue.';
    const { changed } = reviseMetaDesc(ok);
    expect(changed).toBe(false);
  });
});

describe('buildRankingPlan', () => {
  const base = {
    id: 'r1',
    slug: 'meilleurs-hotels-spa-nice',
    meta_desc_fr: null,
    meta_desc_en: null,
    faq: null,
  };
  it('plans a faq filter but never empties the column', () => {
    const plan = buildRankingPlan({
      ...base,
      faq: [
        {
          question_fr: 'Quels sont les meilleurs hôtels spa à Nice ?',
          answer_fr: 'Le classement ci-dessous.',
        },
        { question_fr: 'Quelle star habite à Nice ?', answer_fr: 'Bruit.' },
      ],
    });
    expect(Array.isArray(plan.patch.faq)).toBe(true);
    expect((plan.patch.faq as unknown[]).length).toBe(1);
    expect(plan.droppedFaq).toHaveLength(1);
  });
  it('does not empty faq when every item is noise', () => {
    const plan = buildRankingPlan({
      ...base,
      faq: [{ question_fr: 'Quelle star habite à Nice ?', answer_fr: 'Bruit.' }],
    });
    expect('faq' in plan.patch).toBe(false);
    expect(plan.notes).toContain('faq_all_dropped_kept_as_is');
  });
});
