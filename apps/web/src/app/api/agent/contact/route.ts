import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildContactResult } from '@/server/mcp/builders/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/contact — agent-facing contact form intake. Thin
 * shell over the shared `buildContactResult` builder (Lot 4, ADR-0029).
 * Honeypot + dry-run semantics preserved in the builder.
 *
 * Skill: api-integration, security-engineering §PII, email-workflow-automation.
 */
const BodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(4000),
  locale: z.enum(['fr', 'en']).default('fr'),
  phone: z.string().min(5).max(40).optional(),
  // Honeypot field — bots fill it, humans don't.
  website: z.string().max(0).optional(),
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
    const issue = parsed.error.issues[0];
    return agentJson(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const body = parsed.data;

  const result = buildContactResult({
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
    locale: body.locale,
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.website !== undefined ? { website: body.website } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
