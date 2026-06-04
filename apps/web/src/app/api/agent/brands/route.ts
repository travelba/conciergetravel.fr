import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildBrandsResult } from '@/server/mcp/builders/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/brands — hotel groups represented in the catalogue.
 * Thin shell over the shared `buildBrandsResult` builder (Lot 4,
 * ADR-0029). Mirror of the `list-brands` skill.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const result = await buildBrandsResult();
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
