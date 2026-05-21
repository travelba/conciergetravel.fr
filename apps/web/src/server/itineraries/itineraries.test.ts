import { describe, expect, it } from 'vitest';

import { buildAeoBlock } from '@mch/seo';

import {
  ItineraryFaqEntrySchema,
  ItineraryRowSchema,
  ItinerarySectionSchema,
} from './get-itinerary-by-slug';
import { ListItinerariesFiltersSchema, rowToCard, sortCards } from './list-itineraries';
import {
  compareCandidates,
  scoreCandidate,
  type RelatedItineraryCard,
} from './get-related-itineraries';

/**
 * Pure unit tests — no Supabase, no `unstable_cache`. The point is to
 * lock down the editorial contract (Zod shapes, sorting determinism,
 * AEO 40-80 word envelope) so a regression breaks the CI before it
 * reaches the Supabase staging.
 *
 * Integration with the real DB is exercised by Playwright E2E in
 * Sprint 2, not here.
 */

// ============================================================================
// Fixtures
// ============================================================================

const VALID_SECTION = {
  step: 1,
  title_fr: 'Jour 1-2 : Tokyo — Immersion dans la mégapole',
  title_en: 'Day 1-2: Tokyo — Immersion in the megacity',
  body_fr: 'Body FR (≥150 mots dans la vraie fiche)',
  body_en: 'Body EN — never a literal translation, see rule 10',
  hotel_id: '00000000-0000-0000-0000-000000000001',
  duration_days: 2,
  city: 'Tokyo',
  poi: ['Senso-ji', 'Shibuya Crossing'],
};

const VALID_FAQ = {
  q_fr: 'Quelle est la meilleure période pour visiter le Japon ?',
  a_fr: 'Avril (cerisiers) et novembre (momiji) restent les fenêtres les plus prisées…',
  q_en: 'When is the best time to visit Japan?',
  a_en: 'April (cherry blossoms) and November (momiji)…',
  anchor: 'meilleure-periode-japon',
};

const VALID_AEO_ANSWER_FR = [
  'Pour 14 jours au Japon, votre Concierge recommande Tokyo (4 nuits, Aman Tokyo,',
  'quartier Otemachi) puis Kyoto (4 nuits, Park Hyatt Kyoto, colline Higashiyama)',
  'avant Hakone (2 nuits, vue Fuji). Incontournables : Asakusa, Arashiyama en tuk-tuk,',
  'kaiseki au Kikunoi. Période idéale : avril (cerisiers) ou novembre (momiji).',
  'Mis à jour mai 2026.',
].join(' ');

const VALID_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  slug_fr: 'japon-culture-2-semaines',
  slug_en: null,
  title_fr: 'Japon, 2 semaines culturelles',
  title_en: null,
  meta_title_fr: 'Itinéraire Japon 2 semaines — Palaces & Hôtels 5★ | MyConciergeHotel',
  meta_title_en: null,
  meta_desc_fr: 'Itinéraire Japon 14 jours…',
  meta_desc_en: null,
  intro_fr: 'Intro FR…',
  intro_en: null,
  aeo_question_fr: 'Quel est le meilleur itinéraire pour le Japon en 14 jours ?',
  aeo_answer_fr: VALID_AEO_ANSWER_FR,
  aeo_question_en: null,
  aeo_answer_en: null,
  country_code: 'JP',
  destination_region: null,
  destination_city: null,
  themes: ['culture', 'gastronomie'],
  duration_min_days: 14,
  duration_max_days: 14,
  travel_style: 'culture',
  season: 'printemps',
  hotel_ids: ['00000000-0000-0000-0000-000000000001'],
  sections: [VALID_SECTION],
  faq_content: [VALID_FAQ],
  related_ranking_ids: [],
  related_guide_slugs: [],
  related_itinerary_slugs: [],
  hero_cloudinary_id: 'editorial/itineraries/japon-culture-hero',
  hero_alt_fr: 'Pavillon d’or à Kyoto au coucher du soleil',
  hero_alt_en: 'Golden Pavilion in Kyoto at sunset',
  gallery_images: [],
  author_id: null,
  last_updated: '2026-05-21',
  status: 'published' as const,
  priority: 'P0' as const,
  word_count_target: 2000,
  created_at: '2026-05-21T08:00:00Z',
  updated_at: '2026-05-21T08:00:00Z',
};

// ============================================================================
// ItinerarySectionSchema
// ============================================================================

