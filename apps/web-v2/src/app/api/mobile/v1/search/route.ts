import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { listHotelsV2, toMobileSearchJson } from '@/server/hotels/list-hotels-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  locale: z.enum(['fr', 'en']).default('fr'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const SearchBodySchema = z.object({
  destination: z.string().min(1).max(120),
  locale: z.enum(['fr', 'en']).default('fr'),
  limit: z.number().int().min(1).max(50).default(20),
});

/** Mobile BFF — hotel search for Expo app (`apps/mobile`). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsed = SearchQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await listHotelsV2({
    locale: parsed.data.locale,
    query: parsed.data.q,
    limit: parsed.data.limit,
  });

  return NextResponse.json(toMobileSearchJson(result, parsed.data.q), {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  });
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

  const parsed = SearchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = parsed.data;
  const result = await listHotelsV2({
    locale: body.locale,
    query: body.destination,
    limit: body.limit,
  });

  return NextResponse.json(toMobileSearchJson(result, body.destination), {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  });
}
