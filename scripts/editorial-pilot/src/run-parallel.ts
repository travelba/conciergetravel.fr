/**
 * Parallel runner for the 7-pass editorial pipeline.
 *
 * Reads slugs from --slug=<csv> or --all, then runs up to --concurrency
 * pipelines in flight at once. Each pipeline is independent (per-slug),
 * so parallelism is safe — only the OpenAI rate limit caps us.
 *
 * Designed for batch nights where 60+ hotel briefs need to be turned
 * into magazine markdown without waiting 4+ hours sequentially.
 *
 * Usage:
 *   $env:EDITORIAL_PILOT_BRIEFS_DIR="briefs-auto"
 *   pnpm exec tsx src/run-parallel.ts --all --concurrency=4
 *   pnpm exec tsx src/run-parallel.ts --slug=foo,bar --concurrency=2
 */

import { loadEnv, resolveProvider } from './env.js';
import { buildLlmClient } from './llm.js';
import { listAvailableBriefs, runPipelineForHotel } from './pipeline.js';

interface CliArgs {
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly concurrency: number;
  readonly missingOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let slugs: readonly string[] = [];
  let all = false;
  let concurrency = 3;
  let missingOnly = false;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--missing') missingOnly = true;
    else if (a.startsWith('--slug=')) {
      slugs = a
        .slice('--slug='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = n;
    }
  }
  return { slugs, all, concurrency, missingOnly };
}

async function listMissingPilots(allSlugs: readonly string[]): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const pilotsDir = resolve(here, '..', '..', '..', 'docs', 'editorial', 'pilots-auto');
  let existing: string[] = [];
  try {
    existing = (await readdir(pilotsDir))
      .filter((f) => f.endsWith('.md') && !/\.phase\d+\.md$/.test(f))
      .map((f) => f.replace(/\.md$/, ''));
  } catch {
    existing = [];
  }
  return allSlugs.filter((s) => !existing.includes(s)).sort();
}

interface ResultEntry {
  readonly slug: string;
  readonly status: 'ok' | 'error';
  readonly elapsedMs: number;
  readonly error?: string;
  readonly tokens?: number;
}

async function runWithConcurrency(
  slugs: readonly string[],
  concurrency: number,
  llm: ReturnType<typeof buildLlmClient>,
): Promise<ResultEntry[]> {
  const queue = [...slugs];
  const results: ResultEntry[] = [];
  let active = 0;
  let nextIdx = 0;
  const total = slugs.length;

  return new Promise<ResultEntry[]>((resolve) => {
    const tick = (): void => {
      while (active < concurrency && queue.length > 0) {
        const slug = queue.shift()!;
        const idx = ++nextIdx;
        active += 1;
        const tag = `[${idx}/${total} ${slug}]`;
        console.log(`${tag} START (active=${active})`);
        const started = Date.now();
        runPipelineForHotel(slug, llm)
          .then((res) => {
            const dt = Date.now() - started;
            const tk = res.totalTokens.input + res.totalTokens.output;
            console.log(`${tag} ✓ ${(dt / 1000).toFixed(1)}s — tokens=${tk}`);
            results.push({ slug, status: 'ok', elapsedMs: dt, tokens: tk });
          })
          .catch((err: unknown) => {
            const dt = Date.now() - started;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`${tag} ✗ ${(dt / 1000).toFixed(1)}s — ${msg}`);
            results.push({ slug, status: 'error', elapsedMs: dt, error: msg });
          })
          .finally(() => {
            active -= 1;
            if (queue.length === 0 && active === 0) {
              resolve(results);
            } else {
              tick();
            }
          });
      }
      if (queue.length === 0 && active === 0) resolve(results);
    };
    tick();
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);

  const available = await listAvailableBriefs();

  let targets: string[] = [];
  if (args.slugs.length > 0) {
    const missing = args.slugs.filter((s) => !available.includes(s));
    if (missing.length > 0) {
      console.error(`Unknown brief(s): ${missing.join(', ')}`);
      process.exit(1);
    }
    targets = [...args.slugs];
  } else if (args.missingOnly) {
    targets = await listMissingPilots(available);
  } else if (args.all) {
    targets = [...available];
  } else {
    console.error('Usage: tsx src/run-parallel.ts [--all|--missing|--slug=a,b] [--concurrency=N]');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MyConciergeHotel.com — editorial pipeline (parallel)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Provider:    ${llm.provider}`);
  console.log(`  Model:       ${llm.model}`);
  console.log(`  Briefs dir:  ${process.env['EDITORIAL_PILOT_BRIEFS_DIR'] ?? 'briefs'}`);
  console.log(`  Concurrency: ${args.concurrency}`);
  console.log(`  Targets:     ${targets.length} hotel(s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const t0 = Date.now();
  const results = await runWithConcurrency(targets, args.concurrency, llm);
  const elapsed = Date.now() - t0;

  const ok = results.filter((r) => r.status === 'ok');
  const ko = results.filter((r) => r.status === 'error');
  const totalTokens = ok.reduce((acc, r) => acc + (r.tokens ?? 0), 0);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Done in ${(elapsed / 60000).toFixed(1)} min`);
  console.log(`  OK:     ${ok.length}/${results.length}`);
  console.log(`  Failed: ${ko.length}`);
  console.log(`  Tokens: ${totalTokens.toLocaleString()}`);
  if (ko.length > 0) {
    console.log('\n  Failures:');
    for (const r of ko) console.log(`   - ${r.slug}: ${r.error}`);
  }
  if (ko.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n[run-parallel] FATAL:', err);
  process.exit(1);
});
