import { describe, expect, it } from 'vitest';

import { errorResponse, okResponse, rawResponse } from './builders/types';
import { rateLimitedResult, toMcpResult } from './to-mcp-result';

/**
 * `BuilderResponse → CallToolResult` mapping (Lot 4, ADR-0029).
 *
 * The mapping is the seam every tool funnels through, so its contract
 * is worth pinning:
 *  - both `content` (text) and `structuredContent` (object) mirror the
 *    same body;
 *  - `isError` follows `ok && status < 400`, NOT the freeze flag — a
 *    frozen capability is a successful call.
 */
describe('toMcpResult', () => {
  it('maps an ok 200 body to a non-error result with mirrored content', () => {
    const res = toMcpResult(okResponse({ items: [1, 2] }, 'no-store'));
    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({ ok: true, items: [1, 2] });
    const first = res.content[0];
    expect(first?.type).toBe('text');
    expect(JSON.parse((first as { text: string }).text)).toMatchObject({ ok: true });
  });

  it('flags a 4xx error body as isError', () => {
    const res = toMcpResult(errorResponse(404, { error: 'hotel_not_found' }));
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ ok: false, error: 'hotel_not_found' });
  });

  it('treats a frozen capability (ok:true, status 200) as a success', () => {
    const frozen = rawResponse(200, 'no-store', {
      ok: true,
      capability: 'booking',
      status: 'frozen',
    });
    const res = toMcpResult(frozen);
    expect(res.isError).toBe(false);
    expect(res.structuredContent).toMatchObject({ status: 'frozen' });
  });

  it('treats a raw 2xx body without an ok flag as an error (defensive)', () => {
    const res = toMcpResult(rawResponse(200, 'no-store', { hint: 'refine' }));
    // No `ok: true` discriminant → mapped to isError so clients never
    // silently consume an unshaped body as a success.
    expect(res.isError).toBe(true);
  });
});

describe('rateLimitedResult', () => {
  it('produces an error result carrying the retry hint', () => {
    const res = rateLimitedResult(42);
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ error: 'rate_limited', retryAfterSec: 42 });
  });
});
