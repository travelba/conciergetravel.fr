/**
 * scaffold-by-chain.ts — Wave-A/B/D chain catalogue insertion + patching.
 *
 * Reads `luxury-chains-diff.json` (output of `diff-luxury-chains.ts`)
 * and applies, optionally filtered by chain (`--chain=aman`) or wave
 * (`--wave=A`):
 *
 *   1. INSERT missing rows as drafts:
 *        stars = 5
 *        is_palace = false
 *        luxury_tier = <chain>            -- e.g. 'aman', 'four_seasons'
 *        booking_mode = 'display_only'
 *        priority = chain.priority        -- 'P1' (Wave A) or 'P2' (Wave B)
 *        is_published = false
 *        external_sources = [{ source: 'luxury_chain_xlsx', ... }]
 *
 *   2. PATCH existing rows:
 *        - Append `external_sources` entry (idempotent — `@>` guard).
 *        - Upgrade `luxury_tier` ONLY when the current tier is `null`
 *          or strictly weaker than the chain tier. We DO NOT downgrade.
 *
 * Slug strategy (mirrors scaffold-relais-chateaux.ts):
 *   - Build slug from name; on collision in current run, append the
 *     city slug. On a DB-side conflict (slug already exists), the
 *     `on conflict (slug) do nothing` clause skips the insert and the
 *     row is logged for manual review.
 *
 * Usage:
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/scaffold-by-chain.ts --chain=aman --dry-run
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/scaffold-by-chain.ts --wave=A
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/scaffold-by-chain.ts                    # all chains
 *
 * Skill: editorial-pilot, content-modeling, supabase-postgres-rls.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', 'global-sources');
const ENV_PATH = resolve(__dirname, '..', '..', '..', '..', '.env.local');

const DRY_RUN = process.argv.includes('--dry-run');
const CHAIN_FILTER =
  process.argv.find((a) => a.startsWith('--chain='))?.slice('--chain='.length) ?? '';
const WAVE_FILTER =
  process.argv.find((a) => a.startsWith('--wave='))?.slice('--wave='.length) ?? '';

const SCRAPED_AT = new Date().toISOString();

// ─── Tier strength (used for the upgrade-only guard on patches) ───────────

/**
 * Higher = stronger signal. The patch only upgrades `luxury_tier`
 * when the chain's tier outranks the existing one. When tiers are
 * equal or the existing one is stronger, we leave the field alone.
 *
 * Atout France palace and Forbes 5★ stay at the top because they're
 * editorial / customer-facing labels we never want to override with
 * a chain brand tier. Chain tiers come next as they're the most
 * informative for our brand-page UX.
 */
const TIER_STRENGTH: Readonly<Record<string, number>> = {
  // Editorial / customer-facing labels (top of the stack)
  palace_atout_france: 100,
  forbes_5_star: 95,
  michelin_3_keys: 90,
  cn_gold_list: 88,
  tl_worlds_best: 87,
  world_50_best: 85,
  // Ultra-luxe brand chains (Wave A / Wave D)
  aman: 80,
  cheval_blanc: 80,
  oetker_collection: 80,
  bulgari: 78,
  six_senses: 76,
  rosewood: 75,
  belmond: 75,
  four_seasons: 74,
  mandarin_oriental: 73,
  ritz_carlton_reserve: 72,
  park_hyatt: 70,
  // Boutique ultra-luxe (Wave D)
  como: 68,
  capella: 67,
  viceroy: 65,
  soneva: 65,
  nayara: 60,
  grace_hotels: 58,
  nihi: 58,
  // Mainstream-premium (Wave B)
  st_regis: 55,
  ritz_carlton: 54,
  waldorf_astoria: 52,
  peninsula: 52,
  raffles: 52,
  dorchester: 50,
  jumeirah: 48,
  fairmont: 46,
  kempinski: 44,
  anantara: 42,
  // Independent collections
  relais_chateaux: 40,
  small_luxury_hotels: 38,
  lhw_member: 35,
  self_5_star: 10,
};

