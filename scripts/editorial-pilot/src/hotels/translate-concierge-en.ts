/**
 * translate-concierge-en.ts — EN parity backfill for `hotels.concierge_advice`.
 *
 * Why this exists: the 2026-06-29 grand audit found 18 published fiches with a
 * rich FR `concierge_advice` block (CDC §2 bloc 16, hard rule 11) but NO `en`
 * sub-object, so the `/en` hotel page renders the FR tip (or elides the block).
 * The catalogue generator `run-hotel-concierge-advice.ts` produces FR+EN in one
 * shot, but re-running it would REGENERATE (overwrite) the validated FR. This
 * sibling tool TRANSLATES the existing FR into EN and patches ONLY the `en`
 * sub-object, preserving the FR verbatim.
 *
 * Mirrors `translate-description-en.ts` (PostgREST over HTTPS — runs on the
 * Windows box where the `pg`-based i18n tools can't resolve the direct host).
 *
 * Anti-scaffolding + voice gate: the EN output runs through the shared
 * `hasLeak()` gate AND the same format rules the generator enforces on the EN
 * side (opens "My tip:", body 50-110 words, title 6-16 words, sentences ≤ 25
 * words, banned superlatives, not a literal copy of the FR). A translation that
 * fails any check is dropped (FR-only stays — never persist a bad EN).
 *
 * CLI:
 *   --slug=foo                 single hotel
 *   --slugs=a,b,c              explicit list
 *   --all                      every published fiche with FR advice but missing EN
 *   --limit=N                  cap the --all selection (default 0 = no cap)
 *   --concurrency=4            parallel hotels (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: editorial-voice, concierge-voice-pipeline, llm-output-robustness.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import {
  ADVICE_BODY_MAX_WORDS,
  ADVICE_BODY_MIN_WORDS,
  ADVICE_TITLE_MAX_WORDS,
  ADVICE_TITLE_MIN_WORDS,
  SENTENCE_MAX_WORDS,
} from './concierge-advice-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';
const MAX_ATTEMPTS = 3;

const TIP_FOR_VALUES = ['room', 'dining', 'timing', 'access', 'service', 'wellness'] as const;
type TipFor = (typeof TIP_FOR_VALUES)[number];

const BANNED_LEXICON_EN_LOOSE = [
  'unforgettable',
  'magical',
  'sublime',
  'true gem',
  'hidden gem',
] as const;

const LocaleAdviceSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tip_for: z.enum(TIP_FOR_VALUES),
});
type LocaleAdvice = z.infer<typeof LocaleAdviceSchema>;

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly concierge_advice: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readFr(row: HotelRow): LocaleAdvice | null {
  if (!isRecord(row.concierge_advice)) return null;
  const parsed = LocaleAdviceSchema.safeParse(row.concierge_advice['fr']);
  return parsed.success ? parsed.data : null;
}

function hasEn(row: HotelRow): boolean {
  if (!isRecord(row.concierge_advice)) return false;
  const en = row.concierge_advice['en'];
  return isRecord(en) && typeof en['body'] === 'string' && en['body'].trim().length > 0;
}

function needsEn(row: HotelRow): boolean {
  return readFr(row) !== null && !hasEn(row);
}

/* ── EN voice/format validation (mirrors gateConciergeAdviceFormat EN side) ─ */

