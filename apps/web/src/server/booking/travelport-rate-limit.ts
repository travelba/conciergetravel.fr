import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';

import { redis } from '@/lib/redis';

/** 30 req/min/IP — same envelope as `/api/price-comparison`. */
export const travelportSearchByIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'ratelimit:travelport-search:ip',
  analytics: true,
});

export interface RateLimitVerdict {
  readonly ok: boolean;
  readonly retryAfterSec: number;
}

const isE2EBypass = (): boolean => typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string';

export async function gateTravelportSearchByIp(ip: string): Promise<RateLimitVerdict> {
  if (isE2EBypass()) return { ok: true, retryAfterSec: 0 };
  const r = await travelportSearchByIpRateLimit.limit(ip);
  const retryMs = Math.max(0, r.reset - Date.now());
  return { ok: r.success, retryAfterSec: Math.ceil(retryMs / 1000) };
}
