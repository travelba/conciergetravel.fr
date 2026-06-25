import 'server-only';

import { cache } from 'react';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Coerces a Postgres `numeric` column to a finite `number | null`.
 * PostgREST serialises `numeric` as a string, so a bare `z.number()`
 * would reject `latitude`/`longitude` and drop the whole entry. Mirrors
 * the `numberOrNull` helper in `get-hotel-by-slug.ts`.
 */
const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const FaqSchema = z.object({
  question_fr: z.string().optional().default(''),
  question_en: z.string().optional().default(''),
  answer_fr: z.string().optional().default(''),
  answer_en: z.string().optional().default(''),
  section_anchor: z.string().nullish(),
});
export type RankingFaq = z.infer<typeof FaqSchema>;

// v2 schemas — keep mirror of guides' shape.
const TableHeaderSchema = z.object({
  key: z.string(),
  label_fr: z.string(),
  label_en: z.string().optional().default(''),
  align: z.enum(['left', 'right', 'center']).optional(),
});
const TableCellSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({ text: z.string(), href: z.string().nullish() }),
]);
const TableSchema = z.object({
  key: z.string(),
  kind: z.string(),
  title_fr: z.string(),
  title_en: z.string().optional().default(''),
  note_fr: z.string().optional().default(''),
  note_en: z.string().optional().default(''),
  headers: z.array(TableHeaderSchema).default([]),
  rows: z.array(z.record(z.string(), TableCellSchema)).default([]),
  // EN parity for the row body: a parallel rows array with the same keys
  // whose textual cells are translated (backfilled by
  // scripts/editorial-pilot/src/rankings/translate-rankings-tables-en.ts).
  // Optional + defaults to []: a table without it renders the FR `rows`
  // exactly as before. The renderer picks `rows_en` only on the EN locale.
  rows_en: z.array(z.record(z.string(), TableCellSchema)).optional().default([]),
});
export type RankingTable = z.infer<typeof TableSchema>;

const GlossaryEntrySchema = z.object({
  term_fr: z.string(),
  term_en: z.string().optional().default(''),
  definition_fr: z.string(),
  definition_en: z.string().optional().default(''),
});
export type RankingGlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

const CalloutSchema = z.object({
  kind: z.string(),
  title_fr: z.string(),
  title_en: z.string().optional().default(''),
  body_fr: z.string(),
  body_en: z.string().optional().default(''),
});
export type RankingCallout = z.infer<typeof CalloutSchema>;

const ExternalSourceSchema = z.object({
  url: z.string(),
  label_fr: z.string(),
  label_en: z.string().optional().default(''),
  type: z.string(),
});
export type RankingExternalSource = z.infer<typeof ExternalSourceSchema>;

const TocAnchorSchema = z.object({
  anchor: z.string(),
  label_fr: z.string(),
  label_en: z.string().optional().default(''),
  level: z.union([z.literal(2), z.literal(3)]).optional(),
});
export type RankingTocAnchor = z.infer<typeof TocAnchorSchema>;

const EditorialSectionSchema = z.object({
  key: z.string(),
  type: z.string(),
  title_fr: z.string(),
  title_en: z.string().optional().default(''),
  body_fr: z.string(),
  body_en: z.string().optional().default(''),
});
export type RankingEditorialSection = z.infer<typeof EditorialSectionSchema>;

// Axes payload (mirror of `RankingAxesSchema` in
// scripts/editorial-pilot/src/rankings/axes.ts). Kept loose at the
// front-end boundary — the source of truth is the editorial pipeline.
const AxesLieuSchema = z.object({
  scope: z.string(),
  slug: z.string(),
  label: z.string(),
});
const AxesSchema = z.object({
  types: z.array(z.string()).default([]),
  lieu: AxesLieuSchema.optional(),
  themes: z.array(z.string()).default([]),
  occasions: z.array(z.string()).default([]),
  saison: z.string().optional(),
});
export type RankingAxesPayload = z.infer<typeof AxesSchema>;

export const RankingRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  kind: z.enum(['best_of', 'awarded', 'thematic', 'geographic']),
  intro_fr: z.string(),
  intro_en: z.string().nullable(),
  outro_fr: z.string().nullable(),
  outro_en: z.string().nullable(),
  faq: z.array(FaqSchema).default([]),
  hero_image: z.string().nullable(),
  meta_title_fr: z.string().nullable(),
  meta_title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  author_name: z.string().nullable(),
  author_url: z.string().nullable(),
  is_published: z.boolean(),
  updated_at: z.string().nullable(),
  // v2 columns (0027 + 0028).
  tables: z.array(TableSchema).default([]),
  glossary: z.array(GlossaryEntrySchema).default([]),
  external_sources: z.array(ExternalSourceSchema).default([]),
  editorial_callouts: z.array(CalloutSchema).default([]),
  toc_anchors: z.array(TocAnchorSchema).default([]),
  editorial_sections: z.array(EditorialSectionSchema).default([]),
  // 0029 — facetting axes (always present; `{}` when not yet classified).
  axes: AxesSchema.default({ types: [], themes: [], occasions: [] }),
  // 0030 — AEO factual summary (CDC §2.3).
  factual_summary_fr: z.string().nullable().optional(),
  factual_summary_en: z.string().nullable().optional(),
});
export type RankingRow = z.infer<typeof RankingRowSchema>;

