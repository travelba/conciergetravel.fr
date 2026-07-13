import 'server-only';

import type { Locale } from '@/i18n/routing';
import { siteOrigin } from '@/lib/site-origin';
import { getHotelV2, toHotelAgentJson } from '@/server/hotels/get-hotel-v2';
import { listHotelsV2, toSearchAgentJson } from '@/server/hotels/list-hotels-v2';
import { getRankingV2, toRankingAgentJson } from '@/server/rankings/get-ranking-v2';

import type { QuoteInput } from '@/lib/mcp/tools';

export type AgentLocale = Locale;

function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteOrigin()}${path}`;
}

export type SearchHotelsInput = {
  destination: string;
  checkIn?: string | undefined;
  checkOut?: string | undefined;
  adults?: number | undefined;
  children?: number | undefined;
  locale: AgentLocale;
  limit: number;
};

export async function searchHotels(input: SearchHotelsInput) {
  const result = await listHotelsV2({
    locale: input.locale,
    query: input.destination,
    limit: input.limit,
  });

  return {
    ...toSearchAgentJson(result, input.locale),
    destination: input.destination,
    offers: [] as ReadonlyArray<unknown>,
    phase6Frozen: true,
    note:
      input.checkIn !== undefined
        ? 'Live GDS pricing is frozen until Phase 6 — catalogue results only.'
        : undefined,
  };
}

export type GetHotelInput = {
  slug: string;
  locale: AgentLocale;
};

export async function getHotel(input: GetHotelInput) {
  const result = await getHotelV2({ slug: input.slug, locale: input.locale });
  if (result === null) {
    return { ok: false as const, error: 'not_found' as const };
  }

  const payload = toHotelAgentJson(result, input.locale);
  return {
    ...payload,
    hotel: {
      ...payload.hotel,
      canonicalUrl: absoluteUrl(payload.hotel.canonicalUrl),
      description: result.hotel.description,
      distanceLabel: result.hotel.distanceLabel,
      conciergeAdvice: result.hotel.conciergeAdvice,
      highlights: result.hotel.highlights,
      photos: result.hotel.photos.map((p) => ({ alt: p.alt, src: p.src })),
      rooms: result.hotel.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        maxOccupants: r.maxOccupants,
        sizeSqm: r.sizeSqm,
      })),
    },
  };
}

export type GetRankingInput = {
  slug: string;
  locale: AgentLocale;
};

export async function getRanking(input: GetRankingInput) {
  const result = await getRankingV2({ slug: input.slug, locale: input.locale });
  if (result === null) {
    return { ok: false as const, error: 'not_found' as const };
  }

  const payload = toRankingAgentJson(result, input.locale);
  return {
    ...payload,
    ranking: {
      ...payload.ranking,
      canonicalUrl: absoluteUrl(payload.ranking.canonicalUrl),
      entries: payload.ranking.entries.map((e) => ({
        ...e,
        hotelUrl: absoluteUrl(e.canonicalUrl),
      })),
    },
  };
}

export async function requestQuote(input: QuoteInput) {
  const hotelResult = await getHotelV2({ slug: input.hotelSlug, locale: input.locale });
  if (hotelResult === null) {
    return { ok: false as const, error: 'not_found' as const };
  }

  const requestRef = `v2q-${input.hotelSlug.slice(0, 8).replace(/[^a-z0-9]/gi, '')}-${Date.now().toString(36)}`;
  return {
    ok: true as const,
    mode: 'concierge_stub' as const,
    requestRef,
    deduplicated: false,
    etaHours: 24,
    hotel: { slug: hotelResult.hotel.slug, name: hotelResult.hotel.name },
    summary: {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      email: input.email,
    },
    phase6Frozen: true,
    message:
      input.locale === 'en'
        ? 'Your quote request has been queued. A concierge will respond within 24 hours.'
        : 'Votre demande de devis est enregistrée. Un concierge vous répond sous 24 h.',
  };
}
