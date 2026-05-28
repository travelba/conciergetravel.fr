import { describe, expect, it } from 'vitest';

import { isHotelIndexable } from './indexability';

const longDesc = 'x'.repeat(800);
const okFactual = 'x'.repeat(150);
const okFaq = Array.from({ length: 12 }, (_, i) => ({ question: `q${i}`, answer: 'a' }));
const okConcierge = { fr: { body: 'mon conseil...' }, en: { body: 'my tip...' } };

describe('isHotelIndexable', () => {
  it('photo-rich path: hero + 5+ gallery photos passes', () => {
    expect(
      isHotelIndexable({
        hero_image: 'mch/hotel/foo/hero.jpg',
        gallery_images: ['a', 'b', 'c', 'd', 'e'],
      }),
    ).toBe(true);
  });

  it('photo-rich path: hero + at least one long_description_section passes', () => {
    expect(
      isHotelIndexable({
        hero_image: 'mch/hotel/foo/hero.jpg',
        gallery_images: [],
        long_description_sections: [{ heading: 'h', body: 'b' }],
      }),
    ).toBe(true);
  });

  it('editorial path: section without hero passes (Phase 1)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [{ heading: 'h', body: 'b' }],
      }),
    ).toBe(true);
  });

  it('editorial path: full publish-gate set without photos passes', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: okFaq,
      }),
    ).toBe(true);
  });

  it('rejects: missing concierge_advice even with description + factual + faq', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: null,
        faq_content: okFaq,
      }),
    ).toBe(false);
  });

  it('rejects: short description (< 600 chars)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: 'x'.repeat(500),
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: okFaq,
      }),
    ).toBe(false);
  });

  it('rejects: FAQ < 10 items even with full text', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: Array.from({ length: 8 }, (_, i) => ({ question: `q${i}`, answer: 'a' })),
      }),
    ).toBe(false);
  });

  it('rejects: empty stub (no photos, no editorial content)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: '',
        factual_summary_fr: '',
        concierge_advice: null,
        faq_content: [],
      }),
    ).toBe(false);
  });
});
