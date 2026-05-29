/**
 * enrich-hotel-policies.ts — Wave 0 pipeline replacing the 357 synthetic
 * policy defaults (`_synthetic: true`, migration 0055) with real,
 * grounded data for CDC §2 bloc 9.
 *
 * Source cascade (skill content-enrichment-pipeline §Rule 5):
 *   Tavily Search + Extract on the official site / authoritative pages
 *   → gpt-4o-mini structured extraction (temperature 0, anti-hallucination)
 *   → pure mapper into the `policies` jsonb shape (hotel-policies-builder).
 *
 * Anti-fabrication: when nothing can be grounded we SKIP the hotel — we
 * never downgrade a synthetic block to an invented "real" one. Requires
 * TAVILY_API_KEY + OPENAI_API_KEY.
 *
 * Eligibility (default): published hotels whose `policies._synthetic` is
 * true OR whose policies are missing core blocks. `--force` reprocesses.
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, llm-output-robustness.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { listHotels, type HotelRow, type SupabaseRestConfig } from '../hotels/supabase-hotels.js';
import { tavilySearchAndExtract } from './tavily-client.js';
import { llmExtract } from './llm-extract.js';
import { buildPolicies, PolicyFactsSchema, type PolicyFacts } from './hotel-policies-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const POLICY_SCHEMA_DESCRIPTION = `
{
  "check_in_from": string|null,        // earliest check-in, verbatim ("15:00", "3pm", "à partir de 15h")
  "check_in_until": string|null,       // latest check-in if stated
  "check_out_until": string|null,      // checkout deadline ("12:00", "noon", "11h")
  "pets_allowed": true|false|null,     // true only if explicitly allowed; false if explicitly forbidden; null if silent
  "pet_fee_eur": number|null,          // per-night pet fee in EUR if stated
  "pet_notes_fr": string|null,         // verbatim FR pet note (≤ 200 chars)
  "pet_notes_en": string|null,
  "wifi_included": true|false|null,    // true if free wifi confirmed
  "wifi_scope": "whole_property"|"public_areas"|"rooms"|null,
  "cancellation_summary_fr": string|null,  // 1 sentence FR summary if a cancellation policy is stated
  "cancellation_summary_en": string|null,
  "cancellation_free_until_hours": number|null  // hours-before-arrival for free cancellation, if numeric
}
CRITICAL: if a field is not literally stated → null (never guess). Times verbatim.`;

interface Args {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly slugsFile?: string;
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeDrafts: boolean;
  readonly force: boolean;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const concRaw = map.get('concurrency');
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const slugsFileRaw = map.get('slugs-file');
  const out: Args = {
    dryRun: map.has('dry-run'),
    includeDrafts: map.has('include-drafts'),
    force: map.has('force'),
    // Tavily public instance + OpenAI — keep concurrency conservative.
    concurrency: typeof concRaw === 'string' ? Math.min(4, Math.max(1, Number(concRaw))) : 2,
    ...(typeof slugRaw === 'string' ? { slug: slugRaw } : {}),
    ...(typeof slugsFileRaw === 'string' ? { slugsFile: slugsFileRaw } : {}),
    ...(typeof limitRaw === 'string' ? { limit: Number(limitRaw) } : {}),
  };
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) return { ...out, slugs: list };
  }
  return out;
}

async function readSlugsFile(path: string): Promise<readonly string[]> {
  const content = await readFile(path, 'utf-8');
  return content
    .split(/[\r\n,]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#'));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isSynthetic(policies: unknown): boolean {
  return isRecord(policies) && policies['_synthetic'] === true;
}

function coreComplete(policies: unknown): boolean {
  if (!isRecord(policies)) return false;
  return ['check_in', 'check_out', 'cancellation', 'pets', 'wifi'].every((k) =>
    isRecord(policies[k]),
  );
}

function officialDomain(url: string | null): string | null {
  if (url === null) return null;
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly success: boolean;
  readonly grounded: number;
  readonly coreComplete: boolean;
  readonly skipped?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly error?: string;
}

async function extractPolicyFacts(
  row: HotelRow,
): Promise<{ facts: PolicyFacts | null; inputTokens: number; outputTokens: number }> {
  const domain = officialDomain(row.official_url);
  const query = `${row.name} ${row.city ?? ''} check-in check-out time pets policy wifi cancellation policy`;
  const run = await tavilySearchAndExtract({
    query: query.slice(0, 380),
    extractQuery: `check-in time check-out time pets allowed wifi cancellation policy at ${row.name}`,
    searchDepth: 'advanced',
    extractDepth: 'advanced',
    ...(domain !== null ? { includeDomains: [domain, `*.${domain}`] } : {}),
    maxSearchResults: 6,
    maxExtractUrls: 3,
    chunksPerSource: 4,
    minScore: 0.3,
  });
  if (run.extracted.length === 0) return { facts: null, inputTokens: 0, outputTokens: 0 };

  let best: PolicyFacts | null = null;
  let bestSignal = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const src of run.extracted) {
    const extracted = await llmExtract({
      content: src.content,
      context: `Policies at ${row.name} — from ${src.url}`,
      schemaDescription: POLICY_SCHEMA_DESCRIPTION,
      schema: PolicyFactsSchema,
    });
    if (extracted === null) continue;
    inputTokens += extracted.usage.inputTokens;
    outputTokens += extracted.usage.outputTokens;
    const signal = Object.values(extracted.data).filter(
      (v) => v !== null && v !== undefined,
    ).length;
    if (signal > bestSignal) {
      best = extracted.data;
      bestSignal = signal;
    }
  }
  return { facts: best, inputTokens, outputTokens };
}

async function patchPolicies(
  cfg: SupabaseRestConfig,
  hotelId: string,
  policies: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ policies }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[policies] PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function runOnHotel(
  supabase: SupabaseRestConfig,
  row: HotelRow,
  args: Args,
): Promise<PerHotelResult> {
  const base = { slug: row.slug, hotelId: row.id, name: row.name };
  try {
    const { facts, inputTokens, outputTokens } = await extractPolicyFacts(row);
    if (facts === null) {
      return {
        ...base,
        success: true,
        grounded: 0,
        coreComplete: false,
        skipped: 'no-grounded-facts',
      };
    }
    const built = buildPolicies(facts, row.policies);
    if (built.policies === null) {
      return {
        ...base,
        success: true,
        grounded: 0,
        coreComplete: false,
        skipped: 'nothing-grounded',
        inputTokens,
        outputTokens,
      };
    }
    if (!args.dryRun) {
      await patchPolicies(supabase, row.id, built.policies);
    }
    return {
      ...base,
      success: true,
      grounded: built.grounded,
      coreComplete: built.coreComplete,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    return {
      ...base,
      success: false,
      grounded: 0,
      coreComplete: false,
      error: (err as Error).message,
    };
  }
}

function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  return new Promise((resolveAll, rejectAll) => {
    const launchNext = (): void => {
      const myIndex = cursor++;
      if (myIndex >= total) return;
      const item = items[myIndex];
      if (item === undefined) return;
      fn(item, myIndex)
        .then((res) => {
          results[myIndex] = res;
          done++;
          if (onProgress) onProgress(done, total, res);
          if (done === total) resolveAll(results);
          else launchNext();
        })
        .catch(rejectAll);
    };
    const initial = Math.min(limit, total);
    for (let i = 0; i < initial; i++) launchNext();
    if (total === 0) resolveAll([]);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  let slugs = args.slugs;
  if (args.slugsFile !== undefined) {
    if (!existsSync(args.slugsFile))
      throw new Error(`[policies] slugs-file not found: ${args.slugsFile}`);
    const fileSlugs = await readSlugsFile(args.slugsFile);
    slugs = slugs !== undefined ? [...slugs, ...fileSlugs] : fileSlugs;
  }

  console.log(
    `[policies] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} force=${args.force}`,
  );

  const listOpts: Parameters<typeof listHotels>[1] = {
    onlyPublished: !args.includeDrafts,
    requireDescription: false,
    ...(args.slug !== undefined ? { slug: args.slug } : {}),
    ...(slugs !== undefined ? { slugs } : {}),
  };
  const allRows = await listHotels(supabase, listOpts);

  const candidates = args.force
    ? allRows
    : allRows.filter((row) => isSynthetic(row.policies) || !coreComplete(row.policies));
  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[policies] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[policies] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(supabase, row, args),
    (doneCount, total, last) => {
      const status = last.success
        ? last.skipped
          ? `SKIP (${last.skipped})`
          : `OK (${last.grounded} blocks, core=${last.coreComplete})`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[policies] ${doneCount}/${total} ${last.slug} → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success && r.skipped === undefined).length;
  const skipCount = results.filter((r) => r.skipped !== undefined).length;
  const failCount = results.filter((r) => !r.success).length;
  const coreCount = results.filter((r) => r.coreComplete).length;
  const totalIn = results.reduce((a, r) => a + (r.inputTokens ?? 0), 0);
  const totalOut = results.reduce((a, r) => a + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[policies] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[policies] written=${okCount} skipped=${skipCount} fail=${failCount} coreComplete=${coreCount} tokens=${totalIn} in / ${totalOut} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `policies-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        dryRun: args.dryRun,
        totalFetched: allRows.length,
        totalEligible: candidates.length,
        totalProcessed: rows.length,
        written: okCount,
        skipped: skipCount,
        fail: failCount,
        coreComplete: coreCount,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[policies] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[policies] FATAL', err);
  process.exit(1);
});
