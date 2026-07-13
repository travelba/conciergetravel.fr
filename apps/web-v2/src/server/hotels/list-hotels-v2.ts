import 'server-only';

import { cache } from 'react';
import { z } from 'zod';

import { fetchHotelCardsV2ByCity, parseHotelCardV2, type HotelCardV2 } from '@mch/db';

import { DEMO_HOTELS, type DemoHotel } from '@/lib/demo-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canUseLiveSupabase } from '@/server/lib/live-data';
import { mapHotelCardV2ToDemoHotel } from '@/server/hotels/map-hotel-v2';

export type HotelListV2Source = 'live' | 'demo';

export type ListHotelsV2Options = {
  readonly locale?: 'fr' | 'en';
  readonly city?: string;
  readonly countryCode?: string;
  readonly query?: string;
  readonly limit?: number;
};

export type ListHotelsV2Result = {
  readonly source: HotelListV2Source;
  readonly hotels: readonly DemoHotel[];
};

const HOTEL_CARD_V2_COLUMNS =
  'id, slug, slug_en, name, name_en, city, country_code, stars, hero_image, rating_score, rating_count, luxury_tier, price_hint, amenities_facet';

async function listLiveHotels(
  options: ListHotelsV2Options,
  locale: 'fr' | 'en',
): Promise<readonly DemoHotel[] | null> {
  const client = await createSupabaseServerClient();
  const limit = options.limit ?? 50;

  if (
    options.countryCode !== undefined &&
    options.countryCode.length > 0 &&
    options.city !== undefined &&
    options.city.length > 0
  ) {
    const result = await fetchHotelCardsV2ByCity(client, {
      countryCode: options.countryCode.toUpperCase(),
      city: options.city,
      limit,
    });
    if (!result.ok) return null;
    return result.value.map((card) => mapHotelCardV2ToDemoHotel(card, locale));
  }

  let query = client.schema('v2').from('hotel_card_v2').select(HOTEL_CARD_V2_COLUMNS);

  if (options.countryCode !== undefined && options.countryCode.length > 0) {
    query = query.eq('country_code', options.countryCode.toUpperCase());
  }
  if (options.city !== undefined && options.city.length > 0) {
    query = query.ilike('city', options.city);
  }
  if (options.query !== undefined && options.query.trim().length > 0) {
    const term = options.query.trim();
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(limit);
  if (error !== null) return null;

  const cards: HotelCardV2[] = [];
  for (const row of data ?? []) {
    const parsed = parseHotelCardV2(row);
    if (!parsed.ok) return null;
    cards.push(parsed.value);
  }

  return cards.map((card) => mapHotelCardV2ToDemoHotel(card, locale));
}

function filterDemoHotels(options: ListHotelsV2Options): readonly DemoHotel[] {
  let hotels = DEMO_HOTELS;
  if (options.city !== undefined && options.city.length > 0) {
    const cityLower = options.city.toLowerCase();
    hotels = hotels.filter((h) => h.city.toLowerCase().includes(cityLower));
  }
  if (options.query !== undefined && options.query.trim().length > 0) {
    const term = options.query.trim().toLowerCase();
    hotels = hotels.filter(
      (h) => h.name.toLowerCase().includes(term) || h.city.toLowerCase().includes(term),
    );
  }
  const limit = options.limit ?? 50;
  return hotels.slice(0, limit);
}

export const listHotelsV2 = cache(
  async (options: ListHotelsV2Options = {}): Promise<ListHotelsV2Result> => {
    const locale = options.locale ?? 'fr';

    if (canUseLiveSupabase()) {
      try {
        const live = await listLiveHotels(options, locale);
        if (live !== null && live.length > 0) {
          return { source: 'live', hotels: live };
        }
      } catch {
        // Degrade to demo below.
      }
    }

    return { source: 'demo', hotels: filterDemoHotels(options) };
  },
);

export const SearchBodySchema = z.object({
  destination: z.string().min(1).max(120),
  locale: z.enum(['fr', 'en']).default('fr'),
  limit: z.number().int().min(1).max(50).default(20),
});

export function toSearchAgentJson(result: ListHotelsV2Result, locale: 'fr' | 'en') {
  return {
    ok: true as const,
    source: result.source,
    hotels: result.hotels.map((hotel) => ({
      slug: hotel.slug,
      name: hotel.name,
      city: hotel.city,
      stars: hotel.stars,
      ratingScoreOutOfTen: hotel.ratingScoreOutOfTen,
      reviewCount: hotel.reviewCount,
      editorialBadge: hotel.editorialBadge ?? null,
      heroImage: hotel.heroImage,
      publicPriceMinor: hotel.publicPriceMinor,
      canonicalUrl: locale === 'en' ? `/en/hotel/${hotel.slug}` : `/fr/hotel/${hotel.slug}`,
    })),
  };
}

/** JSON envelope for mobile BFF `/api/mobile/v1/search`. */
export function toMobileSearchJson(
  result: ListHotelsV2Result,
  query: string,
): {
  readonly query: string;
  readonly total: number;
  readonly hotels: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly city: string;
    readonly country: string;
    readonly stars: number;
    readonly ratingScoreOutOfTen: number;
    readonly reviewCount: number;
    readonly heroImage: string;
    readonly publicPriceMinor: number;
    readonly editorialBadge?: string;
    readonly distanceLabel?: string;
  }>;
} {
  return {
    query,
    total: result.hotels.length,
    hotels: result.hotels.map((hotel) => ({
      slug: hotel.slug,
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      stars: hotel.stars,
      ratingScoreOutOfTen: hotel.ratingScoreOutOfTen,
      reviewCount: hotel.reviewCount,
      heroImage: hotel.heroImage,
      publicPriceMinor: hotel.publicPriceMinor,
      ...(hotel.editorialBadge !== undefined ? { editorialBadge: hotel.editorialBadge } : {}),
      ...(hotel.distanceLabel.length > 0 ? { distanceLabel: hotel.distanceLabel } : {}),
    })),
  };
}
