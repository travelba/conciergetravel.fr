/**
 * verify-rankings.ts — post-hoc DB completeness check.
 *
 * Lists every `editorial_rankings` row with its persisted entry count and,
 * when the slug maps to a combinator seed, the intended `targetLength` and
 * the resulting gap. `--strict` exits non-zero if any matched ranking is
 * below its target (C2 — 2026-06-24).
 *
 * Note: this script connects through `pg` (`SUPABASE_DB_*`). On the Windows
 * dev box those URLs don't resolve (see AGENTS.md §pg gotcha) — use
 * `report-completeness.ts` (PostgREST) for the catalogue-wide audit there.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { completenessStatus, summarizeCompleteness } from './completeness.js';
import { loadRankingsV2 } from './rankings-catalog-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

async function main(): Promise<void> {
  const strict = process.argv.slice(2).includes('--strict');

  const loaded = await loadRankingsV2({ skipUnderfilled: false });
  const targetBySlug = new Map<string, number>();
  for (const seed of loaded.matrix.seeds) targetBySlug.set(seed.slug, seed.targetLength);

  const pgMod = (await import('pg')) as typeof import('pg');
  const conn = process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '';
  const client = new pgMod.Client({
    connectionString: conn.replace(/[?&]sslmode=[^&]*/giu, ''),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const r = await client.query<{ slug: string; n: string }>(
      `select r.slug, count(e.*)::text as n
       from public.editorial_rankings r
       left join public.editorial_ranking_entries e on e.ranking_id = r.id
       group by r.slug
       order by r.slug`,
    );
    const matched = [] as ReturnType<typeof completenessStatus>[];
    for (const row of r.rows) {
      const entries = Number(row.n);
      const target = targetBySlug.get(row.slug);
      if (target === undefined) {
        console.log(`${row.slug.padEnd(40)} | entries=${String(entries).padStart(3)} | (no seed)`);
        continue;
      }
      const s = completenessStatus(row.slug, entries, target);
      matched.push(s);
      const flag = s.complete ? 'ok' : `GAP ${s.gap}`;
      console.log(
        `${row.slug.padEnd(40)} | entries=${String(entries).padStart(3)} | target=${String(target).padStart(3)} | ${flag}`,
      );
    }
    const sum = summarizeCompleteness(matched);
    console.log(
      `\nTotal: ${r.rows.length} rankings (${matched.length} matched to a seed) — complete=${sum.complete}, underfilled=${sum.underfilled}, empty=${sum.empty}.`,
    );
    if (strict && sum.underfilled > 0) {
      console.error(`\n✗ strict: ${sum.underfilled} ranking(s) below target.`);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
