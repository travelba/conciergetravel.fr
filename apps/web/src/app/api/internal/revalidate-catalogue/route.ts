import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';

import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Drops the one-hour catalogue caches after a hotel, room, place or ranking
 * edit. Same bearer as the other crons. Nothing is read from Supabase here.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidateTag('hotels-catalogue', { expire: 0 });
  revalidateTag('hotel-rooms', { expire: 0 });
  revalidateTag('places-catalogue', { expire: 0 });
  revalidateTag('rankings-catalogue', { expire: 0 });
  return NextResponse.json({ ok: true });
}
