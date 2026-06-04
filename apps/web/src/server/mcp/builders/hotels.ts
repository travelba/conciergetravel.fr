import 'server-only';

import { searchHotelsCatalogOnServer } from '@/lib/search/hotels-catalog';
import { getBestOfferForHotel } from '@/server/hotels/get-best-offer';
import {
  getHotelBySlug,
  readConciergeAdvice,
  readFactualSummary,
} from '@/server/hotels/get-hotel-by-slug';
import { getHotelExternalSourcesBySlug } from '@/server/hotels/get-hotel-external-sources';
import { getRoomBySlug } from '@/server/hotels/get-room-by-slug';

import { type AgentLocale, type BuilderResponse, errorResponse, okResponse } from './types';

/**
 * Hotel-domain result builders shared by `/api/agent/*` routes and the
 * MCP tools (Lot 4, ADR-0029). Each function reproduces the exact JSON
 * shaping the route used to inline, so the HTTP and MCP surfaces stay
 * byte-for-byte identical.
 */

const HOTEL_CACHE = 'private, max-age=300, stale-while-revalidate=600';
const TIP_CACHE = 'private, max-age=1800, stale-while-revalidate=3600';

export interface SearchParams {
  readonly destination: string;
  readonly locale: AgentLocale;
  readonly limit: number;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adults?: number;
  readonly children?: number;
}

export interface SearchOptions {
  /**
   * Phase 6 freeze: when true the builder NEVER fetches live Amadeus
   * offers (the MCP path passes this to guarantee zero vendor calls,
   * regardless of a hotel's `booking_mode`). The HTTP route leaves it
   * false so the data-driven path auto-activates in Phase 6.
   */
  readonly freezeOffers?: boolean;
}

export async function buildSearchResult(
  params: SearchParams,
  options: SearchOptions = {},
): Promise<BuilderResponse> {
  const freezeOffers = options.freezeOffers ?? false;

  const algoliaHits = await searchHotelsCatalogOnServer(
    params.locale,
    params.destination,
    params.limit,
  );

  const detail = await Promise.all(
    algoliaHits.map(async (hit) => {
      const slug = hit.url_path?.split('/').pop() ?? null;
      if (slug === null || slug.length === 0) return null;
      const hotel = await getHotelBySlug(slug, params.locale).catch(() => null);
      if (hotel === null) return null;
      return { hit, row: hotel.row };
    }),
  );
  const resolved = detail.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const wantsOffers =
    !freezeOffers &&
    params.checkIn !== undefined &&
    params.checkOut !== undefined &&
    params.adults !== undefined;

  const offers = wantsOffers
    ? await Promise.all(
        resolved.map(async ({ row }) => {
          if (row.booking_mode !== 'amadeus' && row.booking_mode !== 'little') return null;
          const result = await getBestOfferForHotel({
            hotelId: row.id,
            amadeusHotelId:
              row.amadeus_hotel_id !== null && row.amadeus_hotel_id.length > 0
                ? row.amadeus_hotel_id
                : null,
            checkIn: params.checkIn ?? '',
            checkOut: params.checkOut ?? '',
            adults: params.adults ?? 2,
            childAges: [],
          });
          if (result.offerId === null || result.priceFrom === null) return null;
          return {
            hotelId: row.id,
            slug: row.slug,
            offerId: result.offerId,
            priceFromEUR: result.priceFrom.amount.fromMinor / 100,
            currency: result.priceFrom.amount.currency,
            source: result.priceFrom.source,
          };
        }),
      )
    : [];

  const body: Record<string, unknown> = {
    query: { destination: params.destination, locale: params.locale },
    hotels: resolved.map(({ row, hit }) => ({
      id: row.id,
      slug: row.slug,
      slugEn: row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : null,
      name:
        params.locale === 'en' && row.name_en !== null && row.name_en.length > 0
          ? row.name_en
          : row.name,
      city: row.city,
      stars: row.stars,
      isPalace: row.is_palace,
      factualSummary:
        params.locale === 'en'
          ? (row.factual_summary_en ?? row.factual_summary_fr ?? null)
          : (row.factual_summary_fr ?? null),
      canonicalUrl: hit.url_path,
      bookingMode: row.booking_mode,
    })),
    offers: offers.filter((o): o is NonNullable<typeof o> => o !== null),
  };

  // Phase 6 freeze signal — only on the MCP path so the agent knows
  // live rates are deferred, not missing (AGENTS.md §4ter, ADR-0025).
  if (freezeOffers) {
    body['offersFrozen'] = {
      phase: 6,
      reason: 'booking_apis_not_wired',
      availableAt: 'phase_6',
    };
  }

  return { status: 200, cacheControl: 'no-store', body: { ok: true, ...body } };
}

export interface HotelParams {
  readonly slug: string;
  readonly locale: AgentLocale;
  readonly bodyMode: 'short' | 'long';
}

