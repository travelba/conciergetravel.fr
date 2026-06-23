/**
 * strip-wordcount-leaks.ts — deterministic removal of LLM "word-count"
 * scaffolding artefacts leaked into published editorial prose.
 *
 * Problem (2026-06-22 audit)
 * --------------------------
 * Some `editorial_guides` (and possibly `editorial_rankings`) carry a
 * trailing word-budget bookkeeping artefact the LLM emitted alongside the
 * prose and that the pipeline never stripped, e.g.:
 *   "… une escale hors du temps. Compte mots: 434"
 *   "… la baie au crépuscule. Compteur de mots: 435"
 *   "… le terroir breton. Compte: 479 mots."
 *   "… the harbour at dusk. Word count: 512"
 *   "… le littoral atlantique. Nombre de mots: 600"
 *
 * Strategy (NO LLM, fully deterministic + idempotent)
 * --------------------------------------------------
 * Walk every content string of every row (text columns + recursively
 * every string inside the jsonb content columns). For each string:
 *   1. surgically remove ONLY the artefact fragment (label + optional
 *      digits / "mots" / punctuation) in place — preserves the rest of
 *      the sentence verbatim;
 *   2. if a residual sentence still carries the marker, drop ONLY that
 *      sentence (sentence-level fallback);
 *   3. tidy dangling whitespace / orphan punctuation.
 * A field is only emptied if it contained NOTHING but the artefact.
 *
 * Backup of every touched row is written BEFORE any PATCH.
 *
 * CLI:
 *   --dry-run        (default) scan + report, no write
 *   --apply          persist the strip
 *   --table=guides|rankings|entries   restrict scope (default: all)
 *
 * Scope: editorial_guides + editorial_rankings + editorial_ranking_entries.
 * Disjoint from the places/hotels/code-classement workers.
 *
 * Skill: concierge-voice-pipeline, llm-output-robustness, content-enrichment-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

/**
 * Word-count artefact detector (boolean gate). High precision: the label
 * keyword is mandatory, so a legitimate "un récit de 434 mots" in prose is
 * NOT flagged (no "compte/compteur/nombre de mots" / "word count" label).
 */
const WORDCOUNT_LEAK =
  /\bcompt(?:e|eur)\s*(?:de\s+)?mots?\b|\bcompte\s*:\s*\d+\s*mots?\b|\bnombre\s+de\s+mots?\b|\bword[\s-]*count\b/iu;

/**
 * Surgical removal pattern: matches the WHOLE artefact fragment including
 * an optional leading separator, an optional leading qualifier word
 * ("Estimated", "Estimation", "Environ", "Total"…), the count number and
 * trailing "mots"/period. Global so every occurrence in a field is removed.
 * The trailing label keyword ("word count" / "compte … mots") is mandatory,
 * so the optional qualifier can never eat a real word that isn't glued to a
 * bona-fide count artefact.
 */
const WORDCOUNT_STRIP =
  /\s*(?:[-–—•|(\[]\s*)?(?:estimated|estimation|estim[ée]e?s?|approx\.?|approximately|environ|env\.|total|~)?\s*(?:compt(?:e|eur)\s*(?:de\s+)?mots?|compte\s*:\s*\d+\s*mots?|nombre\s+de\s+mots?|word[\s-]*count)\b\s*[:.=]?\s*\d*\s*(?:mots?|words?)?\s*[).\]]?/giu;

function hasWordCountLeak(text: string | null | undefined): boolean {
  return typeof text === 'string' && WORDCOUNT_LEAK.test(text);
}

/** Split into sentences on terminal punctuation (mirrors scaffolding-gate). */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Clean a single string: surgical strip first; if a residual sentence still
 * leaks, drop it; tidy whitespace and orphan punctuation. Returns the cleaned
 * string (possibly empty if it was ONLY the artefact).
 */
