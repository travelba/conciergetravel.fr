import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildDirectoryCountryResult } from '@/server/mcp/builders/directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/directory/[pays] — geolocated hotel directory for one
 * country (ADR-0026). Thin shell over `buildDirectoryCountryResult`
 * (Lot 4, ADR-0029). No pricing / availability (Phase 6 freeze).
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ pays: string }> }) {
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

  const { pays } = await params;
  if (typeof pays !== 'string' || pays.length === 0) {
    return agentJson(
      { ok: false, error: 'invalid_params' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const result = await buildDirectoryCountryResult({ pays, locale });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
