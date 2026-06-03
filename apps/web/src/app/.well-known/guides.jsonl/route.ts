import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
import { feedOrigin, jsonlResponse } from '@/server/agent/jsonl-feed';

/**
 * /.well-known/guides.jsonl — machine-readable catalogue of published
 * destination guides, one JSON object per line. Companion to
 * `hotels.jsonl` / `rankings.jsonl`.
 *
 * Per-row schema (stable contract — extend additively only):
 *   slug, name_fr, name_en, scope, summary_fr, summary_en, hero_image,
 *   url, url_en, reviewed_at, updated_at
 *
 * URLs target `/destination/{slug}` (guides are surfaced under the
 * destination route per ADR-0015).
 *
 * Skill: geo-llm-optimization §Machine-readable surfaces.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const origin = feedOrigin();
  const guides = await listPublishedGuides().catch(() => []);

  const lines = guides.map((g) =>
    JSON.stringify({
      slug: g.slug,
      name_fr: g.nameFr,
      name_en: g.nameEn,
      scope: g.scope,
      summary_fr: g.summaryFr,
      summary_en: g.summaryEn,
      hero_image: g.heroImage,
      url: `${origin}/fr/destination/${g.slug}`,
      url_en: `${origin}/en/destination/${g.slug}`,
      reviewed_at: g.reviewedAt,
      updated_at: g.updatedAt,
    }),
  );

  return jsonlResponse(lines);
}
