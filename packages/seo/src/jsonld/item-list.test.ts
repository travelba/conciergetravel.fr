import { describe, expect, it } from 'vitest';

import { itemListJsonLd, poiItemListJsonLd } from './item-list';

describe('itemListJsonLd', () => {
  it('numbers entries from 1 and preserves URLs', () => {
    const node = itemListJsonLd({
      name: 'Sélection',
      items: [
        { name: 'Hôtel A', url: 'https://example.com/a' },
        { name: 'Hôtel B', url: 'https://example.com/b' },
      ],
    });
    expect(node.numberOfItems).toBe(2);
    expect(node.name).toBe('Sélection');
    const items = node.itemListElement;
    expect(items).toHaveLength(2);
    expect(items?.[0]).toMatchObject({
      position: 1,
      url: 'https://example.com/a',
      name: 'Hôtel A',
    });
    expect(items?.[1]).toMatchObject({ position: 2, url: 'https://example.com/b' });
  });

  it('upgrades to a nested Hotel item when `hotel.aggregateRating` is provided', () => {
    const node = itemListJsonLd({
      name: 'Paris',
      items: [
        {
          name: 'Hôtel C',
          url: 'https://example.com/c',
          hotel: {
            starRating: 5,
            aggregateRating: { ratingValue: 4.5, reviewCount: 213 },
          },
        },
      ],
    });
    const li = node.itemListElement?.[0];
    expect(li).toMatchObject({ '@type': 'ListItem', position: 1 });
    // The richer ListItem nests the Hotel under `item` (Google's
    // rich-result requirement for hub carousels) rather than flattening.
    expect(li).toHaveProperty('item');
    const hotel = (li as { item: Record<string, unknown> }).item;
    expect(hotel).toMatchObject({
      '@type': 'Hotel',
      name: 'Hôtel C',
      url: 'https://example.com/c',
      starRating: { '@type': 'Rating', ratingValue: 5 },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        reviewCount: 213,
        bestRating: 5,
      },
    });
  });

  it('keeps the simple shape when no `hotel` payload is provided (mixed list)', () => {
    const node = itemListJsonLd({
      items: [
        { name: 'A', url: 'https://example.com/a' },
        {
          name: 'B',
          url: 'https://example.com/b',
          hotel: { aggregateRating: { ratingValue: 4, reviewCount: 5 } },
        },
      ],
    });
    expect(node.itemListElement?.[0]).not.toHaveProperty('item');
    expect(node.itemListElement?.[1]).toHaveProperty('item');
  });
});

describe('poiItemListJsonLd', () => {
  it('builds an ItemList of nested Place nodes with description + geo', () => {
    const node = poiItemListJsonLd({
      name: "Ce qu'on visite dans le quartier",
      items: [
        {
          name: 'Tour Eiffel',
          schemaType: 'TouristAttraction',
          latitude: 48.8584,
          longitude: 2.2945,
          description: 'Le monument iconique de Paris, à dix minutes à pied.',
        },
        {
          name: 'Musée du Louvre',
          schemaType: 'Museum',
          latitude: 48.8606,
          longitude: 2.3376,
        },
      ],
    });
    expect(node.numberOfItems).toBe(2);
    expect(node.name).toBe("Ce qu'on visite dans le quartier");
    const items = node.itemListElement;
    expect(items).toHaveLength(2);
    const first = (items?.[0] as { item: Record<string, unknown> }).item;
    expect(first).toMatchObject({
      '@type': 'TouristAttraction',
      name: 'Tour Eiffel',
      description: 'Le monument iconique de Paris, à dix minutes à pied.',
      geo: { '@type': 'GeoCoordinates', latitude: 48.8584, longitude: 2.2945 },
    });
    const second = (items?.[1] as { item: Record<string, unknown> }).item;
    expect(second).toMatchObject({ '@type': 'Museum', name: 'Musée du Louvre' });
    expect(second).not.toHaveProperty('description');
  });

  it('caps at 8 entries to keep the JSON-LD envelope small', () => {
    const node = poiItemListJsonLd({
      name: 'Long list',
      items: Array.from({ length: 20 }, (_, i) => ({
        name: `POI ${i}`,
        schemaType: 'TouristAttraction',
      })),
    });
    expect(node.numberOfItems).toBe(8);
    expect(node.itemListElement).toHaveLength(8);
  });

  it('emits additionalType when schemaTypeUrl differs from schemaType', () => {
    const node = poiItemListJsonLd({
      name: 'Shops',
      items: [
        {
          name: 'Pharmacie Saint-Honoré',
          schemaType: 'Store',
          schemaTypeUrl: 'https://schema.org/Pharmacy',
        },
      ],
    });
    const item = (node.itemListElement?.[0] as { item: Record<string, unknown> }).item;
    expect(item).toMatchObject({
      '@type': 'Store',
      additionalType: 'https://schema.org/Pharmacy',
    });
  });

  it('omits additionalType when schemaTypeUrl matches the @type', () => {
    const node = poiItemListJsonLd({
      name: 'Museums',
      items: [
        {
          name: 'Louvre',
          schemaType: 'Museum',
          schemaTypeUrl: 'https://schema.org/Museum',
        },
      ],
    });
    const item = (node.itemListElement?.[0] as { item: Record<string, unknown> }).item;
    expect(item).not.toHaveProperty('additionalType');
  });
});
