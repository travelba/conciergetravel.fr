/**
 * CLI — remediate `hotels.concierge_advice` blocks that still narrate the
 * data dossier / pipeline scaffolding live in production (ADR-0029 invariant
 * I1). Identifies leakers with the SHARED `hasLeak()` gate (not a loose SQL
 * regex), then for each:
 *
 *   1. regenerates the advice GROUNDED on DataForSEO (hard rule 8ter —
 *      `groundHotel(...)`, cache `data/dfs-cache/`, degrade-safe `grounding=off`
 *      when DFS is unconfigured) via the leak-gated generator, OR
 *   2. NULLs the block (regenerable) when the source is too thin to produce
 *      clean prose after the generator's retries — refuse-rather-than-persist.
 *
 * Distinct from `run-hotel-concierge-advice.ts` (which only targets rows where
 * `concierge_advice IS NULL`): this pass targets rows whose advice is SET but
 * LEAKING. The "En pratique" sections are out of scope — untouched here.
 *
 * Examples:
 *   pnpm exec tsx src/hotels/fix-leaking-concierge-advice.ts --dry-run
 *   pnpm exec tsx src/hotels/fix-leaking-concierge-advice.ts --concurrency=4
 *   pnpm exec tsx src/hotels/fix-leaking-concierge-advice.ts --slugs=a,b
 *
 * Skill: editorial-pilot, llm-output-robustness, concierge-voice-pipeline,
 * keyword-grounding-dataforseo.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import { loadDfsConfig } from '../grounding/env-dfs.js';
import { groundHotel } from '../grounding/hotel-grounding.js';
import { hasLeak } from '../enrichment/scaffolding-gate.js';
import type { DataForSeoClientConfig } from '@mch/integrations/dataforseo';
import {
  listHotels,
  projectHotelForLlm,
  updateHotelConciergeAdvice,
  clearHotelConciergeAdvice,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generateConciergeAdvice,
  ConciergeAdviceGenerationError,
} from './concierge-advice-generator.js';

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

interface Args {
  readonly dryRun: boolean;
  readonly concurrency: number;
  readonly limit?: number;
  readonly slugs?: readonly string[];
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
  const concurrency = typeof concRaw === 'string' ? Math.min(8, Math.max(1, Number(concRaw))) : 3;
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const out: { dryRun: boolean; concurrency: number; limit?: number; slugs?: readonly string[] } = {
    dryRun: map.has('dry-run'),
    concurrency,
  };
  if (typeof limitRaw === 'string') out.limit = Number(limitRaw);
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) out.slugs = list;
  }
  return out;
}

/** Lenient shape of the stored `concierge_advice` jsonb. */
const StoredAdviceSchema = z.object({
  fr: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
  en: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
});

interface AdviceScanRow {
  readonly slug: string;
  readonly concierge_advice: unknown;
}

/**
 * Lightweight paginated scan of just `slug,concierge_advice` for published
 * rows. The full HotelRow heavy-column select (long_description_sections, …)
 * times out at 500 on a 2900+ row catalogue (statement_timeout) — always
 * narrow the candidate set on a thin select first, then fetch full rows only
 * for the leakers via the `--slugs` filter.
 */
