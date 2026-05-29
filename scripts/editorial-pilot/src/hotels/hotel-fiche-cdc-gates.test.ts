import { describe, expect, it } from 'vitest';

import {
  evaluateCdcHotelFiche,
  CDC_COMPLETE_THRESHOLD,
  type CdcAuditContext,
  type CdcHotelAuditRow,
} from './hotel-fiche-cdc-gates.js';
import { evaluateHotelFiche, type HotelAuditRow } from './hotel-fiche-gates.js';
import { ADVICE_BODY_MIN_WORDS } from './concierge-advice-generator.js';
import { FACTUAL_SUMMARY_MIN_CHARS } from './factual-summary-generator.js';
import { CANONICAL_FAQ_QUESTIONS } from './canonical-faq-questions.js';

function buildWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');
}

function buildAdviceBody(n: number): string {
  return `Mon conseil : ${buildWords(n)}`;
}

function buildCanonicalFaq(name: string) {
  return CANONICAL_FAQ_QUESTIONS.map((q, i) => ({
    question_fr: q.question_fr.replaceAll('{{name}}', name),
    question_en: q.question_en.replaceAll('{{name}}', name),
    answer_fr: buildWords(55),
    answer_en: buildWords(55),
    featured: i < 5,
    concierge_tip_fr: 'Astuce Concierge pour cette question.',
  }));
}

function baseCdcRow(overrides: Partial<CdcHotelAuditRow> = {}): CdcHotelAuditRow {
  const name = 'Le Meurice';
  const fsFr =
    'Palace cinq étoiles situé au cœur de Paris, à deux pas du Louvre, avec restauration Ducasse et spa Carita.';
  const row: CdcHotelAuditRow = {
    slug: 'le-meurice',
    slug_en: 'le-meurice',
    name,
    name_en: 'Le Meurice',
    is_published: true,
    luxury_tier: 'palace_atout_france',
    country_code: 'FR',
    priority: 'P0',
    stars: 5,
    is_palace: true,
    city: 'Paris',
    district: '1er',
    address: '228 Rue de Rivoli, 75001 Paris',
    postal_code: '75001',
    latitude: 48.865,
    longitude: 2.328,
    phone_e164: '+33144585050',
    email_reservations: 'reservations@dorchestercollection.com',
    description_fr: 'x'.repeat(900),
    description_en: 'x'.repeat(900),
    meta_title_fr: 'Le Meurice Paris — Palace face au Jardin des Tuileries',
    meta_title_en: 'Le Meurice Paris — Palace overlooking the Tuileries Garden',
    meta_desc_fr: 'x'.repeat(155),
    meta_desc_en: 'x'.repeat(155),
    factual_summary_fr: fsFr.padEnd(FACTUAL_SUMMARY_MIN_CHARS, '.'),
    factual_summary_en: fsFr.padEnd(FACTUAL_SUMMARY_MIN_CHARS, '.'),
    concierge_advice: {
      fr: { title: 'Suite 501', body: buildAdviceBody(60), tip_for: 'room' },
      en: { title: 'Suite 501', body: `My tip: ${buildWords(60)}`, tip_for: 'room' },
    },
    faq_content: buildCanonicalFaq(name),
    long_description_sections: [
      { anchor: 'a', title_fr: 'Histoire', body_fr: buildWords(220) },
      { anchor: 'b', title_fr: 'Chambres', body_fr: buildWords(220) },
      { anchor: 'c', title_fr: 'Gastronomie', body_fr: buildWords(220) },
    ],
    highlights: [{ label_fr: 'A' }, { label_fr: 'B' }, { label_fr: 'C' }],
    amenities: Array.from({ length: 80 }, (_, i) => ({ key: `amenity-${i}`, label_fr: `A${i}` })),
    points_of_interest: [
      { name_fr: 'Louvre', distance_meters: 200 },
      { name_fr: 'Tuileries', distance_meters: 50 },
      { name_fr: 'Vendôme', distance_meters: 800 },
    ],
    transports: [{ mode: 'metro' }],
    restaurant_info: { count: 2 },
    spa_info: { name: 'Carita' },
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
    number_of_suites: 20,
    opened_at: '1835',
    official_url: 'https://www.dorchestercollection.com/en/paris/le-meurice/',
    wikidata_id: 'Q650971',
    wikipedia_url_fr: 'https://fr.wikipedia.org/wiki/Le_Meurice',
    wikipedia_url_en: 'https://en.wikipedia.org/wiki/H%C3%B4tel_Le_Meurice',
    external_sameas: ['https://www.wikidata.org/wiki/Q650971'],
    hero_image: 'cct/hotels/le-meurice/hero-1',
    gallery_images: REQUIRED_GALLERY(),
    hero_video: { url: 'https://example.com/video.mp4' },
    virtual_tour_url: 'https://example.com/tour',
    google_rating: 4.8,
    google_reviews_count: 1200,
    featured_reviews: [{ source: 'Forbes' }],
    mice_info: { capacity: 200 },
    booking_mode: 'display_only',
    upcoming_events: null,
    updated_at: '2026-05-28T00:00:00Z',
  };
  return { ...row, ...overrides };
}

