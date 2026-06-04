import { describe, expect, it } from 'vitest';

import { redisGetString, redisSetStringWithTtl, type IntegrationRedis } from './cache-helpers';

/**
 * Double mimicking `@upstash/redis` automatic JSON deserialization: values set
 * as strings are stored verbatim, but `get` returns `JSON.parse(value)` when the
 * stored string is valid JSON (objects, numbers, booleans), and the raw string
 * otherwise. This is the behavior that broke `redisGetString` in production
 * while the previous in-memory double (which returned raw strings) hid it.
 */
function createUpstashLikeRedis(): IntegrationRedis & { dump(): Map<string, string> } {
  const store = new Map<string, string>();
  return {
    dump: () => store,
    get: async (key: string) => {
      const raw = store.get(key);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    },
    set: async (key: string, value: unknown) => {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return 'OK';
    },
    del: async (key: string) => (store.delete(key) ? 1 : 0),
  } as IntegrationRedis & { dump(): Map<string, string> };
}

describe('redisGetString with Upstash-style auto-deserialization', () => {
  it('round-trips a JSON object string (OAuth token envelope)', async () => {
    const redis = createUpstashLikeRedis();
    const envelope = JSON.stringify({ accessToken: 'tok-123', expiresAtMs: 1_780_000_000_000 });
    await redisSetStringWithTtl(redis, 'auth:token', envelope, 60);

    const got = await redisGetString(redis, 'auth:token');
    expect(got).not.toBeNull();
    expect(JSON.parse(got as string)).toEqual({
      accessToken: 'tok-123',
      expiresAtMs: 1_780_000_000_000,
    });
  });

  it('returns plain (non-JSON) strings unchanged', async () => {
    const redis = createUpstashLikeRedis();
    await redisSetStringWithTtl(redis, 'plain', 'hello world', 60);
    expect(await redisGetString(redis, 'plain')).toBe('hello world');
  });

  it('coerces numeric-looking values back to a string', async () => {
    const redis = createUpstashLikeRedis();
    await redisSetStringWithTtl(redis, 'num', '42', 60);
    expect(await redisGetString(redis, 'num')).toBe('42');
  });

  it('returns null for a missing key', async () => {
    const redis = createUpstashLikeRedis();
    expect(await redisGetString(redis, 'absent')).toBeNull();
  });
});
