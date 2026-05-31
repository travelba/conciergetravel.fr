/**
 * WS5 phase 4 — Concierge humanizer for `hotels.faq_content` (ADR-0011 C1).
 *
 * Reads the published hotels with at least one FAQ item, batches their
 * Q&A by group of `--batch-size` (default 10, max 20), asks the LLM
 * for one Concierge-voice rewrite per answer + a `featured` flag
 * (5 best per hotel) + an OPTIONAL `concierge_tip_fr` (0-2 per hotel),
 * validates the output (Zod + lexical linter), then merges the
 * rewritten fields back into the jsonb column. The questions
 * themselves and the `category` are NEVER rewritten — humanizer only
 * touches `answer_fr`, `featured`, `concierge_tip_fr`.
 *
 * Featured curation
 * -----------------
 * The prompt asks the LLM to mark exactly 5 items as `featured: true`.
 * Reality: the LLM sometimes overshoots (8/12) or undershoots (3/4).
 * The merge step **clamps the count to 5** by:
 *   1. keeping the first 5 LLM-marked items (source order); OR
 *   2. when < 5 are marked, picking the next-best by category priority
 *      (before > during > after > agency) until we hit 5.
 * Hotels with strictly < 5 FAQs are skipped from the featured trimming
 * and simply mark all available items as featured — the reader's UI
 * component (`<TopConciergeFaq>`) self-elides when `length < 5`.
 *
 * Match key
 * ---------
 * Each FAQ item is identified to the LLM via `question_fr` (the FR
 * question text is the most stable identifier — the answer key is
 * unstable since we're rewriting it). For items with no `question_fr`,
 * we fall back to `question_en`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-faq.ts --slug le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/concierge/run-humanizer-faq.ts --all --concurrency 4
 *
 * Flags:
 *   --slug <s>       cible un seul hôtel
 *   --slugs <a,b,c>  cible un sous-ensemble explicite
 *   --all            tous les hôtels publiés avec ≥ 1 FAQ item
 *   --missing        hôtels avec ≥ 1 FAQ sans answer_fr
 *   --invalid        re-check (lint blocker) des hôtels avec answer_fr qui
 *                    dépasse 25 mots / contient une banned phrase / a 0
 *                    item featured
 *   --concurrency N  parallélisme (défaut: 1)
 *   --dry-run        affiche sans écrire en base
 *   --batch-size N   nombre de FAQs par appel LLM (défaut: 10, max: 20)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { lintConciergeSummary } from '../linter.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { ConciergeFaqBatchSchema, type ConciergeFaqAnswer } from '../schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const PROMPT_PATH = path.resolve(__dirname, '../../prompts/11-concierge-faq.md');
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;
const FEATURED_CAP = 5;
// Concierge answers run the gamut: a check-in time fits in 20 words,
// a restaurant write-up needs 60. We accept anything from a tight
// single sentence (15 words) to a 110-word paragraph. Anything below
// 15 is suspicious (truncated LLM output) and anything above 110 is
// padding the LLM didn't need (the prompt asks for 50-110 as a soft
// target, the hard floor is 15).
const ANSWER_MIN_WORDS = 15;
const ANSWER_MAX_WORDS = 110;
const TIPS_MAX_PER_HOTEL = 2;

// Category priority used when the LLM under-marks featured items.
// Mirrors the editorial intuition: before-stay questions are the most
// actionable for a soon-to-book traveller.
const CATEGORY_PRIORITY = ['before', 'during', 'after', 'agency'] as const;

interface CliArgs {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly missing: boolean;
  readonly invalid: boolean;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly batchSize: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let slugs: readonly string[] = [];
  let all = false;
  let missing = false;
  let invalid = false;
  let concurrency = 1;
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--slug' && i + 1 < argv.length) {
      slug = argv[i + 1] ?? null;
      i += 2;
    } else if (a === '--slugs' && i + 1 < argv.length) {
      slugs = (argv[i + 1] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 2;
    } else if (a === '--all') {
      all = true;
      i += 1;
    } else if (a === '--missing') {
      missing = true;
      i += 1;
    } else if (a === '--invalid') {
      invalid = true;
      i += 1;
    } else if (a === '--concurrency' && i + 1 < argv.length) {
      concurrency = Math.max(1, Number.parseInt(argv[i + 1] ?? '1', 10) || 1);
      i += 2;
    } else if (a === '--batch-size' && i + 1 < argv.length) {
      const raw = Number.parseInt(argv[i + 1] ?? `${DEFAULT_BATCH_SIZE}`, 10) || DEFAULT_BATCH_SIZE;
      batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, raw));
      i += 2;
    } else if (a === '--dry-run') {
      dryRun = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return { slug, slugs, all, missing, invalid, concurrency, dryRun, batchSize };
}

// Ported off `pg` (no DATABASE_URL on this machine) to the service-role
// PostgREST path — same pattern as the photo/geo/enrichment orchestrators.
function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing in .env.local');
  }
  if (typeof key !== 'string' || key.length < 40) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  return { url, serviceRoleKey: key };
}

interface FaqInDb {
  readonly question_fr?: string;
  readonly question_en?: string;
  readonly answer_fr?: string;
  readonly answer_en?: string;
  readonly category?: 'before' | 'during' | 'after' | 'agency';
  readonly featured?: boolean;
  readonly concierge_tip_fr?: string;
  readonly concierge_tip_en?: string;
  readonly [k: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly faq_content: readonly FaqInDb[] | null;
}

function matchKey(f: FaqInDb): string | null {
  if (typeof f.question_fr === 'string' && f.question_fr.trim().length > 0) {
    return f.question_fr.trim();
  }
  if (typeof f.question_en === 'string' && f.question_en.trim().length > 0) {
    return f.question_en.trim();
  }
  return null;
}

function countWords(s: string): number {
  const t = s.trim();
  if (!t.length) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

async function listSlugs(cfg: SupabaseRestConfig, args: CliArgs): Promise<readonly string[]> {
  if (args.slug !== null) return [args.slug];
  if (args.slugs.length > 0) return args.slugs;
  // `jsonb_array_length(coalesce(faq_content,'[]')) > 0` → keep rows whose
  // faq_content is a non-empty array (filtered client-side; PostgREST has
  // no array-length filter).
  const rows = await selectHotels<{ slug: string; faq_content: unknown }>(cfg, {
    columns: 'slug,faq_content',
    filters: ['is_published=eq.true', 'faq_content=not.is.null'],
    order: 'slug.asc',
  });
  return rows
    .filter((r) => Array.isArray(r.faq_content) && r.faq_content.length > 0)
    .map((r) => r.slug);
}

async function fetchHotel(cfg: SupabaseRestConfig, slug: string): Promise<HotelRow | null> {
  const rows = await selectHotels<HotelRow>(cfg, {
    columns: 'id,slug,name,city,faq_content',
    filters: [`slug=eq.${slug}`],
    limit: 1,
  });
  return rows[0] ?? null;
}

function pickFaqsToRewrite(faqs: readonly FaqInDb[], args: CliArgs): readonly FaqInDb[] {
  const withKey = faqs.filter((f) => matchKey(f) !== null);
  if (args.missing) {
    return withKey.filter(
      (f) => typeof f.answer_fr !== 'string' || f.answer_fr.trim().length === 0,
    );
  }
  if (args.invalid) {
    return withKey.filter((f) => {
      if (typeof f.answer_fr !== 'string' || f.answer_fr.trim().length === 0) return true;
      const summary = lintConciergeSummary(f.answer_fr);
      if (!summary.clean) return true;
      const wc = countWords(f.answer_fr);
      if (wc < ANSWER_MIN_WORDS || wc > ANSWER_MAX_WORDS) return true;
      return false;
    });
  }
  return withKey;
}

// ---------------------------------------------------------------------------
// Prompt assembly + LLM call.
// ---------------------------------------------------------------------------

function localisedQuestion(f: FaqInDb): string {
  return f.question_fr ?? f.question_en ?? '';
}

function localisedAnswer(f: FaqInDb): string {
  return f.answer_fr ?? f.answer_en ?? '';
}

function buildUserPrompt(row: HotelRow, batch: readonly FaqInDb[]): string {
  const compact = batch.map((f) => ({
    match_key: matchKey(f),
    question: localisedQuestion(f),
    category: f.category ?? 'before',
    current_answer: localisedAnswer(f),
  }));
  const input = {
    hotel: { name: row.name, city: row.city },
    faqs: compact,
  };
  return `=== INPUT ===\n${JSON.stringify(input, null, 2)}`;
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  const inner = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(inner);
  } catch {
    const first = inner.indexOf('{');
    const last = inner.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(inner.slice(first, last + 1));
    throw new Error('Pass 11 response is not valid JSON.');
  }
}

// ---------------------------------------------------------------------------
// Merge step. Rebuilds the full `faq_content` array preserving the
// source order and every untouched field. Cleans up the global
// `featured` count to exactly 5 (clamp + backfill) and the tip count
// to ≤ 2 (drop overflow tips). Question text and category are never
// overwritten.
// ---------------------------------------------------------------------------

interface MergeOutput {
  readonly merged: readonly FaqInDb[];
  readonly rewroteAnswer: number;
  readonly featuredFinal: number;
  readonly tipsFinal: number;
}

function categoryPriority(cat: FaqInDb['category']): number {
  const idx = CATEGORY_PRIORITY.indexOf((cat ?? 'before') as (typeof CATEGORY_PRIORITY)[number]);
  return idx < 0 ? CATEGORY_PRIORITY.length : idx;
}

function clampFeatured(
  merged: FaqInDb[],
  rewriteByKey: Map<string, ConciergeFaqAnswer>,
  isPartialRewrite: boolean,
): { featuredFinal: number } {
  // ---------------------------------------------------------------
  // Partial rewrite path (--invalid / --missing) — preserve existing
  // featured marks on items that were NOT rewritten this run. Only
  // backfill from the rewrite set when the final count is < 5.
  // ---------------------------------------------------------------
  if (isPartialRewrite) {
    const finalFeatured = new Set<number>();
    // Step P1 — keep every item that was featured before AND survived
    // intact (not rewritten, so its featured mark is the truth).
    for (let i = 0; i < merged.length; i++) {
      const f = merged[i]!;
      const key = matchKey(f);
      const wasRewritten = key !== null && rewriteByKey.has(key);
      if (!wasRewritten && f.featured === true) finalFeatured.add(i);
    }
    // Step P2 — for rewritten items, trust the LLM's `featured` mark
    // up to the cap.
    for (let i = 0; i < merged.length; i++) {
      const f = merged[i]!;
      const key = matchKey(f);
      if (key === null) continue;
      const r = rewriteByKey.get(key);
      if (r === undefined) continue;
      if (r.featured && finalFeatured.size < FEATURED_CAP) finalFeatured.add(i);
    }
    // Step P3 — backfill from non-featured rewrites if still short.
    if (finalFeatured.size < FEATURED_CAP) {
      const remaining: number[] = [];
      for (let i = 0; i < merged.length; i++) {
        if (finalFeatured.has(i)) continue;
        const key = matchKey(merged[i]!);
        if (key !== null && rewriteByKey.has(key)) remaining.push(i);
      }
      remaining.sort((a, b) => {
        const pa = categoryPriority(merged[a]?.category);
        const pb = categoryPriority(merged[b]?.category);
        if (pa !== pb) return pa - pb;
        return a - b;
      });
      for (const i of remaining) {
        if (finalFeatured.size >= FEATURED_CAP) break;
        finalFeatured.add(i);
      }
    }
    for (let i = 0; i < merged.length; i++) {
      const f = merged[i]!;
      (merged[i] as { featured?: boolean }) = { ...f, featured: finalFeatured.has(i) };
    }
    return { featuredFinal: finalFeatured.size };
  }

  // ---------------------------------------------------------------
  // Full rewrite path (--all / --slug / --slugs) — only items that
  // were rewritten (== every item with a match_key) are eligible. We
  // clamp the LLM's curation to exactly 5.
  // ---------------------------------------------------------------
  const eligible: number[] = [];
  for (let i = 0; i < merged.length; i++) {
    const f = merged[i];
    if (!f) continue;
    const key = matchKey(f);
    if (key !== null && rewriteByKey.has(key)) eligible.push(i);
  }

  const llmFeatured: number[] = [];
  const llmNotFeatured: number[] = [];
  for (const i of eligible) {
    const f = merged[i]!;
    const key = matchKey(f)!;
    const r = rewriteByKey.get(key)!;
    if (r.featured) llmFeatured.push(i);
    else llmNotFeatured.push(i);
  }

  const finalFeatured = new Set<number>();
  for (const i of llmFeatured) {
    if (finalFeatured.size >= FEATURED_CAP) break;
    finalFeatured.add(i);
  }
  if (finalFeatured.size < FEATURED_CAP) {
    const backfill = [...llmNotFeatured].sort((a, b) => {
      const ca = merged[a]?.category;
      const cb = merged[b]?.category;
      const pa = categoryPriority(ca);
      const pb = categoryPriority(cb);
      if (pa !== pb) return pa - pb;
      return a - b;
    });
    for (const i of backfill) {
      if (finalFeatured.size >= FEATURED_CAP) break;
      finalFeatured.add(i);
    }
  }
  if (eligible.length < FEATURED_CAP) {
    finalFeatured.clear();
    for (const i of eligible) finalFeatured.add(i);
  }
  for (let i = 0; i < merged.length; i++) {
    const f = merged[i]!;
    (merged[i] as { featured?: boolean }) = { ...f, featured: finalFeatured.has(i) };
  }
  return { featuredFinal: finalFeatured.size };
}

function mergeRewrites(
  original: readonly FaqInDb[],
  rewrites: readonly ConciergeFaqAnswer[],
  isPartialRewrite: boolean,
): MergeOutput {
  const byKey = new Map<string, ConciergeFaqAnswer>();
  for (const r of rewrites) byKey.set(r.match_key, r);

  let rewroteAnswer = 0;
  let tipsFinal = 0;
  const merged: FaqInDb[] = [];

  for (const f of original) {
    const key = matchKey(f);
    const next: FaqInDb = { ...f };
    if (key !== null) {
      const r = byKey.get(key);
      if (r !== undefined) {
        if (r.answer_fr.length > 0) {
          (next as { answer_fr?: string }).answer_fr = r.answer_fr;
          rewroteAnswer += 1;
        }
        if (
          r.concierge_tip_fr !== undefined &&
          r.concierge_tip_fr.length > 0 &&
          tipsFinal < TIPS_MAX_PER_HOTEL
        ) {
          (next as { concierge_tip_fr?: string }).concierge_tip_fr = r.concierge_tip_fr;
          tipsFinal += 1;
        } else if (!isPartialRewrite && r.concierge_tip_fr === undefined) {
          // Full-rewrite path: the LLM saw the whole hotel and chose
          // not to emit a tip on this item — drop any legacy tip so
          // the UI doesn't surface stale text.
          delete (next as { concierge_tip_fr?: string }).concierge_tip_fr;
        } else if (!isPartialRewrite) {
          // Tip emitted but overflowed the cap — drop it silently.
          delete (next as { concierge_tip_fr?: string }).concierge_tip_fr;
        }
        // Partial-rewrite path: preserve the existing tip when the LLM
        // omits one (we didn't see the whole hotel, can't curate).
      }
    }
    merged.push(next);
  }

  const { featuredFinal } = clampFeatured(merged, byKey, isPartialRewrite);

  // For partial rewrites, count tips on the final merged set rather
  // than the in-flight `tipsFinal` (which only captures new tips).
  if (isPartialRewrite) {
    tipsFinal = merged.reduce(
      (s, f) =>
        s +
        (typeof f.concierge_tip_fr === 'string' && f.concierge_tip_fr.trim().length > 0 ? 1 : 0),
      0,
    );
  }

  return { merged, rewroteAnswer, featuredFinal, tipsFinal };
}

interface BatchResult {
  readonly accepted: readonly ConciergeFaqAnswer[];
  readonly rejected: number;
  readonly lintBlockers: number;
  readonly tokens: { readonly input: number; readonly output: number };
}

function validateLlmAnswer(item: ConciergeFaqAnswer): {
  readonly ok: boolean;
  readonly reasons: readonly string[];
} {
  const lint = lintConciergeSummary(item.answer_fr);
  const wc = countWords(item.answer_fr);
  const tipLint =
    item.concierge_tip_fr !== undefined && item.concierge_tip_fr.length > 0
      ? lintConciergeSummary(item.concierge_tip_fr)
      : null;
  const wordOk = wc >= ANSWER_MIN_WORDS && wc <= ANSWER_MAX_WORDS;
  const reasons: string[] = [];
  if (!wordOk) reasons.push(`words=${wc} (target ${ANSWER_MIN_WORDS}–${ANSWER_MAX_WORDS})`);
  if (!lint.clean) {
    reasons.push(
      `lint=${lint.violations
        .filter((v) => v.severity === 'blocker')
        .map((v) => v.term ?? v.category)
        .join(',')}`,
    );
  }
  if (tipLint !== null && !tipLint.clean) reasons.push('tip-lint');
  return { ok: reasons.length === 0, reasons };
}

/**
 * Run a single LLM call against a batch, return the parsed array + lint
 * decisions per item. Pure transformation — no retry logic.
 */
