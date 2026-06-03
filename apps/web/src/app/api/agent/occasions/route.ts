import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildOccasionsResult } from '@/server/mcp/builders/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/occasions — travel occasions. Thin shell over the
 * shared `buildOccasionsResult` builder (Lot 4, ADR-0029). Mirror of
 * the `list-occasions` skill.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const result = buildOccasionsResult();
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
