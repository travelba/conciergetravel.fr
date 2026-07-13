import { NextResponse, type NextRequest } from 'next/server';

type AgentJsonOptions = {
  status?: number;
  cacheControl?: string;
};

/** Compact JSON helper for `/api/agent/*` routes (ADR-0017 shape). */
export function agentJson(body: unknown, options: AgentJsonOptions = {}): NextResponse {
  const { status = 200, cacheControl = 'private, max-age=300' } = options;
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/** Minimal IP gate — production wiring replaces this with Upstash (ADR-0017). */
export function gateAgentRequest(
  _req: NextRequest,
): { ok: true } | { ok: false; response: NextResponse } {
  return { ok: true };
}

export function readClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded !== null && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  const realIp = headers.get('x-real-ip');
  if (realIp !== null && realIp.length > 0) return realIp;
  return 'unknown';
}
