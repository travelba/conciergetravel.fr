/**
 * translate-rankings-justifications-en.ts — EN parity backfill for
 * `editorial_ranking_entries.justification_en`.
 *
 * Why this exists: a 2026-06-29 audit
 * (docs/audits/rankings-enriched-content-audit-2026-06-29.md §1.5) found
 * 2 921 / 7 579 published entries (38 %) carry a one-line STUB `justification_en`
 * (<130 c, ~15 words) while the FR is a rich ~900 c justification. English is a
 * V1 locale → a real GEO/SEO parity hole.
 *
 * DESIGN — translate, do NOT regenerate. The FR justifications are already
 * concrete and DataForSEO-grounded (the audit reports FR median 936 c, 0 trou).
 * The sibling `enrich-ranking-justifications.ts` REWRITES both FR + EN from
 * scratch (per-ranking DFS round-trips, ~2 921 grounded calls) — appropriate
 * when the FR itself is generic, but here it would churn near-perfect FR. This
 * tool instead produces a FAITHFUL British-English rewrite of the existing FR
 * (numbers / prices / proper nouns / chefs / Michelin stars / distances /
 * distinctions preserved, no invented facts) and PATCHes ONLY `justification_en`.
 * A translation answers no new search-intent, so it inherits the FR grounding —
 * no fresh DFS round-trip (same sanctioned ST4/EN contract as the proven
 * `translate-rankings-intro-factual-en.ts` / `-tables-en.ts` / `-sections-en.ts`).
 *
 * Writes ONLY `justification_en` (composite key ranking_id+hotel_id) — DISJOINT
 * from intro/factual_summary/tables/sections backfills, never collides. The FR
 * `justification_fr` is NEVER touched.
 *
 * llm-output-robustness:
 *   1. Bounded batches — N entries per call, deduped by index id, so a long
 *      justification set never overflows the JSON response.
 *   2. Tolerant per-item parse — each returned item validated individually; a
 *      missing/malformed item leaves that entry's stub untouched, never sinks
 *      the batch.
 *   3. hasLeak() gate — a leaking EN string is sentence-salvaged; if nothing
 *      publishable survives the existing value is kept (never persist a leak).
 *   4. DB CHECK 40-1200 chars — output clamped at a sentence boundary.
 *
 * CLI:
 *   --slug=foo / --slugs=a,b,c   restrict to ranking(s)
 *   --all                        every published ranking (default when no slug)
 *   --min-en=N                   only entries whose justification_en < N chars
 *                                (default 130 — the audit stub threshold)
 *   --min-ratio=R                ALSO target entries whose EN < R×FR while FR>200
 *                                (default 0 = off). Catches condensed EN that
 *                                clears the 130c stub bar but is not at FR parity.
 *   --limit=N                    cap target entries (default 0 = no cap)
 *   --batch=N                    entries per LLM call (default 6, max 10)
 *   --concurrency=N              parallel batches (default 4, max 8)
 *   --dry-run                    generate + validate, print, do NOT persist
 *
 * Skill: editorial-voice, llm-output-robustness, typescript-strict-zod-interop,
 * editorial-rankings-matrix, keyword-grounding-dataforseo (§translation inherits).
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

const MIN_CHARS = 40;
const MAX_CHARS = 1180; // DB CHECK is 40-1200; stay safely under.

interface EntryRow {
  readonly ranking_id: string;
  readonly hotel_id: string;
  readonly justification_fr: string | null;
  readonly justification_en: string | null;
  readonly editorial_rankings: { slug: string; is_published: boolean } | null;
}

interface Target {
  readonly rankingId: string;
  readonly hotelId: string;
  readonly slug: string;
  readonly fr: string;
  readonly enBefore: number;
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

const SELECT =
  'ranking_id,hotel_id,justification_fr,justification_en,editorial_rankings!inner(slug,is_published)';

/** Page every published-ranking entry; `slugs` restricts to specific slugs. */
async function fetchEntries(env: PostgrestEnv, slugs: readonly string[]): Promise<EntryRow[]> {
  const PAGE = 500;
  let from = 0;
  const out: EntryRow[] = [];
  const slugFilter =
    slugs.length > 0
      ? `&editorial_rankings.slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`
      : '';
  for (;;) {
    const r = await fetch(
      `${env.restBase}/editorial_ranking_entries?select=${encodeURIComponent(
        SELECT,
      )}&editorial_rankings.is_published=eq.true${slugFilter}&order=ranking_id.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok)
      throw new Error(
        `PostgREST GET entries failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
      );
    const batch = (await r.json()) as EntryRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  // The inner join filters published; a null embed means the row's ranking is a
  // draft (filtered server-side) — defensively drop it.
  return out.filter((e) => e.editorial_rankings?.is_published === true);
}

async function patchEntry(
  env: PostgrestEnv,
  rankingId: string,
  hotelId: string,
  justificationEn: string,
): Promise<void> {
  const r = await fetch(
    `${env.restBase}/editorial_ranking_entries?ranking_id=eq.${encodeURIComponent(
      rankingId,
    )}&hotel_id=eq.${encodeURIComponent(hotelId)}`,
    {
      method: 'PATCH',
      headers: pgHeaders(env, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ justification_en: justificationEn }),
    },
  );
  if (!r.ok)
    throw new Error(
      `PostgREST PATCH ${rankingId}/${hotelId} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── Clamp / leak salvage ─────────────────────────────────────────────────── */

function clampToSentence(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastTerm = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('… '),
  );
  if (lastTerm > max * 0.5) return slice.slice(0, lastTerm + 1).trim();
  const sp = slice.lastIndexOf(' ');
  return (sp > max * 0.6 ? slice.slice(0, sp) : slice).trim();
}

function stripLeakSentences(text: string): string {
  return splitSentences(text)
    .filter((s) => !hasLeak(s))
    .join(' ')
    .trim();
}

/** Returns a clean, clamped EN string, or null when nothing publishable survives. */
function cleanEn(raw: string): string | null {
  let v = raw.trim();
  if (hasLeak(v)) v = stripLeakSentences(v);
  if (hasLeak(v)) return null;
  v = clampToSentence(v, MAX_CHARS);
  if (v.length < MIN_CHARS) return null;
  return v;
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

const ItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  en: z.string(),
});

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces et hôtels d'exception.
On te donne une liste de JUSTIFICATIONS d'hôtels dans des classements éditoriaux, en français. Tu produis la version ANGLAISE de chaque justification.

Règles strictes :
- Ce n'est PAS une traduction littérale mot-à-mot : c'est une réécriture native en anglais britannique (en-GB), fluide et élégante, registre "Condé Nast Traveler", fidèle au sens, au ton et à la richesse du français.
- Voix du Concierge : experte et complice, jamais commerciale. Phrases ≤ 25 mots. Aucun superlatif creux ("incredible", "magical", "stunning", "must-see").
- Conserve une longueur comparable au français (ne résume pas, ne tronque pas).
- Préserve EXACTEMENT tous les chiffres, classements, rangs, prix (en euros TTC), horaires, distances, surfaces (m²), noms propres, noms d'hôtels, de chefs, nombre d'étoiles Michelin, et toutes les distinctions (Michelin, Atout France, Relais & Châteaux, Forbes, Leading Hotels of the World, Three Keys).
- N'invente AUCUN fait absent du français. Si le français ne le dit pas, l'anglais ne le dit pas.
- INTERDIT : aucun prix/tarif ajouté, aucune mention "from"/"à partir de" absente du FR, aucune réservation.
- AUCUN méta-commentaire de pipeline : jamais "the brief", "the dossier", "AUTO_DRAFT", "pending", "confidence level", d'identifiant Wikidata, ni de backticks. Prose publiable uniquement.
- Aucune balise HTML, aucun emoji.

On te donne un tableau JSON d'items { id, fr }. Renvoie STRICTEMENT le même nombre d'items, chacun { id, en }, en conservant les id à l'identique.
JSON STRICT : { "items": [{ "id": "<id à l'identique>", "en": "..." }] }.`;

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

function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o['items'])) return o['items'];
    if (Array.isArray(o['justifications'])) return o['justifications'];
  }
  return [];
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
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

