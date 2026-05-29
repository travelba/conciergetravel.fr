/**
 * select-pilot-cohort.ts — derive the pilot cohort + scale waves from
 * the CDC audit backlog CSV (`audit:hotel-fiches-cdc`).
 *
 * The content-completion plan (docs/editorial/hotel-fiche-cdc-audit-*.md)
 * runs pilote-puis-scale: validate the full enrichment chain on a small
 * cohort (the fiches closest to CDC-complete + the strategic tiers)
 * before scaling tier-by-tier across the catalogue. This script is the
 * deterministic, credential-free first step — it reads the backlog CSV,
 * ranks rows, and writes slug lists consumed by every runner via
 * `--slugs-file` / `--slugs`.
 *
 * Inputs (no LLM, no network): the CSV produced by audit-hotel-fiche-cdc.ts.
 *
 * Outputs (under `runs/`):
 *   - pilot-cohort.txt          one slug per line (the pilot cohort)
 *   - cohort-waves.json         { pilot, waves: { <tier>: slug[] }, meta }
 *   - cohort-summary.txt        human-readable breakdown
 *
 * CLI:
 *   --csv=path                  backlog CSV (default: latest hotel-fiche-cdc-backlog-*.csv)
 *   --size=N                    cohort cap (default 120)
 *   --min-t3=N                  also include rows with score_t3 >= N (default 70 — the "partial" set)
 *   --tiers=a,b,c               priority tiers seeding the cohort
 *                               (default relais_chateaux,world_50_best,lhw_member,
 *                                michelin_3_keys,michelin_2_keys,small_luxury_hotels)
 *   --published-only            keep only is_published=true rows (default true)
 *   --out-dir=path              override the runs/ output directory
 *
 * Skill: editorial-pilot.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

const DEFAULT_PRIORITY_TIERS = [
  'palace_atout_france',
  'relais_chateaux',
  'world_50_best',
  'lhw_member',
  'michelin_3_keys',
  'michelin_2_keys',
  'small_luxury_hotels',
] as const;

const DEFAULT_COHORT_SIZE = 120;
const DEFAULT_MIN_T3 = 70;

export interface BacklogRow {
  readonly slug: string;
  readonly name: string;
  readonly isPublished: boolean;
  readonly luxuryTier: string;
  readonly countryCode: string;
  readonly statusCdc: string;
  readonly scoreCdc: number;
  readonly scoreT3: number;
  readonly cdcGapCount: number;
  readonly worstBlock: string;
}

/**
 * Parse a single CSV line into fields, honouring double-quoted fields
 * with embedded commas/quotes (RFC 4180 subset — the audit writer never
 * emits embedded newlines, so a line-based split is safe).
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function toNumber(value: string | undefined): number {
  if (value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseBacklogCsv(content: string): BacklogRow[] {
  const lines = content.split(/\r?\n/u).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0] ?? '');
  const idx = (name: string): number => header.indexOf(name);

  const iSlug = idx('slug');
  const iName = idx('name');
  const iPub = idx('is_published');
  const iTier = idx('luxury_tier');
  const iCountry = idx('country_code');
  const iStatus = idx('status_cdc');
  const iScoreCdc = idx('score_cdc');
  const iScoreT3 = idx('score_t3');
  const iGap = idx('cdc_gap_count');
  const iWorst = idx('worst_block');

  if (iSlug === -1) {
    throw new Error('[cohort] backlog CSV missing "slug" column');
  }

  const rows: BacklogRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i] ?? '');
    const slug = f[iSlug];
    if (slug === undefined || slug.length === 0) continue;
    rows.push({
      slug,
      name: f[iName] ?? slug,
      isPublished: (f[iPub] ?? 'true').toLowerCase() === 'true',
      luxuryTier: f[iTier] ?? '',
      countryCode: f[iCountry] ?? '',
      statusCdc: f[iStatus] ?? '',
      scoreCdc: toNumber(f[iScoreCdc]),
      scoreT3: toNumber(f[iScoreT3]),
      cdcGapCount: toNumber(f[iGap]),
      worstBlock: f[iWorst] ?? '',
    });
  }
  return rows;
}

export interface CohortSelectionOptions {
  readonly size: number;
  readonly minT3: number;
  readonly priorityTiers: readonly string[];
  readonly publishedOnly: boolean;
}

export interface CohortSelection {
  readonly pilot: readonly BacklogRow[];
  readonly waves: ReadonlyMap<string, readonly BacklogRow[]>;
  readonly totalConsidered: number;
}

/**
 * Rank closest-to-complete first: higher score_cdc wins, tie-break on
 * higher score_t3 (editorial text completeness), then fewer gaps.
 */
