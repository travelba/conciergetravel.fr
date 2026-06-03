import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildHotelRoomResult } from '@/server/mcp/builders/hotels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/hotel/[slug]/room/[roomSlug] — room detail for an
 * agent. Thin shell over the shared `buildHotelRoomResult` builder
 * (Lot 4, ADR-0029). Mirror of `get-hotel-room` skill.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; roomSlug: string }> },
) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ locale: url.searchParams.get('locale') ?? undefined });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const { slug: hotelSlug, roomSlug } = await params;
  if (
    typeof hotelSlug !== 'string' ||
    hotelSlug.length === 0 ||
    typeof roomSlug !== 'string' ||
    roomSlug.length === 0
  ) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const result = await buildHotelRoomResult({ hotelSlug, roomSlug, locale });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
