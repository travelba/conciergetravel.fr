/**
 * POST /api/agent/compare-prices — Makcorps comparator stub (Phase 9 / Q42).
 *
 * v2 agent endpoint mirroring `apps/web` `/api/agent/compare-prices` with the
 * shared Redis cache key pattern (`price-cmp:<hotelId>:<checkin>:<checkout>:<adults>`).
 * Full Makcorps/Apify wiring lands in Phase 9 production — this route documents
 * the contract and cache layer only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getRedis, redisGetString, redisSetStringWithTtl } from '@mch/integrations/redis';

import { agentJson, gateAgentRequest, readClientIp } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_PREFIX = 'price-cmp';
const CACHE_TTL_SEC = 15 * 60;

const BodySchema = z.object({
  hotelSlug: z.string().min(1).max(120),
  hotelId: z.string().uuid().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  adults: z.number().int().min(1).max(6).default(2),
  locale: z.enum(['fr', 'en']).default('fr'),
});

type ComparePricesCachePayload = {
  readonly stub: true;
  readonly hotelSlug: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly cachedAt: string;
};

export function buildComparePricesCacheKey(input: {
  readonly hotelId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
}): string {
  return `${CACHE_PREFIX}:${input.hotelId}:${input.checkIn}:${input.checkOut}:${input.adults}`;
}

async function readComparePricesCache(key: string): Promise<ComparePricesCachePayload | null> {
  try {
    const raw = await redisGetString(getRedis(), key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'stub' in parsed && parsed.stub === true) {
      return parsed as ComparePricesCachePayload;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeComparePricesCache(
  key: string,
  payload: ComparePricesCachePayload,
): Promise<void> {
  await redisSetStringWithTtl(getRedis(), key, JSON.stringify(payload), CACHE_TTL_SEC);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const ip = readClientIp(req.headers);
  void ip;

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
    const issue = parsed.error.issues[0];
    return agentJson(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const { hotelSlug, checkIn, checkOut, adults, locale } = parsed.data;
  void locale;

  const hotelId = parsed.data.hotelId ?? `stub-${hotelSlug}`;
  const cacheKey = buildComparePricesCacheKey({ hotelId, checkIn, checkOut, adults });
  const cached = await readComparePricesCache(cacheKey);

  if (cached !== null) {
    return agentJson(
      {
        ok: true,
        available: false,
        reason: 'phase_9_stub',
        cacheKey,
        cached: true,
        disclaimer:
          'Prix observés à titre indicatif, susceptibles de varier — comparateur Phase 9 (stub).',
      },
      { cacheControl: 'public, s-maxage=60' },
    );
  }

  const payload: ComparePricesCachePayload = {
    stub: true,
    hotelSlug,
    checkIn,
    checkOut,
    adults,
    cachedAt: new Date().toISOString(),
  };
  await writeComparePricesCache(cacheKey, payload);

  return agentJson(
    {
      ok: true,
      available: false,
      reason: 'phase_9_stub',
      cacheKey,
      cached: false,
      competitors: {},
      benefitsValueMinor: null,
      priceConciergeMinor: null,
      stay: { checkIn, checkOut, adults },
      disclaimer:
        'Prix observés à titre indicatif, susceptibles de varier — comparateur Phase 9 (stub).',
    },
    { cacheControl: 'public, s-maxage=60' },
  );
}
