import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { BuilderResponse } from './builders/types';

/**
 * Maps a shared `BuilderResponse` to an MCP `CallToolResult` (Lot 4,
 * ADR-0029).
 *
 * - `content`: the JSON body as text, so clients without structured
 *   output support can still quote the payload verbatim.
 * - `structuredContent`: the same body as a typed object for clients
 *   that consume structured tool output.
 * - `isError`: true only for genuine failures (`ok: false` / 4xx-5xx).
 *   A `frozen` capability is NOT an error — the call succeeded, the
 *   capability is simply deferred to Phase 6.
 */
export function toMcpResult(response: BuilderResponse): CallToolResult {
  const okFlag = response.body['ok'] === true && response.status < 400;
  return {
    content: [{ type: 'text', text: JSON.stringify(response.body) }],
    structuredContent: response.body,
    isError: !okFlag,
  };
}

/** Rate-limit refusal mapped to a tool error result. */
export function rateLimitedResult(retryAfterSec: number): CallToolResult {
  const body = { ok: false, error: 'rate_limited', retryAfterSec };
  return {
    content: [{ type: 'text', text: JSON.stringify(body) }],
    structuredContent: body,
    isError: true,
  };
}
