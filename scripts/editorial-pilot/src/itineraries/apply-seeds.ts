#!/usr/bin/env tsx
/**
 * Apply every `itineraries/seed/*.sql` UPSERT to a Supabase project via
 * the `_exec_itinerary_seed_b64` RPC (migration 0050 — base64 variant).
 *
 * Three apply paths exist now, pick the one that matches your context :
 *
 *   1. **Agent loop via MCP + GitHub fetch** (migrations 0053+0054).
 *      - Enqueue via `select net.http_get('https://raw.githubusercontent.com/.../seed/<slug>.sql')`.
 *      - Wait a few seconds for pg_net.
 *      - Apply each with `select public.apply_itinerary_from_response(<slug>, <request_id>)`.
 *      - Best for the agent loop because each MCP call is ~150 chars
 *        instead of 30 KB of inlined SQL/base64.
 *      - Requires the seed file to be pushed to GitHub `main`.
 *
 *   2. **CI / scripted via this file + b64 RPC** (migration 0050).
 *      - This script reads each seed from disk, base64-encodes it,
 *        and POSTs to `_exec_itinerary_seed_b64`.
 *      - Best for cron / deploy / disaster recovery jobs that have
 *        the `SUPABASE_SERVICE_ROLE_KEY` available.
 *      - Auth file : `apps/web/.env.itineraries-import.local` (created
 *        via `vercel env pull --environment=production`, gitignored).
 *
 *   3. **Direct MCP + inline SQL** (migration 0049).
 *      - `select public._exec_itinerary_seed(<raw sql>)`.
 *      - Avoid for the agent loop — 30 KB of SQL inlined into a tool
 *        call args is too easy to corrupt during LLM generation
 *        (regenerate-from-context drift).
 *
 * All three paths land on the same allowlist `INSERT INTO
 * public.itineraries` safety contract at the DB boundary.
 *
 * Usage of this script :
 *   pnpm itineraries:apply              # all 20 (UPSERTs, idempotent)
 *   pnpm itineraries:apply --slug=reims-champagne-week-end
 *   pnpm itineraries:apply --dry-run    # parse only, no POST
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../');

// Vercel pull dropped the file inside apps/web/. We don't move it so
// `vercel env pull` stays idempotent next time.
const envPath = join(repoRoot, 'apps/web/.env.itineraries-import.local');
if (!existsSync(envPath)) {
  console.error(`Missing env file: ${envPath}`);
  console.error(
    'Run: cd apps/web && npx vercel env pull .env.itineraries-import.local --environment=production',
  );
  process.exit(1);
}
loadDotenv({ path: envPath });

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from env.');
  process.exit(1);
}

const SEED_DIR = join(__dirname, '../../itineraries/seed');
const PARIS_SLUG = 'paris-luxe-3-jours';

function parseFlag(args: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  for (const a of args) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return null;
}

interface ApplyResult {
  readonly slug: string;
  readonly status: 'ok' | 'http_error' | 'rpc_error';
  readonly elapsedMs: number;
  readonly httpStatus?: number;
  readonly message?: string;
}

async function applyOne(slug: string, sql: string, dryRun: boolean): Promise<ApplyResult> {
  const t0 = Date.now();
  if (dryRun) {
    return {
      slug,
      status: 'ok',
      elapsedMs: Date.now() - t0,
      message: `[dry-run] ${sql.length} bytes`,
    };
  }
  const url = `${SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/rpc/_exec_itinerary_seed`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ p_sql: sql }),
    });
  } catch (err) {
    return {
      slug,
      status: 'http_error',
      elapsedMs: Date.now() - t0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const elapsedMs = Date.now() - t0;
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    return {
      slug,
      status: 'rpc_error',
      elapsedMs,
      httpStatus: res.status,
      message: body.slice(0, 400),
    };
  }
  return { slug, status: 'ok', elapsedMs, httpStatus: res.status };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slugFilter = parseFlag(args, 'slug');
  const dryRun = args.includes('--dry-run');

  if (!existsSync(SEED_DIR)) {
    console.error(`Seed dir not found: ${SEED_DIR}`);
    process.exit(1);
  }
  let slugs = readdirSync(SEED_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/u, ''))
    .filter((s) => s !== PARIS_SLUG) // Already published, hand-tuned.
    .sort();
  if (slugFilter !== null) {
    slugs = slugs.filter((s) => s === slugFilter);
    if (slugs.length === 0) {
      console.error(`Slug "${slugFilter}" not found in seed dir.`);
      process.exit(1);
    }
  }

  console.error(`Applying ${slugs.length} seed(s) — target=${SUPABASE_URL}, dryRun=${dryRun}.`);

  const results: ApplyResult[] = [];
  for (const slug of slugs) {
    process.stderr.write(`  · ${slug.padEnd(45)} `);
    const sql = readFileSync(join(SEED_DIR, `${slug}.sql`), 'utf8');
    const r = await applyOne(slug, sql, dryRun);
    results.push(r);
    if (r.status === 'ok') {
      process.stderr.write(`OK (${(r.elapsedMs / 1000).toFixed(1)}s)\n`);
    } else {
      process.stderr.write(
        `${r.status.toUpperCase()} http=${r.httpStatus ?? '-'} (${(r.elapsedMs / 1000).toFixed(1)}s)\n      ${r.message}\n`,
      );
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.length - ok;
  console.error(`\n${ok}/${results.length} seed(s) applied (${failed} failed).`);
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
