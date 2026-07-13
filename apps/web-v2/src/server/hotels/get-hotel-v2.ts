import 'server-only';

import { cache } from 'react';

import { fetchHotelDetailV2BySlug } from '@mch/db';

import { getDemoHotel, type DemoHotel } from '@/lib/demo-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canUseLiveSupabase } from '@/server/lib/live-data';
import { mapHotelDetailV2ToDemoHotel } from '@/server/hotels/map-hotel-v2';

export type HotelV2Source = 'live' | 'demo';

export type GetHotelV2Result = {
  readonly source: HotelV2Source;
  readonly hotel: DemoHotel;
};

export type GetHotelV2Options = {
  readonly slug: string;
  readonly locale?: 'fr' | 'en';
};

async function fetchLiveHotel(slug: string, locale: 'fr' | 'en'): Promise<GetHotelV2Result | null> {
  const client = await createSupabaseServerClient();
  const result = await fetchHotelDetailV2BySlug(client, { slug });
  if (!result.ok) return null;
  return {
    source: 'live',
    hotel: mapHotelDetailV2ToDemoHotel(result.value, locale),
  };
}

export const getHotelV2 = cache(
  async (options: GetHotelV2Options): Promise<GetHotelV2Result | null> => {
    const locale = options.locale ?? 'fr';

    if (canUseLiveSupabase()) {
      try {
        const live = await fetchLiveHotel(options.slug, locale);
        if (live !== null) return live;
      } catch {
        // Degrade to demo below.
      }
    }

    const demo = getDemoHotel(options.slug);
    if (demo === undefined) return null;

    return { source: 'demo', hotel: demo };
  },
);

/** JSON envelope for agent / mobile BFF routes. */
export function toHotelAgentJson(result: GetHotelV2Result, locale: 'fr' | 'en') {
  const { hotel, source } = result;
  return {
    ok: true as const,
    source,
    hotel: {
      slug: hotel.slug,
      name: hotel.name,
      stars: hotel.stars,
      city: hotel.city,
      country: hotel.country,
      district: hotel.district,
      ratingScoreOutOfTen: hotel.ratingScoreOutOfTen,
      reviewCount: hotel.reviewCount,
      editorialBadge: hotel.editorialBadge ?? null,
      description: hotel.description,
      conciergeAdvice: hotel.conciergeAdvice,
      heroImage: hotel.heroImage,
      publicPriceMinor: hotel.publicPriceMinor,
      memberPriceMinor: hotel.memberPriceMinor,
      canonicalUrl: locale === 'en' ? `/en/hotel/${hotel.slug}` : `/fr/hotel/${hotel.slug}`,
    },
  };
}
