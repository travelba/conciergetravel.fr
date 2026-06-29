/**
 * translate-sections-en.ts — EN parity backfill for `editorial_guides.sections`.
 *
 * Why this exists: `generate-guide-v2.ts` writes the long-read FR-first and
 * leaves each section's `body_en` / `title_en` optional. A 2026-06-28 audit
 * (docs/audits/country-guides-dedup-2026-06-28.md §Handoff) found 11 published
 * CITY-scope guides serving 24 sections in FR fallback on `/en` (the
 * `pickByLocale(body_fr, body_en)` fallback in `<CityGuideArticle>`). English is
 * a V1 locale, so this is a real GEO/SEO hole on otherwise-complete guides.
 *
 * This pass translates the missing `title_en` / `body_en` of each section from
 * the FR canonical — faithfully (numbers / proper nouns / prices / distinctions
 * preserved, no invented facts), in British English, preserving every other
 * field (`key`, `type`, FR bodies) and the section order. Idempotent: a section
 * already carrying clean, non-empty EN is skipped.
 *
 * Grounding (DataForSEO): this is a FAITHFUL TRANSLATION of FR prose that was
 * already DataForSEO-grounded at generation time (`generate-guide-v2.ts`,
 * 2026-06-26). A translation introduces no new claims and answers no new
 * search-intent, so it inherits the FR grounding — no fresh DFS round-trip is
 * required (same contract as the proven `hotels/translate-sections-en.ts` and
 * `rankings/translate-rankings-tables-en.ts`). The runlog records
 * `grounding=inherited(translation)`.
 *
 * Anti-scaffolding: the EN output runs through the shared `hasLeak()` gate — a
 * translation that re-introduces pipeline meta-commentary ("the brief", "the
 * dossier"…) is sentence-salvaged or dropped, never persisted (ADR-0029).
 *
 * Editorial voice: the prompt enforces the Concierge register, ≤ 25-word
 * sentences and the banned-superlative discipline (EDITORIAL_VOICE.md).
 *
 * CLI:
 *   --slug=foo                 single guide
 *   --slugs=a,b,c              explicit list
 *   --all                      every published guide missing section EN
 *   --scope=city|region|cluster|country   restrict --all to one scope
 *   --limit=N                  cap the --all selection (default 0 = no cap)
 *   --concurrency=4            parallel guides (default 4, max 8)
 *   --dry-run                  generate + validate, do NOT persist
 *
 * Skill: editorial-long-read-rendering, editorial-voice, llm-output-robustness,
 * keyword-grounding-dataforseo (§translation inherits grounding),
 * typescript-strict-zod-interop.
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

const GUIDE_SCOPES = ['city', 'region', 'cluster', 'country'] as const;
type GuideScope = (typeof GUIDE_SCOPES)[number];

interface Section {
  key?: unknown;
  type?: unknown;
  title_fr?: unknown;
  title_en?: unknown;
  body_fr?: unknown;
  body_en?: unknown;
  [k: string]: unknown;
}

interface GuideRow {
  slug: string;
  name_fr: string;
  name_en: string | null;
  scope: GuideScope;
  sections: Section[] | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * Drop only the leaking sentence(s) from an EN translation, keep the rest.
 * The FR source is clean; the model occasionally hallucinates ONE meta
 * sentence ("…the dossier confirms…") in an otherwise-faithful translation.
 * Salvaging the clean remainder beats blanking the whole section to FR
 * fallback (mirrors hotels/translate-sections-en.ts + strip-leak-sentences.ts).
 */
function stripLeakSentences(text: string): string {
  return splitSentences(text)
    .filter((s) => !hasLeak(s))
    .join(' ')
    .trim();
}

/**
 * A section needs EN work if it has an FR body and its EN is missing OR LEAKY.
 * Treating a leaking `body_en`/`title_en` as "needs work" lets a plain `--all`
 * re-translate any guide whose stored EN narrates the pipeline brief.
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

const GUIDE_SELECT = 'slug,name_fr,name_en,scope,sections';

async function fetchGuidesBySlug(env: PostgrestEnv, slugs: readonly string[]): Promise<GuideRow[]> {
  const params = new URLSearchParams();
  params.set('select', GUIDE_SELECT);
  params.set('slug', `in.(${slugs.join(',')})`);
  const r = await fetch(`${env.restBase}/editorial_guides?${params.toString()}`, {
    headers: pgHeaders(env),
  });
  if (!r.ok)
    throw new Error(`PostgREST GET guides failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as GuideRow[];
}

async function fetchAllNeedingEn(
  env: PostgrestEnv,
  scope: GuideScope | null,
  limit: number,
): Promise<GuideRow[]> {
  const PAGE = 200;
  let from = 0;
  const out: GuideRow[] = [];
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', GUIDE_SELECT);
    params.set('is_published', 'eq.true');
    params.set('order', 'slug.asc');
    if (scope !== null) params.set('scope', `eq.${scope}`);
    const r = await fetch(`${env.restBase}/editorial_guides?${params.toString()}`, {
      headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }),
    });
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as GuideRow[];
    for (const g of batch) {
      if ((g.sections ?? []).some(sectionNeedsEn)) out.push(g);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function patchGuide(
  env: PostgrestEnv,
  slug: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`${env.restBase}/editorial_guides?slug=eq.${encodeURIComponent(slug)}`, {
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

/** Clamp an over-long LLM title to `max` chars at a word boundary (self-heal
 * rather than reject the whole batch — llm-output-robustness §post-validation). */
