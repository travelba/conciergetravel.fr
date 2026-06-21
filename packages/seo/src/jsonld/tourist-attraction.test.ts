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
});
