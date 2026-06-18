/**
 * audit-wave.ts — Gate 1 (content) in batch over a wave of hotels.
 *
 * Master plan §6 (docs/runbooks/PROJET-MASTER-PLAN.md): every wave of the
 * R2 mass deployment must pass the 4 gates. This CLI is the batch runner
 * for the *content* half of Gate 1 — it loads a list of slugs, evaluates
 * `evaluateWaveGates` per hotel (publish, indexable, T3, geo_qa, no-leak),
 * and writes a pass/fail wave report.
 *
 * The code half of Gate 1 (typecheck / lint / unit / build) is run
 * separately by the toolchain; this runner focuses on per-row content
 * conformance so a wave's readiness is a single command + a single report.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot audit:wave -- --slugs=les-airelles-gordes,le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot audit:wave -- --file=runs/wave-paris.txt --wave=paris
 *   pnpm --filter @mch/editorial-pilot audit:wave -- --published-only --limit=200 --wave=sample
 *   pnpm --filter @mch/editorial-pilot audit:wave -- --slugs=... --lenient-geo   # geo_qa = warn
 *
 * Outputs:
 *   scripts/editorial-pilot/runs/wave-<label>-YYYY-MM-DD.json
 *   scripts/editorial-pilot/runs/wave-<label>-YYYY-MM-DD.txt
 *
 * Exit code: 1 when any selected hotel fails a Gate 1 blocker (so the wave
 * runner / CI can hard-stop), 0 when the whole wave is green.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import {
  auditForcePostgrest,
  hasPgConnectionString,
  isDirectPgUnreachable,
  warnPgFallback,
} from '../hotels/audit-pg-fallback.js';
import {
  aggregateWave,
  evaluateWaveGates,
  type WaveGateResult,
  type WaveHotelRow,
} from './wave-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const WAVE_COLUMNS =
  'slug,name,is_published,luxury_tier,country_code,priority,updated_at,description_fr,description_en,meta_title_fr,meta_title_en,meta_desc_fr,meta_desc_en,factual_summary_fr,factual_summary_en,concierge_advice,faq_content,faq_content_kit,concierge_questions,long_description_sections,highlights,amenities,points_of_interest,transports,restaurant_info,spa_info,policies,awards,affiliations,signature_experiences,number_of_rooms,opened_at,official_url,wikidata_id,hero_image,gallery_images,geo_qa';

/**
 * Slugs whose LIVE page is built from a hardcoded golden fixture
 * (`apps/web/src/server/hotels/kit/patch-kit-golden-row.ts` → `GOLDEN_BUILDERS`),
 * NOT from the Supabase row. For these, this DB-driven audit can report a
 * green Gate 1 while the rendered page diverges (e.g. FR-only fixture on an
 * EN page). 2026-06 RFICHE incident: A–E landed in the DB, the audit went
 * green, but `les-airelles-gordes` kept rendering the FR fixture until the
 * golden patch was disabled for it.
 *
 * Keep in sync with `GOLDEN_BUILDERS` (apps/web) and `DB_DRIVEN_KIT_SLUGS`.
 * `les-airelles-gordes` (+ `-en`) was migrated to a DB-driven render, so it
 * is intentionally absent here.
 */
const GOLDEN_FIXTURE_SLUGS: ReadonlySet<string> = new Set([
  'les-airelles-courchevel',
  'prince-de-galles-paris',
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-pres-deugenie',
  'shangri-la-paris',
  'conrad-los-angeles',
]);

interface CliArgs {
  readonly slugs: readonly string[] | null;
  readonly publishedOnly: boolean;
  readonly limit: number | null;
  readonly waveLabel: string;
  readonly strictGeoQa: boolean;
}