/* ── Per-batch ──────────────────────────────────────────────────────────── */

interface BatchResult {
  readonly written: number;
  readonly leakDropped: number;
  readonly failed: number;
}

async function translateBatch(
  openai: OpenAI,
  env: PostgrestEnv,
  batch: readonly Target[],
  dryRun: boolean,
): Promise<BatchResult> {
  const payload = batch.map((t, i) => ({ id: String(i), fr: t.fr }));
  const user = `Traduis en anglais britannique ces ${payload.length} justification(s) de classement :\n${JSON.stringify(
    { items: payload },
    null,
    2,
  )}`;

  let items: unknown[] = [];
  for (let attempt = 0; attempt < 3 && items.length === 0; attempt += 1) {
    try {
      items = extractItems(await callJson(openai, user));
    } catch {
      items = [];
    }
  }

  let written = 0;
  let leakDropped = 0;
  let failed = 0;
  const seen = new Set<number>();
  for (const raw of items) {
    const ok = ItemSchema.safeParse(raw);
    if (!ok.success) continue;
    const idx = Number(ok.data.id);
    if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length || seen.has(idx)) continue;
    seen.add(idx);
    const target = batch[idx] as Target;
    const clean = cleanEn(ok.data.en);
    if (clean === null) {
      leakDropped += 1;
      continue;
    }
    if (!dryRun) {
      try {
        await patchEntry(env, target.rankingId, target.hotelId, clean);
      } catch {
        failed += 1;
        continue;
      }
    } else {
      console.log(`  DRY ${target.slug}/${target.hotelId.slice(0, 8)} EN ${clean.length}c`);
    }
    written += 1;
  }
  // Items the model silently dropped count as failures (stub left untouched).
  failed += batch.length - seen.size;
  return { written, leakDropped, failed };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly minEn: number;
  readonly minRatio: number;
  readonly limit: number;
  readonly batch: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let all = false;
  let minEn = 130;
  let minRatio = 0;
  let limit = 0;
  let batch = 6;
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
    } else if (a.startsWith('--min-en=')) {
      const n = Number(a.slice('--min-en='.length));
      if (Number.isFinite(n) && n >= 0) minEn = Math.floor(n);
    } else if (a.startsWith('--min-ratio=')) {
      const n = Number(a.slice('--min-ratio='.length));
      if (Number.isFinite(n) && n >= 0 && n <= 1) minRatio = n;
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n >= 0) limit = Math.floor(n);
    } else if (a.startsWith('--batch=')) {
      const n = Number(a.slice('--batch='.length));
      if (Number.isFinite(n) && n > 0) batch = Math.min(10, Math.floor(n));
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    }
  }
  return { slugs, all, minEn, minRatio, limit, batch, concurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && args.slugs.length === 0)
    throw new Error('Pass --slug=foo, --slugs=a,b,c or --all.');
  if (!process.env['OPENAI_API_KEY']) throw new Error('OPENAI_API_KEY missing in .env.local');

  const env = loadPostgrestEnv();
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const entries = await fetchEntries(env, args.slugs);
  let targets: Target[] = entries
    .filter((e) => {
      const fr = (e.justification_fr ?? '').trim();
      const enLen = (e.justification_en ?? '').trim().length;
      if (fr.length < MIN_CHARS) return false;
      if (enLen < args.minEn) return true;
      // Condensed-EN parity gap: clears the stub bar but is far shorter than FR.
      if (args.minRatio > 0 && fr.length > 200 && enLen < fr.length * args.minRatio) return true;
      return false;
    })
    .map((e) => ({
      rankingId: e.ranking_id,
      hotelId: e.hotel_id,
      slug: e.editorial_rankings?.slug ?? '?',
      fr: (e.justification_fr ?? '').trim(),
      enBefore: (e.justification_en ?? '').trim().length,
    }));

  if (args.limit > 0) targets = targets.slice(0, args.limit);

  console.log(
    `[translate-rankings-justifications-en] entries=${entries.length} targets=${targets.length} (en<${args.minEn}${args.minRatio > 0 ? ` or en<${args.minRatio}×fr` : ''}) batch=${args.batch} concurrency=${args.concurrency} dryRun=${args.dryRun} grounding=inherited(translation)`,
  );
  if (targets.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const batches = chunk(targets, args.batch);
  let done = 0;
  let written = 0;
  let leakDropped = 0;
  let failed = 0;
  await runWithConcurrency(batches, args.concurrency, async (b) => {
    const t0 = Date.now();
    let r: BatchResult;
    try {
      r = await translateBatch(openai, env, b, args.dryRun);
    } catch (err) {
      r = { written: 0, leakDropped: 0, failed: b.length };
      console.error(`  ✗ batch: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    written += r.written;
    leakDropped += r.leakDropped;
    failed += r.failed;
    if (done % 10 === 0 || done === batches.length) {
      console.log(
        `  [${done}/${batches.length} batches] written=${written} leak-dropped=${leakDropped} failed=${failed} (last ${((Date.now() - t0) / 1000).toFixed(1)}s)`,
      );
    }
    return r;
  });

  console.log(
    `[translate-rankings-justifications-en] Done — written=${written}, leak-dropped=${leakDropped}, failed=${failed} (of ${targets.length} targets).`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-rankings-justifications-en-${ts}.json`),
    `${JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        args,
        targets: targets.length,
        written,
        leakDropped,
        failed,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[translate-rankings-justifications-en] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
