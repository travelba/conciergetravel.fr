/**
 * scaffold-international.ts — insert draft Supabase rows for every international
 * hotel surfaced by Yonder + Travel & Leisure + Condé Nast + W50.
 *
 * Reads:  global-sources/diff-missing.json
 * Writes: global-sources/scaffold-intl-unmapped.json
 *         global-sources/scaffold-intl-to-insert.json
 *         global-sources/scaffold-intl.sql (preview)
 *         public.hotels (INSERT ... ON CONFLICT (slug) DO NOTHING)
 *
 * Inclusion rules (must satisfy ALL):
 *   - hint_country_code present and != 'FR' (FR handled by yonder scaffold)
 *   - At least one premium tier signal (any luxury_tier or W50/T+L/CN listing)
 *   - Name is hotel-specific (skip brand listings like "Capella Hotels & Resorts")
 *
 * Tier priority for the persisted luxury_tier column (only one slot in DB):
 *   world_50_best > tl_worlds_best > cn_gold_list > brand-specific > self_5_star
 *
 * Usage:
 *   pnpm global:scaffold              # actually insert
 *   pnpm global:scaffold -- --dry-run # preview only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

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

// ─── Country mapping (ISO alpha-2 → labels) ───────────────────────────────

interface CountryMeta {
  readonly fr: string;
  readonly en: string;
}
const COUNTRY: Readonly<Record<string, CountryMeta>> = {
  US: { fr: 'États-Unis', en: 'United States' },
  GB: { fr: 'Royaume-Uni', en: 'United Kingdom' },
  IT: { fr: 'Italie', en: 'Italy' },
  ES: { fr: 'Espagne', en: 'Spain' },
  DE: { fr: 'Allemagne', en: 'Germany' },
  PT: { fr: 'Portugal', en: 'Portugal' },
  GR: { fr: 'Grèce', en: 'Greece' },
  CH: { fr: 'Suisse', en: 'Switzerland' },
  AT: { fr: 'Autriche', en: 'Austria' },
  HU: { fr: 'Hongrie', en: 'Hungary' },
  CZ: { fr: 'Tchéquie', en: 'Czechia' },
  NL: { fr: 'Pays-Bas', en: 'Netherlands' },
  BE: { fr: 'Belgique', en: 'Belgium' },
  IE: { fr: 'Irlande', en: 'Ireland' },
  IS: { fr: 'Islande', en: 'Iceland' },
  NO: { fr: 'Norvège', en: 'Norway' },
  SE: { fr: 'Suède', en: 'Sweden' },
  DK: { fr: 'Danemark', en: 'Denmark' },
  FI: { fr: 'Finlande', en: 'Finland' },
  HR: { fr: 'Croatie', en: 'Croatia' },
  ME: { fr: 'Monténégro', en: 'Montenegro' },
  AL: { fr: 'Albanie', en: 'Albania' },
  RO: { fr: 'Roumanie', en: 'Romania' },
  TR: { fr: 'Turquie', en: 'Turkey' },
  RU: { fr: 'Russie', en: 'Russia' },
  GE: { fr: 'Géorgie', en: 'Georgia' },
  CA: { fr: 'Canada', en: 'Canada' },
  MX: { fr: 'Mexique', en: 'Mexico' },
  BR: { fr: 'Brésil', en: 'Brazil' },
  AR: { fr: 'Argentine', en: 'Argentina' },
  PE: { fr: 'Pérou', en: 'Peru' },
  CL: { fr: 'Chili', en: 'Chile' },
  CO: { fr: 'Colombie', en: 'Colombia' },
  EC: { fr: 'Équateur', en: 'Ecuador' },
  BS: { fr: 'Bahamas', en: 'Bahamas' },
  BB: { fr: 'Barbade', en: 'Barbados' },
  JM: { fr: 'Jamaïque', en: 'Jamaica' },
  KY: { fr: 'Îles Caïmans', en: 'Cayman Islands' },
  TC: { fr: 'Îles Turques-et-Caïques', en: 'Turks and Caicos' },
  LC: { fr: 'Sainte-Lucie', en: 'Saint Lucia' },
  BL: { fr: 'Saint-Barthélemy', en: 'Saint Barthélemy' },
  AG: { fr: 'Antigua-et-Barbuda', en: 'Antigua and Barbuda' },
  DM: { fr: 'Dominique', en: 'Dominica' },
  CW: { fr: 'Curaçao', en: 'Curaçao' },
  AW: { fr: 'Aruba', en: 'Aruba' },
  PR: { fr: 'Porto Rico', en: 'Puerto Rico' },
  CR: { fr: 'Costa Rica', en: 'Costa Rica' },
  PA: { fr: 'Panama', en: 'Panama' },
  GT: { fr: 'Guatemala', en: 'Guatemala' },
  BZ: { fr: 'Belize', en: 'Belize' },
  JP: { fr: 'Japon', en: 'Japan' },
  CN: { fr: 'Chine', en: 'China' },
  HK: { fr: 'Hong Kong', en: 'Hong Kong' },
  KR: { fr: 'Corée du Sud', en: 'South Korea' },
  IN: { fr: 'Inde', en: 'India' },
  ID: { fr: 'Indonésie', en: 'Indonesia' },
  TH: { fr: 'Thaïlande', en: 'Thailand' },
  VN: { fr: 'Vietnam', en: 'Vietnam' },
  KH: { fr: 'Cambodge', en: 'Cambodia' },
  MY: { fr: 'Malaisie', en: 'Malaysia' },
  SG: { fr: 'Singapour', en: 'Singapore' },
  PH: { fr: 'Philippines', en: 'Philippines' },
  LK: { fr: 'Sri Lanka', en: 'Sri Lanka' },
  NP: { fr: 'Népal', en: 'Nepal' },
  AE: { fr: 'Émirats arabes unis', en: 'United Arab Emirates' },
  QA: { fr: 'Qatar', en: 'Qatar' },
  OM: { fr: 'Oman', en: 'Oman' },
  SA: { fr: 'Arabie saoudite', en: 'Saudi Arabia' },
  IL: { fr: 'Israël', en: 'Israel' },
  JO: { fr: 'Jordanie', en: 'Jordan' },
  LB: { fr: 'Liban', en: 'Lebanon' },
  MA: { fr: 'Maroc', en: 'Morocco' },
  EG: { fr: 'Égypte', en: 'Egypt' },
  TN: { fr: 'Tunisie', en: 'Tunisia' },
  ZA: { fr: 'Afrique du Sud', en: 'South Africa' },
  KE: { fr: 'Kenya', en: 'Kenya' },
  TZ: { fr: 'Tanzanie', en: 'Tanzania' },
  RW: { fr: 'Rwanda', en: 'Rwanda' },
  UG: { fr: 'Ouganda', en: 'Uganda' },
  ET: { fr: 'Éthiopie', en: 'Ethiopia' },
  NA: { fr: 'Namibie', en: 'Namibia' },
  BW: { fr: 'Botswana', en: 'Botswana' },
  ZM: { fr: 'Zambie', en: 'Zambia' },
  ZW: { fr: 'Zimbabwe', en: 'Zimbabwe' },
  MZ: { fr: 'Mozambique', en: 'Mozambique' },
  MU: { fr: 'Maurice', en: 'Mauritius' },
  MV: { fr: 'Maldives', en: 'Maldives' },
  SC: { fr: 'Seychelles', en: 'Seychelles' },
  AU: { fr: 'Australie', en: 'Australia' },
  NZ: { fr: 'Nouvelle-Zélande', en: 'New Zealand' },
  FJ: { fr: 'Fidji', en: 'Fiji' },
  PF: { fr: 'Polynésie française', en: 'French Polynesia' },
  NC: { fr: 'Nouvelle-Calédonie', en: 'New Caledonia' },
  MC: { fr: 'Monaco', en: 'Monaco' },
  LU: { fr: 'Luxembourg', en: 'Luxembourg' },
  IM: { fr: 'Île de Man', en: 'Isle of Man' },
  MT: { fr: 'Malte', en: 'Malta' },
  CY: { fr: 'Chypre', en: 'Cyprus' },
  AM: { fr: 'Arménie', en: 'Armenia' },
  NI: { fr: 'Nicaragua', en: 'Nicaragua' },
  MN: { fr: 'Mongolie', en: 'Mongolia' },
  BT: { fr: 'Bhoutan', en: 'Bhutan' },
  MM: { fr: 'Birmanie', en: 'Myanmar' },
  TT: { fr: 'Trinité-et-Tobago', en: 'Trinidad and Tobago' },
};

const VALID_TIERS = new Set([
  'palace_atout_france',
  'forbes_5_star',
  'michelin_3_keys',
  'lhw_member',
  'relais_chateaux',
  'small_luxury_hotels',
  'aman',
  'belmond',
  'rosewood',
  'four_seasons',
  'ritz_carlton_reserve',
  'mandarin_oriental',
  'park_hyatt',
  'st_regis',
  'fairmont',
  'world_50_best',
  'tl_worlds_best',
  'cn_gold_list',
  'self_5_star',
]);

// Priority order (lower index = stronger signal kept in the DB column).
const TIER_PRIORITY = [
  'world_50_best',
  'tl_worlds_best',
  'cn_gold_list',
  'forbes_5_star',
  'michelin_3_keys',
  'aman',
  'rosewood',
  'four_seasons',
  'ritz_carlton_reserve',
  'mandarin_oriental',
  'belmond',
  'park_hyatt',
  'st_regis',
  'fairmont',
  'lhw_member',
  'relais_chateaux',
  'small_luxury_hotels',
  'palace_atout_france',
  'self_5_star',
] as const;

function bestTier(tiers: readonly string[]): string | null {
  const set = new Set(tiers.filter((t) => VALID_TIERS.has(t)));
  for (const t of TIER_PRIORITY) {
    if (set.has(t)) return t;
  }
  return null;
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

// ─── Brand-only / non-hotel filter ────────────────────────────────────────
//
// T+L "World's Best Hotel Brands" leaks brand entries into our list
// ("Capella Hotels & Resorts", "Oberoi Hotels & Resorts"). We persist those
// only when a hotel-specific entry exists (one with a city), never as
// standalone draft hotels.

const BRAND_NAME_RX =
  /\bhotels?\s*(?:and|&)\s*resorts?\b|\bhotel\s+(?:brand|brands|collection|group|company)\b|^auberge resorts collection$|^belmond$|^aman$|^four seasons$|^the peninsula hotels$|^banyan group$|^anantara hotels|^shangri-la hotels|^regent$|^taj$/i;

interface MissingHotel {
  name: string;
  hint_city: string | null;
  hint_country: string | null;
  hint_country_code: string | null;
  hint_region: string | null;
  hint_stars: number | null;
  is_palace: boolean | null;
  tier_signals: string[];
  sources_count: number;
  origin_sources: string[];
  origin_urls: string[];
  rank: number | null;
  candidate_slug: string;
}

const missing: MissingHotel[] = JSON.parse(
  readFileSync(resolve(ROOT, 'diff-missing.json'), 'utf8'),
);

interface InsertRow {
  slug: string;
  name: string;
  city: string;
  country_code: string;
  country_label_fr: string;
  country_label_en: string;
  is_palace: boolean;
  luxury_tier: string | null;
  region: string | null;
  sources: string[];
  rank: number | null;
}

const inserts: InsertRow[] = [];
const unmapped: Array<MissingHotel & { reason: string }> = [];
const seenSlugs = new Set<string>();

for (const h of missing) {
  // Skip if no country code resolvable
  if (!h.hint_country_code) {
    unmapped.push({ ...h, reason: 'no country_code' });
    continue;
  }
  // Skip France — handled by yonder/scaffold-missing.ts
  if (h.hint_country_code === 'FR') {
    unmapped.push({ ...h, reason: 'FR (already handled)' });
    continue;
  }
  // Skip brand listings
  if (BRAND_NAME_RX.test(h.name.trim())) {
    unmapped.push({ ...h, reason: 'brand-only entry' });
    continue;
  }
  // Skip if city missing — too dangerous to scaffold without an address anchor
  // (we'd risk creating dupes for "The Mark NY" vs "The Mark London").
  const city = h.hint_city?.trim();
  if (!city || city.length < 2) {
    unmapped.push({ ...h, reason: 'no city' });
    continue;
  }
  const cc = h.hint_country_code;
  const meta = COUNTRY[cc];
  if (!meta) {
    unmapped.push({ ...h, reason: `unknown country_code: ${cc}` });
    continue;
  }
  let slug = slugify(h.name);
  if (slug.length < 3) {
    unmapped.push({ ...h, reason: `bad slug: ${slug}` });
    continue;
  }
  // City-disambiguated fallback when slug collides (e.g. multiple "The Mark").
  if (seenSlugs.has(slug)) {
    const altSlug = `${slug}-${slugify(city)}`;
    if (seenSlugs.has(altSlug)) {
      unmapped.push({ ...h, reason: `duplicate slug: ${slug} (alt also taken)` });
      continue;
    }
    slug = altSlug;
  }
  seenSlugs.add(slug);

  // Best available tier signal — fall back to self_5_star if Yonder/awards
  // mention the hotel but we have no specific brand/tier signal.
  const tier =
    bestTier(h.tier_signals) ?? (h.is_palace ? 'palace_atout_france' : null) ?? 'self_5_star';

  inserts.push({
    slug,
    name: h.name,
    city,
    country_code: cc,
    country_label_fr: meta.fr,
    country_label_en: meta.en,
    is_palace: h.is_palace === true,
    luxury_tier: tier,
    region: h.hint_region ?? null,
    sources: h.origin_urls,
    rank: h.rank,
  });
}

console.log(`[scaffold-intl] candidates    : ${missing.length}`);
console.log(`[scaffold-intl] to insert     : ${inserts.length}`);
console.log(`[scaffold-intl] unmapped      : ${unmapped.length}`);
const reasonCounts: Record<string, number> = {};
for (const u of unmapped) reasonCounts[u.reason] = (reasonCounts[u.reason] ?? 0) + 1;
for (const [r, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`                  ${n.toString().padStart(3)} ${r}`);
}

writeFileSync(resolve(ROOT, 'scaffold-intl-unmapped.json'), JSON.stringify(unmapped, null, 2));
writeFileSync(resolve(ROOT, 'scaffold-intl-to-insert.json'), JSON.stringify(inserts, null, 2));

// SQL preview ----------------------------------------------------------------
const sqlLines: string[] = [
  '-- Scaffold international hotels (Yonder intl + T+L + CN + W50)',
  '-- Generated by scripts/editorial-pilot/src/global-sources/scaffold-international.ts',
  `-- Total inserts: ${inserts.length}`,
  '',
];
for (const i of inserts) {
  const esc = (s: string) => s.replace(/'/g, "''");
  const region = i.region ? `'${esc(i.region)}'` : 'null';
  const tier = i.luxury_tier ? `'${esc(i.luxury_tier)}'` : 'null';
  sqlLines.push(
    `insert into public.hotels (slug, name, stars, is_palace, region, city, country_code, country_label_fr, country_label_en, luxury_tier, booking_mode, priority, is_published)
values ('${esc(i.slug)}', '${esc(i.name)}', 5, ${i.is_palace}, ${region}, '${esc(i.city)}', '${i.country_code}', '${esc(i.country_label_fr)}', '${esc(i.country_label_en)}', ${tier}, 'display_only', 'P2', false)
on conflict (slug) do nothing;`,
  );
}
writeFileSync(resolve(ROOT, 'scaffold-intl.sql'), sqlLines.join('\n'));

if (DRY_RUN) {
  console.log(
    '[scaffold-intl] --dry-run, skipping insert. Preview: global-sources/scaffold-intl.sql',
  );
  process.exit(0);
}

// Real insert ----------------------------------------------------------------
const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['DATABASE_URL'] ?? '').replace(
  /\?sslmode=require/,
  '',
);
if (!conn) {
  console.error('[scaffold-intl] No DB connection string in .env.local');
  process.exit(1);
}
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const before = await cli.query(
  "select count(*) as n from public.hotels where country_code != 'FR'",
);
console.log(`[scaffold-intl] intl hotels before: ${before.rows[0]?.['n'] ?? '?'}`);

let inserted = 0;
let skipped = 0;
let errors = 0;
for (const i of inserts) {
  try {
    const r = await cli.query(
      `insert into public.hotels
        (slug, name, stars, is_palace, region, city, country_code, country_label_fr, country_label_en, luxury_tier, booking_mode, priority, is_published)
       values ($1, $2, 5, $3, $4, $5, $6, $7, $8, $9, 'display_only', 'P2', false)
       on conflict (slug) do nothing
       returning id`,
      [
        i.slug,
        i.name,
        i.is_palace,
        i.region,
        i.city,
        i.country_code,
        i.country_label_fr,
        i.country_label_en,
        i.luxury_tier,
      ],
    );
    if ((r.rowCount ?? 0) > 0) inserted++;
    else skipped++;
  } catch (e) {
    errors++;
    console.error(`  fail ${i.slug}: ${(e as Error).message.slice(0, 200)}`);
  }
}
const after = await cli.query("select count(*) as n from public.hotels where country_code != 'FR'");
console.log(`[scaffold-intl] intl hotels after : ${after.rows[0]?.['n'] ?? '?'}`);
console.log(`[scaffold-intl] inserted          : ${inserted}`);
console.log(`[scaffold-intl] skipped (dup)     : ${skipped}`);
console.log(`[scaffold-intl] errors            : ${errors}`);

await cli.end();
