import { describe, expect, it } from 'vitest';

import {
  buildGoogleMapsHasMapUrl,
  buildHotelKnowledgeGraphJsonLdFields,
} from './hotel-json-ld-fields';

describe('buildGoogleMapsHasMapUrl', () => {
  it('prefers the canonical Google Maps URL when HTTPS', () => {
    expect(
      buildGoogleMapsHasMapUrl({
        latitude: 43.91,
        longitude: 5.19,
        googleMapsUrl: 'https://maps.google.com/?cid=123',
      }),
    ).toBe('https://maps.google.com/?cid=123');
  });

  it('falls back to lat/lng search URL', () => {
    expect(
      buildGoogleMapsHasMapUrl({
        latitude: 43.9116,
        longitude: 5.1985,
        googleMapsUrl: null,
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=43.9116,5.1985');
  });
});

describe('buildHotelKnowledgeGraphJsonLdFields', () => {
  it('emits sameAs and wikidataId from external ids', () => {
    const fields = buildHotelKnowledgeGraphJsonLdFields({
      externalIds: {
        wikidataId: 'Q123',
        wikipediaUrlFr: 'https://fr.wikipedia.org/wiki/Test',
        wikipediaUrlEn: null,
        officialUrl: 'https://airelles.com/fr/gordes',
        emailReservations: null,
        commonsCategory: null,
        tripadvisorLocationId: null,
        bookingComHotelId: null,
        expediaPropertyId: null,
        hotelsComHotelId: null,
        agodaHotelId: null,
        commonsGalleryUrl: null,
        tripadvisorUrl: 'https://www.tripadvisor.com/Hotel_Review-d1',
        sameAs: [
          'https://www.wikidata.org/wiki/Q123',
          'https://airelles.com/fr/gordes',
          'https://www.tripadvisor.com/Hotel_Review-d1',
        ],
        knowledgeGraph: {
          inceptionYear: null,
          architects: [],
          heritageDesignations: [],
          merimeeId: null,
          googleMapsCid: null,
        },
      },
      name: 'Airelles Gordes',
      bookingMode: 'display_only',
      emailReservations: null,
      googleMapsUrl: null,
      latitude: 43.91,
      longitude: 5.19,
    });

    expect(fields.wikidataId).toBe('Q123');
    expect(fields.sameAs).toHaveLength(3);
    expect(fields.hasMap).toContain('43.91');
    expect(fields.subjectOf?.[0]?.inLanguage).toBe('fr');
  });
});
