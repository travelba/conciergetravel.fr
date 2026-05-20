import { describe, expect, it } from 'vitest';

import { buildLlmsFullHotelPages, buildLlmsFullTxt, buildLlmsTxt } from './index';

describe('buildLlmsTxt', () => {
  it('emits sections with URL + description bullets', () => {
    const out = buildLlmsTxt({
      siteName: 'MyConciergeHotel.com',
      tagline: 'Hôtels 5★ France',
      originUrl: 'https://example.com',
      about: 'Description.',
      lastUpdatedDate: '2026-05-11',
      sections: [
        {
          title: 'Pages stratégiques',
          items: [{ url: 'https://example.com/x', description: 'Page X' }],
        },
      ],
    });
    expect(out).toContain('# MyConciergeHotel.com — Hôtels 5★ France');
    expect(out).toContain('## Pages stratégiques');
    expect(out).toContain('- https://example.com/x — Page X');
    expect(out).toContain('Dernière mise à jour : 2026-05-11');
  });
});

describe('buildLlmsFullTxt', () => {
  it('emits per-page summary + key facts', () => {
    const out = buildLlmsFullTxt({
      siteName: 'CT',
      tagline: 'Tagline',
      originUrl: 'https://example.com',
      about: 'About.',
      lastUpdatedDate: '2026-05-11T08:00:00Z',
      pages: [
        {
          url: 'https://example.com/a',
          title: 'Page A',
          summary: 'Résumé.',
          keyFacts: ['Fait 1', 'Fait 2'],
          updatedAt: '2026-04-01',
        },
      ],
    });
    expect(out).toContain('## Page A');
    expect(out).toContain('URL: https://example.com/a');
    expect(out).toContain('Last updated: 2026-04-01');
    expect(out).toContain('- Fait 1');
    expect(out).toContain('- Fait 2');
    expect(out).toContain('Dernière mise à jour : 2026-05-11');
  });
});

describe('buildLlmsFullHotelPages', () => {
  it('emits FR + EN sections with factual summary preferred over description', () => {
    const out = buildLlmsFullHotelPages(
      {
        slug: 'le-bristol-paris',
        slugEn: 'le-bristol-paris',
        nameFr: 'Le Bristol',
        nameEn: 'Le Bristol',
        city: 'Paris',
        stars: 5,
        isPalace: true,
        factualSummaryFr:
          'Palace 5★ situé Faubourg Saint-Honoré Paris 8e, à 800 m de la Place de la Concorde, avec spa La Prairie, table 3 étoiles Michelin Epicure.',
        factualSummaryEn:
          'Palace 5-star located Faubourg Saint-Honoré Paris 8e, 800m from Place de la Concorde, with La Prairie spa, 3-Michelin-star Epicure restaurant.',
        descriptionFr: 'Description longue.',
        descriptionEn: 'Long description.',
        bookingMode: 'amadeus',
        updatedAt: '2026-05-20T12:00:00Z',
      },
      'https://example.com/',
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.url).toBe('https://example.com/hotel/le-bristol-paris/');
    expect(out[0]?.title).toBe('Hôtel Le Bristol — Paris');
    expect(out[0]?.summary).toContain('Palace 5★');
    expect(out[0]?.keyFacts).toContain('Classement : 5★ Palace (Atout France)');
    expect(out[0]?.keyFacts).toContain('Réservation directe (paiement sécurisé Amadeus 3DS2)');
    expect(out[1]?.url).toBe('https://example.com/en/hotel/le-bristol-paris/');
    expect(out[1]?.title).toBe('Le Bristol Hotel — Paris');
    expect(out[1]?.keyFacts).toContain('Direct booking (secure Amadeus 3DS2 payment)');
  });

  it('falls back to truncated description when no factual summary', () => {
    const longDesc =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.';
    const out = buildLlmsFullHotelPages(
      {
        slug: 'hotel-x',
        slugEn: null,
        nameFr: 'Hôtel X',
        nameEn: null,
        city: 'Nice',
        stars: 5,
        isPalace: false,
        factualSummaryFr: null,
        factualSummaryEn: null,
        descriptionFr: longDesc,
        descriptionEn: null,
        bookingMode: 'email',
        updatedAt: null,
      },
      'https://example.com',
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.summary.length).toBeLessThanOrEqual(150);
    expect(out[0]?.keyFacts).toContain('Réservation via concierge (e-mail)');
    expect(out[1]?.summary).toContain('…');
  });

  it('returns empty when neither summary nor description exist', () => {
    const out = buildLlmsFullHotelPages(
      {
        slug: 'stub',
        slugEn: null,
        nameFr: 'Stub',
        nameEn: null,
        city: 'Lyon',
        stars: 5,
        isPalace: false,
        factualSummaryFr: null,
        factualSummaryEn: null,
        descriptionFr: null,
        descriptionEn: null,
        bookingMode: 'display_only',
        updatedAt: null,
      },
      'https://example.com',
    );
    expect(out).toHaveLength(0);
  });
});
