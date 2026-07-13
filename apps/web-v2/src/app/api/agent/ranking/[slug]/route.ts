import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getRankingV2, toRankingAgentJson } from '@/server/rankings/get-ranking-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_slug' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await getRankingV2({ slug, locale: parsedQuery.data.locale });
  if (result === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', slug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(toRankingAgentJson(result, parsedQuery.data.locale), {
    headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600' },
  });
}
