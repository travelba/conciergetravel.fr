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

export async function gateAgentByIp(ip: string): Promise<AgentRateLimitVerdict> {
  if (isE2EBypass()) return { ok: true, retryAfterSec: 0 };
  const r = await agentByIpRateLimit.limit(ip);
  const retryMs = Math.max(0, r.reset - Date.now());
  return { ok: r.success, retryAfterSec: Math.ceil(retryMs / 1000) };
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
