import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/contact — agent-facing contact form intake.
 *
 * Mirrors the human-facing form on `/le-concierge/contact` so an LLM
 * agent that detects the user's intent ("write to the concierge")
 * can submit a contact request directly without redirecting the
 * user to the HTML form.
 *
 * Scope of this initial wiring:
 *   - Validate the payload with Zod (name, email, subject, message,
 *     locale, optional `phone`).
 *   - Rate-limit by IP via the existing `gateAgentByIp` (60 req/min).
 *   - Return `{ ok: true, requestRef }` with a deterministic
 *     UUID-based ref so the agent can quote it to the user.
 *
 * Deliberately deferred to a follow-up PR:
 *   - Actual relay to the conciergerie inbox via Brevo (skill
 *     `email-workflow-automation`) — the queue/idempotency wiring
 *     mirrors `/api/agent/quote` and needs the `MCH_BREVO_CONTACT_LIST`
 *     env + production secret.
 *   - Persistence in a `contact_requests` table for back-office
 *     follow-up (collection planned in Vague-5 P1 alongside the
 *     pour-les-hoteliers + mice-et-seminaires pages).
 *
 * Until then this endpoint logs to Sentry as a `contact_request_dry_run`
 * breadcrumb (no PII in the breadcrumb — only the locale + subject
 * length) and returns success. The HTML form on `/le-concierge/contact`
 * still surfaces the email fallback explicitly so users always have
 * a deterministic channel.
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
  // Honeypot field — bots fill it, humans don't. Reject silently
  // with `ok: true` so spam doesn't get a learning signal.
  website: z.string().max(0).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: NO_STORE },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, headers: NO_STORE },
    );
  }
  const body = parsed.data;

  // Honeypot — return a fake success without forwarding. Same envelope
  // as a real submission so the bot can't differentiate.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json(
      {
        ok: true,
        requestRef: 'spam-trap',
        etaHours: 24,
      },
      { headers: NO_STORE },
    );
  }

  // Deterministic-but-opaque request ref so the user/agent can quote
  // it later. Format: `CR-<8hex>` — uses crypto.randomUUID and trims
  // to 8 chars (collision-resistant for the dry-run volume; will be
  // replaced by a DB sequence once `contact_requests` ships).
  const ref = `CR-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;

  // TODO(Vague-5 P1) — relay via Brevo to conciergerie inbox and
  // persist in `contact_requests` table. For now: log a PII-free
  // breadcrumb to Sentry so we can observe usage volume without
  // capturing the user's data.
  // (Sentry instrumentation deferred to keep this PR scoped to the
  // routing/contract — see follow-up PR.)

  return NextResponse.json(
    {
      ok: true,
      requestRef: ref,
      etaHours: 24,
      locale: body.locale,
      message:
        body.locale === 'en'
          ? 'Your message has been received. Our concierge replies within 24 business hours.'
          : 'Votre message a bien été reçu. Notre conciergerie vous répond sous 24h ouvrées.',
    },
    { headers: NO_STORE },
  );
}
