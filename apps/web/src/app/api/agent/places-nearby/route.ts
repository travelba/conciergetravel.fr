import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import {
  getCanonicalPlacesForHotelSlug,
  type CanonicalPlaceCard,
} from '@/server/places/get-canonical-places-for-hotel';
import { listPublishedPlacesForCity, type PlaceListItem } from '@/server/places/list-places';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/places-nearby — "lieux à visiter" maillage surface.
 *
 * Two modes (one of `hotelSlug` | `citySlug` required):
 *
 * - `hotelSlug` → the canonical places (visit + do) linked to that hotel
 *   via the pre-computed `place_hotel_links` proximity table. Answers
 *   "what is there to see/do near <hotel>" with citation-grade canonical
 *   URLs (no content duplication — each place is a standalone fiche).
 * - `citySlug`  → the published places of a city (the ranking surface).
 *
 * Conforms to the API-last phasing: no pricing/availability, just the
 * editorial catalogue + GetYourGuide deeplink lives on the HTML fiche.
 *
 * Skill: api-integration, geo-llm-optimization.
 */
const QuerySchema = z
  .object({
    hotelSlug: z.string().min(1).optional(),
    citySlug: z.string().min(1).optional(),
    locale: z.enum(['fr', 'en']).default('fr'),
  })
  .refine((q) => q.hotelSlug !== undefined || q.citySlug !== undefined, {
    message: 'hotelSlug or citySlug required',
  });

function placePath(
  locale: 'fr' | 'en',
  citySlug: string,
  slugFr: string,
  slugEn: string | null,
): string {
  const slug = locale === 'en' && slugEn !== null && slugEn.length > 0 ? slugEn : slugFr;
  return locale === 'en' ? `/en/lieux/${citySlug}/${slug}` : `/fr/lieux/${citySlug}/${slug}`;
}

function projectCard(c: CanonicalPlaceCard, locale: 'fr' | 'en') {
  return {
    name: locale === 'en' && c.nameEn !== null ? c.nameEn : c.name,
    kind: c.kind,
    canonicalUrl: placePath(locale, c.citySlug, c.slug, c.slugEn),
    summary: (locale === 'en' ? c.factualSummaryEn : c.factualSummaryFr) ?? c.factualSummaryFr,
    distanceMeters: c.distanceMeters,
    walkMinutes: c.walkMinutes,
  };
}

function projectListItem(p: PlaceListItem, locale: 'fr' | 'en') {
  return {
    name: locale === 'en' && p.name_en ? p.name_en : p.name,
    bucket: p.bucket,
    kind: p.kind,
    canonicalUrl: placePath(locale, p.city_key, p.slug, p.slug_en ?? null),
    summary:
      (locale === 'en' ? p.factual_summary_en : p.factual_summary_fr) ?? p.factual_summary_fr,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    hotelSlug: url.searchParams.get('hotelSlug') ?? undefined,
    citySlug: url.searchParams.get('citySlug') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { hotelSlug, citySlug, locale } = parsed.data;

  if (hotelSlug !== undefined) {
    const linked = await getCanonicalPlacesForHotelSlug(hotelSlug).catch(() => null);
    if (linked === null) {
      return NextResponse.json(
        { ok: false, error: 'not_found', hotelSlug },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        hotelSlug,
        visit: linked.visit.map((c) => projectCard(c, locale)),
        do: linked.do.map((c) => projectCard(c, locale)),
      },
      { headers: { 'Cache-Control': 'public, max-age=1800, s-maxage=86400' } },
    );
  }

  if (citySlug === undefined || citySlug.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const places = await listPublishedPlacesForCity(citySlug).catch(() => []);
  return NextResponse.json(
    {
      ok: true,
      citySlug,
      visit: places.filter((p) => p.bucket === 'visit').map((p) => projectListItem(p, locale)),
      do: places.filter((p) => p.bucket === 'do').map((p) => projectListItem(p, locale)),
    },
    { headers: { 'Cache-Control': 'public, max-age=1800, s-maxage=86400' } },
  );
}
