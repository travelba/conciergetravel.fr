/**
 * build-yonder-briefs.ts — Phase C step 1
 *
 * Builds an editorial brief for each Tier 1 Yonder draft hotel using
 * `build-brief-manual.ts` (no DATAtourisme dependency). Reads the draft
 * list straight from Supabase and feeds the manual brief-builder with:
 *   - name, city, lat/lng                        (from `hotels` table)
 *   - postal_code + street_address               (parsed from `address`)
 *   - wikidata QID, official_url                 (from `hotels` table)
 *
 * Why a thin wrapper over build-brief-manual.ts and not a new pipeline:
 *   - build-brief-manual.ts is battle-tested for non-DATAtourisme palaces
 *     (Cheval Blanc Courchevel, Airelles Gordes, etc.).
 *   - Writes briefs to `briefs-auto/` (read by run.ts via
 *     EDITORIAL_PILOT_BRIEFS_DIR=briefs-auto).
 *   - Each shell-out is isolated → per-hotel matrix at the end.
 *
 * Usage:
 *   pnpm exec tsx src/phaseC/build-yonder-briefs.ts --limit 3
 *   pnpm exec tsx src/phaseC/build-yonder-briefs.ts --slugs slug1,slug2
 *   pnpm exec tsx src/phaseC/build-yonder-briefs.ts --tier1   # top 30 ready
 *   pnpm exec tsx src/phaseC/build-yonder-briefs.ts --dry-run --limit 5
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(process.cwd(), '../../.env.local') });

const localRequire = createRequire(import.meta.url);

interface DraftRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly address: string | null;
  readonly postal_code: string | null;
  readonly latitude: number | string;
  readonly longitude: number | string;
  readonly wikidata_id: string | null;
  readonly official_url: string | null;
  readonly wikipedia_url_fr: string | null;
  readonly is_palace: boolean | null;
  readonly stars: number | null;
}

interface ParsedAddress {
  readonly street: string;
  readonly postal: string;
}

// Parses a French freeform address line.
// Examples handled:
//   "30 Av. George V, 75008 Paris, France"         → { street: "30 Av. George V", postal: "75008" }
//   "1 Place de l'Hôtel de Ville, 06400 Cannes"    → { street: "1 Place de l'Hôtel de Ville", postal: "06400" }
//   "Route du Sud, 73120 Courchevel"               → { street: "Route du Sud", postal: "73120" }
//
// Falls back to {street: "", postal: ""} for empty/unparseable input — the
// downstream manual brief-builder accepts empty strings for both.
function parseAddress(
  address: string | null,
  postalCodeColumn: string | null,
  city: string,
): ParsedAddress {
  if (postalCodeColumn && /^\d{5}$/u.test(postalCodeColumn)) {
    // postal_code already populated; just need the street part
    if (address) {
      const idx = address.indexOf(postalCodeColumn);
      const street =
        idx > 0
          ? address
              .slice(0, idx)
              .replace(/[,\s]+$/u, '')
              .trim()
          : '';
      return { street, postal: postalCodeColumn };
    }
    return { street: '', postal: postalCodeColumn };
  }
  if (!address) return { street: '', postal: '' };

  const postalMatch = address.match(/\b(\d{5})\b/u);
  const postal = postalMatch?.[1] ?? '';
  if (!postal) {
    // No postal code → strip ", <city>" and any trailing ", France" or ", country"
    let street = address.replace(/,\s*France\s*$/iu, '').trim();
    const cityIdx = street.toLowerCase().lastIndexOf(city.toLowerCase());
    if (cityIdx > 0)
      street = street
        .slice(0, cityIdx)
        .replace(/[,\s]+$/u, '')
        .trim();
    return { street, postal: '' };
  }
  const idx = address.indexOf(postal);
  const street =
    idx > 0
      ? address
          .slice(0, idx)
          .replace(/[,\s]+$/u, '')
          .trim()
      : '';
  return { street, postal };
}

interface CliArgs {
  readonly slugs: readonly string[];
  readonly limit: number | null;
  readonly tier1: boolean;
  readonly dryRun: boolean;
  readonly skipTavily: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let limit: number | null = null;
  let tier1 = false;
  let dryRun = false;
  let skipTavily = false;
  const slugs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i] ?? '';
    if (t === '--limit') limit = Number(argv[++i]);
    else if (t.startsWith('--limit=')) limit = Number(t.split('=')[1]);
    else if (t === '--slugs') {
      const v = argv[++i] ?? '';
      slugs.push(
        ...v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (t.startsWith('--slugs=')) {
      const v = t.split('=')[1] ?? '';
      slugs.push(
        ...v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (t === '--tier1') tier1 = true;
    else if (t === '--dry-run') dryRun = true;
    else if (t === '--no-tavily') skipTavily = true;
  }
  return { slugs, limit, tier1, dryRun, skipTavily };
}

async function listDrafts(args: CliArgs): Promise<readonly DraftRow[]> {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const conn = (
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    ''
  ).replace(/[?&]sslmode=[^&]*/giu, '');
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    if (args.slugs.length > 0) {
      const { rows } = await c.query<DraftRow>(
        `select slug, name, city, address, postal_code, latitude, longitude,
                wikidata_id, official_url, wikipedia_url_fr, is_palace, stars
         from public.hotels
         where slug = any($1::text[])
         order by array_position($1::text[], slug)`,
        [args.slugs],
      );
      return rows;
    }
    // Tier 1 selection — palaces first, then 5★ with full enrichment.
    const limitClause = args.limit ?? (args.tier1 ? 30 : 5);
    const { rows } = await c.query<DraftRow>(`
      select slug, name, city, address, postal_code, latitude, longitude,
             wikidata_id, official_url, wikipedia_url_fr, is_palace, stars
      from public.hotels
      where is_published = false
        and wikidata_id is not null
        and latitude is not null and longitude is not null
        and official_url is not null
        and address is not null
      order by is_palace desc nulls last, stars desc nulls last, slug
      limit ${limitClause}
    `);
    return rows;
  } finally {
    await c.end();
  }
}

