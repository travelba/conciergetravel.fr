/**
 * diff-grecotel.ts — match the extracted Grecotel catalogue against
 * public.hotels and split into three buckets:
 *
 *   1. grecotel-already-in-catalogue.json
 *      Existing rows that ARE Grecotel properties (e.g. if a flagship
 *      like Cape Sounio already entered the catalogue via the SLH
 *      pipeline). These will keep their stronger tier and only get a
 *      `grecotel` entry appended to `external_sources` (idempotent).
 *
 *   2. grecotel-missing.json
 *      Grecotel hotels with NO row in public.hotels yet. These will be
 *      scaffolded by scaffold-grecotel.ts as drafts (luxury_tier='grecotel',
 *      booking_mode='display_only', priority='P2', is_published=false).
 *
 *   3. grecotel-ambiguous.json
 *      One Grecotel hotel matches > 1 candidate rows in the catalogue
 *      (typically a name collision across destinations). Requires human
 *      review before scaffolding.
 *
 * Matching strategy (first match wins):
 *   1. slug_key === grecotel slug (e.g. "amirandes" ↔ existing slug)
 *   2. luxury_tier === 'grecotel' AND name_key matches (no rows expected
 *      pre-scaffold, but keeps the diff idempotent on re-runs)
 *   3. (name_key, city_key) tuple match — guarded by country_code = 'GR'
 *   4. name_key only — fallback when city normalization diverges
 *
 * Usage:
 *   pnpm grecotel:diff
 *
 * Skill: content-modeling, llm-output-robustness (deterministic match guards).
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

/**
 * The diff requires a dump of public.hotels (filtered to country_code='GR'
 * for efficiency). The R&C diff uses a generic `mch-hotels.json` dump; we
 * follow the same convention here. Refresh via the Supabase MCP execute_sql:
 *
 *   select id::text, slug, name, city, country_code, luxury_tier,
 *          is_published, external_sources
 *   from public.hotels
 *   where country_code = 'GR';
 *
 * and save the JSON to scripts/editorial-pilot/global-sources/mch-greek-hotels.json.
 */
const MCH_DUMP = resolve(ROOT, 'mch-greek-hotels.json');

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MchHotel {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string;
  luxury_tier: string | null;
  is_published: boolean;
  external_sources: unknown[] | null;
}

// ─── Normalization (mirror diff-relais-chateaux for consistency) ─────────────

