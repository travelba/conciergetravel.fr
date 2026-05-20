import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { submitEmailBookingRequest } from '@/server/booking/email-request';
import { getHotelBySlug } from '@/server/hotels/get-hotel-by-slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/quote — LLM-actionable concierge quote request
 * (C2 / CDC §6.5 — mirror of declarative skill `request-quote`).
 *
 * Pipeline:
 *   1. Rate-limit by IP (60 req/min, generous for multi-turn flows).
 *   2. Validate body (Zod). Email is mandatory; nationality, phone
 *      optional. Slug used for human-readable hotel identification
 *      (we resolve it server-side to a UUID before calling the
 *      booking domain).
 *   3. Resolve hotel by slug; refuse when `booking_mode != 'email'`
 *      (paid tunnel hotels have to go through `/reservation/start`
 *      not the quote endpoint).
 *   4. Delegate to `submitEmailBookingRequest` — same domain code as
 *      the human form, gets idempotency + Brevo email automation for
 *      free.
 *   5. Return `{ requestRef, eta }`.
 *
 * Skill: api-integration, booking-engine, email-workflow-automation.
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
    nationality: z.string().trim().min(2).max(2).optional(),
  }),
  locale: z.enum(['fr', 'en']).default('fr'),
});

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

  // Resolve slug → UUID. The email-booking domain expects a UUID
  // hotel id. We deliberately swallow lookup errors and return a
  // generic 404 — never leak DB internals to an LLM agent.
  const hotelDetail = await getHotelBySlug(body.hotelSlug, body.locale).catch(() => null);
  if (hotelDetail === null) {
    return NextResponse.json(
      { ok: false, error: 'hotel_not_found', slug: body.hotelSlug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await submitEmailBookingRequest({
    hotelId: hotelDetail.row.id,
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: body.adults,
    children: body.children,
    guest: body.guest,
    ...(body.message !== undefined ? { message: body.message } : {}),
    locale: body.locale,
    clientIp: ip,
  });

  if (!result.ok) {
    const e = result.error;
    if (e.kind === 'validation') {
      return NextResponse.json(
        { ok: false, error: 'validation', field: e.field, message: e.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (e.kind === 'rate_limited') {
      return NextResponse.json(
        { ok: false, error: 'rate_limited', retryAfterSec: e.retryAfterSec, scope: e.scope },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (e.kind === 'hotel_not_bookable_by_email') {
      return NextResponse.json(
        { ok: false, error: 'hotel_not_bookable_by_email', slug: body.hotelSlug },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (e.kind === 'duplicate') {
      return NextResponse.json(
        { ok: true, requestRef: e.requestRef, deduplicated: true, etaHours: 24 },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    // database / internal — return a generic 500 without leaking
    // any vendor detail (security-engineering §error mapping).
    return NextResponse.json(
      { ok: false, error: 'internal' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requestRef: result.value.requestRef,
      deduplicated: result.value.deduplicated,
      etaHours: 24,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
