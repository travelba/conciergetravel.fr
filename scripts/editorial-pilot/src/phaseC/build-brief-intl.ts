/**
 * build-brief-intl.ts — Phase C step 2 (international cousin of build-yonder-briefs.ts)
 *
 * Builds an editorial brief for international hotels (`country_code <> 'FR'`)
 * by spawning `src/enrichment/build-brief-manual.ts` with per-country tweaks:
 *   - postal_code extracted with a country-aware regex (GB / US / IT / JP /
 *     BE / NL / CH / DE / ES / PT / AT / IE supported; unknown countries
 *     fall through with `""`, which the manual builder accepts).
 *   - latitude/longitude resolved from `public.hotels` when present, otherwise
 *     **back-filled from Wikidata P625** via `fetchWikidataCoordinates(qid)`.
 *     The Yonder INTL import populated 0/663 hotels with GPS — Wikidata is the
 *     only realistic source.
 *   - Wikipedia title taken from `wikipedia_url_en` when no `wikipedia_url_fr`
 *     exists. The downstream builder still hits the FR REST endpoint (we are
 *     not allowed to modify `build-brief-manual.ts` from this script), so the
 *     Wikipedia hit-rate degrades gracefully and the brief falls back to
 *     Wikidata + Tavily — which is the "factual ground truth" we need.
 *   - country is propagated via `--country <ISO 3166-1 alpha-2>` so the brief
 *     embeds the correct ISO code (BriefSchema enforces `.length(2)`).
 *
 * Why a thin wrapper over build-brief-manual.ts and not a new pipeline:
 *   - build-brief-manual.ts is already battle-tested for non-DATAtourisme
 *     hotels (37 of the 77 FR fallback runs succeeded the night of 2026-05-19).
 *   - It writes briefs to `briefs-auto/` (read by `run.ts` via
 *     `EDITORIAL_PILOT_BRIEFS_DIR=briefs-auto`) — same convention.
 *   - Each shell-out is isolated, so a single hotel failure does not poison
 *     the rest of the batch.
 *
 * Usage:
 *   pnpm exec tsx src/phaseC/build-brief-intl.ts --limit 3 --concurrency 1
 *   pnpm exec tsx src/phaseC/build-brief-intl.ts --slugs claridges,aman-venice
 *   pnpm exec tsx src/phaseC/build-brief-intl.ts --country GB --limit 10
 *   pnpm exec tsx src/phaseC/build-brief-intl.ts --dry-run --limit 20
 *   pnpm exec tsx src/phaseC/build-brief-intl.ts --force --slugs the-mercer
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { fetchWikidataCoordinates } from '../enrichment/wikidata.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env.local') });

const localRequire = createRequire(import.meta.url);

// ─── DB row contract ──────────────────────────────────────────────────────

interface IntlRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly address: string | null;
  readonly postal_code: string | null;
  readonly latitude: number | string | null;
  readonly longitude: number | string | null;
  readonly wikidata_id: string | null;
  readonly official_url: string | null;
  readonly wikipedia_url_fr: string | null;
  readonly wikipedia_url_en: string | null;
  readonly is_palace: boolean | null;
  readonly stars: number | null;
}

// ─── Country-aware postal-code extraction ─────────────────────────────────

interface PostalExtractionResult {
  readonly postal: string;
  readonly street: string;
}

/**
 * Extracts a postal code from a free-form local-format address using
 * per-country regexes. Falls through to `""` for unknown countries — the
 * downstream `build-brief-manual.ts` accepts empty postal codes.
 *
 * The set covers the 13 countries with the highest INTL hotel counts in
 * `public.hotels` as of 2026-05-19:
 *   GB, US, IT, JP, BE, NL, CH, DE, ES, PT, AT, IE (everything else → "").
 */
