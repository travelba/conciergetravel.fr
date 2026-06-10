import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { prewarmTravelportPilotCaches } from '@/server/booking/travelport-offer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Vercel Cron — pre-warms Travelport search cache for pilot hotels (default stay).
 * Schedule: every 7 minutes (`vercel.json`).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const results = await prewarmTravelportPilotCaches();
  const warmed = results.filter((r) => r.ok).length;

  return NextResponse.json({
    ok: true,
    warmed,
    total: results.length,
    results,
  });
}
