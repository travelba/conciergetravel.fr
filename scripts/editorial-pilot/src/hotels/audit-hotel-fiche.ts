/**
 * audit-hotel-fiche.ts — editorial completeness audit for the full hotel catalogue.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches -- --published-only
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches -- --slug=le-meurice
 *   pnpm --filter @mch/editorial-pilot audit:hotel-fiches -- --min-score=95 --format=csv
 *
 * Outputs (default):
 *   scripts/editorial-pilot/runs/hotel-fiche-audit-YYYY-MM-DD.json
 *   scripts/editorial-pilot/runs/hotel-fiche-backlog-YYYY-MM-DD.csv
 *   scripts/editorial-pilot/runs/hotel-fiche-audit-summary-YYYY-MM-DD.txt
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import {
  auditForcePostgrest,
  hasPgConnectionString,
  isDirectPgUnreachable,
  warnPgFallback,
} from './audit-pg-fallback.js';
import {
  aggregateGapCounts,
  evaluateHotelFiche,
  type HotelAuditResult,
  type HotelAuditRow,
} from './hotel-fiche-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const HOTEL_AUDIT_COLUMNS =
  'slug,name,is_published,luxury_tier,country_code,priority,updated_at,description_fr,description_en,meta_title_fr,meta_title_en,meta_desc_fr,meta_desc_en,factual_summary_fr,factual_summary_en,concierge_advice,faq_content,long_description_sections,highlights,amenities,points_of_interest,transports,restaurant_info,spa_info,policies,awards,affiliations,signature_experiences,number_of_rooms,opened_at,official_url,wikidata_id,hero_image,gallery_images';

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

async function fetchHotelsViaPostgrest(args: CliArgs): Promise<HotelAuditRow[]> {
  const env = loadPostgrestEnv();
  const params = new URLSearchParams();
  params.set('select', HOTEL_AUDIT_COLUMNS);
  if (args.publishedOnly) params.set('is_published', 'eq.true');
  if (args.slug !== null) params.set('slug', `eq.${args.slug}`);
  params.set('order', 'slug.asc');
  if (args.limit !== null) params.set('limit', String(args.limit));

  const PAGE = 1000;
  const all: HotelAuditRow[] = [];
  let from = 0;
  while (true) {
    const url = `${env.restBase}/hotels?${params.toString()}`;
    const r = await fetch(url, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) {
      throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const batch = (await r.json()) as HotelAuditRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (args.limit !== null && all.length >= args.limit) break;
    from += PAGE;
  }
  return args.limit !== null ? all.slice(0, args.limit) : all;
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

async function fetchHotelsViaPg(args: CliArgs): Promise<HotelAuditRow[]> {
  const client = await connectPg();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (args.publishedOnly) conditions.push('is_published = true');
    if (args.slug !== null) {
      params.push(args.slug);
      conditions.push(`slug = $${params.length}`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const limitClause = args.limit !== null ? `limit ${args.limit}` : '';
    const sql = `select ${HOTEL_AUDIT_COLUMNS} from public.hotels ${where} order by slug asc ${limitClause}`;
    const result = await client.query<HotelAuditRow>(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function fetchHotels(args: CliArgs): Promise<HotelAuditRow[]> {
  if (auditForcePostgrest() || !hasPgConnectionString()) {
    return fetchHotelsViaPostgrest(args);
  }
  try {
    return await fetchHotelsViaPg(args);
  } catch (err) {
    if (!isDirectPgUnreachable(err)) throw err;
    warnPgFallback('audit:hotel-fiches', err);
    return fetchHotelsViaPostgrest(args);
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function runsDir(): string {
  return resolve(__dirname, '../../runs');
}

function filterResults(results: HotelAuditResult[], minScore: number | null): HotelAuditResult[] {
  if (minScore === null) return results;
  return results.filter((r) => r.score_t3 < minScore);
}

function topGapsLine(gaps: readonly { field: string }[], n: number): string {
  return gaps
    .slice(0, n)
    .map((g) => g.field)
    .join('|');
}

function toCsvRow(cells: readonly string[]): string {
  return cells
    .map((c) => {
      const escaped = c.replace(/"/gu, '""');
      return `"${escaped}"`;
    })
    .join(',');
}

function writeCsv(path: string, results: readonly HotelAuditResult[]): void {
  const header = [
    'slug',
    'name',
    'is_published',
    'luxury_tier',
    'country_code',
    'status',
    'score_t0',
    'score_t1',
    'score_t3',
    'indexable',
    'gap_count',
    'top_gaps',
  ];
  const lines = [toCsvRow(header)];
  for (const r of results) {
    lines.push(
      toCsvRow([
        r.slug,
        r.name,
        String(r.is_published),
        r.luxury_tier ?? '',
        r.country_code ?? '',
        r.status,
        String(r.score_t0),
        String(r.score_t1),
        String(r.score_t3),
        String(r.indexable),
        String(r.gaps.length),
        topGapsLine(r.gaps, 5),
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

function countByStatus(results: readonly HotelAuditResult[]): StatusCounts {
  const out: StatusCounts = { complete: 0, partial: 0, gap: 0, draft: 0 };
  for (const r of results) {
    out[r.status] += 1;
  }
  return out;
}

function buildSummary(results: readonly HotelAuditResult[]): string {
  const total = results.length;
  const published = results.filter((r) => r.is_published).length;
  const status = countByStatus(results);
  const gapCounts = aggregateGapCounts(results);
  const sortedGaps = [...gapCounts.entries()].sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  lines.push(`=== Hotel fiche editorial audit — ${new Date().toISOString()} ===`);
  lines.push('');
  lines.push(`Total audited     : ${total}`);
  lines.push(`Published         : ${published}`);
  lines.push(`Drafts            : ${total - published}`);
  lines.push('');
  lines.push('── Status (T3 score) ──');
  lines.push(`  complete (≥95%) : ${status.complete}`);
  lines.push(`  partial (70-94%): ${status.partial}`);
  lines.push(`  gap (<70%)      : ${status.gap}`);
  lines.push(`  draft           : ${status.draft}`);
  lines.push('');
  lines.push('── Indexability ──');
  lines.push(`  indexable       : ${results.filter((r) => r.indexable).length}`);
  lines.push(`  noindex path    : ${results.filter((r) => !r.indexable).length}`);
  lines.push('');
  lines.push('── Top 15 gaps (by field) ──');
  for (const [field, count] of sortedGaps.slice(0, 15)) {
    lines.push(`  ${field.padEnd(32)} : ${count}`);
  }
  lines.push('');
  lines.push('── By luxury_tier (gap status) ──');
  const tierMap = new Map<string, { total: number; gap: number }>();
  for (const r of results) {
    const tier = r.luxury_tier ?? '(null)';
    const acc = tierMap.get(tier) ?? { total: 0, gap: 0 };
    acc.total += 1;
    if (r.status === 'gap') acc.gap += 1;
    tierMap.set(tier, acc);
  }
  const tierSorted = [...tierMap.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [tier, stats] of tierSorted.slice(0, 12)) {
    lines.push(`  ${tier.padEnd(28)} : ${stats.gap}/${stats.total} gap`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rows = await fetchHotels(args);
  let results = rows.map((row) => evaluateHotelFiche(row));
  results = filterResults(results, args.minScore);

  const stamp = todayStamp();
  const dir = runsDir();
  mkdirSync(dir, { recursive: true });

  const summary = buildSummary(results);
  console.log(summary);

  if (args.summaryOnly) return;

  const summaryPath = resolve(dir, `hotel-fiche-audit-summary-${stamp}.txt`);
  writeFileSync(summaryPath, summary, 'utf8');
  console.log(`\nSummary → ${summaryPath}`);

  if (args.format === 'json' || args.format === 'both') {
    const jsonPath = resolve(dir, `hotel-fiche-audit-${stamp}.json`);
    const payload = {
      generated_at: new Date().toISOString(),
      total: results.length,
      status_counts: countByStatus(results),
      gap_counts: Object.fromEntries(aggregateGapCounts(results)),
      hotels: results,
    };
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`JSON   → ${jsonPath}`);
  }

  if (args.format === 'csv' || args.format === 'both') {
    const csvPath = resolve(dir, `hotel-fiche-backlog-${stamp}.csv`);
    writeCsv(csvPath, results);
    console.log(`CSV    → ${csvPath}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

export { buildSummary, fetchHotels, filterResults };
