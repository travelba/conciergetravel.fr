import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildCategoriesResult } from '@/server/mcp/builders/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/categories — editorial categories. Thin shell over the
 * shared `buildCategoriesResult` builder (Lot 4, ADR-0029). Mirror of
 * the `list-categories` skill.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const result = await buildCategoriesResult();
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
