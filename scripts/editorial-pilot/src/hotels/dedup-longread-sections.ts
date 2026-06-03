/**
 * CLI — anti-cannibalisation cleanup of `long_description_sections`.
 *
 * Removes long-read narrative sections that TRULY duplicate a populated
 * structured block (rich `restaurant_info` / `spa_info` / POI handoff). The
 * conditional predicate lives in `@mch/domain/editorial`
 * (`dropCannibalizingSections`) — the same logic the catalogue audit
 * (`struct.no_duplicate_sections`) scores against.
 *
 * IMPORTANT — why conditional: on a bare catalogue fiche the "Restauration" /
 * "Bien-être & spa" / "À deux pas" narrative is the SOLE carrier of that
 * content (the structured block is empty). Dropping it would be content loss,
 * not de-duplication. We only drop a category section when its block is
 * genuinely populated, so this pass is safe and idempotent.
 *
 * Modes:
 *   --dry-run        list every fiche + the sections that would be dropped, NO write
 *   --slug=<slug>    restrict to one fiche
 *   --limit=<n>      cap the number of fiches processed
 *
 * Examples:
 *   pnpm dedup:longread:dry
 *   pnpm dedup:longread --slug=les-airelles-gordes
 *   pnpm dedup:longread
 *
 * Skill: content-modeling, editorial-long-read-rendering, supabase-postgres-rls.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  categoryOfSection,
  dropCannibalizingSections,
  resolvePopulatedBlocks,
  type PopulatedBlocks,
} from '@mch/domain/editorial';

import { updateHotelLongDescriptionSections, type SupabaseRestConfig } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

interface CliArgs {
  readonly dryRun: boolean;
  readonly slug: string | null;
  readonly limit: number | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let slug: string | null = null;
  let limit: number | null = null;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length) || null;
    else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }
  }
  return { dryRun, slug, limit };
}

/**
 * Lightweight paginated SELECT — only the 6 columns the dedup predicate needs.
 * The shared `listHotels` pulls every editorial column (descriptions + all
 * jsonb), which times out the server sort/scan over 2200+ rows. Ordering by
 * `slug.asc` (unique, indexed) keeps the sort cheap.
 */
interface DedupRow {
  readonly id: string;
  readonly slug: string;
  readonly long_description_sections: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly points_of_interest: unknown;
}

const DEDUP_COLUMNS =
  'id,slug,long_description_sections,restaurant_info,spa_info,points_of_interest';
const DEDUP_PAGE_SIZE = 400;

async function fetchDedupRows(
  cfg: SupabaseRestConfig,
  opts: { readonly slug: string | null; readonly limit: number | null },
): Promise<DedupRow[]> {
  const bySlug = new Map<string, DedupRow>();
  let offset = 0;
  for (;;) {
    const remaining = opts.limit !== null ? opts.limit - bySlug.size : DEDUP_PAGE_SIZE;
    if (remaining <= 0) break;
    const pageLimit = Math.min(DEDUP_PAGE_SIZE, remaining);
    const params = new URLSearchParams();
    params.set('select', DEDUP_COLUMNS);
    params.set('is_published', 'eq.true');
    params.set('order', 'slug.asc');
    params.set('limit', String(pageLimit));
    if (offset > 0) params.set('offset', String(offset));
    if (opts.slug !== null) params.set('slug', `eq.${opts.slug}`);
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[dedup-longread] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[dedup-longread] SELECT did not return an array');
    const page = json as DedupRow[];
    for (const row of page) if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
    offset += page.length;
    if (page.length < pageLimit) break;
  }
  return [...bySlug.values()];
}

function sectionLabel(entry: unknown): string {
  const rec = entry !== null && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
  const anchor = typeof rec['anchor'] === 'string' ? rec['anchor'] : '?';
  const title = typeof rec['title_fr'] === 'string' ? rec['title_fr'] : '';
  const category = categoryOfSection(entry) ?? '?';
  return `${anchor} (${category})${title ? ` — "${title}"` : ''}`;
}

interface FicheResult {
  readonly slug: string;
  readonly id: string;
  readonly before: number;
  readonly after: number;
  readonly dropped: readonly unknown[];
  readonly blocks: PopulatedBlocks;
  readonly kept: readonly unknown[];
}

function evaluateFiche(row: DedupRow): FicheResult | null {
  const sections = Array.isArray(row.long_description_sections)
    ? (row.long_description_sections as unknown[])
    : [];
  if (sections.length === 0) return null;
  const blocks = resolvePopulatedBlocks({
    restaurantInfo: row.restaurant_info,
    spaInfo: row.spa_info,
    pointsOfInterest: row.points_of_interest,
  });
  const kept = dropCannibalizingSections(sections, blocks) as unknown[];
  if (kept.length === sections.length) return null;
  const keptSet = new Set(kept);
  const dropped = sections.filter((s) => !keptSet.has(s));
  return {
    slug: row.slug,
    id: row.id,
    before: sections.length,
    after: kept.length,
    dropped,
    blocks,
    kept,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[dedup-longread] dryRun=${args.dryRun} slug=${args.slug ?? '(all)'}`);

  const rows = await fetchDedupRows(cfg, { slug: args.slug, limit: args.limit });
  console.log(`[dedup-longread] scanned ${rows.length} published fiche(s).`);

  const targets: FicheResult[] = [];
  for (const row of rows) {
    const result = evaluateFiche(row);
    if (result !== null) targets.push(result);
  }

  let totalDropped = 0;
  const byBlock = { dining: 0, spa: 0, location: 0 };
  for (const t of targets) {
    totalDropped += t.dropped.length;
    for (const d of t.dropped) {
      const cat = categoryOfSection(d);
      if (cat !== null) byBlock[cat] += 1;
    }
  }

  console.log(
    `\n[dedup-longread] ${targets.length} fiche(s) carry ${totalDropped} cannibalising section(s).`,
  );
  console.log(
    `  by block — dining(restaurant_info): ${byBlock.dining} · spa(spa_info): ${byBlock.spa} · location(rich POIs): ${byBlock.location}\n`,
  );

  for (const t of targets) {
    console.log(
      `→ ${t.slug}  ${t.before}→${t.after} sections  [blocks: ${t.blocks.dining ? 'D' : '-'}${t.blocks.spa ? 'S' : '-'}${t.blocks.location ? 'L' : '-'}]`,
    );
    for (const d of t.dropped) console.log(`     drop: ${sectionLabel(d)}`);
  }

  if (args.dryRun) {
    console.log('\n[dedup-longread] DRY RUN — no write performed.');
    return;
  }

  let written = 0;
  for (const t of targets) {
    await updateHotelLongDescriptionSections(cfg, t.id, t.kept);
    written += 1;
  }
  console.log(`\n[dedup-longread] ✅ wrote deduped sections to ${written} fiche(s).`);
}

main().catch((err) => {
  console.error('[dedup-longread] FATAL', err);
  process.exit(1);
});
