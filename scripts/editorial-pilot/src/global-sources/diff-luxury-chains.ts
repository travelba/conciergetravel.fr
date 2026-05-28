/**
 * Diff `luxury-chains-hotels.json` (+ optionally the boutique
 * collections) against the live `public.hotels` catalogue, producing
 * a `luxury-chains-diff.json` report consumed by `scaffold-by-chain.ts`.
 *
 * Three buckets:
 *  - `missing`            — sources not yet in the catalogue. These
 *                           become drafts in scaffold.
 *  - `already_in_catalogue` — sources matched to an existing row
 *                             (fuzzy on name + city). Used to PATCH
 *                             `external_sources` + bump `luxury_tier`
 *                             to the chain tier when the row currently
 *                             has a weaker tier (e.g. a Four Seasons
 *                             hotel scaffolded as `lhw_member` should
 *                             upgrade to `four_seasons`).
 *  - `ambiguous`          — multiple candidate rows in the DB. Logged
 *                           for manual review; the scaffold leaves
 *                           them alone.
 *
 * Matching strategy (cheap & deterministic):
 *  1. Name normalisation (lowercase, strip accents, drop "the/le/la",
 *     drop "hotel/resort/spa/&" connectors).
 *  2. Token Jaccard ≥ 0.6 OR exact normalised match.
 *  3. City must match (after normalisation) when both sides have one.
 *  4. Country code must match.
 *
 * Usage:
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/diff-luxury-chains.ts
 *
 * Skill: editorial-pilot, content-modeling.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', 'global-sources');
const ENV_PATH = resolve(__dirname, '..', '..', '..', '..', '.env.local');

interface SourceHotel {
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly chain_facet_slug: string;
  readonly chain_display_name: string;
  readonly luxury_tier: string;
  readonly wave: string;
  readonly priority: string;
  readonly source_row: number;
  readonly resolved: boolean;
  readonly notes: readonly string[];
}

interface DbHotel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly is_published: boolean;
}

interface MatchResult {
  readonly source: SourceHotel;
  readonly db: DbHotel;
  readonly score: number;
  readonly reason: string;
}

interface DiffReport {
  readonly generated_at: string;
  readonly total_sources: number;
  readonly total_db_rows: number;
  readonly missing: readonly SourceHotel[];
  readonly already_in_catalogue: readonly MatchResult[];
  readonly ambiguous: readonly { source: SourceHotel; candidates: readonly DbHotel[] }[];
  readonly stats: Readonly<Record<string, number>>;
  readonly chain_breakdown: Readonly<Record<string, { missing: number; matched: number }>>;
}

// ─── Env loading (mirrors scaffold-relais-chateaux.ts) ─────────────────────

function loadEnv(): Record<string, string> {
  const envText = readFileSync(ENV_PATH, 'utf8');
  const env: Record<string, string> = {};
  for (const raw of envText.split('\n')) {
    const m = raw.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? '').trim();
    const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
    v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
    env[m[1] ?? ''] = v;
  }
  return env;
}

// ─── Normalisation helpers ────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'le',
  'la',
  'les',
  'l',
  'el',
  'hotel',
  'hotels',
  'resort',
  'resorts',
  'spa',
  'spas',
  'palace',
  'palaces',
  'club',
  'clubs',
  'and',
  'at',
  'by',
  'on',
  'in',
  '&',
  '-',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): readonly string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function matchScore(source: SourceHotel, db: DbHotel): number {
  if (source.country_code && db.country_code && source.country_code !== db.country_code) {
    return 0;
  }
  const nA = normalize(source.name);
  const nB = normalize(db.name);
  if (nA === nB) return 1;
  // Substring match (one is a prefix/suffix of the other).
  if (nA.includes(nB) && nB.length > 6) return 0.92;
  if (nB.includes(nA) && nA.length > 6) return 0.9;
  return jaccard(tokenize(source.name), tokenize(db.name));
}

function citiesMatch(srcCity: string, dbCity: string | null): boolean {
  if (!srcCity || !dbCity) return true; // permissive when one side is missing
  const a = normalize(srcCity);
  const b = normalize(dbCity);
  return a === b || a.includes(b) || b.includes(a);
}

// ─── Supabase fetch (PostgREST) ────────────────────────────────────────────

async function fetchAllHotels(): Promise<readonly DbHotel[]> {
  const env = loadEnv();
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    Prefer: 'count=exact',
  };

  const PAGE = 1000;
  const all: DbHotel[] = [];
  let from = 0;
  while (true) {
    const url = `${restBase}/hotels?select=id,slug,name,city,country_code,luxury_tier,is_published&order=id.asc`;
    const r = await fetch(url, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Supabase fetch failed: ${r.status} ${text}`);
    }
    const batch = (await r.json()) as DbHotel[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── Diff ──────────────────────────────────────────────────────────────────

function diffSources(sources: readonly SourceHotel[], db: readonly DbHotel[]): DiffReport {
  const missing: SourceHotel[] = [];
  const already: MatchResult[] = [];
  const ambiguous: { source: SourceHotel; candidates: DbHotel[] }[] = [];
  const chainBreakdown: Record<string, { missing: number; matched: number }> = {};

  for (const src of sources) {
    let bucket = chainBreakdown[src.chain_display_name];
    if (!bucket) {
      bucket = { missing: 0, matched: 0 };
      chainBreakdown[src.chain_display_name] = bucket;
    }

    const candidates: { db: DbHotel; score: number }[] = [];
    for (const row of db) {
      const score = matchScore(src, row);
      if (score >= 0.6 && citiesMatch(src.city, row.city)) {
        candidates.push({ db: row, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];

    if (!top) {
      missing.push(src);
      bucket.missing++;
      continue;
    }

    // If the top score is dominant (no near-tie), accept.
    const second = candidates[1];
    const dominant = !second || top.score - second.score > 0.05;

    if (dominant) {
      already.push({
        source: src,
        db: top.db,
        score: top.score,
        reason:
          top.score >= 0.99
            ? 'exact_normalised'
            : top.score >= 0.9
              ? 'substring'
              : `jaccard_${top.score.toFixed(2)}`,
      });
      bucket.matched++;
    } else {
      ambiguous.push({
        source: src,
        candidates: candidates.slice(0, 5).map((c) => c.db),
      });
    }
  }

  const stats: Record<string, number> = {
    missing: missing.length,
    already_in_catalogue: already.length,
    ambiguous: ambiguous.length,
  };

  return {
    generated_at: new Date().toISOString(),
    total_sources: sources.length,
    total_db_rows: db.length,
    missing,
    already_in_catalogue: already,
    ambiguous,
    stats,
    chain_breakdown: chainBreakdown,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sourcesPath = resolve(ROOT, 'luxury-chains-hotels.json');
  const sourcesJson = JSON.parse(readFileSync(sourcesPath, 'utf8')) as {
    readonly hotels: readonly SourceHotel[];
  };
  const luxuryChainsSources = sourcesJson.hotels;

  // Also merge `boutique-chains-hotels.json` (Wave D ultra-luxe boutique
  // brands — Cheval Blanc, COMO, Viceroy, Capella, Oetker, Soneva,
  // Nayara, Grace, NIHI). These ship in a different Excel file but feed
  // the same scaffold pipeline. Skip rows missing chain_facet_slug
  // (unmapped chains we don't currently care about).
  const boutiquePath = resolve(ROOT, 'boutique-chains-hotels.json');
  let boutiqueSources: readonly SourceHotel[] = [];
  try {
    const boutiqueJson = JSON.parse(readFileSync(boutiquePath, 'utf8')) as {
      readonly hotels: readonly Partial<SourceHotel>[];
    };
    boutiqueSources = boutiqueJson.hotels.filter(
      (h): h is SourceHotel =>
        Boolean(h.chain_facet_slug) &&
        Boolean(h.luxury_tier) &&
        Boolean(h.wave) &&
        Boolean(h.priority),
    );
    console.log(`[diff] Loaded ${boutiqueSources.length} sources from ${boutiquePath}`);
  } catch {
    console.log(`[diff] boutique-chains-hotels.json not found, skipping`);
  }

  // Optional: merge SLH (Small Luxury Hotels of the World, ~201 properties).
  // SLH is Wave C — single editorial collection, P2. Existing rows in the
  // DB that already match (frequently Aman + R&C overlaps) get patched
  // with `external_sources.boutique_slh_xlsx`. Net new rows become drafts.
  const slhPath = resolve(ROOT, 'boutique-slh-hotels.json');
  let slhSources: readonly SourceHotel[] = [];
  try {
    const slhJson = JSON.parse(readFileSync(slhPath, 'utf8')) as {
      readonly hotels: readonly Partial<SourceHotel>[];
    };
    slhSources = slhJson.hotels.filter(
      (h): h is SourceHotel =>
        Boolean(h.chain_facet_slug) &&
        Boolean(h.luxury_tier) &&
        Boolean(h.wave) &&
        Boolean(h.priority),
    );
    console.log(`[diff] Loaded ${slhSources.length} sources from ${slhPath}`);
  } catch {
    console.log(`[diff] boutique-slh-hotels.json not found, skipping`);
  }

  const sources: readonly SourceHotel[] = [
    ...luxuryChainsSources,
    ...boutiqueSources,
    ...slhSources,
  ];

  console.log(`[diff] Loaded ${luxuryChainsSources.length} sources from ${sourcesPath}`);
  console.log(`[diff] Fetching public.hotels...`);
  const db = await fetchAllHotels();
  console.log(`[diff] Loaded ${db.length} DB rows`);

  const report = diffSources(sources, db);

  const outPath = resolve(ROOT, 'luxury-chains-diff.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[diff] Wrote ${outPath}`);

  console.log(`\nGlobal stats:`);
  console.log(`  Sources       : ${report.total_sources}`);
  console.log(`  DB rows       : ${report.total_db_rows}`);
  console.log(`  Missing       : ${report.missing.length}`);
  console.log(`  Already in DB : ${report.already_in_catalogue.length}`);
  console.log(`  Ambiguous     : ${report.ambiguous.length}`);

  console.log(`\nPer-chain breakdown (chain | missing / matched):`);
  for (const [name, b] of Object.entries(report.chain_breakdown).sort(
    (a, b) => b[1].missing + b[1].matched - (a[1].missing + a[1].matched),
  )) {
    console.log(
      `  ${name.padEnd(40)} ${String(b.missing).padStart(3)} / ${String(b.matched).padStart(3)}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
