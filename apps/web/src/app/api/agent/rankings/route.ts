import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';
import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/rankings — list published editorial rankings, with
 * optional filtering by axis (type, lieu, theme, occasion, saison).
 *
 * Mirror of `list-rankings` skill. Returns a compact card per
 * ranking — title, slug, factual summary (130-150 chars), entry
 * count, axes — so an LLM can pick the most relevant ranking to
 * cite in a multi-turn answer (e.g. "best Palace for honeymoon" →
 * filter `occasion=lune-de-miel`).
 *
 * Detail content (full intro, FAQ, hotel entries) is exposed by the
 * sibling `/api/agent/rankings/[slug]` endpoint to keep this list
 * payload under 32 KB even with the full catalogue.
 */
const QuerySchema = z.object({
  axe: z.enum(['type', 'lieu', 'theme', 'occasion', 'saison']).optional(),
  valeur: z.string().min(1).max(120).optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    axe: url.searchParams.get('axe') ?? undefined,
    valeur: url.searchParams.get('valeur') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { axe, valeur, locale } = parsed.data;

  const all = await listPublishedRankings().catch(() => []);

  // Inline filter — keeps the helper untouched and gives us the same
  // matching logic as the `/classements/[axe]/[valeur]` route handler.
  const filtered =
    axe === undefined || valeur === undefined
      ? all
      : all.filter((r) => {
          switch (axe) {
            case 'type':
              return r.axes.types.includes(valeur);
            case 'theme':
              return r.axes.themes.includes(valeur);
            case 'occasion':
              return r.axes.occasions.includes(valeur);
            case 'lieu':
              return r.axes.lieu?.slug === valeur;
            case 'saison':
              return r.axes.saison === valeur;
            default:
              return false;
          }
        });

  return agentJson(
    {
      ok: true,
      filter: axe !== undefined ? { axe, valeur } : null,
      count: filtered.length,
      rankings: filtered.map((r) => ({
        slug: r.slug,
        title: locale === 'en' ? (r.titleEn ?? r.titleFr) : r.titleFr,
        factualSummary:
          locale === 'en' ? (r.factualSummaryEn ?? r.factualSummaryFr) : r.factualSummaryFr,
        entryCount: r.entryCount,
        kind: r.kind,
        axes: r.axes,
        updatedAt: r.updatedAt,
        canonicalUrl: locale === 'en' ? `/en/classement/${r.slug}` : `/fr/classement/${r.slug}`,
      })),
    },
    { cacheControl: 'public, max-age=600, s-maxage=3600' },
  );
}
