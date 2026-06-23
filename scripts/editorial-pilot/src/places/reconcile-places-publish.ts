/**
 * reconcile-places-publish.ts — align the live `places.is_published` state
 * with the strict editorial gate (`gateFailures` in publish-places.ts).
 *
 * Why this exists
 * ---------------
 * `backfill-paris.ts` historically auto-published any scaffold carrying
 * coordinates + a one-line OSM summary (`--publish-thin`, the old default).
 * That bypassed the strict gate and shipped thin templated stubs (e.g. 199
 * Paris fiches with `faq IS NULL` and `description == factual_summary`).
 * This tool unpublishes every currently-published place that does NOT clear
 * the strict gate, so the live `/lieux` vertical only ever shows
 * production-grade fiches. Rows are never deleted — `is_published` flips to
 * false and the row stays enrich-eligible (enrich targets `faq IS NULL`).
 *
 * It is the inverse of `publish-places.ts` and reuses the same gate, so the
 * two can never disagree.
 *
 * CLI
 * ---
 *   --city=<city_key>   scope to one city (default: all cities)
 *   --apply             perform the unpublish (default: dry-run report only)
 *
 * Examples
 * --------
 *   npx tsx src/places/reconcile-places-publish.ts            # dry-run, all cities
 *   npx tsx src/places/reconcile-places-publish.ts --city=paris --apply
 */
import { loadPhotoEnv } from '../photos/env-photos.js';

import { gateFailures, PLACE_GATE_COLUMNS, type PlaceGateRow } from './publish-places.js';
import { patchById, selectTable, type SupabaseRestConfig } from './supabase-places.js';

interface CliArgs {
  readonly city: string | null;
  readonly apply: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city: string | null = null;
  let apply = false;
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg === '--apply') apply = true;
  }
  return { city, apply };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const filters = ['is_published=eq.true'];
  if (args.city !== null) filters.push(`city_key=eq.${args.city}`);

  const rows = await selectTable<PlaceGateRow>(cfg, 'places', {
    columns: PLACE_GATE_COLUMNS,
    filters,
    order: 'slug.asc',
  });

  console.log(
    `[reconcile-places] ${String(rows.length)} published place(s)` +
      `${args.city !== null ? ` in ${args.city}` : ' (all cities)'} — checking against strict gate` +
      `${args.apply ? '' : ' (DRY-RUN)'}.`,
  );

  let failing = 0;
  let unpublished = 0;
  const reasonTally = new Map<string, number>();

  for (const row of rows) {
    const failures = gateFailures(row);
    if (failures.length === 0) continue;
    failing += 1;
    for (const f of failures) {
      // Tally on the failure family (strip the dynamic length suffix).
      const family = f.replace(/\s+\d+c?$/u, '').trim();
      reasonTally.set(family, (reasonTally.get(family) ?? 0) + 1);
    }
    if (args.apply) {
      await patchById(cfg, 'places', row.id, { is_published: false });
      unpublished += 1;
    }
  }

  console.log(
    `[reconcile-places] ${String(failing)} published place(s) FAIL the strict gate` +
      `${args.apply ? ` — unpublished ${String(unpublished)}` : ' (would unpublish; pass --apply to write)'}.`,
  );
  if (reasonTally.size > 0) {
    console.log('  failure families:');
    for (const [reason, count] of [...reasonTally.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${reason.padEnd(28)} ${String(count)}`);
    }
  }
}

main().catch((e: unknown) => {
  console.error('[reconcile-places] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
