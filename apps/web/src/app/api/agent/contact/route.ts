import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { submitContactRequest } from '@/server/contact/contact-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/contact — concierge contact intake (human form + agent).
 *
 * Shared entry for the HTML form on `/le-concierge/contact` and for an LLM
 * agent that detects "write to the concierge" intent. Delegates to
 * `submitContactRequest` (validation, IP+email rate-limit, Redis idempotency,
 * `contact_requests` persistence, Brevo relay guest + ops).
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
  source: z.string().min(1).max(40).optional(),
  // Honeypot field — bots fill it, humans don't. Reject silently with
  // `ok: true` so spam doesn't get a learning signal.
  website: z.string().max(0).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function successMessage(locale: 'fr' | 'en'): string {
  return locale === 'en'
    ? 'Your message has been received. Our concierge replies within 24 business hours.'
    : 'Votre message a bien été reçu. Notre conciergerie vous répond sous 24h ouvrées.';
}

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

  // Honeypot — fake success without forwarding. Same envelope as a real
  // submission so the bot can't differentiate.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json(
      { ok: true, requestRef: 'spam-trap', etaHours: 24 },
      { headers: NO_STORE },
    );
  }

  const result = await submitContactRequest({
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
    locale: body.locale,
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    source: body.source ?? 'agent_api',
    clientIp: ip,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        ok: true,
        requestRef: result.value.requestRef,
        etaHours: 24,
        locale: body.locale,
        message: successMessage(body.locale),
      },
      { headers: NO_STORE },
    );
  }

  const error = result.error;
  switch (error.kind) {
    case 'validation':
      return NextResponse.json(
        { ok: false, error: 'validation', field: error.field, message: error.message },
        { status: 400, headers: NO_STORE },
      );
    case 'rate_limited':
      return NextResponse.json(
        {
          ok: false,
          error: 'rate_limited',
          retryAfterSec: error.retryAfterSec,
          scope: error.scope,
        },
        { status: 429, headers: NO_STORE },
      );
    case 'duplicate':
      // Idempotent replay — surface the original ref as a success.
      return NextResponse.json(
        {
          ok: true,
          requestRef: error.requestRef,
          etaHours: 24,
          locale: body.locale,
          message: successMessage(body.locale),
          deduplicated: true,
        },
        { headers: NO_STORE },
      );
    case 'database':
    case 'internal':
      return NextResponse.json(
        { ok: false, error: 'server_error' },
        { status: 502, headers: NO_STORE },
      );
    default: {
      const _exhaustive: never = error;
      return _exhaustive;
    }
  }
}
