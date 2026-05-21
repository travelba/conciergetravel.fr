import { describe, expect, it } from 'vitest';

import { bookingHowToJsonLd, cancellationHowToJsonLd, itineraryHowToJsonLd } from './howto';

describe('bookingHowToJsonLd', () => {
  it('emits 6 ordered steps with hotel-anchored URLs (FR)', () => {
    const node = bookingHowToJsonLd({
      hotelName: 'Le Bristol',
      hotelUrl: 'https://example.com/hotel/le-bristol',
      locale: 'fr',
    });
    expect(node['@type']).toBe('HowTo');
    expect(node.inLanguage).toBe('fr-FR');
    expect(node.step).toHaveLength(6);
    const first = (node.step as ReadonlyArray<{ position: number; url: string }>)[0];
    expect(first.position).toBe(1);
    expect(first.url).toBe('https://example.com/hotel/le-bristol#booking');
  });
});

describe('cancellationHowToJsonLd', () => {
  it('emits 3 procedural steps in EN with `en-GB` language tag', () => {
    const node = cancellationHowToJsonLd({
      hotelName: 'Le Bristol',
      hotelUrl: 'https://example.com/hotel/le-bristol',
      locale: 'en',
    });
    expect(node.inLanguage).toBe('en-GB');
    expect(node.step).toHaveLength(3);
  });
});

describe('itineraryHowToJsonLd', () => {
  it('builds an ordered HowTo with totalTime + per-step URLs', () => {
    const node = itineraryHowToJsonLd({
      name: 'Paris luxe en 3 jours',
      description: 'Trois jours pas à pas dans les Palaces de la rive droite.',
      durationDays: 3,
      steps: [
        {
          name: 'Jour 1 — Arrivée et soirée Vendôme',
          text: 'Check-in au Ritz Paris, dîner gastronomique et balade place Vendôme.',
          url: 'https://example.com/hotel/ritz-paris',
        },
        {
          name: 'Jour 2 — Rive droite et Faubourg Saint-Honoré',
          text: 'Petit-déjeuner Costes, visite Musée Jacquemart-André, déjeuner Le Bristol.',
          url: 'https://example.com/hotel/le-bristol',
        },
        {
          name: 'Jour 3 — Étoile et départ',
          text: 'Brunch George V, shopping Faubourg, transfert aéroport.',
          url: 'https://example.com/hotel/four-seasons-george-v',
        },
      ],
      locale: 'fr',
    });

    expect(node['@type']).toBe('HowTo');
    expect(node.name).toBe('Paris luxe en 3 jours');
    expect(node.totalTime).toBe('P3D');
    expect(node.inLanguage).toBe('fr-FR');
    expect(node.step).toHaveLength(3);
    const first = (node.step as ReadonlyArray<{ position: number; url: string }>)[0];
    expect(first.position).toBe(1);
    expect(first.url).toContain('/hotel/ritz-paris');
  });

  it('omits totalTime when durationDays is 0 or undefined', () => {
    const node = itineraryHowToJsonLd({
      name: 'Open-ended itinerary',
      steps: [{ name: 'Step', text: 'Body' }],
      locale: 'en',
    });
    expect((node as { totalTime?: string }).totalTime).toBeUndefined();
  });

  it('caps step count at 14 to keep the JSON-LD payload small', () => {
    const stepCount = 30;
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      name: `Step ${i + 1}`,
      text: `Body ${i + 1}`,
    }));
    const node = itineraryHowToJsonLd({
      name: 'Way too many steps',
      steps,
      locale: 'fr',
    });
    expect(node.step).toHaveLength(14);
  });

  it('lifts the first step image to a top-level cover image', () => {
    const node = itineraryHowToJsonLd({
      name: 'With cover',
      steps: [
        { name: 'Step 1', text: 'Body 1' },
        {
          name: 'Step 2',
          text: 'Body 2',
          image: 'https://res.cloudinary.com/foo/image/upload/v1/bar.jpg',
        },
      ],
      locale: 'fr',
    });
    const cover = (node as { image?: ReadonlyArray<string> }).image;
    expect(cover).toEqual(['https://res.cloudinary.com/foo/image/upload/v1/bar.jpg']);
  });

  it('emits `en-GB` language tag for EN locale', () => {
    const node = itineraryHowToJsonLd({
      name: 'Tuscany 5 days',
      steps: [{ name: 'Day 1', text: 'Arrive in Florence' }],
      locale: 'en',
    });
    expect(node.inLanguage).toBe('en-GB');
  });
});
