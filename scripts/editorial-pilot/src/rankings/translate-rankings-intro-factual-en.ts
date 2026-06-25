/**
 * translate-rankings-intro-factual-en.ts — EN parity backfill for
 * `editorial_rankings.intro_en` and `editorial_rankings.factual_summary_en`.
 *
 * Why this exists: a 2026-06-23 audit found ~67/70 published rankings carry a
 * rich `intro_fr` (the long-read at the top of every /classement page) and a
 * `factual_summary_fr` (130-150 char AEO/JSON-LD signal) but a NULL/empty
 * English counterpart, so the `/en/classement/<slug>` page falls back to French
 * prose. English is a V1 locale → a real GEO/SEO hole. The ranking v2 generator
 * (`generate-ranking-v2.ts`) deliberately leaves `intro_en`/`factual_summary_en`
 * empty (the FR Call M prompt asks for "1 short phrase or empty"), so the gap is
 * structural and never closes by re-running the generator.
 *
 * This tool translates the FR canonical into a faithful British-English rewrite
 * (numbers / prices / proper nouns / distances / distinctions preserved, no
 * invented facts), one LLM call per ranking, and PATCHes ONLY `intro_en` and/or
 * `factual_summary_en` — DISJOINT from `editorial_ranking_entries.justification_en`
 * (a sibling worker), so the two backfills never collide.
 *
 * Anti-scaffolding: every EN output runs through the shared `hasLeak()` gate. A
 * translation that re-introduces pipeline scaffolding is dropped, never persisted.
 *
 * Field envelopes (mirror `generate-ranking-v2.ts`):
 *   - intro_en        : long-read, no hard cap (FR is 700-1000 words).
 *   - factual_summary : 130-150 ideal, 110-180 warn band, 220 hard max.
 *
 * CLI:
 *   --slug=foo                 single ranking
 *   --slugs=a,b,c              explicit list
 *   --all                      every published ranking missing intro_en or factual_summary_en
 *   --limit=N                  cap the --all selection (default 0 = no cap)
 *   --concurrency=4            parallel rankings (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: editorial-voice, llm-output-robustness, typescript-strict-zod-interop.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak } from '../enrichment/scaffolding-gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';

/** EN field below this many chars counts as "missing" (stubs included). */
const INTRO_EN_MIN_CHARS = 80;
const FS_EN_MIN_CHARS = 20;
/**
 * factual_summary envelope floor (mirrors generate-ranking-v2 / AGENTS.md §1.5).
 * A non-empty `factual_summary_en` BELOW this is "present but sub-envelope" — it
 * renders fine but fails the 110-char AEO/JSON-LD floor, so it must be
 * re-translated to land back in band (2026-06-25: `meilleurs-hotels-spa-barcelone`
 * was 108c). We only attempt the refresh when the FR canonical is long enough to
 * faithfully reach the floor (no padding / invented facts).
 */
const FS_EN_ENVELOPE_MIN = 110;
const FS_FR_REFRESH_MIN = 115;
/** A French field shorter than this isn't worth translating. */
const INTRO_FR_MIN_CHARS = 200;
const FS_FR_MIN_CHARS = 40;
/** Hard DB cap on factual_summary (see CallFactualSummarySchema, max 220). */
const FS_MAX_CHARS = 200;

interface RankingRow {
  slug: string;
  title_fr: string | null;
  title_en: string | null;
  intro_fr: string | null;
  intro_en: string | null;
  factual_summary_fr: string | null;
  factual_summary_en: string | null;
}

function needsIntroEn(r: RankingRow): boolean {
  return (
    (r.intro_fr ?? '').trim().length >= INTRO_FR_MIN_CHARS &&
    (r.intro_en ?? '').trim().length < INTRO_EN_MIN_CHARS
  );
}

function needsFsEn(r: RankingRow): boolean {
  const frLen = (r.factual_summary_fr ?? '').trim().length;
  const enLen = (r.factual_summary_en ?? '').trim().length;
  // (a) Missing/stub EN — the original parity gap (FR worth translating, EN empty).
  if (frLen >= FS_FR_MIN_CHARS && enLen < FS_EN_MIN_CHARS) return true;
  // (b) Present-but-sub-envelope EN — refresh only when the FR canonical is long
  //     enough to faithfully reach the 110-char floor without inventing facts.
  if (frLen >= FS_FR_REFRESH_MIN && enLen > 0 && enLen < FS_EN_ENVELOPE_MIN) return true;
  return false;
}

