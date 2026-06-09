import { describe, expect, it } from 'vitest';

import { pickProximityCards, type RelatedHotelRow } from './get-related-hotels';

function row(slug: string, city: string, region: string, name = slug): RelatedHotelRow {
  return {
    slug,
    slug_en: null,
    name,
    name_en: null,
    city,
    region,
    stars: 5,
    is_palace: true,
    hero_image: null,
    description_fr: null,
    description_en: null,
  };
}

describe('pickProximityCards', () => {
  it('prefers same-city and nearby over brand-wide or distant region siblings', () => {
    const bundle = {
      sameCity: [row('les-bories-and-spa', 'Gordes', '')],
      nearby: [
        row('le-mas-des-herbes-blanches', 'Joucas', ''),
        row('capelongue', 'Bonnieux', 'Luberon'),
      ],
      sameDepartment: [],
      sameBrand: [row('les-airelles-courchevel', 'Courchevel', 'Auvergne-Rhône-Alpes')],
      brand: { slug: 'airelles', label: 'Airelles' },
      sameRegion: [
        row('les-airelles-saint-tropez', 'Saint-Tropez', "Provence-Alpes-Côte d'Azur"),
        row('le-negresco-nice', 'Nice', "Provence-Alpes-Côte d'Azur"),
      ],
    };

    const cards = pickProximityCards(bundle, "Provence-Alpes-Côte d'Azur");

    expect(cards.map((c) => c.slug)).toEqual([
      'les-bories-and-spa',
      'le-mas-des-herbes-blanches',
      'capelongue',
    ]);
  });

  it('deduplicates when a hotel appears in multiple geographic buckets', () => {
    const shared = row('capelongue', 'Bonnieux', 'Luberon');
    const bundle = {
      sameCity: [],
      nearby: [shared],
      sameDepartment: [shared],
      sameBrand: [],
      brand: null,
      sameRegion: [shared],
    };

    expect(pickProximityCards(bundle, 'Luberon').map((c) => c.slug)).toEqual(['capelongue']);
  });
});
