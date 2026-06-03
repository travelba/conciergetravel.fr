import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildJoinPrestigeResult } from '@/server/mcp/builders/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/join-prestige-waitlist — Le Concierge Club Prestige
 * waitlist intake (deep-link shell). Thin shell over the shared
 * `buildJoinPrestigeResult` builder (Lot 4, ADR-0029).
 *
 * Skill: api-integration, loyalty-program, membership-program.
 */
const BodySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function POST(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  let raw: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      raw = await req.json();
    } catch {
      return agentJson(
        { ok: false, error: 'invalid_json' },
        { status: 400, cacheControl: 'no-store' },
      );
    }
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_body' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const result = buildJoinPrestigeResult({ locale: parsed.data.locale });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
