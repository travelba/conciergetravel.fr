/**
 * enrich-ranking-faq-en-grounded.ts — re-ground the ENGLISH FAQ of a
 * city-scoped `editorial_rankings` head on the REAL anglophone search demand
 * (DataForSEO People-Also-Ask in the EN locale), WITHOUT touching its French
 * FAQ, its `editorial_ranking_entries`, intros, sections or meta.
 *
 * Why this exists (2026-06-29): the `hotel-de-luxe-{city}` /
 * `meilleurs-hotels-{city}` heads serve an `/en/classement/<slug>` page that
 * targets `luxury hotels {city}` / `best hotels {city}`. The rankings v2
 * generator and the FR FAQ re-ground tool both ground in `France/fr`, where the
 * FR seed (`hôtel de luxe {ville}`) returns ZERO People-Also-Ask for a foreign
 * city — so the EN FAQ was a faithful translation of the FR FAQ, never verified
 * against real EN demand, and `dfs_paa_coverage` came back `n/a`. This tool
 * closes that gap: it grounds against the EN-locale PAA (`United States/en` by
 * default) and re-emits ONLY the `_en` fields of each existing FAQ entry
 * (answer-first, faithful to the FR facts), optionally adding a few bilingual
 * Q&A to cover high-value EN PAA the canonical set misses. The FR fields and
 * the entry order are preserved verbatim.
 *
 * Contract:
 *   - PATCHes ONLY `editorial_rankings.faq` (PostgREST, service-role). Never
 *     touches `editorial_ranking_entries`, intro/outro, sections or meta.
 *   - Preserves every FR field + `section_anchor`; rewrites `question_en` /
 *     `answer_en` in place (1:1), keeping existing EN when the rewrite leaks.
 *   - Optionally appends up to (15 − N) NEW *bilingual* entries (so the FR page
 *     never renders an empty Q&A) anchored on uncovered on-topic EN PAA.
 *   - Output gate: `evaluatePaaCoverage(EN blobs, EN PAA)` → logs
 *     `dfs_paa_coverage=<pct>` (NON-blocking, shared soft-token matcher).
 *   - Degrade-safe: DFS off / zero EN PAA → logs `grounding=off` /
 *     `dfs_paa_coverage=n/a` and SKIPS the row (no point overwriting a good EN
 *     FAQ without real demand to anchor on).
 *
 * CLI:
 *   --slugs=a,b,c            explicit slug list (required)
 *   --location=<name>        DFS location (default "United States"; "United Kingdom" ok)
 *   --language=<code>        DFS language (default "en")
 *   --city-en=<name>         override the EN city (else derived from title_en)
 *   --refresh-grounding      bypass the DFS disk cache for this run
 *   --concurrency=<N>        parallel slugs (default 2, HARD max 2 — shared OpenAI quota)
 *   --dry-run                generate + print, do NOT PATCH
 *   --recompute-only         re-score the CURRENT EN FAQ against EN PAA (no LLM, no PATCH) —
 *                            reports the true dfs_paa_coverage % of already-patched rows
 *
 * Examples:
 *   pnpm tsx src/rankings/enrich-ranking-faq-en-grounded.ts --slugs=hotel-de-luxe-rome --dry-run
 *   pnpm tsx src/rankings/enrich-ranking-faq-en-grounded.ts --slugs=hotel-de-luxe-los-angeles,hotel-de-luxe-singapour
 *
 * Skill: keyword-grounding-dataforseo (EN-locale grounding), editorial-rankings-matrix,
 * llm-output-robustness, concierge-voice-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak, maxSentenceWords } from '../enrichment/scaffolding-gate.js';
import { evaluatePaaCoverage } from '../hotels/faq-perplexity-gates.js';
import { loadDfsConfig } from '../grounding/env-dfs.js';
import {
  buildEnCitySeeds,
  groundKeywords,
  type GroundingLocale,
  type KeywordGrounding,
} from '../grounding/keyword-grounding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const MODEL = 'gpt-4o-mini-2024-07-18';
const FAQ_MAX = 15;
const RUNLOG_DIR = resolve(__dirname, '../../runs');

/* ── CLI ─────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slugs: readonly string[];
  readonly locale: GroundingLocale;
  readonly cityEnOverride: string | null;
  readonly refreshGrounding: boolean;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly recomputeOnly: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }

  const splitList = (raw: string): string[] =>
    raw
      .split(/[\s,]+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  let slugs: string[] = [];
  const slugsRaw = map.get('slugs');
  if (typeof slugsRaw === 'string') slugs = splitList(slugsRaw);
  const fileRaw = map.get('slugs-file');
  if (typeof fileRaw === 'string') {
    try {
      slugs.push(...splitList(readFileSync(resolve(process.cwd(), fileRaw), 'utf8')));
    } catch {
      console.error(`Cannot read --slugs-file=${fileRaw}`);
      process.exit(1);
    }
  }
  slugs = [...new Set(slugs)];
  if (slugs.length === 0) {
    console.error('Usage: --slugs=a,b,c [--dry-run] [--location="United States"] [--language=en]');
    process.exit(1);
  }

  const locationRaw = map.get('location');
  const languageRaw = map.get('language');
  const cityRaw = map.get('city-en');
  const concRaw = map.get('concurrency');

  return {
    slugs,
    locale: {
      locationName:
        typeof locationRaw === 'string' && locationRaw.length > 0 ? locationRaw : 'United States',
      languageCode: typeof languageRaw === 'string' && languageRaw.length > 0 ? languageRaw : 'en',
    },
    cityEnOverride: typeof cityRaw === 'string' && cityRaw.length > 0 ? cityRaw : null,
    refreshGrounding: map.get('refresh-grounding') === true,
    concurrency: typeof concRaw === 'string' ? Math.min(2, Math.max(1, Number(concRaw) || 2)) : 2,
    dryRun: map.get('dry-run') === true,
    recomputeOnly: map.get('recompute-only') === true,
  };
}

/* ── PostgREST ─────────────────────────────────────────────────────────────── */

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