export function extractPostalIntl(
  country: string,
  address: string | null,
  fallbackPostalColumn: string | null,
): PostalExtractionResult {
  const fallback = (fallbackPostalColumn ?? '').trim();
  if (!address) return { postal: fallback, street: '' };

  // Country-specific postal patterns. Anchored with `\b` so we don't
  // accidentally match phone numbers or street numbers.
  const cc = country.toUpperCase();
  let postal = '';
  switch (cc) {
    case 'GB': {
      // UK: SW1A 1AA / W1S 4LP / EC2N 4AY / M1 1AE etc.
      // Format = 1-2 letters + 1-2 digits + optional letter + space + digit + 2 letters
      const m = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/iu);
      if (m?.[1]) postal = m[1].toUpperCase();
      break;
    }
    case 'US': {
      // US: ZIP-5 or ZIP+4 (NY 10022 / 10022-1234). Anchored by state-code
      // pattern to avoid false positives on long phone numbers.
      const m =
        address.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/u) ??
        address.match(/\b(\d{5}(?:-\d{4})?)\b/u);
      postal = m ? (m[2] ?? m[1] ?? '') : '';
      break;
    }
    case 'IT':
    case 'DE':
    case 'ES':
    case 'AT':
    case 'BE': {
      // IT / DE / ES / AT / BE: 5-digit numeric (DE 10117, IT 20121, ES 28001,
      // AT 1010 falls under 4-digit, BE 1000 same — handled below).
      const m4 = address.match(/\b(\d{4})\b/u);
      const m5 = address.match(/\b(\d{5})\b/u);
      if (cc === 'AT' || cc === 'BE') {
        if (m4?.[1]) postal = m4[1];
      } else if (m5?.[1]) {
        postal = m5[1];
      }
      break;
    }
    case 'NL': {
      // NL: 4 digits + space + 2 uppercase letters (1015 CT).
      const m = address.match(/\b(\d{4}\s?[A-Z]{2})\b/iu);
      if (m?.[1]) postal = m[1].toUpperCase();
      break;
    }
    case 'CH': {
      // CH: 4 digits (8001 Zurich, 1201 Geneva). Same shape as AT/BE.
      const m = address.match(/\b(\d{4})\b/u);
      if (m?.[1]) postal = m[1];
      break;
    }
    case 'PT': {
      // PT: NNNN-NNN (1100-148).
      const m = address.match(/\b(\d{4}-\d{3})\b/u);
      if (m?.[1]) postal = m[1];
      break;
    }
    case 'IE': {
      // IE Eircode: D02 AF30, A65 F4E2 (1 letter + 2 digits + space + 4 alphanum).
      const m = address.match(/\b([A-Z]\d{2}\s?[A-Z0-9]{4})\b/iu);
      if (m?.[1]) postal = m[1].toUpperCase();
      break;
    }
    case 'JP': {
      // JP: 100-0005 (3 digits + dash + 4 digits), often prefixed by 〒.
      const m = address.match(/\b(\d{3}-\d{4})\b/u);
      if (m?.[1]) postal = m[1];
      break;
    }
    default: {
      // Unknown country → leave empty. The brief-builder's `--postal` accepts
      // an empty string and the brief still validates (postal_code is not
      // required by BriefSchema).
      postal = '';
    }
  }

  const chosen = postal || fallback;
  let street = '';
  if (chosen) {
    const idx = address.indexOf(chosen);
    if (idx > 0) {
      street = address
        .slice(0, idx)
        .replace(/[,\s]+$/u, '')
        .trim();
    }
  }
  return { postal: chosen, street };
}

// ─── CLI parsing (Zod-validated) ──────────────────────────────────────────

const CliArgsSchema = z.object({
  slugs: z.array(z.string().min(1)).readonly(),
  limit: z.number().int().positive().nullable(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/u)
    .nullable(),
  dryRun: z.boolean(),
  skipTavily: z.boolean(),
  force: z.boolean(),
  concurrency: z.number().int().min(1).max(8),
});

