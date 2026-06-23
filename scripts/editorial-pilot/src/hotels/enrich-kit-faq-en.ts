/**
 * enrich-kit-faq-en.ts — EN parity + CDC D10 informative-tone backfill for
 * the two-tier kit FAQ model (`hotels.faq_content_kit` + `concierge_questions`).
 *
 * Why this exists: `run-faq-canonical.ts` and `run-humanizer-faq.ts` only
 * touch `faq_content` (the 10 canonical promote questions). The richer kit
 * surface (40-82 items) and the concierge Q&A (20-28 items) were generated
 * FR-only on most of the catalogue — the EN side of the page (and the
 * `/api/agent/hotel/[slug]` concierge lens) therefore serves French strings.
 * The publish gate (`evaluateFaqKitRowEnrichment`) blocks on:
 *   - `kit.en_parity`            — kit items missing question_en/answer_en
 *   - `concierge.en_parity`      — concierge items missing question_en/reply_en
 *   - `concierge.informative_tone` (CDC D10) — reply starts with "Je"/"J'"/"I"
 *
 * This pipeline closes all three for one slug (or a list), preserving every
 * existing field (facts, numbers, categories, featured flags) — it ADDS the
 * EN translation and, only for replies flagged D10, rewrites the FR reply to
 * an informative opening. Idempotent: items already bilingual + informative
 * are skipped.
 *
 * Translations are faithful (numbers / proper nouns / prices preserved); the
 * LLM is forbidden from inventing facts absent from the FR source.
 *
 * CLI:
 *   --slug=foo                 single hotel
 *   --slugs=a,b,c              explicit list
 *   --batch-size=8             items per LLM call (default 8, max 15)
 *   --concurrency=4            parallel LLM calls (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: hotel-faq-perplexity-enrichment, llm-output-robustness, editorial-voice.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { evaluateFaqKitRowEnrichment } from './faq-kit-row-enrichment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';

/** Mirrors the D10 commitment-tone regexes in `faq-kit-row-enrichment.ts`. */
const COMMITMENT_FR = /^\s*(je|j['’])\b/i;
const COMMITMENT_EN = /^\s*i\b/i;

interface KitItem {
  category?: unknown;
  group_fr?: unknown;
  group_en?: unknown;
  question_fr?: unknown;
  answer_fr?: unknown;
  question_en?: unknown;
  answer_en?: unknown;
  [k: string]: unknown;
}

interface ConciergeItem {
  category_fr?: unknown;
  category_en?: unknown;
  question_fr?: unknown;
  reply_fr?: unknown;
  question_en?: unknown;
  reply_en?: unknown;
  [k: string]: unknown;
}

interface HotelRow {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  faq_content_kit: KitItem[] | null;
  concierge_questions: ConciergeItem[] | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/* ── PostgREST ──────────────────────────────────────────────────────────── */

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
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

async function fetchHotels(env: PostgrestEnv, slugs: readonly string[]): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'slug,name,city,region,faq_content_kit,concierge_questions,faq_content');
  params.set('slug', `in.(${slugs.join(',')})`);
  const r = await fetch(`${env.restBase}/hotels?${params.toString()}`, { headers: pgHeaders(env) });
  if (!r.ok) {
    throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  return (await r.json()) as HotelRow[];
}

async function patchHotel(
  env: PostgrestEnv,
  slug: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    throw new Error(
      `PostgREST PATCH ${slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
  }
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

const KitEnSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        question_en: z.string().min(4).max(240),
        answer_en: z.string().min(20).max(800),
      }),
    )
    .min(1),
});

const ConciergeEnSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        question_en: z.string().min(4).max(240),
        reply_en: z.string().min(20).max(1200),
        reply_fr_informative: z.string().min(15).max(1200),
      }),
    )
    .min(1),
});

const KIT_SYSTEM = `Tu es traductrice-éditrice pour MyConciergeHotel.com, agence IATA de palaces.
On te donne des FAQ d'hôtel en français. Tu produis la version anglaise FIDÈLE.
Règles strictes :
- Traduis question_fr -> question_en et answer_fr -> answer_en.
- Préserve EXACTEMENT tous les chiffres, prix, horaires, noms propres, distances.
- N'invente AUCUN fait absent du français. Anglais britannique, ton factuel.
- Aucune balise HTML, aucun emoji.
- JSON STRICT : { "items": [{ "key": "<question_fr à l'identique>", "question_en": "...", "answer_en": "..." }] }.`;

const CONCIERGE_SYSTEM = `Tu es traductrice-éditrice pour MyConciergeHotel.com, agence IATA de palaces.
On te donne des questions-réponses "concierge" en français. Pour CHAQUE item, renvoie 3 champs :
1. question_en : traduction fidèle de question_fr (anglais britannique).
2. reply_en : traduction fidèle de reply_fr (préserve chiffres, prix, horaires, noms propres).
3. reply_fr_informative : la réponse FR RÉÉCRITE en registre informatif (toujours, pour tous les items).

TON INFORMATIF OBLIGATOIRE (CDC D10) — règle absolue, sans exception :
- reply_fr_informative et reply_en ne doivent JAMAIS commencer par un engagement à la
  première personne. INTERDIT de commencer par : "Je", "J'", "Nous", "On", "I", "We".
- Commence par le sujet/fait. Exemples de transformation :
    "Je serais ravi d'organiser votre transfert…"  ->  "La conciergerie organise votre transfert…"
    "Je peux réserver une table…"                   ->  "Une table peut être réservée…"
    "Je vais vérifier les disponibilités…"          ->  "Les disponibilités sont vérifiées…"
    "I would be delighted to arrange…"              ->  "The concierge arranges…"
- Préserve TOUS les faits (chiffres, noms, horaires). N'invente rien.
- Aucune balise HTML, aucun emoji.
- JSON STRICT : { "items": [{ "key": "<question_fr à l'identique>", "question_en": "...",
  "reply_en": "...", "reply_fr_informative": "..." }] }.`;

async function callJson(openai: OpenAI, system: string, user: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const raw = res.choices[0]?.message.content ?? '';
  return JSON.parse(raw) as unknown;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

/* ── Per-hotel enrichment ───────────────────────────────────────────────── */

interface EnrichArgs {
  readonly batchSize: number;
  readonly concurrency: number;
}

interface EnrichResult {
  readonly slug: string;
  readonly kitFixed: number;
  readonly conciergeEnFixed: number;
  readonly conciergeToneFixed: number;
  readonly gateOk: boolean;
  readonly gateIssues: readonly string[];
}

async function enrichKitEn(
  openai: OpenAI,
  hotel: HotelRow,
  kit: KitItem[],
  args: EnrichArgs,
): Promise<number> {
  const missing = kit.filter((it) => !nonEmpty(it.question_en) || !nonEmpty(it.answer_en));
  if (missing.length === 0) return 0;

  const byKey = new Map<string, KitItem>();
  for (const it of kit) byKey.set(str(it.question_fr), it);

  const batches = chunk(missing, args.batchSize);
  const perBatch = await runWithConcurrency(batches, args.concurrency, async (batch) => {
    const payload = batch.map((it) => ({
      key: str(it.question_fr),
      question_fr: str(it.question_fr),
      answer_fr: str(it.answer_fr),
    }));
    const user = `Hôtel : ${hotel.name} (${hotel.city ?? '?'}, ${hotel.region ?? '?'}).\nTraduis ces ${payload.length} FAQ en anglais :\n${JSON.stringify(payload, null, 2)}`;
    let parsed: z.infer<typeof KitEnSchema> | null = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt += 1) {
      try {
        parsed = KitEnSchema.parse(await callJson(openai, KIT_SYSTEM, user));
      } catch {
        parsed = null;
      }
    }
    return parsed?.items ?? [];
  });

  let fixed = 0;
  for (const items of perBatch) {
    for (const out of items) {
      const target = byKey.get(out.key);
      if (target === undefined) continue;
      target.question_en = out.question_en;
      target.answer_en = out.answer_en;
      fixed += 1;
    }
  }
  return fixed;
}

/** A concierge item still needs work if EN is missing or FR opens first-person. */
function conciergeNeedsWork(it: ConciergeItem): boolean {
  return (
    !nonEmpty(it.question_en) ||
    !nonEmpty(it.reply_en) ||
    COMMITMENT_FR.test(str(it.reply_fr).trim()) ||
    (nonEmpty(it.reply_en) && COMMITMENT_EN.test(str(it.reply_en).trim()))
  );
}

async function conciergePass(
  openai: OpenAI,
  hotel: HotelRow,
  byKey: Map<string, ConciergeItem>,
  todo: readonly ConciergeItem[],
  args: EnrichArgs,
): Promise<{ enFixed: number; toneFixed: number }> {
  const batches = chunk(todo, args.batchSize);
  const perBatch = await runWithConcurrency(batches, args.concurrency, async (batch) => {
    const payload = batch.map((it) => ({
      key: str(it.question_fr),
      question_fr: str(it.question_fr),
      reply_fr: str(it.reply_fr),
    }));
    const user = `Hôtel : ${hotel.name} (${hotel.city ?? '?'}, ${hotel.region ?? '?'}).\nTraite ces ${payload.length} Q&R concierge :\n${JSON.stringify(payload, null, 2)}`;
    let parsed: z.infer<typeof ConciergeEnSchema> | null = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt += 1) {
      try {
        parsed = ConciergeEnSchema.parse(await callJson(openai, CONCIERGE_SYSTEM, user));
      } catch {
        parsed = null;
      }
    }
    return parsed?.items ?? [];
  });

  let enFixed = 0;
  let toneFixed = 0;
  for (const items of perBatch) {
    for (const out of items) {
      const target = byKey.get(out.key);
      if (target === undefined) continue;
      // EN parity — only accept EN that respects D10 (no leading "I").
      if (!COMMITMENT_EN.test(out.reply_en.trim()) && nonEmpty(out.question_en)) {
        target.question_en = out.question_en;
        target.reply_en = out.reply_en;
        enFixed += 1;
      }
      // D10 FR — apply the informative rewrite whenever the original opens
      // first-person AND the rewrite no longer does.
      const fixedFr = out.reply_fr_informative.trim();
      if (
        fixedFr.length > 0 &&
        COMMITMENT_FR.test(str(target.reply_fr).trim()) &&
        !COMMITMENT_FR.test(fixedFr)
      ) {
        target.reply_fr = fixedFr;
        toneFixed += 1;
      }
    }
  }
  return { enFixed, toneFixed };
}

async function enrichConciergeEn(
  openai: OpenAI,
  hotel: HotelRow,
  concierge: ConciergeItem[],
  args: EnrichArgs,
): Promise<{ enFixed: number; toneFixed: number }> {
  const byKey = new Map<string, ConciergeItem>();
  for (const it of concierge) byKey.set(str(it.question_fr), it);

  let enFixed = 0;
  let toneFixed = 0;
  // Up to 3 passes: the corrective passes shrink the batch (and thus sharpen
  // instruction-following) over the residual still-flagged items until the
  // D10 / EN-parity gates converge.
  for (let pass = 0; pass < 3; pass += 1) {
    const todo = concierge.filter(conciergeNeedsWork);
    if (todo.length === 0) break;
    const passArgs: EnrichArgs =
      pass === 0
        ? args
        : { batchSize: Math.max(1, Math.ceil(args.batchSize / 2)), concurrency: args.concurrency };
    const r = await conciergePass(openai, hotel, byKey, todo, passArgs);
    enFixed += r.enFixed;
    toneFixed += r.toneFixed;
    if (r.enFixed === 0 && r.toneFixed === 0) break; // no progress — stop looping
  }
  return { enFixed, toneFixed };
}

async function enrichOne(
  openai: OpenAI,
  env: PostgrestEnv,
  hotel: HotelRow,
  args: EnrichArgs,
  dryRun: boolean,
): Promise<EnrichResult> {
  const kit = Array.isArray(hotel.faq_content_kit)
    ? hotel.faq_content_kit.map((it) => ({ ...it }))
    : [];
  const concierge = Array.isArray(hotel.concierge_questions)
    ? hotel.concierge_questions.map((it) => ({ ...it }))
    : [];

  const kitFixed = await enrichKitEn(openai, hotel, kit, args);
  const { enFixed, toneFixed } = await enrichConciergeEn(openai, hotel, concierge, args);

  const gate = evaluateFaqKitRowEnrichment({
    hotelName: hotel.name,
    faq_content_kit: kit,
    faq_content: (hotel as unknown as { faq_content?: unknown }).faq_content,
    concierge_questions: concierge,
  });

  if (!dryRun && (kitFixed > 0 || enFixed > 0 || toneFixed > 0)) {
    await patchHotel(env, hotel.slug, {
      faq_content_kit: kit,
      concierge_questions: concierge,
    });
  }

  return {
    slug: hotel.slug,
    kitFixed,
    conciergeEnFixed: enFixed,
    conciergeToneFixed: toneFixed,
    gateOk: gate.ok,
    gateIssues: gate.issues.filter((i) => i.severity === 'blocker').map((i) => i.message),
  };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slugs: readonly string[];
  readonly batchSize: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let batchSize = 8;
  let concurrency = 4;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--slug=')) slugs = [a.slice('--slug='.length)];
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--batch-size=')) {
      const n = Number(a.slice('--batch-size='.length));
      if (Number.isFinite(n) && n > 0) batchSize = Math.min(15, Math.floor(n));
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    }
  }
  return { slugs, batchSize, concurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.slugs.length === 0) throw new Error('Pass --slug=foo or --slugs=a,b,c.');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
  console.log(
    `[kit-faq-en] slugs=${args.slugs.length} batchSize=${args.batchSize} concurrency=${args.concurrency} dryRun=${args.dryRun}`,
  );

  const hotels = await fetchHotels(env, args.slugs);
  if (hotels.length === 0) throw new Error('No hotels matched.');

  const results: EnrichResult[] = [];
  for (const hotel of hotels) {
    const t0 = Date.now();
    const r = await enrichOne(openai, env, hotel, args, args.dryRun);
    results.push(r);
    console.log(
      `  ${r.gateOk ? '✓' : '✗'} ${r.slug} — kitEN+${r.kitFixed} conciergeEN+${r.conciergeEnFixed} D10+${r.conciergeToneFixed} (${((Date.now() - t0) / 1000).toFixed(1)}s)` +
        (r.gateOk ? '' : `\n     remaining: ${r.gateIssues.join(' | ')}`),
    );
  }

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNLOG_DIR, `kit-faq-en-${ts}.json`);
  writeFileSync(
    logPath,
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
  console.log(`[kit-faq-en] runlog → ${logPath}`);

  process.exit(results.every((r) => r.gateOk || args.dryRun) ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('[kit-faq-en] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