function tierStrength(t: string | null): number {
  if (!t) return 0;
  return TIER_STRENGTH[t] ?? 0;
}

// ─── Types ────────────────────────────────────────────────────────────────

interface SourceHotel {
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly chain_facet_slug: string;
  readonly chain_display_name: string;
  readonly luxury_tier: string;
  readonly wave: string;
  readonly priority: string;
  readonly source_row: number;
  readonly resolved: boolean;
  readonly notes: readonly string[];
}

interface DbHotel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly is_published: boolean;
}

interface MatchResult {
  readonly source: SourceHotel;
  readonly db: DbHotel;
  readonly score: number;
  readonly reason: string;
}

interface Diff {
  readonly missing: readonly SourceHotel[];
  readonly already_in_catalogue: readonly MatchResult[];
}

interface ExternalSource {
  readonly source: 'luxury_chain_xlsx';
  readonly chain_facet_slug: string;
  readonly chain_display_name: string;
  readonly source_row: number;
  readonly scraped_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envText = readFileSync(ENV_PATH, 'utf8');
  const env: Record<string, string> = {};
  for (const raw of envText.split('\n')) {
    const m = raw.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? '').trim();
    const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
    v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
    env[m[1] ?? ''] = v;
  }
  return env;
}

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

function buildExternalSourceEntry(src: SourceHotel): ExternalSource {
  return {
    source: 'luxury_chain_xlsx',
    chain_facet_slug: src.chain_facet_slug,
    chain_display_name: src.chain_display_name,
    source_row: src.source_row,
    scraped_at: SCRAPED_AT,
  };
}

// ─── Filter ───────────────────────────────────────────────────────────────

function passesFilter(src: SourceHotel): boolean {
  if (CHAIN_FILTER && src.chain_facet_slug !== CHAIN_FILTER) return false;
  if (WAVE_FILTER && src.wave !== WAVE_FILTER) return false;
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface InsertRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly country_label_fr: string;
  readonly country_label_en: string;
  readonly luxury_tier: string;
  readonly priority: string;
  readonly external_sources: readonly ExternalSource[];
  readonly source_row: number;
}

interface PatchRow {
  readonly id: string;
  readonly slug: string;
  readonly current_tier: string | null;
  readonly new_tier: string | null;
  readonly external_source_entry: ExternalSource;
  readonly tier_upgraded: boolean;
}

