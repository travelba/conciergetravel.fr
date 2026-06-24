import { describe, expect, it } from 'vitest';

import {
  buildRankingMetaDescription,
  RANKING_META_DESC_CEILING,
  RANKING_META_DESC_FLOOR,
  truncateAtWordBoundary,
} from './ranking-meta-description';

const FR_META =
  'Découvrez les 33 Palaces distingués par Atout France au 2 juin 2026, les nouveaux entrants, les retraits, et pourquoi 5 étoiles ne veut pas dire Palace.';
const EN_SHORT_META = "Discover France's 33 Atout France Palace hotels as of June 2, 2026.";
const EN_FACTUAL =
  'France lists 33 Atout France Palace hotels as of June 2026: 12 in Paris, the rest on the Riviera, in the Alps and the vineyards. New entrants, removals and the Palace-vs-5-star distinction explained.';

describe('truncateAtWordBoundary', () => {
  it('leaves short text untouched', () => {
    expect(truncateAtWordBoundary('Short text', 170)).toBe('Short text');
  });

  it('cuts at a word boundary and appends an ellipsis', () => {
    const out = truncateAtWordBoundary('one two three four five six', 12);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('thr…'); // no mid-word cut
    expect(out.length).toBeLessThanOrEqual(13);
  });
});

describe('buildRankingMetaDescription', () => {
  it('keeps a well-sized FR meta description as-is', () => {
    const out = buildRankingMetaDescription({
      locale: 'fr',
      metaDescFr: FR_META,
      metaDescEn: EN_SHORT_META,
      factualSummaryFr: null,
      factualSummaryEn: null,
      introFr: 'intro fr',
      introEn: null,
    });
    expect(out).toBe(FR_META);
  });

  it('replaces a too-short EN meta with the richer EN factual summary', () => {
    const out = buildRankingMetaDescription({
      locale: 'en',
      metaDescFr: FR_META,
      metaDescEn: EN_SHORT_META,
      factualSummaryFr: null,
      factualSummaryEn: EN_FACTUAL,
      introFr: 'intro fr',
      introEn: null,
    });
    expect(out).not.toBe(EN_SHORT_META);
    expect(out.length).toBeGreaterThanOrEqual(RANKING_META_DESC_FLOOR);
    expect(out.length).toBeLessThanOrEqual(RANKING_META_DESC_CEILING);
  });

  it('does not regress to a FR intro on an EN page when an EN intro clears the floor', () => {
    const enIntro =
      'France lists thirty-three Atout France Palace hotels in June 2026 across Paris, the Riviera, the Alps and the great vineyards, each audited on service and heritage.';
    const out = buildRankingMetaDescription({
      locale: 'en',
      metaDescFr: FR_META,
      metaDescEn: null,
      factualSummaryFr: null,
      factualSummaryEn: null,
      introFr: 'Intro FR à ne pas utiliser sur une page anglaise.',
      introEn: enIntro,
    });
    expect(out.startsWith('France lists')).toBe(true);
  });

  it('falls back to FR only when no usable EN source exists', () => {
    const out = buildRankingMetaDescription({
      locale: 'en',
      metaDescFr: FR_META,
      metaDescEn: null,
      factualSummaryFr: null,
      factualSummaryEn: null,
      introFr: FR_META,
      introEn: null,
    });
    expect(out).toBe(FR_META);
  });
});
