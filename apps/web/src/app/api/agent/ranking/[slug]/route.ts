import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { getRankingBySlug, getRankingEntries } from '@/server/rankings/get-ranking-by-slug';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/ranking/[slug] — full ranking payload for an agent.
 *
 * Mirror of `get-ranking` skill. Returns the editorial article shape
 * an LLM needs to quote a ranking faithfully:
 *
 *   - identity (slug, title, kind, axes)
 *   - factual summary (130-150 chars, IA-ready unit per CDC §2.3)
 *   - intro + outro narrative
 *   - sorted entries (rank, hotel slug, name, city, justification,
 *     badges)
 *   - FAQ (canonical Q&A for AEO citation)
 *   - external sources (named: Atout France, Michelin… for EEAT)
 *   - canonical URLs (FR + EN)
 *   - reviewedAt + updatedAt for freshness signalling
 *
 * Skipped from the payload: glossary, tables, callouts, toc_anchors —
 * the agent typically wants the prose + entries; the rich editorial
 * layout is human-only. Add `?body=full` later if a use-case appears.
 *
 * Cache: 30-min private + SWR 1 h — rankings change once or twice per
 * week, so the agent's multi-turn loop is well-served by short cache
 * while editors get their updates fast.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || slug.length === 0) {
    return agentJson(
      { ok: false, error: 'invalid_slug' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const row = await getRankingBySlug(slug).catch(() => null);
  if (row === null) {
    return agentJson(
      { ok: false, error: 'not_found', slug },
      { status: 404, cacheControl: 'no-store' },
    );
  }

  const entries = await getRankingEntries(row.id).catch(() => []);

  const pick = <T>(fr: T, en: T | null): T => (locale === 'en' && en !== null ? en : fr);

  return agentJson(
    {
      ok: true,
      ranking: {
        slug: row.slug,
        title: pick(row.title_fr, row.title_en),
        kind: row.kind,
        axes: row.axes,
        factualSummary: pick(row.factual_summary_fr ?? null, row.factual_summary_en ?? null),
        intro: pick(row.intro_fr, row.intro_en),
        outro: pick(row.outro_fr, row.outro_en),
        author: row.author_name !== null ? { name: row.author_name, url: row.author_url } : null,
        entries: entries.map((e) => ({
          rank: e.rank,
          hotelSlug: e.hotel_slug,
          hotelName: pick(e.hotel_name, e.hotel_name_en),
          city: e.hotel_city,
          stars: e.hotel_stars,
          isPalace: e.hotel_is_palace,
          justification: pick(e.justification_fr, e.justification_en),
          badge: pick(e.badge_fr ?? null, e.badge_en ?? null),
          canonicalUrl:
            locale === 'en'
              ? `/en/hotel/${e.hotel_slug_en ?? e.hotel_slug}`
              : `/fr/hotel/${e.hotel_slug}`,
        })),
        faq: row.faq.map((f) => ({
          question: pick(f.question_fr, f.question_en),
          answer: pick(f.answer_fr, f.answer_en),
        })),
        externalSources: row.external_sources.map((s) => ({
          type: s.type,
          label: pick(s.label_fr, s.label_en),
          url: s.url,
        })),
        reviewedAt: row.reviewed_at,
        updatedAt: row.updated_at,
        canonicalUrl: locale === 'en' ? `/en/classement/${row.slug}` : `/fr/classement/${row.slug}`,
      },
    },
    { cacheControl: 'private, max-age=1800, stale-while-revalidate=3600' },
  );
}
