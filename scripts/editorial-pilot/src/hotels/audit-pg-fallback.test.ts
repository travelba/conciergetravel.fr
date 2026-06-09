import { describe, expect, it } from 'vitest';

import { isDirectPgUnreachable } from './audit-pg-fallback.js';

describe('isDirectPgUnreachable', () => {
  it('detects ENOTFOUND / getaddrinfo errors', () => {
    expect(
      isDirectPgUnreachable(
        Object.assign(new Error('getaddrinfo ENOTFOUND db.ref.supabase.co'), { code: 'ENOTFOUND' }),
      ),
    ).toBe(true);
    expect(isDirectPgUnreachable({ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' })).toBe(
      true,
    );
    expect(isDirectPgUnreachable({ errno: -3008, message: 'getaddrinfo ENOTFOUND' })).toBe(true);
  });

  it('detects connection refused and timeout', () => {
    expect(isDirectPgUnreachable({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isDirectPgUnreachable({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('does not swallow auth or query errors', () => {
    expect(
      isDirectPgUnreachable({ code: '28P01', message: 'password authentication failed' }),
    ).toBe(false);
    expect(isDirectPgUnreachable(new Error('column "faq" does not exist'))).toBe(false);
  });
});