interface FaqItem {
  question_fr: string;
  question_en: string;
  answer_fr: string;
  answer_en: string;
  section_anchor?: string | null;
}

interface RankingRow {
  readonly id: string;
  readonly slug: string;
  readonly title_fr: string | null;
  readonly title_en: string | null;
  readonly faq: unknown;
}

const SELECT = 'id,slug,title_fr,title_en,faq';

async function fetchRow(env: PostgrestEnv, slug: string): Promise<RankingRow | null> {
  const url = `${env.restBase}/editorial_rankings?select=${SELECT}&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const r = await fetch(url, { headers: pgHeaders(env) });
  if (!r.ok) throw new Error(`GET ${slug}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const arr = (await r.json()) as RankingRow[];
  return Array.isArray(arr) && arr.length > 0 ? (arr[0] ?? null) : null;
}

async function patchFaq(env: PostgrestEnv, slug: string, faq: readonly FaqItem[]): Promise<void> {
  const r = await fetch(`${env.restBase}/editorial_rankings?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ faq }),
  });
  if (!r.ok) throw new Error(`PATCH ${slug}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

interface TopEntry {
  readonly rank: number;
  readonly name: string;
  readonly badgeEn: string | null;
}

/**
 * Fetch the top-N ranked hotels (rank + name + badge) so the LLM can answer
 * the dominant EN PAA families "what is the #1 / most luxurious hotel in X"
 * with the real ranking leader instead of skipping them (the entries table is
 * read-only here — never mutated).
 */
async function fetchTopEntries(
  env: PostgrestEnv,
  rankingId: string,
  limit = 6,
): Promise<TopEntry[]> {
  const url =
    `${env.restBase}/editorial_ranking_entries` +
    `?select=rank,badge_en,hotels(name)&ranking_id=eq.${encodeURIComponent(rankingId)}` +
    `&order=rank.asc&limit=${String(limit)}`;
  const r = await fetch(url, { headers: pgHeaders(env) });
  if (!r.ok) return [];
  const arr = (await r.json()) as Array<{
    rank?: unknown;
    badge_en?: unknown;
    hotels?: { name?: unknown } | null;
  }>;
  if (!Array.isArray(arr)) return [];
  const out: TopEntry[] = [];
  for (const e of arr) {
    const name = e.hotels && typeof e.hotels.name === 'string' ? e.hotels.name : '';
    if (name.length === 0) continue;
    out.push({
      rank: typeof e.rank === 'number' ? e.rank : out.length + 1,
      name,
      badgeEn: typeof e.badge_en === 'string' ? e.badge_en : null,
    });
  }
  return out;
}

/** Parse the persisted `faq` jsonb into typed bilingual entries (tolerant). */
function parseFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FaqItem[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const qfr = typeof o['question_fr'] === 'string' ? o['question_fr'] : '';
    const afr = typeof o['answer_fr'] === 'string' ? o['answer_fr'] : '';
    if (qfr.trim().length === 0 || afr.trim().length === 0) continue;
    out.push({
      question_fr: qfr,
      question_en: typeof o['question_en'] === 'string' ? o['question_en'] : '',
      answer_fr: afr,
      answer_en: typeof o['answer_en'] === 'string' ? o['answer_en'] : '',
      section_anchor: typeof o['section_anchor'] === 'string' ? o['section_anchor'] : null,
    });
  }
  return out;
}

/* ── EN city derivation ────────────────────────────────────────────────────── */

/**
 * Extract the English city/scope label from the EN ranking title, e.g.
 * "The best luxury hotels in Rome" → "Rome",
 * "The best luxury hotels on the French Riviera" → "the French Riviera".
 */
function deriveCityEn(titleEn: string | null): string | null {
  if (titleEn === null) return null;
  const m = titleEn
    .trim()
    .replace(/^the\s+best\s+(luxury\s+)?hotels?\s+/iu, '')
    .replace(/^(in|on|at|near)\s+/iu, '')
    .trim();
  return m.length > 0 ? m : null;
}

/* ── LLM ───────────────────────────────────────────────────────────────────── */

const SYSTEM = `You are a senior English-language editor for MyConciergeHotel.com, an IATA-accredited luxury hotel concierge agency.
You re-ground the ENGLISH FAQ of a city ranking page on the REAL questions anglophone travellers type into Google and ChatGPT (People-Also-Ask), without inventing any fact.

Hard rules:
- British English (en-GB), editorial concierge voice — precise, factual, never hollow superlatives ("incredible", "magical", "stunning").
- Faithful to the FRENCH source: every number, price (euros incl. tax), hotel name, distinction (Michelin, Atout France, Relais & Châteaux, Forbes, Leading Hotels of the World) and claim must already exist in the French answer. Never invent a fact, a chef, a price or a ranking to match a keyword.
- Answer-first: each answer opens with the direct answer (extractable by an LLM), then 1-2 sentences of context. NO sentence longer than 25 words.
- Reformulate each English question to match a real People-Also-Ask verbatim WHEN the theme overlaps; otherwise keep a faithful English version of the French question. Echo the PAA's own wording ("most luxurious hotel", "best area to stay", "where to stay for first-timers") so an LLM extracts the answer.
- When a People-Also-Ask asks for the BEST / #1 / MOST LUXURIOUS / HIGHEST-RATED hotel, answer by naming the rank-1 hotel from the supplied TOP HOTELS list (and 1-2 runners-up). Never invent a name or a rank.
- Select ONLY on-topic People-Also-Ask (stay, location/area, price range, dining, spa, family, booking, season, best time). IGNORE celebrity/people/biography/salary noise ("Where does Taylor Swift stay", "Where did Kim Kardashian stay", "Where do rich people stay", "What is the 15-5 rule") — never answer those.
- NO pipeline meta-commentary ever: never "the brief", "AUTO_DRAFT", "pending", "confidence level", a Wikidata id, or backticks. Publishable prose only. No HTML, no emoji.

Output STRICT JSON only: { "rewritten": [{ "index": <int>, "question_en": "...", "answer_en": "..." }], "added": [{ "question_fr": "...", "answer_fr": "...", "question_en": "...", "answer_en": "..." }] }.`;

const RewriteItemSchema = z.object({
  index: z.number().int().min(0),
  question_en: z.string().min(1).max(280),
  answer_en: z.string().min(1).max(1400),
});
const AddedItemSchema = z.object({
  question_fr: z.string().min(8).max(280),
  answer_fr: z.string().min(20).max(1400),
  question_en: z.string().min(8).max(280),
  answer_en: z.string().min(20).max(1400),
});
const LlmSchema = z.object({
  rewritten: z.array(RewriteItemSchema).default([]),
  added: z.array(AddedItemSchema).default([]),
});

function buildUserPrompt(
  cityEn: string,
  existing: readonly FaqItem[],
  grounding: KeywordGrounding,
  maxAdded: number,
  topEntries: readonly TopEntry[],
): string {
  const paa = grounding.peopleAlsoAsk.slice(0, 12);
  const kws = grounding.topKeywords
    .slice(0, 12)
    .map((k) =>
      k.searchVolume !== null ? `${k.keyword} (${String(k.searchVolume)}/mo)` : k.keyword,
    );
  const related = grounding.relatedSearches.slice(0, 10);

  const lines: string[] = [];
  lines.push(`Ranking: the best luxury hotels in ${cityEn}.`);
  lines.push('');
  if (topEntries.length > 0) {
    lines.push(
      '### TOP HOTELS IN THIS RANKING (use to answer "#1 / most luxurious hotel" PAA — never invent)',
    );
    for (const e of topEntries) {
      lines.push(`- #${String(e.rank)} ${e.name}${e.badgeEn ? ` — ${e.badgeEn}` : ''}`);
    }
    lines.push('');
  }
  lines.push('### REAL ENGLISH SEARCH DEMAND (DataForSEO, en) — anchor the FAQ on this');
  if (paa.length > 0) {
    lines.push('People Also Ask (rewrite the EN questions to match the on-topic ones):');
    for (const q of paa) lines.push(`- ${q}`);
  }
  if (kws.length > 0) {
    lines.push('', 'Top keywords (use this phrasing in questions/answers):');
    for (const k of kws) lines.push(`- ${k}`);
  }
  if (related.length > 0) {
    lines.push('', 'Related searches:');
    for (const r of related) lines.push(`- ${r}`);
  }
  lines.push('');
  lines.push('### EXISTING FAQ (French is the source of truth — translate faithfully into EN)');
  existing.forEach((f, i) => {
    lines.push(`[${i}] Q_fr: ${f.question_fr}`);
    lines.push(`     A_fr: ${f.answer_fr}`);
  });
  lines.push('');
  lines.push('### TASK');
  lines.push(
    `1. "rewritten": for EACH of the ${existing.length} entries above, output { index, question_en, answer_en }. Keep the same index. The EN answer must stay faithful to the FR answer (same facts), answer-first, 40-90 words, no sentence > 25 words. Reformulate question_en to match a real on-topic People-Also-Ask where the theme overlaps.`,
  );
  lines.push(
    `2. "added": add up to ${maxAdded} NEW bilingual Q&A (question_fr, answer_fr, question_en, answer_en) that answer the HIGHEST-VALUE on-topic People-Also-Ask NOT already covered above. Prioritise, in this order: (a) "what is the most luxurious / #1 / best-rated hotel in ${cityEn}?" — answer by naming the rank-1 hotel (and 1-2 runners-up) from the TOP HOTELS list; (b) "which area/neighbourhood is best to stay in ${cityEn}?" / "where do most tourists stay?"; (c) "where to stay in ${cityEn} for first-timers?"; (d) "what is the best time to visit ${cityEn}?". Keep (b)(c)(d) generic-but-accurate for ${cityEn} — no invented hotel-specific fact. Each new question_en MUST echo a real People-Also-Ask above. Return [] only if every on-topic PAA is already covered.`,
  );
  lines.push('');
  lines.push('Return ONLY the JSON object.');
  return lines.join('\n');
}

async function callLlm(openai: OpenAI, user: string): Promise<z.infer<typeof LlmSchema> | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 8000,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      });
      const raw = JSON.parse(res.choices[0]?.message.content ?? '') as unknown;
      const parsed = LlmSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
    } catch {
      // retry
    }
  }
  return null;
}

