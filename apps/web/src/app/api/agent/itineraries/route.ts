import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildItinerariesListResult } from '@/server/mcp/builders/editorial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/itineraries — list published itineraries with optional
 * filters. Thin shell over `buildItinerariesListResult` (Lot 4,
 * ADR-0029). Mirror of the `list-itineraries` skill.
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
  const d = parsed.data;

  const result = await buildItinerariesListResult({
    locale: d.locale,
    ...(d.country_code !== undefined ? { country_code: d.country_code } : {}),
    ...(d.destination_region !== undefined ? { destination_region: d.destination_region } : {}),
    ...(d.destination_city !== undefined ? { destination_city: d.destination_city } : {}),
    ...(d.theme !== undefined ? { theme: d.theme } : {}),
    ...(d.travel_style !== undefined ? { travel_style: d.travel_style } : {}),
    ...(d.duration_min_days !== undefined ? { duration_min_days: d.duration_min_days } : {}),
    ...(d.duration_max_days !== undefined ? { duration_max_days: d.duration_max_days } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
