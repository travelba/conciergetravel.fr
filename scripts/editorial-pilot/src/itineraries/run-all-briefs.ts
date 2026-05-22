#!/usr/bin/env tsx
/**
 * Batch runner: compose + validate + emit SQL for every P0 brief except
 * `paris-luxe-3-jours` (which is the polished, hand-tuned reference
 * already published in DB).
 *
 * Modes:
 *   - templated (default): destination-neutral prose from
 *     `compose-from-brief.ts`. No external calls, deterministic.
 *     Output is a *draft scaffold* — editor must polish before publish.
 *   - `--llm`: OpenAI-powered prose via `compose-from-brief-llm.ts`.
 *     5 calls per brief (~10-15 k tokens), still emitted as `status='draft'`
 *     unless `--publish` is also passed. Re-runs the validator.
 *
 * Selection:
 *   - `--slug=<brief-slug>` runs a single brief instead of the whole batch.
 *   - `--briefs-dir=<path>` / `--out-dir=<path>` override defaults.
 *
 * Usage:
 *   tsx src/itineraries/run-all-briefs.ts                     # templated batch
 *   tsx src/itineraries/run-all-briefs.ts --llm                # LLM batch
 *   tsx src/itineraries/run-all-briefs.ts --llm --slug=reims-champagne-week-end
 *   pnpm itineraries:batch [-- --llm] [--slug=<slug>]
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { composeItineraryFromBrief } from './compose-from-brief.js';
import { composeItineraryWithLlm } from './compose-from-brief-llm.js';
import { loadEnv } from '../env.js';
import { loadItineraryBrief } from './load-brief.js';
import { itineraryToSql } from './to-sql.js';
import type { GeneratedItinerary } from './types.js';
import { validateItinerary } from './validate-itinerary.js';

const PARIS_SLUG = 'paris-luxe-3-jours';

function parseFlag(args: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  for (const a of args) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return null;
}

interface RunResult {
  readonly slug: string;
  readonly status: 'ok' | 'validation_failed' | 'compose_error';
  readonly issues?: readonly { readonly path: string; readonly message: string }[];
  readonly error?: string;
}

interface ProcessOptions {
  readonly outDir: string;
  readonly useLlm: boolean;
  readonly publish: boolean;
}

async function processBrief(slug: string, opts: ProcessOptions): Promise<RunResult> {
  try {
    const brief = await loadItineraryBrief(slug);
    const composeOpts = { status: opts.publish ? 'published' : 'draft' } as const;
    let composed: GeneratedItinerary;
    if (opts.useLlm) {
      // Load env lazily per call so a missing OPENAI_API_KEY surfaces a
      // clean error message instead of an unhelpful TypeError at startup
      // when --llm is not used.
      const env = loadEnv();
      composed = await composeItineraryWithLlm(brief, [], env, composeOpts);
    } else {
      composed = composeItineraryFromBrief(brief, [], composeOpts);
    }

    const validation = validateItinerary(composed);
    if (!validation.ok || validation.data === null) {
      return { slug, status: 'validation_failed', issues: validation.issues };
    }

    const sql = itineraryToSql(validation.data);
    const outPath = join(opts.outDir, `${slug}.sql`);
    writeFileSync(outPath, sql, 'utf8');
    return { slug, status: 'ok' };
  } catch (err) {
    return {
      slug,
      status: 'compose_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Default paths resolve from the script location so the runner works
  // regardless of the caller's cwd (CI, pnpm, IDE task runner).
  const here = dirname(fileURLToPath(import.meta.url));
  const defaultBriefsDir = resolve(here, '../../itineraries/briefs');
  const defaultOutDir = resolve(here, '../../itineraries/seed');

  const briefsDir = parseFlag(args, 'briefs-dir') ?? defaultBriefsDir;
  const outDir = parseFlag(args, 'out-dir') ?? defaultOutDir;
  const slugFilter = parseFlag(args, 'slug');
  const useLlm = args.includes('--llm');
  const publish = args.includes('--publish');

  if (!existsSync(briefsDir)) {
    console.error(`Briefs dir not found: ${briefsDir}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  let slugs = readdirSync(briefsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/u, ''))
    .filter((s) => s !== PARIS_SLUG)
    .sort();
  if (slugFilter !== null) {
    if (!slugs.includes(slugFilter)) {
      console.error(
        `Slug "${slugFilter}" not found in ${briefsDir} (or it is the Paris reference brief which the batch skips by design).`,
      );
      process.exit(1);
    }
    slugs = [slugFilter];
  }

  const modeLabel = useLlm ? 'LLM (OpenAI)' : 'templated';
  const statusLabel = publish ? 'published' : 'draft';
  console.error(
    `Found ${slugs.length} brief(s) to process — mode=${modeLabel}, status=${statusLabel}.`,
  );

  const results: RunResult[] = [];
  for (const slug of slugs) {
    process.stderr.write(`  · ${slug.padEnd(45)} `);
    const t0 = Date.now();
    const r = await processBrief(slug, { outDir, useLlm, publish });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    results.push(r);
    if (r.status === 'ok') {
      process.stderr.write(`OK  (${elapsed}s)\n`);
    } else if (r.status === 'validation_failed') {
      process.stderr.write(`VALIDATION FAILED (${r.issues?.length ?? 0} issues, ${elapsed}s)\n`);
      for (const issue of r.issues ?? []) {
        process.stderr.write(`      ${issue.path}: ${issue.message}\n`);
      }
    } else {
      process.stderr.write(`ERROR (${elapsed}s): ${r.error}\n`);
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.length - ok;
  console.error(`\n${ok}/${results.length} brief(s) produced valid SQL (${failed} failed).`);
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
