import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildJoinClubResult } from '@/server/mcp/builders/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/join-concierge-club — Le Concierge Club sign-up
 * intake (deep-link shell). Thin shell over the shared
 * `buildJoinClubResult` builder (Lot 4, ADR-0029). Honeypot + club
 * event emission preserved in the builder.
 *
 * Skill: api-integration, auth-role-management, membership-program.
 */
const BodySchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  consentMarketing: z.boolean().optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  // Honeypot — bots fill this, humans don't.
  phone: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return agentJson(
      { ok: false, error: 'invalid_json' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_body' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const data = parsed.data;

  const result = await buildJoinClubResult({
    email: data.email,
    locale: data.locale,
    via: 'agent-skill',
    ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
    ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
