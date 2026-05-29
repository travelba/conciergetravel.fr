/**
 * scaffold-grecotel.ts — write Grecotel catalogue into public.hotels.
 *
 * Two operations:
 *   1. INSERT missing Grecotel properties (from grecotel-missing.json) as
 *      drafts:
 *        stars=<extracted | 5 fallback>, is_palace=false,
 *        luxury_tier='grecotel', booking_mode='display_only',
 *        priority='P2', is_published=false,
 *        country_code='GR', country_label_fr='Grèce', country_label_en='Greece',
 *        affiliations=[{
 *          kind: 'brand',
 *          source: 'grecotel',
 *          display_name: 'Grecotel Hotels & Resorts',
 *          verified: true,
 *          facet_slug: 'grecotel',
 *          source_url: <grecotel page URL>,
 *          scraped_at: <ISO>,
 *          metadata: { collection, number_of_rooms, number_of_restaurants,
 *                      has_spa, has_pool, has_kids_club, is_all_inclusive,
 *                      airport_distance, year_round, tagline, short_description }
 *        }]
 *
 *   2. PATCH existing rows (from grecotel-already-in-catalogue.json) — keep
 *      their existing `luxury_tier` (it's the strongest signal, e.g. Cape
 *      Sounio = 'lhw_member' should remain LHW even when we record Grecotel
 *      membership). Just append the `grecotel` entry to `affiliations`
 *      if not already present (idempotent).
 *
 * Affiliations contract (since migration 0062): see
 * `packages/db/src/schema/affiliations.ts`.
 *
 * Both operations use PostgREST (no `pg` client dependency) — consistent
 * with scaffold-relais-chateaux.ts. Inserts use `on_conflict=slug` +
 * `Prefer: resolution=ignore-duplicates` so a slug collision is a no-op
 * (the human can promote the existing row via the patches loop afterwards).
 *
 * Usage:
 *   pnpm grecotel:scaffold:dry   # preview only (SQL emitted to grecotel-scaffold.sql)
 *   pnpm grecotel:scaffold       # actually insert + patch
 *
 * Skill: supabase-postgres-rls, api-integration, content-modeling.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
const ENV = resolve(__dirname, '../../../../.env.local');

const envText = readFileSync(ENV, 'utf8');
const env: Record<string, string> = {};
for (const raw of envText.split('\n')) {
  const m = raw.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = (m[2] ?? '').trim();
  const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
  v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
  env[m[1] ?? ''] = v;
}
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const DRY_RUN = process.argv.includes('--dry-run');
const SCRAPED_AT = new Date().toISOString();

// ─── Types (mirror diff output) ──────────────────────────────────────────────

interface GrecotelHotel {
  grecotel_slug: string;
  grecotel_url: string;
  name: string;
  tagline: string | null;
  destination: string | null;
  resort_area: string | null;
  normalized_city: string | null;
  stars: number | null;
  collection: string;
  number_of_rooms: number | null;
  number_of_restaurants: number | null;
  has_spa: boolean | null;
  has_pool: boolean | null;
  has_kids_club: boolean | null;
  is_all_inclusive: boolean | null;
  airport_distance: string | null;
  year_round: boolean | null;
  short_description: string | null;
}

interface AlreadyEntry {
  grecotel: GrecotelHotel;
  mch_id: string;
  mch_slug: string;
  mch_name: string;
  mch_city: string | null;
  mch_country_code: string;
  mch_luxury_tier: string | null;
  mch_is_published: boolean;
  reason: string;
}

interface GrecotelAffiliation {
  kind: 'brand';
  source: 'grecotel';
  display_name: string;
  verified: true;
  facet_slug: 'grecotel';
  source_url: string;
  scraped_at: string;
  metadata: {
    collection: string;
    number_of_rooms: number | null;
    number_of_restaurants: number | null;
    has_spa: boolean | null;
    has_pool: boolean | null;
    has_kids_club: boolean | null;
    is_all_inclusive: boolean | null;
    airport_distance: string | null;
    year_round: boolean | null;
    tagline: string | null;
    short_description: string | null;
  };
}

function buildAffiliationEntry(g: GrecotelHotel): GrecotelAffiliation {
  return {
    kind: 'brand',
    source: 'grecotel',
    display_name: 'Grecotel Hotels & Resorts',
    verified: true,
    facet_slug: 'grecotel',
    source_url: g.grecotel_url,
    scraped_at: SCRAPED_AT,
    metadata: {
      collection: g.collection,
      number_of_rooms: g.number_of_rooms,
      number_of_restaurants: g.number_of_restaurants,
      has_spa: g.has_spa,
      has_pool: g.has_pool,
      has_kids_club: g.has_kids_club,
      is_all_inclusive: g.is_all_inclusive,
      airport_distance: g.airport_distance,
      year_round: g.year_round,
      tagline: g.tagline,
      short_description: g.short_description,
    },
  };
}

// ─── Slug helper (consistent with scaffold-relais-chateaux) ──────────────────

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ─── Slug allowlist for SQL/PostgREST safety ─────────────────────────────────
//
// Even though we never emit SQL with user-controlled identifiers (PostgREST
// handles parameterization), we guard the slug shape because it lands as
// the URL of the public route /hotel/<slug>.

function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 80;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const missing: GrecotelHotel[] = JSON.parse(
    readFileSync(resolve(ROOT, 'grecotel-missing.json'), 'utf8'),
  );
  const already: AlreadyEntry[] = JSON.parse(
    readFileSync(resolve(ROOT, 'grecotel-already-in-catalogue.json'), 'utf8'),
  );

  console.log(`[scaffold-grecotel] missing : ${missing.length}`);
  console.log(`[scaffold-grecotel] already : ${already.length}`);

  // ─── Plan inserts ────────────────────────────────────────────────────────

  interface InsertRow {
    slug: string;
    name: string;
    stars: number;
    city: string;
    affiliations: GrecotelAffiliation[];
    grecotel_url: string;
    short_description: string | null;
  }

  const inserts: InsertRow[] = [];
  const unmapped: Array<GrecotelHotel & { reason: string }> = [];
  const seenSlugs = new Set<string>();

  for (const g of missing) {
    if (!g.normalized_city || g.normalized_city.trim().length < 2) {
      unmapped.push({ ...g, reason: 'no city resolved' });
      continue;
    }
    // Prefer the Grecotel URL slug — it's stable, lowercase, hyphen-friendly.
    let slug = g.grecotel_slug || slugify(g.name);
    if (!isValidSlug(slug)) {
      // Fallback to a slugified name.
      slug = slugify(g.name);
      if (!isValidSlug(slug)) {
        unmapped.push({ ...g, reason: `bad slug: ${slug}` });
        continue;
      }
    }
    // City-disambiguated fallback if slug already taken (shouldn't happen
    // since Grecotel slugs are unique within their domain, but the catalogue
    // has 615+ published rows so we guard anyway).
    if (seenSlugs.has(slug)) {
      const altSlug = `${slug}-${slugify(g.normalized_city)}`;
      if (seenSlugs.has(altSlug) || !isValidSlug(altSlug)) {
        unmapped.push({ ...g, reason: `duplicate slug: ${slug} (alt also taken)` });
        continue;
      }
      slug = altSlug;
    }
    seenSlugs.add(slug);

    // Stars fallback: Grecotel's WP markup sometimes omits the explicit
    // "5-star" badge for Boutique / Iconic. Use the collection bucket as a
    // soft signal — Luxe Me Exclusive / Iconic / Boutique → 5★, Family → 4★.
    const collectionDefaultStars: Record<string, number> = {
      'luxe-me-exclusive': 5,
      iconic: 5,
      boutique: 5,
      'luxme-all-inclusive': 5,
      city: 5,
      family: 4,
      unknown: 5,
    };
    const stars = g.stars ?? collectionDefaultStars[g.collection] ?? 5;

    inserts.push({
      slug,
      name: g.name,
      stars,
      city: g.normalized_city,
      affiliations: [buildAffiliationEntry(g)],
      grecotel_url: g.grecotel_url,
      short_description: g.short_description,
    });
  }

  // ─── SQL preview (for audit + the supabase MCP fallback path) ────────────

  const sqlLines: string[] = [
    '-- Scaffold Grecotel hotels (drafts)',
    '-- Generated by scripts/editorial-pilot/src/global-sources/scaffold-grecotel.ts',
    `-- Inserts: ${inserts.length}, Patches: ${already.length}`,
    '',
  ];

  const esc = (s: string): string => s.replace(/'/g, "''");

  for (const i of inserts) {
    const aff = JSON.stringify(i.affiliations).replace(/'/g, "''");
    sqlLines.push(
      `insert into public.hotels
       (slug, name, stars, is_palace, region, city, country_code, country_label_fr, country_label_en,
        luxury_tier, booking_mode, priority, is_published, affiliations)
       values ('${esc(i.slug)}', '${esc(i.name)}', ${i.stars}, false, null, '${esc(i.city)}',
        'GR', 'Grèce', 'Greece',
        'grecotel', 'display_only', 'P2', false, '${aff}'::jsonb)
       on conflict (slug) do nothing;`,
    );
  }

  for (const a of already) {
    const entry = buildAffiliationEntry(a.grecotel);
    const affJson = JSON.stringify(entry).replace(/'/g, "''");
    sqlLines.push(
      `update public.hotels
       set affiliations = case
         when affiliations @> '[{"source":"grecotel"}]'::jsonb then affiliations
         else coalesce(affiliations, '[]'::jsonb) || '${affJson}'::jsonb
       end,
       updated_at = timezone('utc'::text, now())
       where id = '${a.mch_id}';`,
    );
  }

  writeFileSync(resolve(ROOT, 'grecotel-scaffold.sql'), sqlLines.join('\n\n'));
  writeFileSync(
    resolve(ROOT, 'grecotel-scaffold-unmapped.json'),
    JSON.stringify(unmapped, null, 2),
  );

  // Chunked batches (50 KB per Supabase MCP execute_sql call → 25 inserts/batch).
  const batchDir = resolve(ROOT, 'grecotel-scaffold-batches');
  rmSync(batchDir, { recursive: true, force: true });
  mkdirSync(batchDir, { recursive: true });

  const insertSqls = sqlLines.filter((l) => l.startsWith('insert into public.hotels'));
  const updateSqls = sqlLines.filter((l) => l.startsWith('update public.hotels'));
  const INSERT_BATCH = 25;
  let insertBatchN = 0;
  for (let i = 0; i < insertSqls.length; i += INSERT_BATCH) {
    insertBatchN++;
    const batch = insertSqls.slice(i, i + INSERT_BATCH);
    const path = resolve(batchDir, `01-inserts-${String(insertBatchN).padStart(3, '0')}.sql`);
    writeFileSync(
      path,
      `-- batch ${insertBatchN} (${batch.length} inserts)\n` + batch.join('\n\n'),
    );
  }
  if (updateSqls.length > 0) {
    writeFileSync(
      resolve(batchDir, '02-patches.sql'),
      `-- ${updateSqls.length} updates (idempotent affiliations merge)\n` + updateSqls.join('\n\n'),
    );
  }
  console.log(
    `[scaffold-grecotel] wrote ${insertBatchN} insert batches + ${updateSqls.length > 0 ? '1 patches file' : 'no patches'} to ${batchDir}`,
  );

  console.log(`[scaffold-grecotel] inserts planned : ${inserts.length}`);
  console.log(`[scaffold-grecotel] patches planned : ${already.length}`);
  console.log(`[scaffold-grecotel] unmapped        : ${unmapped.length}`);
  if (unmapped.length > 0) {
    const counts: Record<string, number> = {};
    for (const u of unmapped) counts[u.reason] = (counts[u.reason] ?? 0) + 1;
    for (const [r, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`              ${n.toString().padStart(3)} ${r}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[scaffold-grecotel] --dry-run, preview: global-sources/grecotel-scaffold.sql');
    process.exit(0);
  }

  // ─── Real execution via PostgREST ────────────────────────────────────────

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[scaffold-grecotel] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    );
    process.exit(1);
  }

  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const baseHeaders: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // INSERTS — bulk upsert in chunks of 50.
  console.log(`\n[scaffold-grecotel] inserting ${inserts.length} drafts via PostgREST...`);
  let inserted = 0;
  let insertErrors = 0;
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK);
    const body = slice.map((r) => ({
      slug: r.slug,
      name: r.name,
      stars: r.stars,
      is_palace: false,
      region: null,
      city: r.city,
      country_code: 'GR',
      country_label_fr: 'Grèce',
      country_label_en: 'Greece',
      luxury_tier: 'grecotel',
      booking_mode: 'display_only',
      priority: 'P2',
      is_published: false,
      affiliations: r.affiliations,
    }));
    const res = await fetch(`${restBase}/hotels?on_conflict=slug`, {
      method: 'POST',
      headers: {
        ...baseHeaders,
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) {
      try {
        const created = JSON.parse(text) as Array<unknown>;
        inserted += created.length;
        console.log(
          `  chunk ${Math.floor(i / CHUNK) + 1}/${Math.ceil(inserts.length / CHUNK)}: +${created.length}/${slice.length}`,
        );
      } catch {
        inserted += slice.length;
      }
    } else {
      insertErrors += slice.length;
      console.error(
        `  chunk ${Math.floor(i / CHUNK) + 1} FAIL (${res.status}): ${text.slice(0, 400)}`,
      );
    }
  }
  console.log(`[scaffold-grecotel] inserted (new rows)   : ${inserted}`);
  console.log(`[scaffold-grecotel] insert errors         : ${insertErrors}`);

  // PATCHES — read + idempotent merge per row.
  console.log(`\n[scaffold-grecotel] patching ${already.length} existing rows...`);
  let patched = 0;
  let patchErrors = 0;
  for (const a of already) {
    const entry = buildAffiliationEntry(a.grecotel);
    const read = await fetch(`${restBase}/hotels?id=eq.${a.mch_id}&select=affiliations`, {
      headers: baseHeaders,
    });
    if (!read.ok) {
      patchErrors++;
      console.error(`  read fail ${a.mch_slug}: ${read.status}`);
      continue;
    }
    const rows = (await read.json()) as Array<{ affiliations: unknown[] | null }>;
    const existing = (rows[0]?.affiliations ?? []) as Array<{ source?: string }>;
    if (existing.some((e) => e?.source === 'grecotel')) {
      continue;
    }
    const merged = [...existing, entry];
    const upd = await fetch(`${restBase}/hotels?id=eq.${a.mch_id}`, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        affiliations: merged,
        updated_at: new Date().toISOString(),
      }),
    });
    if (upd.ok) {
      patched++;
    } else {
      patchErrors++;
      const t = await upd.text();
      console.error(`  patch fail ${a.mch_slug}: ${upd.status} ${t.slice(0, 200)}`);
    }
  }
  console.log(`[scaffold-grecotel] patched (ext_src)     : ${patched}`);
  console.log(`[scaffold-grecotel] patch errors          : ${patchErrors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