function readSlugFile(path: string): string[] {
  const abs = resolve(process.cwd(), path);
  const raw = readFileSync(abs, 'utf8');
  return raw
    .split(/[\s,]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#'));
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] | null = null;
  let publishedOnly = false;
  let limit: number | null = null;
  let waveLabel = 'wave';
  let strictGeoQa = true;

  for (const a of argv) {
    if (a === '--published-only') publishedOnly = true;
    else if (a === '--lenient-geo') strictGeoQa = false;
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--file=')) {
      slugs = readSlugFile(a.slice('--file='.length));
    } else if (a.startsWith('--wave=')) {
      waveLabel = a.slice('--wave='.length).replace(/[^a-z0-9_-]/giu, '-') || 'wave';
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { slugs, publishedOnly, limit, waveLabel, strictGeoQa };
}

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

async function fetchViaPostgrest(args: CliArgs): Promise<WaveHotelRow[]> {
  const env = loadPostgrestEnv();
  const params = new URLSearchParams();
  params.set('select', WAVE_COLUMNS);
  if (args.publishedOnly) params.set('is_published', 'eq.true');
  if (args.slugs !== null) params.set('slug', `in.(${args.slugs.join(',')})`);
  params.set('order', 'slug.asc');
  if (args.limit !== null) params.set('limit', String(args.limit));

  const PAGE = 1000;
  const all: WaveHotelRow[] = [];
  let from = 0;
  while (true) {
    const url = `${env.restBase}/hotels?${params.toString()}`;
    const r = await fetch(url, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) {
      throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const batch = (await r.json()) as WaveHotelRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (args.limit !== null && all.length >= args.limit) break;
    from += PAGE;
  }
  return args.limit !== null ? all.slice(0, args.limit) : all;
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

async function fetchViaPg(args: CliArgs): Promise<WaveHotelRow[]> {
  const client = await connectPg();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (args.publishedOnly) conditions.push('is_published = true');
    if (args.slugs !== null) {
      params.push(args.slugs);
      conditions.push(`slug = any($${params.length})`);
    }
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const limitClause = args.limit !== null ? `limit ${args.limit}` : '';
    const sql = `select ${WAVE_COLUMNS} from public.hotels ${where} order by slug asc ${limitClause}`;
    const result = await client.query<WaveHotelRow>(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function fetchRows(args: CliArgs): Promise<WaveHotelRow[]> {
  if (auditForcePostgrest() || !hasPgConnectionString()) {
    return fetchViaPostgrest(args);
  }
  try {
    return await fetchViaPg(args);
  } catch (err) {
    if (!isDirectPgUnreachable(err)) throw err;
    warnPgFallback('audit:wave', err);
    return fetchViaPostgrest(args);
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function runsDir(): string {
  return resolve(__dirname, '../../runs');
}

function buildTextReport(
  waveLabel: string,
  results: readonly WaveGateResult[],
  agg: ReturnType<typeof aggregateWave>,
): string {
  const lines: string[] = [];
  lines.push(`Wave Gate 1 report — ${waveLabel} — ${new Date().toISOString()}`);
  lines.push(
    `Total ${agg.total} · passed ${agg.passed} · failed ${agg.failed} · pass rate ${(agg.passRate * 100).toFixed(1)}%`,
  );
  lines.push('');
  const fixtureSlugs = results.map((r) => r.slug).filter((s) => GOLDEN_FIXTURE_SLUGS.has(s));
  if (fixtureSlugs.length > 0) {
    lines.push(
      `⚠ FIXTURE-DRIVEN RENDER — ${fixtureSlugs.length} slug(s) below render from a hardcoded`,
    );
    lines.push('  golden fixture (patch-kit-golden-row.ts), NOT from this DB row. A green Gate 1');
    lines.push('  here does NOT prove the live page is correct — walk them in a browser (FR+EN)');
    lines.push('  or migrate them to a DB-driven render before trusting this report:');
    for (const s of fixtureSlugs) lines.push(`    · ${s}`);
    lines.push('');
  }
  lines.push('Fail-by-check (blockers):');
  const checkIds = Object.keys(agg.failByCheck).sort();
  if (checkIds.length === 0) {
    lines.push('  (none — wave is green)');
  } else {
    for (const id of checkIds) lines.push(`  ${id}: ${agg.failByCheck[id]}`);
  }
  lines.push('');
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push('Failures (per hotel):');
    for (const r of failures) {
      const failed = r.checks
        .filter((c) => c.severity === 'blocker' && !c.passed)
        .map((c) => c.detail)
        .join(' | ');
      lines.push(`  ✗ ${r.slug} — ${failed}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.slugs !== null && args.slugs.length === 0) {
    throw new Error('Empty slug list — pass --slugs=a,b or --file=path, or --published-only.');
  }

  const rows = await fetchRows(args);
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No hotels matched the wave selection.');
    process.exit(1);
  }

  const results = rows.map((row) => evaluateWaveGates(row, { strictGeoQa: args.strictGeoQa }));
  const agg = aggregateWave(results);

  const dir = runsDir();
  mkdirSync(dir, { recursive: true });
  const stamp = todayStamp();
  const jsonPath = resolve(dir, `wave-${args.waveLabel}-${stamp}.json`);
  const txtPath = resolve(dir, `wave-${args.waveLabel}-${stamp}.txt`);

  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        wave: args.waveLabel,
        generatedAt: new Date().toISOString(),
        strictGeoQa: args.strictGeoQa,
        fixtureDrivenSlugs: results.map((r) => r.slug).filter((s) => GOLDEN_FIXTURE_SLUGS.has(s)),
        aggregate: agg,
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const textReport = buildTextReport(args.waveLabel, results, agg);
  writeFileSync(txtPath, textReport, 'utf8');

  // eslint-disable-next-line no-console
  console.log(textReport);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${jsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${txtPath}`);

  process.exit(agg.failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
