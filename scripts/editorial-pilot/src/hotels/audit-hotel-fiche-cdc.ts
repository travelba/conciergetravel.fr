/**
 * audit-hotel-fiche-cdc.ts — exhaustive CDC §2 audit (16 blocs + SEO + GEO + agentique + FAQ + maillage + JSON-LD + photos).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --published-only
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=rosewood-hong-kong
 *
 * Outputs:
 *   scripts/editorial-pilot/runs/hotel-fiche-cdc-audit-YYYY-MM-DD.json
 *   scripts/editorial-pilot/runs/hotel-fiche-cdc-backlog-YYYY-MM-DD.csv
 *   scripts/editorial-pilot/runs/hotel-fiche-cdc-summary-YYYY-MM-DD.txt
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import {
  buildCityToGuideSlugMap,
  resolveGuideSlugForHotel,
} from '../guides/guide-hotel-city-keys.js';
import {
  aggregateBlockFailCounts,
  aggregateCdcGapCounts,
  evaluateCdcHotelFiche,
  type CdcAuditContext,
  type CdcHotelAuditResult,
  type CdcHotelAuditRow,
  type RoomAuditStats,
  BLOCK_LABELS,
  CDC_COMPLETE_THRESHOLD,
  CDC_PARTIAL_THRESHOLD,
} from './hotel-fiche-cdc-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const CDC_HOTEL_COLUMNS =
  'id,slug,slug_en,name,name_en,is_published,luxury_tier,country_code,priority,updated_at,stars,is_palace,city,district,address,postal_code,latitude,longitude,phone_e164,email_reservations,description_fr,description_en,meta_title_fr,meta_title_en,meta_desc_fr,meta_desc_en,factual_summary_fr,factual_summary_en,concierge_advice,faq_content,long_description_sections,highlights,amenities,points_of_interest,transports,restaurant_info,spa_info,policies,awards,affiliations,signature_experiences,number_of_rooms,number_of_suites,opened_at,official_url,wikidata_id,wikipedia_url_fr,wikipedia_url_en,external_sameas,hero_image,gallery_images,hero_video,virtual_tour_url,google_rating,google_reviews_count,featured_reviews,mice_info,booking_mode,upcoming_events,instagram,concierge_pick,concierge_hook,external_sources';

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL for direct pg)',
    );
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PostgrestEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

interface CliArgs {
  readonly publishedOnly: boolean;
  readonly slug: string | null;
  readonly minScore: number | null;
  readonly format: 'json' | 'csv' | 'both';
  readonly summaryOnly: boolean;
  readonly limit: number | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let publishedOnly = false;
  let slug: string | null = null;
  let minScore: number | null = null;
  let format: 'json' | 'csv' | 'both' = 'both';
  let summaryOnly = false;
  let limit: number | null = null;

  for (const a of argv) {
    if (a === '--published-only') publishedOnly = true;
    else if (a === '--summary') summaryOnly = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
    else if (a.startsWith('--min-score=')) {
      const n = Number(a.slice('--min-score='.length));
      if (Number.isFinite(n)) minScore = n;
    } else if (a.startsWith('--format=')) {
      const v = a.slice('--format='.length);
      if (v === 'json' || v === 'csv' || v === 'both') format = v;
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { publishedOnly, slug, minScore, format, summaryOnly, limit };
}

async function connectPg(): Promise<import('pg').Client> {
  const pgModule = (await import('pg')) as typeof import('pg');
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'];
  if (!conn) {
    throw new Error('Missing DATABASE_URL / SUPABASE_DB_POOLER_URL / SUPABASE_DB_URL');
  }
  const cleaned = conn.replace(/[?&]sslmode=[^&]*/giu, '');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function fetchPublishedGuideSlugsPg(client: import('pg').Client): Promise<Set<string>> {
  const result = await client.query<{ slug: string }>(
    'select slug from public.editorial_guides where is_published = true',
  );
  return new Set(result.rows.map((r) => r.slug));
}

async function fetchRoomStatsPg(client: import('pg').Client): Promise<Map<string, RoomAuditStats>> {
  const sql = `
    select
      h.slug,
      count(r.id)::int as total,
      count(r.id) filter (where r.slug is not null and length(r.slug) > 0)::int as with_slug,
      count(r.id) filter (
        where r.slug is not null
          and coalesce(length(r.long_description_fr), 0) >= 800
          and coalesce(jsonb_array_length(r.images), 0) >= 5
      )::int as indexable
    from public.hotels h
    left join public.hotel_rooms r on r.hotel_id = h.id
    group by h.slug
  `;
  const result = await client.query<{
    slug: string;
    total: number;
    with_slug: number;
    indexable: number;
  }>(sql);
  const map = new Map<string, RoomAuditStats>();
  for (const row of result.rows) {
    map.set(row.slug, {
      total: row.total,
      withSlug: row.with_slug,
      indexable: row.indexable,
    });
  }
  return map;
}

