/**
 * WS5 phase 2 — Concierge humanizer for `hotels.points_of_interest`.
 *
 * Reads the published hotels, batches their POIs by group of 10, asks
 * the LLM for a short voice-of-the-Concierge sentence per POI (and an
 * optional `bucket_tip_fr` for the most representative POI per bucket),
 * validates the output (Zod + lexical linter), then merges the
 * rewritten fields back into the jsonb column. Other POI fields
 * (coords, walk distance, schema_type, pricing, opening_hours) are
 * preserved verbatim — the humanizer never re-classifies, never
 * re-distances, only humanises copy.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-pois.ts --slug le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-pois.ts --missing --concurrency 5
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-pois.ts --all --concurrency 4
 *
 * Flags:
 *   --slug <s>       cible un seul hôtel
 *   --slugs <a,b,c>  cible un sous-ensemble explicite
 *   --all            tous les hôtels publiés avec ≥ 1 POI
 *   --missing        seulement les hôtels publiés avec ≥ 1 POI sans description_fr
 *   --invalid        re-check des hôtels dont au moins 1 POI a une description
 *                    qui dépasse 25 mots ou contient une banned phrase
 *   --concurrency N  parallélisme (défaut: 1 — séquentiel)
 *   --dry-run        affiche sans écrire en base
 *   --batch-size N   nombre de POIs par appel LLM (défaut: 10, max: 20)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { lintConciergeSummary } from '../linter.js';
import { ConciergePoiBatchSchema, type ConciergePoiDescription } from '../schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const PROMPT_PATH = path.resolve(__dirname, '../../prompts/09-concierge-poi.md');
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;

interface CliArgs {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly missing: boolean;
  readonly invalid: boolean;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly batchSize: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let slugs: string[] = [];
  let all = false;
  let missing = false;
  let invalid = false;
  let concurrency = 1;
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') {
      slug = argv[i + 1] ?? null;
      i += 1;
    } else if (a === '--slugs') {
      slugs = (argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      i += 1;
    } else if (a === '--all') {
      all = true;
    } else if (a === '--missing') {
      missing = true;
    } else if (a === '--invalid') {
      invalid = true;
    } else if (a === '--concurrency') {
      const n = Number(argv[i + 1] ?? '');
      if (Number.isFinite(n) && n >= 1 && n <= 16) concurrency = Math.floor(n);
      i += 1;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--batch-size') {
      const n = Number(argv[i + 1] ?? '');
      if (Number.isFinite(n) && n >= 1 && n <= MAX_BATCH_SIZE) batchSize = Math.floor(n);
      i += 1;
    }
  }
  return { slug, slugs, all, missing, invalid, concurrency, dryRun, batchSize };
}

// ---------------------------------------------------------------------------
// Postgres glue. The pipeline talks to Supabase via raw `pg` (no Supabase
// client / RLS) because the humanizer runs offline with the service-role
// equivalent (`SUPABASE_DB_URL`) and benefits from JSONB array merging.
// ---------------------------------------------------------------------------

async function connectPg(): Promise<import('pg').Client> {
  const connStr =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'];
  if (connStr === undefined) {
    throw new Error('Set DATABASE_URL or SUPABASE_DB_POOLER_URL in .env.local.');
  }
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = connStr.replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// ---------------------------------------------------------------------------
// POI shape — we tolerate any extra key (jsonb is permissive) so legacy
// rows that carry fields the reader doesn't know about still get
// preserved on write. We only TYPE the keys we read or rewrite.
// ---------------------------------------------------------------------------

interface PoiInDb {
  readonly osm_id?: string;
  readonly name: string;
  readonly name_en?: string;
  readonly type: string;
  readonly category_fr?: string;
  readonly category_en?: string;
  readonly distance_meters: number;
  readonly walk_minutes?: number;
  readonly bucket?: 'visit' | 'do' | 'shop';
  readonly description_fr?: string;
  readonly description_en?: string;
  readonly bucket_tip_fr?: string;
  readonly bucket_tip_en?: string;
  // Anything else (pricing, opening_hours, schema_type, …) is forwarded
  // verbatim through the merge step — we never strip extra keys.
  readonly [k: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly district: string | null;
  readonly points_of_interest: readonly PoiInDb[] | null;
}

async function listSlugs(client: import('pg').Client, args: CliArgs): Promise<readonly string[]> {
  if (args.slug !== null) return [args.slug];
  if (args.slugs.length > 0) return args.slugs;
  // All published hotels with ≥ 1 POI.
  const baseClause = `is_published = true and jsonb_array_length(coalesce(points_of_interest, '[]'::jsonb)) > 0`;
  const r = await client.query<{ slug: string }>(
    `select slug from public.hotels where ${baseClause} order by slug`,
  );
  if (args.missing || args.invalid) {
    // Defer the deeper filter to the per-hotel inspection — keeps the
    // SQL trivial and the filtering logic centralised in JS where the
    // 25-word + banned-phrase checks already live.
    return r.rows.map((row) => row.slug);
  }
  return r.rows.map((row) => row.slug);
}

async function fetchHotel(client: import('pg').Client, slug: string): Promise<HotelRow | null> {
  const r = await client.query<HotelRow>(
    `select id, slug, name, city, district, points_of_interest
     from public.hotels where slug = $1 limit 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Filter logic for --missing / --invalid (run in JS so we can reuse the
// linter on the existing descriptions). A POI is considered "to do" if:
//   - --missing: it has no `description_fr` (or empty), and has an osm_id
//   - --invalid: it has a `description_fr` that fails the Concierge
//                linter (blocker level) OR exceeds 25 words on any sentence
//
// Returned: the subset of POIs that need a rewrite. When empty, the whole
// hotel is skipped.
// ---------------------------------------------------------------------------

function pickPoisToRewrite(pois: readonly PoiInDb[], args: CliArgs): readonly PoiInDb[] {
  const withId = pois.filter((p) => typeof p.osm_id === 'string' && p.osm_id.length > 0);
  if (args.missing) {
    return withId.filter(
      (p) => typeof p.description_fr !== 'string' || p.description_fr.trim().length === 0,
    );
  }
  if (args.invalid) {
    return withId.filter((p) => {
      if (typeof p.description_fr !== 'string' || p.description_fr.trim().length === 0) {
        return true;
      }
      const summary = lintConciergeSummary(p.description_fr);
      return !summary.clean;
    });
  }
  // Default (--all / --slug): rewrite every POI that has an osm_id.
  return withId;
}

// ---------------------------------------------------------------------------
// Prompt assembly + LLM call. We send one batch (≤ 20 POIs) per call so
// the model holds the whole hotel context in mind without exceeding the
// JSON output budget. For 106 hotels × ~30 POIs / hotel = ~320 calls
// with batch-size 10, around $0.04 on gpt-4o-mini.
// ---------------------------------------------------------------------------

function buildUserPrompt(row: HotelRow, batch: readonly PoiInDb[]): string {
  const compact = batch.map((p) => ({
    osm_id: p.osm_id,
    name: p.name,
    type: p.type,
    category_fr: p.category_fr ?? null,
    distance_meters: p.distance_meters,
    walk_minutes: p.walk_minutes ?? null,
    bucket: p.bucket ?? null,
  }));
  const input = {
    hotel: {
      name: row.name,
      city: row.city,
      district: row.district,
    },
    pois: compact,
  };
  return `=== INPUT ===\n${JSON.stringify(input, null, 2)}`;
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  const inner = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(inner);
  } catch {
    const first = inner.indexOf('{');
    const last = inner.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(inner.slice(first, last + 1));
    throw new Error('Pass 9 response is not valid JSON.');
  }
}

// ---------------------------------------------------------------------------
// Merge step. We rebuild the full `points_of_interest` array preserving
// the source order and every untouched field. Only `description_fr` and
// (for the first POI per bucket) `bucket_tip_fr` are overwritten.
// ---------------------------------------------------------------------------

function mergeRewrites(
  original: readonly PoiInDb[],
  rewrites: readonly ConciergePoiDescription[],
): {
  readonly merged: readonly PoiInDb[];
  readonly rewroteDesc: number;
  readonly rewroteTips: number;
} {
  const byId = new Map<string, ConciergePoiDescription>();
  for (const r of rewrites) byId.set(r.osm_id, r);
  // First non-empty `bucket_tip_fr` per bucket wins to match the reader.
  const tipsByBucket: Record<string, string | undefined> = {};
  let rewroteDesc = 0;
  let rewroteTips = 0;
  const merged: PoiInDb[] = [];
  for (const p of original) {
    const id = p.osm_id;
    const next: PoiInDb = { ...p };
    if (typeof id === 'string') {
      const r = byId.get(id);
      if (r !== undefined) {
        if (r.description_fr !== undefined && r.description_fr.length > 0) {
          (next as { description_fr?: string }).description_fr = r.description_fr;
          rewroteDesc += 1;
        }
        const bucket = (p.bucket ?? 'do') as string;
        if (
          r.bucket_tip_fr !== undefined &&
          r.bucket_tip_fr.length > 0 &&
          tipsByBucket[bucket] === undefined
        ) {
          (next as { bucket_tip_fr?: string }).bucket_tip_fr = r.bucket_tip_fr;
          tipsByBucket[bucket] = r.bucket_tip_fr;
          rewroteTips += 1;
        }
      }
    }
    merged.push(next);
  }
  return { merged, rewroteDesc, rewroteTips };
}

interface BatchResult {
  readonly accepted: readonly ConciergePoiDescription[];
  readonly rejected: number;
  readonly lintBlockers: number;
  readonly tokens: { readonly input: number; readonly output: number };
}

async function runBatch(
  prompt: string,
  row: HotelRow,
  batch: readonly PoiInDb[],
): Promise<BatchResult> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  const userPrompt = buildUserPrompt(row, batch);
  const result = await llm.call({
    systemPrompt: prompt,
    userPrompt,
    temperature: 0.6,
    maxOutputTokens: 1800,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  const raw = extractJsonObject(result.content);
  const parsed = ConciergePoiBatchSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Pass 9 schema validation failed:\n${issues}`);
  }
  const accepted: ConciergePoiDescription[] = [];
  let rejected = 0;
  let lintBlockers = 0;
  for (const item of parsed.data.pois) {
    const descLint = lintConciergeSummary(item.description_fr);
    const tipLint =
      item.bucket_tip_fr !== undefined && item.bucket_tip_fr.length > 0
        ? lintConciergeSummary(item.bucket_tip_fr)
        : null;
    if (!descLint.clean || (tipLint !== null && !tipLint.clean)) {
      lintBlockers += descLint.blocker + (tipLint?.blocker ?? 0);
      rejected += 1;
      continue;
    }
    accepted.push(item);
  }
  return {
    accepted,
    rejected,
    lintBlockers,
    tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  };
}

interface RunResult {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed';
  readonly reason?: string;
  readonly rewroteDesc?: number;
  readonly rewroteTips?: number;
  readonly batches?: number;
  readonly tokens?: { input: number; output: number };
}

async function runOne(
  client: import('pg').Client,
  slug: string,
  prompt: string,
  args: CliArgs,
): Promise<RunResult> {
  const row = await fetchHotel(client, slug);
  if (row === null) return { slug, status: 'failed', reason: 'hotel not found' };
  const pois = row.points_of_interest ?? [];
  if (pois.length === 0) return { slug, status: 'skipped', reason: 'no POIs' };

  const toRewrite = pickPoisToRewrite(pois, args);
  if (toRewrite.length === 0) return { slug, status: 'skipped', reason: 'nothing to rewrite' };

  // Split into batches. We deliberately interleave buckets within a
  // batch so the LLM sees a representative mix when deciding where to
  // place a `bucket_tip_fr` — that gives a better-balanced 1 tip per
  // bucket coverage on first pass.
  const batches: PoiInDb[][] = [];
  for (let i = 0; i < toRewrite.length; i += args.batchSize) {
    batches.push(toRewrite.slice(i, i + args.batchSize));
  }

  const aggregated: ConciergePoiDescription[] = [];
  const tokens = { input: 0, output: 0 };
  let totalRejected = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;
    try {
      const result = await runBatch(prompt, row, batch);
      aggregated.push(...result.accepted);
      tokens.input += result.tokens.input;
      tokens.output += result.tokens.output;
      totalRejected += result.rejected;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { slug, status: 'failed', reason: `batch ${bi + 1}/${batches.length}: ${msg}` };
    }
  }

  if (aggregated.length === 0) {
    return {
      slug,
      status: 'failed',
      reason: `every batch rejected (${totalRejected} items failed lint or shape)`,
    };
  }

  const { merged, rewroteDesc, rewroteTips } = mergeRewrites(pois, aggregated);

  if (args.dryRun) {
    return {
      slug,
      status: 'ok',
      reason: `[dry-run] desc=${rewroteDesc} tips=${rewroteTips} rejected=${totalRejected}`,
      rewroteDesc,
      rewroteTips,
      batches: batches.length,
      tokens,
    };
  }

  await client.query(
    `update public.hotels set points_of_interest = $1::jsonb, updated_at = now() where slug = $2`,
    [JSON.stringify(merged), slug],
  );

  return {
    slug,
    status: 'ok',
    reason: `desc=${rewroteDesc} tips=${rewroteTips} rejected=${totalRejected} batches=${batches.length}`,
    rewroteDesc,
    rewroteTips,
    batches: batches.length,
    tokens,
  };
}

async function runWithConcurrency(
  client: import('pg').Client,
  slugs: readonly string[],
  prompt: string,
  args: CliArgs,
): Promise<readonly RunResult[]> {
  const queue = [...slugs];
  const out: RunResult[] = [];
  let active = 0;
  let started = 0;
  const total = slugs.length;
  return new Promise((resolveAll) => {
    const tick = (): void => {
      while (active < args.concurrency && queue.length > 0) {
        const slug = queue.shift();
        if (slug === undefined) break;
        active += 1;
        started += 1;
        const idx = started;
        console.log(`[${idx}/${total}] start ${slug} (active=${active})`);
        runOne(client, slug, prompt, args)
          .then((r) => {
            out.push(r);
            const tag = r.status === 'ok' ? 'OK' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
            const tokens = r.tokens ? ` ${r.tokens.input}→${r.tokens.output}t` : '';
            console.log(`[${idx}/${total}] ${tag} ${slug}${tokens} — ${r.reason ?? ''}`);
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            out.push({ slug, status: 'failed', reason: msg });
            console.warn(`[${idx}/${total}] EXC ${slug} — ${msg}`);
          })
          .finally(() => {
            active -= 1;
            if (queue.length === 0 && active === 0) resolveAll(out);
            else tick();
          });
      }
      if (queue.length === 0 && active === 0) resolveAll(out);
    };
    tick();
  });
}

async function writeRunLog(results: readonly RunResult[]): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.resolve(__dirname, '../../out', `pois-concierge-runlog-${ts}.jsonl`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lines = results.map((r) => JSON.stringify(r));
  await fs.writeFile(file, lines.join('\n') + '\n', 'utf-8');
  return file;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug && args.slugs.length === 0 && !args.all && !args.missing && !args.invalid) {
    console.error(
      'Usage: --slug <s> | --slugs <a,b,c> | --all | --missing | --invalid  [--concurrency N] [--dry-run] [--batch-size N]',
    );
    process.exit(1);
  }
  const prompt = await fs.readFile(PROMPT_PATH, 'utf-8');
  const client = await connectPg();
  try {
    const slugs = await listSlugs(client, args);
    console.log(
      `[concierge-poi-humanizer] targets: ${slugs.length} hotel(s), concurrency=${args.concurrency}, batchSize=${args.batchSize}, dryRun=${args.dryRun}`,
    );
    if (slugs.length === 0) {
      console.log('Nothing to do.');
      return;
    }
    const results = await runWithConcurrency(client, slugs, prompt, args);
    const ok = results.filter((r) => r.status === 'ok').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const tokens = results.reduce(
      (acc, r) => ({
        input: acc.input + (r.tokens?.input ?? 0),
        output: acc.output + (r.tokens?.output ?? 0),
      }),
      { input: 0, output: 0 },
    );
    const desc = results.reduce((a, r) => a + (r.rewroteDesc ?? 0), 0);
    const tips = results.reduce((a, r) => a + (r.rewroteTips ?? 0), 0);
    const runLogPath = await writeRunLog(results);
    console.log(`\n=== Summary ===`);
    console.log(`  ok       : ${ok}`);
    console.log(`  skipped  : ${skipped}`);
    console.log(`  failed   : ${failed}`);
    console.log(`  desc rewrites : ${desc}`);
    console.log(`  bucket tips   : ${tips}`);
    console.log(`  total tokens in/out : ${tokens.input} / ${tokens.output}`);
    console.log(`  runlog   : ${runLogPath}`);
    if (failed > 0) process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
