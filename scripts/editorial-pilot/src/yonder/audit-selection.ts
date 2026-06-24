/**
 * audit-selection.ts — Phase A3 read-only audit of the MCH rankings selection.
 *
 * For every ranking, cross-reference three numbers:
 *   - eligibleCount : hotels the combinator deems eligible on the current
 *                     `out/hotels-catalog.json` snapshot.
 *   - entriesCount  : `editorial_ranking_entries` rows actually persisted in
 *                     Supabase (read over PostgREST — the `pg` direct host
 *                     fails on the Windows dev box, AGENTS.md §gotcha).
 *   - targetLength  : the combinator's intended list length for the seed.
 *
 * Outputs (READ-ONLY — no catalogue write):
 *   - yonder/audit-rankings.json   one row per ranking with the three numbers,
 *                                  the gap (target − entries) and flags.
 *   - yonder/audit-city-falsepos.json   hotels matched into a lieu only via a
 *                                  substring `city.includes(key)` that is NOT a
 *                                  whole-word match (classic false positive,
 *                                  e.g. "nice" ⊂ "venice").
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx src/yonder/audit-selection.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRankingsV2 } from '../rankings/rankings-catalog-v2.js';
import { LIEUX, resolveLieu } from '../rankings/axes.js';
import { eligibilityFor } from '../rankings/combinator.js';
import { loadHotelsCatalog } from '../rankings/load-hotels-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '../..');
const YONDER_DIR = path.resolve(PILOT_ROOT, 'yonder');

// ─── Env (PostgREST) ───────────────────────────────────────────────────────

const ENV_CACHE: Record<string, string> = {};

async function loadEnvFile(relPath: string): Promise<void> {
  try {
    const txt = await fs.readFile(path.resolve(REPO_ROOT, relPath), 'utf8');
    for (const line of txt.split(/\r?\n/u)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
      const k = m?.[1];
      const v = m?.[2];
      if (k !== undefined && v !== undefined && ENV_CACHE[k] === undefined) {
        ENV_CACHE[k] = v.trim().replace(/^['"]|['"]$/gu, '');
      }
    }
  } catch {
    /* ignore */
  }
}

function readEnv(name: string): string {
  return ENV_CACHE[name] ?? process.env[name] ?? '';
}

interface RestCtx {
  readonly url: string;
  readonly key: string;
}

