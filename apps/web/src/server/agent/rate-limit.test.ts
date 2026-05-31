import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gateAgentByIp } from './rate-limit';

/**
 * Regression guard — the rate-limit gate must **never** 500 the
 * `/api/agent/*` surface when its backing store (Upstash Redis) is
 * mis-provisioned. Before the fix, any preview / production
 * deployment without `UPSTASH_REDIS_REST_URL` returned 500 on every
 * single agent endpoint, silently taking down the entire LLM-
 * actionable surface (`get-hotel`, `get-concierge-tip`,
 * `get-hotel-sources`, …).
 *
 * The contract is documented inline in `rate-limit.ts` and captured
 * here so a future refactor can't accidentally re-introduce the
 * hard-fail behaviour.
 */
describe('gateAgentByIp — fail-soft contract', () => {
  const ORIGINAL_URL = process.env['UPSTASH_REDIS_REST_URL'];
  const ORIGINAL_TOKEN = process.env['UPSTASH_REDIS_REST_TOKEN'];
  const ORIGINAL_DISABLE = process.env['MCH_DISABLE_RATE_LIMITS'];
  const ORIGINAL_FAKE_ID = process.env['MCH_E2E_FAKE_HOTEL_ID'];

  beforeEach(() => {
    delete process.env['UPSTASH_REDIS_REST_URL'];
    delete process.env['UPSTASH_REDIS_REST_TOKEN'];
    delete process.env['MCH_DISABLE_RATE_LIMITS'];
    delete process.env['MCH_E2E_FAKE_HOTEL_ID'];
  });

  afterEach(() => {
    // Restore the original env so other tests that import the module
    // see the same state as before this file ran.
    if (ORIGINAL_URL !== undefined) process.env['UPSTASH_REDIS_REST_URL'] = ORIGINAL_URL;
    if (ORIGINAL_TOKEN !== undefined) process.env['UPSTASH_REDIS_REST_TOKEN'] = ORIGINAL_TOKEN;
    if (ORIGINAL_DISABLE !== undefined) process.env['MCH_DISABLE_RATE_LIMITS'] = ORIGINAL_DISABLE;
    if (ORIGINAL_FAKE_ID !== undefined) process.env['MCH_E2E_FAKE_HOTEL_ID'] = ORIGINAL_FAKE_ID;
  });

  it('lets the request through when Upstash env vars are missing', async () => {
    const verdict = await gateAgentByIp('127.0.0.1');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });

  it('lets the request through when only the URL is set (token missing)', async () => {
    process.env['UPSTASH_REDIS_REST_URL'] = 'https://example.upstash.io';
    const verdict = await gateAgentByIp('127.0.0.1');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });

  it('respects the MCH_DISABLE_RATE_LIMITS bypass before checking Redis config', async () => {
    process.env['MCH_DISABLE_RATE_LIMITS'] = '1';
    const verdict = await gateAgentByIp('127.0.0.1');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });

  it('respects the MCH_E2E_FAKE_HOTEL_ID bypass before checking Redis config', async () => {
    process.env['MCH_E2E_FAKE_HOTEL_ID'] = 'fake';
    const verdict = await gateAgentByIp('127.0.0.1');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });
});