// Bypass the pnpm wrapper entirely on Windows: pnpm.ps1 + cmd.exe mangle
// args containing `&`, `|`, `<`, `>` even when caret-escaped (PowerShell
// re-interprets before they reach cmd's caret-aware parser). We invoke node
// + tsx directly with shell:false so args travel as a real argv array and
// no shell touches them.
//
// tsx ships a `bin` entry but its CLI is `dist/cli.mjs`, which isn't in the
// package's exports map. Resolve the package's main entrypoint first, then
// walk to `dist/cli.mjs` from the resolved package directory.
function resolveTsxCli(): string {
  const pkgPath = localRequire.resolve('tsx/package.json');
  return resolve(pkgPath, '..', 'dist', 'cli.mjs');
}

const TSX_BIN = resolveTsxCli();

function runBuildBriefManual(
  row: DraftRow,
  parsed: ParsedAddress,
  skipTavily: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolveP) => {
    const args = [
      TSX_BIN,
      'src/enrichment/build-brief-manual.ts',
      row.slug,
      '--name',
      row.name,
      '--city',
      row.city,
      '--postal',
      parsed.postal,
      '--address',
      parsed.street,
      '--lat',
      String(row.latitude),
      '--lng',
      String(row.longitude),
    ];
    if (row.official_url) args.push('--website', row.official_url);
    if (row.wikidata_id) args.push('--qid', row.wikidata_id);
    if (row.wikipedia_url_fr) {
      const m = row.wikipedia_url_fr.match(/\/wiki\/(.+)$/u);
      if (m?.[1]) args.push('--wp', decodeURIComponent(m[1]).replace(/_/g, ' '));
    }
    if (skipTavily) args.push('--no-tavily');

    const env = {
      ...process.env,
      EDITORIAL_PILOT_BRIEFS_DIR: 'briefs-auto',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    };
    const child = spawn('node', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => resolveP({ ok: false, reason: err.message }));
    child.on('exit', (code) => {
      if (code === 0) {
        resolveP({ ok: true });
      } else {
        const lines = (stderr + stdout).split('\n');
        const reason = lines.find((l) => /FAILED|Error|FATAL/iu.test(l)) ?? `exit ${code}`;
        resolveP({ ok: false, reason: reason.slice(0, 250) });
      }
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(
    `[phaseC] build-yonder-briefs — slugs=${args.slugs.length || 'auto'} tier1=${args.tier1} limit=${args.limit ?? '-'} dryRun=${args.dryRun} skipTavily=${args.skipTavily}`,
  );

  const drafts = await listDrafts(args);
  console.log(`\n[phaseC] Resolved ${drafts.length} draft(s) for brief building.\n`);

  const briefsDir = resolve(process.cwd(), 'briefs-auto');
  if (!existsSync(briefsDir)) mkdirSync(briefsDir, { recursive: true });

  if (args.dryRun) {
    console.log('[dry-run] Would build briefs for:');
    for (const d of drafts) {
      const parsed = parseAddress(d.address, d.postal_code, d.city);
      console.log(
        `  - ${d.slug.padEnd(40)} ${d.name.padEnd(35)} ${d.city.padEnd(20)} postal=${parsed.postal.padEnd(5)} street="${parsed.street.slice(0, 40)}"`,
      );
    }
    return;
  }

  const results: Array<{
    slug: string;
    ok: boolean;
    reason?: string;
    elapsedMs: number;
    skipped?: boolean;
  }> = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!;
    const briefPath = resolve(briefsDir, `${d.slug}.json`);
    if (existsSync(briefPath)) {
      console.log(`[${i + 1}/${drafts.length}] ${d.slug} — brief exists, skip`);
      results.push({ slug: d.slug, ok: true, elapsedMs: 0, skipped: true });
      continue;
    }
    const parsed = parseAddress(d.address, d.postal_code, d.city);
    if (!parsed.postal) {
      console.log(
        `[${i + 1}/${drafts.length}] ${d.slug} — ✗ no postal code (address="${d.address ?? '?'}"), skipping`,
      );
      results.push({ slug: d.slug, ok: false, reason: 'no postal code', elapsedMs: 0 });
      continue;
    }
    const start = Date.now();
    console.log(
      `\n[${i + 1}/${drafts.length}] ${d.slug} — ${d.name} (${parsed.postal} ${d.city}, qid=${d.wikidata_id})`,
    );
    const r = await runBuildBriefManual(d, parsed, args.skipTavily);
    const ms = Date.now() - start;
    if (r.ok) {
      console.log(`  ✓ ${d.slug} brief built in ${(ms / 1000).toFixed(1)}s`);
      results.push({ slug: d.slug, ok: true, elapsedMs: ms });
    } else {
      console.log(`  ✗ ${d.slug} FAILED — ${r.reason}`);
      results.push({
        slug: d.slug,
        ok: false,
        ...(r.reason !== undefined ? { reason: r.reason } : {}),
        elapsedMs: ms,
      });
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  const built = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`Summary: ${built} built, ${skipped} skipped, ${failed} failed`);
  for (const r of results) {
    const tag = r.skipped ? '⟳' : r.ok ? '✓' : '✗';
    console.log(`  ${tag} ${r.slug}${r.reason ? `  — ${r.reason}` : ''}`);
  }

  const logsDir = resolve(process.cwd(), 'runs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logPath = resolve(
    logsDir,
    `phaseC-briefs-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  );
  writeFileSync(logPath, JSON.stringify(results, null, 2));
  console.log(`\nResults log: ${logPath}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error('[phaseC] FATAL:', err);
  process.exit(1);
});
