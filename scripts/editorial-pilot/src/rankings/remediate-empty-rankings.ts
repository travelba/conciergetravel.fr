/**
 * remediate-empty-rankings.ts — unpublish published rankings that carry fewer
 * than the publishable entry floor (the "0 hôtels" class surfaced by the L3
 * site-audit crawler — docs/audits/rankings-health-crawl-2026-06-26.md).
 *
 * This is the OPERATOR-RUN remediation for the 51 already-live zero/thin
 * rankings. The write-time gate in `push-ranking-v2.ts`
 * (`resolveEffectivePublish`) prevents NEW ones, but the pg ratchet never
 * downgrades existing live rows on a re-push, so they must be unpublished
 * explicitly — exactly the kind of explicit admin op Rule 6 reserves.
 *
 * Read path mirrors `_listPublishedRankings` (apps/web); write path mirrors
 * `pushRankingV2ViaRest` (service-role PostgREST). Direct `pg` doesn't resolve
 * on the dev box, so this is REST-only.
 *
 * SAFE BY DEFAULT:
 *   - `--dry-run` is the default (prints candidates, writes nothing).
 *   - `--apply` is required to mutate.
 *   - Aborts if the candidate set exceeds `--max-unpublish` (default 120) —
 *     a runaway count means a query bug, not a real remediation; never
 *     mass-unpublish blindly. Override with `--force` when the audit count is
 *     understood.
 *   - Only ever sets `is_published=false`. Never publishes anything.
 *
 * Usage (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env):
 *   tsx src/rankings/remediate-empty-rankings.ts                 # dry-run
 *   tsx src/rankings/remediate-empty-rankings.ts --floor=3       # dry-run, custom floor
 *   tsx src/rankings/remediate-empty-rankings.ts --apply         # mutate
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

import { MIN_PUBLISHABLE_ENTRIES } from './push-ranking-v2.js';

export interface PublishedRanking {
  readonly id: string;
  readonly slug: string;
}

export interface UnpublishCandidate {
  readonly id: string;
  readonly slug: string;
  readonly entryCount: number;
}

/**
 * Pure selection: which published rankings fall below the entry floor.
 * Exported for unit testing — the network code just feeds it.
 */
export function selectUnpublishCandidates(
  rankings: readonly PublishedRanking[],
  counts: ReadonlyMap<string, number>,
  floor: number = MIN_PUBLISHABLE_ENTRIES,
): readonly UnpublishCandidate[] {
  const out: UnpublishCandidate[] = [];
  for (const r of rankings) {
    const entryCount = counts.get(r.id) ?? 0;
    if (entryCount < floor) out.push({ id: r.id, slug: r.slug, entryCount });
  }
  return out.sort((a, b) => a.entryCount - b.entryCount || a.slug.localeCompare(b.slug));
}

interface RestCfg {
  readonly url: string;
  readonly key: string;
}

function resolveRestCfg(): RestCfg {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? null;
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? null;
  if (url === null || key === null) {
    throw new Error(
      'remediate-empty-rankings requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  return { url: url.replace(/\/$/u, ''), key };
}

const PAGE = 1000;

async function fetchPublishedRankings(cfg: RestCfg): Promise<PublishedRanking[]> {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } as const;
  const out: PublishedRanking[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const res = await fetch(
      `${cfg.url}/rest/v1/editorial_rankings?select=id,slug&is_published=eq.true&order=id`,
      { headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } },
    );
    if (!res.ok) throw new Error(`fetch rankings failed (${res.status}): ${await res.text()}`);
    const rows = (await res.json()) as Array<{ id: string; slug: string }>;
    out.push(...rows.map((r) => ({ id: r.id, slug: r.slug })));
    if (rows.length < PAGE) break;
  }
  return out;
}

async function fetchEntryCounts(cfg: RestCfg): Promise<Map<string, number>> {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } as const;
  const counts = new Map<string, number>();
  for (let from = 0; from < 40000; from += PAGE) {
    const res = await fetch(
      `${cfg.url}/rest/v1/editorial_ranking_entries?select=ranking_id&order=ranking_id`,
      { headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } },
    );
    if (!res.ok) throw new Error(`fetch entries failed (${res.status}): ${await res.text()}`);
    const rows = (await res.json()) as Array<{ ranking_id: string }>;
    for (const r of rows) counts.set(r.ranking_id, (counts.get(r.ranking_id) ?? 0) + 1);
    if (rows.length < PAGE) break;
  }
  return counts;
}

async function unpublish(cfg: RestCfg, id: string): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/editorial_rankings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_published: false }),
  });
  if (!res.ok) throw new Error(`unpublish ${id} failed (${res.status}): ${await res.text()}`);
}

interface Args {
  readonly apply: boolean;
  readonly force: boolean;
  readonly floor: number;
  readonly maxUnpublish: number;
}

function parseArgs(argv: readonly string[]): Args {
  const flags = new Set(
    argv.filter((a) => a.startsWith('--') && !a.includes('=')).map((a) => a.slice(2)),
  );
  const kv = new Map(
    argv
      .filter((a) => a.startsWith('--') && a.includes('='))
      .map((a) => [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] as const),
  );
  const num = (k: string, d: number): number => {
    const v = kv.get(k);
    if (v === undefined) return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    apply: flags.has('apply'),
    force: flags.has('force'),
    floor: num('floor', MIN_PUBLISHABLE_ENTRIES),
    maxUnpublish: num('max-unpublish', 120),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = resolveRestCfg();
  console.log(
    `\n🧹 remediate-empty-rankings — floor=${args.floor} mode=${args.apply ? 'APPLY' : 'dry-run'}\n`,
  );

  const [rankings, counts] = await Promise.all([
    fetchPublishedRankings(cfg),
    fetchEntryCounts(cfg),
  ]);
  const candidates = selectUnpublishCandidates(rankings, counts, args.floor);

  console.log(`Published rankings: ${rankings.length}`);
  console.log(`Below floor (${args.floor}): ${candidates.length}\n`);
  for (const c of candidates) console.log(`  ${c.entryCount} entries — ${c.slug}`);

  if (candidates.length === 0) {
    console.log('\nNothing to do.');
    return;
  }
  if (candidates.length > args.maxUnpublish && !args.force) {
    console.error(
      `\n✗ ${candidates.length} candidates exceeds --max-unpublish=${args.maxUnpublish}. ` +
        'Refusing to mass-unpublish (likely a query bug). Re-run with --force if the count is understood.',
    );
    process.exit(2);
  }
  if (!args.apply) {
    console.log('\n(dry-run — nothing written. Re-run with --apply to unpublish.)');
    return;
  }

  let ok = 0;
  for (const c of candidates) {
    await unpublish(cfg, c.id);
    ok += 1;
    console.log(`  ✓ unpublished ${c.slug}`);
  }
  console.log(`\nDone. Unpublished ${ok}/${candidates.length} empty/thin rankings.`);
}

// Run-guard: only execute when invoked directly (not when imported by a test).
if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((err: unknown) => {
    console.error('remediate-empty-rankings crashed:', err);
    process.exit(1);
  });
}