function cleanString(text: string): string {
  let out = text.replace(WORDCOUNT_STRIP, '');
  if (hasWordCountLeak(out)) {
    // Sentence-level fallback for any awkward residual.
    out = splitSentences(out)
      .filter((s) => !hasWordCountLeak(s))
      .join(' ');
  }
  return out
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+([;,.!?…])/gu, '$1')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]+\n/gu, '\n')
    .trim();
}

interface Hit {
  readonly table: string;
  readonly slug: string;
  readonly field: string;
  readonly artefact: string;
}

/**
 * Deep-walk a JSON value, cleaning every string and recording each hit.
 * Returns a structurally-identical clone with cleaned strings.
 */
function walk(value: unknown, table: string, slug: string, path: string, hits: Hit[]): unknown {
  if (typeof value === 'string') {
    if (!hasWordCountLeak(value)) return value;
    const m = value.match(WORDCOUNT_STRIP);
    hits.push({
      table,
      slug,
      field: path,
      artefact: (m?.[0] ?? value).trim().slice(0, 120),
    });
    return cleanString(value);
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => walk(v, table, slug, `${path}[${i}]`, hits));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, table, slug, path === '' ? k : `${path}.${k}`, hits);
    }
    return out;
  }
  return value;
}

function envCfg(): { base: string; key: string } {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { base: `${url.replace(/\/+$/u, '')}/rest/v1`, key };
}
function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

