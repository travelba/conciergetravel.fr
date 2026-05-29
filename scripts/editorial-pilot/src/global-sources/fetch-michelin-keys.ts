/**
 * fetch-michelin-keys.ts — patch `hotels.affiliations[]` with the
 * MICHELIN Key distinction (1-Key / 2-Keys / 3-Keys) for every matching
 * row in the published catalogue.
 *
 * Background
 * ----------
 * On 8 October 2025 The MICHELIN Guide unveiled its first-ever Global
 * Keys selection — 2,457 hotels distinguished across 125 countries with
 * One (1,742), Two (572) or Three (143) MICHELIN Keys. The Key is the
 * hotel equivalent of the restaurant Star — a stackable certification
 * that lives alongside other distinctions (Atout France Palace, Forbes
 * Five-Star, Relais & Châteaux, …) on the same hotel.
 *
 * Schema rationale (HotelAffiliation):
 *   kind         : 'label'   — MICHELIN Keys is a third-party
 *                              certification, stackable with other
 *                              labels. ADR-0023 §4.
 *   source       : 'michelin_3_keys' | 'michelin_2_keys' | 'michelin_1_key'
 *                              — distinct per level (mirrors the
 *                              Forbes `forbes_5_star` convention) so
 *                              dedicated `/label/michelin-3-keys` facet
 *                              URLs become possible in a future sprint.
 *   display_name : 'MICHELIN Guide — Three Keys' / 'Two Keys' / 'One Key'
 *   facet_slug   : 'michelin-3-keys' | 'michelin-2-keys' | 'michelin-1-key'
 *   verified     : true       — derived from the official MICHELIN
 *                              Guide announcement (per-country pages and
 *                              the global selection article).
 *   since_year   : 2025        — the inaugural global Keys cycle.
 *   metadata     : {
 *     year: 2025,
 *     via: 'michelin-guide-article',
 *     keys_count: 1 | 2 | 3,
 *     michelin_url?: string,
 *   }
 *
 * Method
 * ------
 * 1. Read `michelin-keys-2025.normalized.json` (output of
 *    `parse-michelin-keys.ts`).
 * 2. Resolve country labels to ISO 3166-1 alpha-2 via `country-codes.ts`
 *    (extended 2026-05-29 with Chile, Peru, Croatia, India, Sri Lanka,
 *    Germany, Namibia).
 * 3. For each hotel build 2-4 ILIKE patterns from the name with accent
 *    tolerance (same approach as `fetch-forbes-5-star.ts`).
 * 4. Query Supabase filtered by `country_code`. Rank candidates by city
 *    overlap + published status; pick the best hit.
 * 5. Patch `affiliations[]` — idempotent (skip if the same `source`
 *    slug already exists on the row).
 * 6. Emit `michelin-keys-matched.json` + `michelin-keys-missing.json`
 *    audit artefacts.
 *
 * Forward-compat: re-run yearly with the new selection. The script is
 * idempotent — re-running does NOT duplicate the entry.
 *
 * Usage:
 *   pnpm michelin:keys:dry    # plan only (writes report JSON)
 *   pnpm michelin:keys        # actually patch via PostgREST
 *
 * Flags:
 *   --dry-run                 # do not write — emit audit JSON only
 *   --limit=N                 # process only the first N entries
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
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice('--limit='.length)) : Number.POSITIVE_INFINITY;
const SCRAPED_AT = new Date().toISOString();
const MICHELIN_YEAR = 2025;

import { countryCodeFromLabel } from '../itineraries/country-codes';

// ─── Inputs ──────────────────────────────────────────────────────────────────

interface MichelinHotel {
  name: string;
  city: string;
  country: string;
  keys_count: 1 | 2 | 3;
  michelin_url?: string;
}

function loadMichelinHotels(): MichelinHotel[] {
  const path = resolve(ROOT, `michelin-keys-${MICHELIN_YEAR}.normalized.json`);
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(text) as MichelinHotel[];
  if (!Array.isArray(parsed)) throw new Error('michelin-keys JSON must be an array');
  return parsed;
}

// ─── Pattern generation (same approach as fetch-forbes-5-star.ts) ───────────
//
// ILIKE does NOT unaccent. We replace vowels + c/n with `_` (single-char
// wildcard) so the pattern matches accented variants without losing
// specificity. The country_code filter compensates for any over-matching.

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
  'lodge',
  'manor',
  'house',
  'inn',
]);

function normaliseToIlikePattern(input: string): string {
  const lowered = input.toLowerCase();
  const widened = Array.from(lowered)
    .map((c) => {
      if ('aeioucn'.includes(c)) return '_';
      if (/[a-z0-9\s]/.test(c)) return c;
      return '%';
    })
    .join('');
  const collapsed = widened.replace(/%+/g, '%').replace(/\s+/g, ' ').trim();
  return `%${collapsed}%`;
}

function significantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
}

function buildKeywordPattern(name: string): string | null {
  const tokens = significantTokens(name);
  // ≥ 2 tokens OR 1 token of ≥ 6 chars — short single tokens like
  // `villa` (5), `baur` (4) are too loose across the catalogue, but
  // longer single tokens like `mitsui` (6), `brando` (6), `newton` (6),
  // `lucknam` (7) are discriminating enough when combined with the
  // country filter + post-match overlap validation.
  const first = tokens[0];
  if (first === undefined) return null;
  if (tokens.length === 1 && first.length < 6) return null;
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

/**
 * Strip leading articles ("Hôtel/Hotel/The/Le/La/Les/A") and trailing
 * city qualifiers / generic words ("Hotel", "KYOTO", "Private",
 * "Resort") so that "Hôtel Plaza Athénée" matches catalogue
 * "Plaza Athénée Paris" and "HOTEL THE MITSUI KYOTO" matches
 * "Hotel The Mitsui". Returns the trimmed core if it differs from the
 * input, otherwise null.
 */
