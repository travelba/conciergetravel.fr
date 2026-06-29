/**
 * translate-rankings-sections-en.ts — EN parity backfill for
 * `editorial_rankings.editorial_sections` body/title.
 *
 * Why this exists: a 2026-06-29 audit
 * (docs/audits/rankings-enriched-content-audit-2026-06-29.md §1.3) found
 * 272/863 published rankings serving ≥1 `editorial_section` in FR fallback on
 * `/en/classement/<slug>` (the renderer falls back via `section.body_en ||
 * section.body_fr`). English is a V1 locale → a real GEO/SEO hole on otherwise
 * complete rankings.
 *
 * This pass translates the missing/leaky `title_en` / `body_en` of each section
 * from the FR canonical — faithfully (numbers / proper nouns / prices /
 * distinctions preserved, no invented facts), in British English, preserving
 * EVERY other field (`key`, `type`, FR bodies, section order) and NEVER touching
 * entries, intro, outro, FAQ, meta or the comparison table. SURGICAL, additive,
 * idempotent: a section already carrying clean non-empty EN is skipped.
 *
 * Grounding (DataForSEO): this is a FAITHFUL TRANSLATION of FR prose that was
 * already DataForSEO-grounded at generation time (`generate-ranking-v2.ts`). A
 * translation introduces no new claims and answers no new search-intent, so it
 * inherits the FR grounding — no fresh DFS round-trip (same contract as the
 * proven `rankings/translate-rankings-tables-en.ts`, `rankings/
 * translate-rankings-intro-factual-en.ts` and `guides/translate-sections-en.ts`).
 *
 * Anti-scaffolding: the EN output runs through the shared `hasLeak()` gate — a
 * translation that re-introduces pipeline meta-commentary is sentence-salvaged
 * or dropped, never persisted (ADR-0029).
 *
 * Writes ONLY `editorial_rankings.editorial_sections` — DISJOINT from
 * `editorial_ranking_entries.justification_*` and from `intro_en` /
 * `factual_summary_en` / `tables` (sibling backfills), so they never collide.
 *
 * CLI:
 *   --slug=foo                 single ranking
 *   --slugs=a,b,c              explicit list
 *   --all                      every published ranking missing section EN
 *   --limit=N                  cap the --all selection (default 0 = no cap)
 *   --concurrency=4            parallel rankings (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: editorial-long-read-rendering, editorial-voice, llm-output-robustness,
 * keyword-grounding-dataforseo (§translation inherits grounding),
 * typescript-strict-zod-interop, editorial-rankings-matrix.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';

interface Section {
  key?: unknown;
  type?: unknown;
  title_fr?: unknown;
  title_en?: unknown;
  body_fr?: unknown;
  body_en?: unknown;
  [k: string]: unknown;
}

interface RankingRow {
  slug: string;
  title_fr: string | null;
  title_en: string | null;
  editorial_sections: Section[] | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * Drop only the leaking sentence(s) from an EN translation, keep the rest.
 * The FR source is clean; the model occasionally hallucinates ONE meta sentence
 * in an otherwise-faithful translation. Salvaging the clean remainder beats
 * blanking the whole section to FR fallback.
 */
function stripLeakSentences(text: string): string {
  return splitSentences(text)
    .filter((s) => !hasLeak(s))
    .join(' ')
    .trim();
}

/**
 * A section needs EN work if it has an FR body and its EN is missing OR leaky.
 * Treating a leaking `body_en`/`title_en` as "needs work" lets a plain `--all`
 * re-translate any ranking whose stored EN narrates the pipeline brief.
 */