export function rankRows(rows: readonly BacklogRow[]): BacklogRow[] {
  return [...rows].sort((a, b) => {
    if (b.scoreCdc !== a.scoreCdc) return b.scoreCdc - a.scoreCdc;
    if (b.scoreT3 !== a.scoreT3) return b.scoreT3 - a.scoreT3;
    if (a.cdcGapCount !== b.cdcGapCount) return a.cdcGapCount - b.cdcGapCount;
    return a.slug.localeCompare(b.slug);
  });
}

export function selectCohort(
  rows: readonly BacklogRow[],
  opts: CohortSelectionOptions,
): CohortSelection {
  const considered = opts.publishedOnly ? rows.filter((r) => r.isPublished) : [...rows];
  const ranked = rankRows(considered);
  const tierSet = new Set(opts.priorityTiers);

  // Pilot = union of (a) the "partial"/closest editorial set (score_t3 >= minT3),
  // (b) the top-ranked priority-tier rows, capped at `size`. We always
  // keep the highest-score rows first so the pilot proves the chain on
  // the easiest wins before the hardest.
  const partial = ranked.filter(
    (r) => r.scoreT3 >= opts.minT3 || r.statusCdc === 'partial' || r.statusCdc === 'complete',
  );
  const priorityTierRows = ranked.filter((r) => tierSet.has(r.luxuryTier));

  const seen = new Set<string>();
  const pilot: BacklogRow[] = [];
  const push = (r: BacklogRow): void => {
    if (seen.has(r.slug) || pilot.length >= opts.size) return;
    seen.add(r.slug);
    pilot.push(r);
  };
  // Interleave: partial first (closest to done), then top priority tiers.
  for (const r of partial) push(r);
  for (const r of priorityTierRows) push(r);
  // Top up with the global ranking if both pools were thin.
  for (const r of ranked) push(r);

  // Scale waves: every considered row grouped by tier, ranked, EXCLUDING
  // the pilot (pilot is wave 0). Empty tier label becomes "untiered".
  const waves = new Map<string, BacklogRow[]>();
  for (const r of ranked) {
    if (seen.has(r.slug)) continue;
    const key = r.luxuryTier.length > 0 ? r.luxuryTier : 'untiered';
    const bucket = waves.get(key) ?? [];
    bucket.push(r);
    waves.set(key, bucket);
  }

  return { pilot, waves, totalConsidered: considered.length };
}

function findLatestBacklogCsv(dir: string): string {
  const candidates = readdirSync(dir)
    .filter((f) => /^hotel-fiche-cdc-backlog-.*\.csv$/u.test(f))
    .sort();
  const latest = candidates[candidates.length - 1];
  if (latest === undefined) {
    throw new Error(`[cohort] no hotel-fiche-cdc-backlog-*.csv found in ${dir}`);
  }
  return resolve(dir, latest);
}

