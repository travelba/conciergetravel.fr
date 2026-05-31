import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getHotelExternalSourcesBySlug } from '@/server/hotels/get-hotel-external-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/hotel-sources/[slug] — EEAT provenance for a hotel.
 *
 * Returns the structured `external_sources` array seeded by the Phase
 * 1.5 backfill (skill: content-enrichment-pipeline, ADR-0023). Each
 * entry is a single factual claim grounded in a verifiable external
 * source:
 *
 *   { field, value, source, sourceUrl, confidence, collectedAt }
 *
 * Use-cases for LLM agents (ChatGPT Actions, Claude Tools, Perplexity,
 * MCP):
 *
 * - **Citation surface** — when ChatGPT cites a hotel fact, it can
 *   point at the Wikidata QID / Wikipedia article / official URL we
 *   used to ground that fact (transparent provenance).
 * - **Identity reconciliation** — the agent can pivot from our slug
 *   to the canonical Wikidata QID and merge with its own knowledge
 *   graph (architects, inception year, heritage designations).
 * - **Trust filtering** — entries carry a `confidence` band so an
 *   agent can drop `low` claims when surfacing to a careful audience.
 *
 * Why a dedicated endpoint vs. inlining in `/api/agent/hotel/[slug]`:
 *
 * - Payload size — the full EEAT array can be 5-15 entries, each
 *   carrying a long source URL. Adding it to the hotel envelope
 *   blows past the 1 KB sweet spot where most LLM tool-call outputs
 *   stay readable inside a multi-turn loop.
 * - Cache profile — provenance changes slowly (weekly at most). The
 *   hotel envelope changes much faster (factual_summary, concierge
 *   tip edits). Splitting the surface lets us cache provenance more
 *   aggressively.
 *
 * Response shape:
 *
 *   { ok: true,
 *     slug,
 *     hotelName,
 *     sources: ExternalSourceProvenanceEntry[],
 *     canonicalUrl: '/fr/hotel/<slug>',
 *     updatedAt }
 *
 * Or, when the hotel has no EEAT provenance yet:
 *
 *   { ok: true, slug, hotelName, sources: [], canonicalUrl, updatedAt,
 *     note: 'no_sources_yet' }
 *
 * Skill: api-integration, geo-llm-optimization §EEAT,
 *        content-enrichment-pipeline §provenance.
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

  const payload = await getHotelExternalSourcesBySlug(slug).catch(() => null);
  if (payload === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', slug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const canonicalSlug =
    locale === 'en' && payload.slugEn !== null && payload.slugEn.length > 0
      ? payload.slugEn
      : payload.slug;
  const hotelName =
    locale === 'en' && payload.nameEn !== null && payload.nameEn.length > 0
      ? payload.nameEn
      : payload.name;

  // Project to camelCase + drop optional undefined keys before
  // serialising — `exactOptionalPropertyTypes: true` would otherwise
  // refuse an explicit `undefined` assignment to optional fields.
  const sources = payload.sources.map((s) => {
    const out: {
      field: string;
      value: unknown;
      source: string;
      sourceUrl?: string;
      confidence?: 'high' | 'medium' | 'low';
      collectedAt?: string;
    } = {
      field: s.field,
      value: s.value,
      source: s.source,
    };
    if (s.source_url !== undefined) out.sourceUrl = s.source_url;
    if (s.confidence !== undefined) out.confidence = s.confidence;
    if (s.collected_at !== undefined) out.collectedAt = s.collected_at;
    return out;
  });

  const body: {
    ok: true;
    slug: string;
    hotelName: string;
    sources: typeof sources;
    canonicalUrl: string;
    updatedAt: string | null;
    note?: 'no_sources_yet';
  } = {
    ok: true,
    slug: payload.slug,
    hotelName,
    sources,
    canonicalUrl: locale === 'en' ? `/en/hotel/${canonicalSlug}` : `/fr/hotel/${canonicalSlug}`,
    updatedAt: payload.updatedAt,
  };
  if (sources.length === 0) body.note = 'no_sources_yet';

  return NextResponse.json(body, {
    headers: {
      // 30-minute private cache — provenance changes much more slowly
      // than the hotel envelope (factual_summary, concierge tip) but
      // we still want fresh data when an editor patches a Wikidata QID.
      'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600',
    },
  });
}
