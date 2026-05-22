#!/usr/bin/env tsx
/**
 * Batch runner: compose + validate + emit SQL for every P0 brief except
 * `paris-luxe-3-jours` (which is the polished, hand-tuned reference
 * already published in DB).
 *
 * Each generated SQL inserts the itinerary as `status='draft'` and with
 * `hotel_ids = []` / `section.hotel_id = null` — the editor wires the
 * real hotel UUIDs and polishes the prose via the back-office (Payload)
 * before publishing. The pipeline output is therefore a structured
 * starting surface that *passes validation* (≥150-word sections,
 * 40-80-word AEO, 50-100-word FAQ, 140-160-char meta_desc), not the
 * final editorial-grade content.
 *
 * Usage:
 *   tsx src/itineraries/run-all-briefs.ts [--briefs-dir=path] [--out-dir=path]
 *   pnpm itineraries:batch
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { composeItineraryFromBrief } from './compose-from-brief.js';
import { loadItineraryBrief } from './load-brief.js';
import { itineraryToSql } from './to-sql.js';
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

async function processBrief(slug: string, outDir: string): Promise<RunResult> {
  try {
    const brief = await loadItineraryBrief(slug);
    const composed = composeItineraryFromBrief(brief, [], { status: 'draft' });

    const validation = validateItinerary(composed);
    if (!validation.ok || validation.data === null) {
      return { slug, status: 'validation_failed', issues: validation.issues };
    }

    const sql = itineraryToSql(validation.data);
    const outPath = join(outDir, `${slug}.sql`);
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

  if (!existsSync(briefsDir)) {
    console.error(`Briefs dir not found: ${briefsDir}`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const slugs = readdirSync(briefsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/u, ''))
    .filter((s) => s !== PARIS_SLUG)
    .sort();

  console.error(`Found ${slugs.length} briefs (excluding ${PARIS_SLUG}).`);

  const results: RunResult[] = [];
  for (const slug of slugs) {
    process.stderr.write(`  · ${slug.padEnd(45)} `);
    const r = await processBrief(slug, outDir);
    results.push(r);
    if (r.status === 'ok') {
      process.stderr.write('OK\n');
    } else if (r.status === 'validation_failed') {
      process.stderr.write(`VALIDATION FAILED (${r.issues?.length ?? 0} issues)\n`);
      for (const issue of r.issues ?? []) {
        process.stderr.write(`      ${issue.path}: ${issue.message}\n`);
      }
    } else {
      process.stderr.write(`ERROR: ${r.error}\n`);
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.length - ok;
  console.error(`\n${ok}/${results.length} briefs produced valid SQL (${failed} failed).`);
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
