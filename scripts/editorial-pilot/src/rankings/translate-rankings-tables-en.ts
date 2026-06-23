/**
 * translate-rankings-tables-en.ts — EN parity backfill for the comparison
 * TABLE block of `editorial_rankings.tables`.
 *
 * Why this exists: a 2026-06-23 audit found that on ~674 published rankings the
 * comparison table renders FR-only on the `/en/classement/<slug>` page. The
 * generator (`generate-ranking-v2.ts`) already emits bilingual *headers*
 * (`label_fr`/`label_en`), `title_en` and `note_en` — those are 100% populated.
 * The hole is the ROW CELL CONTENT: cells are a single FR `Record<string, cell>`
 * with NO locale dimension, so the table body (badges "Palace Atout France",
 * atmospheres "Urbaine, contemporaine, très privée", budgets "à partir de
 * 1 500€/nuit") stays French on the English page. English is a V1 locale → a
 * real GEO/SEO parity hole.
 *
 * The fix is a parallel `rows_en` array inside each table object (additive — the
 * FR `rows` are never touched). The renderer (`editorial-table.tsx`) picks
 * `rows_en` when `locale === 'en'` and falls back to `rows` otherwise, so the
 * change is fully backward-compatible: a table without `rows_en` renders exactly
 * as before. This tool ALSO fills any residual `title_en` / `note_en` /
 * `headers[].label_en` (idempotent — only empty/absent fields are written).
 *
 * Writes ONLY `editorial_rankings.tables` — DISJOINT from
 * `editorial_ranking_entries.justification_*` (a sibling worker), so the two
 * backfills never collide.
 *
 * llm-output-robustness lessons applied:
 *   1. Bounded batches — translatable cell strings are deduped and chunked
 *      (CELLS_PER_CALL) so a 25×8 table never overflows the JSON response.
 *   2. Tolerant per-item parse — each returned translation is validated and
 *      keyed individually; a missing/malformed item falls back to the FR
 *      original for that cell, never sinking the whole table.
 *   3. hasLeak() gate — any EN string carrying pipeline scaffolding is dropped
 *      and the FR original kept instead (never persist a leak).
 *
 * CLI:
 *   --slug=foo                 single ranking
 *   --slugs=a,b,c              explicit list
 *   --all                      every published ranking whose tables need EN
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

/* ── Table shape (mirror of get-ranking-by-slug.ts TableSchema) ───────────── */

type ObjCell = { text: string; href?: string | null };
type Cell = string | number | boolean | null | ObjCell;
type Row = Record<string, Cell>;

interface TableHeader {
  key: string;
  label_fr: string;
  label_en?: string;
  align?: 'left' | 'right' | 'center';
}

interface Table {
  key: string;
  kind: string;
  title_fr: string;
  title_en?: string;
  note_fr?: string;
  note_en?: string;
  headers: TableHeader[];
  rows: Row[];
  rows_en?: Row[];
  [k: string]: unknown;
}

