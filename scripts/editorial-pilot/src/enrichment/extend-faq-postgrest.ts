/**
 * extend-faq-postgrest.ts — PostgREST variant of extend-faq-to-10.ts.
 *
 * Same prompt, same envelope (10-15 Q&A, 50-100 words/answer, ban
 * superlatives, no HTML), but reads/writes via PostgREST so it runs
 * on machines without `SUPABASE_DB_POOLER_URL` set (.env.local on
 * Windows shipped with `NEXT_PUBLIC_SUPABASE_URL` +
 * `SUPABASE_SERVICE_ROLE_KEY` only).
 *
 * Drops the `long_description_sections is not null` constraint from
 * the legacy script — Phase 1 drafts seeded by `seed-tier1-content`
 * have a description but no premium sections, and the FAQ should
 * still ship as a publish gate.
 *
 * CLI:
 *   --slug=foo                 single hotel debug
 *   --slugs=a,b,c              explicit list
 *   --include-drafts           include is_published=false rows (default off)
 *   --include-published        include is_published=true rows (default on)
 *   --target=12                target item count (default 12, 10-15 allowed)
 *   --concurrency=8            parallel LLM calls (default 4)
 *   --limit=N                  cap eligible rows
 *   --dry-run                  generate + log, do NOT persist
 *
 * Skill: editorial-pilot, llm-output-robustness, content-modeling.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

interface FaqItem {
  question_fr?: string;
  question?: string;
  answer_fr?: string;
  answer?: string;
  question_en?: string;
  answer_en?: string;
}

interface HotelRow {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  address: string | null;
  description_fr: string | null;
  faq_content: FaqItem[] | null;
  policies: Record<string, unknown> | null;
  number_of_rooms: number | null;
  is_published: boolean;
}

const FaqGenSchema = z.object({
  items: z
    .array(
      z.object({
        question_fr: z.string().min(8).max(200),
        answer_fr: z.string().min(40).max(500),
        question_en: z.string().min(8).max(200).default(''),
        answer_en: z.string().min(40).max(500).default(''),
      }),
    )
    .min(1)
    .max(15),
});
type FaqGenItems = z.infer<typeof FaqGenSchema>['items'];

const SYSTEM_PROMPT = `Tu es éditrice expérimentée pour MyConciergeHotel.com, agence IATA de palaces.
Tu produis des FAQ factuelles en FR et EN simultanément pour les fiches d'hôtel.
Règles strictes :
- 1 question = 1 réponse claire en 50-100 mots.
- Questions canoniques privilégiées : parking, petit-déjeuner, Wi-Fi, animaux, distance aéroport/gare, piscine, check-in anticipé, transferts, annulation, taxes de séjour, équipements famille, services pour PMR.
- Si tu n'as pas l'info exacte, donne une réponse générique honnête ("Contactez la conciergerie pour confirmer les modalités du jour") plutôt que d'inventer un chiffre.
- Ne reproduis JAMAIS une question déjà présente dans la liste fournie.
- JSON STRICT : { items: [{ question_fr, answer_fr, question_en, answer_en }] }.
- Aucune balise HTML, aucun emoji.`;

function buildUserPrompt(hotel: HotelRow, missingCount: number): string {
  const existingQs = (hotel.faq_content ?? [])
    .map((q, i) => `${i + 1}. ${q.question_fr ?? q.question ?? ''}`)
    .join('\n');
  return [
    `Hôtel : ${hotel.name}`,
    `Ville : ${hotel.city ?? '?'}`,
    `Région : ${hotel.region ?? '?'}`,
    `Adresse : ${hotel.address ?? '?'}`,
    `Nombre de chambres : ${hotel.number_of_rooms ?? '?'}`,
    `Description (extrait) : ${(hotel.description_fr ?? '').slice(0, 400)}`,
    '',
    'Questions DÉJÀ présentes (à NE PAS reproduire) :',
    existingQs.length > 0 ? existingQs : '(aucune)',
    '',
    `Génère exactement ${missingCount} question(s)/réponse(s) supplémentaires en FR + EN dans le JSON demandé.`,
  ].join('\n');
}

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      '[faq] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local',
    );
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PostgrestEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

async function fetchEligibleHotels(
  env: PostgrestEnv,
  opts: {
    includeDrafts: boolean;
    includePublished: boolean;
    slugs?: readonly string[];
    limit?: number;
  },
): Promise<HotelRow[]> {
  const cols =
    'slug,name,city,region,address,description_fr,faq_content,policies,number_of_rooms,is_published';
  const params = new URLSearchParams();
  params.set('select', cols);
  // Drafts and/or published, depending on flags.
  if (opts.includeDrafts && opts.includePublished) {
    // No filter on is_published.
  } else if (opts.includeDrafts) {
    params.set('is_published', 'eq.false');
  } else if (opts.includePublished) {
    params.set('is_published', 'eq.true');
  }
  // PostgREST lets us filter by jsonb_array_length via `or=(..)`.
  // Cleanest: only include rows where description_fr is non-null
  // (we cannot prompt without one) AND the FAQ is short.
  params.set('description_fr', 'not.is.null');
  if (opts.slugs && opts.slugs.length > 0) {
    params.set('slug', `in.(${opts.slugs.join(',')})`);
  }
  params.set('order', 'slug.asc');
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));

  // We can't filter on `jsonb_array_length(faq_content) < 10` server-
  // side without an RPC, so we fetch then filter client-side. For our
  // 1.5k drafts that's ~5 MB — acceptable.
  const PAGE = 1000;
  const all: HotelRow[] = [];
  let from = 0;
  while (true) {
    const url = `${env.restBase}/hotels?${params.toString()}`;
    const r = await fetch(url, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!r.ok) {
      throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    const batch = (await r.json()) as HotelRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    if (opts.limit !== undefined && all.length >= opts.limit) break;
    from += PAGE;
  }
  // Client-side filter: keep only rows with FAQ < 10.
  const filtered = all.filter((h) => (h.faq_content ?? []).length < 10);
  return opts.limit !== undefined ? filtered.slice(0, opts.limit) : filtered;
}

async function persistFaqExtension(
  env: PostgrestEnv,
  hotel: HotelRow,
  items: FaqGenItems,
): Promise<number> {
  const existing = hotel.faq_content ?? [];
  const seen = new Set<string>(
    existing
      .map((q) => (q.question_fr ?? q.question ?? '').toLowerCase().trim())
      .filter((s) => s.length > 0),
  );
  const newItems = items
    .filter((it) => !seen.has(it.question_fr.toLowerCase().trim()))
    .map((it) => ({
      question_fr: it.question_fr,
      answer_fr: it.answer_fr,
      question_en: it.question_en.length > 8 ? it.question_en : undefined,
      answer_en: it.answer_en.length > 40 ? it.answer_en : undefined,
    }));
  if (newItems.length === 0) return 0;
  const merged = [...existing, ...newItems];

  const url = `${env.restBase}/hotels?slug=eq.${encodeURIComponent(hotel.slug)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ faq_content: merged }),
  });
  if (!r.ok) {
    throw new Error(
      `PostgREST PATCH ${hotel.slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
  }
  return newItems.length;
}

async function extendOne(
  openai: OpenAI,
  hotel: HotelRow,
  targetCount: number,
): Promise<FaqGenItems> {
  const currentCount = (hotel.faq_content ?? []).length;
  const missing = Math.max(0, targetCount - currentCount);
  if (missing === 0) return [];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini-2024-07-18',
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 2400,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(hotel, missing) },
    ],
  });
  const raw = response.choices[0]?.message.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }
  const validated = FaqGenSchema.parse(parsed);
  return validated.items;
}

interface CliArgs {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly includeDrafts: boolean;
  readonly includePublished: boolean;
  readonly target: number;
  readonly concurrency: number;
  readonly limit: number | null;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let slugs: string[] = [];
  let includeDrafts = false;
  let includePublished = true;
  let target = 12;
  let concurrency = 4;
  let limit: number | null = null;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--include-drafts') includeDrafts = true;
    else if (a === '--exclude-published') includePublished = false;
    else if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--target=')) {
      const n = Number(a.slice('--target='.length));
      if (Number.isFinite(n) && n >= 10 && n <= 15) target = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { slug, slugs, includeDrafts, includePublished, target, concurrency, limit, dryRun };
}

interface RunEntry {
  readonly slug: string;
  readonly status: 'success' | 'error' | 'noop';
  readonly added?: number;
  readonly error?: string;
  readonly elapsedMs: number;
}

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (true) {
        const i = next++;
        if (i >= total) return;
        const r = await fn(items[i] as T, i);
        results[i] = r;
        done += 1;
        if (onProgress) onProgress(done, total, r);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[faq] target=${args.target} concurrency=${args.concurrency} ` +
      `includeDrafts=${args.includeDrafts} includePublished=${args.includePublished} ` +
      `limit=${args.limit ?? '∞'} dryRun=${args.dryRun}`,
  );

  if (!process.env['OPENAI_API_KEY']) {
    console.error('[faq] OPENAI_API_KEY missing in .env.local');
    process.exit(1);
  }
  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const slugList = args.slug ? [args.slug] : args.slugs;
  const fetchOpts: {
    includeDrafts: boolean;
    includePublished: boolean;
    slugs?: readonly string[];
    limit?: number;
  } = {
    includeDrafts: args.includeDrafts,
    includePublished: args.includePublished,
  };
  if (slugList.length > 0) fetchOpts.slugs = slugList;
  if (args.limit !== null) fetchOpts.limit = args.limit;
  const hotels = await fetchEligibleHotels(env, fetchOpts);
  console.log(`[faq] ${hotels.length} eligible hotel(s) (FAQ < ${args.target}).`);
  if (hotels.length === 0) {
    console.log('[faq] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await runWithConcurrency(hotels, args.concurrency, async (h, idx) => {
    const t0 = Date.now();
    const before = (h.faq_content ?? []).length;
    const tag = `[${String(idx + 1).padStart(4)}/${hotels.length}] ${h.slug} (${before})`;
    try {
      const items = await extendOne(openai, h, args.target);
      const added = args.dryRun ? items.length : await persistFaqExtension(env, h, items);
      const ms = Date.now() - t0;
      console.log(`${tag} ✓ +${added} in ${(ms / 1000).toFixed(1)}s`);
      const result: RunEntry =
        added > 0
          ? { slug: h.slug, status: 'success', added, elapsedMs: ms }
          : { slug: h.slug, status: 'noop', elapsedMs: ms };
      return result;
    } catch (e) {
      const ms = Date.now() - t0;
      const err = (e as Error).message;
      console.log(`${tag} ✗ ${err.slice(0, 120)}`);
      return { slug: h.slug, status: 'error' as const, error: err, elapsedMs: ms };
    }
  });

  const elapsedMs = Date.now() - startedAt;
  const success = results.filter((r) => r.status === 'success').length;
  const noop = results.filter((r) => r.status === 'noop').length;
  const fail = results.filter((r) => r.status === 'error').length;
  console.log('---');
  console.log(`[faq] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`[faq] success=${success} noop=${noop} error=${fail}`);

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNLOG_DIR, `faq-extend-postgrest-${ts}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        args,
        stats: { eligible: hotels.length, success, noop, fail },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`[faq] runlog → ${logPath}`);
}

main().catch((err) => {
  console.error('[faq] FATAL', err);
  process.exit(1);
});