export const RankingEntrySchema = z.object({
  rank: z.number().int(),
  justification_fr: z.string(),
  justification_en: z.string().nullable(),
  badge_fr: z.string().nullable(),
  badge_en: z.string().nullable(),
  hotel_slug: z.string(),
  hotel_slug_en: z.string().nullable(),
  hotel_name: z.string(),
  hotel_name_en: z.string().nullable(),
  hotel_stars: z.number().int(),
  hotel_is_palace: z.boolean(),
  hotel_city: z.string(),
  // International hotels have NULL region (migration 0033). Coerce to
  // empty string so ranking entries with intl hotels render correctly.
  hotel_region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  hotel_hero_image: z.string().nullable(),
  hotel_description_fr: z.string().nullable(),
  hotel_description_en: z.string().nullable(),
  // Geo signal forwarded to the ItemList JSON-LD (P0-3). Both must be
  // present + finite for the `geo` node to be emitted (no half-pin).
  // PostgREST returns `numeric` as a string → coerce defensively.
  hotel_latitude: numberOrNull,
  hotel_longitude: numberOrNull,
});
export type RankingEntry = z.infer<typeof RankingEntrySchema>;

const RANKING_COLUMNS =
  'id, slug, title_fr, title_en, kind, intro_fr, intro_en, outro_fr, outro_en, ' +
  'faq, hero_image, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en, ' +
  'reviewed_at, author_name, author_url, is_published, updated_at, ' +
  'tables, glossary, external_sources, editorial_callouts, toc_anchors, editorial_sections, ' +
  'axes, factual_summary_fr, factual_summary_en';

// `cache()`-wrapped so `generateMetadata` (og:image derivation) and the
// page render share a single fetch per request — the page is
// `force-dynamic`, so without this the row + entries would be queried
// twice. Mirrors the `get-hotel-by-slug.ts` precedent.
export const getRankingBySlug = cache(async (slug: string): Promise<RankingRow | null> => {
  if (typeof slug !== 'string' || slug.length === 0) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('editorial_rankings')
    .select(RANKING_COLUMNS)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const parsed = RankingRowSchema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data;
});

export const getRankingEntries = cache(_getRankingEntries);

