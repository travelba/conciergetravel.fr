import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { listItineraries } from '@/server/itineraries/list-itineraries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/itineraries — list published itineraries with optional
 * filters by destination, travel style, theme or duration.
 *
 * Mirror of `list-itineraries` skill (CDC §6.1, ADR-0017). Returns one
 * compact card per itinerary so an LLM can pick the most relevant
 * itinerary to cite or follow up on with a `get-itinerary` call.
 *
 * The detail payload (sections, FAQ, hero, related links) is exposed by
 * the sibling `/api/agent/itinerary/[slug]` endpoint to keep this list
 * response small even with the full catalogue.
 */
const QuerySchema = z.object({
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/u)
    .optional(),
  destination_region: z.string().min(1).max(120).optional(),
  destination_city: z.string().min(1).max(120).optional(),
  theme: z.string().min(1).max(120).optional(),
  travel_style: z
    .enum([
      'luxe',
      'famille',
      'couple',
      'solo',
      'aventure',
      'bien-etre',
      'gastronomie',
      'culture',
      'affaires',
    ])
    .optional(),
  duration_min_days: z.coerce.number().int().min(1).max(60).optional(),
  duration_max_days: z.coerce.number().int().min(1).max(60).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    country_code: url.searchParams.get('country_code') ?? undefined,
    destination_region: url.searchParams.get('destination_region') ?? undefined,
    destination_city: url.searchParams.get('destination_city') ?? undefined,
    theme: url.searchParams.get('theme') ?? undefined,
    travel_style: url.searchParams.get('travel_style') ?? undefined,
    duration_min_days: url.searchParams.get('duration_min_days') ?? undefined,
    duration_max_days: url.searchParams.get('duration_max_days') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { theme, locale, ...rest } = parsed.data;

  const cards = await listItineraries({
    ...rest,
    ...(theme !== undefined ? { themes: [theme] } : {}),
  }).catch(() => []);

  return agentJson(
    {
      ok: true,
      filter: {
        countryCode: parsed.data.country_code ?? null,
        destinationRegion: parsed.data.destination_region ?? null,
        destinationCity: parsed.data.destination_city ?? null,
        theme: theme ?? null,
        travelStyle: parsed.data.travel_style ?? null,
        durationMinDays: parsed.data.duration_min_days ?? null,
        durationMaxDays: parsed.data.duration_max_days ?? null,
      },
      count: cards.length,
      itineraries: cards.map((c) => ({
        slug: c.slugFr,
        title: locale === 'en' && c.titleEn !== null ? c.titleEn : c.titleFr,
        metaDescription: locale === 'en' && c.metaDescEn !== null ? c.metaDescEn : c.metaDescFr,
        countryCode: c.countryCode,
        destinationRegion: c.destinationRegion,
        destinationCity: c.destinationCity,
        themes: c.themes,
        travelStyle: c.travelStyle,
        season: c.season,
        durationMinDays: c.durationMinDays,
        durationMaxDays: c.durationMaxDays,
        hotelCount: c.hotelCount,
        priority: c.priority,
        lastUpdated: c.lastUpdated,
        canonicalUrl:
          locale === 'en' ? `/en/itineraire/${c.slugEn ?? c.slugFr}` : `/fr/itineraire/${c.slugFr}`,
      })),
    },
    { cacheControl: 'public, max-age=600, s-maxage=3600' },
  );
}
