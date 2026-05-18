/**
 * WS5 phase 3 — Concierge humanizer for `hotels.upcoming_events`.
 *
 * Reads the published hotels with at least one upcoming event, batches
 * their events by group of `--batch-size` (default 5 — matches the 5-event
 * cap of the reader), asks the LLM for one short voice-of-the-Concierge
 * paragraph per event (2–3 sentences, 30–50 mots, ending with a
 * `Mon conseil :` actionable), validates the output (Zod + lexical
 * linter), then merges the rewritten `description_fr` back into the
 * jsonb column. All other event fields (dt_uuid, dates, coords, venue,
 * pricing, url, category) are preserved verbatim.
 *
 * Match key
 * ---------
 * Each event is identified to the LLM via a stable `match_key`:
 *   - DATAtourisme UUID when present (`dt_uuid`),
 *   - otherwise `name|start_date` (the same compound the reader uses to
 *     key React lists when `dt_uuid` is missing).
 * The merge step looks the description back up by the same key.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-events.ts --slug le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-events.ts --missing --concurrency 5
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-events.ts --all --concurrency 4
 *
 * Flags:
 *   --slug <s>       cible un seul hôtel
 *   --slugs <a,b,c>  cible un sous-ensemble explicite
 *   --all            tous les hôtels publiés avec ≥ 1 event
 *   --missing        seulement les hôtels avec ≥ 1 event sans description_fr
 *   --invalid        re-check (lint blocker) des hôtels avec descriptions
 *                    qui dépassent 25 mots ou contiennent une banned phrase
 *   --concurrency N  parallélisme (défaut: 1 — séquentiel)
 *   --dry-run        affiche sans écrire en base
 *   --batch-size N   nombre d'events par appel LLM (défaut: 5, max: 10)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { lintConciergeSummary } from '../linter.js';
import { ConciergeEventBatchSchema, type ConciergeEventDescription } from '../schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const PROMPT_PATH = path.resolve(__dirname, '../../prompts/10-concierge-event.md');
const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;

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
  let slugs: readonly string[] = [];
  let all = false;
  let missing = false;
  let invalid = false;
  let concurrency = 1;
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--slug' && i + 1 < argv.length) {
      slug = argv[i + 1] ?? null;
      i += 2;
    } else if (a === '--slugs' && i + 1 < argv.length) {
      slugs = (argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 2;
    } else if (a === '--all') {
      all = true;
      i += 1;
    } else if (a === '--missing') {
      missing = true;
      i += 1;
    } else if (a === '--invalid') {
      invalid = true;
      i += 1;
    } else if (a === '--concurrency' && i + 1 < argv.length) {
      concurrency = Math.max(1, Number.parseInt(argv[i + 1] ?? '1', 10) || 1);
      i += 2;
    } else if (a === '--batch-size' && i + 1 < argv.length) {
      const raw = Number.parseInt(argv[i + 1] ?? `${DEFAULT_BATCH_SIZE}`, 10) || DEFAULT_BATCH_SIZE;
      batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, raw));
      i += 2;
    } else if (a === '--dry-run') {
      dryRun = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return { slug, slugs, all, missing, invalid, concurrency, dryRun, batchSize };
}

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
// Event shape — tolerate any extra key (jsonb is permissive) so legacy
// rows still get preserved on write. We only TYPE the keys we read /
// rewrite.
// ---------------------------------------------------------------------------

interface EventInDb {
  readonly name: string;
  readonly start_date: string;
  readonly end_date?: string | null;
  readonly venue_name?: string | null;
  readonly venue_address?: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly distance_meters: number;
  readonly category: string;
  readonly description_fr?: string | null;
  readonly description_en?: string | null;
  readonly pricing?: {
    readonly type?: 'free' | 'paid';
    readonly amount_eur?: number | null;
  } | null;
  readonly url?: string | null;
  readonly dt_uuid?: string | null;
  readonly [k: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly district: string | null;
  readonly upcoming_events: readonly EventInDb[] | null;
}

function matchKey(e: EventInDb): string {
  if (typeof e.dt_uuid === 'string' && e.dt_uuid.length > 0) return e.dt_uuid;
  return `${e.name}|${e.start_date}`;
}

async function listSlugs(client: import('pg').Client, args: CliArgs): Promise<readonly string[]> {
  if (args.slug !== null) return [args.slug];
  if (args.slugs.length > 0) return args.slugs;
  const baseClause = `is_published = true and jsonb_array_length(coalesce(upcoming_events, '[]'::jsonb)) > 0`;
  const r = await client.query<{ slug: string }>(
    `select slug from public.hotels where ${baseClause} order by slug`,
  );
  return r.rows.map((row) => row.slug);
}

async function fetchHotel(client: import('pg').Client, slug: string): Promise<HotelRow | null> {
  const r = await client.query<HotelRow>(
    `select id, slug, name, city, district, upcoming_events
     from public.hotels where slug = $1 limit 1`,
    [slug],
  );
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Stale-event filter — we ignore events whose end_date (or start_date for
// single-day events) is already in the past. Mirrors `readUpcomingEvents`
// so we never spend tokens on an event that will be hidden on the page.
// ---------------------------------------------------------------------------

function isUpcoming(e: EventInDb, todayIso: string): boolean {
  const lastDay = e.end_date ?? e.start_date ?? '0000-01-01';
  return lastDay >= todayIso;
}

function pickEventsToRewrite(
  events: readonly EventInDb[],
  args: CliArgs,
  todayIso: string,
): readonly EventInDb[] {
  const upcoming = events.filter((e) => isUpcoming(e, todayIso));
  if (args.missing) {
    return upcoming.filter(
      (e) => typeof e.description_fr !== 'string' || e.description_fr.trim().length === 0,
    );
  }
  if (args.invalid) {
    return upcoming.filter((e) => {
      if (typeof e.description_fr !== 'string' || e.description_fr.trim().length === 0) {
        return true;
      }
      const summary = lintConciergeSummary(e.description_fr);
      return !summary.clean;
    });
  }
  return upcoming;
}

// ---------------------------------------------------------------------------
// Prompt assembly + LLM call.
// ---------------------------------------------------------------------------

function buildUserPrompt(row: HotelRow, batch: readonly EventInDb[]): string {
  const compact = batch.map((e) => ({
    match_key: matchKey(e),
    name: e.name,
    category: e.category,
    start_date: e.start_date,
    end_date: e.end_date ?? null,
    venue_name: e.venue_name ?? null,
    distance_meters: e.distance_meters,
    pricing:
      e.pricing && typeof e.pricing === 'object'
        ? {
            type: e.pricing.type ?? null,
            amount_eur: e.pricing.amount_eur ?? null,
          }
        : null,
    url: e.url ?? null,
  }));
  const input = {
    hotel: {
      name: row.name,
      city: row.city,
      district: row.district,
    },
    events: compact,
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
    throw new Error('Pass 10 response is not valid JSON.');
  }
}

// ---------------------------------------------------------------------------
// Merge step. We rebuild the full `upcoming_events` array preserving the
// source order and every untouched field. Only `description_fr` is
// overwritten on events whose match_key was returned by the LLM (and
// passed lint).
// ---------------------------------------------------------------------------

function mergeRewrites(
  original: readonly EventInDb[],
  rewrites: readonly ConciergeEventDescription[],
): { readonly merged: readonly EventInDb[]; readonly rewroteDesc: number } {
  const byKey = new Map<string, ConciergeEventDescription>();
  for (const r of rewrites) byKey.set(r.match_key, r);
  let rewroteDesc = 0;
  const merged: EventInDb[] = [];
  for (const e of original) {
    const key = matchKey(e);
    const next: EventInDb = { ...e };
    const r = byKey.get(key);
    if (r !== undefined && r.description_fr.length > 0) {
      (next as { description_fr?: string }).description_fr = r.description_fr;
      rewroteDesc += 1;
    }
    merged.push(next);
  }
  return { merged, rewroteDesc };
}

interface BatchResult {
  readonly accepted: readonly ConciergeEventDescription[];
  readonly rejected: number;
  readonly lintBlockers: number;
  readonly tokens: { readonly input: number; readonly output: number };
}

async function runBatch(
  prompt: string,
  row: HotelRow,
  batch: readonly EventInDb[],
): Promise<BatchResult> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  const userPrompt = buildUserPrompt(row, batch);
  const result = await llm.call({
    systemPrompt: prompt,
    userPrompt,
    temperature: 0.6,
    maxOutputTokens: 1500,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  const raw = extractJsonObject(result.content);
  const parsed = ConciergeEventBatchSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Pass 10 schema validation failed:\n${issues}`);
  }
  const accepted: ConciergeEventDescription[] = [];
  let rejected = 0;
  let lintBlockers = 0;
  for (const item of parsed.data.events) {
    const lint = lintConciergeSummary(item.description_fr);
    if (!lint.clean) {
      lintBlockers += lint.blocker;
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
  const events = row.upcoming_events ?? [];
  if (events.length === 0) return { slug, status: 'skipped', reason: 'no events' };

  const todayIso = new Date().toISOString().slice(0, 10);
  const toRewrite = pickEventsToRewrite(events, args, todayIso);
  if (toRewrite.length === 0) return { slug, status: 'skipped', reason: 'nothing to rewrite' };

  const batches: EventInDb[][] = [];
  for (let i = 0; i < toRewrite.length; i += args.batchSize) {
    batches.push(toRewrite.slice(i, i + args.batchSize));
  }

  const aggregated: ConciergeEventDescription[] = [];
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

  const { merged, rewroteDesc } = mergeRewrites(events, aggregated);

  if (args.dryRun) {
    return {
      slug,
      status: 'ok',
      reason: `[dry-run] desc=${rewroteDesc} rejected=${totalRejected}`,
      rewroteDesc,
      batches: batches.length,
      tokens,
    };
  }

  await client.query(
    `update public.hotels set upcoming_events = $1::jsonb, updated_at = now() where slug = $2`,
    [JSON.stringify(merged), slug],
  );

  return {
    slug,
    status: 'ok',
    reason: `desc=${rewroteDesc} rejected=${totalRejected} batches=${batches.length}`,
    rewroteDesc,
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
  const dir = path.resolve(__dirname, '../../out');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `events-concierge-runlog-${ts}.jsonl`);
  const body = results.map((r) => JSON.stringify(r)).join('\n');
  await fs.writeFile(filePath, body + '\n', 'utf8');
  return filePath;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (
    !args.all &&
    !args.missing &&
    !args.invalid &&
    args.slug === null &&
    args.slugs.length === 0
  ) {
    console.error(
      'Usage: --slug <s> | --slugs <a,b,c> | --all | --missing | --invalid  [--concurrency N] [--dry-run] [--batch-size N]',
    );
    process.exit(2);
  }
  const prompt = await fs.readFile(PROMPT_PATH, 'utf8');
  const client = await connectPg();
  try {
    const slugs = await listSlugs(client, args);
    console.log(
      `[concierge-event-humanizer] targets: ${slugs.length} hotel(s), concurrency=${args.concurrency}, batchSize=${args.batchSize}, dryRun=${args.dryRun}`,
    );
    if (slugs.length === 0) {
      console.log('Nothing to do.');
      return;
    }
    const results = await runWithConcurrency(client, slugs, prompt, args);
    const ok = results.filter((r) => r.status === 'ok').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const desc = results.reduce((s, r) => s + (r.rewroteDesc ?? 0), 0);
    const tokens = results.reduce(
      (s, r) => ({
        input: s.input + (r.tokens?.input ?? 0),
        output: s.output + (r.tokens?.output ?? 0),
      }),
      { input: 0, output: 0 },
    );
    const runLogPath = await writeRunLog(results);
    console.log(`\n=== Summary ===`);
    console.log(`  ok       : ${ok}`);
    console.log(`  skipped  : ${skipped}`);
    console.log(`  failed   : ${failed}`);
    console.log(`  desc rewrites : ${desc}`);
    console.log(`  total tokens in/out : ${tokens.input} / ${tokens.output}`);
    console.log(`  runlog   : ${runLogPath}`);
    if (failed > 0) process.exitCode = 2;
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