describe('ItinerarySectionSchema', () => {
  it('parses a complete section', () => {
    const result = ItinerarySectionSchema.safeParse(VALID_SECTION);
    expect(result.success).toBe(true);
  });

  it('accepts a draft section with empty body_en + missing poi', () => {
    const draft = { step: 2, title_fr: 'Étape 2', body_fr: 'Body…' };
    const result = ItinerarySectionSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.body_en).toBe('');
    expect(result.data.poi).toEqual([]);
  });

  it('rejects a section without a step number', () => {
    const result = ItinerarySectionSchema.safeParse({ title_fr: 'X', body_fr: 'X' });
    expect(result.success).toBe(false);
  });

  it('rejects step = 0 (1-based contract)', () => {
    const result = ItinerarySectionSchema.safeParse({ step: 0, title_fr: 'X', body_fr: 'X' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ItineraryFaqEntrySchema
// ============================================================================

describe('ItineraryFaqEntrySchema', () => {
  it('parses a complete bilingual entry', () => {
    expect(ItineraryFaqEntrySchema.safeParse(VALID_FAQ).success).toBe(true);
  });

  it('accepts FR-only entry (EN drafted later)', () => {
    const result = ItineraryFaqEntrySchema.safeParse({ q_fr: 'Q ?', a_fr: 'A.' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.q_en).toBe('');
    expect(result.data.a_en).toBe('');
  });

  it('rejects entry missing q_fr', () => {
    const result = ItineraryFaqEntrySchema.safeParse({ a_fr: 'A.' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ItineraryRowSchema — full payload
// ============================================================================

describe('ItineraryRowSchema', () => {
  it('parses a published row from the canonical fixture', () => {
    const result = ItineraryRowSchema.safeParse(VALID_ROW);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid country_code (not ISO-2 uppercase)', () => {
    const row = { ...VALID_ROW, country_code: 'jp' };
    const result = ItineraryRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown travel_style', () => {
    const row = { ...VALID_ROW, travel_style: 'wellness' };
    const result = ItineraryRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it('drops sections that fail their inner schema (defensive parse)', () => {
    const row = {
      ...VALID_ROW,
      sections: [VALID_SECTION, { step: 2 /* missing title_fr / body_fr */ }],
    };
    const result = ItineraryRowSchema.safeParse(row);
    // The outer schema now rejects: an array element fails. This is
    // intentional — we want the page to fall back to `null` rather
    // than rendering a half-broken HowTo block.
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// AEO contract — `buildAeoBlock` 40-80 words
// ============================================================================

describe('AEO block contract (CDC §5.3, rule itinerary-page.mdc §4)', () => {
  it("validates the canonical 14-day Japan answer (≈ 50 mots, freshness signal 'Mis à jour')", () => {
    const result = buildAeoBlock({
      question: 'Quel est le meilleur itinéraire pour le Japon en 14 jours ?',
      answer: VALID_AEO_ANSWER_FR,
      sourceUrl: 'https://myconciergehotel.com/fr/itineraire/japon-culture-2-semaines',
      updatedAt: '2026-05-21',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wordCount).toBeGreaterThanOrEqual(40);
    expect(result.value.wordCount).toBeLessThanOrEqual(80);
    expect(result.value.answer).toContain('Mis à jour');
  });

  it('rejects answer < 40 mots with `too_short` error', () => {
    const tooShort = 'Tokyo, Kyoto, Hakone. Avril ou novembre.';
    const result = buildAeoBlock({
      question: 'Q ?',
      answer: tooShort,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('too_short');
  });

  it('rejects answer > 80 mots with `too_long` error', () => {
    const word = 'mot';
    const tooLong = Array(81).fill(word).join(' ');
    const result = buildAeoBlock({ question: 'Q ?', answer: tooLong });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('too_long');
  });

  it('rejects empty question', () => {
    const result = buildAeoBlock({ question: '   ', answer: VALID_AEO_ANSWER_FR });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty_question');
  });
});

// ============================================================================
// ListItinerariesFiltersSchema
// ============================================================================

describe('ListItinerariesFiltersSchema', () => {
  it('defaults limit to 60 when missing', () => {
    const result = ListItinerariesFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.limit).toBe(60);
  });

  it('rejects an invalid country_code', () => {
    const result = ListItinerariesFiltersSchema.safeParse({ country_code: 'fra' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown travel_style', () => {
    const result = ListItinerariesFiltersSchema.safeParse({ travel_style: 'wellness' });
    expect(result.success).toBe(false);
  });

  it('caps limit at 100', () => {
    const result = ListItinerariesFiltersSchema.safeParse({ limit: 500 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// rowToCard + sortCards
// ============================================================================

describe('rowToCard', () => {
  it('returns null on a malformed row', () => {
    expect(rowToCard({})).toBeNull();
    expect(rowToCard({ id: 'not-a-uuid' })).toBeNull();
  });

  it('projects a Supabase row into the card shape', () => {
    const card = rowToCard(VALID_ROW);
    expect(card).not.toBeNull();
    if (card === null) return;
    expect(card.slugFr).toBe('japon-culture-2-semaines');
    expect(card.countryCode).toBe('JP');
    expect(card.themes).toEqual(['culture', 'gastronomie']);
    expect(card.hotelCount).toBe(1);
    expect(card.priority).toBe('P0');
  });
});

describe('sortCards', () => {
  function card(opts: {
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    lastUpdated: string;
    titleFr: string;
  }) {
    return {
      id: 'x',
      slugFr: opts.titleFr.toLowerCase(),
      slugEn: null,
      titleFr: opts.titleFr,
      titleEn: null,
      metaDescFr: null,
      metaDescEn: null,
      countryCode: 'FR',
      destinationRegion: null,
      destinationCity: null,
      themes: [],
      durationMinDays: 3,
      durationMaxDays: null,
      travelStyle: 'luxe',
      season: null,
      priority: opts.priority,
      heroCloudinaryId: null,
      heroAltFr: null,
      heroAltEn: null,
      hotelCount: 0,
      lastUpdated: opts.lastUpdated,
    };
  }

  it('orders P0 → P3', () => {
    const sorted = sortCards([
      card({ priority: 'P2', lastUpdated: '2026-05-01', titleFr: 'B' }),
      card({ priority: 'P0', lastUpdated: '2026-05-01', titleFr: 'A' }),
      card({ priority: 'P1', lastUpdated: '2026-05-01', titleFr: 'C' }),
    ]);
    expect(sorted.map((c) => c.priority)).toEqual(['P0', 'P1', 'P2']);
  });

  it('breaks priority ties by lastUpdated DESC', () => {
    const sorted = sortCards([
      card({ priority: 'P0', lastUpdated: '2026-04-01', titleFr: 'Older' }),
      card({ priority: 'P0', lastUpdated: '2026-05-21', titleFr: 'Newer' }),
    ]);
    expect(sorted[0]?.titleFr).toBe('Newer');
  });

  it('breaks lastUpdated ties by titleFr ASC', () => {
    const sorted = sortCards([
      card({ priority: 'P0', lastUpdated: '2026-05-01', titleFr: 'Bordeaux' }),
      card({ priority: 'P0', lastUpdated: '2026-05-01', titleFr: 'Alsace' }),
    ]);
    expect(sorted[0]?.titleFr).toBe('Alsace');
  });
});

// ============================================================================
// scoreCandidate + compareCandidates (related itineraries)
// ============================================================================

describe('scoreCandidate', () => {
  const source = { themes: ['culture', 'gastronomie'], travel_style: 'culture' } as const;

  it('counts theme overlap correctly', () => {
    const score = scoreCandidate(
      {
        id: 'x',
        slug_fr: 'x',
        slug_en: null,
        title_fr: 'X',
        title_en: null,
        hero_cloudinary_id: null,
        hero_alt_fr: null,
        hero_alt_en: null,
        duration_min_days: 7,
        duration_max_days: null,
        travel_style: 'culture',
        themes: ['gastronomie', 'romantique'],
        priority: 'P1',
        last_updated: '2026-05-01',
      },
      source,
    );
    expect(score.themeOverlap).toBe(1);
    expect(score.styleMatch).toBe(true);
  });

  it('returns 0 overlap when no theme matches', () => {
    const score = scoreCandidate(
      {
        id: 'x',
        slug_fr: 'x',
        slug_en: null,
        title_fr: 'X',
        title_en: null,
        hero_cloudinary_id: null,
        hero_alt_fr: null,
        hero_alt_en: null,
        duration_min_days: 7,
        duration_max_days: null,
        travel_style: 'aventure',
        themes: ['romantique'],
        priority: 'P2',
        last_updated: '2026-05-01',
      },
      source,
    );
    expect(score.themeOverlap).toBe(0);
    expect(score.styleMatch).toBe(false);
  });
});

describe('compareCandidates', () => {
  function entry(
    overlap: number,
    styleMatch: boolean,
    priority: 'P0' | 'P1' | 'P2' | 'P3',
    lastUpdated: string,
    titleFr: string,
  ) {
    return { themeOverlap: overlap, styleMatch, priority, lastUpdated, titleFr };
  }

  it('ranks higher overlap first', () => {
    expect(
      compareCandidates(
        entry(2, true, 'P1', '2026-05-01', 'A'),
        entry(0, true, 'P0', '2026-05-21', 'Z'),
      ),
    ).toBeLessThan(0);
  });

  it('on equal overlap, ranks styleMatch=true first', () => {
    expect(
      compareCandidates(
        entry(1, true, 'P2', '2026-05-01', 'A'),
        entry(1, false, 'P0', '2026-05-21', 'Z'),
      ),
    ).toBeLessThan(0);
  });

  it('on equal overlap+style, ranks lower priority number (P0) first', () => {
    expect(
      compareCandidates(
        entry(1, true, 'P0', '2026-05-01', 'A'),
        entry(1, true, 'P3', '2026-05-21', 'Z'),
      ),
    ).toBeLessThan(0);
  });

  it('on equal overlap+style+priority, ranks newer lastUpdated first', () => {
    expect(
      compareCandidates(
        entry(1, true, 'P0', '2026-05-21', 'Z'),
        entry(1, true, 'P0', '2026-04-01', 'A'),
      ),
    ).toBeLessThan(0);
  });
});

// Type-level smoke test — make sure the public type stays exported and
// has the contract expected by the consumer page.
const _typeCheck: RelatedItineraryCard | null = null;
void _typeCheck;