export async function buildHotelResult(params: HotelParams): Promise<BuilderResponse> {
  const hotel = await getHotelBySlug(params.slug, params.locale).catch(() => null);
  if (hotel === null) {
    return errorResponse(404, { error: 'not_found', slug: params.slug });
  }
  const row = hotel.row;
  const { locale, bodyMode } = params;

  const factualSummary = readFactualSummary(row, locale);
  const conciergeAdvice = readConciergeAdvice(row, locale);

  const descriptionRaw =
    locale === 'en' ? (row.description_en ?? row.description_fr) : row.description_fr;
  const description =
    descriptionRaw === null
      ? null
      : bodyMode === 'long'
        ? descriptionRaw.slice(0, 4096)
        : descriptionRaw.length > 500
          ? `${descriptionRaw.slice(0, 497)}…`
          : descriptionRaw;

  return okResponse(
    {
      hotel: {
        id: row.id,
        slug: row.slug,
        slugEn: row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : null,
        name:
          locale === 'en' && row.name_en !== null && row.name_en.length > 0
            ? row.name_en
            : row.name,
        nameFr: row.name,
        stars: row.stars,
        isPalace: row.is_palace,
        city: row.city,
        region: row.region,
        country: row.country_code,
        bookingMode: row.booking_mode,
        amadeusHotelId:
          row.amadeus_hotel_id !== null && row.amadeus_hotel_id.length > 0
            ? row.amadeus_hotel_id
            : null,
        factualSummary: factualSummary?.text ?? null,
        conciergeAdvice:
          conciergeAdvice !== null
            ? {
                title: conciergeAdvice.title,
                body: conciergeAdvice.body,
                tipFor: conciergeAdvice.tipFor,
              }
            : null,
        description,
        canonicalUrl:
          locale === 'en' ? `/en/hotel/${row.slug_en ?? row.slug}` : `/fr/hotel/${row.slug}`,
        updatedAt: row.updated_at,
      },
    },
    HOTEL_CACHE,
  );
}

export interface RoomParams {
  readonly hotelSlug: string;
  readonly roomSlug: string;
  readonly locale: AgentLocale;
}

export async function buildHotelRoomResult(params: RoomParams): Promise<BuilderResponse> {
  const { hotelSlug, roomSlug, locale } = params;
  const detail = await getRoomBySlug(hotelSlug, roomSlug, locale).catch(() => null);
  if (detail === null) {
    return errorResponse(404, { error: 'not_found', hotelSlug, roomSlug });
  }

  const { room, hotel } = detail;
  const hotelRow = hotel.row;
  const canonicalHotelSlug =
    locale === 'en' && hotelRow.slug_en !== null && hotelRow.slug_en.length > 0
      ? hotelRow.slug_en
      : hotelRow.slug;

  return okResponse(
    {
      hotel: {
        slug: hotelRow.slug,
        name: hotelRow.name,
        city: hotelRow.city,
      },
      room: {
        slug: room.slug,
        code: room.roomCode,
        name: room.name,
        shortDescription: room.shortDescription,
        longDescription: room.longDescription,
        maxOccupancy: room.maxOccupancy,
        bedType: room.bedType,
        sizeSqm: room.sizeSqm,
        amenities: room.amenities,
        isSignature: room.isSignature,
        heroImage: room.heroImage,
        imageCount: room.images.length,
        indicativePrice: room.indicativePrice,
        canonicalUrl:
          locale === 'en'
            ? `/en/hotel/${canonicalHotelSlug}/chambres/${room.slug}`
            : `/fr/hotel/${canonicalHotelSlug}/chambres/${room.slug}`,
      },
    },
    TIP_CACHE,
  );
}

export interface ConciergeTipParams {
  readonly slug: string;
  readonly locale: AgentLocale;
}

export async function buildConciergeTipResult(
  params: ConciergeTipParams,
): Promise<BuilderResponse> {
  const { slug, locale } = params;
  const hotel = await getHotelBySlug(slug, locale).catch(() => null);
  if (hotel === null) {
    return errorResponse(404, { error: 'not_found', slug });
  }
  const row = hotel.row;
  const tip = readConciergeAdvice(row, locale);
  if (tip === null) {
    return errorResponse(404, {
      error: 'no_tip_yet',
      slug,
      canonicalUrl:
        locale === 'en' ? `/en/hotel/${row.slug_en ?? row.slug}` : `/fr/hotel/${row.slug}`,
    });
  }

  const canonicalSlug =
    locale === 'en' && row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : row.slug;

  return okResponse(
    {
      slug,
      hotelName:
        locale === 'en' && row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name,
      tip: {
        title: tip.title,
        body: tip.body,
        tipFor: tip.tipFor,
      },
      canonicalUrl:
        locale === 'en'
          ? `/en/hotel/${canonicalSlug}#conseil-concierge`
          : `/fr/hotel/${canonicalSlug}#conseil-concierge`,
      updatedAt: row.updated_at,
    },
    TIP_CACHE,
  );
}

export interface HotelSourcesParams {
  readonly slug: string;
  readonly locale: AgentLocale;
}

export async function buildHotelSourcesResult(
  params: HotelSourcesParams,
): Promise<BuilderResponse> {
  const { slug, locale } = params;
  const payload = await getHotelExternalSourcesBySlug(slug).catch(() => null);
  if (payload === null) {
    return errorResponse(404, { error: 'not_found', slug });
  }

  const canonicalSlug =
    locale === 'en' && payload.slugEn !== null && payload.slugEn.length > 0
      ? payload.slugEn
      : payload.slug;
  const hotelName =
    locale === 'en' && payload.nameEn !== null && payload.nameEn.length > 0
      ? payload.nameEn
      : payload.name;

  const sources = payload.sources.map((s) => {
    const out: {
      field: string;
      value: unknown;
      source: string;
      sourceUrl?: string;
      confidence?: 'high' | 'medium' | 'low';
      collectedAt?: string;
    } = {
      field: s.field,
      value: s.value,
      source: s.source,
    };
    if (s.source_url !== undefined) out.sourceUrl = s.source_url;
    if (s.confidence !== undefined) out.confidence = s.confidence;
    if (s.collected_at !== undefined) out.collectedAt = s.collected_at;
    return out;
  });

  const body: Record<string, unknown> = {
    slug: payload.slug,
    hotelName,
    sources,
    canonicalUrl: locale === 'en' ? `/en/hotel/${canonicalSlug}` : `/fr/hotel/${canonicalSlug}`,
    updatedAt: payload.updatedAt,
  };
  if (sources.length === 0) body['note'] = 'no_sources_yet';

  return okResponse(body, TIP_CACHE);
}
