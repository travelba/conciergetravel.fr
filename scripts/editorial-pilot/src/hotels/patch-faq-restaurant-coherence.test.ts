import { describe, expect, it } from 'vitest';

import {
  assertsSingleRestaurant,
  buildPlan,
  isContradictoryDiningItem,
  venueCount,
} from './patch-faq-restaurant-coherence.js';

describe('assertsSingleRestaurant', () => {
  it('flags flat singular assertions (en + fr)', () => {
    expect(
      assertsSingleRestaurant('The hotel has one on-site restaurant, the Club del Doge.'),
    ).toBe(true);
    expect(assertsSingleRestaurant('A single restaurant is confirmed on site.')).toBe(true);
    expect(assertsSingleRestaurant('L’hôtel dispose d’un seul restaurant sur place.')).toBe(true);
  });

  it('ignores the consistent "at least one" floor and hedged phrasings', () => {
    expect(assertsSingleRestaurant('There is at least one on-site restaurant.')).toBe(false);
    expect(assertsSingleRestaurant('One restaurant as well as a rooftop bar.')).toBe(false);
    expect(assertsSingleRestaurant('Au moins un restaurant est ouvert.')).toBe(false);
  });

  it('ignores unrelated dining prose', () => {
    expect(assertsSingleRestaurant('The hotel offers several dining venues.')).toBe(false);
    expect(assertsSingleRestaurant('')).toBe(false);
  });
});

describe('venueCount', () => {
  it('reads the venues array length, then count', () => {
    expect(venueCount({ venues: [{}, {}, {}] })).toBe(3);
    expect(venueCount({ count: 6 })).toBe(6);
    expect(venueCount(null)).toBe(0);
    expect(venueCount('nope')).toBe(0);
  });
});

describe('isContradictoryDiningItem', () => {
  it('is a contradiction only when venues >= 2 AND the answer is flat singular', () => {
    const item = { answer_en: 'The hotel has one on-site restaurant.' };
    expect(isContradictoryDiningItem(item, 6)).toBe(true);
    expect(isContradictoryDiningItem(item, 1)).toBe(false);
    expect(isContradictoryDiningItem({ answer_en: 'At least one restaurant.' }, 6)).toBe(false);
  });
});

describe('buildPlan', () => {
  it('drops the contradictory item and keeps the rest, never emptying the field', () => {
    const row = {
      id: 'x',
      slug: 'gritti',
      restaurant_info: { venues: [1, 2, 3, 4, 5, 6] },
      faq_content: [
        {
          question_en: 'Restaurants?',
          answer_en: 'The hotel has one on-site restaurant, the Club del Doge.',
        },
        { question_en: 'Spa?', answer_en: 'Yes, there is a spa.' },
      ],
      faq_content_kit: null,
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    const plan = buildPlan(row);
    expect(plan.patch.faq_content).toHaveLength(1);
    expect(plan.dropped).toHaveLength(1);
    expect(plan.dropped[0]?.field).toBe('faq_content');
  });

  it('does nothing for a single-venue hotel', () => {
    const row = {
      id: 'y',
      slug: 'solo',
      restaurant_info: { venues: [1] },
      faq_content: [{ answer_en: 'The hotel has one on-site restaurant.' }],
      faq_content_kit: null,
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    expect(Object.keys(buildPlan(row).patch)).toHaveLength(0);
  });
});
