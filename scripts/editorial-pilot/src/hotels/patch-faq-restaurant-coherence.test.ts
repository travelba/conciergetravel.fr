import { describe, expect, it } from 'vitest';

import {
  assertsSingleRestaurant,
  buildPlan,
  isContradictoryDiningItem,
  restaurantVenueCount,
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

describe('restaurantVenueCount', () => {
  it('counts only venues typed as Restaurant — bars/lounges never count', () => {
    expect(
      restaurantVenueCount({
        count: 3,
        venues: [
          { name: 'Da Noi In', type_en: 'Restaurant' },
          { name: 'Liquidambar', type_en: 'Restaurant' },
          { name: 'LabSolue Bar', type_en: 'Bar' },
        ],
      }),
    ).toBe(2);
  });

  it('does NOT falsely flag 1 restaurant + 2 bars (the Bugbot case)', () => {
    expect(
      restaurantVenueCount({
        venues: [
          { name: 'Main Restaurant', type_en: 'Restaurant' },
          { name: 'Pool Bar', type_en: 'Bar' },
          { name: 'Sky Lounge', type_en: 'Lounge' },
        ],
      }),
    ).toBe(1);
  });

  it('falls back to a conservative name heuristic when a venue has no type', () => {
    expect(
      restaurantVenueCount({
        venues: [{ name: 'Cliffside restaurant' }, { name: 'The Sun Lounge Bar', type_en: 'Bar' }],
      }),
    ).toBe(1);
  });

  it('does not count untyped ambiguous venues (least-destructive default)', () => {
    // A cooking school with no type must not inflate the restaurant count.
    expect(
      restaurantVenueCount({
        venues: [
          { name: 'Club del Doge Restaurant', type_en: 'Restaurant' },
          { name: 'The Gritti Epicurean School' },
        ],
      }),
    ).toBe(1);
  });

  it('returns 0 (never flags) when venue detail is missing — count alone is ambiguous', () => {
    expect(restaurantVenueCount({ count: 6 })).toBe(0);
    expect(restaurantVenueCount(null)).toBe(0);
    expect(restaurantVenueCount('nope')).toBe(0);
  });
});

describe('isContradictoryDiningItem', () => {
  it('is a contradiction only when restaurants >= 2 AND the answer is flat singular', () => {
    const item = { answer_en: 'The hotel has one on-site restaurant.' };
    expect(isContradictoryDiningItem(item, 6)).toBe(true);
    expect(isContradictoryDiningItem(item, 1)).toBe(false);
    expect(isContradictoryDiningItem({ answer_en: 'At least one restaurant.' }, 6)).toBe(false);
  });
});

describe('buildPlan', () => {
  const bigKit = Array.from({ length: 40 }, (_, i) => ({
    question_en: `Q${i}?`,
    answer_en: `A${i}.`,
  }));

  it('drops the contradictory item and keeps the rest, never emptying the field', () => {
    const row = {
      id: 'x',
      slug: 'gritti',
      restaurant_info: {
        venues: [
          { name: 'Club del Doge Restaurant', type_en: 'Restaurant' },
          { name: 'The Gritti Terrace', type_en: 'Restaurant' },
          { name: 'Terrazza', type_en: 'Restaurant' },
          { name: 'Bar Longhi', type_en: 'Bar' },
        ],
      },
      faq_content: null,
      faq_content_kit: [
        ...bigKit,
        {
          question_en: 'Restaurants?',
          answer_en: 'The hotel has one on-site restaurant, the Club del Doge.',
        },
      ],
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    const plan = buildPlan(row);
    expect(plan.patch.faq_content_kit).toHaveLength(40);
    expect(plan.dropped).toHaveLength(1);
    expect(plan.dropped[0]?.field).toBe('faq_content_kit');
  });

  it('does nothing for a hotel with 1 restaurant + 2 bars (correct singular FAQ)', () => {
    const row = {
      id: 'y',
      slug: 'one-resto-two-bars',
      restaurant_info: {
        count: 3,
        venues: [
          { name: 'Main Restaurant', type_en: 'Restaurant' },
          { name: 'Pool Bar', type_en: 'Bar' },
          { name: 'Lobby Lounge', type_en: 'Lounge' },
        ],
      },
      faq_content: [{ answer_en: 'The hotel has one on-site restaurant.' }],
      faq_content_kit: null,
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    expect(Object.keys(buildPlan(row).patch)).toHaveLength(0);
  });

  it('skips (and logs) a drop that would take faq_content below the CDC floor of 10', () => {
    const tenFaq = [
      { question_en: 'Restaurants?', answer_en: 'The hotel has one on-site restaurant.' },
      ...Array.from({ length: 9 }, (_, i) => ({ question_en: `Q${i}?`, answer_en: `A${i}.` })),
    ];
    const row = {
      id: 'z',
      slug: 'at-cdc-floor',
      restaurant_info: {
        venues: [
          { name: 'R1', type_en: 'Restaurant' },
          { name: 'R2', type_en: 'Restaurant' },
        ],
      },
      faq_content: tenFaq,
      faq_content_kit: null,
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    const plan = buildPlan(row);
    expect('faq_content' in plan.patch).toBe(false);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]?.reason).toContain('would_break_cdc_floor');
  });

  it('never empties a FAQ field even when every item contradicts', () => {
    const row = {
      id: 'w',
      slug: 'all-contradict',
      restaurant_info: {
        venues: [
          { name: 'R1', type_en: 'Restaurant' },
          { name: 'R2', type_en: 'Restaurant' },
        ],
      },
      faq_content: null,
      faq_content_kit: [{ answer_en: 'The hotel has one on-site restaurant.' }],
      geo_qa: null,
      concierge_questions: null,
    } as Parameters<typeof buildPlan>[0];
    const plan = buildPlan(row);
    expect('faq_content_kit' in plan.patch).toBe(false);
    expect(plan.skipped[0]?.reason).toBe('would_empty_field');
  });
});
