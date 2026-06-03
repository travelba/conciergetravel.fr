import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildThemesResult } from '@/server/mcp/builders/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/themes — inspiration themes. Thin shell over the
 * shared `buildThemesResult` builder (Lot 4, ADR-0029). Mirror of the
 * `list-themes` skill.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const result = buildThemesResult();
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
