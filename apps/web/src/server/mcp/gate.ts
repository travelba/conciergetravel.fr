import 'server-only';

import { gateAgentByIp, type AgentRateLimitVerdict } from '@/server/agent/rate-limit';

/**
 * MCP-side IP rate-limit gate (Lot 4, ADR-0029).
 *
 * Reuses the exact same Upstash sliding-window limiter as the
 * `/api/agent/*` HTTP routes (`gateAgentByIp`, 60 req/min/IP, fail-open
 * when Redis is unconfigured). The only difference is the IP source:
 * the MCP transport hands tool handlers an `IsomorphicHeaders` record
 * (via `extra.requestInfo.headers`) rather than a `Headers` instance.
 */

type HeaderRecord = Record<string, string | string[] | undefined>;

function readIpFromHeaders(headers: HeaderRecord | undefined): string {
  if (headers === undefined) return '0.0.0.0';
  const get = (key: string): string | undefined => {
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  const xff = get('x-forwarded-for');
  if (xff !== undefined && xff.length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  const xri = get('x-real-ip');
  if (xri !== undefined && xri.length > 0) return xri.trim();
  return '0.0.0.0';
}

export async function gateMcpTool(
  headers: HeaderRecord | undefined,
): Promise<AgentRateLimitVerdict> {
  return gateAgentByIp(readIpFromHeaders(headers));
}
