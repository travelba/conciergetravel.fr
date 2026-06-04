import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { buildCountryGuideResult } from '@/server/mcp/builders/editorial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/country-guide/[slug] — country guide envelope for an
 * agent. Thin shell over the shared `buildCountryGuideResult` builder
 * (Lot 4, ADR-0029). Mirror of the `get-country-guide` skill.
 *
 * The supported-slug table + i18n payload loading live in the builder
 * (`@/server/mcp/builders/editorial`) so the MCP tool and HTTP route
 * stay in lock-step.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ locale: url.searchParams.get('locale') ?? undefined });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const { slug } = await params;
  const safeSlug = typeof slug === 'string' ? slug : '';

  const result = await buildCountryGuideResult({ slug: safeSlug, locale });
  return agentJson(result.body, { status: result.status, cacheControl: result.cacheControl });
}