/* ── per-slug ──────────────────────────────────────────────────────────────── */

interface SlugResult {
  readonly slug: string;
  readonly status: 'patched' | 'dry-run' | 'skipped' | 'not-found' | 'error';
  readonly paa: number;
  readonly faqCount: number;
  readonly coveragePct: number | null;
  readonly enRewritten: number;
  readonly added: number;
  readonly note?: string;
}

async function processSlug(
  ctx: {
    readonly env: PostgrestEnv;
    readonly openai: OpenAI;
    readonly dfsCfg: ReturnType<typeof loadDfsConfig>;
    readonly args: CliArgs;
  },
  slug: string,
): Promise<SlugResult> {
  const { env, openai, dfsCfg, args } = ctx;

  const row = await fetchRow(env, slug);
  if (row === null) {
    console.warn(`[${slug}] ✗ not found.`);
    return base(slug, 'not-found');
  }
  const existing = parseFaq(row.faq);
  if (existing.length < 5) {
    console.warn(`[${slug}] ✗ only ${existing.length} parseable FAQ entries — skipping (kept).`);
    return { ...base(slug, 'error'), faqCount: existing.length, note: 'thin-existing-faq' };
  }

  const cityEn = args.cityEnOverride ?? deriveCityEn(row.title_en);
  if (cityEn === null) {
    console.warn(`[${slug}] ✗ cannot derive EN city from title_en="${row.title_en}".`);
    return { ...base(slug, 'error'), note: 'no-city' };
  }

  const seeds = buildEnCitySeeds(cityEn);
  console.log(`[${slug}] city="${cityEn}" • EN seeds=[${seeds.join(' | ')}]`);

  const grounding = await groundKeywords(dfsCfg, seeds, args.locale, {
    refresh: args.refreshGrounding,
  });
  const paaCount = grounding.peopleAlsoAsk.length;
  console.log(
    `[${slug}]   grounded=${grounding.grounded} • EN PAA=${paaCount} • kw=${grounding.topKeywords.length} • locale=${args.locale.locationName}/${args.locale.languageCode}`,
  );

  if (!grounding.grounded || paaCount === 0) {
    // Degrade-safe: no real EN demand → do NOT overwrite the existing EN FAQ.
    console.warn(
      `[${slug}]   ℹ grounding=${grounding.grounded ? 'on' : 'off'} dfs_paa_coverage=n/a (no EN PAA) — skipping (existing EN FAQ kept).`,
    );
    return { ...base(slug, 'skipped'), faqCount: existing.length, note: 'no-en-paa' };
  }

  // Read-only mode: score the CURRENT EN FAQ against EN PAA (no LLM, no PATCH).
  if (args.recomputeOnly) {
    const cov = evaluatePaaCoverage(
      existing.map((f) => `${f.question_en} ${f.answer_en}`),
      grounding.peopleAlsoAsk,
    );
    console.log(
      `[${slug}]   dfs_paa_coverage=${cov.coveragePct}% (${cov.matched}/${cov.total} EN PAA covered, ${paaCount} raw)`,
    );
    return {
      ...base(slug, 'skipped'),
      paa: paaCount,
      faqCount: existing.length,
      coveragePct: cov.coveragePct,
      note: 'recompute-only',
    };
  }

  const maxAdded = Math.max(0, FAQ_MAX - existing.length);
  const topEntries = await fetchTopEntries(env, row.id);
  const llm = await callLlm(
    openai,
    buildUserPrompt(cityEn, existing, grounding, maxAdded, topEntries),
  );
  if (llm === null) {
    console.warn(`[${slug}] ✗ LLM failed after retries — skipping (kept).`);
    return { ...base(slug, 'error'), faqCount: existing.length, note: 'llm-fail' };
  }

  // Apply rewritten EN fields in place (preserve FR + anchor). Keep existing EN
  // when the rewrite leaks scaffolding (never publish a leak).
  const byIndex = new Map<number, z.infer<typeof RewriteItemSchema>>();
  for (const r of llm.rewritten) byIndex.set(r.index, r);
  let enRewritten = 0;
  let enLeaks = 0;
  let longSentences = 0;
  const merged: FaqItem[] = existing.map((f, i) => {
    const r = byIndex.get(i);
    if (r === undefined) return f;
    const blob = `${r.question_en}\n${r.answer_en}`;
    if (hasLeak(blob)) {
      enLeaks += 1;
      return f;
    }
    if (maxSentenceWords(r.answer_en) > 25 || maxSentenceWords(r.question_en) > 25) {
      longSentences += 1;
    }
    enRewritten += 1;
    return { ...f, question_en: r.question_en.trim(), answer_en: r.answer_en.trim() };
  });

  // Append new bilingual entries (both locales gated for leaks; cap at FAQ_MAX).
  let added = 0;
  for (const a of llm.added) {
    if (merged.length >= FAQ_MAX) break;
    const blob = `${a.question_fr}\n${a.answer_fr}\n${a.question_en}\n${a.answer_en}`;
    if (hasLeak(blob)) continue;
    merged.push({
      question_fr: a.question_fr.trim(),
      answer_fr: a.answer_fr.trim(),
      question_en: a.question_en.trim(),
      answer_en: a.answer_en.trim(),
      section_anchor: null,
    });
    added += 1;
  }

  if (enLeaks > 0) console.warn(`[${slug}]   ⚠ kept existing EN on ${enLeaks} entr(y/ies) (leak).`);
  if (longSentences > 0)
    console.warn(`[${slug}]   ⚠ ${longSentences} EN entr(y/ies) carry a >25-word sentence (soft).`);

  // Output gate — EN PAA coverage of the regenerated EN FAQ (NON-blocking).
  const coverage = evaluatePaaCoverage(
    merged.map((f) => `${f.question_en} ${f.answer_en}`),
    grounding.peopleAlsoAsk,
  );
  const low = coverage.coveragePct < 50;
  const uncovered =
    low && coverage.uncovered.length > 0
      ? ` — uncovered: ${coverage.uncovered.slice(0, 5).join(' | ')}`
      : '';
  console.log(
    `[${slug}]   ${low ? '⚠' : 'ℹ'} grounding=on dfs_paa_coverage=${coverage.coveragePct}% (${coverage.matched}/${coverage.total} EN PAA covered)${low ? ' [LOW]' : ''}${uncovered}`,
  );

  if (enRewritten < Math.ceil(existing.length / 2)) {
    console.warn(
      `[${slug}] ✗ only ${enRewritten}/${existing.length} EN fields rewritten — refusing to PATCH (kept).`,
    );
    return {
      ...base(slug, 'error'),
      paa: paaCount,
      faqCount: existing.length,
      coveragePct: coverage.coveragePct,
      enRewritten,
      added,
      note: 'too-few-rewritten',
    };
  }

  if (args.dryRun) {
    console.log(`— DRY RUN [${slug}] — first 2 merged entries (EN):`);
    console.log(
      JSON.stringify(
        merged.slice(0, 2).map((f) => ({ question_en: f.question_en, answer_en: f.answer_en })),
        null,
        2,
      ),
    );
    return {
      slug,
      status: 'dry-run',
      paa: paaCount,
      faqCount: merged.length,
      coveragePct: coverage.coveragePct,
      enRewritten,
      added,
    };
  }

  await patchFaq(env, slug, merged);
  console.log(
    `[${slug}] ✓ PATCHed faq (${merged.length} entries: ${enRewritten} EN rewritten + ${added} added, ${paaCount} EN PAA, coverage ${coverage.coveragePct}%).`,
  );
  return {
    slug,
    status: 'patched',
    paa: paaCount,
    faqCount: merged.length,
    coveragePct: coverage.coveragePct,
    enRewritten,
    added,
  };
}

