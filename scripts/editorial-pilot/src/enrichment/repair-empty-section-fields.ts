/**
 * repair-empty-section-fields.ts — restore hotel-story rendering.
 *
 * The frontend (`apps/web/src/server/hotels/get-hotel-by-slug.ts`) validates
 * `long_description_sections` with `z.string().min(1).optional()` on every
 * `title_*` / `body_*` field. A single empty string (`""`) anywhere makes the
 * whole array fail safeParse → the entire hotel story disappears.
 *
 * Many fiches carry leftover `""` fields (historic `default('')` generation +
 * the EN-placeholder bug in the residual enricher). This pass deletes every
 * empty-string section field (absent = valid optional). It is non-destructive
 * (`""` carries no content) and idempotent (only changed fiches are patched).
 *
 * Usage:
 *   npx tsx src/enrichment/repair-empty-section-fields.ts --dryRun
 *   npx tsx src/enrichment/repair-empty-section-fields.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const STRING_FIELDS = ['title_fr', 'title_en', 'body_fr', 'body_en'] as const;
const ANCHOR_REGEX = /^[a-z][a-z0-9-]{1,40}$/;

/** Derive a schema-valid anchor (`^[a-z][a-z0-9-]{1,40}$`) from a title. */
function slugifyAnchor(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/^[^a-z]+/u, '')
    .slice(0, 41);
  return ANCHOR_REGEX.test(base) ? base : 'section';
}

interface Row {
  readonly id: string;
  readonly slug: string;
  readonly long_description_sections: unknown;
}

function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  if (typeof key !== 'string' || key.length < 40)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return { url, serviceRoleKey: key };
}

/** Returns [cleaned, removedCount]. Deletes empty-string string fields. */
function sanitize(sections: unknown): [unknown[], number] {
  if (!Array.isArray(sections)) return [[], 0];
  let removed = 0;
  const seen = new Set<string>();
  const cleaned = sections.map((s) => {
    if (s === null || typeof s !== 'object') return s;
    const next: Record<string, unknown> = { ...(s as Record<string, unknown>) };
    for (const f of STRING_FIELDS) {
      if (next[f] === '') {
        delete next[f];
        removed += 1;
      }
    }
    // Backfill a schema-valid anchor when missing/invalid (else the whole
    // array fails safeParse). Derive from title_fr, dedupe with a suffix.
    const anchor = next['anchor'];
    if (typeof anchor !== 'string' || !ANCHOR_REGEX.test(anchor)) {
      const title = typeof next['title_fr'] === 'string' ? (next['title_fr'] as string) : 'section';
      let candidate = slugifyAnchor(title);
      let n = 2;
      while (seen.has(candidate)) candidate = `${slugifyAnchor(title)}-${n++}`.slice(0, 41);
      next['anchor'] = candidate;
      removed += 1;
    }
    if (typeof next['anchor'] === 'string') seen.add(next['anchor'] as string);
    return next;
  });
  return [cleaned, removed];
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await worker(items[idx] as T);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const cfg = loadRestConfig();
  const dryRun = process.argv.includes('--dryRun');

  const rows = await selectHotels<Row>(cfg, {
    columns: 'id,slug,long_description_sections',
    filters: ['is_published=eq.true', 'long_description_sections=not.is.null'],
    order: 'slug.asc',
    limit: 5000,
  });

  const toFix: { row: Row; cleaned: unknown[]; removed: number }[] = [];
  for (const row of rows) {
    const [cleaned, removed] = sanitize(row.long_description_sections);
    if (removed > 0) toFix.push({ row, cleaned, removed });
  }

  const totalRemoved = toFix.reduce((a, b) => a + b.removed, 0);
  console.log(
    `Scanned ${rows.length} published fiches. ${toFix.length} need repair (${totalRemoved} empty-string fields).` +
      (dryRun ? ' [DRY RUN — no writes]' : ''),
  );
  for (const f of toFix.slice(0, 15)) {
    console.log(`  ${f.row.slug} — ${f.removed} field(s)`);
  }
  if (dryRun || toFix.length === 0) return;

  let done = 0;
  let failed = 0;
  await runWithConcurrency(toFix, 8, async (f) => {
    try {
      await patchHotelById(cfg, f.row.id, { long_description_sections: f.cleaned });
      done += 1;
      if (done % 50 === 0) console.log(`  …patched ${done}/${toFix.length}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${f.row.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  console.log(`Done — repaired ${done}/${toFix.length} fiches (${failed} failed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
