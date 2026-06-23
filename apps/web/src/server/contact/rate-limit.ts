import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';

import { redis } from '@/lib/redis';

/**
 * Sliding-window rate limiters for the general concierge contact funnel
 * (skill: redis-caching §rate-limiting + security-engineering). Mirrors the
 * booking-email limiter but with its own prefixes so the budgets are
 * independent.
 *
 * - `byIp`    : 5 messages / hour / source IP.
 * - `byEmail` : 3 messages / 24h / sender email.
 */
export const contactByIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'ratelimit:contact:ip',
  analytics: true,
});

export const contactByEmailRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '24 h'),
  prefix: 'ratelimit:contact:email',
  analytics: true,
});

export interface RateLimitVerdict {
  readonly ok: boolean;
  readonly retryAfterSec: number;
}

const verdictFromLimit = (limited: { success: boolean; reset: number }): RateLimitVerdict => {
  const retryMs = Math.max(0, limited.reset - Date.now());
  return { ok: limited.success, retryAfterSec: Math.ceil(retryMs / 1000) };
};

/**
 * E2E seam — Upstash Ratelimit runs Lua (`evalsha`) which the in-memory test
 * Redis does not implement. Short-circuit to "always allow" when the harness
 * is active (mirrors `server/booking/rate-limit.ts`).
 */
const isE2EBypass = (): boolean =>
  process.env['MCH_DISABLE_RATE_LIMITS'] === '1' ||
  typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string';

const E2E_ALLOW: RateLimitVerdict = { ok: true, retryAfterSec: 0 };

export async function gateContactByIp(ip: string): Promise<RateLimitVerdict> {
  if (isE2EBypass()) return E2E_ALLOW;
  const r = await contactByIpRateLimit.limit(ip);
  return verdictFromLimit(r);
}

export async function gateContactByEmail(email: string): Promise<RateLimitVerdict> {
  if (isE2EBypass()) return E2E_ALLOW;
  const r = await contactByEmailRateLimit.limit(email.trim().toLowerCase());
  return verdictFromLimit(r);
}