async function fetchAll(
  base: string,
  key: string,
  table: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  const PAGE = 500;
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const url = `${base}/${table}?select=${select}`;
    const res = await fetch(url, {
      headers: headers(key, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' }),
    });
    if (!res.ok) throw new Error(`GET ${table} ${res.status} ${(await res.text()).slice(0, 200)}`);
    const batch = (await res.json()) as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

async function patchById(
  base: string,
  key: string,
  table: string,
  idFilter: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${base}/${table}?${idFilter}`, {
    method: 'PATCH',
    headers: headers(key, { Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${table} ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Content columns scanned per table (text + jsonb). */
const GUIDE_COLS = [
  'name_fr',
  'name_en',
  'summary_fr',
  'summary_en',
  'summary_long_fr',
  'sections',
  'editorial_sections',
  'faq',
  'highlights',
  'tables',
  'glossary',
  'editorial_callouts',
  'practical_info',
  'meta_desc_fr',
  'meta_desc_en',
  'meta_title_fr',
  'meta_title_en',
] as const;

const RANKING_COLS = [
  'title_fr',
  'title_en',
  'intro_fr',
  'intro_en',
  'outro_fr',
  'outro_en',
  'editorial_sections',
  'faq',
  'tables',
  'glossary',
  'editorial_callouts',
  'meta_desc_fr',
  'meta_desc_en',
  'meta_title_fr',
  'meta_title_en',
] as const;

const ENTRY_COLS = ['justification_fr', 'justification_en', 'badge_fr', 'badge_en'] as const;

interface RowResult {
  readonly table: string;
  readonly slug: string;
  readonly idFilter: string;
  readonly before: Record<string, unknown>;
  readonly patch: Record<string, unknown>;
  readonly hits: Hit[];
}

function planTable(
  table: string,
  rows: Record<string, unknown>[],
  cols: readonly string[],
  slugOf: (r: Record<string, unknown>) => string,
  idFilterOf: (r: Record<string, unknown>) => string,
  allHits: Hit[],
): RowResult[] {
  const results: RowResult[] = [];
  for (const row of rows) {
    const slug = slugOf(row);
    const hits: Hit[] = [];
    const patch: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    for (const col of cols) {
      const val = row[col];
      if (val === null || val === undefined) continue;
      const cleaned = walk(val, table, slug, col, hits);
      if (JSON.stringify(cleaned) !== JSON.stringify(val)) {
        before[col] = val;
        patch[col] = cleaned;
      }
    }
    if (hits.length > 0) {
      allHits.push(...hits);
      results.push({ table, slug, idFilter: idFilterOf(row), before, patch, hits });
    }
  }
  return results;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const tableArg = argv.find((a) => a.startsWith('--table='))?.slice('--table='.length);
  const { base, key } = envCfg();

  const allHits: Hit[] = [];
  const results: RowResult[] = [];

  if (!tableArg || tableArg === 'guides') {
    const rows = await fetchAll(
      base,
      key,
      'editorial_guides',
      ['id', 'slug', ...GUIDE_COLS].join(','),
    );
    results.push(
      ...planTable(
        'editorial_guides',
        rows,
        GUIDE_COLS,
        (r) => String(r['slug'] ?? '?'),
        (r) => `id=eq.${encodeURIComponent(String(r['id']))}`,
        allHits,
      ),
    );
  }
  if (!tableArg || tableArg === 'rankings') {
    const rows = await fetchAll(
      base,
      key,
      'editorial_rankings',
      ['id', 'slug', ...RANKING_COLS].join(','),
    );
    results.push(
      ...planTable(
        'editorial_rankings',
        rows,
        RANKING_COLS,
        (r) => String(r['slug'] ?? '?'),
        (r) => `id=eq.${encodeURIComponent(String(r['id']))}`,
        allHits,
      ),
    );
  }
  if (!tableArg || tableArg === 'entries') {
    const rows = await fetchAll(
      base,
      key,
      'editorial_ranking_entries',
      ['ranking_id', 'hotel_id', ...ENTRY_COLS].join(','),
    );
    results.push(
      ...planTable(
        'editorial_ranking_entries',
        rows,
        ENTRY_COLS,
        (r) => `${String(r['ranking_id']).slice(0, 8)}/${String(r['hotel_id']).slice(0, 8)}`,
        (r) =>
          `ranking_id=eq.${encodeURIComponent(String(r['ranking_id']))}&hotel_id=eq.${encodeURIComponent(String(r['hotel_id']))}`,
        allHits,
      ),
    );
  }

  // Report
  console.log(`\n=== Word-count artefact scan (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  const byTable = new Map<string, number>();
  for (const h of allHits) byTable.set(h.table, (byTable.get(h.table) ?? 0) + 1);
  for (const h of allHits) {
    console.log(`  [${h.table}] ${h.slug} · ${h.field} → "${h.artefact}"`);
  }
  console.log('\n--- totals ---');
  for (const [t, n] of byTable.entries()) console.log(`  ${t}: ${n} artefacts`);
  console.log(`  rows touched: ${results.length}`);

  // Anti-regression: report any field that collapsed to empty.
  for (const r of results) {
    for (const [col, val] of Object.entries(r.patch)) {
      if (val === '' || (Array.isArray(val) && val.length === 0)) {
        console.log(`  ⚠ EMPTIED [${r.table}] ${r.slug} · ${col}`);
      }
    }
  }

  // Backup BEFORE any write.
  const RUNS = resolve(__dirname, '../../runs');
  mkdirSync(RUNS, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (results.length > 0) {
    writeFileSync(
      resolve(RUNS, `wordcount-leak-backup-${ts}.json`),
      `${JSON.stringify(
        {
          apply,
          generatedAt: new Date().toISOString(),
          rows: results.map((r) => ({
            table: r.table,
            slug: r.slug,
            idFilter: r.idFilter,
            hits: r.hits,
            before: r.before,
            patch: r.patch,
          })),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\n[backup] runs/wordcount-leak-backup-${ts}.json`);
  }

  if (apply) {
    let patched = 0;
    for (const r of results) {
      await patchById(base, key, r.table, r.idFilter, r.patch);
      patched += 1;
      console.log(`  [APPLIED] ${r.table} ${r.slug}`);
    }
    console.log(`\n[strip-wordcount-leaks] APPLIED — rows patched=${patched}`);
  } else {
    console.log(`\n[strip-wordcount-leaks] DRY-RUN — re-run with --apply to persist.`);
  }
}

main().catch((err: unknown) => {
  console.error('[strip-wordcount-leaks] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
