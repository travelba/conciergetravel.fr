/**
 * enrich-hotel-amenities.ts — Wave 0 pipeline for the CDC §2 bloc 6
 * amenities montée (target ≥ 80 attributs, Phase 1 floor ≥ 12).
 *
 * Strategy (anti-fabrication, skill content-enrichment-pipeline §Rule 2):
 *   1. Always include the BASELINE amenity set (near-universal across the
 *      curated luxury catalogue) — guarantees the Phase 1 floor with no
 *      LLM call and no fabrication risk.
 *   2. Ask the LLM to CLASSIFY which of the remaining CANONICAL amenities
 *      (closed list from `amenities-taxonomy.ts`) the hotel genuinely has,
 *      grounded ONLY on the hotel's own brief (description, dining, spa,
 *      existing amenities). The LLM never invents a new amenity — Zod
 *      rejects any key outside the taxonomy.
 *   3. Merge baseline + existing + selected, preserving editorial keys.
 *
 * Eligibility (default): published hotels with < 80 amenities. `--force`
 * regenerates regardless. `--no-llm` writes only the baseline+existing
 * merge (free, deterministic) — useful for a fast catalogue-wide floor.
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, llm-output-robustness.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import {
  listHotels,
  projectHotelForLlm,
  type HotelRow,
  type SupabaseRestConfig,
} from '../hotels/supabase-hotels.js';
import {
  AMENITIES_BY_KEY,
  AMENITIES_TAXONOMY,
  BASELINE_AMENITY_KEYS,
  extractExistingAmenityKeys,
  mergeAmenities,
  type AmenityRecord,
} from './amenities-taxonomy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const CDC_AMENITIES_TARGET = 80;
const MAX_RETRIES = 3;

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

/** Keys eligible for LLM classification = taxonomy minus the always-on baseline. */
const CLASSIFIABLE_KEYS = AMENITIES_TAXONOMY.filter((a) => a.baseline !== true).map((a) => a.key);

const ClassifierOutputSchema = z.object({
  applicable_keys: z.array(z.string()),
});

const CLASSIFIER_SYSTEM_PROMPT = `Tu es un analyste hôtelier rigoureux pour MyConciergeHotel.com.

On te donne le brief factuel d'un hôtel et une LISTE FERMÉE d'équipements/services candidats (avec leur clé). Ta tâche : sélectionner UNIQUEMENT les clés des équipements que cet hôtel possède réellement, d'après le brief.

Règles dures (anti-hallucination) :
- Ne sélectionne une clé QUE si le brief l'atteste explicitement OU si c'est une évidence catégorielle pour ce standing (ex : un Palace a un service de conciergerie).
- En cas de doute, NE sélectionne PAS la clé. Mieux vaut omettre que d'inventer (risque juridique DGCCRF).
- Tu ne peux retourner QUE des clés présentes dans la liste candidate. Aucune clé inventée.
- Retourne un JSON strict : { "applicable_keys": ["spa", "rooftop_bar", ...] }.`;

function buildClassifierPrompt(hotel: ReturnType<typeof projectHotelForLlm>): string {
  const candidates = CLASSIFIABLE_KEYS.map((k) => {
    const a = AMENITIES_BY_KEY.get(k);
    return `- ${k}: ${a?.label_fr ?? k}`;
  }).join('\n');
  return [
    '=== BRIEF HÔTEL ===',
    JSON.stringify(
      {
        name: hotel.name,
        city: hotel.city,
        stars: hotel.stars,
        is_palace: hotel.is_palace,
        description_fr: hotel.description_fr_excerpt,
        restaurant_info: hotel.restaurant_info,
        spa_info: hotel.spa_info,
        amenities: hotel.amenities,
        signature_experiences: hotel.signature_experiences,
      },
      null,
      2,
    ),
    '',
    '=== ÉQUIPEMENTS CANDIDATS (liste fermée) ===',
    candidates,
    '',
    'Retourne UNIQUEMENT le JSON { "applicable_keys": [...] }.',
  ].join('\n');
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

/** Returns selected keys filtered to the closed candidate set. */
async function classifyAmenities(
  client: LlmClient,
  hotel: ReturnType<typeof projectHotelForLlm>,
): Promise<{ keys: readonly string[]; inputTokens: number; outputTokens: number }> {
  const candidateSet = new Set(CLASSIFIABLE_KEYS);
  let totalIn = 0;
  let totalOut = 0;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const result = await client.call({
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      userPrompt: buildClassifierPrompt(hotel),
      temperature: 0.2,
      maxOutputTokens: 800,
      responseFormat: 'json',
    });
    totalIn += result.usage.inputTokens;
    totalOut += result.usage.outputTokens;
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(result.content.trim()));
    } catch {
      continue;
    }
    const zod = ClassifierOutputSchema.safeParse(parsed);
    if (!zod.success) continue;
    const keys = zod.data.applicable_keys.filter((k) => candidateSet.has(k));
    return { keys, inputTokens: totalIn, outputTokens: totalOut };
  }
  // Degrade gracefully: baseline-only merge rather than throwing.
  return { keys: [], inputTokens: totalIn, outputTokens: totalOut };
}

