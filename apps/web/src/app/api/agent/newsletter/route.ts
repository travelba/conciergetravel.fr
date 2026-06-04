import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildNewsletterResult } from '@/server/mcp/builders/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/newsletter — newsletter sign-up (dry-run shell). Thin
 * shell over the shared `buildNewsletterResult` builder (Lot 4,
 * ADR-0029). Honeypot + dry-run semantics preserved in the builder.
 *
 * Skill: api-integration, email-workflow-automation.
 */
const BodySchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(['fr', 'en']).default('fr'),
  topics: z
    .array(z.enum(['palaces', 'guides', 'rankings', 'concierge-tips']))
    .max(4)
    .optional(),
  consent: z.literal(true),
  // Honeypot — should always be empty for legit submissions.
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

  const result = buildNewsletterResult({
    email: data.email,
    locale: data.locale,
    ...(data.topics !== undefined ? { topics: data.topics } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
