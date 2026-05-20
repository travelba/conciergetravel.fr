import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { searchHotelsCatalogOnServer } from '@/lib/search/hotels-catalog';
import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getBestOfferForHotel } from '@/server/hotels/get-best-offer';
import { getHotelBySlug } from '@/server/hotels/get-hotel-by-slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/search — LLM-actionable hotel search (C2 / CDC §6.5).
 *
 * Mirrors the declarative `search` skill in
 * `packages/seo/src/agent-skills.ts`. An LLM agent (ChatGPT, Claude,
 * Perplexity action runner) sends a JSON body with the user's intent;
 * the endpoint returns:
 *
 *   - `hotels[]` — slugs + factual summary + canonical URL (FR + EN)
 *     of the top matches from the Algolia catalogue.
 *   - `offers[]` — when `checkIn`/`checkOut`/`adults` are provided,
 *     one best-rate Amadeus offer per hotel (cached 5 min via the
 *     existing `getBestOfferForHotel` helper).
 *
 * The response is intentionally compact (≤ 8 KB even for 10 hotels)
 * so it fits in a single LLM tool-call envelope. PII is never logged.
 *
 * Skill: api-integration, geo-llm-optimization, search-engineering.
 */
const SearchBodySchema = z.object({
  destination: z.string().min(1).max(120),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  checkOut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  adults: z.number().int().min(1).max(6).optional(),
  children: z.number().int().min(0).max(4).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  limit: z.number().int().min(1).max(10).default(5),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = SearchBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = parsed.data;

  // Algolia hot path — already cached on the search-only key.
  const algoliaHits = await searchHotelsCatalogOnServer(body.locale, body.destination, body.limit);

  // Resolve full hotel rows in parallel so we can ship canonical URLs
  // + factual summaries. Falls back gracefully when a row is unindexed.
  const detail = await Promise.all(
    algoliaHits.map(async (hit) => {
      const slug = hit.url_path?.split('/').pop() ?? null;
      if (slug === null || slug.length === 0) return null;
      const hotel = await getHotelBySlug(slug, body.locale).catch(() => null);
      if (hotel === null) return null;
      return { hit, row: hotel.row };
    }),
  );
  const resolved = detail.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // Best-offer fetch (live Amadeus, Redis-cached 5 min). Only fires
  // when the agent supplied a stay window — otherwise we ship just
  // the catalogue cards.
  const wantsOffers =
    body.checkIn !== undefined && body.checkOut !== undefined && body.adults !== undefined;
  const offers = wantsOffers
    ? await Promise.all(
        resolved.map(async ({ row }) => {
          const result = await getBestOfferForHotel({
            hotelId: row.id,
            amadeusHotelId:
              row.amadeus_hotel_id !== null && row.amadeus_hotel_id.length > 0
                ? row.amadeus_hotel_id
                : null,
            checkIn: body.checkIn ?? '',
            checkOut: body.checkOut ?? '',
            adults: body.adults ?? 2,
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

  return NextResponse.json(
    {
      ok: true,
      query: { destination: body.destination, locale: body.locale },
      hotels: resolved.map(({ row, hit }) => ({
        id: row.id,
        slug: row.slug,
        slugEn: row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : null,
        name:
          body.locale === 'en' && row.name_en !== null && row.name_en.length > 0
            ? row.name_en
            : row.name,
        city: row.city,
        stars: row.stars,
        isPalace: row.is_palace,
        factualSummary:
          body.locale === 'en'
            ? (row.factual_summary_en ?? row.factual_summary_fr ?? null)
            : (row.factual_summary_fr ?? null),
        canonicalUrl: hit.url_path,
        bookingMode: row.booking_mode,
      })),
      offers: offers.filter((o): o is NonNullable<typeof o> => o !== null),
    },
    {
      headers: {
        // No CDN cache — every search is fresh from Algolia + Amadeus.
        // The downstream Amadeus best-offer call is cached 5 min in
        // Redis (see `getBestOfferForHotel`).
        'Cache-Control': 'no-store',
      },
    },
  );
}
