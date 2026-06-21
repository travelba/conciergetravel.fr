import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { contactIdempotencyRedisKey } from './idempotency';
import { gateContactByEmail, gateContactByIp } from './rate-limit';

describe('contactIdempotencyRedisKey', () => {
  it('namespaces the hash under the contact idempotency prefix', () => {
    expect(contactIdempotencyRedisKey('deadbeef')).toBe('idempotency:contact:deadbeef');
  });

  it('is a pure function of the hash', () => {
    expect(contactIdempotencyRedisKey('abc')).toBe(contactIdempotencyRedisKey('abc'));
    expect(contactIdempotencyRedisKey('abc')).not.toBe(contactIdempotencyRedisKey('def'));
  });
});

describe('contact rate-limit — E2E / ops bypass', () => {
  const ORIGINAL_DISABLE = process.env['MCH_DISABLE_RATE_LIMITS'];
  const ORIGINAL_FAKE_ID = process.env['MCH_E2E_FAKE_HOTEL_ID'];

  beforeEach(() => {
    delete process.env['MCH_DISABLE_RATE_LIMITS'];
    delete process.env['MCH_E2E_FAKE_HOTEL_ID'];
  });

  afterEach(() => {
    if (ORIGINAL_DISABLE !== undefined) process.env['MCH_DISABLE_RATE_LIMITS'] = ORIGINAL_DISABLE;
    else delete process.env['MCH_DISABLE_RATE_LIMITS'];
    if (ORIGINAL_FAKE_ID !== undefined) process.env['MCH_E2E_FAKE_HOTEL_ID'] = ORIGINAL_FAKE_ID;
    else delete process.env['MCH_E2E_FAKE_HOTEL_ID'];
  });

  it('allows by IP when MCH_DISABLE_RATE_LIMITS=1 (no Redis round-trip)', async () => {
    process.env['MCH_DISABLE_RATE_LIMITS'] = '1';
    const verdict = await gateContactByIp('203.0.113.7');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });

  it('allows by email when the E2E harness flag is set', async () => {
    process.env['MCH_E2E_FAKE_HOTEL_ID'] = 'fake-hotel';
    const verdict = await gateContactByEmail('alice@example.com');
    expect(verdict.ok).toBe(true);
    expect(verdict.retryAfterSec).toBe(0);
  });
});
