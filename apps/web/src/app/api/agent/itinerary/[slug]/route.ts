import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildItineraryResult } from '@/server/mcp/builders/editorial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/itinerary/[slug] — full itinerary payload for an
 * agent. Thin shell over the shared `buildItineraryResult` builder
 * (Lot 4, ADR-0029). Mirror of the `get-itinerary` skill.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const result = await buildItineraryResult({ slug, locale });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
