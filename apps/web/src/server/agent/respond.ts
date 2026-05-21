import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';

/**
 * Shared boilerplate for `/api/agent/*` endpoints.
 *
 * Every endpoint repeats the same prologue: read IP → gate via
 * `gateAgentByIp` → 429 on bust → run the handler. Factoring it here
 * keeps individual route files tiny and guarantees the rate-limit
 * contract is uniform (ADR-0017 §Architecture, skill `api-integration`).
 *
 * The helper is intentionally NOT a middleware — middleware runs before
 * the App Router and would lose the per-route cache headers we want
 * (each endpoint sets its own `Cache-Control` based on freshness
 * needs, see ADR-0017 §Responses).
 */
export interface AgentResponseInit {
  /**
   * `Cache-Control` directive. Defaults to `private, max-age=300,
   * stale-while-revalidate=600` — the same 5-min envelope used by
   * `/api/agent/hotel/[slug]`. Override with `no-store` for mutating
   * endpoints or when the payload includes user-specific data.
   */
  readonly cacheControl?: string;
  /**
   * Optional extra response headers (e.g. CORS for an external agent
   * platform). Merged after `Cache-Control` so callers can override.
   */
  readonly headers?: Record<string, string>;
  /** HTTP status — defaults to 200. */
  readonly status?: number;
}

const DEFAULT_CACHE = 'private, max-age=300, stale-while-revalidate=600';

export function agentJson(body: unknown, init: AgentResponseInit = {}): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: {
      'Cache-Control': init.cacheControl ?? DEFAULT_CACHE,
      ...init.headers,
    },
  });
}

export interface AgentGateOk {
  readonly ok: true;
  readonly ip: string;
}
export interface AgentGateRefused {
  readonly ok: false;
  readonly response: NextResponse;
}
export type AgentGateResult = AgentGateOk | AgentGateRefused;

/**
 * Gate a request through the IP rate-limit. Returns either `{ ok: true,
 * ip }` for the handler to continue, or `{ ok: false, response }` for
 * the handler to return directly. The response carries the
 * `Retry-After`-style `retryAfterSec` in JSON (ADR-0017 §Responses).
 */
export async function gateAgentRequest(req: NextRequest): Promise<AgentGateResult> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      ),
    };
  }
  return { ok: true, ip };
}
