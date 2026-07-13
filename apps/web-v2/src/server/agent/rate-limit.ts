import 'server-only';

export interface AgentRateLimitVerdict {
  readonly ok: boolean;
  readonly retryAfterSec: number;
}

function isE2EBypass(): boolean {
  return process.env['MCH_DISABLE_RATE_LIMITS'] === '1';
}

function isRedisConfigured(): boolean {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  return typeof url === 'string' && url.length > 0 && typeof token === 'string' && token.length > 0;
}

/** Fail-open rate gate for v2 agent BFF (mirrors apps/web pattern). */
export async function gateAgentByIp(ip: string): Promise<AgentRateLimitVerdict> {
  void ip;
  if (isE2EBypass()) return { ok: true, retryAfterSec: 0 };
  if (!isRedisConfigured()) return { ok: true, retryAfterSec: 0 };

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'ratelimit:web-v2:agent:ip',
      analytics: true,
    });
    const result = await limiter.limit(ip);
    const retryMs = Math.max(0, result.reset - Date.now());
    return { ok: result.success, retryAfterSec: Math.ceil(retryMs / 1000) };
  } catch {
    return { ok: true, retryAfterSec: 0 };
  }
}

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
