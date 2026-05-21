import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getHotelBySlug, readConciergeAdvice } from '@/server/hotels/get-hotel-by-slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/concierge-tip/[slug] — Conseil du Concierge for an
 * agent, returned as a flat JSON envelope ready to be quoted verbatim.
 *
 * Why a dedicated endpoint vs. inlining in `/api/agent/hotel/[slug]`:
 *
 * - `agent-skills.json` already declares a `get-concierge-tip` skill
 *   (ADR-0011 — the proprietary editorial signature) but it was
 *   missing an `endpoint` field, leaving LLM agents with no callable
 *   surface for the most valuable piece of content on the site. This
 *   route closes the loop (declarative skill ↔ executable surface).
 *
 * - The payload is intentionally tiny (≤ 200 bytes) so tools with
 *   strict per-call budgets (Claude Tools, OpenAI tool-call output
 *   limits) can keep it in a multi-turn loop alongside the full
 *   `/api/agent/hotel/[slug]` payload.
 *
 * Response shape:
 *
 *   { ok: true,
 *     tip: { title, body, tipFor },
 *     canonicalUrl: '/fr/hotel/<slug>#conseil-concierge',
 *     updatedAt }
 *
 * Skill: api-integration, geo-llm-optimization, structured-data-schema-org.
 * ADR: 0011 (Conseil du Concierge), 0017 (agent endpoints).
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { locale } = parsedQuery.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'invalid_slug' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const hotel = await getHotelBySlug(slug, locale).catch(() => null);
  if (hotel === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', slug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const row = hotel.row;
  const tip = readConciergeAdvice(row, locale);
  if (tip === null) {
    // Soft-404 with a discoverable shape: the hotel exists but has no
    // Conseil du Concierge yet. We surface `no_tip_yet` rather than 404
    // so the agent knows the slug is valid (it can still fetch the
    // hotel) and can degrade gracefully (e.g. follow `canonicalUrl`).
    return NextResponse.json(
      {
        ok: false,
        error: 'no_tip_yet',
        slug,
        canonicalUrl:
          locale === 'en' ? `/en/hotel/${row.slug_en ?? row.slug}` : `/fr/hotel/${row.slug}`,
      },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const canonicalSlug =
    locale === 'en' && row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : row.slug;

  return NextResponse.json(
    {
      ok: true,
      slug,
      hotelName:
        locale === 'en' && row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name,
      tip: {
        title: tip.title,
        body: tip.body,
        tipFor: tip.tipFor,
      },
      canonicalUrl:
        locale === 'en'
          ? `/en/hotel/${canonicalSlug}#conseil-concierge`
          : `/fr/hotel/${canonicalSlug}#conseil-concierge`,
      updatedAt: row.updated_at,
    },
    {
      headers: {
        // The Conseil du Concierge changes rarely once published — a
        // 30-minute private cache short-circuits multi-turn agent loops
        // without serving stale advice for too long.
        'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600',
      },
    },
  );
}
