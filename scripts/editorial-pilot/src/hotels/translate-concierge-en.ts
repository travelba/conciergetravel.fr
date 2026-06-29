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
const MAX_ATTEMPTS = 5;

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

/* ── reader-gate parity (apps/web get-hotel-by-slug.ts) ──────────────────── *
 * A row can store a non-empty `en.body` and STILL render the FR fallback (or
 * elide the block entirely) when the EN payload fails the apps/web Zod gate:
 * body must be 50-110 words (counted by splitting on every non-alphanumeric,
 * NOT whitespace), title 1-120 chars, a valid `tip_for` enum, no leak. The
 * `--fix-invalid` mode selects those rows so this tool can repair them.       */

/** EXACT replica of the reader's word counter (splits on non-alnum, so
 * apostrophes/hyphens are separators) — required so our selection matches
 * precisely what apps/web rejects. */
function countWordsReader(s: string): number {
  const t = s.trim();
  if (t.length === 0) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0).length;
}

function isValidTip(v: unknown): v is TipFor {
  return typeof v === 'string' && (TIP_FOR_VALUES as readonly string[]).includes(v);
}

/**
 * Infer a valid `tip_for` enum from the advice body when the stored value is
 * missing/invalid (e.g. legacy `'ski'`, `undefined`). Deterministic keyword
 * match — it only RELABELS the category, never invents or rewrites content,
 * so no DataForSEO grounding is required. `room` is checked first because the
 * primary actionable of most tips ("book the X suite") is a room choice.
 */
function inferTipFor(body: string): TipFor {
  const b = body.toLowerCase();
  if (/(\broom\b|\bsuite\b|chambre|\bfloor\b|[ée]tage|balcon|\bview\b|\bvue\b)/u.test(b))
    return 'room';
  if (
    /(restaurant|dining|breakfast|petit-?d[ée]jeuner|\btable\b|\bchef\b|\bmenu\b|dinner|d[îi]ner)/u.test(
      b,
    )
  )
    return 'dining';
  if (
    /(\bspa\b|wellness|treatment|\bsoin\b|hammam|sauna|massage|\bpool\b|piscine|bien-?[êe]tre)/u.test(
      b,
    )
  )
    return 'wellness';
  if (/(morning|\bearly\b|\bhour\b|\bheure\b|saison|season|\bmatin\b)/u.test(b)) return 'timing';
  if (/(access|ski-?in|transfer|navette|arrival|arriv[ée]e|entrance|entr[ée]e)/u.test(b))
    return 'access';
  return 'service';
}

function normalizeTipFor(body: string, current: unknown): TipFor {
  return isValidTip(current) ? current : inferTipFor(body);
}

/** Lenient FR reader: title+body required, `tip_for` tolerated as any string
 * (we normalise it). Lets the fixer process rows whose FR is fine except for
 * a legacy invalid `tip_for` that the strict `readFr` would reject. */
function readFrLoose(row: HotelRow): { title: string; body: string; tip_for: unknown } | null {
  if (!isRecord(row.concierge_advice)) return null;
  const fr = row.concierge_advice['fr'];
  if (!isRecord(fr)) return null;
  const title = typeof fr['title'] === 'string' ? fr['title'].trim() : '';
  const body = typeof fr['body'] === 'string' ? fr['body'].trim() : '';
  if (title.length === 0 || body.length === 0) return null;
  return { title, body, tip_for: fr['tip_for'] };
}

function readEnRaw(row: HotelRow): Record<string, unknown> | null {
  if (!isRecord(row.concierge_advice)) return null;
  const en = row.concierge_advice['en'];
  return isRecord(en) ? en : null;
}

/** True when the FR body/title pass the reader's length+leak gate (ignoring
 * `tip_for`, which we normalise). If the FR body itself is out of envelope the
 * block can never render via a mere EN translation → out of this tool's scope. */
function frBodyFixable(fr: { title: string; body: string }): boolean {
  const w = countWordsReader(fr.body);
  return (
    fr.title.length >= 1 &&
    fr.title.length <= 120 &&
    w >= 50 &&
    w <= 110 &&
    !hasLeak(fr.title) &&
    !hasLeak(fr.body)
  );
}