function sectionNeedsEn(s: Section): boolean {
  return (
    nonEmpty(s.body_fr) &&
    (!nonEmpty(s.body_en) ||
      !nonEmpty(s.title_en) ||
      hasLeak(str(s.body_en)) ||
      hasLeak(str(s.title_en)))
  );
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

const SELECT = 'slug,title_fr,title_en,editorial_sections';

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
  const PAGE = 200;
  let from = 0;
  const out: RankingRow[] = [];
  for (;;) {
    const r = await fetch(
      `${env.restBase}/editorial_rankings?is_published=eq.true&editorial_sections=not.is.null&select=${SELECT}&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as RankingRow[];
    for (const row of batch) {
      if ((row.editorial_sections ?? []).some(sectionNeedsEn)) out.push(row);
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

/** Clamp an over-long LLM title at a word boundary (self-heal, never reject). */
function clampTitle(v: unknown): unknown {
  if (typeof v !== 'string' || v.length <= 160) return v;
  const slice = v.slice(0, 160);
  const sp = slice.lastIndexOf(' ');
  return (sp > 60 ? slice.slice(0, sp) : slice).trim();
}

const SectionEnSchema = z.object({
  key: z.string().min(1),
  title_en: z.preprocess(clampTitle, z.string().min(3).max(160)),
  // Min 10 (not 80): some sections are legitimately short. hasLeak() + the
  // faithful-translation prompt guard quality instead of a tight length floor.
  body_en: z.string().min(10),
});

/** Defensively pull the section array out of whatever shape the model returned. */
function extractSections(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o['sections'])) return o['sections'];
    if (Array.isArray(o['items'])) return o['items'];
  }
  return [];
}

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces et hôtels d'exception.
On te donne des sections éditoriales d'un CLASSEMENT d'hôtels, en français. Tu produis la version ANGLAISE.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, dans le MÊME registre "long-read Condé Nast Traveler", fidèle au sens et au ton du français.
- Voix du Concierge : experte et complice, jamais commerciale. Phrases ≤ 25 mots. Aucun superlatif creux ("incredible", "magical", "stunning", "must-see") ; reste précis et factuel.
- Préserve EXACTEMENT tous les chiffres, classements, prix (en euros TTC), horaires, distances, noms propres, quartiers, noms d'hôtels, distinctions (Michelin, Atout France, Relais & Châteaux, Leading Hotels of the World).
- N'invente AUCUN fait absent du français. Si le français ne le dit pas, l'anglais ne le dit pas.
- Conserve une longueur comparable au français (ne résume pas, ne tronque pas).
- AUCUN méta-commentaire de pipeline : jamais "the brief", "the dossier", "AUTO_DRAFT", "pending", "confidence level", d'identifiant Wikidata, ni de backticks. Prose publiable uniquement.
- Aucune balise HTML, aucun emoji.

Pour CHAQUE section reçue, renvoie le key à l'identique + title_en + body_en.
JSON STRICT : { "sections": [{ "key": "<key à l'identique>", "title_en": "...", "body_en": "..." }] }.`;

async function callJson(openai: OpenAI, user: string): Promise<unknown> {
  const res = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Sections per LLM call — small enough that 16k output tokens never truncate. */
const SECTIONS_PER_CALL = 4;

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
  readonly translated: number;
  readonly leakDropped: number;
  readonly total: number;
  readonly ok: boolean;
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  row: RankingRow,
  dryRun: boolean,
): Promise<OneResult> {
  const sections = Array.isArray(row.editorial_sections)
    ? row.editorial_sections.map((s) => ({ ...s }))
    : [];
  const missing = sections.filter(sectionNeedsEn);
  if (missing.length === 0) {
    return { slug: row.slug, translated: 0, leakDropped: 0, total: sections.length, ok: true };
  }

  const byKey = new Map<string, Section>();
  for (const s of sections) if (nonEmpty(s.key)) byKey.set(str(s.key), s);

  let translated = 0;
  let leakDropped = 0;
  let blanked = 0;
  let parseFails = 0;
  const rankingName = row.title_en ?? row.title_fr ?? row.slug;
  const batches = chunk(missing, SECTIONS_PER_CALL);
  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b] as Section[];
    const payload = batch.map((s) => ({
      key: str(s.key),
      title_fr: str(s.title_fr),
      body_fr: str(s.body_fr),
    }));
    const user = `Classement : ${rankingName}.\nTraduis en anglais ces ${payload.length} section(s) :\n${JSON.stringify(payload, null, 2)}`;

    // Tolerant parse: get whatever sections the model returned, then validate
    // each one INDIVIDUALLY — one malformed section must not sink the batch.
    let rawSections: unknown[] = [];
    for (let attempt = 0; attempt < 3 && rawSections.length === 0; attempt += 1) {
      try {
        rawSections = extractSections(await callJson(openai, user));
      } catch {
        rawSections = [];
      }
    }
    if (rawSections.length === 0) {
      parseFails += 1;
      continue;
    }
    rawSections.forEach((rawItem, i) => {
      const ok = SectionEnSchema.safeParse(rawItem);
      if (!ok.success) return;
      const out = ok.data;
      const target = byKey.get(out.key) ?? (batch[i] as Section | undefined);
      if (target === undefined) return;
      // Anti-scaffolding gate — never persist a leaking EN translation.
      if (hasLeak(out.title_en) || hasLeak(out.body_en)) {
        const cleanTitle = hasLeak(out.title_en) ? '' : str(out.title_en);
        const strippedBody = hasLeak(out.body_en)
          ? stripLeakSentences(str(out.body_en))
          : str(out.body_en);
        if (strippedBody.length >= 100 && !hasLeak(strippedBody)) {
          target.title_en = cleanTitle;
          target.body_en = strippedBody;
          translated += 1;
          return;
        }
        leakDropped += 1;
        if (hasLeak(str(target.title_en))) {
          target.title_en = '';
          blanked += 1;
        }
        if (hasLeak(str(target.body_en))) {
          target.body_en = '';
          blanked += 1;
        }
        return;
      }
      target.title_en = out.title_en;
      target.body_en = out.body_en;
      translated += 1;
    });
  }

  if (!dryRun && (translated > 0 || blanked > 0)) {
    await patchRanking(env, row.slug, { editorial_sections: sections });
  }
  return {
    slug: row.slug,
    translated,
    leakDropped,
    total: sections.length,
    ok: (translated > 0 || blanked > 0) && parseFails === 0,
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
  if (!args.all)
    rankings = rankings.filter((r) => (r.editorial_sections ?? []).some(sectionNeedsEn));

  console.log(
    `[translate-rankings-sections-en] rankings=${rankings.length} concurrency=${args.concurrency} dryRun=${args.dryRun} grounding=inherited(translation)`,
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
      r = { slug: row.slug, translated: 0, leakDropped: 0, total: 0, ok: false };
      console.error(`  ✗ ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    console.log(
      `  [${done}/${rankings.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — EN+${r.translated}/${r.total}` +
        (r.leakDropped > 0 ? ` (leak-dropped ${r.leakDropped})` : '') +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const totalTranslated = results.reduce((a, b) => a + b.translated, 0);
  const totalLeak = results.reduce((a, b) => a + b.leakDropped, 0);
  console.log(
    `[translate-rankings-sections-en] Done — ${okCount}/${rankings.length} rankings, ${totalTranslated} sections translated, ${totalLeak} leak-dropped.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-rankings-sections-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[translate-rankings-sections-en] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
