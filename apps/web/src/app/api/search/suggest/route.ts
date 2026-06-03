import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import type { Locale } from '@/i18n/routing';
import { searchCitiesCatalogOnServer } from '@/lib/search/cities-catalog';
import { searchHotelsCatalogOnServer } from '@/lib/search/hotels-catalog';
import { readClientIp } from '@/server/agent/rate-limit';
import {
  getCountryNameByCode,
  searchCatalogCountries,
} from '@/server/search/catalog-countries';
import { gateSuggestByIp } from '@/server/search/suggest-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().min(1).max(80),
  locale: z.enum(['fr', 'en']).default('fr'),
  hotels: z.coerce.number().int().min(1).max(10).default(5),
  cities: z.coerce.number().int().min(1).max(10).default(5),
  countries: z.coerce.number().int().min(0).max(10).default(3),
});

/**
 * Build locale-aware hrefs rather than trusting the `url_path` baked into
 * the Algolia record (hotels are unlocalized, cities point at a stale
 * `/destinations` plural). Both `/hotel/[slug]` and `/destination/[citySlug]`
 * are *identical* across locales in `routing.pathnames` (ADR-0008), so the
 * only locale variance is the `as-needed` prefix (`fr` → none, `en` → `/en`).
 * We prepend it directly here — avoids pulling next-intl's `getPathname`
 * into the route-handler runtime.
 */
function localePrefix(locale: Locale): string {
  return locale === 'fr' ? '' : `/${locale}`;
}

function hotelHref(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/hotel/${slug}`;
}

function cityHref(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/destination/${slug}`;
}

/**
 * Country suggestions bridge to the annuaire directory (`/hotels/<slug>`,
 * ADR-0026) — the exhaustive per-country listing — since the Algolia
 * hotel index carries no country field. Identical slug across locales,
 * only the prefix varies.
 */
function countryHref(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/hotels/${slug}`;
}

/**
 * Public destination + hotel suggest endpoint (skill: search-engineering).
 * Uses the **search-only** Algolia API key wired in `@/lib/search/*`.
 *
 * No PII is logged; failures yield empty arrays rather than upstream errors.
 * Per-IP rate-limited (60 req/min) via `gateSuggestByIp` — degrades open
 * when Redis is unconfigured (preview / dev).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const verdict = await gateSuggestByIp(readClientIp(req.headers));
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(verdict.retryAfterSec),
        },
      },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    locale: url.searchParams.get('locale') ?? undefined,
    hotels: url.searchParams.get('hotels') ?? undefined,
    cities: url.searchParams.get('cities') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const {
    q,
    locale,
    hotels: hLimit,
    cities: cLimit,
    countries: countryLimit,
  } = parsed.data;

  const [hotels, cities, countries, countryNames] = await Promise.all([
    searchHotelsCatalogOnServer(locale, q, hLimit),
    searchCitiesCatalogOnServer(locale, q, cLimit),
    countryLimit > 0 ? searchCatalogCountries(locale, q, countryLimit) : Promise.resolve([]),
    // Used to enrich city/hotel lines with the country name (the city
    // index only stores `country_code`). Cached, so this is free.
    getCountryNameByCode(locale),
  ]);

  return NextResponse.json(
    {
      ok: true,
      query: q,
      locale,
      hotels: hotels.map((h) => ({
        objectID: h.objectID,
        name: h.name,
        city: h.city,
        region: h.region,
        country: h.country ?? null,
        slug: h.slug,
        href: hotelHref(locale, h.slug),
        is_palace: h.is_palace,
        stars: h.stars,
      })),
      cities: cities.map((c) => ({
        objectID: c.objectID,
        name: c.name,
        region: c.region,
        country: countryNames[c.country_code] ?? null,
        slug: c.slug,
        href: cityHref(locale, c.slug),
        hotels_count: c.hotels_count,
        is_popular: c.is_popular,
      })),
      countries: countries.map((c) => ({
        code: c.code,
        name: c.name,
        slug: c.slug,
        href: countryHref(locale, c.slug),
        hotels_count: c.hotelsCount,
      })),
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=60',
      },
    },
  );
}
