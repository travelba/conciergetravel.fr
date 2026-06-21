import { describe, expect, it } from 'vitest';

import { touristAttractionJsonLd } from './tourist-attraction';

describe('touristAttractionJsonLd', () => {
  it('emits the editorial @type, geo, address and city containment', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'Museum',
      name: 'Musée du Louvre',
      url: 'https://myconciergehotel.com/fr/lieux/paris/musee-du-louvre',
      description: 'Le plus grand musée du monde.',
      latitude: 48.8606,
      longitude: 2.3376,
      streetAddress: 'Rue de Rivoli',
      addressLocality: 'Paris',
      addressCountry: 'FR',
      openingHours: 'Mo-Fr 09:00-18:00',
      image: ['https://img/louvre.jpg'],
      sameAs: ['https://www.louvre.fr'],
    });

    const obj = node as unknown as Record<string, unknown>;
    expect(obj['@type']).toBe('Museum');
    expect(obj['name']).toBe('Musée du Louvre');
    expect(obj['geo']).toMatchObject({ '@type': 'GeoCoordinates', latitude: 48.8606 });
    expect(obj['address']).toMatchObject({ '@type': 'PostalAddress', addressLocality: 'Paris' });
    expect(obj['containedInPlace']).toMatchObject({ '@type': 'City', name: 'Paris' });
    expect(Array.isArray(obj['openingHoursSpecification'])).toBe(true);
    expect(obj['sameAs']).toEqual(['https://www.louvre.fr']);
  });

  it('keeps bare URL strings compact and normalises rich entries to ImageObject', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'LandmarksOrHistoricalBuildings',
      name: 'Abbaye Notre-Dame de Sénanque',
      url: 'https://myconciergehotel.com/lieux/gordes/abbaye-notre-dame-de-senanque',
      image: [
        {
          contentUrl: 'https://res.cloudinary.com/x/image/upload/c_fill,w_1600,h_700/hero',
          caption: 'Abbaye Notre-Dame de Sénanque, monument à Gordes',
          width: 1600,
          height: 700,
          representativeOfPage: true,
        },
        'https://res.cloudinary.com/x/image/upload/c_fill,w_800,h_600/gallery-1',
      ],
    });
    const obj = node as unknown as Record<string, unknown>;
    const images = obj['image'] as unknown[];
    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({
      '@type': 'ImageObject',
      contentUrl: 'https://res.cloudinary.com/x/image/upload/c_fill,w_1600,h_700/hero',
      caption: 'Abbaye Notre-Dame de Sénanque, monument à Gordes',
      width: 1600,
      height: 700,
      representativeOfPage: true,
    });
    expect(images[1]).toBe(
      'https://res.cloudinary.com/x/image/upload/c_fill,w_800,h_600/gallery-1',
    );
  });

  it('omits geo when only one coordinate is present', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Sans coords',
      url: 'https://example.com',
      latitude: 48.8,
    });
    const obj = node as unknown as Record<string, unknown>;
    expect(obj['geo']).toBeUndefined();
  });

  it('emits a single hero ImageObject when there is no gallery', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'Park',
      name: 'Jardin du Luxembourg',
      url: 'https://example.com',
      image: [
        {
          contentUrl: 'https://res.cloudinary.com/x/hero',
          caption: 'Jardin du Luxembourg, Paris',
          width: 1600,
          height: 700,
          representativeOfPage: true,
        },
      ],
    });
    const obj = node as unknown as Record<string, unknown>;
    const images = obj['image'] as unknown[];
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      '@type': 'ImageObject',
      contentUrl: 'https://res.cloudinary.com/x/hero',
      representativeOfPage: true,
    });
  });

  it('emits a gallery without a hero (no representativeOfPage flag set)', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'Museum',
      name: 'Galerie sans héros',
      url: 'https://example.com',
      image: [
        {
          contentUrl: 'https://res.cloudinary.com/x/g1',
          caption: 'Salle 1',
          width: 800,
          height: 600,
        },
        {
          contentUrl: 'https://res.cloudinary.com/x/g2',
          caption: 'Salle 2',
          width: 800,
          height: 600,
        },
      ],
    });
    const obj = node as unknown as Record<string, unknown>;
    const images = obj['image'] as Array<Record<string, unknown>>;
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img['@type']).toBe('ImageObject');
      expect(img['representativeOfPage']).toBeUndefined();
    }
  });

  it('falls back to a bare URL string when a rich entry carries no enrichment', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Sans légende',
      url: 'https://example.com',
      image: [{ contentUrl: 'https://res.cloudinary.com/x/plain' }],
    });
    const obj = node as unknown as Record<string, unknown>;
    expect(obj['image']).toEqual(['https://res.cloudinary.com/x/plain']);
  });

  it('emits an ImageObject when only width is provided (no caption)', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Largeur seule',
      url: 'https://example.com',
      image: [{ contentUrl: 'https://res.cloudinary.com/x/w', width: 1200 }],
    });
    const obj = node as unknown as Record<string, unknown>;
    const images = obj['image'] as Array<Record<string, unknown>>;
    expect(images[0]).toMatchObject({ '@type': 'ImageObject', width: 1200 });
    expect(images[0]?.['caption']).toBeUndefined();
    expect(images[0]?.['height']).toBeUndefined();
  });

  it('drops empty-string URLs and entries with an empty contentUrl', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Entrées vides',
      url: 'https://example.com',
      image: ['', { contentUrl: '' }, 'https://res.cloudinary.com/x/ok'],
    });
    const obj = node as unknown as Record<string, unknown>;
    expect(obj['image']).toEqual(['https://res.cloudinary.com/x/ok']);
  });

  it('omits the image property entirely for an empty array', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Aucune image',
      url: 'https://example.com',
      image: [],
    });
    const obj = node as unknown as Record<string, unknown>;
    expect(obj['image']).toBeUndefined();
  });

  it('preserves the caller-localised caption verbatim (FR vs EN)', () => {
    const buildWith = (caption: string): Record<string, unknown> => {
      const node = touristAttractionJsonLd({
        schemaType: 'Museum',
        name: 'Musée',
        url: 'https://example.com',
        image: [{ contentUrl: 'https://res.cloudinary.com/x/h', caption }],
      });
      const obj = node as unknown as Record<string, unknown>;
      const images = obj['image'] as Array<Record<string, unknown>>;
      return images[0] ?? {};
    };
    expect(buildWith('Façade du musée au crépuscule')['caption']).toBe(
      'Façade du musée au crépuscule',
    );
    expect(buildWith('Museum façade at dusk')['caption']).toBe('Museum façade at dusk');
  });

  it('maps a free price range to isAccessibleForFree: true', () => {
    const fr = touristAttractionJsonLd({
      schemaType: 'Park',
      name: 'Parc gratuit',
      url: 'https://example.com',
      priceRange: 'Gratuit',
    }) as unknown as Record<string, unknown>;
    expect(fr['isAccessibleForFree']).toBe(true);

    const en = touristAttractionJsonLd({
      schemaType: 'Park',
      name: 'Free park',
      url: 'https://example.com',
      priceRange: 'Free',
    }) as unknown as Record<string, unknown>;
    expect(en['isAccessibleForFree']).toBe(true);
  });

  it('maps a paid price range to isAccessibleForFree: false', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'Museum',
      name: 'Musée payant',
      url: 'https://example.com',
      priceRange: '€€',
    }) as unknown as Record<string, unknown>;
    expect(node['isAccessibleForFree']).toBe(false);
  });

  it('omits optional blocks when not provided (minimal node)', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Minimal',
      url: 'https://example.com',
    }) as unknown as Record<string, unknown>;
    expect(node['@type']).toBe('TouristAttraction');
    expect(node['name']).toBe('Minimal');
    expect(node['url']).toBe('https://example.com');
    expect(node['description']).toBeUndefined();
    expect(node['geo']).toBeUndefined();
    expect(node['address']).toBeUndefined();
    expect(node['containedInPlace']).toBeUndefined();
    expect(node['image']).toBeUndefined();
    expect(node['openingHoursSpecification']).toBeUndefined();
    expect(node['isAccessibleForFree']).toBeUndefined();
    expect(node['sameAs']).toBeUndefined();
  });

  it('drops an empty description string', () => {
    const node = touristAttractionJsonLd({
      schemaType: 'TouristAttraction',
      name: 'Vide',
      url: 'https://example.com',
      description: '',
    }) as unknown as Record<string, unknown>;
    expect(node['description']).toBeUndefined();
  });
});
