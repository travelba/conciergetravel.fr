import { NextResponse, type NextRequest } from 'next/server';

import { queryTravelportSearch } from '@/server/booking/travelport-offer';
import { gateTravelportSearchByIp } from '@/server/booking/travelport-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff !== null) {
    const first = xff.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

/**
 * Non-blocking Travelport search for fiche overlays and booking rail.
 * Results are Redis-cached server-side (TTL 8 min); CDN may cache 60 s.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  const verdict = await gateTravelportSearchByIp(ip);
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      {
        status: 429,
        headers: { ...NO_STORE, 'Retry-After': String(verdict.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? '';
  if (slug.length === 0) {
    return NextResponse.json(
      { ok: true, available: false, reason: 'invalid_input' },
      { headers: NO_STORE },
    );
  }

  const matchRooms = url.searchParams.get('matchRooms') === '1';

  const outcome = await queryTravelportSearch({
    slug,
    checkIn: url.searchParams.get('checkIn') ?? undefined,
    checkOut: url.searchParams.get('checkOut') ?? undefined,
    adults: url.searchParams.get('adults') ?? undefined,
    children: url.searchParams.get('children') ?? undefined,
    matchEditorialRooms: matchRooms,
  });

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.reason }, { headers: NO_STORE });
  }

  if (!outcome.available) {
    return NextResponse.json(
      { ok: true, available: false, reason: outcome.reason },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      available: true,
      cached: outcome.cached,
      stay: outcome.stay,
      cheapestMinor: outcome.cheapestMinor,
      fromByRoomId: outcome.fromByRoomId,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    },
  );
}
