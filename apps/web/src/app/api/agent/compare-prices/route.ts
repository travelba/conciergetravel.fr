import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getHotelBySlug } from '@/server/hotels/get-hotel-by-slug';
import { getPriceComparison } from '@/server/price-comparison/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/compare-prices — agent-facing wrapper around
 * `/api/price-comparison`.
 *
 * Mirror of the `compare-prices` skill. The human endpoint accepts a
 * Supabase hotel `id` (UUID) as `hotelId`; the agent contract is
 * slug-based (`hotelSlug`) — same convention as every other agent
 * skill — so this route resolves slug → id before delegating to the
 * shared service.
 *
 * Strict legal contract preserved from the human endpoint:
 *  - prices in TTC EUR cents, **never** clickable links
 *  - hides unavailable rows
 *  - `cached: true` when served from the persisted fallback
 *
 * Rate limit: agent-IP gate (60 req/min/IP) — note the human endpoint
 * uses a separate 30 req/min/IP limiter; the agent gate is more
 * generous because an LLM orchestrating a multi-turn comparison
 * (fetch ranking → 5 hotels → compare each) needs a higher budget.
 *
 * Skill: api-integration, competitive-pricing-comparison.
 */
const BodySchema = z.object({
  hotelSlug: z.string().min(1).max(120),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  adults: z.number().int().min(1).max(6).default(2),
  locale: z.enum(['fr', 'en']).default('fr'),
});

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: NO_STORE },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, headers: NO_STORE },
    );
  }
  const { hotelSlug, checkIn, checkOut, adults, locale } = parsed.data;

  const hotel = await getHotelBySlug(hotelSlug, locale).catch(() => null);
  if (hotel === null) {
    return NextResponse.json(
      { ok: false, error: 'hotel_not_found', hotelSlug },
      { status: 404, headers: NO_STORE },
    );
  }

  const outcome = await getPriceComparison({
    hotelId: hotel.row.id,
    checkIn,
    checkOut,
    adults,
  });

  if (!outcome.available) {
    return NextResponse.json(
      { ok: true, available: false, reason: outcome.reason },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      available: true,
      source: outcome.source,
      cached: outcome.cached,
      competitors: outcome.normalized.competitors,
      benefitsValueMinor: outcome.normalized.benefitsValueMinor,
      priceConciergeMinor: outcome.priceConciergeMinor,
      stay: outcome.normalized.stay,
    },
    {
      // Agent traffic can be bursty (an LLM may fetch the same
      // comparison twice within a multi-turn loop). 60 s CDN cache
      // absorbs that without leaking pricing across users.
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    },
  );
}