const LEADING_ARTICLES = ['hôtel', 'hotel', 'the', 'le', 'la', 'les', 'a'];
const TRAILING_QUALIFIERS = ['hotel', 'private', 'resort', 'spa', 'townhouse'];

function stripBoilerplate(name: string): string | null {
  let result = name.trim();
  const lower = result.toLowerCase();
  for (const a of LEADING_ARTICLES) {
    if (lower.startsWith(`${a} `)) {
      result = result.slice(a.length + 1).trim();
      break;
    }
  }
  for (const q of TRAILING_QUALIFIERS) {
    const lr = result.toLowerCase();
    if (lr.endsWith(` ${q}`)) {
      result = result.slice(0, result.length - q.length - 1).trim();
      break;
    }
  }
  return result.length > 0 && result.toLowerCase() !== name.toLowerCase() ? result : null;
}

function buildPatterns(name: string): string[] {
  const patterns = new Set<string>();
  patterns.add(normaliseToIlikePattern(name));
  const beforeComma = name.split(',')[0]?.trim() ?? '';
  if (beforeComma.length > 0 && beforeComma !== name) {
    patterns.add(normaliseToIlikePattern(beforeComma));
  }
  const stripped = stripBoilerplate(beforeComma.length > 0 ? beforeComma : name);
  if (stripped !== null) {
    patterns.add(normaliseToIlikePattern(stripped));
    const kwStripped = buildKeywordPattern(stripped);
    if (kwStripped !== null) patterns.add(kwStripped);
  }
  const kw = buildKeywordPattern(name);
  if (kw !== null) patterns.add(kw);
  const kwBefore = buildKeywordPattern(beforeComma);
  if (kwBefore !== null) patterns.add(kwBefore);
  return Array.from(patterns);
}

/**
 * Post-match validation: confirm the matched hotel name shares at least
 * one significant token (≥ 4 chars, non-stop-word, accent-folded) with
 * the seed hotel name. Catches false positives slipping through the
 * ILIKE patterns when the country has a sparse catalogue (e.g.
 * "Adare Manor" → "The Wilder Townhouse" in Dublin because both end up
 * matching `%_d_r_%`).
 */
function foldAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasMeaningfulOverlap(seedName: string, dbName: string): boolean {
  const seedTokens = significantTokens(foldAccents(seedName));
  if (seedTokens.length === 0) return true; // can't enforce; accept
  const foldedDb = foldAccents(dbName);
  return seedTokens.some((t) => foldedDb.includes(t));
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
  seedName: string,
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
    // Post-match validation — drop any row whose name shares no
    // significant token with the seed name (accent-folded). The country
    // filter is not enough on its own when the country has few rows.
    const filtered = rows.filter((r) => hasMeaningfulOverlap(seedName, r.name));
    if (filtered.length === 0) continue;
    const ranked = filtered.slice().sort((a, b) => {
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

type KeysCount = 1 | 2 | 3;

interface MichelinKeyAffiliation {
  kind: 'label';
  source: 'michelin_1_key' | 'michelin_2_keys' | 'michelin_3_keys';
  display_name: string;
  verified: true;
  since_year: number;
  facet_slug: 'michelin-1-key' | 'michelin-2-keys' | 'michelin-3-keys';
  source_url: string;
  scraped_at: string;
  metadata: {
    year: number;
    via: 'michelin-guide-article';
    keys_count: KeysCount;
    michelin_url?: string;
  };
}

const SOURCE_BY_LEVEL: Record<KeysCount, MichelinKeyAffiliation['source']> = {
  1: 'michelin_1_key',
  2: 'michelin_2_keys',
  3: 'michelin_3_keys',
};

const FACET_BY_LEVEL: Record<KeysCount, MichelinKeyAffiliation['facet_slug']> = {
  1: 'michelin-1-key',
  2: 'michelin-2-keys',
  3: 'michelin-3-keys',
};

const DISPLAY_BY_LEVEL: Record<KeysCount, string> = {
  1: 'MICHELIN Guide — One Key',
  2: 'MICHELIN Guide — Two Keys',
  3: 'MICHELIN Guide — Three Keys',
};

/** All `source` slugs this pipeline can emit — used to detect existing
 *  Michelin Key tags regardless of the current level we're trying to
 *  patch. Prevents leaving stale entries when a hotel is promoted between
 *  levels year over year. */
const ALL_MICHELIN_SOURCES: ReadonlySet<string> = new Set([
  'michelin_1_key',
  'michelin_2_keys',
  'michelin_3_keys',
]);

function buildMichelinAffiliation(h: MichelinHotel): MichelinKeyAffiliation {
  const level = h.keys_count;
  return {
    kind: 'label',
    source: SOURCE_BY_LEVEL[level],
    display_name: DISPLAY_BY_LEVEL[level],
    verified: true,
    since_year: MICHELIN_YEAR,
    facet_slug: FACET_BY_LEVEL[level],
    source_url:
      'https://guide.michelin.com/en/article/travel/all-the-key-hotels-in-the-world-michelin-guide',
    scraped_at: SCRAPED_AT,
    metadata: {
      year: MICHELIN_YEAR,
      via: 'michelin-guide-article',
      keys_count: level,
      ...(h.michelin_url !== undefined ? { michelin_url: h.michelin_url } : {}),
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[michelin-keys] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
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

  const allHotels = loadMichelinHotels();
  const hotels = allHotels.slice(0, Number.isFinite(LIMIT) ? LIMIT : allHotels.length);
  console.log(`[michelin-keys] ${allHotels.length} Michelin Key hotels in seed list`);
  if (hotels.length < allHotels.length) {
    console.log(`[michelin-keys] limit applied : processing ${hotels.length} entries`);
  }
  console.log(`[michelin-keys] dry-run : ${DRY_RUN ? 'YES' : 'NO'}`);

  interface MatchedEntry {
    michelin: MichelinHotel;
    hotel: HotelRow;
    action: 'patch' | 'skip_already_tagged' | 'patch_replacing_old_level';
    oldSource?: string;
  }
  const matched: MatchedEntry[] = [];
  const missing: Array<{ michelin: MichelinHotel; reason: string }> = [];

  let i = 0;
  for (const h of hotels) {
    i++;
    if (i % 25 === 0) console.log(`  ... ${i} / ${hotels.length}`);

    let countryCode: string;
    try {
      countryCode = countryCodeFromLabel(h.country);
    } catch {
      missing.push({ michelin: h, reason: `unknown country: ${h.country}` });
      continue;
    }

    const patterns = buildPatterns(h.name);
    const hit = await fetchHotelByPatterns(
      restBase,
      baseHeaders,
      h.name,
      patterns,
      countryCode,
      h.city,
    );
    if (hit === null) {
      missing.push({
        michelin: h,
        reason: `no row matched in country ${countryCode} for patterns ${patterns.join(' | ')}`,
      });
      continue;
    }

    const existing = (hit.affiliations ?? []) as Array<{ source?: string }>;
    const sameLevelTagged = existing.some((e) => e?.source === SOURCE_BY_LEVEL[h.keys_count]);
    const otherLevelTagged = existing.find(
      (e) =>
        typeof e?.source === 'string' &&
        ALL_MICHELIN_SOURCES.has(e.source) &&
        e.source !== SOURCE_BY_LEVEL[h.keys_count],
    );
    if (sameLevelTagged) {
      matched.push({ michelin: h, hotel: hit, action: 'skip_already_tagged' });
    } else if (otherLevelTagged !== undefined && typeof otherLevelTagged.source === 'string') {
      matched.push({
        michelin: h,
        hotel: hit,
        action: 'patch_replacing_old_level',
        oldSource: otherLevelTagged.source,
      });
    } else {
      matched.push({ michelin: h, hotel: hit, action: 'patch' });
    }
  }

  const byAction = (a: MatchedEntry['action']): number =>
    matched.filter((m) => m.action === a).length;

  console.log(`\n[michelin-keys] matched     : ${matched.length}`);
  console.log(`[michelin-keys]   to patch  : ${byAction('patch')}`);
  console.log(`[michelin-keys]   replace   : ${byAction('patch_replacing_old_level')}`);
  console.log(`[michelin-keys]   skip same : ${byAction('skip_already_tagged')}`);
  console.log(`[michelin-keys] missing     : ${missing.length}`);

  // Breakdown matched by level
  const matchedByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const m of matched)
    matchedByLevel[m.michelin.keys_count] = (matchedByLevel[m.michelin.keys_count] ?? 0) + 1;
  console.log(
    `[michelin-keys] by level — 3k=${matchedByLevel[3]}, 2k=${matchedByLevel[2]}, 1k=${matchedByLevel[1]}`,
  );

  // ─── Write audit artefacts ──────────────────────────────────────────────
  writeFileSync(
    resolve(ROOT, 'michelin-keys-matched.json'),
    JSON.stringify(
      matched.map((m) => ({
        michelin_name: m.michelin.name,
        michelin_city: m.michelin.city,
        michelin_country: m.michelin.country,
        michelin_keys_count: m.michelin.keys_count,
        mch_id: m.hotel.id,
        mch_slug: m.hotel.slug,
        mch_name: m.hotel.name,
        mch_city: m.hotel.city,
        mch_country_code: m.hotel.country_code,
        mch_published: m.hotel.is_published,
        action: m.action,
        ...(m.oldSource !== undefined ? { old_source: m.oldSource } : {}),
      })),
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(ROOT, 'michelin-keys-missing.json'),
    JSON.stringify(
      missing.map((x) => ({
        michelin_name: x.michelin.name,
        michelin_city: x.michelin.city,
        michelin_country: x.michelin.country,
        michelin_keys_count: x.michelin.keys_count,
        reason: x.reason,
      })),
      null,
      2,
    ),
  );

  if (DRY_RUN) {
    console.log('[michelin-keys] dry-run complete — see global-sources/michelin-keys-*.json');
    process.exit(0);
  }

  // ─── PATCH affiliations[] for matched hotels ─────────────────────────────
  let patched = 0;
  let patchErrors = 0;
  let j = 0;
  for (const m of matched) {
    if (m.action === 'skip_already_tagged') continue;
    j++;
    if (j % 25 === 0) console.log(`  ... patched ${j}`);

    const entry = buildMichelinAffiliation(m.michelin);
    const existing = (m.hotel.affiliations ?? []) as Array<Record<string, unknown>>;
    // Replace any stale Michelin Keys affiliation (different level) with
    // the new one. Keep all other affiliations untouched.
    const filtered = existing.filter((e) => {
      const src = typeof e?.['source'] === 'string' ? (e['source'] as string) : '';
      return !ALL_MICHELIN_SOURCES.has(src);
    });
    const merged = [...filtered, entry];

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

  const toPatch = byAction('patch') + byAction('patch_replacing_old_level');
  console.log(`\n[michelin-keys] patched : ${patched} / ${toPatch}`);
  if (patchErrors > 0) {
    console.log(`[michelin-keys] errors  : ${patchErrors}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[michelin-keys] fatal', e);
  process.exit(1);
});
