import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getCountryDirectory } from '@/server/annuaire/get-country-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/directory/[pays] — geolocated hotel directory for one
 * country (ADR-0026).
 *
 * Machine-readable counterpart to the `/hotels/[pays]` annuaire page.
 * Returns every published hotel in the country grouped by city, each
 * carrying WGS84 coordinates so an LLM / agent can answer "hotels in
 * <country>" and cluster / rank them by location without scraping HTML.
 *
 * Response shape:
 *
 *   { ok: true, pays, countryName,
 *     cities: [{ city, citySlug, hotels: [{ name, slug, url, lat, lng, isPalace }] }],
 *     count, located, canonicalUrl }
 *
 * `located` = hotels with non-null coordinates. No pricing /
 * availability (Phase 6 freeze).
 *
 * Skill: api-integration, geo-llm-optimization §LLM-actionable surfaces.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pays: string }> },
): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { locale } = parsedQuery.data;

  const { pays } = await params;
  if (typeof pays !== 'string' || pays.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_params' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const directory = await getCountryDirectory(pays, locale).catch(() => null);
  if (directory === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', pays },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const prefix = locale === 'en' ? '/en/hotel/' : '/fr/hotel/';
  let located = 0;
  const cities = directory.cities.map((c) => {
    const hotels = c.hotels.map((h) => {
      if (h.lat !== null && h.lng !== null) located += 1;
      return {
        name: h.name,
        slug: h.slug,
        url: `${prefix}${h.slug}`,
        lat: h.lat,
        lng: h.lng,
        isPalace: h.isPalace,
      };
    });
    return { city: c.name, citySlug: c.slug, hotels };
  });

  return NextResponse.json(
    {
      ok: true,
      pays: directory.slug,
      countryName: directory.name,
      cities,
      count: directory.totalCount,
      located,
      canonicalUrl:
        locale === 'en' ? `/en/hotels/${directory.slug}` : `/fr/hotels/${directory.slug}`,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600',
      },
    },
  );
}
