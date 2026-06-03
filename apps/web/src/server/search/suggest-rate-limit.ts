import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';

import { redis } from '@/lib/redis';

/**
 * Per-IP sliding-window rate limiter for the public `/api/search/suggest`
 * autocomplete endpoint (skill: search-engineering, security-engineering
 * §Rate limiting).
 *
 * 60 requests / minute / IP — comfortable for a debounced (200 ms)
 * keystroke stream from the hero / header / mobile search bars while
 * still capping a scripted scrape of the catalogue.
 *
 * Mirrors the fail-open + E2E-bypass contract of the `/api/agent/*`
 * limiter (`apps/web/src/server/agent/rate-limit.ts`): tests bypass via
 * `MCH_DISABLE_RATE_LIMITS=1`, and a mis-provisioned Redis degrades open
 * rather than 500-ing every keystroke.
 */
export const searchSuggestByIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'ratelimit:search-suggest:ip',
  analytics: true,
});

export interface SuggestRateLimitVerdict {
  readonly ok: boolean;
  readonly retryAfterSec: number;
}

function isE2EBypass(): boolean {
  return (
    process.env['MCH_DISABLE_RATE_LIMITS'] === '1' ||
    typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string'
  );
}

function isRedisConfigured(): boolean {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  return typeof url === 'string' && url.length > 0 && typeof token === 'string' && token.length > 0;
}

export async function gateSuggestByIp(ip: string): Promise<SuggestRateLimitVerdict> {
  if (isE2EBypass()) return { ok: true, retryAfterSec: 0 };
  // Degrade open when the backing store isn't provisioned (preview / dev
  // with SKIP_ENV_VALIDATION). A search box that 500s on every keystroke
  // is worse than a temporarily un-throttled suggest endpoint.
  if (!isRedisConfigured()) return { ok: true, retryAfterSec: 0 };
  try {
    const r = await searchSuggestByIpRateLimit.limit(ip);
    const retryMs = Math.max(0, r.reset - Date.now());
    return { ok: r.success, retryAfterSec: Math.ceil(retryMs / 1000) };
  } catch {
    return { ok: true, retryAfterSec: 0 };
  }
}
