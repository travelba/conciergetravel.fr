/**
 * scale-published-stubs.ts — build briefs for every hotel published in
 * Supabase that lacks long_description_sections / signature_experiences /
 * FAQ ≥ 10 (i.e. the "stub" rows imported from the catalogue but never
 * pushed through the editorial pipeline).
 *
 * Why a separate scaler? `scale-build-briefs.ts` consumes a discovery
 * dump from DATAtourisme palaces. The bulk of our gap is non-palace
 * 5★ that were imported as catalogue stubs. We pull them directly
 * from the Supabase hotels table and feed `build-brief.ts` the (slug,
 * query, dept) triple.
 *
 * Why not use `--uuid <datatourisme>`? Most stubs aren't in
 * DATAtourisme — they came from the Atout France 5★ list + manual
 * imports. We use the name+dept search path and gracefully fall
 * through to `--no-datatourisme` (manual HotelCore) when the LLM
 * can't find a 0.8+ name match.
 *
 * Usage:
 *   pnpm exec tsx src/enrichment/scale-published-stubs.ts            (build all stubs)
 *   pnpm exec tsx src/enrichment/scale-published-stubs.ts --limit 5  (smoke)
 *   pnpm exec tsx src/enrichment/scale-published-stubs.ts --dry-run  (print list, no spawn)
 *   pnpm exec tsx src/enrichment/scale-published-stubs.ts --slug=hotel-x --slug=hotel-y
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

const BRIEFS_DIR = resolve(process.cwd(), 'briefs-auto');
const RUNLOG_DIR = resolve(process.cwd(), 'out');
mkdirSync(RUNLOG_DIR, { recursive: true });
const RUNLOG = resolve(RUNLOG_DIR, `briefs-runlog-${new Date().toISOString().slice(0, 10)}.jsonl`);

interface Hotel {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly postal_code: string | null;
  readonly is_palace: boolean;
  readonly atout_france_id: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly address: string | null;
  readonly official_url: string | null;
  readonly wikidata_id: string | null;
}

interface CliArgs {
  readonly limit: number;
  readonly dryRun: boolean;
  readonly explicitSlugs: readonly string[];
  readonly skipExisting: boolean;
  readonly concurrency: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let skipExisting = true;
  let concurrency = 1;
  const explicitSlugs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i] ?? '';
    if (t === '--dry-run') dryRun = true;
    else if (t === '--no-skip') skipExisting = false;
    else if (t.startsWith('--limit=')) limit = Number(t.split('=')[1]);
    else if (t === '--limit') limit = Number(argv[++i]);
    else if (t.startsWith('--concurrency=')) concurrency = Number(t.split('=')[1]);
    else if (t === '--concurrency') concurrency = Number(argv[++i]);
    else if (t.startsWith('--slug=')) explicitSlugs.push(t.split('=')[1] ?? '');
    else if (t === '--slug') explicitSlugs.push(argv[++i] ?? '');
  }
  return { limit, dryRun, explicitSlugs, skipExisting, concurrency };
}

// Parse .env.local — see Rule 7 in `.cursor/skills/windows-dev-environment/SKILL.md`
function loadEnv(): Record<string, string> {
  const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
  const env: Record<string, string> = {};
  for (const raw of envText.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? '').trim();
    const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
    v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
    env[m[1] ?? ''] = v;
  }
  return env;
}

function inseeFromPostal(pc: string | null): string | null {
  if (!pc) return null;
  // FR overseas: 971-976, 977 (St-Barth), 978 (St-Martin). 5-digit codes: take first 2.
  if (/^9[78]\d{3}$/.test(pc)) return pc.slice(0, 3);
  return pc.slice(0, 2);
}

async function listStubs(): Promise<readonly Hotel[]> {
  const env = loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const connStr = (env.SUPABASE_DB_POOLER_URL ?? env.SUPABASE_DB_URL ?? '').replace(
    /\?sslmode=require/,
    '',
  );
  const { Client } = pg;
  const cli = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await cli.connect();
  // A "stub" = published hotel that EITHER:
  //  - has no long_description_sections AND no signature_experiences (never went through pipeline), OR
  //  - has < 10 FAQ entries (CDC §2 hard rule violation).
  // Order: palaces first (highest revenue per visitor), then 5★ non-palace
  // sorted by city to keep DATAtourisme dept-crawl reuse efficient.
  const { rows } = await cli.query(`
    select slug, name, city, postal_code, is_palace, atout_france_id, latitude, longitude,
           address, official_url, wikidata_id
    from hotels
    where is_published = true
      and (
        jsonb_array_length(coalesce(long_description_sections, '[]'::jsonb)) = 0
        or jsonb_array_length(coalesce(signature_experiences, '[]'::jsonb)) = 0
        or jsonb_array_length(coalesce(faq_content, '[]'::jsonb)) < 10
      )
    order by is_palace desc, city asc, name asc
  `);
  await cli.end();
  return rows as readonly Hotel[];
}

function runBuildBrief(
  hotel: Hotel,
): Promise<{ ok: boolean; error?: string; mode: 'dt' | 'manual' }> {
  return new Promise((res) => {
    const dept = inseeFromPostal(hotel.postal_code);
    const isWin = process.platform === 'win32';
    const safeQuery = isWin ? `"${hotel.name.replace(/"/g, '\\"')}"` : hotel.name;
    const args = ['exec', 'tsx', 'src/enrichment/build-brief.ts', hotel.slug, '--query', safeQuery];
    if (dept) args.push('--dept', dept);
    if (hotel.is_palace) args.push('--force-palace');
    const child = spawn('pnpm', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: isWin,
      windowsVerbatimArguments: isWin,
    });
    child.on('error', (e) => res({ ok: false, error: e.message, mode: 'dt' }));
    child.on('exit', (code) =>
      res(code === 0 ? { ok: true, mode: 'dt' } : { ok: false, error: `exit ${code}`, mode: 'dt' }),
    );
  });
}

function runBuildBriefManual(
  hotel: Hotel,
): Promise<{ ok: boolean; error?: string; mode: 'manual' }> {
  return new Promise((res) => {
    if (hotel.latitude === null || hotel.longitude === null) {
      res({ ok: false, error: 'no GPS', mode: 'manual' });
      return;
    }
    const isWin = process.platform === 'win32';
    const safe = (v: string) => (isWin ? `"${v.replace(/"/g, '\\"')}"` : v);
    const args = [
      'exec',
      'tsx',
      'src/enrichment/build-brief-manual.ts',
      hotel.slug,
      '--name',
      safe(hotel.name),
      '--city',
      safe(hotel.city),
      '--postal',
      hotel.postal_code ?? '',
      '--address',
      safe(hotel.address ?? hotel.city),
      '--lat',
      String(hotel.latitude),
      '--lng',
      String(hotel.longitude),
    ];
    if (hotel.official_url) args.push('--website', hotel.official_url);
    if (hotel.wikidata_id) args.push('--qid', hotel.wikidata_id);
    const child = spawn('pnpm', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: isWin,
      windowsVerbatimArguments: isWin,
    });
    child.on('error', (e) => res({ ok: false, error: e.message, mode: 'manual' }));
    child.on('exit', (code) =>
      res(
        code === 0
          ? { ok: true, mode: 'manual' }
          : { ok: false, error: `exit ${code}`, mode: 'manual' },
      ),
    );
  });
}

function logEntry(entry: Record<string, unknown>): void {
  appendFileSync(RUNLOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

async function main(): Promise<void> {
  const args = parseArgs();
  const all = await listStubs();
  console.log(`[scale-stubs] ${all.length} stubs in DB`);

  let queue: readonly Hotel[] = all;
  if (args.explicitSlugs.length > 0) {
    queue = all.filter((h) => args.explicitSlugs.includes(h.slug));
    console.log(`[scale-stubs] filtered to ${queue.length} explicit slug(s)`);
  }
  if (args.skipExisting) {
    const before = queue.length;
    queue = queue.filter((h) => !existsSync(resolve(BRIEFS_DIR, `${h.slug}.json`)));
    console.log(
      `[scale-stubs] ${before - queue.length} already have briefs, ${queue.length} remain`,
    );
  }
  if (queue.length > args.limit) {
    queue = queue.slice(0, args.limit);
    console.log(`[scale-stubs] limited to ${args.limit}`);
  }

  if (args.dryRun) {
    console.log('\n[dry-run] would build briefs for:');
    for (const h of queue) {
      console.log(
        `  - ${h.slug.padEnd(45)} ${h.name} — ${h.city} ${h.postal_code ?? '?'} ${h.is_palace ? '(P)' : ''}`,
      );
    }
    return;
  }

  console.log(`\n[scale-stubs] runlog: ${RUNLOG}\n`);
  const results: Array<{
    slug: string;
    ok: boolean;
    mode: 'dt' | 'manual' | 'none';
    ms: number;
    error?: string;
  }> = [];
  for (let i = 0; i < queue.length; i++) {
    const h = queue[i];
    if (!h) continue;
    const start = Date.now();
    console.log(
      `\n[${i + 1}/${queue.length}] ${h.slug} — ${h.name} (${h.city}, dept ${inseeFromPostal(h.postal_code) ?? '?'})`,
    );
    let r: { ok: boolean; error?: string; mode: 'dt' | 'manual' | 'none' } = await runBuildBrief(h);
    if (!r.ok) {
      console.log(`  → DT failed, trying manual fallback (Wikidata+Wikipedia+Tavily)...`);
      const m = await runBuildBriefManual(h);
      r = m.ok ? m : { ok: false, error: `${r.error}; manual: ${m.error}`, mode: 'manual' };
    }
    const ms = Date.now() - start;
    results.push({
      slug: h.slug,
      ok: r.ok,
      mode: r.mode,
      ms,
      ...(r.error ? { error: r.error } : {}),
    });
    logEntry({ slug: h.slug, ok: r.ok, mode: r.mode, ms, ...(r.error ? { error: r.error } : {}) });
    if (r.ok) console.log(`  ✓ built (${r.mode}) in ${(ms / 1000).toFixed(1)}s`);
    else console.log(`  ✗ FAILED in ${(ms / 1000).toFixed(1)}s — ${r.error}`);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`\n━━━ summary ━━━`);
  console.log(`  ${ok}/${results.length} succeeded, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ✗ ${r.slug} — ${r.error}`);
    }
  }
  const okSlugs = results.filter((r) => r.ok).map((r) => r.slug);
  if (okSlugs.length > 0) {
    console.log(`\nNext: run the 5-pass LLM pipeline on the new briefs:`);
    console.log(`  $env:EDITORIAL_PILOT_BRIEFS_DIR="briefs-auto"`);
    console.log(
      `  pnpm exec tsx src/run.ts ${okSlugs.slice(0, 5).join(' ')}${okSlugs.length > 5 ? ' ... (' + okSlugs.length + ' total)' : ''}`,
    );
  }
}

main().catch((e) => {
  console.error('[scale-published-stubs] FATAL', e);
  process.exit(1);
});
