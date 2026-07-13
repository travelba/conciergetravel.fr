import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/quote — concierge quote stub (Phase 0 v2).
 * Validates input and returns a synthetic request reference without
 * persisting to Brevo until Phase 6 booking APIs ship.
 */
const QuoteBodySchema = z.object({
  hotelSlug: z.string().min(1).max(120),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  adults: z.number().int().min(1).max(6),
  children: z.number().int().min(0).max(4).default(0),
  message: z.string().trim().max(1000).optional(),
  guest: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().email(),
    phone: z.string().trim().min(3).max(32),
    nationality: z.string().trim().length(2).optional(),
  }),
  locale: z.enum(['fr', 'en']).default('fr'),
});

function buildStubRequestRef(hotelSlug: string): string {
  const suffix = hotelSlug.slice(0, 8).replace(/[^a-z0-9]/gi, '');
  const stamp = Date.now().toString(36);
  return `v2q-${suffix}-${stamp}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = QuoteBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = parsed.data;

  return NextResponse.json(
    {
      ok: true,
      mode: 'concierge_stub' as const,
      requestRef: buildStubRequestRef(body.hotelSlug),
      deduplicated: false,
      etaHours: 24,
      message:
        body.locale === 'en'
          ? 'Your quote request has been queued. A concierge will respond within 24 hours.'
          : 'Votre demande de devis est enregistrée. Un concierge vous répond sous 24 h.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
