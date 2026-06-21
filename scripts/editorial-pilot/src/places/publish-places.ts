/**
 * publish-places.ts — the editorial publish gate for canonical `places`.
 *
 * `enrich-places-editorial.ts` writes the editorial envelope but deliberately
 * never flips `is_published` (see its header). This script is that missing
 * gate: it flips `is_published=true` for every enriched row that clears a
 * defensive envelope check, and reports (never publishes) the rows that don't.
 *
 * The enrich step already validates the strict Zod envelope at write time, so
 * a row carrying `faq` + `factual_summary_fr` has, by construction, passed it.
 * The checks below are a belt-and-braces re-validation against the persisted
 * row (guards against partial writes / manual edits / schema drift).
 *
 * CLI
 * ---
 *   --city=<city_key>   required-ish (default paris); scopes the flip
 *   --slug=<slug>       publish a single place
 *   --dry-run           report only, no write
 *
 * Examples
 * --------
 *   npx tsx src/places/publish-places.ts --city=gordes --dry-run
 *   npx tsx src/places/publish-places.ts --city=gordes
 */
import { loadPhotoEnv } from '../photos/env-photos.js';

import { patchById, selectTable, type SupabaseRestConfig } from './supabase-places.js';

interface ConciergeAdvice {
  readonly fr?: { readonly body?: string | null } | null;
  readonly en?: { readonly body?: string | null } | null;
}

export interface PlaceGateRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly is_published: boolean;
  readonly factual_summary_fr: string | null;
  readonly factual_summary_en: string | null;
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly concierge_advice: ConciergeAdvice | null;
  readonly faq: readonly unknown[] | null;
}

/** The exact column projection the gate needs — shared with reconcile tooling. */
export const PLACE_GATE_COLUMNS =
  'id,slug,name,is_published,factual_summary_fr,factual_summary_en,description_fr,description_en,concierge_advice,faq';

interface CliArgs {
  readonly city: string;
  readonly slug: string | null;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city = 'paris';
  let slug: string | null = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg === '--dry-run') dryRun = true;
  }
  return { city, slug, dryRun };
}

/** Returns the list of envelope failures (empty = publishable). */
export function gateFailures(row: PlaceGateRow): readonly string[] {
  const out: string[] = [];
  const fr = row.factual_summary_fr ?? '';
  const en = row.factual_summary_en ?? '';
  if (fr.length < 100 || fr.length > 200) out.push(`summary_fr ${String(fr.length)}c`);
  if (en.trim().length < 80) out.push(`summary_en ${String(en.length)}c`);
  if ((row.description_fr ?? '').length < 250) out.push('description_fr thin');
  if ((row.description_en ?? '').trim().length < 200) out.push('description_en thin');
  const faqLen = Array.isArray(row.faq) ? row.faq.length : 0;
  if (faqLen < 5) out.push(`faq ${String(faqLen)}`);
  const ca = row.concierge_advice;
  if (
    ca === null ||
    (ca.fr?.body ?? '').trim().length < 40 ||
    (ca.en?.body ?? '').trim().length < 40
  ) {
    out.push('concierge_advice missing');
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const filters = [`city_key=eq.${args.city}`, 'is_published=eq.false', 'faq=not.is.null'];
  if (args.slug !== null) filters.push(`slug=eq.${args.slug}`);

  const rows = await selectTable<PlaceGateRow>(cfg, 'places', {
    columns: PLACE_GATE_COLUMNS,
    filters,
    order: 'slug.asc',
  });

  console.log(
    `[publish-places] city=${args.city}${args.slug !== null ? ` slug=${args.slug}` : ''} — ${String(rows.length)} enriched unpublished candidate(s)`,
  );

  let published = 0;
  let skipped = 0;
  for (const row of rows) {
    const failures = gateFailures(row);
    if (failures.length > 0) {
      console.warn(`  SKIP  ${row.slug} — ${failures.join(', ')}`);
      skipped += 1;
      continue;
    }
    if (args.dryRun) {
      console.log(`  PUB?  ${row.slug} (${row.name})`);
    } else {
      await patchById(cfg, 'places', row.id, { is_published: true });
      console.log(`  PUB   ${row.slug} (${row.name})`);
    }
    published += 1;
  }

  console.log(
    `[publish-places] ${args.dryRun ? 'DRY-RUN ' : ''}published ${String(published)}, skipped ${String(skipped)}.`,
  );
}

// Run-guard: importing this module (e.g. from reconcile-places-publish.ts to
// reuse `gateFailures`) must NOT execute the publisher. Only run main() when
// invoked directly as the entry script.
if (process.argv[1]?.endsWith('publish-places.ts') === true) {
  main().catch((e: unknown) => {
    console.error('[publish-places] fatal:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
