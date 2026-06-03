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
      { anchor: 'c', title_fr: "L'art de vivre", body_fr: buildWords(220) },
    ],
    highlights: [{ label_fr: 'A' }, { label_fr: 'B' }, { label_fr: 'C' }],
    amenities: Array.from({ length: 80 }, (_, i) => ({ key: `amenity-${i}`, label_fr: `A${i}` })),
    points_of_interest: [
      {
        name_fr: 'Louvre',
        bucket: 'visit',
        distance_meters: 200,
        description_fr: buildWords(20),
        website: 'https://www.louvre.fr',
        tip_fr: 'Mon conseil : tôt le matin.',
      },
      {
        name_fr: 'Atelier parfum',
        bucket: 'do',
        distance_meters: 300,
        description_fr: buildWords(20),
        phone: '+33 1 00 00 00 00',
        tip_fr: 'Mon conseil : sur réservation.',
      },
      {
        name_fr: 'Épicerie fine',
        bucket: 'shop',
        distance_meters: 120,
        description_fr: buildWords(20),
        address: 'Rue de Rivoli',
        tip_fr: 'Mon conseil : avant le déjeuner.',
      },
    ],
    transports: [{ mode: 'metro' }],
    restaurant_info: {
      count: 2,
      venues: [
        {
          name: 'Le Dalí',
          website: 'https://example.com/dali',
          tip_fr: 'Mon conseil : la table sous la verrière.',
        },
        {
          name: 'Restaurant le Meurice Alain Ducasse',
          reservation_url: 'https://example.com/ducasse',
          tip_fr: 'Mon conseil : le menu déjeuner.',
        },
      ],
    },
    spa_info: {
      name: 'Spa Valmont',
      description_fr: buildWords(40),
      hours_fr: '9h-20h',
      phone: '+33 1 44 58 50 50',
      tip_fr: 'Mon conseil : réservez en fin de journée.',
    },
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
    featured_reviews: [
      {
        source: 'Forbes',
        source_url: 'https://www.forbes.com/le-meurice',
        author: 'Jane Doe',
        quote_fr: 'Un palace intemporel.',
        quote_en: 'A timeless palace.',
        rating: 5,
        max_rating: 5,
        date_iso: '2025-03-01',
      },
    ],
    mice_info: { capacity: 200 },
    booking_mode: 'display_only',
    upcoming_events: [
      {
        title_fr: 'Concert',
        start_date: '2026-07-01',
        location: 'Salon Pompadour',
        image_url: 'https://example.com/e.jpg',
      },
    ],
    instagram: {
      handle: 'lemeurice',
      posts: [
        { permalink: 'https://instagram.com/p/1', image_public_id: 'cct/hotels/le-meurice/ig-1' },
        { permalink: 'https://instagram.com/p/2', image_public_id: 'cct/hotels/le-meurice/ig-2' },
        { permalink: 'https://instagram.com/p/3', image_public_id: 'cct/hotels/le-meurice/ig-3' },
      ],
    },
    concierge_pick: 'suite-belle-etoile',
    concierge_hook: {
      fr: 'Le palais qui regarde les Tuileries.',
      en: 'The palace facing the Tuileries.',
    },
    external_sources: [
      {
        field: 'opened_at',
        value: '1835',
        source: 'Wikipedia',
        source_url: 'https://fr.wikipedia.org/wiki/Le_Meurice',
        confidence: 'high',
      },
      {
        field: 'awards',
        value: 'Palace',
        source: 'Atout France',
        source_url: 'https://palace.atout-france.fr',
        confidence: 'high',
      },
    ],
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
      credit: 'Le Meurice',
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