type CliArgs = z.infer<typeof CliArgsSchema>;

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let limit: number | null = null;
  let country: string | null = null;
  let dryRun = false;
  let skipTavily = false;
  let force = false;
  let concurrency = 3;
  const slugs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i] ?? '';
    if (t === '--limit') limit = Number(argv[++i]);
    else if (t.startsWith('--limit=')) limit = Number(t.split('=')[1]);
    else if (t === '--country') country = (argv[++i] ?? '').toUpperCase();
    else if (t.startsWith('--country=')) country = (t.split('=')[1] ?? '').toUpperCase();
    else if (t === '--concurrency') concurrency = Number(argv[++i]);
    else if (t.startsWith('--concurrency=')) concurrency = Number(t.split('=')[1]);
    else if (t === '--slugs') {
      const v = argv[++i] ?? '';
      for (const s of v.split(',')) {
        const trimmed = s.trim();
        if (trimmed) slugs.push(trimmed);
      }
    } else if (t.startsWith('--slugs=')) {
      const v = t.split('=')[1] ?? '';
      for (const s of v.split(',')) {
        const trimmed = s.trim();
        if (trimmed) slugs.push(trimmed);
      }
    } else if (t === '--dry-run') dryRun = true;
    else if (t === '--no-tavily') skipTavily = true;
    else if (t === '--force') force = true;
  }

  const result = CliArgsSchema.safeParse({
    slugs,
    limit: Number.isFinite(limit) ? limit : null,
    country,
    dryRun,
    skipTavily,
    force,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 3,
  });
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid CLI arguments:\n${issues}`);
  }
  return result.data;
}

// ─── Supabase query ───────────────────────────────────────────────────────

async function listIntlHotels(args: CliArgs): Promise<readonly IntlRow[]> {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const conn = (
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    ''
  ).replace(/[?&]sslmode=[^&]*/giu, '');
  if (!conn) {
    throw new Error('SUPABASE_DB_POOLER_URL or SUPABASE_DB_URL missing in environment.');
  }
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    if (args.slugs.length > 0) {
      const { rows } = await c.query<IntlRow>(
        `select slug, name, city, country_code, address, postal_code,
                latitude, longitude, wikidata_id, official_url,
                wikipedia_url_fr, wikipedia_url_en, is_palace, stars
         from public.hotels
         where slug = any($1::text[])
           and country_code is not null
           and country_code <> 'FR'
         order by array_position($1::text[], slug)`,
        [args.slugs],
      );
      return rows;
    }

    const params: unknown[] = [];
    const wheres: string[] = [
      `country_code is not null`,
      `country_code <> 'FR'`,
      `(long_description_sections is null
        or jsonb_typeof(long_description_sections) <> 'array'
        or jsonb_array_length(long_description_sections) < 6)`,
    ];
    if (args.country) {
      params.push(args.country);
      wheres.push(`country_code = $${params.length}`);
    }
    const limitClause = args.limit ?? 5;
    const sql = `
      select slug, name, city, country_code, address, postal_code,
             latitude, longitude, wikidata_id, official_url,
             wikipedia_url_fr, wikipedia_url_en, is_palace, stars
      from public.hotels
      where ${wheres.join('\n        and ')}
      order by
        (wikidata_id is not null) desc,
        (wikipedia_url_en is not null) desc,
        (official_url is not null) desc,
        is_palace desc nulls last,
        stars desc nulls last,
        slug
      limit ${Number(limitClause)}
    `;
    const { rows } = await c.query<IntlRow>(sql, params);
    return rows;
  } finally {
    await c.end();
  }
}

// ─── Brief-builder spawn ──────────────────────────────────────────────────

// Bypass the pnpm wrapper entirely on Windows: pnpm.ps1 + cmd.exe mangle
// args containing `&`, `|`, `<`, `>` even when caret-escaped (PowerShell
// re-interprets before they reach cmd's caret-aware parser). We invoke node
// + tsx directly with shell:false so args travel as a real argv array and
// no shell touches them. (Same pattern as build-yonder-briefs.ts, commit
// a2f8d18.)
function resolveTsxCli(): string {
  const pkgPath = localRequire.resolve('tsx/package.json');
  return resolve(pkgPath, '..', 'dist', 'cli.mjs');
}

const TSX_BIN = resolveTsxCli();

interface ResolvedHotel {
  readonly row: IntlRow;
  readonly latitude: number;
  readonly longitude: number;
  readonly postal: string;
  readonly street: string;
  /** Plain Wikipedia article title (decoded), suitable for `--wp`. */
  readonly wikipediaTitle: string | null;
  /** Which source filled the GPS coordinates. */
  readonly gpsSource: 'db' | 'wikidata';
}

function decodeWikipediaTitle(url: string): string | null {
  const m = url.match(/\/wiki\/([^?#]+)$/u);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

interface ResolveOutcome {
  readonly ok: boolean;
  readonly resolved?: ResolvedHotel;
  readonly reason?: string;
}

async function resolveHotel(row: IntlRow): Promise<ResolveOutcome> {
  // Coordinates: prefer DB columns, otherwise fall back to Wikidata P625.
  let latitude: number | null = null;
  let longitude: number | null = null;
  let gpsSource: 'db' | 'wikidata' = 'db';

  if (row.latitude !== null && row.longitude !== null) {
    const lat = typeof row.latitude === 'number' ? row.latitude : Number(row.latitude);
    const lng = typeof row.longitude === 'number' ? row.longitude : Number(row.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      latitude = lat;
      longitude = lng;
    }
  }
  if ((latitude === null || longitude === null) && row.wikidata_id) {
    try {
      const coords = await fetchWikidataCoordinates(row.wikidata_id);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
        gpsSource = 'wikidata';
      }
    } catch {
      // Network glitches are non-fatal — fall through to the "no GPS" branch.
    }
  }
  if (latitude === null || longitude === null) {
    return { ok: false, reason: 'insufficient public data (no GPS in DB or Wikidata)' };
  }

  const { postal, street } = extractPostalIntl(row.country_code, row.address, row.postal_code);

  // EN title takes priority for INTL hotels — most have an EN article but no FR.
  // The downstream builder always hits FR Wikipedia; passing the EN title is a
  // best-effort negotiation (FR articles often share the EN name as a fallback
  // redirect, e.g. "Claridge's", "The Plaza Hotel").
  const wikipediaUrl = row.wikipedia_url_en ?? row.wikipedia_url_fr;
  const wikipediaTitle = wikipediaUrl ? decodeWikipediaTitle(wikipediaUrl) : null;

  return {
    ok: true,
    resolved: {
      row,
      latitude,
      longitude,
      postal,
      street,
      wikipediaTitle,
      gpsSource,
    },
  };
}

interface BriefRunResult {
  readonly ok: boolean;
  readonly reason?: string;
}

function runBuildBriefManual(
  resolved: ResolvedHotel,
  skipTavily: boolean,
): Promise<BriefRunResult> {
  return new Promise((resolveP) => {
    const { row, latitude, longitude, postal, street, wikipediaTitle } = resolved;
    const args = [
      TSX_BIN,
      'src/enrichment/build-brief-manual.ts',
      row.slug,
      '--name',
      row.name,
      '--city',
      row.city,
      '--country',
      row.country_code.toUpperCase(),
      '--postal',
      postal,
      '--address',
      street,
      '--lat',
      String(latitude),
      '--lng',
      String(longitude),
    ];
    if (row.official_url) args.push('--website', row.official_url);
    if (row.wikidata_id) args.push('--qid', row.wikidata_id);
    if (wikipediaTitle) args.push('--wp', wikipediaTitle);
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

// ─── Manual concurrency gate ──────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      results[idx] = await worker(item, idx);
    }
  }

  const pool = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () =>
    next(),
  );
  await Promise.all(pool);
  return results;
}

// ─── Summary table ────────────────────────────────────────────────────────

interface RunResultRow {
  readonly slug: string;
  readonly country: string;
  readonly qidPresent: boolean;
  readonly wikiPresent: boolean;
  readonly officialPresent: boolean;
  readonly briefBuilt: boolean;
  readonly warnings: string;
  readonly elapsedMs: number;
  readonly skipped: boolean;
}

function printSummaryTable(rows: readonly RunResultRow[]): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    [
      'slug'.padEnd(45),
      'cc'.padEnd(4),
      'qid'.padEnd(5),
      'wiki'.padEnd(5),
      'url'.padEnd(5),
      'brief'.padEnd(7),
      'warnings',
    ].join('| '),
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of rows) {
    console.log(
      [
        r.slug.slice(0, 45).padEnd(45),
        r.country.padEnd(4),
        (r.qidPresent ? '✓' : '·').padEnd(5),
        (r.wikiPresent ? '✓' : '·').padEnd(5),
        (r.officialPresent ? '✓' : '·').padEnd(5),
        (r.skipped ? '⟳' : r.briefBuilt ? '✓' : '✗').padEnd(7),
        r.warnings,
      ].join('| '),
    );
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ─── Entrypoint ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(
    `[phaseC] build-brief-intl — slugs=${args.slugs.length || 'auto'} country=${args.country ?? 'any'} limit=${args.limit ?? '-'} concurrency=${args.concurrency} dryRun=${args.dryRun} skipTavily=${args.skipTavily} force=${args.force}`,
  );

  const drafts = await listIntlHotels(args);
  console.log(`\n[phaseC] Resolved ${drafts.length} INTL hotel(s) for brief building.\n`);

  const briefsDir = resolve(process.cwd(), 'briefs-auto');
  if (!existsSync(briefsDir)) mkdirSync(briefsDir, { recursive: true });

  if (args.dryRun) {
    console.log('[dry-run] Would attempt briefs for:');
    for (const d of drafts) {
      const { postal, street } = extractPostalIntl(d.country_code, d.address, d.postal_code);
      const gps =
        d.latitude !== null && d.longitude !== null ? 'db' : d.wikidata_id ? 'wikidata?' : 'NONE';
      console.log(
        `  - ${d.slug.padEnd(45)} ${d.country_code} ${d.city.padEnd(20)} gps=${gps} postal="${postal}" qid=${d.wikidata_id ?? '·'} wpEN=${d.wikipedia_url_en ? '✓' : '·'} url=${d.official_url ? '✓' : '·'} street="${street.slice(0, 30)}"`,
      );
    }
    return;
  }

  // Per-hotel worker: skip-check → resolve GPS → spawn brief-builder.
  const summaryRows = await runWithConcurrency(drafts, args.concurrency, async (d, idx) => {
    const label = `[${idx + 1}/${drafts.length}] ${d.slug}`;
    const briefPath = resolve(briefsDir, `${d.slug}.json`);

    const base: Omit<RunResultRow, 'briefBuilt' | 'warnings' | 'skipped' | 'elapsedMs'> = {
      slug: d.slug,
      country: d.country_code,
      qidPresent: d.wikidata_id !== null,
      wikiPresent: d.wikipedia_url_en !== null || d.wikipedia_url_fr !== null,
      officialPresent: d.official_url !== null,
    };

    if (!args.force && existsSync(briefPath)) {
      console.log(`${label} — brief exists, skip (use --force to rebuild)`);
      return {
        ...base,
        briefBuilt: true,
        warnings: 'skipped (exists)',
        skipped: true,
        elapsedMs: 0,
      };
    }

    const r = await resolveHotel(d);
    if (!r.ok || !r.resolved) {
      const reason = r.reason ?? 'unresolvable';
      console.log(`${label} — ✗ WARN: ${reason}`);
      return { ...base, briefBuilt: false, warnings: reason, skipped: false, elapsedMs: 0 };
    }

    const resolved = r.resolved;
    const start = Date.now();
    console.log(
      `${label} — ${d.name} (${d.country_code} ${d.city}, gps=${resolved.gpsSource} postal="${resolved.postal}")`,
    );
    const briefResult = await runBuildBriefManual(resolved, args.skipTavily);
    const elapsedMs = Date.now() - start;
    if (briefResult.ok) {
      console.log(`  ✓ ${d.slug} brief built in ${(elapsedMs / 1000).toFixed(1)}s`);
      return {
        ...base,
        briefBuilt: true,
        warnings: resolved.gpsSource === 'wikidata' ? 'gps from wikidata' : '',
        skipped: false,
        elapsedMs,
      };
    }
    const reason = briefResult.reason ?? 'unknown failure';
    console.log(`  ✗ ${d.slug} FAILED — ${reason}`);
    return { ...base, briefBuilt: false, warnings: reason, skipped: false, elapsedMs };
  });

  printSummaryTable(summaryRows);

  const built = summaryRows.filter((r) => r.briefBuilt && !r.skipped).length;
  const skipped = summaryRows.filter((r) => r.skipped).length;
  const failed = summaryRows.filter((r) => !r.briefBuilt).length;
  console.log(
    `\nSummary: ${built} built, ${skipped} skipped, ${failed} failed (of ${drafts.length} total)`,
  );

  const logsDir = resolve(process.cwd(), 'runs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logPath = resolve(
    logsDir,
    `phaseC-briefs-intl-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  );
  writeFileSync(logPath, JSON.stringify(summaryRows, null, 2));
  console.log(`Results log: ${logPath}`);

  if (failed > 0 && built === 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error('[phaseC] FATAL:', err);
  process.exit(1);
});
