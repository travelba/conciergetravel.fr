/**
 * Project-wide DataSEO action audit runner.
 *
 * One command for the recurring project workflow:
 *   - audit hotel fiches,
 *   - audit editorial rankings,
 *   - build the unified modify/create/remove matrix.
 *
 * Read-only by design: it never writes to Supabase.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');
const EDITORIAL_ROOT = resolve(REPO_ROOT, 'scripts/editorial-pilot');

const ScopeSchema = z.enum(['all', 'hotels', 'rankings']);
type Scope = z.infer<typeof ScopeSchema>;

interface Args {
  readonly scope: Scope;
  readonly hotelLimit: number;
  readonly rankingLimit: number;
  readonly hotelCandidates: number;
  readonly rankingCandidates: number;
  readonly concurrency: number;
  readonly refresh: boolean;
  readonly skipUnified: boolean;
  readonly confirmLarge: boolean;
  readonly hotelSlugs: readonly string[];
}

interface CommandResult {
  readonly label: string;
  readonly output: string;
}

function readFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function readString(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function readNumber(argv: readonly string[], name: string, fallback: number): number {
  const raw = readString(argv, name);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readScope(argv: readonly string[]): Scope {
  const raw = readString(argv, 'scope') ?? 'all';
  const normalized = raw === 'hotel' ? 'hotels' : raw === 'ranking' ? 'rankings' : raw;
  return ScopeSchema.parse(normalized);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const smoke = readFlag(argv, 'smoke');
  const sharedLimit = readNumber(argv, 'limit', smoke ? 5 : 100);
  const sharedCandidates = readNumber(argv, 'candidates', smoke ? 20 : 180);
  const slugsRaw = readString(argv, 'hotel-slugs') ?? readString(argv, 'slugs');
  return {
    scope: readScope(argv),
    hotelLimit: readNumber(argv, 'hotel-limit', sharedLimit),
    rankingLimit: readNumber(argv, 'ranking-limit', sharedLimit),
    hotelCandidates: readNumber(
      argv,
      'hotel-candidates',
      smoke ? 20 : Math.max(420, sharedCandidates),
    ),
    rankingCandidates: readNumber(argv, 'ranking-candidates', sharedCandidates),
    concurrency: readNumber(argv, 'concurrency', smoke ? 1 : 2),
    refresh: readFlag(argv, 'refresh'),
    skipUnified: readFlag(argv, 'no-unified'),
    confirmLarge: readFlag(argv, 'confirm-large') || smoke,
    hotelSlugs:
      slugsRaw === null
        ? []
        : slugsRaw
            .split(',')
            .map((slug) => slug.trim())
            .filter((slug) => slug.length > 0),
  };
}

function shouldRunHotels(scope: Scope): boolean {
  return scope === 'all' || scope === 'hotels';
}

function shouldRunRankings(scope: Scope): boolean {
  return scope === 'all' || scope === 'rankings';
}

function enforceCostGuard(args: Args): void {
  const total =
    (shouldRunHotels(args.scope) ? args.hotelLimit : 0) +
    (shouldRunRankings(args.scope) ? args.rankingLimit : 0);
  if (total <= 250 || args.confirmLarge) return;
  throw new Error(
    `Refusing to launch ${total} DataSEO audits without --confirm-large. ` +
      'Use smaller --hotel-limit/--ranking-limit waves or pass --confirm-large intentionally.',
  );
}

function tsxCommand(): string {
  return process.platform === 'win32' ? 'tsx' : 'tsx';
}

function runTsx(label: string, args: readonly string[]): Promise<CommandResult> {
  return new Promise((resolvePromise, reject) => {
    console.log(`[dataseo-runner] start ${label}`);
    const child = spawn(tsxCommand(), [...args], {
      cwd: EDITORIAL_ROOT,
      env: process.env,
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      output += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[dataseo-runner] done ${label}`);
        resolvePromise({ label, output });
        return;
      }
      reject(new Error(`[dataseo-runner] ${label} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

function extractJsonPath(output: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`${escaped} wrote (.+?\\.json)`, 'u').exec(output);
  const path = match?.[1];
  if (path === undefined) {
    throw new Error(`[dataseo-runner] Could not find JSON output for marker ${marker}`);
  }
  return path.trim();
}

function extractMarkdownPath(output: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`${escaped} wrote (.+?\\.md)`, 'u').exec(output);
  const path = match?.[1];
  if (path === undefined) {
    throw new Error(`[dataseo-runner] Could not find Markdown output for marker ${marker}`);
  }
  return path.trim();
}

function hotelAuditArgs(args: Args): readonly string[] {
  const out = [
    `--limit=${args.hotelLimit}`,
    `--candidates=${args.hotelCandidates}`,
    `--concurrency=${args.concurrency}`,
  ];
  if (args.refresh) out.push('--refresh');
  if (args.hotelSlugs.length > 0) out.push(`--slugs=${args.hotelSlugs.join(',')}`);
  return out;
}

function rankingAuditArgs(args: Args): readonly string[] {
  const out = [
    `--limit=${args.rankingLimit}`,
    `--candidates=${args.rankingCandidates}`,
    `--concurrency=${args.concurrency}`,
  ];
  if (args.refresh) out.push('--refresh');
  return out;
}

async function runHotelAudit(args: Args): Promise<string> {
  const result = await runTsx('hotels', [
    'src/grounding/audit-hotel-dataseo-wave.ts',
    ...hotelAuditArgs(args),
  ]);
  return extractJsonPath(result.output, '[audit-dataseo]');
}

async function runRankingAudit(args: Args): Promise<string> {
  const result = await runTsx('rankings', [
    'src/grounding/audit-ranking-dataseo-wave.ts',
    ...rankingAuditArgs(args),
  ]);
  return extractJsonPath(result.output, '[audit-ranking-dataseo]');
}

async function runUnifiedReport(hotelJsonPath: string, rankingJsonPath: string): Promise<string> {
  const result = await runTsx('unified-report', [
    'src/grounding/build-dataseo-actions-report.ts',
    `--hotels=${hotelJsonPath}`,
    `--rankings=${rankingJsonPath}`,
  ]);
  return extractMarkdownPath(result.output, '[dataseo-actions]');
}

async function main(): Promise<void> {
  const args = parseArgs();
  enforceCostGuard(args);
  console.log(
    `[dataseo-runner] scope=${args.scope} hotelLimit=${args.hotelLimit} rankingLimit=${args.rankingLimit} ` +
      `concurrency=${args.concurrency} refresh=${args.refresh ? 'on' : 'off'}`,
  );

  let hotelJsonPath: string | null = null;
  let rankingJsonPath: string | null = null;

  if (shouldRunHotels(args.scope)) {
    hotelJsonPath = await runHotelAudit(args);
  }
  if (shouldRunRankings(args.scope)) {
    rankingJsonPath = await runRankingAudit(args);
  }

  if (
    args.scope === 'all' &&
    !args.skipUnified &&
    hotelJsonPath !== null &&
    rankingJsonPath !== null
  ) {
    const unifiedPath = await runUnifiedReport(hotelJsonPath, rankingJsonPath);
    console.log(`[dataseo-runner] unified=${unifiedPath}`);
  } else {
    console.log('[dataseo-runner] unified skipped');
  }

  if (hotelJsonPath !== null) console.log(`[dataseo-runner] hotels=${hotelJsonPath}`);
  if (rankingJsonPath !== null) console.log(`[dataseo-runner] rankings=${rankingJsonPath}`);
}

main().catch((err: unknown) => {
  console.error('[dataseo-runner] FATAL', err);
  process.exit(1);
});