async function _getRankingEntries(rankingId: string): Promise<readonly RankingEntry[]> {
  const supabase = getSupabaseAdminClient();
  // Two-step query: entries → hotels (RLS keeps the join read-only).
  const { data: entries, error: entriesErr } = await supabase
    .from('editorial_ranking_entries')
    .select('hotel_id, rank, justification_fr, justification_en, badge_fr, badge_en')
    .eq('ranking_id', rankingId)
    .order('rank', { ascending: true });
  if (entriesErr !== null || entries === null) return [];
  const hotelIds = entries.map((e) => e.hotel_id as string);
  if (hotelIds.length === 0) return [];
  const { data: hotels, error: hotelsErr } = await supabase
    .from('hotels')
    .select(
      'id, slug, slug_en, name, name_en, stars, is_palace, city, region, hero_image, description_fr, description_en, latitude, longitude',
    )
    .in('id', hotelIds);
  if (hotelsErr !== null || hotels === null) return [];
  const byId = new Map<string, (typeof hotels)[0]>();
  for (const h of hotels) byId.set(h.id as string, h);
  const out: RankingEntry[] = [];
  for (const e of entries) {
    const h = byId.get(e.hotel_id as string);
    if (h === undefined) continue;
    const parsed = RankingEntrySchema.safeParse({
      rank: e.rank,
      justification_fr: e.justification_fr,
      justification_en: e.justification_en,
      badge_fr: e.badge_fr,
      badge_en: e.badge_en,
      hotel_slug: h.slug,
      hotel_slug_en: h.slug_en,
      hotel_name: h.name,
      hotel_name_en: h.name_en,
      hotel_stars: h.stars,
      hotel_is_palace: h.is_palace,
      hotel_city: h.city,
      hotel_region: h.region,
      hotel_hero_image: h.hero_image,
      hotel_description_fr: h.description_fr,
      hotel_description_en: h.description_en,
      hotel_latitude: h.latitude,
      hotel_longitude: h.longitude,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out.sort((a, b) => a.rank - b.rank);
}

export interface PublishedRankingCard {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string | null;
  readonly kind: 'best_of' | 'awarded' | 'thematic' | 'geographic';
  readonly entryCount: number;
  readonly heroImage: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly axes: RankingAxesPayload;
  readonly updatedAt: string | null;
}

// `cache()`-wrapped (like `getRankingBySlug`/`getRankingEntries`): on
// `/classements/[axe]/[valeur]` this full catalogue scan is invoked from
// `generateMetadata` (axe resolution), the page body, and the related-axes
// block — 2-3× per request on a `force-dynamic` route. Request-scoped
// memoisation dedupes them to a single scan without touching the logic.
export const listPublishedRankings = cache(_listPublishedRankings);

// Supabase REST caps every `.select()` at `db_max_rows` (1 000 in our
// project) when no `.range()` is supplied. The published-ranking
// catalogue has grown fast (≈560 → 816 on 2026-06-25) and powers the
// `/classements` index, `sitemaps/rankings.xml`, the agent corpus and
// the homepage strip — so the moment it crosses 1 000 an unpaginated
// select would silently orphan every ranking beyond the cap from all
// of those surfaces at once. We page with `.range()` until exhaustion,
// ordered by a stable total order (kind, title_fr, id) so the slice
// boundary never skips or duplicates a row, bounded by `MAX_PAGES`.
const RANKINGS_PAGE_SIZE = 1000;
const RANKINGS_MAX_PAGES = 12;

async function _listPublishedRankings(): Promise<readonly PublishedRankingCard[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const data: Array<Record<string, unknown>> = [];
    for (let page = 0; page < RANKINGS_MAX_PAGES; page += 1) {
      const from = page * RANKINGS_PAGE_SIZE;
      const { data: pageData, error } = await supabase
        .from('editorial_rankings')
        .select(
          'id, slug, title_fr, title_en, kind, hero_image, factual_summary_fr, factual_summary_en, axes, updated_at',
        )
        .eq('is_published', true)
        .order('kind', { ascending: true })
        .order('title_fr', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + RANKINGS_PAGE_SIZE - 1);
      if (error !== null || !Array.isArray(pageData)) {
        // Surface the failure but keep whatever pages already loaded —
        // a partial index beats an empty hub on a transient error.
        if (error !== null) {
          console.error('[listPublishedRankings] page query failed:', {
            page,
            message: error.message,
          });
        }
        break;
      }
      for (const row of pageData) data.push(row as Record<string, unknown>);
      if (pageData.length < RANKINGS_PAGE_SIZE) break;
    }
    const counts = new Map<string, number>();
    {
      // Count entries per ranking by scanning the WHOLE entries table,
      // not by filtering on the published ids. With ~688 published
      // rankings, a `.in('ranking_id', ids)` filter builds a ~25 KB
      // PostgREST URL that trips the server URL-length cap (414) — the
      // request fails and, when the error is swallowed, every card shows
      // "0 hôtels". The catalogue holds ~5.5k entries (6 pages of 1000),
      // so a full scan is cheap and URL-safe. The `counts` map is only
      // read for published ids (`counts.get(r.id) ?? 0`), so counting
      // entries of non-published rankings is harmless (never rendered).
      // Supabase REST caps each `.select()` at 1000 rows by default, so
      // we paginate with `.range()` until a batch is shorter than the
      // page size.
      const PAGE_SIZE = 1000;
      let from = 0;
      // Hard ceiling so a runaway query can never hammer the DB —
      // 20k entries = ~4× the current catalogue, well above any
      // realistic 24-month growth.
      const SAFETY_CEILING = 20000;
      while (from < SAFETY_CEILING) {
        const { data: entries, error: entriesErr } = await supabase
          .from('editorial_ranking_entries')
          .select('ranking_id')
          .range(from, from + PAGE_SIZE - 1);
        if (entriesErr !== null) {
          // Surface the failure instead of silently under-counting to 0.
          console.error('[listPublishedRankings] entry count query failed:', entriesErr.message);
          break;
        }
        if (entries === null || entries.length === 0) break;
        for (const e of entries) {
          const k = e.ranking_id as string;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        if (entries.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }
    return data.map((r) => {
      const axesParsed = AxesSchema.safeParse(r['axes'] ?? {});
      return {
        slug: r['slug'] as string,
        titleFr: r['title_fr'] as string,
        titleEn: (r['title_en'] as string | null) ?? null,
        kind: r['kind'] as 'best_of' | 'awarded' | 'thematic' | 'geographic',
        entryCount: counts.get(r['id'] as string) ?? 0,
        heroImage: (r['hero_image'] as string | null) ?? null,
        factualSummaryFr: (r['factual_summary_fr'] as string | null) ?? null,
        factualSummaryEn: (r['factual_summary_en'] as string | null) ?? null,
        axes: axesParsed.success ? axesParsed.data : { types: [], themes: [], occasions: [] },
        updatedAt: (r['updated_at'] as string | null) ?? null,
      };
    });
  } catch (e) {
    console.error(
      '[listPublishedRankings] failed:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}
