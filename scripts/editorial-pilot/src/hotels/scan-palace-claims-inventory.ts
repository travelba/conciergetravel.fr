/**
 * Fresh palace-claims inventory scanner (Sweep B — PO GO 2026-07-03).
 *
 * The 2026-07-02 inventory (507 findings) is fully remediated and idempotent.
 * This scanner rebuilds the inventory from the LIVE catalogue by running every
 * hotel through the patcher's own `buildPlan` — zero detector drift: a hotel
 * is a finding if and only if `patch-dataseo-p0-hotels.ts` would change it.
 * Official Palaces (`is_palace=true`) are recorded but excluded from findings,
 * mirroring the patcher's own guard.
 *
 * Output: `runs/palace-claims-inventory-<ts>.json` in the exact shape the
 * patcher's `--inventory` flag consumes ({ findings: [{ slug, official }] }).
 *
 * Read-only. PostgREST only (chunked fetch, 50 slugs/chunk).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { buildPlan, fetchRowsChunked } from './patch-dataseo-p0-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const SlugRowSchema = z.object({ slug: z.string(), is_palace: z.boolean().nullable() });

async function fetchAllSlugs(
  url: string,
  key: string,
): Promise<{ slug: string; is_palace: boolean | null }[]> {
  const rows: { slug: string; is_palace: boolean | null }[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const endpoint = new URL('/rest/v1/hotels', url);
    endpoint.searchParams.set('select', 'slug,is_palace');
    endpoint.searchParams.set('order', 'slug.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok)
      throw new Error(`SELECT slugs failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const page = z.array(SlugRowSchema).parse(await res.json());
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const all = await fetchAllSlugs(url, env.SUPABASE_SERVICE_ROLE_KEY);
  const officials = all.filter((r) => r.is_palace === true).map((r) => r.slug);
  const candidates = all.filter((r) => r.is_palace !== true).map((r) => r.slug);
  console.log(
    `[scan-palace-inventory] hotels=${all.length} officialPalaces=${officials.length} candidates=${candidates.length}`,
  );

  const findings: { slug: string; official: boolean; reasons: string[] }[] = [];
  let scanned = 0;
  const CHUNK = 200;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const rows = await fetchRowsChunked(
      url,
      env.SUPABASE_SERVICE_ROLE_KEY,
      candidates.slice(i, i + CHUNK),
    );
    for (const row of rows) {
      scanned += 1;
      const plan = buildPlan(row);
      if (plan.changes.length > 0) {
        findings.push({
          slug: row.slug,
          official: false,
          reasons: [...new Set(plan.changes.map((c) => c.reason))],
        });
      }
    }
    console.log(`  scanned=${scanned}/${candidates.length} findings=${findings.length}`);
  }

  const generatedAt = new Date().toISOString();
  const out = resolve(
    RUNS_DIR,
    `palace-claims-inventory-${generatedAt.replace(/[:.]/gu, '-')}.json`,
  );
  await mkdir(RUNS_DIR, { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      { generatedAt, total: all.length, officialPalaces: officials, findings },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`[scan-palace-inventory] findings=${findings.length} → ${out}`);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[scan-palace-inventory] FATAL', err);
    process.exit(1);
  });
}
