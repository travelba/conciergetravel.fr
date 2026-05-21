import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * "Itinéraires similaires" reader for the `<RelatedItineraries>` block
 * on `/itineraire/[slug]` (rule itinerary-page.mdc §5.1, mesh contract
 * ≥ 2 outbound links per detail page).
 *
 * Strategy:
 *   1. Pull the current itinerary's `country_code`, `themes`, `travel_style`
 *      (one cheap row read, no jsonb columns).
 *   2. Query published itineraries excluding the current one, scoped
 *      to the same `country_code`, ordered to favour theme overlap.
 *   3. Return up to `limit` cards (default 3) ranked by:
 *        - theme overlap count DESC
 *        - same `travel_style` boost
 *        - `priority` ASC (P0 first)
 *        - `last_updated` DESC
 *
 * Falls back gracefully (returns `[]`) on any Supabase failure, missing
 * source row, or schema drift — the consumer renders nothing rather
 * than crashing the parent page.
 *
 * Skill: itinerary-editorial-pipeline.
 */

export interface RelatedItineraryCard {
  readonly slugFr: string;
  readonly slugEn: string | null;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly heroCloudinaryId: string | null;
  readonly heroAltFr: string | null;
  readonly heroAltEn: string | null;
  readonly durationMinDays: number;
  readonly durationMaxDays: number | null;
  readonly travelStyle: string;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
  readonly themeOverlap: number;
  readonly lastUpdated: string;
}

const SourceRowSchema = z.object({
  id: z.string().uuid(),
  country_code: z.string(),
  themes: z.array(z.string()).default([]),
  travel_style: z.string(),
});

const CandidateRowSchema = z.object({
  id: z.string().uuid(),
  slug_fr: z.string(),
  slug_en: z.string().nullable(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  hero_cloudinary_id: z.string().nullable(),
  hero_alt_fr: z.string().nullable(),
  hero_alt_en: z.string().nullable(),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  travel_style: z.string(),
  themes: z.array(z.string()).default([]),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  last_updated: z.string(),
});
type CandidateRow = z.infer<typeof CandidateRowSchema>;

const PRIORITY_ORDER: Readonly<Record<'P0' | 'P1' | 'P2' | 'P3', number>> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

/**
 * Pure scoring function — exposed for unit tests. Higher score = more
 * relevant. Ties are broken in `compareCandidates` below.
 */
export function scoreCandidate(
  candidate: CandidateRow,
  source: { themes: readonly string[]; travel_style: string },
): { themeOverlap: number; styleMatch: boolean } {
  const sourceThemes = new Set(source.themes);
  let themeOverlap = 0;
  for (const t of candidate.themes) {
    if (sourceThemes.has(t)) themeOverlap += 1;
  }
  return { themeOverlap, styleMatch: candidate.travel_style === source.travel_style };
}

/**
 * Pure comparator — exposed for unit tests. Returns negative if `a`
 * should rank above `b`.
 */
export function compareCandidates(
  a: {
    themeOverlap: number;
    styleMatch: boolean;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    lastUpdated: string;
    titleFr: string;
  },
  b: {
    themeOverlap: number;
    styleMatch: boolean;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    lastUpdated: string;
    titleFr: string;
  },
): number {
  if (a.themeOverlap !== b.themeOverlap) return b.themeOverlap - a.themeOverlap;
  if (a.styleMatch !== b.styleMatch) return a.styleMatch ? -1 : 1;
  if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (a.lastUpdated !== b.lastUpdated) return a.lastUpdated < b.lastUpdated ? 1 : -1;
  return a.titleFr.localeCompare(b.titleFr);
}

/**
 * Read up to `limit` related itineraries for the given source slug.
 * Default `limit = 3` matches the rule §5.1 minimum (≥ 2 outbound
 * itinerary links) with one extra so the editor has flexibility.
 */
export async function getRelatedItineraries(
  sourceSlug: string,
  options: { limit?: number } = {},
): Promise<readonly RelatedItineraryCard[]> {
  if (typeof sourceSlug !== 'string' || sourceSlug.length === 0) return [];
  const limit = options.limit ?? 3;
  const supabase = getSupabaseAdminClient();

  // ------- 1. Pull the source row (axes only, no jsonb). -------------
  const { data: sourceRaw, error: sourceErr } = await supabase
    .from('itineraries')
    .select('id, country_code, themes, travel_style')
    .eq('slug_fr', sourceSlug)
    .eq('status', 'published')
    .maybeSingle();
  if (sourceErr !== null || sourceRaw === null) {
    if (sourceErr !== null) {
      console.error('[itineraries.related] source lookup failed', {
        sourceSlug,
        message: sourceErr.message,
        code: sourceErr.code,
      });
    }
    return [];
  }
  const source = SourceRowSchema.safeParse(sourceRaw);
  if (!source.success) return [];

  // ------- 2. Pull candidates: same country, exclude self. -----------
  // We deliberately don't push the theme overlap into SQL — sorting on
  // a dynamic theme-array intersection is awkward in PostgREST and
  // 100-row in-memory sort stays cheap.
  const { data: candidates, error: candidatesErr } = await supabase
    .from('itineraries')
    .select(
      'id, slug_fr, slug_en, title_fr, title_en, hero_cloudinary_id, hero_alt_fr, hero_alt_en, ' +
        'duration_min_days, duration_max_days, travel_style, themes, priority, last_updated',
    )
    .eq('status', 'published')
    .eq('country_code', source.data.country_code)
    .neq('id', source.data.id)
    .order('priority', { ascending: true })
    .order('last_updated', { ascending: false })
    .limit(50);
  if (candidatesErr !== null || !Array.isArray(candidates)) {
    if (candidatesErr !== null) {
      console.error('[itineraries.related] candidates query failed', {
        sourceSlug,
        message: candidatesErr.message,
        code: candidatesErr.code,
      });
    }
    return [];
  }

  // ------- 3. Score + rank in memory. --------------------------------
  type Scored = CandidateRow & { themeOverlap: number; styleMatch: boolean };
  const scored: Scored[] = [];
  for (const raw of candidates) {
    const parsed = CandidateRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const score = scoreCandidate(parsed.data, source.data);
    scored.push({ ...parsed.data, ...score });
  }
  scored.sort((a, b) =>
    compareCandidates(
      { ...a, lastUpdated: a.last_updated, titleFr: a.title_fr },
      { ...b, lastUpdated: b.last_updated, titleFr: b.title_fr },
    ),
  );

  return scored.slice(0, limit).map<RelatedItineraryCard>((c) => ({
    slugFr: c.slug_fr,
    slugEn: c.slug_en,
    titleFr: c.title_fr,
    titleEn: c.title_en,
    heroCloudinaryId: c.hero_cloudinary_id,
    heroAltFr: c.hero_alt_fr,
    heroAltEn: c.hero_alt_en,
    durationMinDays: c.duration_min_days,
    durationMaxDays: c.duration_max_days,
    travelStyle: c.travel_style,
    priority: c.priority,
    themeOverlap: c.themeOverlap,
    lastUpdated: c.last_updated,
  }));
}