interface Args {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly slugsFile?: string;
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeDrafts: boolean;
  readonly force: boolean;
  readonly noLlm: boolean;
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
    noLlm: map.has('no-llm'),
    concurrency: typeof concRaw === 'string' ? Math.min(8, Math.max(1, Number(concRaw))) : 4,
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

function amenityCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

async function patchAmenities(
  cfg: SupabaseRestConfig,
  hotelId: string,
  amenities: readonly AmenityRecord[],
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
    body: JSON.stringify({ amenities }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[amenities] PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly success: boolean;
  readonly before: number;
  readonly after: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly error?: string;
}

async function runOnHotel(
  client: LlmClient,
  supabase: SupabaseRestConfig,
  row: HotelRow,
  args: Args,
): Promise<PerHotelResult> {
  const base = { slug: row.slug, hotelId: row.id, name: row.name };
  const existingKeys = extractExistingAmenityKeys(row.amenities);
  const before = amenityCount(row.amenities);

  try {
    let selected: readonly string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    if (!args.noLlm) {
      const c = await classifyAmenities(client, projectHotelForLlm(row));
      selected = c.keys;
      inputTokens = c.inputTokens;
      outputTokens = c.outputTokens;
    }
    const merged = mergeAmenities(existingKeys, selected);
    if (!args.dryRun) {
      await patchAmenities(supabase, row.id, merged);
    }
    return {
      ...base,
      success: true,
      before,
      after: merged.length,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    return { ...base, success: false, before, after: before, error: (err as Error).message };
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

  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  let slugs = args.slugs;
  if (args.slugsFile !== undefined) {
    if (!existsSync(args.slugsFile))
      throw new Error(`[amenities] slugs-file not found: ${args.slugsFile}`);
    const fileSlugs = await readSlugsFile(args.slugsFile);
    slugs = slugs !== undefined ? [...slugs, ...fileSlugs] : fileSlugs;
  }

  console.log(`[amenities] provider=${provider} model=${client.model} noLlm=${args.noLlm}`);
  console.log(
    `[amenities] taxonomy=${AMENITIES_TAXONOMY.length} baseline=${BASELINE_AMENITY_KEYS.length} classifiable=${CLASSIFIABLE_KEYS.length}`,
  );
  console.log(
    `[amenities] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} force=${args.force}`,
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
    : allRows.filter((row) => amenityCount(row.amenities) < CDC_AMENITIES_TARGET);
  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[amenities] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[amenities] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.noLlm ? Math.min(8, args.concurrency * 2) : args.concurrency,
    (row) => runOnHotel(client, supabase, row, args),
    (doneCount, total, last) => {
      const status = last.success
        ? `OK ${last.before}→${last.after}`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[amenities] ${doneCount}/${total} ${last.slug} → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalIn = results.reduce((a, r) => a + (r.inputTokens ?? 0), 0);
  const totalOut = results.reduce((a, r) => a + (r.outputTokens ?? 0), 0);
  const reached80 = results.filter((r) => r.success && r.after >= CDC_AMENITIES_TARGET).length;

  console.log('---');
  console.log(`[amenities] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[amenities] success=${okCount} fail=${failCount} reached≥${CDC_AMENITIES_TARGET}=${reached80} tokens=${totalIn} in / ${totalOut} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `amenities-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        dryRun: args.dryRun,
        noLlm: args.noLlm,
        totalFetched: allRows.length,
        totalEligible: candidates.length,
        totalProcessed: rows.length,
        success: okCount,
        fail: failCount,
        reachedTarget: reached80,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[amenities] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[amenities] FATAL', err);
  process.exit(1);
});