function clampTitle(v: unknown): unknown {
  if (typeof v !== 'string' || v.length <= 160) return v;
  const slice = v.slice(0, 160);
  const sp = slice.lastIndexOf(' ');
  return (sp > 60 ? slice.slice(0, sp) : slice).trim();
}

const SectionEnSchema = z.object({
  key: z.string().min(1),
  title_en: z.preprocess(clampTitle, z.string().min(3).max(160)),
  // Min 10 (not 80): some guide sections are legitimately short (a one-line
  // "Sources & références" lead-in). hasLeak() + the faithful-translation
  // prompt guard quality instead of an over-tight length floor.
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
On te donne des sections éditoriales longues d'un GUIDE de destination, en français. Tu produis la version ANGLAISE.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, dans le MÊME registre "long-read Condé Nast Traveler", fidèle au sens et au ton du français.
- Voix du Concierge : experte et complice, jamais commerciale. Phrases ≤ 25 mots. Aucun superlatif creux ("incredible", "magical", "stunning", "must-see") ; reste précis et factuel.
- Préserve EXACTEMENT tous les chiffres, prix (en euros TTC), horaires, distances, noms propres, quartiers, noms d'hôtels, distinctions (Michelin, Atout France, Relais & Châteaux, Leading Hotels of the World).
- N'invente AUCUN fait absent du français. Si le français ne dit pas, l'anglais ne dit pas.
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

/** Sections per LLM call — small enough that 16k output tokens never truncate a
 * guide with 350-word EN bodies (the hotel-side failures were 9-10 section
 * payloads whose single-call output overflowed and failed JSON.parse). */
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

/* ── Per-guide ──────────────────────────────────────────────────────────── */

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
  guide: GuideRow,
  dryRun: boolean,
): Promise<OneResult> {
  const sections = Array.isArray(guide.sections) ? guide.sections.map((s) => ({ ...s })) : [];
  const missing = sections.filter(sectionNeedsEn);
  if (missing.length === 0) {
    return { slug: guide.slug, translated: 0, leakDropped: 0, total: sections.length, ok: true };
  }

  const byKey = new Map<string, Section>();
  for (const s of sections) if (nonEmpty(s.key)) byKey.set(str(s.key), s);

  let translated = 0;
  let leakDropped = 0;
  let blanked = 0;
  let parseFails = 0;
  const guideName = guide.name_en ?? guide.name_fr;
  const batches = chunk(missing, SECTIONS_PER_CALL);
  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b] as Section[];
    const payload = batch.map((s) => ({
      key: str(s.key),
      title_fr: str(s.title_fr),
      body_fr: str(s.body_fr),
    }));
    const user = `Guide : ${guideName} (scope ${guide.scope}).\nTraduis en anglais ces ${payload.length} section(s) :\n${JSON.stringify(payload, null, 2)}`;

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
      // Match by key; fall back to positional index when the model alters it.
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
    await patchGuide(env, guide.slug, { sections });
  }
  return {
    slug: guide.slug,
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
  readonly scope: GuideScope | null;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseScope(v: string): GuideScope | null {
  return (GUIDE_SCOPES as readonly string[]).includes(v) ? (v as GuideScope) : null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let all = false;
  let scope: GuideScope | null = null;
  let limit = 0;
  let concurrency = 4;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--all') all = true;
    else if (a.startsWith('--slug=')) slugs = [a.slice('--slug='.length)];
    else if (a.startsWith('--scope=')) scope = parseScope(a.slice('--scope='.length));
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
  return { slugs, all, scope, limit, concurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.slugs.length === 0)
    throw new Error('Pass --slug=foo, --slugs=a,b,c or --all [--scope=city].');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const guides = args.all
    ? await fetchAllNeedingEn(env, args.scope, args.limit)
    : await fetchGuidesBySlug(env, args.slugs);
  console.log(
    `[guides:translate-sections-en] guides=${guides.length} scope=${args.scope ?? 'any'} concurrency=${args.concurrency} dryRun=${args.dryRun} grounding=inherited(translation)`,
  );
  if (guides.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let done = 0;
  const results = await runWithConcurrency(guides, args.concurrency, async (guide) => {
    const t0 = Date.now();
    let r: OneResult;
    try {
      r = await translateOne(openai, env, guide, args.dryRun);
    } catch (err) {
      r = { slug: guide.slug, translated: 0, leakDropped: 0, total: 0, ok: false };
      console.error(`  ✗ ${guide.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    console.log(
      `  [${done}/${guides.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — EN+${r.translated}/${r.total}` +
        (r.leakDropped > 0 ? ` (leak-dropped ${r.leakDropped})` : '') +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const totalTranslated = results.reduce((a, b) => a + b.translated, 0);
  const totalLeak = results.reduce((a, b) => a + b.leakDropped, 0);
  console.log(
    `[guides:translate-sections-en] Done — ${okCount}/${guides.length} guides, ${totalTranslated} sections translated, ${totalLeak} leak-dropped.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `guides-translate-sections-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[guides:translate-sections-en] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