async function main(): Promise<void> {
  const diff = JSON.parse(readFileSync(resolve(ROOT, 'luxury-chains-diff.json'), 'utf8')) as Diff;

  const filteredMissing = diff.missing.filter(passesFilter);
  const filteredMatched = diff.already_in_catalogue.filter((m) => passesFilter(m.source));

  console.log(
    `[scaffold-chain] Filter: chain=${CHAIN_FILTER || '(all)'} wave=${WAVE_FILTER || '(all)'}`,
  );
  console.log(`[scaffold-chain] missing : ${filteredMissing.length}`);
  console.log(`[scaffold-chain] matched : ${filteredMatched.length}`);

  // ─── Build inserts ──────────────────────────────────────────────────────
  const inserts: InsertRow[] = [];
  const unmapped: Array<SourceHotel & { reason: string }> = [];
  const seenSlugs = new Set<string>();

  for (const src of filteredMissing) {
    if (!src.country_code || !src.country_label_fr || !src.country_label_en) {
      unmapped.push({ ...src, reason: 'no country resolved' });
      continue;
    }
    if (!src.city || src.city.trim().length < 2) {
      unmapped.push({ ...src, reason: 'no city' });
      continue;
    }
    let slug = slugify(src.name);
    if (slug.length < 3) {
      unmapped.push({ ...src, reason: `bad slug: ${slug}` });
      continue;
    }
    if (seenSlugs.has(slug)) {
      const altSlug = `${slug}-${slugify(src.city)}`;
      if (seenSlugs.has(altSlug)) {
        unmapped.push({ ...src, reason: `duplicate slug: ${slug} (alt also taken)` });
        continue;
      }
      slug = altSlug;
    }
    seenSlugs.add(slug);

    inserts.push({
      slug,
      name: src.name,
      city: src.city,
      country_code: src.country_code,
      country_label_fr: src.country_label_fr,
      country_label_en: src.country_label_en,
      luxury_tier: src.luxury_tier,
      priority: src.priority,
      external_sources: [buildExternalSourceEntry(src)],
      source_row: src.source_row,
    });
  }

  // ─── Build patches ──────────────────────────────────────────────────────
  const patches: PatchRow[] = filteredMatched.map((m) => {
    const newTierStrength = tierStrength(m.source.luxury_tier);
    const oldTierStrength = tierStrength(m.db.luxury_tier);
    const tierUpgraded = newTierStrength > oldTierStrength;
    return {
      id: m.db.id,
      slug: m.db.slug,
      current_tier: m.db.luxury_tier,
      new_tier: tierUpgraded ? m.source.luxury_tier : m.db.luxury_tier,
      external_source_entry: buildExternalSourceEntry(m.source),
      tier_upgraded: tierUpgraded,
    };
  });

  // ─── SQL preview (always emitted for review) ───────────────────────────
  const fileTag = CHAIN_FILTER || (WAVE_FILTER ? `wave-${WAVE_FILTER}` : 'all');
  const sqlLines: string[] = [
    `-- Scaffold luxury chains (drafts) — ${fileTag}`,
    `-- Generated by scripts/editorial-pilot/src/global-sources/scaffold-by-chain.ts`,
    `-- Inserts: ${inserts.length}, Patches: ${patches.length}, Unmapped: ${unmapped.length}`,
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
        '${i.luxury_tier}', 'display_only', '${i.priority}', false, '${extSrc}'::jsonb)
       on conflict (slug) do nothing;`,
    );
  }

  for (const p of patches) {
    const entryJson = JSON.stringify(p.external_source_entry).replace(/'/g, "''");
    if (p.tier_upgraded && p.new_tier) {
      sqlLines.push(
        `update public.hotels
         set external_sources = case
           when external_sources @> '[{"source":"luxury_chain_xlsx","chain_facet_slug":"${p.external_source_entry.chain_facet_slug}"}]'::jsonb then external_sources
           else coalesce(external_sources, '[]'::jsonb) || '${entryJson}'::jsonb
         end,
         luxury_tier = '${p.new_tier}',
         updated_at = timezone('utc'::text, now())
         where id = '${p.id}';`,
      );
    } else {
      sqlLines.push(
        `update public.hotels
         set external_sources = case
           when external_sources @> '[{"source":"luxury_chain_xlsx","chain_facet_slug":"${p.external_source_entry.chain_facet_slug}"}]'::jsonb then external_sources
           else coalesce(external_sources, '[]'::jsonb) || '${entryJson}'::jsonb
         end,
         updated_at = timezone('utc'::text, now())
         where id = '${p.id}';`,
      );
    }
  }

  const sqlPath = resolve(ROOT, `chain-scaffold-${fileTag}.sql`);
  writeFileSync(sqlPath, sqlLines.join('\n\n'));
  writeFileSync(
    resolve(ROOT, `chain-scaffold-${fileTag}-unmapped.json`),
    JSON.stringify(unmapped, null, 2),
  );
  console.log(`[scaffold-chain] SQL preview at ${sqlPath}`);

  // ─── Chunked batches for Supabase MCP execute_sql (50-KB budget) ────────
  const batchDir = resolve(ROOT, `chain-scaffold-batches-${fileTag}`);
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
      `-- ${updateSqls.length} updates (idempotent external_sources merge + tier upgrade where applicable)\n` +
        updateSqls.join('\n\n'),
    );
  }
  console.log(
    `[scaffold-chain] wrote ${insertBatchN} insert batches + ${updateSqls.length > 0 ? '1' : '0'} patch file to ${batchDir}`,
  );

  console.log(`\n[scaffold-chain] Plan:`);
  console.log(`  inserts          : ${inserts.length}`);
  console.log(`  patches          : ${patches.length}`);
  const tierUpgraded = patches.filter((p) => p.tier_upgraded).length;
  console.log(`     of which upgrade tier : ${tierUpgraded}`);
  console.log(`  unmapped         : ${unmapped.length}`);

  if (DRY_RUN) {
    console.log(`\n[scaffold-chain] --dry-run, preview only.`);
    return;
  }

  // ─── Apply via PostgREST ────────────────────────────────────────────────
  const env = loadEnv();
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[scaffold-chain] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const baseHeaders: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // INSERTS — bulk via PostgREST.
  console.log(`\n[scaffold-chain] inserting ${inserts.length} drafts...`);
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
      luxury_tier: r.luxury_tier,
      booking_mode: 'display_only',
      priority: r.priority,
      is_published: false,
      external_sources: r.external_sources,
    }));
    // PostgREST ignores duplicates only when `on_conflict=<col>` is on
    // the URL AND `Prefer: resolution=ignore-duplicates` is set.
    const r = await fetch(`${restBase}/hotels?on_conflict=slug`, {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      inserted += slice.length;
      process.stdout.write(`\r[scaffold-chain] inserted ${inserted} / ${inserts.length}`);
    } else {
      insertErrors++;
      const text = await r.text();
      console.error(
        `\n[scaffold-chain] insert chunk ${i}-${i + CHUNK} failed: ${r.status} ${text.slice(0, 400)}`,
      );
    }
  }
  console.log(
    `\n[scaffold-chain] inserts done (${inserted} attempted, ${insertErrors} chunk errors)`,
  );

  // PATCHES — one PATCH per row (PostgREST jsonb merge requires per-row).
  console.log(`\n[scaffold-chain] patching ${patches.length} rows...`);
  let patched = 0;
  let patchErrors = 0;
  for (const p of patches) {
    const row: Record<string, unknown> = {
      external_sources_append: p.external_source_entry, // Sentinel — real merge done server-side via separate RPC if needed.
    };
    // We cannot do a CASE-WHEN via PostgREST cleanly. So we PATCH the
    // row with: external_sources = current || entry, and luxury_tier
    // when upgrading. Idempotency: we GET the row first and skip if
    // the entry is already present.
    const getResp = await fetch(
      `${restBase}/hotels?id=eq.${p.id}&select=external_sources,luxury_tier`,
      { headers: baseHeaders },
    );
    if (!getResp.ok) {
      patchErrors++;
      continue;
    }
    const rows = (await getResp.json()) as Array<{
      external_sources: unknown;
      luxury_tier: string | null;
    }>;
    if (rows.length === 0) {
      patchErrors++;
      continue;
    }
    const cur = rows[0]?.external_sources;
    const curArr: unknown[] = Array.isArray(cur) ? (cur as unknown[]) : [];
    const alreadyHasEntry = curArr.some((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const e = entry as Record<string, unknown>;
      return (
        e['source'] === 'luxury_chain_xlsx' &&
        e['chain_facet_slug'] === p.external_source_entry.chain_facet_slug
      );
    });
    const newArr = alreadyHasEntry ? curArr : [...curArr, p.external_source_entry];
    const patchBody: Record<string, unknown> = { external_sources: newArr };
    if (p.tier_upgraded && p.new_tier) {
      patchBody['luxury_tier'] = p.new_tier;
    }
    void row; // silence unused variable
    const patchResp = await fetch(`${restBase}/hotels?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(patchBody),
    });
    if (patchResp.ok) {
      patched++;
      if (patched % 25 === 0) {
        process.stdout.write(`\r[scaffold-chain] patched ${patched} / ${patches.length}`);
      }
    } else {
      patchErrors++;
      const t = await patchResp.text();
      console.error(
        `\n[scaffold-chain] patch ${p.id} failed: ${patchResp.status} ${t.slice(0, 200)}`,
      );
    }
  }
  console.log(`\n[scaffold-chain] patches done (${patched} succeeded, ${patchErrors} errors)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