async function scanAdvice(
  cfg: SupabaseRestConfig,
  slugs: readonly string[] | undefined,
): Promise<AdviceScanRow[]> {
  const PAGE = 1000;
  const out: AdviceScanRow[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', 'slug,concierge_advice');
    params.set('order', 'slug.asc');
    params.set('limit', String(PAGE));
    if (offset > 0) params.set('offset', String(offset));
    let filter = '&is_published=eq.true&concierge_advice=not.is.null';
    if (slugs !== undefined && slugs.length > 0) {
      filter += `&slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
    }
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}${filter}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[fix-advice-leak] scan failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[fix-advice-leak] scan did not return an array');
    out.push(...(json as AdviceScanRow[]));
    if (json.length < PAGE) break;
    offset += json.length;
  }
  return out;
}

/** True when ANY of fr/en title/body trips the shared scaffolding gate. */
function adviceLeaks(advice: unknown): boolean {
  const parsed = StoredAdviceSchema.safeParse(advice);
  if (!parsed.success) return false;
  const { fr, en } = parsed.data;
  return hasLeak(fr?.title) || hasLeak(fr?.body) || hasLeak(en?.title) || hasLeak(en?.body);
}

type Action = 'regenerated' | 'nulled' | 'unchanged';

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly city: string | null;
  readonly action: Action;
  readonly grounded?: boolean;
  readonly attempts?: number;
  readonly tip_for?: string;
  readonly error?: string;
}

async function fixHotel(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  dfsCfg: DataForSeoClientConfig | null,
  row: HotelRow,
  options: { dryRun: boolean },
): Promise<PerHotelResult> {
  const input = projectHotelForLlm(row);
  const base = { slug: row.slug, hotelId: row.id, name: row.name, city: row.city };
  let grounded = false;
  try {
    const { block, grounding } = await groundHotel(dfsCfg, input);
    grounded = grounding.grounded;
    const result = await generateConciergeAdvice(client, input, { groundingBlock: block });
    if (!options.dryRun) {
      await updateHotelConciergeAdvice(supabase, row.id, {
        fr: result.output.fr,
        en: result.output.en,
      });
    }
    return {
      ...base,
      action: 'regenerated',
      grounded,
      attempts: result.attempts,
      tip_for: result.output.fr.tip_for,
    };
  } catch (err) {
    if (err instanceof ConciergeAdviceGenerationError) {
      // Source too thin to produce clean prose after retries — null the
      // leaking block rather than leave the leak live (regenerable later).
      if (!options.dryRun) {
        await clearHotelConciergeAdvice(supabase, row.id);
      }
      return { ...base, action: 'nulled', grounded, error: err.message.slice(0, 160) };
    }
    return { ...base, action: 'unchanged', grounded, error: (err as Error).message.slice(0, 160) };
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
  const dfsCfg = loadDfsConfig();

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[fix-advice-leak] provider=${provider} model=${client.model}`);
  console.log(
    `[fix-advice-leak] grounding=${dfsCfg ? 'on' : 'off'} dryRun=${args.dryRun} concurrency=${args.concurrency}`,
  );

  // Step 1 — lightweight scan to find leaker slugs with the SHARED gate.
  const scanned = await scanAdvice(supabase, args.slugs);
  const leakerSlugs = scanned.filter((r) => adviceLeaks(r.concierge_advice)).map((r) => r.slug);
  const targetSlugs = args.limit !== undefined ? leakerSlugs.slice(0, args.limit) : leakerSlugs;

  console.log(
    `[fix-advice-leak] scanned ${scanned.length} published w/ advice, ${leakerSlugs.length} leaking (hasLeak gate)${
      args.limit !== undefined ? `, processing ${targetSlugs.length}` : ''
    }.`,
  );
  if (targetSlugs.length === 0) {
    console.log('[fix-advice-leak] nothing to do.');
    return;
  }

  // Step 2 — fetch the full HotelRow (heavy columns) only for the leakers,
  // batched by slug so the heavy-column select never times out.
  const capped: HotelRow[] = [];
  const BATCH = 50;
  for (let i = 0; i < targetSlugs.length; i += BATCH) {
    const batch = targetSlugs.slice(i, i + BATCH);
    const rows = await listHotels(supabase, {
      onlyPublished: true,
      requireDescription: false,
      slugs: batch,
    });
    capped.push(...rows);
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    capped,
    args.concurrency,
    (row) => fixHotel(client, supabase, dfsCfg, row, { dryRun: args.dryRun }),
    (done, total, last) => {
      const tag =
        last.action === 'regenerated'
          ? `OK regen (${last.attempts}x, ${last.tip_for}, grounding=${last.grounded ? 'on' : 'off'})`
          : last.action === 'nulled'
            ? `NULLED (thin source): ${last.error}`
            : `UNCHANGED err: ${last.error}`;
      console.log(`[fix-advice-leak] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${tag}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const regenerated = results.filter((r) => r.action === 'regenerated').length;
  const nulled = results.filter((r) => r.action === 'nulled').length;
  const unchanged = results.filter((r) => r.action === 'unchanged').length;

  console.log('---');
  console.log(`[fix-advice-leak] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[fix-advice-leak] regenerated=${regenerated} nulled=${nulled} unchanged(error)=${unchanged}`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `fix-advice-leak-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        grounding: dfsCfg ? 'on' : 'off',
        dryRun: args.dryRun,
        scanned: scanned.length,
        leaking: leakerSlugs.length,
        processed: capped.length,
        regenerated,
        nulled,
        unchanged,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[fix-advice-leak] run log → ${logPath}`);

  if (unchanged > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[fix-advice-leak] FATAL', err);
  process.exit(1);
});
