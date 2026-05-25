/**
 * diff-relais-chateaux.ts — match the R&C scraped catalogue against
 * public.hotels and split into three buckets:
 *
 *   1. rc-already-in-catalogue.json
 *      Existing rows that ARE R&C members. May currently carry a different
 *      `luxury_tier` (e.g. Le Bristol Paris = `palace_atout_france`) — those
 *      should keep their priority tier but get an `external_sources` entry
 *      added so the R&C membership is recorded as a multi-source signal.
 *
 *   2. rc-missing.json
 *      R&C members that have NO row in public.hotels yet. These will be
 *      scaffolded by scaffold-relais-chateaux.ts as drafts (P2, display_only).
 *
 *   3. rc-ambiguous.json
 *      Cases where one R&C URL matches > 1 catalogue rows by name+city alone
 *      (e.g. two cities named "Saint-James" hosting different hotels). These
 *      require a human review before scaffolding.
 *
 * Matching strategy (in order of precedence — first match wins):
 *   1. slug_key === url_slug (e.g. R&C "borgo-san-felice" ↔ existing slug)
 *   2. luxury_tier === 'relais_chateaux' AND name_key matches (the 17 already
 *      tagged via the brand-tier signal from the previous Yonder/T+L pipeline)
 *   3. (name_key, city_key) tuple match — strongest fuzzy match
 *   4. name_key match alone — fallback when city normalisation diverges
 *      (e.g. "Saint-Tropez" vs "St-Tropez" vs "Saint Tropez")
 *
 * Usage:
 *   pnpm rc:diff               # produces 3 JSON files
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

/**
 * The repo has no `SUPABASE_DB_POOLER_URL` / `DATABASE_URL` in .env.local
 * (we use the Supabase MCP for direct queries). The diff script therefore
 * reads a pre-dumped `mch-hotels.json` produced by an agent execute_sql call:
 *
 *   select id::text, slug, name, city, country_code, luxury_tier, is_published
 *   from public.hotels;
 *
 * Refresh the dump by re-running that query and saving the JSON into
 * scripts/editorial-pilot/global-sources/mch-hotels.json.
 */
const MCH_DUMP = resolve(ROOT, 'mch-hotels.json');

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface MchHotel {
  id: string;
  slug: string;
  name: string;
  city: string;
  country_code: string;
  luxury_tier: string | null;
  is_published: boolean;
}

// ─── Normalisation ───────────────────────────────────────────────────────────

