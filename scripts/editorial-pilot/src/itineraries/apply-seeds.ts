#!/usr/bin/env tsx
/**
 * Apply every `itineraries/seed/*.sql` UPSERT to the live Supabase
 * project via the `_exec_itinerary_seed` RPC (migration 0049).
 *
 * Why not the agent-side `execute_sql` MCP tool ? The 19 LLM-generated
 * UPSERTs are each ~25-35 KB of escaped JSONB and arrays. Submitting
 * them one-by-one through the MCP would mean 19 long round-trips with
 * fragile JSON escaping per call. This script reads the files from
 * disk and POSTs them to PostgREST, keeping the agent loop fast.
 *
 * Auth :
 *   - Reads `apps/web/.env.itineraries-import.local` (created via
 *     `vercel env pull --environment=production`). The file is
 *     gitignored and lives outside the repo's normal env path.
 *   - Uses `SUPABASE_SERVICE_ROLE_KEY` for the RPC. The RPC itself
 *     is locked to `INSERT INTO public.itineraries` only (see 0049).
 *
 * Usage :
 *   pnpm itineraries:apply              # all 19 (paris stays as-is)
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
