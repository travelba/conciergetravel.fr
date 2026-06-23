import { describe, expect, it } from 'vitest';

import type { PlaceDetail } from './get-place-by-slug';
import {
  pickPlaceGallery,
  pickPlaceLocalized,
  placeCityPathname,
  placeHeroSrc,
  placePathname,
} from './place-view';

/**
 * Minimal published place fixture. `PlaceDetail` is the Zod-inferred
 * shape of a fully-projected `places` row; tests override only the
 * fields under test.
 */
function place(overrides: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'musee-du-louvre',
    slug_en: null,
    city_key: 'paris',
    city: 'Paris',
    country_code: 'FR',
    bucket: 'visit',
    kind: 'museum',
    latitude: 48.8606,
    longitude: 2.3376,
    address: 'Rue de Rivoli',
    name: 'Musée du Louvre',
    name_en: 'Louvre Museum',
    factual_summary_fr: 'Le plus grand musée du monde.',
    factual_summary_en: 'The largest museum in the world.',
    description_fr: 'Description longue FR.',
    description_en: 'Long description EN.',
    concierge_advice: {
      fr: { title: 'Astuce', body: 'Entrez par la porte des Lions.' },
      en: { title: 'Tip', body: 'Use the Porte des Lions entrance.' },
    },
    faq: [{ q_fr: 'Horaires ?', a_fr: '9h-18h', q_en: 'Hours?', a_en: '9am-6pm' }],
    hero_image: 'cct/places/louvre-hero',
    gallery_images: null,
    meta_title_fr: 'Louvre — Paris',
    meta_title_en: 'Louvre — Paris EN',
    meta_desc_fr: 'Visiter le Louvre',
    meta_desc_en: 'Visit the Louvre',
    is_published: true,
    ...overrides,
  };
}

describe('pickPlaceLocalized', () => {
  it('picks French fields for the fr locale', () => {
    const view = pickPlaceLocalized(place(), 'fr');
    expect(view.name).toBe('Musée du Louvre');
    expect(view.factualSummary).toBe('Le plus grand musée du monde.');
    expect(view.conciergeTitle).toBe('Astuce');
    expect(view.conciergeBody).toBe('Entrez par la porte des Lions.');
    expect(view.faq).toEqual([{ question: 'Horaires ?', answer: '9h-18h' }]);
  });

  it('picks English fields for the en locale', () => {
    const view = pickPlaceLocalized(place(), 'en');
    expect(view.name).toBe('Louvre Museum');
    expect(view.factualSummary).toBe('The largest museum in the world.');
    expect(view.conciergeTitle).toBe('Tip');
    expect(view.faq).toEqual([{ question: 'Hours?', answer: '9am-6pm' }]);
  });

  it('falls back to French when the English field is empty/missing', () => {
    const view = pickPlaceLocalized(
      place({ name_en: null, factual_summary_en: '   ', description_en: null }),
      'en',
    );
    expect(view.name).toBe('Musée du Louvre');
    expect(view.factualSummary).toBe('Le plus grand musée du monde.');
    expect(view.description).toBe('Description longue FR.');
  });

  it('drops FAQ entries missing a question or answer in both locales', () => {
    const view = pickPlaceLocalized(
      place({
        faq: [
          { q_fr: 'OK', a_fr: 'Yes', q_en: null, a_en: null },
          { q_fr: '', a_fr: 'orphan answer', q_en: null, a_en: null },
        ],
      }),
      'fr',
    );
    expect(view.faq).toEqual([{ question: 'OK', answer: 'Yes' }]);
  });

  it('returns null concierge fields when advice is absent', () => {
    const view = pickPlaceLocalized(place({ concierge_advice: null }), 'fr');
    expect(view.conciergeTitle).toBeNull();
    expect(view.conciergeBody).toBeNull();
  });
});

describe('pickPlaceGallery', () => {
  it('maps published gallery rows to render-ready entries (localised alt)', () => {
    const gallery = pickPlaceGallery(
      place({
        gallery_images: [
          {
            public_id: 'cct/places/g1',
            alt_fr: 'Cour Carrée',
            alt_en: 'Cour Carrée EN',
            category: 'exterior',
          },
        ],
      }),
      'en',
    );
    expect(gallery).toEqual([
      { publicId: 'cct/places/g1', alt: 'Cour Carrée EN', category: 'exterior' },
    ]);
  });

  it('drops entries with an empty / whitespace public_id without throwing', () => {
    const gallery = pickPlaceGallery(
      place({
        gallery_images: [
          { public_id: '   ', alt_fr: 'empty', alt_en: null, category: null },
          { public_id: 'cct/places/ok', alt_fr: 'OK', alt_en: null, category: null },
        ],
      }),
      'fr',
    );
    expect(gallery).toEqual([{ publicId: 'cct/places/ok', alt: 'OK', category: null }]);
  });

  it('falls back to the place name when no localised alt is stored', () => {
    const gallery = pickPlaceGallery(
      place({
        name: 'Musée du Louvre',
        gallery_images: [
          { public_id: 'cct/places/g', alt_fr: null, alt_en: null, category: 'interior' },
        ],
      }),
      'fr',
    );
    expect(gallery[0]?.alt).toBe('Musée du Louvre');
  });

  it('returns an empty array when the column is unset', () => {
    expect(pickPlaceGallery(place({ gallery_images: null }), 'fr')).toEqual([]);
  });
});

describe('placePathname / placeCityPathname', () => {
  it('uses the FR slug for the fr locale', () => {
    expect(placePathname('fr', 'paris', 'musee-du-louvre', 'louvre-museum')).toBe(
      '/lieux/paris/musee-du-louvre',
    );
  });

  it('uses the EN slug for the en locale when present', () => {
    expect(placePathname('en', 'paris', 'musee-du-louvre', 'louvre-museum')).toBe(
      '/lieux/paris/louvre-museum',
    );
  });

  it('falls back to the FR slug for the en locale when slug_en is null', () => {
    expect(placePathname('en', 'paris', 'musee-du-louvre', null)).toBe(
      '/lieux/paris/musee-du-louvre',
    );
  });

  it('builds the city index path', () => {
    expect(placeCityPathname('paris')).toBe('/lieux/paris');
  });
});

describe('placeHeroSrc', () => {
  it('returns null when the hero image is unset or blank', () => {
    expect(placeHeroSrc(null)).toBeNull();
    expect(placeHeroSrc('   ')).toBeNull();
  });

  it('passes through an absolute http(s) URL unchanged', () => {
    const url = 'https://cdn.example.com/louvre.jpg';
    expect(placeHeroSrc(url)).toBe(url);
  });
});