function normaliseKey(s: string | null | undefined): string {
  if (!s) return '';
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’`]/g, ' ')
      // Strip generic hospitality words so e.g. "Cape Sounio Grecotel Exclusive
      // Resort" matches "Cape Sounio" if ever the catalogue carries the short form.
      .replace(
        /\b(hotel|hôtel|spa|resort|grecotel|exclusive|boutique|all|inclusive|family|luxe|me|the)\b/g,
        ' ',
      )
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
  );
}

function citySlug(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const grecotel: GrecotelHotel[] = JSON.parse(
    readFileSync(resolve(ROOT, 'grecotel-hotels.json'), 'utf8'),
  );
  console.log(`[load] ${grecotel.length} Grecotel hotels from grecotel-hotels.json`);

  if (!existsSync(MCH_DUMP)) {
    console.error(
      `[diff] missing catalogue dump at ${MCH_DUMP}. Run via Supabase MCP execute_sql ` +
        `(see file header) and save the JSON.`,
    );
    process.exit(1);
  }
  const mch: MchHotel[] = JSON.parse(readFileSync(MCH_DUMP, 'utf8'));
  console.log(`[load] ${mch.length} GR catalogue hotels from mch-greek-hotels.json`);

  const bySlug = new Map<string, MchHotel>();
  const byNameKey = new Map<string, MchHotel[]>();
  const byNameCityKey = new Map<string, MchHotel[]>();
  const grecotelTierNameKeys = new Map<string, MchHotel>();
  for (const m of mch) {
    bySlug.set(m.slug, m);
    const nk = normaliseKey(m.name);
    if (nk) {
      const arr = byNameKey.get(nk) ?? [];
      arr.push(m);
      byNameKey.set(nk, arr);
      const ck = citySlug(m.city);
      const nck = `${nk}|${ck}`;
      const arr2 = byNameCityKey.get(nck) ?? [];
      arr2.push(m);
      byNameCityKey.set(nck, arr2);
    }
    if (m.luxury_tier === 'grecotel' && nk) {
      grecotelTierNameKeys.set(nk, m);
    }
  }

  type MatchReason = 'slug' | 'grecotel_tier_name' | 'name_city' | 'name_only';
  interface AlreadyInCatalogue {
    grecotel: GrecotelHotel;
    mch_id: string;
    mch_slug: string;
    mch_name: string;
    mch_city: string | null;
    mch_country_code: string;
    mch_luxury_tier: string | null;
    mch_is_published: boolean;
    reason: MatchReason;
  }

  const already: AlreadyInCatalogue[] = [];
  const missing: GrecotelHotel[] = [];
  const ambiguous: Array<{ grecotel: GrecotelHotel; candidates: MchHotel[] }> = [];

  for (const g of grecotel) {
    const slugMatch = bySlug.get(g.grecotel_slug);
    if (slugMatch) {
      already.push({
        grecotel: g,
        mch_id: slugMatch.id,
        mch_slug: slugMatch.slug,
        mch_name: slugMatch.name,
        mch_city: slugMatch.city,
        mch_country_code: slugMatch.country_code,
        mch_luxury_tier: slugMatch.luxury_tier,
        mch_is_published: slugMatch.is_published,
        reason: 'slug',
      });
      continue;
    }

    const nk = normaliseKey(g.name);
    const ck = citySlug(g.normalized_city);

    const tierMatch = grecotelTierNameKeys.get(nk);
    if (tierMatch) {
      already.push({
        grecotel: g,
        mch_id: tierMatch.id,
        mch_slug: tierMatch.slug,
        mch_name: tierMatch.name,
        mch_city: tierMatch.city,
        mch_country_code: tierMatch.country_code,
        mch_luxury_tier: tierMatch.luxury_tier,
        mch_is_published: tierMatch.is_published,
        reason: 'grecotel_tier_name',
      });
      continue;
    }

    const ncCandidates = byNameCityKey.get(`${nk}|${ck}`) ?? [];
    if (ncCandidates.length === 1) {
      const c = ncCandidates[0] as MchHotel;
      already.push({
        grecotel: g,
        mch_id: c.id,
        mch_slug: c.slug,
        mch_name: c.name,
        mch_city: c.city,
        mch_country_code: c.country_code,
        mch_luxury_tier: c.luxury_tier,
        mch_is_published: c.is_published,
        reason: 'name_city',
      });
      continue;
    }
    if (ncCandidates.length > 1) {
      ambiguous.push({ grecotel: g, candidates: ncCandidates });
      continue;
    }

    // Name-only fallback — guarded by GR-only dump, so the guard against
    // cross-country false positives is implicit.
    const nCandidates = byNameKey.get(nk) ?? [];
    if (nCandidates.length === 1) {
      const c = nCandidates[0] as MchHotel;
      already.push({
        grecotel: g,
        mch_id: c.id,
        mch_slug: c.slug,
        mch_name: c.name,
        mch_city: c.city,
        mch_country_code: c.country_code,
        mch_luxury_tier: c.luxury_tier,
        mch_is_published: c.is_published,
        reason: 'name_only',
      });
      continue;
    }
    if (nCandidates.length > 1) {
      ambiguous.push({ grecotel: g, candidates: nCandidates });
      continue;
    }

    missing.push(g);
  }

  console.log(`\n[diff] already in catalogue : ${already.length}`);
  const byReason: Record<MatchReason, number> = {
    slug: 0,
    grecotel_tier_name: 0,
    name_city: 0,
    name_only: 0,
  };
  for (const a of already) byReason[a.reason]++;
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`         ${n.toString().padStart(4)} via ${r}`);
  }
  console.log(`[diff] ambiguous (review)   : ${ambiguous.length}`);
  console.log(`[diff] missing (to scaffold): ${missing.length}`);

  if (missing.length > 0) {
    const byCity = new Map<string, number>();
    for (const m of missing) {
      const k = m.normalized_city ?? '??';
      byCity.set(k, (byCity.get(k) ?? 0) + 1);
    }
    console.log(`\nMissing Grecotel by destination:`);
    for (const [c, n] of Array.from(byCity.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c.padEnd(20)} ${n}`);
    }
  }

  writeFileSync(
    resolve(ROOT, 'grecotel-already-in-catalogue.json'),
    JSON.stringify(already, null, 2),
  );
  writeFileSync(resolve(ROOT, 'grecotel-missing.json'), JSON.stringify(missing, null, 2));
  writeFileSync(resolve(ROOT, 'grecotel-ambiguous.json'), JSON.stringify(ambiguous, null, 2));
  console.log(`\n[done] wrote 3 diff JSON files`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
