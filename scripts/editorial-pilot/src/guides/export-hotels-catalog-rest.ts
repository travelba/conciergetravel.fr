/**
 * Refreshes `out/hotels-catalog.json` — the snapshot read by the rankings
 * pipeline (`combinator.ts` eligibility + `load-hotels-catalog.ts`) to:
 *   1. Decide which hotels are eligible for each ranking (filters, incl.
 *      the `is_palace` flag that gates the palace rankings).
 *   2. Feed the LLM the EXACT names + slugs + cities → zero risk of a
 *      hallucinated hotel reference in the generated rankings.
 *
 * This is the **PostgREST sibling** of `list-hotels-for-rankings.ts`.
 * The original uses `pg` against `SUPABASE_DB_POOLER_URL`, which on the
 * Windows dev box resolves to the IPv6-only direct host and fails with
 * `getaddrinfo ENOENT` (see AGENTS.md §9th-wave gotcha). This variant
 * reads over HTTPS via PostgREST so the snapshot can be regenerated on
 * any machine — the anti-regression lock for the `is_palace` cleanup
 * (2026-06-24: 33 official Atout France palaces, 4 duplicate rows at
 * `is_palace=false`).
 *
 * Output shape, column set and ordering are byte-for-byte compatible with
 * `list-hotels-for-rankings.ts` (`order by is_palace desc, stars desc,
 * name asc`).
 *
 * Run (PowerShell):
 *   pnpm --filter @mch/editorial-pilot exec tsx src/guides/export-hotels-catalog-rest.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '../..');

const ENV_CACHE: Record<string, string> = {};

async function loadEnvFile(relPath: string): Promise<void> {
  try {
    const txt = await fs.readFile(path.resolve(REPO_ROOT, relPath), 'utf8');
    for (const line of txt.split(/\r?\n/u)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
      const k = m?.[1];
      const v = m?.[2];
      if (k !== undefined && v !== undefined && ENV_CACHE[k] === undefined) {
        ENV_CACHE[k] = v.trim().replace(/^['"]|['"]$/gu, '');
      }
    }
  } catch {
    /* missing env file → ignore, try the next one */
  }
}

function readEnv(name: string): string {
  return ENV_CACHE[name] ?? process.env[name] ?? '';
}

interface CatalogRow {
  readonly id: string;
  readonly slug: string;
  readonly slug_en: string | null;
  readonly name: string;
  readonly name_en: string | null;
  readonly stars: number;
  readonly is_palace: boolean;
  readonly city: string;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly description_fr: string | null;
  readonly address: string | null;
  readonly postal_code: string | null;
  readonly latitude: string | number | null;
  readonly longitude: string | number | null;
}

function toRow(raw: unknown): CatalogRow {
  const o = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    id: String(o['id']),
    slug: String(o['slug']),
    slug_en: str(o['slug_en']),
    name: String(o['name']),
    name_en: str(o['name_en']),
    stars: typeof o['stars'] === 'number' ? o['stars'] : 5,
    is_palace: Boolean(o['is_palace']),
    city: String(o['city'] ?? ''),
    region: str(o['region']),
    country_code: str(o['country_code']),
    description_fr: str(o['description_fr']),
    address: str(o['address']),
    postal_code: str(o['postal_code']),
    latitude:
      typeof o['latitude'] === 'string' || typeof o['latitude'] === 'number' ? o['latitude'] : null,
    longitude:
      typeof o['longitude'] === 'string' || typeof o['longitude'] === 'number'
        ? o['longitude']
        : null,
  };
}

async function main(): Promise<void> {
  // apps/web/.env.local first (canonical secret store on this box), then root.
  await loadEnvFile('apps/web/.env.local');
  await loadEnvFile('.env.local');

  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/u, '');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url.length === 0 || key.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  }

  const select =
    'id,slug,slug_en,name,name_en,stars,is_palace,city,region,country_code,description_fr,address,postal_code,latitude,longitude';
  // Match list-hotels-for-rankings.ts ordering exactly.
  const order = 'is_palace.desc,stars.desc,name.asc';
  const pageSize = 1000;

  const rows: CatalogRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const q =
      `${url}/rest/v1/hotels?select=${select}` +
      `&is_published=eq.true&order=${order}&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('SELECT did not return an array.');
    for (const r of json) rows.push(toRow(r));
    if (json.length < pageSize) break;
  }

  const outPath = path.join(PILOT_ROOT, 'out/hotels-catalog.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(rows, null, 2), 'utf8');

  const palaceCount = rows.filter((r) => r.is_palace).length;
  const dupSlugs = [
    'bvlgari-hotel-paris',
    'four-seasons-georges-v',
    'hotel-de-crillon',
    'hotel-royal',
  ];
  const dupStillPalace = rows
    .filter((r) => dupSlugs.includes(r.slug) && r.is_palace)
    .map((r) => r.slug);

  console.log(`Wrote ${rows.length} hotels to ${path.relative(process.cwd(), outPath)}`);
  console.log(`is_palace=true count: ${palaceCount}`);
  if (dupStillPalace.length > 0) {
    console.warn(`⚠ duplicate slugs still flagged is_palace=true: ${dupStillPalace.join(', ')}`);
  } else {
    console.log('✓ all 4 known duplicate slugs are is_palace=false');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
