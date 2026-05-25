/**
 * scaffold-relais-chateaux.ts — write R&C catalogue into public.hotels.
 *
 * Two operations:
 *   1. INSERT missing R&C members (from rc-missing.json) as drafts:
 *      stars=5, is_palace=false, luxury_tier='relais_chateaux',
 *      booking_mode='display_only', priority='P2', is_published=false,
 *      external_sources=[{source:'relais_chateaux', source_url, scraped_at, metadata:{...}}]
 *
 *   2. PATCH existing rows (from rc-already-in-catalogue.json) to record R&C
 *      membership in external_sources WITHOUT touching luxury_tier (their
 *      existing tier is the strongest signal and stays canonical):
 *      external_sources = external_sources || [{source:'relais_chateaux', ...}]
 *      (idempotent — re-runs do NOT duplicate the R&C entry).
 *
 * Both operations gracefully ON CONFLICT for inserts (slug collision falls
 * back to slug-with-city, same pattern as scaffold-international.ts).
 *
 * Usage:
 *   pnpm rc:scaffold:dry   # preview only (SQL emitted to rc-scaffold.sql)
 *   pnpm rc:scaffold       # actually insert + patch
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

interface RcHotel {
  url_slug: string;
  rc_url: string;
  name: string;
  city: string | null;
  country_code: string | null;
  country_fr: string | null;
  country_en: string | null;
  michelin_stars: number | null;
  michelin_green_star: boolean | null;
  number_of_rooms: number | null;
  number_of_meeting_rooms: number | null;
  mice_max_capacity: number | null;
  pet_friendly: boolean | null;
  has_pool: boolean | null;
  has_spa: boolean | null;
  short_tagline_fr: string | null;
}

interface AlreadyEntry {
  rc: RcHotel;
  mch_id: string;
  mch_slug: string;
  mch_name: string;
  mch_city: string;
  mch_country_code: string;
  mch_luxury_tier: string | null;
  mch_is_published: boolean;
  reason: string;
}

interface ExternalSource {
  source: 'relais_chateaux';
  source_url: string;
  scraped_at: string;
  metadata: {
    michelin_stars: number | null;
    michelin_green_star: boolean | null;
    number_of_rooms: number | null;
    number_of_meeting_rooms: number | null;
    mice_max_capacity: number | null;
    pet_friendly: boolean | null;
    has_pool: boolean | null;
    has_spa: boolean | null;
    tagline_fr: string | null;
  };
}

function buildExternalSourceEntry(r: RcHotel): ExternalSource {
  return {
    source: 'relais_chateaux',
    source_url: r.rc_url,
    scraped_at: SCRAPED_AT,
    metadata: {
      michelin_stars: r.michelin_stars,
      michelin_green_star: r.michelin_green_star,
      number_of_rooms: r.number_of_rooms,
      number_of_meeting_rooms: r.number_of_meeting_rooms,
      mice_max_capacity: r.mice_max_capacity,
      pet_friendly: r.pet_friendly,
      has_pool: r.has_pool,
      has_spa: r.has_spa,
      tagline_fr: r.short_tagline_fr,
    },
  };
}

// ─── Slug helper (consistent with scaffold-international) ────────────────────

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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const missing: RcHotel[] = JSON.parse(readFileSync(resolve(ROOT, 'rc-missing.json'), 'utf8'));
  const already: AlreadyEntry[] = JSON.parse(
    readFileSync(resolve(ROOT, 'rc-already-in-catalogue.json'), 'utf8'),
  );

  console.log(`[scaffold-rc] missing : ${missing.length}`);
  console.log(`[scaffold-rc] already : ${already.length}`);

  // ─── Plan inserts ────────────────────────────────────────────────────────

  interface InsertRow {
    slug: string;
    name: string;
    city: string;
    country_code: string;
    country_label_fr: string;
    country_label_en: string;
    external_sources: ExternalSource[];
    rc_url: string;
  }

  const inserts: InsertRow[] = [];
  const unmapped: Array<RcHotel & { reason: string }> = [];
  const seenSlugs = new Set<string>();

  for (const r of missing) {
    if (!r.country_code || !r.country_fr || !r.country_en) {
      unmapped.push({ ...r, reason: 'no country resolved' });
      continue;
    }
    if (!r.city || r.city.trim().length < 2) {
      unmapped.push({ ...r, reason: 'no city' });
      continue;
    }
    // Prefer the R&C URL slug as the MCH slug — it's stable and SEO-clean.
    let slug = r.url_slug || slugify(r.name);
    if (slug.length < 3) {
      unmapped.push({ ...r, reason: `bad slug: ${slug}` });
      continue;
    }
    // City-disambiguated fallback when slug collides.
    if (seenSlugs.has(slug)) {
      const altSlug = `${slug}-${slugify(r.city)}`;
      if (seenSlugs.has(altSlug)) {
        unmapped.push({ ...r, reason: `duplicate slug: ${slug} (alt also taken)` });
        continue;
      }
      slug = altSlug;
    }
    seenSlugs.add(slug);

    inserts.push({
      slug,
      name: r.name,
      city: r.city,
      country_code: r.country_code,
      country_label_fr: r.country_fr,
      country_label_en: r.country_en,
      external_sources: [buildExternalSourceEntry(r)],
      rc_url: r.rc_url,
    });
  }

  // ─── SQL preview ─────────────────────────────────────────────────────────

  const sqlLines: string[] = [
    '-- Scaffold Relais & Châteaux hotels (drafts)',
    '-- Generated by scripts/editorial-pilot/src/global-sources/scaffold-relais-chateaux.ts',
    `-- Inserts: ${inserts.length}, Patches: ${already.length}`,
    '',
  ];

  const esc = (s: string): string => s.replace(/'/g, "''");

  for (const i of inserts) {
    const extSrc = JSON.stringify(i.external_sources).replace(/'/g, "''");
    sqlLines.push(
      `insert into public.hotels
       (slug, name, stars, is_palace, region, city, country_code, country_label_fr, country_label_en,
        luxury_tier, booking_mode, priority, is_published, external_sources)
       values ('${esc(i.slug)}', '${esc(i.name)}', 5, false, null, '${esc(i.city)}',
        '${i.country_code}', '${esc(i.country_label_fr)}', '${esc(i.country_label_en)}',
        'relais_chateaux', 'display_only', 'P2', false, '${extSrc}'::jsonb)
       on conflict (slug) do nothing;`,
    );
  }

  // For patches, use a CASE expression to be idempotent: only append the R&C
  // source if no entry with source='relais_chateaux' exists yet.
  for (const a of already) {
    const entry = buildExternalSourceEntry(a.rc);
    const extSrcJson = JSON.stringify(entry).replace(/'/g, "''");
    sqlLines.push(
      `update public.hotels
       set external_sources = case
         when external_sources @> '[{"source":"relais_chateaux"}]'::jsonb then external_sources
         else coalesce(external_sources, '[]'::jsonb) || '${extSrcJson}'::jsonb
       end,
       updated_at = timezone('utc'::text, now())
       where id = '${a.mch_id}';`,
    );
  }

  writeFileSync(resolve(ROOT, 'rc-scaffold.sql'), sqlLines.join('\n\n'));
  writeFileSync(resolve(ROOT, 'rc-scaffold-unmapped.json'), JSON.stringify(unmapped, null, 2));

  // Emit chunked batches so the SQL can be applied via the Supabase MCP
  // execute_sql tool (which has a per-call size budget around 50 KB once
  // wrapped in JSON). 25 statements/batch keeps each file < 25 KB.
  // Layout:
  //   global-sources/rc-scaffold-batches/01-inserts-001.sql
  //   global-sources/rc-scaffold-batches/02-patches.sql
  const batchDir = resolve(ROOT, 'rc-scaffold-batches');
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
  // Patches are smaller (no jsonb metadata bloat). Single file is fine.
  writeFileSync(
    resolve(batchDir, '02-patches.sql'),
    `-- ${updateSqls.length} updates (idempotent external_sources merge)\n` +
      updateSqls.join('\n\n'),
  );
  console.log(`[scaffold-rc] wrote ${insertBatchN} insert batches + 1 patches file to ${batchDir}`);

  console.log(`[scaffold-rc] inserts planned : ${inserts.length}`);
  console.log(`[scaffold-rc] patches planned : ${already.length}`);
  console.log(`[scaffold-rc] unmapped        : ${unmapped.length}`);
  if (unmapped.length > 0) {
    const counts: Record<string, number> = {};
    for (const u of unmapped) counts[u.reason] = (counts[u.reason] ?? 0) + 1;
    for (const [r, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`              ${n.toString().padStart(3)} ${r}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[scaffold-rc] --dry-run, preview: global-sources/rc-scaffold.sql');
    process.exit(0);
  }

  // ─── Real execution via Supabase PostgREST ───────────────────────────────
  //
  // We avoid the `pg` client because the repo does not commit a pooler URL
  // to `.env.local` (the agent uses the Supabase MCP for ad-hoc SQL). PostgREST
  // gives us idempotent upserts via the `Prefer: resolution=ignore-duplicates`
  // header and arbitrary jsonb updates via PATCH.

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[scaffold-rc] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
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

  // INSERTS — bulk-upsert in chunks of 50. PostgREST happily takes an array.
  console.log(`\n[scaffold-rc] inserting ${inserts.length} drafts via PostgREST...`);
  let inserted = 0;
  let insertErrors = 0;
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK);
    const body = slice.map((r) => ({
      slug: r.slug,
      name: r.name,
      stars: 5,
      is_palace: false,
      region: null,
      city: r.city,
      country_code: r.country_code,
      country_label_fr: r.country_label_fr,
      country_label_en: r.country_label_en,
      luxury_tier: 'relais_chateaux',
      booking_mode: 'display_only',
      priority: 'P2',
      is_published: false,
      external_sources: r.external_sources,
    }));
    // PostgREST upsert: `?on_conflict=slug` + `Prefer: resolution=ignore-duplicates`
    // skips rows whose slug already exists (no UPDATE). Without `on_conflict`,
    // the duplicate raises 23505 and aborts the whole chunk.
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
        // representation header should always return a list; fall through
        inserted += slice.length;
      }
    } else {
      insertErrors += slice.length;
      console.error(
        `  chunk ${Math.floor(i / CHUNK) + 1} FAIL (${res.status}): ${text.slice(0, 400)}`,
      );
    }
  }
  console.log(`[scaffold-rc] inserted (new rows)   : ${inserted}`);
  console.log(`[scaffold-rc] insert errors         : ${insertErrors}`);

  // PATCHES — one PATCH per row (idempotent guard via jsonb @>).
  // PostgREST can't express the "append-unless-contains" CASE expression in
  // a single PATCH, so we filter on the URL `?external_sources=not.cs.[{...}]`
  // pattern: only matching rows are updated, others ignored.
  console.log(`\n[scaffold-rc] patching ${already.length} existing rows...`);
  let patched = 0;
  let patchErrors = 0;
  for (const a of already) {
    const entry = buildExternalSourceEntry(a.rc);
    const guard = encodeURIComponent('[{"source":"relais_chateaux"}]');
    // Compute the merged value client-side: read row, append if absent, write back.
    // Two round-trips per row, but only 53 rows — acceptable.
    const read = await fetch(`${restBase}/hotels?id=eq.${a.mch_id}&select=external_sources`, {
      headers: baseHeaders,
    });
    if (!read.ok) {
      patchErrors++;
      console.error(`  read fail ${a.mch_slug}: ${read.status}`);
      continue;
    }
    const rows = (await read.json()) as Array<{ external_sources: unknown[] | null }>;
    const existing = (rows[0]?.external_sources ?? []) as Array<{ source?: string }>;
    if (existing.some((e) => e?.source === 'relais_chateaux')) {
      // Already has the R&C entry — count as a no-op patch (idempotent).
      continue;
    }
    const merged = [...existing, entry];
    const upd = await fetch(`${restBase}/hotels?id=eq.${a.mch_id}`, {
      method: 'PATCH',
      headers: {
        ...baseHeaders,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        external_sources: merged,
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
    void guard; // silence unused
  }
  console.log(`[scaffold-rc] patched (ext_src)     : ${patched}`);
  console.log(`[scaffold-rc] patch errors          : ${patchErrors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