/** True when the EN body+title already satisfy the reader gate (tip ignored). */
function enContentRenders(en: Record<string, unknown>): boolean {
  const title = typeof en['title'] === 'string' ? en['title'] : '';
  const body = typeof en['body'] === 'string' ? en['body'] : '';
  const w = countWordsReader(body);
  return (
    title.length >= 1 &&
    title.length <= 120 &&
    w >= 50 &&
    w <= 110 &&
    !hasLeak(title) &&
    !hasLeak(body)
  );
}

/** A row whose EN is present but does NOT fully render: either the EN content
 * fails the gate, or the `tip_for` (on EN or FR) is an invalid enum. Requires
 * a fixable FR body (the translation source). */
function enRenderInvalid(row: HotelRow): boolean {
  const fr = readFrLoose(row);
  if (fr === null || !frBodyFixable(fr)) return false;
  const en = readEnRaw(row);
  if (en === null) return false; // absent EN → handled by needsEn
  return !enContentRenders(en) || !isValidTip(en['tip_for']) || !isValidTip(fr.tip_for);
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

async function fetchAllNeedingEn(
  env: PostgrestEnv,
  limit: number,
  fixInvalid: boolean,
): Promise<HotelRow[]> {
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
      if (needsEn(h) || (fixInvalid && enRenderInvalid(h))) out.push(h);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/**
 * Patch the `en` sub-object and, when `frTip` is provided, normalise the FR
 * `tip_for` too (a legacy invalid enum like `'ski'`/`undefined` breaks the
 * reader gate on BOTH locales — fixing only EN would leave the block elided).
 * The FR title/body are preserved verbatim.
 */
async function patchConciergeEn(
  env: PostgrestEnv,
  row: HotelRow,
  en: LocaleAdvice,
  frTip?: TipFor,
): Promise<void> {
  const existing = isRecord(row.concierge_advice) ? { ...row.concierge_advice } : {};
  if (frTip !== undefined && isRecord(existing['fr'])) {
    existing['fr'] = { ...(existing['fr'] as Record<string, unknown>), tip_for: frTip };
  }
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

/**
 * Deterministic tip-only repair: the EN body+title already render; only the
 * `tip_for` enum is invalid (on EN and/or FR). Relabel it on both locales —
 * no LLM call, no content change, faithful by construction.
 */
async function fixTipOnly(
  env: PostgrestEnv,
  row: HotelRow,
  en: Record<string, unknown>,
  tip: TipFor,
  frTipChanged: boolean,
): Promise<void> {
  const enFixed: LocaleAdvice = {
    title: String(en['title']),
    body: String(en['body']),
    tip_for: tip,
  };
  await patchConciergeEn(env, row, enFixed, frTipChanged ? tip : undefined);
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
  // When the FR source is terse, a literal-faithful EN tends to compress below
  // the 50-word floor. Pre-empt it: tell the model to render every element of
  // the FR in full (each amenity, each reason as its own clause) WITHOUT
  // inventing facts. Faithful expansion, not transcreation.
  const frWords = countWordsReader(fr.body);
  const expandLine =
    frWords < 65
      ? 'Le corps FR est court : rends CHAQUE élément présent (chaque équipement, chaque raison) comme une clause complète, sans rien inventer, pour atteindre 60-90 mots.'
      : '';
  return [
    `Hôtel : ${hotel.name}${loc.length > 0 ? ` (${loc})` : ''}.`,
    `Catégorie du conseil (tip_for) : ${fr.tip_for}.`,
    '',
    `Titre FR : ${fr.title}`,
    `Corps FR : ${fr.body}`,
    '',
    'Traduis fidèlement en anglais. Le corps doit commencer par "My tip:".',
    ...(expandLine.length > 0 ? [expandLine] : []),
  ].join('\n');
}

async function callJson(
  openai: OpenAI,
  user: string,
  correction: string,
  temperature: number,
): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature,
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
  readonly mode?: 'translate' | 'tip-fix';
  readonly reason?: string;
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<OneResult> {
  // Loose FR read: tolerate a legacy invalid `tip_for` (we normalise it).
  const frLoose = readFrLoose(hotel);
  if (frLoose === null)
    return { slug: hotel.slug, ok: false, bodyWords: 0, reason: 'no-fr-advice' };
  if (!frBodyFixable(frLoose))
    return { slug: hotel.slug, ok: false, bodyWords: 0, reason: 'fr-body-out-of-envelope' };

  const tip = normalizeTipFor(frLoose.body, frLoose.tip_for);
  const frTipChanged = frLoose.tip_for !== tip;

  // Deterministic path: EN body+title already render — only the tip enum is
  // invalid. Relabel on both locales, no LLM, no content change.
  const enRaw = readEnRaw(hotel);
  if (
    enRaw !== null &&
    enContentRenders(enRaw) &&
    (!isValidTip(enRaw['tip_for']) || frTipChanged)
  ) {
    if (!dryRun) await fixTipOnly(env, hotel, enRaw, tip, frTipChanged);
    return {
      slug: hotel.slug,
      ok: true,
      bodyWords: countWordsReader(String(enRaw['body'])),
      mode: 'tip-fix',
    };
  }

  // LLM path: EN absent or its body/title fail the gate → faithful re-translation.
  const fr: LocaleAdvice = { title: frLoose.title, body: frLoose.body, tip_for: tip };
  const user = buildUser(hotel, fr);
  let correction = '';
  let lastReason = 'unknown';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      // Scale temperature up per retry — a faithful translation of a short FR
      // tip tends to compress below the 50-word floor at low temperature.
      const raw = await callJson(openai, user, correction, 0.4 + attempt * 0.2);
      const parsed = EnAdviceSchema.safeParse(raw);
      if (!parsed.success) {
        lastReason = `zod: ${parsed.error.issues.map((i) => i.message).join(', ')}`;
        correction = `=== ATTEMPT ${attempt + 1} REJECTED ===\nReason: ${lastReason}\nReturn STRICT JSON { "title", "body" }.`;
        continue;
      }
      const en: LocaleAdvice = {
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        tip_for: tip,
      };
      const reason = gateEn(fr.body, en);
      if (reason !== null) {
        lastReason = reason;
        const expandHint = /too short/u.test(reason)
          ? '\nThe body is too short. Expand FAITHFULLY: render EVERY element already present in the French as its own clause — name each amenity separately (e.g. the pool, the hammam and the sauna), state each reason in full. Add NO new facts. Target 60-90 words.'
          : '';
        correction = `=== ATTEMPT ${attempt + 1} REJECTED ===\nReason: ${reason}\nFix strictly. Body 50-110 words, opens "My tip:", sentences ≤ 25 words, no invented facts.${expandHint}`;
        continue;
      }
      // Reader-gate parity guard: the reader counts words by splitting on every
      // non-alphanumeric (more than gateEn's whitespace split). Make sure the
      // output renders for real before persisting.
      const readerWords = countWordsReader(en.body);
      if (readerWords < 50 || readerWords > 110) {
        lastReason = `reader-words=${readerWords} out of [50,110]`;
        const expandHint =
          readerWords < 50
            ? ' Expand FAITHFULLY by naming each element already in the French (each amenity, each reason) as its own clause — invent nothing. Target 60-90 words.'
            : '';
        correction = `=== ATTEMPT ${attempt + 1} REJECTED ===\nReason: EN body must be 50-110 words. Rework.${expandHint}`;
        continue;
      }
      if (!dryRun) await patchConciergeEn(env, hotel, en, frTipChanged ? tip : undefined);
      return { slug: hotel.slug, ok: true, bodyWords: readerWords, mode: 'translate' };
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
  /** Also process rows whose EN is PRESENT but fails the apps/web reader gate
   * (body out of 50-110 words, title > 120 chars, invalid `tip_for`, leak). */
  readonly fixInvalid: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let all = false;
  let limit = 0;
  let concurrency = 4;
  let dryRun = false;
  let fixInvalid = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--all') all = true;
    else if (a === '--fix-invalid') fixInvalid = true;
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
  return { slugs, all, limit, concurrency, dryRun, fixInvalid };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.slugs.length === 0)
    throw new Error('Pass --slug=foo, --slugs=a,b,c or --all.');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  let hotels = args.all
    ? await fetchAllNeedingEn(env, args.limit, args.fixInvalid)
    : await fetchHotelsBySlug(env, args.slugs);
  const selector = (h: HotelRow): boolean => needsEn(h) || (args.fixInvalid && enRenderInvalid(h));
  hotels = hotels.filter(selector);
  console.log(
    `[translate-concierge-en] hotels=${hotels.length} concurrency=${args.concurrency} dryRun=${args.dryRun} fixInvalid=${args.fixInvalid}`,
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
        (r.ok && r.mode ? ` [${r.mode}]` : '') +
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