function base(slug: string, status: SlugResult['status']): SlugResult {
  return { slug, status, paa: 0, faqCount: 0, coveragePct: null, enRewritten: 0, added: 0 };
}

/* ── main ──────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
  const dfsCfg = loadDfsConfig();
  if (dfsCfg === null) {
    console.error(
      '⚠ DataForSEO is OFF — this tool requires EN PAA to re-ground. Set DATAFORSEO_ENABLED=true.',
    );
    process.exit(1);
  }

  console.log(
    `\n=== EN FAQ re-grounder — ${args.slugs.length} slug(s), locale=${args.locale.locationName}/${args.locale.languageCode}, concurrency=${args.concurrency}${args.dryRun ? ' [DRY RUN]' : ''} ===\n`,
  );

  const ctx = { env, openai, dfsCfg, args } as const;
  const results: SlugResult[] = [];
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < args.slugs.length) {
      const i = cursor;
      cursor += 1;
      const slug = args.slugs[i]!;
      try {
        results.push(await processSlug(ctx, slug));
      } catch (err) {
        console.error(`[${slug}] ✗ error: ${(err as Error).message}`);
        results.push({ ...base(slug, 'error'), note: (err as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.concurrency, args.slugs.length) }, worker));

  console.log('\n=== SUMMARY ===');
  const tally = (s: SlugResult['status']): number => results.filter((r) => r.status === s).length;
  console.log(
    `patched=${tally('patched')} dry-run=${tally('dry-run')} skipped=${tally('skipped')} not-found=${tally('not-found')} error=${tally('error')}`,
  );
  console.log('\nPer-head dfs_paa_coverage (EN-grounded):');
  for (const r of results) {
    const cov = r.coveragePct === null ? 'n/a' : `${r.coveragePct}%`;
    console.log(
      `  ${r.status === 'patched' || r.status === 'dry-run' ? '✓' : '•'} ${r.slug} — coverage=${cov} (${r.paa} PAA), faq=${r.faqCount} [${r.enRewritten} EN + ${r.added} added]${r.status !== 'patched' && r.status !== 'dry-run' ? ` — ${r.status}${r.note ? ` (${r.note})` : ''}` : ''}`,
    );
  }

  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `enrich-ranking-faq-en-grounded-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error('[faq-en-grounded] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
