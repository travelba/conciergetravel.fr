import { createMcpHandler } from 'mcp-handler';

import { registerMchResources } from '@/server/mcp/register-resources';
import { registerMchTools } from '@/server/mcp/register-tools';

/**
 * MCP server transport endpoint (Lot 4, ADR-0029).
 *
 * `mcp-handler` derives its endpoints from `basePath`, so with
 * `basePath: '/api'` and this `[transport]` catch-all the public
 * surface is:
 *   - `POST/GET /api/mcp`     → Streamable HTTP (modern transport)
 *   - `GET /api/sse` + `POST /api/message` → SSE fallback (when a
 *     compatible Redis connection URL is configured)
 *
 * Static `/api/*` routes (`/api/agent/*`, `/api/price-comparison`, …)
 * take precedence over this dynamic segment, so only the MCP transport
 * names resolve here. The tools delegate to the same shared
 * result-builders as the HTTP routes; pricing/booking are Phase 6
 * frozen (no live vendor calls). See `@/server/mcp/*`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// SSE resumability needs an ioredis-compatible connection URL. Upstash
// REST creds (`UPSTASH_REDIS_REST_URL`) are NOT compatible, so SSE is
// only enabled when a real `REDIS_URL` / `KV_URL` is present; otherwise
// we ship stateless Streamable HTTP (the spec-current transport).
const redisUrl = process.env['REDIS_URL'] ?? process.env['KV_URL'];
const hasRedis = typeof redisUrl === 'string' && redisUrl.length > 0;

const handler = createMcpHandler(
  (server) => {
    registerMchTools(server);
    registerMchResources(server);
  },
  { serverInfo: { name: 'myconciergehotel', version: '1.0.0' } },
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: false,
    ...(hasRedis ? { redisUrl } : { disableSse: true }),
  },
);

export { handler as GET, handler as POST, handler as DELETE };