interface CliArgs {
  readonly csv: string | null;
  readonly size: number;
  readonly minT3: number;
  readonly tiers: readonly string[];
  readonly publishedOnly: boolean;
  readonly outDir: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const sizeRaw = map.get('size');
  const minT3Raw = map.get('min-t3');
  const tiersRaw = map.get('tiers');
  const csvRaw = map.get('csv');
  const outDirRaw = map.get('out-dir');
  return {
    csv: typeof csvRaw === 'string' ? csvRaw : null,
    size: typeof sizeRaw === 'string' ? Math.max(1, Number(sizeRaw)) : DEFAULT_COHORT_SIZE,
    minT3: typeof minT3Raw === 'string' ? Math.max(0, Number(minT3Raw)) : DEFAULT_MIN_T3,
    tiers:
      typeof tiersRaw === 'string'
        ? tiersRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [...DEFAULT_PRIORITY_TIERS],
    publishedOnly: map.get('published-only') !== 'false',
    outDir: typeof outDirRaw === 'string' ? outDirRaw : RUNS_DIR,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.csv ?? findLatestBacklogCsv(args.outDir);
  console.log(`[cohort] reading backlog: ${csvPath}`);

  const content = readFileSync(csvPath, 'utf-8');
  const rows = parseBacklogCsv(content);
  console.log(`[cohort] parsed ${rows.length} rows`);

  const selection = selectCohort(rows, {
    size: args.size,
    minT3: args.minT3,
    priorityTiers: args.tiers,
    publishedOnly: args.publishedOnly,
  });

  mkdirSync(args.outDir, { recursive: true });

  const pilotPath = resolve(args.outDir, 'pilot-cohort.txt');
  writeFileSync(pilotPath, selection.pilot.map((r) => r.slug).join('\n') + '\n', 'utf-8');

  const wavesObj: Record<string, string[]> = {};
  for (const [tier, bucket] of selection.waves) {
    wavesObj[tier] = bucket.map((r) => r.slug);
  }
  const wavesPath = resolve(args.outDir, 'cohort-waves.json');
  writeFileSync(
    wavesPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: csvPath,
        options: {
          size: args.size,
          minT3: args.minT3,
          priorityTiers: args.tiers,
          publishedOnly: args.publishedOnly,
        },
        totalConsidered: selection.totalConsidered,
        pilot: selection.pilot.map((r) => r.slug),
        waves: wavesObj,
      },
      null,
      2,
    ),
    'utf-8',
  );

  // Human-readable summary.
  const tierCounts = new Map<string, number>();
  for (const r of selection.pilot) {
    const key = r.luxuryTier.length > 0 ? r.luxuryTier : 'untiered';
    tierCounts.set(key, (tierCounts.get(key) ?? 0) + 1);
  }
  const lines: string[] = [];
  lines.push(`=== Pilot cohort selection — ${new Date().toISOString()} ===`);
  lines.push('');
  lines.push(`Source CSV        : ${csvPath}`);
  lines.push(`Considered rows   : ${selection.totalConsidered}`);
  lines.push(`Pilot size        : ${selection.pilot.length} (cap ${args.size})`);
  lines.push(`min score_t3      : ${args.minT3}`);
  lines.push(`Priority tiers    : ${args.tiers.join(', ')}`);
  lines.push('');
  lines.push('── Pilot by tier ──');
  for (const [tier, count] of [...tierCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${tier.padEnd(24)} : ${count}`);
  }
  lines.push('');
  lines.push('── Scale waves (excludes pilot) ──');
  for (const [tier, bucket] of [...selection.waves.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    lines.push(`  ${tier.padEnd(24)} : ${bucket.length}`);
  }
  lines.push('');
  lines.push('── Pilot top 15 (closest to CDC-complete) ──');
  for (const r of selection.pilot.slice(0, 15)) {
    lines.push(
      `  ${String(r.scoreCdc).padStart(3)}%cdc ${String(r.scoreT3).padStart(3)}%t3  ${r.slug} (${r.luxuryTier || '—'})`,
    );
  }
  const summaryPath = resolve(args.outDir, 'cohort-summary.txt');
  const summary = lines.join('\n') + '\n';
  writeFileSync(summaryPath, summary, 'utf-8');

  console.log(summary);
  console.log(`[cohort] pilot slugs → ${pilotPath}`);
  console.log(`[cohort] waves       → ${wavesPath}`);
  console.log(`[cohort] summary     → ${summaryPath}`);
}

// Only run when invoked directly (keeps the parsing/selection helpers
// importable from the unit test without side effects).
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(__filename);
if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error('[cohort] FATAL', err);
    process.exit(1);
  }
}
