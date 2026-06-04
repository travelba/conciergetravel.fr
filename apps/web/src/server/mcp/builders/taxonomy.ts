import 'server-only';

import { OCCASION_NAV_ENTRIES, THEME_NAV_ENTRIES } from '@/components/layout/nav-data';
import { listPublishedCities } from '@/server/destinations/cities';
import { EDITORIAL_CATEGORIES } from '@/server/hotels/editorial-categories';
import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

import { type BuilderResponse, okResponse } from './types';

/**
 * Taxonomy / navigation result builders (cities, categories, themes,
 * occasions, brands, loyalty) shared by `/api/agent/*` routes and the
 * MCP tools (Lot 4, ADR-0029). All are parameter-free reads.
 */

const TAXONOMY_CACHE = 'public, max-age=3600, s-maxage=86400';
const CITIES_CACHE = 'public, max-age=900, s-maxage=86400';

export async function buildCitiesResult(): Promise<BuilderResponse> {
  const cities = await listPublishedCities().catch(() => []);
  return okResponse(
    {
      count: cities.length,
      cities: cities.map((c) => ({
        slug: c.slug,
        name: c.name,
        region: c.region,
        hotelCount: c.count,
        hasPalace: c.hasPalace,
        canonicalUrl: {
          fr: `/fr/destination/${c.slug}`,
          en: `/en/destination/${c.slug}`,
        },
      })),
    },
    CITIES_CACHE,
  );
}

export async function buildCategoriesResult(): Promise<BuilderResponse> {
  return okResponse(
    {
      count: EDITORIAL_CATEGORIES.length,
      categories: EDITORIAL_CATEGORIES.map((c) => ({
        slug: c.slug,
        label: { fr: c.labelFr, en: c.labelEn },
        canonicalUrl: {
          fr: `/fr/categorie/${c.slug}`,
          en: `/en/categorie/${c.slug}`,
        },
      })),
    },
    TAXONOMY_CACHE,
  );
}

export function buildThemesResult(): BuilderResponse {
  return okResponse(
    {
      count: THEME_NAV_ENTRIES.length,
      themes: THEME_NAV_ENTRIES.map((t) => ({
        slug: t.slug,
        label: { fr: t.labelFr, en: t.labelEn },
        canonicalUrl: {
          fr: `/fr/classements/theme/${t.slug}`,
          en: `/en/classements/theme/${t.slug}`,
        },
      })),
    },
    TAXONOMY_CACHE,
  );
}

export function buildOccasionsResult(): BuilderResponse {
  return okResponse(
    {
      count: OCCASION_NAV_ENTRIES.length,
      occasions: OCCASION_NAV_ENTRIES.map((o) => ({
        slug: o.slug,
        label: { fr: o.labelFr, en: o.labelEn },
        canonicalUrl: {
          fr: `/fr/classements/occasion/${o.slug}`,
          en: `/en/classements/occasion/${o.slug}`,
        },
      })),
    },
    TAXONOMY_CACHE,
  );
}

export async function buildBrandsResult(): Promise<BuilderResponse> {
  const hotels = await listPublishedHotelsForIndex().catch(() => []);
  const counts = new Map<string, number>();
  for (const h of hotels) {
    const brand = detectBrand(h.nameFr);
    if (brand !== null) counts.set(brand.slug, (counts.get(brand.slug) ?? 0) + 1);
  }

  return okResponse(
    {
      count: KNOWN_BRANDS.length,
      brands: KNOWN_BRANDS.map((b) => ({
        slug: b.slug,
        label: b.label,
        hotelCount: counts.get(b.slug) ?? 0,
        canonicalUrl: {
          fr: `/fr/marque/${b.slug}`,
          en: `/en/marque/${b.slug}`,
        },
      })),
    },
    TAXONOMY_CACHE,
  );
}

export function buildLoyaltyResult(): BuilderResponse {
  return okResponse(
    {
      programme: {
        name: 'Fidélité MyConciergeHotel',
        canonicalUrl: {
          fr: '/fr/le-concierge',
          en: '/en/le-concierge',
        },
        tiers: [
          {
            slug: 'free',
            label: { fr: 'Essentiel (gratuit)', en: 'Essential (free)' },
            joinCost: { amount: 0, currency: 'EUR' },
            eligibility: {
              fr: 'Automatique dès la première réservation sur un hôtel du catalogue Little Hotelier — pas de carte, pas de minimum.',
              en: 'Automatic from the first booking on a Little Hotelier catalogue hotel — no card, no minimum.',
            },
            benefits: [
              {
                code: 'breakfast_for_2',
                label: { fr: 'Petit-déjeuner offert pour 2', en: 'Breakfast for 2' },
                subjectToAvailability: true,
              },
              {
                code: 'late_checkout_14h',
                label: { fr: 'Check-out tardif (14h)', en: 'Late check-out (2pm)' },
                subjectToAvailability: true,
              },
              {
                code: 'hotel_credit',
                label: {
                  fr: 'Crédit hôtel selon hôtel partenaire',
                  en: 'Hotel credit (varies by partner)',
                },
                subjectToAvailability: true,
              },
            ],
          },
          {
            slug: 'premium',
            label: { fr: 'Prestige (sur abonnement)', en: 'Prestige (subscription)' },
            joinCost: null,
            eligibility: {
              fr: 'Sur abonnement, avantages renforcés sur l’ensemble du catalogue Palaces et 5★.',
              en: 'Subscription-based, enhanced benefits across the full Palace and 5★ catalogue.',
            },
            benefits: [
              {
                code: 'room_upgrade',
                label: { fr: 'Surclassement chambre', en: 'Room upgrade' },
                subjectToAvailability: true,
              },
              {
                code: 'airport_transfer',
                label: { fr: 'Transfert aéroport', en: 'Airport transfer' },
                subjectToAvailability: true,
              },
              {
                code: 'breakfast_for_2',
                label: { fr: 'Petit-déjeuner offert pour 2', en: 'Breakfast for 2' },
                subjectToAvailability: false,
              },
              {
                code: 'late_checkout_14h',
                label: { fr: 'Check-out tardif (14h)', en: 'Late check-out (2pm)' },
                subjectToAvailability: false,
              },
            ],
          },
        ],
        legal: {
          fr: 'Avantages soumis à disponibilité et conditions de l’hôtel partenaire. Conditions complètes : https://myconciergehotel.com/fr/cgv',
          en: 'Benefits subject to availability and the partner hotel’s terms. Full terms: https://myconciergehotel.com/en/terms',
        },
      },
    },
    TAXONOMY_CACHE,
  );
}
