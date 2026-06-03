import 'server-only';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

import { createInMemoryRedis } from './redis-memory';

let cached: Redis | undefined;

/**
 * E2E seam — when `MCH_E2E_FAKE_HOTEL_ID` is set (Playwright webserver
 * + CI smoke) we substitute a process-local in-memory store for
 * Upstash. Same shape (`get`, `set`, `del`, `incr`, `expire` with
 * `ex` / `nx`) so all callers keep working unchanged. Never enabled in
 * real deployments — the env var is opt-in and absent in prod.
 *
 * Falling back to Upstash construction with `undefined` env vars used
 * to merely log warnings and then explode on first call; routing the
 * E2E path through an in-process Map gives us deterministic state for
 * the booking-paid spec without any infra to spin up.
 */
function isE2ESeamEnabled(): boolean {
  return typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string';
}

/**
 * In dev/E2E the in-memory seam MUST be a single process-wide instance,
 * otherwise its `Map` is duplicated across the separate module graphs
 * Turbopack builds per route segment (route handler vs page render) and a
 * value written in one segment is invisible in the next — e.g. a booking
 * draft created by a route handler then read by the recap page. Pinning it
 * to `globalThis` guarantees one shared store for the whole Node process.
 * Production is untouched: it always constructs a real Upstash client.
 */
const SEAM_GLOBAL_KEY = '__mchInMemoryRedis';
type SeamGlobal = typeof globalThis & { [SEAM_GLOBAL_KEY]?: Redis };

function getInMemorySeam(): Redis {
  const g = globalThis as SeamGlobal;
  g[SEAM_GLOBAL_KEY] ??= createInMemoryRedis();
  return g[SEAM_GLOBAL_KEY];
}

export const redis = (() => {
  if (cached) return cached;
  if (isE2ESeamEnabled()) {
    cached = getInMemorySeam();
    return cached;
  }
  cached = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return cached;
})();
