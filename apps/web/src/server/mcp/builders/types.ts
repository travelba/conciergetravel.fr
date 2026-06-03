import 'server-only';

/**
 * Shared result-builder contract (Lot 4 — MCP server, ADR-0029).
 *
 * The JSON "shaping" of every `/api/agent/*` surface used to live
 * inside its `route.ts`. To expose the same surfaces through the MCP
 * server WITHOUT duplicating that shaping, each surface now has a pure
 * builder that returns a `BuilderResponse`. Both the HTTP route handler
 * and the MCP tool call the same builder — one source of truth, parity
 * guaranteed by construction (see `builders/*.ts` + `register-tools.ts`).
 *
 * A builder owns the *data* concerns (fetch + shape + data-level errors
 * like 404 / soft-404). The HTTP route still owns transport concerns
 * (IP rate-limit gate, input parsing into typed params). The MCP tool
 * owns its own input validation (Zod shape advertised to clients) and
 * maps the `BuilderResponse` to a `CallToolResult`.
 */
export interface BuilderResponse {
  /** HTTP status the route should emit (the MCP layer derives isError from it). */
  readonly status: number;
  /** `Cache-Control` directive the route should set. */
  readonly cacheControl: string;
  /** Full JSON body, including the `ok` discriminant. */
  readonly body: Record<string, unknown>;
}

export const NO_STORE = 'no-store';

/** Build a 200 response with a custom cache directive. */
export function okResponse(body: Record<string, unknown>, cacheControl: string): BuilderResponse {
  return { status: 200, cacheControl, body: { ok: true, ...body } };
}

/** Build a non-200 response (always `no-store`). */
export function errorResponse(status: number, body: Record<string, unknown>): BuilderResponse {
  return { status, cacheControl: NO_STORE, body: { ok: false, ...body } };
}

/** Build a 2xx response that carries `ok: false`-free custom discriminants (funnel shells). */
export function rawResponse(
  status: number,
  cacheControl: string,
  body: Record<string, unknown>,
): BuilderResponse {
  return { status, cacheControl, body };
}

export type AgentLocale = 'fr' | 'en';
