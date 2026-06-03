import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildSearchResult } from '@/server/mcp/builders/hotels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/search — LLM-actionable hotel search (C2 / CDC §6.5).
 *
 * Thin transport shell: IP gate + body validation, then delegates the
 * shaping to the shared `buildSearchResult` builder (Lot 4, ADR-0029).
 * The HTTP route leaves the Amadeus best-offer path data-driven (it
 * only fires for `amadeus`/`little` hotels, of which there are none in
 * the editorial phase); the MCP tool calls the same builder with
 * `freezeOffers: true` to guarantee zero vendor calls.
 *
 * Skill: api-integration, geo-llm-optimization, search-engineering.
 */
const SearchBodySchema = z.object({
  destination: z.string().min(1).max(120),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  checkOut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  adults: z.number().int().min(1).max(6).optional(),
  children: z.number().int().min(0).max(4).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  limit: z.number().int().min(1).max(10).default(5),
});

export async function POST(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return agentJson(
      { ok: false, error: 'invalid_json' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const parsed = SearchBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return agentJson(
      {
        ok: false,
        error: 'validation',
        field: issue?.path.join('.') ?? 'input',
        message: issue?.message ?? 'invalid payload',
      },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const body = parsed.data;

  const result = await buildSearchResult({
    destination: body.destination,
    locale: body.locale,
    limit: body.limit,
    ...(body.checkIn !== undefined ? { checkIn: body.checkIn } : {}),
    ...(body.checkOut !== undefined ? { checkOut: body.checkOut } : {}),
    ...(body.adults !== undefined ? { adults: body.adults } : {}),
    ...(body.children !== undefined ? { children: body.children } : {}),
  });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