interface RankingRow {
  slug: string;
  title_fr: string | null;
  tables: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/** A `{ text, href }` object cell (the only object shape the schema allows). */
function isObjCell(v: unknown): v is ObjCell {
  return v !== null && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string';
}

/** True when a cell carries translatable FR text (string or `{text}` object). */
function cellText(cell: Cell): string | null {
  if (typeof cell === 'string') return cell.trim().length > 0 ? cell : null;
  if (isObjCell(cell)) return cell.text.trim().length > 0 ? cell.text : null;
  return null;
}

/* ── "needs work" predicates (idempotent) ─────────────────────────────────── */

/** A table's row cells need EN if any translatable FR cell lacks a non-empty
 * EN counterpart at the same row index + header key in `rows_en`. */
function rowsNeedEn(t: Table): boolean {
  const rows = Array.isArray(t.rows) ? t.rows : [];
  const rowsEn = Array.isArray(t.rows_en) ? t.rows_en : [];
  if (rows.length === 0) return false;
  for (let i = 0; i < rows.length; i += 1) {
    const fr = rows[i] ?? {};
    const en = rowsEn[i] ?? {};
    for (const key of Object.keys(fr)) {
      if (cellText(fr[key] as Cell) === null) continue;
      const enText = cellText((en as Row)[key] as Cell);
      if (enText === null) return true;
    }
  }
  return false;
}

function headersNeedEn(t: Table): boolean {
  if (nonEmpty(t.title_fr) && !nonEmpty(t.title_en)) return true;
  if (nonEmpty(t.note_fr) && !nonEmpty(t.note_en)) return true;
  for (const h of Array.isArray(t.headers) ? t.headers : []) {
    if (nonEmpty(h.label_fr) && !nonEmpty(h.label_en)) return true;
  }
  return false;
}

function tableNeedsEn(t: Table): boolean {
  return rowsNeedEn(t) || headersNeedEn(t);
}

function rankingNeedsEn(tables: unknown): boolean {
  if (!Array.isArray(tables) || tables.length === 0) return false;
  return tables.some((t) => tableNeedsEn(t as Table));
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

const SELECT = 'slug,title_fr,tables';

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
      `${env.restBase}/editorial_rankings?is_published=eq.true&tables=not.is.null&select=${SELECT}&order=slug.asc`,
      { headers: pgHeaders(env, { Range: `${from}-${from + PAGE - 1}` }) },
    );
    if (!r.ok) throw new Error(`PostgREST page failed: ${r.status}`);
    const batch = (await r.json()) as RankingRow[];
    for (const row of batch) {
      if (rankingNeedsEn(row.tables)) out.push(row);
      if (limit > 0 && out.length >= limit) return out;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function patchRanking(env: PostgrestEnv, slug: string, tables: Table[]): Promise<void> {
  const r = await fetch(`${env.restBase}/editorial_rankings?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ tables }),
  });
  if (!r.ok)
    throw new Error(
      `PostgREST PATCH ${slug} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── LLM ────────────────────────────────────────────────────────────────── */

// `id` is tolerant: the model sometimes echoes it as a number (0) rather than
// the string "0" we sent. Coerce both to string so a numeric id never sinks
// the item (llm-output-robustness §post-validation — self-heal the shape).
const ItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  en: z.string(),
});

const SYSTEM = `Tu es traductrice-éditrice senior pour MyConciergeHotel.com, agence IATA de palaces.
On te donne une liste de cellules de TABLEAU COMPARATIF d'un classement d'hôtels, en français (badges, ambiances, points forts, niveaux de budget, fourchettes de prix, profils). Tu produis la version ANGLAISE de chaque cellule.

Règles strictes :
- Réécriture native en anglais britannique (en-GB), concise et fidèle, dans le MÊME registre éditorial. Une cellule de tableau est courte : garde-la courte (pas de phrase ajoutée).
- Préserve EXACTEMENT tous les chiffres, montants, prix (en euros, garde le symbole € et le montant : "à partir de 1 500€/nuit" -> "from €1,500/night"), pourcentages, distances, années, et toutes les distinctions/labels (Michelin, Atout France, Relais & Châteaux, Forbes, Leading Hotels of the World, "Palace Atout France", "Resort 5★").
- Les noms propres (hôtels, Maisons, villes, chefs, marques) restent IDENTIQUES, non traduits.
- N'invente AUCUN fait. Si une cellule est déjà un nom propre ou un label intraduisible, renvoie-la à l'identique.
- AUCUN méta-commentaire de pipeline : jamais "the brief", "AUTO_DRAFT", "pending", "confidence level", d'identifiant Wikidata, ni de backticks.
- Aucune balise HTML, aucun emoji ajouté.

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

/** Defensively pull the items array out of whatever shape the model returned. */
function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o['items'])) return o['items'];
    if (Array.isArray(o['cells'])) return o['cells'];
  }
  return [];
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Cells per LLM call — table cells are short, so 30 per call keeps the JSON
 * response well within 8k output tokens (a worst-case 25×8 table = 200 cells,
 * usually far fewer after dedup → ~3-7 calls). */
const CELLS_PER_CALL = 30;

/**
 * Translate a deduped set of FR strings → EN map. Tolerant per-item: a missing
 * or malformed item simply never lands in the map, so the caller falls back to
 * the FR original for that cell (never an empty EN cell). hasLeak() drops a
 * leaking EN string so the FR original is kept instead.
 */
async function translateStrings(
  openai: OpenAI,
  unique: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const indexed = unique.map((fr, i) => ({ id: String(i), fr }));
  for (const batch of chunk(indexed, CELLS_PER_CALL)) {
    const user = `Traduis en anglais britannique ces ${batch.length} cellule(s) de tableau :\n${JSON.stringify(
      { items: batch },
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
    for (const raw of items) {
      const ok = ItemSchema.safeParse(raw);
      if (!ok.success) continue;
      const idx = Number(ok.data.id);
      if (!Number.isInteger(idx) || idx < 0 || idx >= unique.length) continue;
      const fr = unique[idx] as string;
      const en = ok.data.en.trim();
      if (en.length === 0) continue;
      if (hasLeak(en)) continue; // keep FR original (caller falls back)
      out.set(fr, en);
    }
  }
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

/* ── Per-ranking ────────────────────────────────────────────────────────── */

interface OneResult {
  readonly slug: string;
  readonly tablesTouched: number;
  readonly cellsTranslated: number;
  readonly cellsKeptFr: number;
  readonly headerFieldsFilled: number;
  readonly ok: boolean;
}

/** Build one localized cell from its FR counterpart using the translation map.
 * Non-text cells (number/bool/null) are copied verbatim. A string/{text} cell
 * keeps its FR value when no faithful EN translation exists. */
function localizeCell(cell: Cell, map: Map<string, string>): Cell {
  if (typeof cell === 'string') return map.get(cell) ?? cell;
  if (isObjCell(cell)) {
    const en = map.get(cell.text);
    const text = en ?? cell.text;
    return cell.href === undefined ? { text } : { text, href: cell.href };
  }
  return cell; // number | boolean | null
}

async function translateOne(
  openai: OpenAI,
  env: PostgrestEnv,
  row: RankingRow,
  dryRun: boolean,
): Promise<OneResult> {
  const tables = Array.isArray(row.tables) ? (row.tables as Table[]) : [];
  if (tables.length === 0 || !rankingNeedsEn(tables)) {
    return {
      slug: row.slug,
      tablesTouched: 0,
      cellsTranslated: 0,
      cellsKeptFr: 0,
      headerFieldsFilled: 0,
      ok: true,
    };
  }

  // 1. Collect every translatable FR string across all tables (cells + header
  //    labels + titles + notes that lack EN), dedup, translate once.
  const uniqueSet = new Set<string>();
  for (const t of tables) {
    if (!tableNeedsEn(t)) continue;
    for (const r of Array.isArray(t.rows) ? t.rows : []) {
      for (const key of Object.keys(r)) {
        const txt = cellText(r[key] as Cell);
        if (txt !== null) uniqueSet.add(txt);
      }
    }
    if (nonEmpty(t.title_fr) && !nonEmpty(t.title_en)) uniqueSet.add(t.title_fr);
    if (nonEmpty(t.note_fr) && !nonEmpty(t.note_en)) uniqueSet.add(str(t.note_fr));
    for (const h of Array.isArray(t.headers) ? t.headers : []) {
      if (nonEmpty(h.label_fr) && !nonEmpty(h.label_en)) uniqueSet.add(h.label_fr);
    }
  }
  const unique = [...uniqueSet];
  const map =
    unique.length > 0 ? await translateStrings(openai, unique) : new Map<string, string>();

  // 2. Rebuild each table that needs work: parallel rows_en + residual labels.
  let tablesTouched = 0;
  let cellsTranslated = 0;
  let cellsKeptFr = 0;
  let headerFieldsFilled = 0;
  const nextTables: Table[] = tables.map((t) => {
    if (!tableNeedsEn(t)) return t;
    tablesTouched += 1;
    const rows = Array.isArray(t.rows) ? t.rows : [];
    const rowsEn: Row[] = rows.map((r) => {
      const out: Row = {};
      for (const key of Object.keys(r)) {
        const cell = r[key] as Cell;
        const localized = localizeCell(cell, map);
        out[key] = localized;
        const frTxt = cellText(cell);
        if (frTxt !== null) {
          if (map.has(frTxt)) cellsTranslated += 1;
          else cellsKeptFr += 1;
        }
      }
      return out;
    });
    const next: Table = { ...t, rows_en: rowsEn };
    if (nonEmpty(t.title_fr) && !nonEmpty(t.title_en)) {
      const en = map.get(t.title_fr);
      if (en !== undefined) {
        next.title_en = en;
        headerFieldsFilled += 1;
      }
    }
    if (nonEmpty(t.note_fr) && !nonEmpty(t.note_en)) {
      const en = map.get(str(t.note_fr));
      if (en !== undefined) {
        next.note_en = en;
        headerFieldsFilled += 1;
      }
    }
    next.headers = (Array.isArray(t.headers) ? t.headers : []).map((h) => {
      if (nonEmpty(h.label_fr) && !nonEmpty(h.label_en)) {
        const en = map.get(h.label_fr);
        if (en !== undefined) {
          headerFieldsFilled += 1;
          return { ...h, label_en: en };
        }
      }
      return h;
    });
    return next;
  });

  if (!dryRun && tablesTouched > 0) {
    await patchRanking(env, row.slug, nextTables);
  }

  return {
    slug: row.slug,
    tablesTouched,
    cellsTranslated,
    cellsKeptFr,
    headerFieldsFilled,
    ok: tablesTouched > 0,
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
  if (!args.all) rankings = rankings.filter((r) => rankingNeedsEn(r.tables));

  console.log(
    `[translate-rankings-tables-en] rankings=${rankings.length} concurrency=${args.concurrency} dryRun=${args.dryRun}`,
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
      r = {
        slug: row.slug,
        tablesTouched: 0,
        cellsTranslated: 0,
        cellsKeptFr: 0,
        headerFieldsFilled: 0,
        ok: false,
      };
      console.error(`  ✗ ${row.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
    done += 1;
    console.log(
      `  [${done}/${rankings.length}] ${r.ok ? '✓' : '✗'} ${r.slug} — ` +
        `tables ${r.tablesTouched}, cells EN+${r.cellsTranslated} (kept-fr ${r.cellsKeptFr})` +
        (r.headerFieldsFilled > 0 ? `, labels +${r.headerFieldsFilled}` : '') +
        ` (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
    return r;
  });

  const okCount = results.filter((r) => r.ok).length;
  const totalTables = results.reduce((a, b) => a + b.tablesTouched, 0);
  const totalCells = results.reduce((a, b) => a + b.cellsTranslated, 0);
  const totalKept = results.reduce((a, b) => a + b.cellsKeptFr, 0);
  const totalLabels = results.reduce((a, b) => a + b.headerFieldsFilled, 0);
  console.log(
    `[translate-rankings-tables-en] Done — ${okCount}/${rankings.length} rankings, ` +
      `${totalTables} tables localized, ${totalCells} cells translated (kept-fr ${totalKept}), ` +
      `${totalLabels} header/title/note labels filled.`,
  );

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `translate-rankings-tables-en-${ts}.json`),
    `${JSON.stringify({ finishedAt: new Date().toISOString(), args, results }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[translate-rankings-tables-en] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
