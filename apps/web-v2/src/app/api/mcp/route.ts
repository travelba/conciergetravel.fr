import { NextResponse, type NextRequest } from 'next/server';

import { MCP_TOOLS, callMcpTool } from '@/lib/mcp/tools';
import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Streamable HTTP MCP server (v2 public OTA surface).
 *
 * `@modelcontextprotocol/sdk` is **not** a dependency of `@mch/web-v2` (it lives
 * in `scripts/design-import` only). This route implements a minimal
 * JSON-RPC 2.0 handler compatible with MCP clients:
 *
 *   - `initialize` → protocol handshake
 *   - `tools/list` → {@link MCP_TOOLS}
 *   - `tools/call` → delegates to the same server functions as `/api/agent/*`
 *
 * Transport: POST JSON body (single message or batch). GET returns capability
 * metadata for health checks and MCP Inspector discovery.
 *
 * Skill: mcp-server-development · ADR-0017 · CDC v2 §6.5.
 */
const MCP_SERVER_INFO = {
  name: 'myconciergehotel-v2',
  version: '0.1.0',
  protocolVersion: '2024-11-05',
};

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

function jsonRpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function handleMethod(
  method: string,
  params: unknown,
): Promise<
  { ok: true; result: unknown } | { ok: false; code: number; message: string; data?: unknown }
> {
  switch (method) {
    case 'initialize':
      return Promise.resolve({
        ok: true,
        result: {
          protocolVersion: MCP_SERVER_INFO.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
        },
      });
    case 'notifications/initialized':
      return Promise.resolve({ ok: true, result: {} });
    case 'ping':
      return Promise.resolve({ ok: true, result: {} });
    case 'tools/list':
      return Promise.resolve({ ok: true, result: { tools: MCP_TOOLS } });
    case 'tools/call': {
      if (typeof params !== 'object' || params === null) {
        return Promise.resolve({
          ok: false,
          code: -32602,
          message: 'Invalid params for tools/call',
        });
      }
      const record = params as Record<string, unknown>;
      const name = record['name'];
      const args = record['arguments'];
      if (typeof name !== 'string') {
        return Promise.resolve({
          ok: false,
          code: -32602,
          message: 'tools/call requires string "name"',
        });
      }
      return callMcpTool(name, args ?? {}).then((toolResult) => {
        if (!toolResult.ok) {
          return {
            ok: false as const,
            code: -32000,
            message: toolResult.error.message,
            data: toolResult.error,
          };
        }
        return { ok: true as const, result: { content: toolResult.content, isError: false } };
      });
    }
    default:
      return Promise.resolve({ ok: false, code: -32601, message: `Method not found: ${method}` });
  }
}

async function dispatchMessage(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  if (message.method === 'notifications/initialized') {
    return null;
  }

  const id = message.id ?? null;
  if (id === null && message.method.startsWith('notifications/')) {
    return null;
  }

  const handled = await handleMethod(message.method, message.params);
  if (!handled.ok) {
    return jsonRpcError(id, handled.code, handled.message, handled.data);
  }
  return jsonRpcResult(id, handled.result);
}

/** GET — capability probe for MCP Inspector / health checks. */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      transport: 'streamable-http-jsonrpc',
      server: MCP_SERVER_INFO,
      tools: MCP_TOOLS.map((t) => t.name),
      agentEndpoints: [
        'POST /api/agent/search',
        'GET /api/agent/hotel/{slug}',
        'GET /api/agent/ranking/{slug}',
        'POST /api/agent/quote',
      ],
      note: 'POST JSON-RPC 2.0 messages to this URL. Uses a lightweight handler — @modelcontextprotocol/sdk is not bundled in web-v2.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}

/** POST — JSON-RPC 2.0 batch or single message. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      jsonRpcError(null, -32000, 'rate_limited', { retryAfterSec: gate.retryAfterSec }),
      {
        status: 429,
      },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const messages: JsonRpcRequest[] = Array.isArray(raw) ? raw : [raw as JsonRpcRequest];
  const responses: JsonRpcResponse[] = [];

  for (const message of messages) {
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      responses.push(jsonRpcError(message.id ?? null, -32600, 'Invalid Request'));
      continue;
    }
    const response = await dispatchMessage(message);
    if (response !== null) responses.push(response);
  }

  if (responses.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const body = responses.length === 1 && !Array.isArray(raw) ? responses[0] : responses;
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