function needsWork(r: RankingRow): boolean {
  return needsIntroEn(r) || needsFsEn(r);
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

const SELECT = 'slug,title_fr,title_en,intro_fr,intro_en,factual_summary_fr,factual_summary_en';

async function fetchRankingsBySlug(
  env: PostgrestEnv,
  slugs: readonly string[],
): Promise<RankingRow[]> {
  const params = new URLSearchParams();
  params.set('select', SELECT);
  params.set('slug', `in.(${slugs.join(',')})`);
  const r = await fetch(`${env.restBase}/editorial_rankings?${params.toString()}`, {
    headers: pgHeaders(env),
  });
  if (!r.ok)
    throw new Error(
      `PostgREST GET editorial_rankings failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
  return (await r.json()) as RankingRow[];
}

async function fetchAllNeedingEn(env: PostgrestEnv, limit: number): Promise<RankingRow[]> {
  const PAGE = 400;
  let from = 0;
  const out: RankingRow[] = [];
  for (;;) {
    const r = await fetch(
      `${env.restBase}/editorial_rankings?is_published=eq.true&intro_fr=not.is.null&select=${SELECT}&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as RankingRow[];
    for (const row of batch) {
      if (needsWork(row)) out.push(row);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function patchRanking(
  env: PostgrestEnv,
  slug: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`${env.restBase}/editorial_rankings?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok)
    throw new Error(
      `PostgREST PATCH ${slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

const TranslationSchema = z.object({
  intro_en: z.string().optional().default(''),
  factual_summary_en: z.string().optional().default(''),
});

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces.
On te donne des champs éditoriaux d'un CLASSEMENT d'hôtels, en français. Tu produis la version ANGLAISE des champs demandés.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, dans le MÊME registre éditorial, fidèle au sens, au ton et à la STRUCTURE du français (mêmes paragraphes, mêmes ruptures de ligne).
- Préserve EXACTEMENT tous les chiffres, classements, prix (en euros TTC), horaires, distances, noms propres, noms d'hôtels, de villes, de chefs, et toutes les distinctions (Michelin, Atout France, Relais & Châteaux, Forbes, Leading Hotels of the World).
- N'invente AUCUN fait absent du français. Si le français ne le dit pas, l'anglais ne le dit pas.
- Pour 'intro_en' : conserve une longueur comparable au français (ne résume pas, ne tronque pas), garde les sauts de ligne entre paragraphes.
- Pour 'factual_summary_en' : version concise de 130 à 150 caractères STRICT (espaces compris, jamais plus de 165), fidèle au résumé français. C'est un signal AEO + une description JSON-LD.
- AUCUN méta-commentaire de pipeline : jamais "the brief", "AUTO_DRAFT", "pending", "confidence level", "word count", d'identifiant Wikidata, ni de backticks. Prose publiable uniquement.
- Aucune balise HTML, aucun emoji.

JSON STRICT contenant UNIQUEMENT les champs demandés : { "intro_en": "...", "factual_summary_en": "..." }.`;

async function callJson(openai: OpenAI, user: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
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
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

/* ── Per-ranking ────────────────────────────────────────────────────────── */

interface OneResult {
  readonly slug: string;
  readonly introChars: number;
  readonly fsChars: number;
  readonly introLeak: boolean;
  readonly fsLeak: boolean;
  readonly wroteIntro: boolean;
  readonly wroteFs: boolean;
  readonly ok: boolean;
}

const EMPTY = (slug: string): OneResult => ({
  slug,
  introChars: 0,
  fsChars: 0,
  introLeak: false,
  fsLeak: false,
  wroteIntro: false,
  wroteFs: false,
  ok: true,
});

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  row: RankingRow,
  dryRun: boolean,
): Promise<OneResult> {
  const wantIntro = needsIntroEn(row);
  const wantFs = needsFsEn(row);
  if (!wantIntro && !wantFs) return EMPTY(row.slug);

  const fields: string[] = [];
  const parts: string[] = [];
  parts.push(`Classement : ${row.title_fr ?? row.slug}.`);
  if (wantIntro) {
    fields.push("'intro_en' (le long-read d'introduction)");
    parts.push(`\n--- intro_fr ---\n${(row.intro_fr ?? '').trim()}`);
  }
  if (wantFs) {
    fields.push("'factual_summary_en' (résumé concis 130-150 caractères)");
    parts.push(`\n--- factual_summary_fr ---\n${(row.factual_summary_fr ?? '').trim()}`);
  }
  const user =
    `Traduis en anglais britannique UNIQUEMENT le(s) champ(s) suivant(s) : ${fields.join(' et ')}.\n` +
    parts.join('\n');

  let parsed: z.infer<typeof TranslationSchema> | null = null;
  for (let attempt = 0; attempt < 3 && parsed === null; attempt += 1) {
    try {
      const raw = await callJson(openai, user);
      const ok = TranslationSchema.safeParse(raw);
      if (ok.success) {
        const introOk = !wantIntro || ok.data.intro_en.trim().length >= INTRO_EN_MIN_CHARS;
        const fsRaw = ok.data.factual_summary_en.trim();
        // Enforce the 110-char envelope floor so a refresh never re-persists a
        // sub-envelope summary; retries chase the band (no invented facts).
        const fsOk =
          !wantFs || (fsRaw.length >= FS_EN_ENVELOPE_MIN && fsRaw.length <= FS_MAX_CHARS);
        if (introOk && fsOk) parsed = ok.data;
      }
    } catch {
      parsed = null;
    }
  }
  if (parsed === null) return { ...EMPTY(row.slug), ok: false };

  const patch: Record<string, unknown> = {};
  let introLeak = false;
  let fsLeak = false;
  let introChars = 0;
  let fsChars = 0;

  if (wantIntro) {
    const introEn = parsed.intro_en.trim();
    if (hasLeak(introEn)) introLeak = true;
    else {
      patch['intro_en'] = introEn;
      introChars = introEn.length;
    }
  }
  if (wantFs) {
    const fsEn = parsed.factual_summary_en.trim();
    if (hasLeak(fsEn)) fsLeak = true;
    else {
      patch['factual_summary_en'] = fsEn;
      fsChars = fsEn.length;
    }
  }

  const wroteIntro = Object.prototype.hasOwnProperty.call(patch, 'intro_en');
  const wroteFs = Object.prototype.hasOwnProperty.call(patch, 'factual_summary_en');

  if (!dryRun && Object.keys(patch).length > 0) {
    await patchRanking(env, row.slug, patch);
  }

  return {
    slug: row.slug,
    introChars,
    fsChars,
    introLeak,
    fsLeak,
    wroteIntro,
    wroteFs,
    ok: (!wantIntro || wroteIntro) && (!wantFs || wroteFs),
  };
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

  let rankings = args.all
    ? await fetchAllNeedingEn(env, args.limit)
    : await fetchRankingsBySlug(env, args.slugs);
  if (!args.all) rankings = rankings.filter(needsWork);

  const introNeed = rankings.filter(needsIntroEn).length;
  const fsNeed = rankings.filter(needsFsEn).length;
  console.log(
    `[translate-rankings-en] rankings=${rankings.length} (intro_en gap=${introNeed}, factual_summary_en gap=${fsNeed}) ` +
      `concurrency=${args.concurrency} dryRun=${args.dryRun}`,
  );
  if (rankings.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let done = 0;
  const results = await runWithConcurrency(rankings, args.concurrency, async (row) => {
    const t0 = Date.now();
    let r: OneResult;
    try {
      r = await translateOne(openai, env, row, args.dryRun);
    } catch (err) {
      r = { ...EMPTY(row.slug), ok: false };
      console.error(`  ✗ ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    const flags = [
      r.wroteIntro ? `intro ${r.introChars}c` : '',
      r.wroteFs ? `fs ${r.fsChars}c` : '',
      r.introLeak ? 'intro-leak' : '',
      r.fsLeak ? 'fs-leak' : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `  [${done}/${rankings.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — ${flags || 'no-op'} ` +
        `(${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const introWritten = results.filter((r) => r.wroteIntro).length;
  const fsWritten = results.filter((r) => r.wroteFs).length;
  const leaks = results.filter((r) => r.introLeak || r.fsLeak).length;
  console.log(
    `[translate-rankings-en] Done — ${okCount}/${rankings.length} ok, ` +
      `intro_en written=${introWritten}, factual_summary_en written=${fsWritten}, leak-dropped=${leaks}.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-rankings-intro-factual-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error('[translate-rankings-en] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
