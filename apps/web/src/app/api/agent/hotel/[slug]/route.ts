import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildHotelResult } from '@/server/mcp/builders/hotels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/hotel/[slug] — full hotel snapshot for LLM agents
 * (C2 / CDC §6.5 — mirror of declarative skill `get-hotel`).
 *
 * Thin transport shell: IP gate + input parsing, then delegates the
 * JSON shaping to the shared `buildHotelResult` builder so the MCP tool
 * `get-hotel` returns a byte-identical payload (Lot 4, ADR-0029).
 *
 * Skill: api-integration, geo-llm-optimization, structured-data-schema-org.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  body: z.enum(['short', 'long']).default('short'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
    body: url.searchParams.get('body') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale, body: bodyMode } = parsed.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const result = await buildHotelResult({ slug, locale, bodyMode });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
