import type { Redis } from '@upstash/redis';

/** Narrow `@upstash/redis` surface reused by integrations and in-memory test doubles */
export type IntegrationRedis = Pick<Redis, 'get' | 'set' | 'del'>;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Distributed lock with simple spin-wait (Amadeus OAuth refresh, etc.).
 */
export async function runWithRedisLock(
  redis: IntegrationRedis,
  lockKey: string,
  lockTtlSec: number,
  fn: () => Promise<void>,
  options?: { readonly maxWaitMs?: number; readonly spinMs?: number },
): Promise<void> {
  const maxWaitMs = options?.maxWaitMs ?? 5_000;
  const spinMs = options?.spinMs ?? 120;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const acquired = await redis.set(lockKey, '1', { nx: true, ex: lockTtlSec });
    if (acquired !== null) {
      try {
        await fn();
      } finally {
        await redis.del(lockKey);
      }
      return;
    }
    await sleep(spinMs);
  }
  throw new Error(`redis lock timeout: ${lockKey}`);
}

export async function redisSetStringWithTtl(
  redis: IntegrationRedis,
  key: string,
  value: string,
  ttlSec: number,
): Promise<void> {
  await redis.set(key, value, { ex: ttlSec });
}

export async function redisGetString(redis: IntegrationRedis, key: string): Promise<string | null> {
  const v: unknown = await redis.get(key);
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  // `@upstash/redis` automatically JSON-deserializes values on GET, so a value
  // stored as a JSON string (e.g. an OAuth token envelope) comes back as an
  // object/number/boolean instead of a string. Re-serialize it so callers that
  // expect the original string (and then `JSON.parse` it) keep working. The
  // in-memory test double returns raw strings, which is why this path is only
  // exercised against a real Upstash client.
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}