function REQUIRED_GALLERY(): Array<Record<string, string>> {
  const cats = [
    'exterior',
    'lobby',
    'room',
    'dining',
    'spa',
    'pool',
    'view',
    'detail',
    'concierge',
    'events',
  ];
  return cats.flatMap((category, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      public_id: `cct/hotels/le-meurice/${category}-${i}-${j}`,
      category,
      alt_fr: `Vue ${category} Hôtel Le Meurice Paris`,
      alt_en: `${category} view Le Meurice Hotel Paris`,
    })),
  );
}

const fullCtx: CdcAuditContext = {
  roomStats: { total: 5, withSlug: 5, indexable: 2 },
  guideSlug: 'paris',
};

describe('evaluateCdcHotelFiche', () => {
  it('reference fiche scores high on CDC target', () => {
    const result = evaluateCdcHotelFiche(baseCdcRow(), fullCtx);
    expect(result.score_cdc).toBeGreaterThanOrEqual(CDC_COMPLETE_THRESHOLD - 5);
    expect(result.score_global).toBeGreaterThanOrEqual(80);
  });

  it('rosewood-hong-kong shape fails rooms, amenities, guide, photos CDC', () => {
    const minimal = baseCdcRow({
      slug: 'rosewood-hong-kong',
      name: 'Rosewood Hong Kong',
      city: 'Hong Kong',
      luxury_tier: 'rosewood',
      amenities: null,
      gallery_images: Array.from({ length: 13 }, (_, i) => ({
        public_id: `cct/hotels/rosewood-hong-kong/room-${i}`,
        category: 'room',
        alt_fr: `Chambre Rosewood Hong Kong ${i}`,
        alt_en: `Room Rosewood Hong Kong ${i}`,
      })),
      policies: {
        _synthetic: true,
        check_in: {},
        check_out: {},
        cancellation: {},
        pets: {},
        wifi: {},
      },
    });
    const ctx: CdcAuditContext = {
      roomStats: { total: 0, withSlug: 0, indexable: 0 },
      guideSlug: null,
    };
    const result = evaluateCdcHotelFiche(minimal, ctx);
    expect(result.score_cdc).toBeLessThan(CDC_COMPLETE_THRESHOLD);
    expect(result.cdc_gaps.some((g) => g.field === 'hotel_rooms')).toBe(true);
    expect(result.cdc_gaps.some((g) => g.field === 'amenities')).toBe(true);
    expect(result.cdc_gaps.some((g) => g.field === 'gallery_images.category')).toBe(true);
  });

  it('extends base T3 gaps with CDC-specific gaps', () => {
    const row = baseCdcRow({ amenities: null });
    const result = evaluateCdcHotelFiche(row, fullCtx);
    const base = evaluateHotelFiche(row as HotelAuditRow);
    expect(result.gaps.length).toBeGreaterThanOrEqual(base.gaps.length);
  });

  it('flags concierge advice below min words', () => {
    const row = baseCdcRow({
      concierge_advice: {
        fr: { body: buildWords(ADVICE_BODY_MIN_WORDS - 10), tip_for: 'room' },
        en: { body: `My tip: ${buildWords(ADVICE_BODY_MIN_WORDS - 10)}`, tip_for: 'room' },
      },
    });
    const result = evaluateCdcHotelFiche(row, fullCtx);
    expect(result.cdc_checks.find((c) => c.id === 'cdc.16.advice_fr_words')?.passed).toBe(false);
  });
});
