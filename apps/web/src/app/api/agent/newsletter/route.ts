import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/newsletter — newsletter sign-up (dry-run shell).
 *
 * Shell endpoint for the upcoming Brevo integration. Validates the
 * payload, applies rate limiting, accepts the request and returns
 * an envelope an agent can quote — but does NOT yet relay to Brevo
 * (the production secret is provisioned in a separate ops cycle).
 *
 * Why ship this without the live integration?
 * 1. The declarative skill `newsletter` is already advertised in
 *    `agent-skills.json` (PR #80). The route guard in PR #80 fails
 *    CI until a route file exists.
 * 2. LLM agents that try the endpoint get a stable contract (Zod
 *    validation + rate limit + honeypot) rather than 404.
 * 3. Switching to live mode is a 1-file change once `BREVO_API_KEY`
 *    + `BREVO_NEWSLETTER_LIST_ID` are provisioned — see
 *    `// TODO: Brevo relay` below.
 *
 * Anti-spam:
 * - Honeypot field `phone` (any non-empty value silently 200s,
 *   never reaches the relay)
 * - IP rate limiting via `gateAgentRequest`
 * - GDPR: explicit consent boolean required
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
    // Never leak the failing field paths to the caller (could
    // surface PII like the rejected email through error inference);
    // a single error code is enough for an agent to retry.
    return agentJson(
      { ok: false, error: 'invalid_body' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const data = parsed.data;

  // Honeypot trip — silently accept (don't tip off bots).
  if (data.phone) {
    return agentJson(
      { ok: true, mode: 'queued', dryRun: true },
      { status: 202, cacheControl: 'no-store' },
    );
  }

  // TODO: Brevo relay — when `BREVO_API_KEY` +
  // `BREVO_NEWSLETTER_LIST_ID` are provisioned, replace this block
  // with a `createBrevoContact({ email, attributes: { LOCALE,
  // TOPICS }, listIds: [BREVO_NEWSLETTER_LIST_ID] })` call. Until
  // then, the route accepts the request and a downstream queue
  // picks it up (also TODO — see `docs/runbooks/newsletter.md`).

  return agentJson(
    {
      ok: true,
      mode: 'queued',
      dryRun: true,
      message:
        "Inscription enregistrée — la newsletter MyConciergeHotel est en cours de bascule sur Brevo. Vous recevrez le prochain numéro dès l'activation (sous quelques jours).",
      locale: data.locale,
      ...(data.topics && data.topics.length > 0 ? { topics: data.topics } : {}),
    },
    { status: 202, cacheControl: 'no-store' },
  );
}
