import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildRankingsListResult } from '@/server/mcp/builders/editorial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/rankings — list published editorial rankings, with
 * optional axis filter. Thin shell over `buildRankingsListResult`
 * (Lot 4, ADR-0029). Mirror of the `list-rankings` skill.
 */
const QuerySchema = z.object({
  axe: z.enum(['type', 'lieu', 'theme', 'occasion', 'saison']).optional(),
  valeur: z.string().min(1).max(120).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    axe: url.searchParams.get('axe') ?? undefined,
    valeur: url.searchParams.get('valeur') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { axe, valeur, locale } = parsed.data;

  const result = await buildRankingsListResult({
    locale,
    ...(axe !== undefined ? { axe } : {}),
    ...(valeur !== undefined ? { valeur } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
