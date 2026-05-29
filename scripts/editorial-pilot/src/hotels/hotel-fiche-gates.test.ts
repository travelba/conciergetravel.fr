import { describe, expect, it } from 'vitest';

import { isFaqCanonicalSet, CANONICAL_FAQ_QUESTIONS } from './canonical-faq-questions.js';
import {
  countWords,
  deriveStatus,
  evaluateHotelFiche,
  evaluateIndexability,
  evaluatePublishGate,
  type HotelAuditRow,
} from './hotel-fiche-gates.js';
import { ADVICE_BODY_MIN_WORDS } from './concierge-advice-generator.js';
import { FACTUAL_SUMMARY_MIN_CHARS } from './factual-summary-generator.js';

function buildAdviceBody(wordCount: number): string {
  const words = Array.from({ length: wordCount }, (_, i) => `mot${i}`);
  return words.join(' ');
}

function buildCanonicalFaq(name: string): Array<{
  question_fr: string;
  question_en: string;
  answer_fr: string;
  answer_en: string;
  featured: boolean;
  concierge_tip_fr: string;
}> {
  return CANONICAL_FAQ_QUESTIONS.map((q, i) => ({
    question_fr: q.question_fr.replaceAll('{{name}}', name),
    question_en: q.question_en.replaceAll('{{name}}', name),
    answer_fr: buildAdviceBody(55),
    answer_en: buildAdviceBody(55),
    featured: i < 5,
    concierge_tip_fr: 'Conseil pratique du Concierge pour cette question.',
  }));
}

function buildLongSections(count: number): Array<{
  anchor: string;
  title_fr: string;
  body_fr: string;
}> {
  return Array.from({ length: count }, (_, i) => ({
    anchor: `section-${i + 1}`,
    title_fr: `Section ${i + 1}`,
    body_fr: buildAdviceBody(220),
  }));
}

/** Reference-quality fiche (le-meurice shape). */
function referenceHotelRow(): HotelAuditRow {
  const fsFr =
    'Palace cinq étoiles situé au cœur de Paris, à deux pas du Louvre, avec restauration Ducasse et spa Carita.';
  const fsEn =
    'Palace five-star hotel in central Paris, steps from the Louvre, with Ducasse dining and Carita spa.';
  const name = 'Le Meurice';
  return {
    slug: 'le-meurice',
    name,
    is_published: true,
    luxury_tier: 'palace_atout_france',
    country_code: 'FR',
    priority: 'P0',
    description_fr: 'x'.repeat(900),
    description_en: 'x'.repeat(900),
    meta_title_fr: 'Le Meurice Paris — Palace face au Jardin des Tuileries',
    meta_title_en: 'Le Meurice Paris — Palace overlooking the Tuileries Garden',
    meta_desc_fr: 'x'.repeat(155),
    meta_desc_en: 'x'.repeat(155),
    factual_summary_fr: fsFr.padEnd(FACTUAL_SUMMARY_MIN_CHARS, '.'),
    factual_summary_en: fsEn.padEnd(FACTUAL_SUMMARY_MIN_CHARS, '.'),
    concierge_advice: {
      fr: {
        title: 'Chambre 501 vue Tuileries au coucher du soleil',
        body: buildAdviceBody(60),
        tip_for: 'room',
      },
      en: {
        title: 'Room 501 Tuileries view at sunset',
        body: buildAdviceBody(60),
        tip_for: 'room',
      },
    },
    faq_content: buildCanonicalFaq(name),
    long_description_sections: buildLongSections(4),
    highlights: [
      { label_fr: 'Vue Tuileries' },
      { label_fr: 'Spa Carita' },
      { label_fr: 'Ducasse' },
    ],
    amenities: [{ key: 'spa', label_fr: 'Spa' }],
    points_of_interest: [
      { name_fr: 'Louvre', distance_meters: 200 },
      { name_fr: 'Tuileries', distance_meters: 50 },
      { name_fr: 'Place Vendôme', distance_meters: 800 },
    ],
    transports: [{ mode: 'metro', station: 'Tuileries' }],
    restaurant_info: { count: 2 },
    spa_info: { name: 'Spa Carita' },
    policies: {
      check_in: { time_fr: '15:00' },
      check_out: { time_fr: '12:00' },
      cancellation: { summary_fr: '48h' },
      pets: { allowed: false },
      wifi: { free: true },
    },
    awards: [{ name_fr: 'Palace', verified: true }],
    affiliations: [{ kind: 'label', verified: true, display_name: 'Palace' }],
    signature_experiences: [{ key: 'spa', title_fr: 'Spa' }],
    number_of_rooms: 160,
    opened_at: '1835-01-01',
    official_url: 'https://www.dorchestercollection.com/en/paris/le-meurice/',
    wikidata_id: 'Q650971',
    hero_image: 'cct/hotels/le-meurice/hero-1',
    gallery_images: [{ public_id: 'a' }, { public_id: 'b' }],
    updated_at: '2026-05-28T00:00:00Z',
  };
}

