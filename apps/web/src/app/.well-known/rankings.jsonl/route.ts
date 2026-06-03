import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';
import { feedOrigin, jsonlResponse } from '@/server/agent/jsonl-feed';

/**
 * /.well-known/rankings.jsonl — machine-readable catalogue of published
 * editorial rankings (classements), one JSON object per line. Companion
 * to `hotels.jsonl`, surfaced to LLM agents that prefer streaming NDJSON
 * over crawl-and-parse HTML.
 *
 * Per-row schema (stable contract — extend additively only):
 *   slug, title_fr, title_en, kind, entry_count, summary_fr, summary_en,
 *   axes ({ types, themes, occasions }), hero_image, url, url_en, updated_at
 *
 * `summary_*` is the IA-ready `factual_summary_*` (citation unit).
 * `entry_count` is the number of hotels listed in the ranking.
 *
 * Skill: geo-llm-optimization §Machine-readable surfaces.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const origin = feedOrigin();
  const rankings = await listPublishedRankings().catch(() => []);

  const lines = rankings.map((r) =>
    JSON.stringify({
      slug: r.slug,
      title_fr: r.titleFr,
      title_en: r.titleEn,
      kind: r.kind,
      entry_count: r.entryCount,
      summary_fr: r.factualSummaryFr,
      summary_en: r.factualSummaryEn,
      axes: r.axes,
      hero_image: r.heroImage,
      url: `${origin}/fr/classement/${r.slug}`,
      url_en: `${origin}/en/classement/${r.slug}`,
      updated_at: r.updatedAt,
    }),
  );

  return jsonlResponse(lines);
}