async function restGetAll(
  ctx: RestCtx,
  table: string,
  select: string,
  extraFilter = '',
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const pageSize = 1000;
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const q =
      `${ctx.url}/rest/v1/${table}?select=${select}` +
      `${extraFilter}&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(q, {
      headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.key}` },
    });
    if (!res.ok) throw new Error(`PostgREST ${res.status} on ${table}: ${await res.text()}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error(`SELECT ${table} did not return an array.`);
    for (const r of json) out.push(r as Record<string, unknown>);
    if (json.length < pageSize) break;
  }
  return out;
}

// ─── City false-positive detector ──────────────────────────────────────────

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}

/** A whole-word match of `key` inside `city` (word boundaries on non-alnum). */
function isWholeWord(city: string, key: string): boolean {
  const c = norm(city);
  const k = norm(key)
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
  if (k.length === 0) return false;
  const re = new RegExp(
    `(?:^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:[^a-z0-9]|$)`,
    'u',
  );
  return re.test(c);
}

function includesLoose(city: string, key: string): boolean {
  return norm(city).includes(norm(key));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadEnvFile('apps/web/.env.local');
  await loadEnvFile('.env.local');
  const ctx: RestCtx = {
    url: readEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/u, ''),
    key: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
  if (ctx.url.length === 0 || ctx.key.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  }

  await fs.mkdir(YONDER_DIR, { recursive: true });

  // 1. Matrix (all seeds incl. underfilled) — eligibleCount + targetLength.
  const { matrix } = await loadRankingsV2({ skipUnderfilled: false });
  const seedBySlug = new Map(matrix.seeds.map((s) => [s.slug, s]));
  console.log(`[matrix] ${matrix.seeds.length} seeds`);

  // 2. DB rankings + entries counts (PostgREST).
  const rankingRows = await restGetAll(
    ctx,
    'editorial_rankings',
    'id,slug,title_fr,kind,is_published',
  );
  console.log(`[db] ${rankingRows.length} editorial_rankings rows`);
  const entryRows = await restGetAll(ctx, 'editorial_ranking_entries', 'ranking_id');
  console.log(`[db] ${entryRows.length} editorial_ranking_entries rows`);

  const entriesByRankingId = new Map<string, number>();
  for (const e of entryRows) {
    const rid = String(e['ranking_id'] ?? '');
    if (rid.length === 0) continue;
    entriesByRankingId.set(rid, (entriesByRankingId.get(rid) ?? 0) + 1);
  }

  interface AuditRow {
    slug: string;
    title_fr: string;
    kind: string;
    is_published: boolean;
    entries_count: number;
    eligible_count: number | null;
    target_length: number | null;
    gap_vs_target: number | null;
    in_matrix: boolean;
    underfilled: boolean;
  }

  const audit: AuditRow[] = [];
  for (const r of rankingRows) {
    const slug = String(r['slug'] ?? '');
    const id = String(r['id'] ?? '');
    const seed = seedBySlug.get(slug);
    const entries = entriesByRankingId.get(id) ?? 0;
    const target = seed ? seed.targetLength : null;
    const eligible = seed ? seed.eligibleCount : null;
    const gap = target !== null ? target - entries : null;
    audit.push({
      slug,
      title_fr: String(r['title_fr'] ?? ''),
      kind: String(r['kind'] ?? ''),
      is_published: Boolean(r['is_published']),
      entries_count: entries,
      eligible_count: eligible,
      target_length: target,
      gap_vs_target: gap,
      in_matrix: Boolean(seed),
      underfilled: gap !== null && gap > 0,
    });
  }
  audit.sort((a, b) => (b.gap_vs_target ?? -999) - (a.gap_vs_target ?? -999));

  // Seeds in matrix that have NO DB row (potential missing rankings to ship).
  const dbSlugs = new Set(rankingRows.map((r) => String(r['slug'] ?? '')));
  const matrixOnly = matrix.seeds
    .filter((s) => !dbSlugs.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      titleFr: s.titleFr,
      eligible_count: s.eligibleCount,
      target_length: s.targetLength,
      has_enough: s.hasEnoughCandidates,
    }))
    .sort((a, b) => b.eligible_count - a.eligible_count);

  // 3. City false positives (substring-but-not-whole-word matches).
  const catalog = await loadHotelsCatalog();
  interface FalsePos {
    lieu_slug: string;
    lieu_label: string;
    key: string;
    hotel_slug: string;
    hotel_name: string;
    hotel_city: string;
    country_code: string | null;
  }
  const falsePos: FalsePos[] = [];
  for (const lieu of LIEUX) {
    if (lieu.hotelCityKeys.length === 0) continue;
    for (const h of catalog) {
      for (const key of lieu.hotelCityKeys) {
        if (norm(h.city) === norm(key)) break; // exact match — fine
        if (includesLoose(h.city, key) && !isWholeWord(h.city, key)) {
          falsePos.push({
            lieu_slug: lieu.slug,
            lieu_label: lieu.label,
            key,
            hotel_slug: h.slug,
            hotel_name: h.name,
            hotel_city: h.city,
            country_code: h.country_code,
          });
        }
      }
    }
  }

  // ─── Write artefacts ──────────────────────────────────────────────────────
  await fs.writeFile(
    path.join(YONDER_DIR, 'audit-rankings.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), rankings: audit, matrixOnly }, null, 2),
    'utf8',
  );
  await fs.writeFile(
    path.join(YONDER_DIR, 'audit-city-falsepos.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), falsePositives: falsePos }, null, 2),
    'utf8',
  );

  // ─── Console summary ──────────────────────────────────────────────────────
  const published = audit.filter((a) => a.is_published);
  const underfilledPub = published.filter((a) => a.underfilled);
  const emptyPub = published.filter((a) => a.entries_count === 0);
  const notInMatrix = audit.filter((a) => !a.in_matrix);
  console.log('\n━━━ A3 selection audit ━━━');
  console.log(`  Rankings total:            ${audit.length}`);
  console.log(`  Published:                 ${published.length}`);
  console.log(`  Published underfilled:     ${underfilledPub.length} (entries < target)`);
  console.log(`  Published EMPTY (0 entry): ${emptyPub.length}`);
  console.log(`  DB rows not in matrix:     ${notInMatrix.length}`);
  console.log(`  Matrix seeds w/o DB row:   ${matrixOnly.length}`);
  console.log(`  City false-positive pairs: ${falsePos.length}`);
  console.log('\n  Top 20 underfilled published rankings (gap = target − entries):');
  for (const a of underfilledPub.slice(0, 20)) {
    console.log(
      `    ${String(a.gap_vs_target).padStart(3)}  ${a.slug.padEnd(50)} entries=${a.entries_count} target=${a.target_length} eligible=${a.eligible_count}`,
    );
  }
  console.log('\n  Top 15 city false positives:');
  for (const f of falsePos.slice(0, 15)) {
    console.log(`    [${f.lieu_slug}] key="${f.key}" ⊂ city="${f.hotel_city}" (${f.hotel_slug})`);
  }
}

main().catch((err) => {
  console.error('[audit-selection] FAILED:', err);
  process.exit(1);
});
