import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getCityDirectory } from '@/server/annuaire/get-city-directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/directory/[pays]/[ville] — geolocated hotel directory
 * for one city (ADR-0026).
 *
 * Machine-readable counterpart to the `/hotels/[pays]/[ville]` annuaire
 * page. Returns the exhaustive, factual list of published hotels in the
 * city with their WGS84 coordinates so an LLM / agent (ChatGPT Actions,
 * Claude Tools, Perplexity, MCP) can answer "hotels in <city>" and plot
 * or rank them by location without scraping the HTML.
 *
 * Response shape:
 *
 *   { ok: true, pays, ville, countryName, cityName,
 *     hotels: [{ name, slug, url, lat, lng, isPalace }],
 *     count, located, canonicalUrl }
 *
 * `located` = hotels with non-null coordinates (`count` is the total).
 * Hotels without coordinates are still listed (lat/lng = null) — never
 * fabricated. No pricing / availability (Phase 6 freeze).
 *
 * Skill: api-integration, geo-llm-optimization §LLM-actionable surfaces.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pays: string; ville: string }> },
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

  const { pays, ville } = await params;
  if (
    typeof pays !== 'string' ||
    pays.length === 0 ||
    typeof ville !== 'string' ||
    ville.length === 0
  ) {
    return NextResponse.json(
      { ok: false, error: 'invalid_params' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const directory = await getCityDirectory(pays, ville, locale).catch(() => null);
  if (directory === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', pays, ville },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const prefix = locale === 'en' ? '/en/hotel/' : '/fr/hotel/';
  const hotels = directory.hotels.map((h) => ({
    name: h.name,
    slug: h.slug,
    url: `${prefix}${h.slug}`,
    lat: h.lat,
    lng: h.lng,
    isPalace: h.isPalace,
  }));
  const located = hotels.filter((h) => h.lat !== null && h.lng !== null).length;

  return NextResponse.json(
    {
      ok: true,
      pays: directory.countrySlug,
      ville: directory.citySlug,
      countryName: directory.countryName,
      cityName: directory.cityName,
      hotels,
      count: hotels.length,
      located,
      canonicalUrl:
        locale === 'en'
          ? `/en/hotels/${directory.countrySlug}/${directory.citySlug}`
          : `/fr/hotels/${directory.countrySlug}/${directory.citySlug}`,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600',
      },
    },
  );
}
