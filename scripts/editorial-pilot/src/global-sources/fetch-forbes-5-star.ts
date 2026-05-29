/**
 * fetch-forbes-5-star.ts — patch `hotels.affiliations[]` with the
 * Forbes Travel Guide Five-Star award on every matching row.
 *
 * Source
 * ------
 * Forbes Travel Guide official Star Award winners list
 * (https://www.forbestravelguide.com/award-winners). The official page is
 * a client-side React SPA that does not yield HTML to scrapers, so we use
 * the Pearl mirror (https://joinpearl.co/lists/2026-forbes-5-star) as
 * structured input. The Pearl list is parsed by `parse-forbes-5-star.ts`
 * into `global-sources/forbes-5-star-2026.json`. The emitted affiliation
 * always cites the **official Forbes** display_name and source_url.
 *
 * Method
 * ------
 * 1. Read `forbes-5-star-2026.json` (335 hotels in the current snapshot).
 * 2. Resolve the country label to an ISO 3166-1 alpha-2 code via
 *    `country-codes.ts` (extended 2026-05-29 with 51 Forbes countries).
 * 3. For each hotel, build 1–2 ILIKE patterns from the name (full +
 *    pre-comma segment, both accent-normalised by replacing every non
 *    ASCII alpha with `%`).
 * 4. Query Supabase with both name + country_code filter. Rank by city
 *    overlap and published status; pick the best hit.
 * 5. Patch `affiliations[]` with the Forbes label entry — idempotent
 *    (skip if `source === 'forbes_5_star'` already present).
 * 6. Emit `forbes-5-star-matched.json` and `forbes-5-star-missing.json`
 *    audit artefacts.
 *
 * Schema rationale (HotelAffiliation):
 *   kind         : 'label'   — Forbes is a third-party certification, not
 *                              a hotel brand and not a curated ranking
 *                              chosen by us. ADR-0023 §4.
 *   source       : 'forbes_5_star'
 *   display_name : 'Forbes Travel Guide Five-Star'
 *   facet_slug   : 'forbes-5-star'   (used in /label/<slug>/ once shipped)
 *   verified     : true
 *   since_year   : not extractable from the Pearl mirror — left undefined
 *                  (Forbes 5-Star renewal is annual; the year is recorded
 *                  in metadata.year for the 2026 cycle).
 *   metadata     : { year: 2026, via: 'pearl-mirror' }
 *
 * Forward-compat: re-run yearly with the latest Pearl dump. The script
 * is idempotent — re-running does NOT duplicate the entry.
 *
 * Usage:
 *   pnpm forbes:5-star:dry      # plan only (writes report JSON)
 *   pnpm forbes:5-star          # actually patch via PostgREST
 *
 * Skill: api-integration, content-modeling, supabase-postgres-rls.
 * ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
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
const FORBES_YEAR = 2026;

import { countryCodeFromLabel } from '../itineraries/country-codes';

// ─── Inputs ──────────────────────────────────────────────────────────────────

interface ForbesHotel {
  name: string;
  city: string;
  country: string;
  type: 'Hotel';
}

function loadForbesHotels(): ForbesHotel[] {
  const path = resolve(ROOT, `forbes-5-star-${FORBES_YEAR}.json`);
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(text) as ForbesHotel[];
  if (!Array.isArray(parsed)) throw new Error('forbes-5-star JSON must be an array');
  return parsed;
}

// ─── Pattern generation ──────────────────────────────────────────────────────
//
// Strategy: build 2–4 ILIKE patterns per hotel, each generous enough to
// tolerate accent variants since ILIKE does NOT unaccent. The country_code
// filter compensates for any over-matching.
//
// Rules:
//   - Lowercase the input.
//   - Replace each ASCII vowel (a/e/i/o/u) with `_` so that variants
//     `à á ä â ã / è é ê ë / ì í î ï / ò ó ô ö õ / ù ú û ü` all match
//     ("Hotel" → "h_t_l" matches "Hôtel"). `_` matches exactly one char.
//   - Replace each ASCII `c` and `n` with `_` (cedilla, tilde — common in
//     "Curaçao", "España", "Hôtel Liguria").
//   - Replace every remaining non `[a-z0-9_\s]` char with `%`. Collapse.
//
// Patterns generated:
//   - A) full normalised name           — strict but accent-tolerant
//   - B) pre-comma segment              — for "Hotel X, City" forms
//   - C) discriminant keywords joined   — top 2-3 tokens > 3 chars,
//                                         filtered against an editorial
//                                         stop-word list ("hotel", "the",
//                                         "le", "resort", etc.). Catches
//                                         "Hotel Plaza Athénée" vs the
//                                         DB row "Plaza Athénée Paris".

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'hotel',
  'hôtel',
  'resort',
  'spa',
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'et',
  'and',
  'at',
  'in',
  'on',
  'of',
  'by',
  'for',
  'collection',
  'hotels',
  'resorts',
  'palace',
  'grand',
  'royal',
  'club',
]);

function normaliseToIlikePattern(input: string): string {
  const lowered = input.toLowerCase();
  const widened = Array.from(lowered)
    .map((c) => {
      // Vowels + c + n → `_` (tolerates accents, cedilla, tilde).
      if ('aeioucn'.includes(c)) return '_';
      if (/[a-z0-9\s]/.test(c)) return c;
      return '%';
    })
    .join('');
  const collapsed = widened.replace(/%+/g, '%').replace(/\s+/g, ' ').trim();
  return `%${collapsed}%`;
}

function buildKeywordPattern(name: string): string | null {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
  if (tokens.length === 0) return null;
  const top = tokens.slice(0, 3);
  const widened = top
    .map((t) =>
      Array.from(t)
        .map((c) => ('aeioucn'.includes(c) ? '_' : c))
        .join(''),
    )
    .join('%');
  return `%${widened}%`;
}

function buildPatterns(name: string): string[] {
  const patterns = new Set<string>();
  patterns.add(normaliseToIlikePattern(name));
  const beforeComma = name.split(',')[0]?.trim() ?? '';
  if (beforeComma.length > 0 && beforeComma !== name) {
    patterns.add(normaliseToIlikePattern(beforeComma));
  }
  const kw = buildKeywordPattern(name);
  if (kw !== null) patterns.add(kw);
  const kwBefore = buildKeywordPattern(beforeComma);
  if (kwBefore !== null) patterns.add(kwBefore);
  return Array.from(patterns);
}

// ─── PostgREST matching ──────────────────────────────────────────────────────

interface HotelRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  luxury_tier: string | null;
  is_published: boolean;
  affiliations: unknown[] | null;
}

async function fetchHotelByPatterns(
  restBase: string,
  baseHeaders: Record<string, string>,
  patterns: readonly string[],
  countryCode: string,
  expectedCity: string,
): Promise<HotelRow | null> {
  for (const pattern of patterns) {
    const url = new URL(`${restBase}/hotels`);
    url.searchParams.set('name', `ilike.${pattern}`);
    url.searchParams.set('country_code', `eq.${countryCode}`);
    url.searchParams.set(
      'select',
      'id,slug,name,city,country_code,luxury_tier,is_published,affiliations',
    );
    url.searchParams.set('limit', '10');
    const res = await fetch(url.toString(), { headers: baseHeaders });
    if (!res.ok) continue;
    const rows = (await res.json()) as HotelRow[];
    if (rows.length === 0) continue;
    // Rank: city overlap first, then published status.
    const ranked = rows.slice().sort((a, b) => {
      const aCity = (a.city ?? '').toLowerCase();
      const bCity = (b.city ?? '').toLowerCase();
      const expectedLower = expectedCity.toLowerCase();
      const aCityHit = aCity.includes(expectedLower) || expectedLower.includes(aCity) ? 0 : 1;
      const bCityHit = bCity.includes(expectedLower) || expectedLower.includes(bCity) ? 0 : 1;
      if (aCityHit !== bCityHit) return aCityHit - bCityHit;
      const aPub = a.is_published ? 0 : 1;
      const bPub = b.is_published ? 0 : 1;
      return aPub - bPub;
    });
    const first = ranked[0];
    if (first !== undefined) return first;
  }
  return null;
}

// ─── Affiliation entry — mirrors HotelAffiliationSchema (packages/db) ───────

interface ForbesAffiliation {
  kind: 'label';
  source: 'forbes_5_star';
  display_name: string;
  verified: true;
  facet_slug: 'forbes-5-star';
  source_url: string;
  scraped_at: string;
  metadata: {
    year: number;
    via: 'pearl-mirror';
    pearl_city: string;
  };
}

function buildForbesAffiliation(hotel: ForbesHotel): ForbesAffiliation {
  return {
    kind: 'label',
    source: 'forbes_5_star',
    display_name: 'Forbes Travel Guide Five-Star',
    verified: true,
    facet_slug: 'forbes-5-star',
    source_url: 'https://www.forbestravelguide.com/award-winners',
    scraped_at: SCRAPED_AT,
    metadata: {
      year: FORBES_YEAR,
      via: 'pearl-mirror',
      pearl_city: hotel.city,
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[forbes-5-star] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
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

  const hotels = loadForbesHotels();
  console.log(`[forbes-5-star] ${hotels.length} Forbes hotels in seed list`);
  console.log(`[forbes-5-star] dry-run: ${DRY_RUN ? 'YES' : 'NO'}`);

  interface MatchedEntry {
    forbes: ForbesHotel;
    hotel: HotelRow;
    action: 'patch' | 'skip_already_tagged';
  }
  const matched: MatchedEntry[] = [];
  const missing: Array<{ forbes: ForbesHotel; reason: string }> = [];

  // ─── Resolve each Forbes entry against the catalogue ────────────────────
  let i = 0;
  for (const h of hotels) {
    i++;
    if (i % 50 === 0) console.log(`  ... ${i} / ${hotels.length}`);

    let countryCode: string;
    try {
      countryCode = countryCodeFromLabel(h.country);
    } catch (e) {
      missing.push({ forbes: h, reason: `unknown country: ${h.country}` });
      continue;
    }

    const patterns = buildPatterns(h.name);
    const hit = await fetchHotelByPatterns(restBase, baseHeaders, patterns, countryCode, h.city);
    if (hit === null) {
      missing.push({
        forbes: h,
        reason: `no row matched in country ${countryCode} for patterns ${patterns.join(' | ')}`,
      });
      continue;
    }
    const existing = (hit.affiliations ?? []) as Array<{ source?: string }>;
    const alreadyTagged = existing.some((e) => e?.source === 'forbes_5_star');
    matched.push({
      forbes: h,
      hotel: hit,
      action: alreadyTagged ? 'skip_already_tagged' : 'patch',
    });
  }

  console.log(`[forbes-5-star] matched   : ${matched.length}`);
  console.log(`[forbes-5-star] to patch  : ${matched.filter((m) => m.action === 'patch').length}`);
  console.log(
    `[forbes-5-star] skip      : ${matched.filter((m) => m.action === 'skip_already_tagged').length}`,
  );
  console.log(`[forbes-5-star] missing   : ${missing.length}`);

  // ─── Write audit artefacts ──────────────────────────────────────────────
  writeFileSync(
    resolve(ROOT, 'forbes-5-star-matched.json'),
    JSON.stringify(
      matched.map((m) => ({
        forbes_name: m.forbes.name,
        forbes_city: m.forbes.city,
        forbes_country: m.forbes.country,
        mch_id: m.hotel.id,
        mch_slug: m.hotel.slug,
        mch_name: m.hotel.name,
        mch_city: m.hotel.city,
        mch_country_code: m.hotel.country_code,
        action: m.action,
      })),
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(ROOT, 'forbes-5-star-missing.json'),
    JSON.stringify(
      missing.map((x) => ({
        forbes_name: x.forbes.name,
        forbes_city: x.forbes.city,
        forbes_country: x.forbes.country,
        reason: x.reason,
      })),
      null,
      2,
    ),
  );

  if (DRY_RUN) {
    console.log('[forbes-5-star] dry-run complete — see global-sources/forbes-5-star-*.json');
    process.exit(0);
  }

  // ─── PATCH affiliations[] for matched hotels ─────────────────────────────
  let patched = 0;
  let patchErrors = 0;
  let j = 0;
  for (const m of matched) {
    if (m.action !== 'patch') continue;
    j++;
    if (j % 50 === 0) console.log(`  ... patched ${j}`);

    const entry = buildForbesAffiliation(m.forbes);
    const existing = (m.hotel.affiliations ?? []) as Record<string, unknown>[];
    const merged = [...existing, entry];

    const url = `${restBase}/hotels?id=eq.${m.hotel.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        affiliations: merged,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      patched++;
    } else {
      patchErrors++;
      const t = await res.text();
      console.error(`  patch fail ${m.hotel.slug}: ${res.status} ${t.slice(0, 200)}`);
    }
  }

  console.log(
    `\n[forbes-5-star] patched : ${patched} / ${matched.filter((x) => x.action === 'patch').length}`,
  );
  if (patchErrors > 0) {
    console.log(`[forbes-5-star] errors  : ${patchErrors}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[forbes-5-star] fatal', e);
  process.exit(1);
});
