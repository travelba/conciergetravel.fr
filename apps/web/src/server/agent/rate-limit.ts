import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';

import { redis } from '@/lib/redis';

/**
 * Per-IP sliding-window rate limiter for the public `/api/agent/*`
 * endpoints (C2 / ADR-0013-agent-actionable-endpoints).
 *
 * 60 requests / minute / IP — generous enough for an LLM agent
 * orchestrating a multi-turn conversation (search → narrow → get
 * hotel → request quote) without breaking on a single retry storm,
 * but strict enough to keep the Amadeus / Supabase fan-out under
 * control.
 *
 * Tests bypass via `MCH_DISABLE_RATE_LIMITS=1` (see security-csp.mdc
 * §Rate limiting).
 *
 * Skill: api-integration §rate-limit, security-engineering.
 */
export const agentByIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'ratelimit:agent:ip',
  analytics: true,
});

export interface AgentRateLimitVerdict {
  readonly ok: boolean;
  readonly retryAfterSec: number;
}

function isE2EBypass(): boolean {
  return (
    process.env['MCH_DISABLE_RATE_LIMITS'] === '1' ||
    typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string'
  );
}

/**
 * Detect at call-time whether the Upstash Redis backing the rate
 * limiter is configured. When `SKIP_ENV_VALIDATION=true` is used at
 * build time (Vercel preview, local dev) the `UPSTASH_REDIS_REST_URL`
 * may be undefined at runtime — the Upstash client only logs a warning
 * and explodes on the first `.limit()` call, surfacing as a 500 on
 * every `/api/agent/*` endpoint.
 *
 * Reading `process.env` directly (not via the validated `env` module)
 * avoids re-throwing the same validation error inside the gate. If
 * either var is missing the gate fails open — agents can still call
 * the endpoint, the surface degrades gracefully, and a separate
 * runbook step (env-vars sync) restores rate limiting.
 */
function isRedisConfigured(): boolean {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  return typeof url === 'string' && url.length > 0 && typeof token === 'string' && token.length > 0;
}

export async function gateAgentByIp(ip: string): Promise<AgentRateLimitVerdict> {
  if (isE2EBypass()) return { ok: true, retryAfterSec: 0 };
  // Fail-open when the backing store isn't configured. This is a
  // graceful-degradation choice (skill: nextjs-app-router §Data
  // fetching — public surfaces must not 500 when a dependency is
  // mis-provisioned). The trade-off (no rate-limit when Redis is
  // down) is logged via the Upstash client warning that already
  // surfaces in the Vercel runtime logs.
  if (!isRedisConfigured()) return { ok: true, retryAfterSec: 0 };
  try {
    const r = await agentByIpRateLimit.limit(ip);
    const retryMs = Math.max(0, r.reset - Date.now());
    return { ok: r.success, retryAfterSec: Math.ceil(retryMs / 1000) };
  } catch {
    // Upstash unreachable / 5xx / network blip — degrade open. The
    // alternative (return 500) would take down the entire agentic
    // surface on a third-party hiccup. Better to lose rate limiting
    // for one window than to 500 every LLM tool call.
    return { ok: true, retryAfterSec: 0 };
  }
}

/**
 * Best-effort client IP from `x-forwarded-for` / `x-real-ip`.
 * Returns `0.0.0.0` when no header is present so the rate-limiter
 * has a stable key even for dev / curl requests.
 */
export function readClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff !== null && xff.length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  const xri = headers.get('x-real-ip');
  if (xri !== null && xri.length > 0) return xri.trim();
  return '0.0.0.0';
}