function normaliseKey(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, ' ')
    .replace(/\bhotel\b|\bspa\b|\bresort\b|\band\b|\bdu\b|\bde\b|\bla\b|\ble\b|\bles\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function citySlug(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bsaint\b/g, 'st')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const rc: RcHotel[] = JSON.parse(readFileSync(resolve(ROOT, 'rc-hotels.json'), 'utf8'));
  console.log(`[load] ${rc.length} R&C hotels from rc-hotels.json`);

  if (!existsSync(MCH_DUMP)) {
    console.error(
      `[diff] missing catalogue dump at ${MCH_DUMP}. Re-run the execute_sql dump (see file header).`,
    );
    process.exit(1);
  }
  const mch: MchHotel[] = JSON.parse(readFileSync(MCH_DUMP, 'utf8'));
  console.log(`[load] ${mch.length} catalogue hotels from mch-hotels.json`);

  // Build indices for fast lookup.
  const bySlug = new Map<string, MchHotel>();
  const byNameKey = new Map<string, MchHotel[]>();
  const byNameCityKey = new Map<string, MchHotel[]>();
  const rcTierNameKeys = new Map<string, MchHotel>();
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
    if (m.luxury_tier === 'relais_chateaux' && nk) {
      rcTierNameKeys.set(nk, m);
    }
  }

  type MatchReason = 'slug' | 'rc_tier_name' | 'name_city' | 'name_only';
  interface AlreadyInCatalogue {
    rc: RcHotel;
    mch_id: string;
    mch_slug: string;
    mch_name: string;
    mch_city: string;
    mch_country_code: string;
    mch_luxury_tier: string | null;
    mch_is_published: boolean;
    reason: MatchReason;
  }

  const already: AlreadyInCatalogue[] = [];
  const missing: RcHotel[] = [];
  const ambiguous: Array<{ rc: RcHotel; candidates: MchHotel[] }> = [];

  for (const r of rc) {
    // Tier 1: exact slug match (e.g. "borgo-san-felice" exists in our catalogue under the same slug)
    const bySlugMatch = bySlug.get(r.url_slug);
    if (bySlugMatch) {
      already.push({
        rc: r,
        mch_id: bySlugMatch.id,
        mch_slug: bySlugMatch.slug,
        mch_name: bySlugMatch.name,
        mch_city: bySlugMatch.city,
        mch_country_code: bySlugMatch.country_code,
        mch_luxury_tier: bySlugMatch.luxury_tier,
        mch_is_published: bySlugMatch.is_published,
        reason: 'slug',
      });
      continue;
    }

    const nk = normaliseKey(r.name);
    const ck = citySlug(r.city);

    // Tier 2: this hotel was already brand-tagged via the previous pipeline
    const tierMatch = rcTierNameKeys.get(nk);
    if (tierMatch) {
      already.push({
        rc: r,
        mch_id: tierMatch.id,
        mch_slug: tierMatch.slug,
        mch_name: tierMatch.name,
        mch_city: tierMatch.city,
        mch_country_code: tierMatch.country_code,
        mch_luxury_tier: tierMatch.luxury_tier,
        mch_is_published: tierMatch.is_published,
        reason: 'rc_tier_name',
      });
      continue;
    }

    // Tier 3: (name, city) tuple match
    const ncCandidates = byNameCityKey.get(`${nk}|${ck}`) ?? [];
    if (ncCandidates.length === 1) {
      const c = ncCandidates[0] as MchHotel;
      already.push({
        rc: r,
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
      ambiguous.push({ rc: r, candidates: ncCandidates });
      continue;
    }

    // Tier 4: name-only match (only when the city normalisation diverges).
    // Guard with country_code to avoid matching "Saint-James Paris" with "Saint James Bouliac".
    const nCandidates = (byNameKey.get(nk) ?? []).filter(
      (c) => !r.country_code || c.country_code === r.country_code,
    );
    if (nCandidates.length === 1) {
      const c = nCandidates[0] as MchHotel;
      already.push({
        rc: r,
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
      ambiguous.push({ rc: r, candidates: nCandidates });
      continue;
    }

    missing.push(r);
  }

  console.log(`\n[diff] already in catalogue : ${already.length}`);
  const byReason: Record<MatchReason, number> = {
    slug: 0,
    rc_tier_name: 0,
    name_city: 0,
    name_only: 0,
  };
  for (const a of already) byReason[a.reason]++;
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`         ${n.toString().padStart(4)} via ${r}`);
  }
  console.log(`[diff] ambiguous (review)   : ${ambiguous.length}`);
  console.log(`[diff] missing (to scaffold): ${missing.length}`);

  // Country histogram of missing.
  const byCc = new Map<string, number>();
  for (const m of missing) {
    const k = m.country_code ?? '??';
    byCc.set(k, (byCc.get(k) ?? 0) + 1);
  }
  const top = Array.from(byCc.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`\nMissing R&C by country (top 20):`);
  for (const [cc, n] of top.slice(0, 20)) {
    console.log(`  ${cc.padEnd(3)} ${n}`);
  }

  writeFileSync(resolve(ROOT, 'rc-already-in-catalogue.json'), JSON.stringify(already, null, 2));
  writeFileSync(resolve(ROOT, 'rc-missing.json'), JSON.stringify(missing, null, 2));
  writeFileSync(resolve(ROOT, 'rc-ambiguous.json'), JSON.stringify(ambiguous, null, 2));
  console.log(`\n[done] wrote 3 diff JSON files`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