async function runBatchOnce(
  prompt: string,
  row: HotelRow,
  batch: readonly FaqInDb[],
  temperature: number,
  extraInstruction: string | null,
): Promise<{
  readonly items: readonly ConciergeFaqAnswer[];
  readonly tokens: { readonly input: number; readonly output: number };
}> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  const userPrompt =
    extraInstruction !== null
      ? `${buildUserPrompt(row, batch)}\n\n=== REMINDER ===\n${extraInstruction}`
      : buildUserPrompt(row, batch);
  const result = await llm.call({
    systemPrompt: prompt,
    userPrompt,
    temperature,
    maxOutputTokens: 3500,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  const raw = extractJsonObject(result.content);
  const parsed = ConciergeFaqBatchSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Pass 11 schema validation failed:\n${issues}`);
  }
  return {
    items: parsed.data.faqs,
    tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  };
}

/**
 * Per-batch retry harness: keep calling the LLM (up to MAX_ATTEMPTS)
 * until every input item has an accepted output, OR we've exhausted
 * attempts. On each retry we bump the temperature and inject a hint
 * recapping the items that still need a fix and *why* (lint reason).
 *
 * The harness merges results across attempts: an item is accepted the
 * first time it passes — later attempts only target the still-failing
 * keys, which keeps token usage bounded.
 */
async function runBatch(
  prompt: string,
  row: HotelRow,
  batch: readonly FaqInDb[],
): Promise<BatchResult> {
  const MAX_ATTEMPTS = 3;
  const TEMPERATURES = [0.6, 0.85, 0.95];
  const debug = process.env['CONCIERGE_FAQ_DEBUG'] === '1';

  const accepted = new Map<string, ConciergeFaqAnswer>();
  const tokens = { input: 0, output: 0 };
  let lastRejectedKeys: string[] = [];
  let lintBlockers = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pending = batch.filter((f) => {
      const k = matchKey(f);
      return k !== null && !accepted.has(k);
    });
    if (pending.length === 0) break;

    let extraInstruction: string | null = null;
    if (attempt > 0 && lastRejectedKeys.length > 0) {
      extraInstruction =
        `Tentative ${attempt + 1}/${MAX_ATTEMPTS}. Les réponses précédentes ont été rejetées car ` +
        `une ou plusieurs phrases dépassaient 25 mots, ou contenaient des mots bannis (style-guide §4). ` +
        `Pour chaque question, écris 2 à 4 phrases COURTES (≤ 25 mots chacune), au présent, voix active. ` +
        `Total ${ANSWER_MIN_WORDS}–${ANSWER_MAX_WORDS} mots. ` +
        `Concentre-toi sur les match_keys : ${lastRejectedKeys.slice(0, 8).join(', ')}.`;
    }

    let res: Awaited<ReturnType<typeof runBatchOnce>>;
    try {
      res = await runBatchOnce(
        prompt,
        row,
        pending,
        TEMPERATURES[attempt] ?? 0.95,
        extraInstruction,
      );
    } catch (e: unknown) {
      if (attempt === MAX_ATTEMPTS - 1) throw e;
      lastRejectedKeys = pending.map((f) => matchKey(f) ?? '').filter((k) => k.length > 0);
      continue;
    }
    tokens.input += res.tokens.input;
    tokens.output += res.tokens.output;

    const nextRejected: string[] = [];
    for (const item of res.items) {
      const v = validateLlmAnswer(item);
      if (v.ok) {
        accepted.set(item.match_key, item);
      } else {
        nextRejected.push(item.match_key);
        if (debug) {
          console.warn(
            `  [reject t=${TEMPERATURES[attempt]} ${item.match_key.slice(0, 50)}] ${v.reasons.join(' | ')} :: "${item.answer_fr.slice(0, 100)}"`,
          );
        }
        const lint = lintConciergeSummary(item.answer_fr);
        lintBlockers += lint.blocker;
      }
    }
    // Items the LLM completely skipped this round still count as
    // pending — surface their keys so the next attempt re-targets them.
    const returnedKeys = new Set(res.items.map((i) => i.match_key));
    for (const f of pending) {
      const k = matchKey(f);
      if (k !== null && !returnedKeys.has(k) && !accepted.has(k)) nextRejected.push(k);
    }
    lastRejectedKeys = nextRejected;
    if (nextRejected.length === 0) break;
  }

  // Final tally — anything still missing is a permanent reject.
  const acceptedArr = Array.from(accepted.values());
  let rejected = 0;
  for (const f of batch) {
    const k = matchKey(f);
    if (k !== null && !accepted.has(k)) rejected += 1;
  }
  return { accepted: acceptedArr, rejected, lintBlockers, tokens };
}

interface RunResult {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed';
  readonly reason?: string;
  readonly rewroteAnswer?: number;
  readonly featuredFinal?: number;
  readonly tipsFinal?: number;
  readonly batches?: number;
  readonly tokens?: { input: number; output: number };
}

async function runOne(
  cfg: SupabaseRestConfig,
  slug: string,
  prompt: string,
  args: CliArgs,
): Promise<RunResult> {
  const row = await fetchHotel(cfg, slug);
  if (row === null) return { slug, status: 'failed', reason: 'hotel not found' };
  const faqs = row.faq_content ?? [];
  if (faqs.length === 0) return { slug, status: 'skipped', reason: 'no FAQs' };

  const toRewrite = pickFaqsToRewrite(faqs, args);
  if (toRewrite.length === 0) return { slug, status: 'skipped', reason: 'nothing to rewrite' };

  const batches: FaqInDb[][] = [];
  for (let i = 0; i < toRewrite.length; i += args.batchSize) {
    batches.push(toRewrite.slice(i, i + args.batchSize));
  }

  const aggregated: ConciergeFaqAnswer[] = [];
  const tokens = { input: 0, output: 0 };
  let totalRejected = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;
    try {
      const result = await runBatch(prompt, row, batch);
      aggregated.push(...result.accepted);
      tokens.input += result.tokens.input;
      tokens.output += result.tokens.output;
      totalRejected += result.rejected;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { slug, status: 'failed', reason: `batch ${bi + 1}/${batches.length}: ${msg}` };
    }
  }

  if (aggregated.length === 0) {
    return {
      slug,
      status: 'failed',
      reason: `every batch rejected (${totalRejected} items failed lint or shape)`,
    };
  }

  const isPartialRewrite = args.missing || args.invalid;
  const { merged, rewroteAnswer, featuredFinal, tipsFinal } = mergeRewrites(
    faqs,
    aggregated,
    isPartialRewrite,
  );

  if (args.dryRun) {
    return {
      slug,
      status: 'ok',
      reason: `[dry-run] answer=${rewroteAnswer} featured=${featuredFinal} tips=${tipsFinal} rejected=${totalRejected}`,
      rewroteAnswer,
      featuredFinal,
      tipsFinal,
      batches: batches.length,
      tokens,
    };
  }

  await patchHotelById(cfg, row.id, {
    faq_content: merged,
    updated_at: new Date().toISOString(),
  });

  return {
    slug,
    status: 'ok',
    reason: `answer=${rewroteAnswer} featured=${featuredFinal} tips=${tipsFinal} rejected=${totalRejected} batches=${batches.length}`,
    rewroteAnswer,
    featuredFinal,
    tipsFinal,
    batches: batches.length,
    tokens,
  };
}

async function runWithConcurrency(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
  prompt: string,
  args: CliArgs,
): Promise<readonly RunResult[]> {
  const queue = [...slugs];
  const out: RunResult[] = [];
  let active = 0;
  let started = 0;
  const total = slugs.length;
  return new Promise((resolveAll) => {
    const tick = (): void => {
      while (active < args.concurrency && queue.length > 0) {
        const slug = queue.shift();
        if (slug === undefined) break;
        active += 1;
        started += 1;
        const idx = started;
        console.log(`[${idx}/${total}] start ${slug} (active=${active})`);
        runOne(cfg, slug, prompt, args)
          .then((r) => {
            out.push(r);
            const tag = r.status === 'ok' ? 'OK' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
            const tokens = r.tokens ? ` ${r.tokens.input}→${r.tokens.output}t` : '';
            console.log(`[${idx}/${total}] ${tag} ${slug}${tokens} — ${r.reason ?? ''}`);
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);
            out.push({ slug, status: 'failed', reason: msg });
            console.warn(`[${idx}/${total}] EXC ${slug} — ${msg}`);
          })
          .finally(() => {
            active -= 1;
            if (queue.length === 0 && active === 0) resolveAll(out);
            else tick();
          });
      }
      if (queue.length === 0 && active === 0) resolveAll(out);
    };
    tick();
  });
}

async function writeRunLog(results: readonly RunResult[]): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(__dirname, '../../out');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `faq-concierge-runlog-${ts}.jsonl`);
  const body = results.map((r) => JSON.stringify(r)).join('\n');
  await fs.writeFile(filePath, body + '\n', 'utf8');
  return filePath;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (
    !args.all &&
    !args.missing &&
    !args.invalid &&
    args.slug === null &&
    args.slugs.length === 0
  ) {
    console.error(
      'Usage: --slug <s> | --slugs <a,b,c> | --all | --missing | --invalid  [--concurrency N] [--dry-run] [--batch-size N]',
    );
    process.exit(2);
  }
  const prompt = await fs.readFile(PROMPT_PATH, 'utf8');
  const cfg = loadRestConfig();
  {
    const slugs = await listSlugs(cfg, args);
    console.log(
      `[concierge-faq-humanizer] targets: ${slugs.length} hotel(s), concurrency=${args.concurrency}, batchSize=${args.batchSize}, dryRun=${args.dryRun}`,
    );
    if (slugs.length === 0) {
      console.log('Nothing to do.');
      return;
    }
    const results = await runWithConcurrency(cfg, slugs, prompt, args);
    const ok = results.filter((r) => r.status === 'ok').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const ans = results.reduce((s, r) => s + (r.rewroteAnswer ?? 0), 0);
    const ftr = results.reduce((s, r) => s + (r.featuredFinal ?? 0), 0);
    const tips = results.reduce((s, r) => s + (r.tipsFinal ?? 0), 0);
    const tokens = results.reduce(
      (s, r) => ({
        input: s.input + (r.tokens?.input ?? 0),
        output: s.output + (r.tokens?.output ?? 0),
      }),
      { input: 0, output: 0 },
    );
    const runLogPath = await writeRunLog(results);
    console.log(`\n=== Summary ===`);
    console.log(`  ok        : ${ok}`);
    console.log(`  skipped   : ${skipped}`);
    console.log(`  failed    : ${failed}`);
    console.log(`  answer rewrites : ${ans}`);
    console.log(`  featured final  : ${ftr}`);
    console.log(`  tips final      : ${tips}`);
    console.log(`  total tokens in/out : ${tokens.input} / ${tokens.output}`);
    console.log(`  runlog    : ${runLogPath}`);
    if (failed > 0) process.exitCode = 2;
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
