import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildLoyaltyResult } from '@/server/mcp/builders/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/loyalty — loyalty programme tiers + benefits. Thin
 * shell over the shared `buildLoyaltyResult` builder (Lot 4, ADR-0029).
 * Mirror of the `loyalty` skill.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const result = buildLoyaltyResult();
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