function countWords(s: string): number {
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

function splitSentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function stripAccent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Returns a reason string when the EN advice is invalid, else null. */
function gateEn(frBody: string, en: LocaleAdvice): string | null {
  const failed: string[] = [];

  const bodyWords = countWords(en.body);
  if (bodyWords < ADVICE_BODY_MIN_WORDS)
    failed.push(`en.body too short (${bodyWords} words, min ${ADVICE_BODY_MIN_WORDS})`);
  if (bodyWords > ADVICE_BODY_MAX_WORDS)
    failed.push(`en.body too long (${bodyWords} words, max ${ADVICE_BODY_MAX_WORDS})`);

  const titleWords = countWords(en.title);
  if (titleWords < ADVICE_TITLE_MIN_WORDS)
    failed.push(`en.title too short (${titleWords} words, min ${ADVICE_TITLE_MIN_WORDS})`);
  if (titleWords > ADVICE_TITLE_MAX_WORDS)
    failed.push(`en.title too long (${titleWords} words, max ${ADVICE_TITLE_MAX_WORDS})`);

  if (!/^My\s+tip\s*:/u.test(en.body.trim())) failed.push('en.body must open with "My tip:"');

  for (const sentence of splitSentences(en.body)) {
    const w = countWords(sentence);
    if (w > SENTENCE_MAX_WORDS) {
      failed.push(`en.body sentence too long (${w} words > ${SENTENCE_MAX_WORDS})`);
      break;
    }
  }

  const lowered = en.body.toLowerCase();
  for (const banned of BANNED_LEXICON_EN_LOOSE) {
    if (lowered.includes(banned.toLowerCase()))
      failed.push(`en.body contains banned lexicon: "${banned}"`);
  }

  if (hasLeak(en.title)) failed.push('en.title carries scaffolding/dossier leak');
  if (hasLeak(en.body)) failed.push('en.body carries scaffolding/dossier leak');

  if (stripAccent(frBody.slice(0, 40)) === stripAccent(en.body.slice(0, 40)))
    failed.push('en.body appears to be a literal copy of fr.body');

  return failed.length > 0 ? failed.join(' | ') : null;
}

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

const SELECT = 'id,slug,name,city,region,concierge_advice';

async function fetchHotelsBySlug(env: PostgrestEnv, slugs: readonly string[]): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', SELECT);
  params.set('slug', `in.(${slugs.join(',')})`);
  const r = await fetch(`${env.restBase}/hotels?${params.toString()}`, { headers: pgHeaders(env) });
  if (!r.ok)
    throw new Error(`PostgREST GET hotels failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as HotelRow[];
}

async function fetchAllNeedingEn(env: PostgrestEnv, limit: number): Promise<HotelRow[]> {
  const PAGE = 1000;
  let from = 0;
  const out: HotelRow[] = [];
  for (;;) {
    const r = await fetch(
      `${env.restBase}/hotels?is_published=eq.true&concierge_advice=not.is.null&select=${SELECT}&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as HotelRow[];
    for (const h of batch) {
      if (needsEn(h)) out.push(h);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function patchConciergeEn(env: PostgrestEnv, row: HotelRow, en: LocaleAdvice): Promise<void> {
  const existing = isRecord(row.concierge_advice) ? row.concierge_advice : {};
  const merged = { ...existing, en };
  const r = await fetch(`${env.restBase}/hotels?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ concierge_advice: merged }),
  });
  if (!r.ok)
    throw new Error(
      `PostgREST PATCH ${row.slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

const EnAdviceSchema = z.object({ title: z.string().min(1), body: z.string().min(1) });

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces.
On te donne le « Conseil du Concierge » d'une fiche d'hôtel, en français (un titre + un corps). Tu produis la version ANGLAISE.

Règles strictes :
- Réécriture native en anglais britannique (en-GB), fidèle au sens, au ton complice-expert et aux FAITS du français. PAS de mot-à-mot.
- Le corps DOIT commencer EXACTEMENT par "My tip:" (équivalent de « Mon conseil : »).
- Longueur du corps : 50 à 110 mots. Titre : 6 à 16 mots. Chaque phrase ≤ 25 mots.
- Si le titre FR fait moins de 6 mots, NE le copie PAS tel quel : développe-le en un titre éditorial anglais naturel de 6 à 16 mots, ancré UNIQUEMENT sur les faits du corps FR (aucun fait inventé).
- Préserve EXACTEMENT chiffres, prix (euros TTC), horaires, distances, noms propres (restaurants, chefs, lieux, numéros de chambre).
- N'invente AUCUN fait absent du français.
- Banni : unforgettable, magical, sublime, true gem, hidden gem, et tout superlatif creux.
- AUCUN méta-commentaire de pipeline, aucun backtick, aucune balise HTML, aucun emoji.

JSON STRICT : { "title": "...", "body": "My tip: ..." }.`;

function buildUser(hotel: HotelRow, fr: LocaleAdvice): string {
  const loc = [hotel.city, hotel.region].filter((s) => s && s.length > 0).join(', ');
  return [
    `Hôtel : ${hotel.name}${loc.length > 0 ? ` (${loc})` : ''}.`,
    `Catégorie du conseil (tip_for) : ${fr.tip_for}.`,
    '',
    `Titre FR : ${fr.title}`,
    `Corps FR : ${fr.body}`,
    '',
    'Traduis fidèlement en anglais. Le corps doit commencer par "My tip:".',
  ].join('\n');
}

async function callJson(openai: OpenAI, user: string, correction: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 900,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: correction.length > 0 ? `${user}\n\n${correction}` : user },
    ],
  });
  return JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= items.length) return;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

/* ── per-hotel ──────────────────────────────────────────────────────────── */

interface OneResult {
  readonly slug: string;
  readonly ok: boolean;
  readonly bodyWords: number;
  readonly reason?: string;
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<OneResult> {
  const fr = readFr(hotel);
  if (fr === null) return { slug: hotel.slug, ok: false, bodyWords: 0, reason: 'no-fr-advice' };

  const user = buildUser(hotel, fr);
  let correction = '';
  let lastReason = 'unknown';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await callJson(openai, user, correction);
      const parsed = EnAdviceSchema.safeParse(raw);
      if (!parsed.success) {
        lastReason = `zod: ${parsed.error.issues.map((i) => i.message).join(', ')}`;
        correction = `=== ATTEMPT ${attempt + 1} REJECTED ===\nReason: ${lastReason}\nReturn STRICT JSON { "title", "body" }.`;
        continue;
      }
      const en: LocaleAdvice = {
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        tip_for: fr.tip_for,
      };
      const reason = gateEn(fr.body, en);
      if (reason !== null) {
        lastReason = reason;
        correction = `=== ATTEMPT ${attempt + 1} REJECTED ===\nReason: ${reason}\nFix strictly. Body 50-110 words, opens "My tip:", sentences ≤ 25 words, no invented facts.`;
        continue;
      }
      if (!dryRun) await patchConciergeEn(env, hotel, en);
      return { slug: hotel.slug, ok: true, bodyWords: countWords(en.body) };
    } catch (err) {
      lastReason = err instanceof Error ? err.message.slice(0, 120) : String(err);
      correction = `=== ATTEMPT ${attempt + 1} ERROR ===\nReturn STRICT JSON { "title", "body" }.`;
    }
  }
  return { slug: hotel.slug, ok: false, bodyWords: 0, reason: lastReason };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let all = false;
  let limit = 0;
  let concurrency = 4;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--all') all = true;
    else if (a.startsWith('--slug=')) slugs = [a.slice('--slug='.length)];
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n >= 0) limit = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    }
  }
  return { slugs, all, limit, concurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.slugs.length === 0)
    throw new Error('Pass --slug=foo, --slugs=a,b,c or --all.');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  let hotels = args.all
    ? await fetchAllNeedingEn(env, args.limit)
    : await fetchHotelsBySlug(env, args.slugs);
  hotels = hotels.filter(needsEn);
  console.log(
    `[translate-concierge-en] hotels=${hotels.length} concurrency=${args.concurrency} dryRun=${args.dryRun}`,
  );
  if (hotels.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let done = 0;
  const results = await runWithConcurrency(hotels, args.concurrency, async (hotel) => {
    const t0 = Date.now();
    let r: OneResult;
    try {
      r = await translateOne(openai, env, hotel, args.dryRun);
    } catch (err) {
      r = {
        slug: hotel.slug,
        ok: false,
        bodyWords: 0,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    done += 1;
    console.log(
      `  [${done}/${hotels.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — EN ${r.bodyWords}w` +
        (r.ok ? '' : ` (${r.reason ?? ''})`) +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  console.log(
    `[translate-concierge-en] Done — ${okCount}/${hotels.length} translated, ${hotels.length - okCount} failed.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-concierge-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );

  if (okCount < hotels.length) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error('[translate-concierge-en] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