/** Mass-publish R&C draft promoted with minimal Phase 1 gate only. */
function relaisChateauxMinimalRow(): HotelAuditRow {
  const name = 'Domaine Example';
  return {
    slug: 'domaine-example',
    name,
    is_published: true,
    luxury_tier: 'relais_chateaux',
    country_code: 'FR',
    priority: 'P2',
    description_fr: 'x'.repeat(650),
    description_en: 'x'.repeat(650),
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: 'x'.repeat(120),
    meta_desc_en: 'x'.repeat(120),
    factual_summary_fr:
      "Hôtel cinq étoiles situé en Provence, à 30 km d'Avignon, avec piscine chauffée, spa et table gastronomique étoilée.",
    factual_summary_en:
      'Hotel five-star in Provence, 30 km from Avignon, with heated pool, spa and Michelin-starred dining room.',
    concierge_advice: {
      fr: { title: 'Chambre terrasse est', body: buildAdviceBody(35), tip_for: 'room' },
      en: { title: 'East terrace room', body: buildAdviceBody(35), tip_for: 'room' },
    },
    faq_content: Array.from({ length: 10 }, (_, i) => ({
      question_fr: `Question ad hoc ${i + 1}?`,
      answer_fr: buildAdviceBody(20),
    })),
    long_description_sections: [],
    highlights: null,
    amenities: null,
    points_of_interest: null,
    transports: null,
    restaurant_info: null,
    spa_info: null,
    policies: null,
    awards: null,
    affiliations: [{ kind: 'brand', verified: true, display_name: 'Relais & Châteaux' }],
    signature_experiences: null,
    number_of_rooms: null,
    opened_at: null,
    official_url: null,
    wikidata_id: null,
    hero_image: null,
    gallery_images: null,
    updated_at: '2026-05-28T00:00:00Z',
  };
}

function emptyDraftRow(): HotelAuditRow {
  return {
    slug: 'brach-paris',
    name: 'Brach Paris',
    is_published: false,
    luxury_tier: 'evok_hotels',
    country_code: 'FR',
    priority: 'P1',
    description_fr: null,
    description_en: null,
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: null,
    meta_desc_en: null,
    factual_summary_fr: null,
    factual_summary_en: null,
    concierge_advice: null,
    faq_content: null,
    long_description_sections: null,
    highlights: null,
    amenities: null,
    points_of_interest: null,
    transports: null,
    restaurant_info: null,
    spa_info: null,
    policies: null,
    awards: null,
    affiliations: null,
    signature_experiences: null,
    number_of_rooms: null,
    opened_at: null,
    official_url: null,
    wikidata_id: null,
    hero_image: null,
    gallery_images: null,
    updated_at: null,
  };
}

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('Mon conseil : une phrase courte.')).toBe(6);
  });
});

describe('isFaqCanonicalSet', () => {
  it('accepts the 10 CDC questions with name substitution', () => {
    const items = buildCanonicalFaq('Le Meurice');
    expect(isFaqCanonicalSet(items, 'Le Meurice')).toBe(true);
  });

  it('rejects ad-hoc FAQ sets', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      question_fr: `Question ${i}?`,
    }));
    expect(isFaqCanonicalSet(items, 'Test')).toBe(false);
  });
});

describe('evaluatePublishGate', () => {
  it('passes reference fiche', () => {
    expect(evaluatePublishGate(referenceHotelRow()).pass).toBe(true);
  });

  it('passes minimal R&C row (30-word advice gate)', () => {
    expect(evaluatePublishGate(relaisChateauxMinimalRow()).pass).toBe(true);
  });

  it('fails empty draft', () => {
    expect(evaluatePublishGate(emptyDraftRow()).pass).toBe(false);
  });
});

describe('evaluateIndexability', () => {
  it('indexes reference via photo-rich path', () => {
    expect(evaluateIndexability(referenceHotelRow())).toBe(true);
  });

  it('indexes minimal R&C via editorial text gate', () => {
    expect(evaluateIndexability(relaisChateauxMinimalRow())).toBe(true);
  });

  it('does not index empty draft', () => {
    expect(evaluateIndexability(emptyDraftRow())).toBe(false);
  });
});

describe('evaluateHotelFiche', () => {
  it('scores reference fiche as complete', () => {
    const result = evaluateHotelFiche(referenceHotelRow());
    expect(result.status).toBe('complete');
    expect(result.score_t3).toBeGreaterThanOrEqual(95);
    expect(result.indexable).toBe(true);
  });

  it('scores minimal R&C as gap with many editorial gaps', () => {
    const result = evaluateHotelFiche(relaisChateauxMinimalRow());
    expect(result.status).toBe('gap');
    expect(result.score_t3).toBeLessThan(70);
    expect(result.gaps.some((g) => g.field === 'meta_desc_fr')).toBe(true);
    expect(result.gaps.some((g) => g.field === 'meta_title_fr')).toBe(true);
    expect(result.gaps.some((g) => g.field === 'long_description_sections')).toBe(true);
    expect(result.gaps.some((g) => g.field === 'faq_content')).toBe(true);
  });

  it('marks empty draft with draft status', () => {
    const result = evaluateHotelFiche(emptyDraftRow());
    expect(result.status).toBe('draft');
    expect(deriveStatus(emptyDraftRow(), result.score_t3)).toBe('draft');
  });

  it('flags concierge advice below runtime 50-word envelope on minimal row', () => {
    const result = evaluateHotelFiche(relaisChateauxMinimalRow());
    expect(
      result.gaps.some(
        (g) =>
          g.field.startsWith('concierge_advice') &&
          g.message.includes(String(ADVICE_BODY_MIN_WORDS)),
      ),
    ).toBe(true);
  });
});
