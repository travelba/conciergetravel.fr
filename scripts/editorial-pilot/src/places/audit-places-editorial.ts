/**
 * audit-places-editorial.ts — read-only status for the canonical places
 * editorial envelope.
 *
 * Usage:
 *   npx tsx src/places/audit-places-editorial.ts --city=paris
 *   npx tsx src/places/audit-places-editorial.ts --city=paris --source-prefix=dt/
 */
import { loadPhotoEnv } from '../photos/env-photos.js';

import { selectTable, type SupabaseRestConfig } from './supabase-places.js';

interface CliArgs {
  readonly city: string;
  readonly sourcePrefix?: string | undefined;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city = 'paris';
  let sourcePrefix: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--source-prefix='))
      sourcePrefix = arg.slice('--source-prefix='.length);
  }
  return { city, sourcePrefix };
}

interface PlaceAuditRow {
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly source_ref: string | null;
  readonly is_published: boolean;
  readonly factual_summary_fr: string | null;
  readonly description_fr: string | null;
  readonly faq: unknown;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const filters = [`city_key=eq.${args.city}`];
  if (args.sourcePrefix !== undefined) {
    filters.push(`source_ref=like.${encodeURIComponent(`${args.sourcePrefix}%`)}`);
  }
  const rows = await selectTable<PlaceAuditRow>(cfg, 'places', {
    columns: 'slug,name,kind,source_ref,is_published,factual_summary_fr,description_fr,faq',
    filters,
    order: 'updated_at.desc',
  });

  const enriched = rows.filter((r) => r.factual_summary_fr !== null);
  const enrichedPublished = enriched.filter((r) => r.is_published);
  const byKind = new Map<string, number>();
  for (const row of enriched) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);

  console.log(`[audit-places] city=${args.city} source=${args.sourcePrefix ?? 'all'}`);
  console.log(`  total rows: ${String(rows.length)}`);
  console.log(`  enriched: ${String(enriched.length)}`);
  console.log(`  enriched + published: ${String(enrichedPublished.length)}`);
  console.log('  enriched by kind:');
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${kind.padEnd(18)} ${String(count)}`);
  }
  console.log('  latest enriched sample:');
  for (const row of enriched.slice(0, 8)) {
    const faqCount = Array.isArray(row.faq) ? row.faq.length : 0;
    console.log(
      `    ${row.slug} | ${row.kind} | published=${String(row.is_published)} | ` +
        `summary=${String(row.factual_summary_fr?.length ?? 0)}c | ` +
        `desc=${String(row.description_fr?.length ?? 0)}c | faq=${String(faqCount)}`,
    );
  }
}

main().catch((e: unknown) => {
  console.error('[audit-places] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