async function fetchHotelsViaPg(args: CliArgs): Promise<{
  rows: CdcHotelAuditRow[];
  guideSlugs: Set<string>;
  roomStats: Map<string, RoomAuditStats>;
}> {
  const client = await connectPg();
  try {
    const [guideSlugs, roomStats] = await Promise.all([
      fetchPublishedGuideSlugsPg(client),
      fetchRoomStatsPg(client),
    ]);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (args.publishedOnly) conditions.push('is_published = true');
    if (args.slug !== null) {
      params.push(args.slug);
      conditions.push(`slug = $${params.length}`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const limitClause = args.limit !== null ? `limit ${args.limit}` : '';
    const sql = `select ${CDC_HOTEL_COLUMNS} from public.hotels ${where} order by slug asc ${limitClause}`;
    const result = await client.query<CdcHotelAuditRow>(sql, params);
    return { rows: result.rows, guideSlugs, roomStats };
  } finally {
    await client.end();
  }
}

async function fetchPublishedGuideSlugsPostgrest(): Promise<Set<string>> {
  const env = loadPostgrestEnv();
  const url = `${env.restBase}/editorial_guides?select=slug&is_published=eq.true`;
  const r = await fetch(url, { headers: pgHeaders(env) });
  if (!r.ok) return new Set();
  const data = (await r.json()) as Array<{ slug: string }>;
  return new Set(data.map((d) => d.slug));
}

async function fetchHotelsViaPostgrest(args: CliArgs): Promise<{
  rows: CdcHotelAuditRow[];
  guideSlugs: Set<string>;
  roomStats: Map<string, RoomAuditStats>;
}> {
  const env = loadPostgrestEnv();
  const params = new URLSearchParams();
  params.set('select', CDC_HOTEL_COLUMNS);
  if (args.publishedOnly) params.set('is_published', 'eq.true');
  if (args.slug !== null) params.set('slug', `eq.${args.slug}`);
  params.set('order', 'slug.asc');
  if (args.limit !== null) params.set('limit', String(args.limit));

  const PAGE = 500;
  const all: CdcHotelAuditRow[] = [];
  let from = 0;
  while (true) {
    const url = `${env.restBase}/hotels?${params.toString()}`;
    const r = await fetch(url, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) {
      throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const batch = (await r.json()) as CdcHotelAuditRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (args.limit !== null && all.length >= args.limit) break;
    from += PAGE;
  }

  const guideSlugs = await fetchPublishedGuideSlugsPostgrest();
  return {
    rows: args.limit !== null ? all.slice(0, args.limit) : all,
    guideSlugs,
    roomStats: new Map(),
  };
}

async function fetchCatalogue(args: CliArgs): Promise<{
  rows: CdcHotelAuditRow[];
  guideSlugs: Set<string>;
  roomStats: Map<string, RoomAuditStats>;
}> {
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'];
  if (conn) return fetchHotelsViaPg(args);
  return fetchHotelsViaPostgrest(args);
}

function emptyRoomStats(): RoomAuditStats {
  return { total: 0, withSlug: 0, indexable: 0 };
}

/**
 * Postgres `numeric` columns (latitude/longitude/google_rating) come back as
 * STRINGS from both node-pg and PostgREST. The audit checks test
 * `typeof === 'number'`, so without coercion every fiche falsely failed
 * `cdc.07.gps` / `jsonld.place` / `jsonld.google_rating_scale`. Normalise here,
 * the single choke point feeding `evaluateCdcHotelFiche`.
 */
function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeNumericFields(row: CdcHotelAuditRow): CdcHotelAuditRow {
  return {
    ...row,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    google_rating: toNumberOrNull(row.google_rating),
    google_reviews_count: toNumberOrNull(row.google_reviews_count),
  };
}

function evaluateAll(
  rows: readonly CdcHotelAuditRow[],
  guideSlugs: ReadonlySet<string>,
  roomStats: ReadonlyMap<string, RoomAuditStats>,
): CdcHotelAuditResult[] {
  const cityToGuide = buildCityToGuideSlugMap(guideSlugs);
  return rows.map((raw) => {
    const row = normalizeNumericFields(raw);
    const ctx: CdcAuditContext = {
      roomStats: roomStats.get(row.slug) ?? emptyRoomStats(),
      guideSlug: resolveGuideSlugForHotel(row.city, guideSlugs, cityToGuide),
    };
    return evaluateCdcHotelFiche(row, ctx);
  });
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function runsDir(): string {
  return resolve(__dirname, '../../runs');
}

function toCsvRow(cells: readonly string[]): string {
  return cells.map((c) => `"${c.replace(/"/gu, '""')}"`).join(',');
}

function writeCsv(path: string, results: readonly CdcHotelAuditResult[]): void {
  const header = [
    'slug',
    'name',
    'is_published',
    'luxury_tier',
    'country_code',
    'status_cdc',
    'score_global',
    'score_cdc',
    'score_cdc_phase1',
    'score_seo',
    'score_geo',
    'score_faq',
    'score_maille',
    'score_photo',
    'score_jsonld',
    'score_golden',
    'score_structure',
    'score_agent',
    'score_t3',
    'indexable',
    'guide_slug',
    'room_total',
    'room_indexable',
    'cdc_gap_count',
    'worst_block',
  ];
  const lines = [toCsvRow(header)];
  for (const r of results) {
    const worst = [...r.blocks].sort((a, b) => a.score - b.score)[0];
    lines.push(
      toCsvRow([
        r.slug,
        r.name,
        String(r.is_published),
        r.luxury_tier ?? '',
        r.country_code ?? '',
        r.status_cdc,
        String(r.score_global),
        String(r.score_cdc),
        String(r.score_cdc_phase1),
        String(r.score_seo),
        String(r.score_geo),
        String(r.score_faq),
        String(r.score_maille),
        String(r.score_photo),
        String(r.score_jsonld),
        String(r.score_golden),
        String(r.score_structure),
        String(r.score_agent),
        String(r.score_t3),
        String(r.indexable),
        r.guide_slug ?? '',
        String(r.room_stats.total),
        String(r.room_stats.indexable),
        String(r.cdc_gaps.length),
        worst !== undefined ? `${worst.block}:${worst.score}%` : '',
      ]),
    );
  }
  writeFileSync(path, lines.join('\n'), 'utf8');
}

interface StatusCounts {
  complete: number;
  partial: number;
  gap: number;
  draft: number;
}

function countByStatus(results: readonly CdcHotelAuditResult[]): StatusCounts {
  const out: StatusCounts = { complete: 0, partial: 0, gap: 0, draft: 0 };
  for (const r of results) {
    if (!r.is_published) out.draft += 1;
    else if (r.score_cdc >= CDC_COMPLETE_THRESHOLD) out.complete += 1;
    else if (r.score_cdc >= CDC_PARTIAL_THRESHOLD) out.partial += 1;
    else out.gap += 1;
  }
  return out;
}

function avgScore(
  results: readonly CdcHotelAuditResult[],
  pick: (r: CdcHotelAuditResult) => number,
): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((a, r) => a + pick(r), 0);
  return Math.round(sum / results.length);
}

export function buildCdcSummary(results: readonly CdcHotelAuditResult[]): string {
  const total = results.length;
  const published = results.filter((r) => r.is_published).length;
  const status = countByStatus(results);
  const gapCounts = aggregateCdcGapCounts(results);
  const blockFails = aggregateBlockFailCounts(results);
  const sortedGaps = [...gapCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedBlocks = [...blockFails.entries()].sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  lines.push(`=== Hotel fiche CDC exhaustive audit — ${new Date().toISOString()} ===`);
  lines.push('');
  lines.push(`Total audited       : ${total}`);
  lines.push(`Published         : ${published}`);
  lines.push(`Drafts            : ${total - published}`);
  lines.push('');
  lines.push('── CDC target status (score_cdc) ──');
  lines.push(`  complete (≥${CDC_COMPLETE_THRESHOLD}%) : ${status.complete}`);
  lines.push(
    `  partial (${CDC_PARTIAL_THRESHOLD}-${CDC_COMPLETE_THRESHOLD - 1}%) : ${status.partial}`,
  );
  lines.push(`  gap (<${CDC_PARTIAL_THRESHOLD}%)      : ${status.gap}`);
  lines.push(`  draft                         : ${status.draft}`);
  lines.push('');
  lines.push('── Mean scores (published only) ──');
  const pub = results.filter((r) => r.is_published);
  lines.push(`  global (8 dims)   : ${avgScore(pub, (r) => r.score_global)}%`);
  lines.push(`  CDC target        : ${avgScore(pub, (r) => r.score_cdc)}%`);
  lines.push(`  CDC phase1        : ${avgScore(pub, (r) => r.score_cdc_phase1)}%`);
  lines.push(`  SEO               : ${avgScore(pub, (r) => r.score_seo)}%`);
  lines.push(`  GEO / AEO         : ${avgScore(pub, (r) => r.score_geo)}%`);
  lines.push(`  FAQ               : ${avgScore(pub, (r) => r.score_faq)}%`);
  lines.push(`  Maillage / EEAT   : ${avgScore(pub, (r) => r.score_maille)}%`);
  lines.push(`  Photos            : ${avgScore(pub, (r) => r.score_photo)}%`);
  lines.push(`  JSON-LD prereqs   : ${avgScore(pub, (r) => r.score_jsonld)}%`);
  lines.push(`  Golden template   : ${avgScore(pub, (r) => r.score_golden)}%`);
  lines.push(`  Restructuration   : ${avgScore(pub, (r) => r.score_structure)}%`);
  lines.push(`  Agentique         : ${avgScore(pub, (r) => r.score_agent)}%`);
  lines.push(`  T3 editorial      : ${avgScore(pub, (r) => r.score_t3)}%`);
  lines.push('');
  lines.push('── Blocs CDC §2 — fiches avec au moins 1 échec ──');
  for (const [block, count] of sortedBlocks) {
    const label = BLOCK_LABELS[block] ?? block;
    lines.push(`  ${block.padEnd(6)} ${label.padEnd(28)} : ${count}/${published}`);
  }
  lines.push('');
  lines.push('── Top 20 gaps CDC (by field) ──');
  for (const [field, count] of sortedGaps.slice(0, 20)) {
    lines.push(`  ${field.padEnd(36)} : ${count}`);
  }
  lines.push('');
  lines.push('── Indexability ──');
  lines.push(`  indexable         : ${results.filter((r) => r.indexable).length}`);
  lines.push(`  noindex path      : ${results.filter((r) => !r.indexable).length}`);
  lines.push('');
  lines.push(
    'Note: Bloc 8 (Amadeus booking / Offer JSON-LD) = Phase 6 deferred, excluded from scores.',
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { rows, guideSlugs, roomStats } = await fetchCatalogue(args);
  let results = evaluateAll(rows, guideSlugs, roomStats);
  const minScore = args.minScore;
  if (minScore !== null) {
    results = results.filter((r) => r.score_cdc < minScore);
  }

  const stamp = todayStamp();
  const dir = runsDir();
  mkdirSync(dir, { recursive: true });

  const summary = buildCdcSummary(results);
  console.log(summary);

  if (args.summaryOnly) return;

  const summaryPath = resolve(dir, `hotel-fiche-cdc-summary-${stamp}.txt`);
  writeFileSync(summaryPath, summary, 'utf8');
  console.log(`\nSummary → ${summaryPath}`);

  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = resolve(dir, `hotel-fiche-cdc-audit-${stamp}.json`);
    const payload = {
      generated_at: new Date().toISOString(),
      total: results.length,
      thresholds: { cdc_complete: CDC_COMPLETE_THRESHOLD, cdc_partial: CDC_PARTIAL_THRESHOLD },
      status_counts: countByStatus(results),
      mean_scores_published: {
        global: avgScore(
          results.filter((r) => r.is_published),
          (r) => r.score_global,
        ),
        cdc: avgScore(
          results.filter((r) => r.is_published),
          (r) => r.score_cdc,
        ),
        seo: avgScore(
          results.filter((r) => r.is_published),
          (r) => r.score_seo,
        ),
        geo: avgScore(
          results.filter((r) => r.is_published),
          (r) => r.score_geo,
        ),
      },
      block_fail_counts: Object.fromEntries(aggregateBlockFailCounts(results)),
      gap_counts: Object.fromEntries(aggregateCdcGapCounts(results)),
      hotels: results,
    };
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`JSON   → ${jsonPath}`);
  }

  if (args.format === 'csv' || args.format === 'both') {
    const csvPath = resolve(dir, `hotel-fiche-cdc-backlog-${stamp}.csv`);
    writeCsv(csvPath, results);
    console.log(`CSV    → ${csvPath}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
