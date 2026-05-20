/**
 * Phase 1 — back-fill `postal_code` from the existing `address` column on
 * the 936-hotel corpus.
 *
 * Heuristics:
 *   - FR : extract a 5-digit number that looks like a French postal code
 *          (10000-99999 with the conventional first-digit ranges)
 *   - GB : extract a UK outward+inward code (e.g. SW1X 7RL or SW7 1AT)
 *   - US : extract a 5-digit ZIP (and optional ZIP+4)
 *   - Other countries : leave null for now (re-enrich later via Tavily)
 *
 * Idempotent — only writes when current `postal_code` is null AND a code
 * was extracted. Logs every write to runs/overnight-postal-fix.log.
 */

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';

const REPO = resolve(process.cwd(), '../..');
loadDotenv({ path: resolve(REPO, '.env.local') });

const RUNS = resolve(REPO, 'runs');
mkdirSync(RUNS, { recursive: true });
const LOG = resolve(RUNS, 'overnight-postal-fix.log');

const conn = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  ''
).replace(/\?sslmode=require/, '');

interface Row {
  slug: string;
  country_code: string;
  address: string | null;
  postal_code: string | null;
}

function extractPostalFR(address: string): string | null {
  const m = address.match(/\b(\d{5})\b/);
  if (!m || !m[1]) return null;
  // French postal codes start with 01-95 (Corse 2A/2B = 20xxx, DOM 97xxx/98xxx).
  const prefix = parseInt(m[1].slice(0, 2), 10);
  if (Number.isNaN(prefix)) return null;
  if ((prefix >= 1 && prefix <= 95) || prefix === 97 || prefix === 98) return m[1];
  return null;
}

function extractPostalGB(address: string): string | null {
  // Outward+Inward: AA9A 9AA, AA99 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA
  const m = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/u);
  return m && m[1] && m[2] ? `${m[1]} ${m[2]}` : null;
}

function extractPostalUS(address: string): string | null {
  // 5-digit ZIP, optional +4, must be in valid range (00501..99950)
  const m = address.match(/\b(\d{5})(?:-?\d{4})?\b/);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 10);
  if (n >= 501 && n <= 99950) return m[1];
  return null;
}

function extractPostal(country: string, address: string): string | null {
  if (country === 'FR') return extractPostalFR(address);
  if (country === 'GB') return extractPostalGB(address);
  if (country === 'US') return extractPostalUS(address);
  return null;
}

const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const { rows } = await cli.query<Row>(
  `select slug, country_code, address, postal_code from public.hotels
   where postal_code is null and address is not null
   order by country_code, slug;`,
);

console.log(`[postal-fix] ${rows.length} hotels with no postal_code (have address)`);

let extracted = 0;
let written = 0;
const byCountry: Record<string, { tried: number; ok: number }> = {};

for (const r of rows) {
  byCountry[r.country_code] ??= { tried: 0, ok: 0 };
  byCountry[r.country_code]!.tried += 1;
  const code = r.country_code && r.address ? extractPostal(r.country_code, r.address) : null;
  if (code === null) continue;
  extracted += 1;
  byCountry[r.country_code]!.ok += 1;
  await cli.query(
    `update public.hotels set postal_code = $1, updated_at = timezone('utc', now()) where slug = $2 and postal_code is null`,
    [code, r.slug],
  );
  written += 1;
  appendFileSync(
    LOG,
    JSON.stringify({ t: new Date().toISOString(), slug: r.slug, country: r.country_code, code }) +
      '\n',
  );
}

console.log(`[postal-fix] extracted=${extracted} written=${written}`);
console.log('[postal-fix] By country:');
for (const [cc, { tried, ok }] of Object.entries(byCountry).sort()) {
  console.log(`  ${cc}: ${ok}/${tried}`);
}

await cli.end();
