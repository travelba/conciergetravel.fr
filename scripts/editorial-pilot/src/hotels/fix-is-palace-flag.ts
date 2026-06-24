/**
 * fix-is-palace-flag — reconcile `public.hotels.is_palace` with the
 * OFFICIAL Atout France "Palace" distinction (2026 Collection).
 *
 * Context (2026-06-24 data-quality audit): the catalogue carried 37 rows
 * flagged `is_palace=true`, but Atout France distinguishes exactly **33**
 * establishments (Collection Palace 2026, unveiled 2 June 2026). Every
 * flagged hotel WAS a genuine Atout France palace — the inflation came
 * from **4 duplicate rows** (the same physical palace present twice under
 * two slugs), both carrying the flag:
 *   - Bvlgari Hotel Paris      → keep `bulgari-hotel-paris`,  drop `bvlgari-hotel-paris`
 *   - Four Seasons George V    → keep `four-seasons-hotel-george-v`, drop `four-seasons-georges-v`
 *   - Hôtel de Crillon         → keep `hotel-de-crillon-a-rosewood-hotel`, drop `hotel-de-crillon`
 *   - Hôtel Royal (Évian)      → keep `hotel-royal-evian`, drop `hotel-royal`
 * The kept slug matches the canonical row already referenced by the live
 * `meilleurs-palaces-paris` ranking and by `run-pillar-palaces-france.ts`
 * (its `DEDUP_EXCLUDE`). No real palace loses its distinction at entity
 * level — each of the 33 keeps exactly one flagged row.
 *
 * EXACTITUDE: "Palace" is an official French state distinction (Atout
 * France, created 2010, above the 5-star classification). We flag
 * `is_palace=true` ONLY for a hotel on the official list. This script is
 * a pure reconciliation against `OFFICIAL_PALACE_SLUGS` (the 33 canonical
 * DB rows). Any currently-true row NOT in that set is deflagged; the set
 * itself is asserted (and reported if any official row is unexpectedly
 * not flagged — never auto-flagged, to avoid surprises).
 *
 * Sources (cross-checked):
 *   1. Atout France — "Connaître les établissements distingués Palace"
 *      (atout-france.fr) + "Carte Palaces 2 juin 2026" (PDF) + press kit
 *      "Atout France dévoile les 33 fleurons de l'hôtellerie française".
 *   2. Guide Michelin — "France Reveals Its New Palace Hotels for 2026 —
 *      See the Full List of 33".
 *
 * Idempotent. Touches ONLY the `is_palace` column. Dry-run by default;
 * pass `--apply` to write. A pre-write backup of every affected row is
 * persisted to `runs/is-palace-backup-<ts>.json`.
 *
 * Usage (PowerShell):
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/fix-is-palace-flag.ts
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/fix-is-palace-flag.ts --apply
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '../..');
const RUNS_DIR = path.resolve(PILOT_ROOT, 'runs');

/**
 * The 33 canonical DB slugs of the official Atout France Collection
 * Palace 2026. One slug per physical palace (duplicate rows excluded).
 */
const OFFICIAL_PALACE_SLUGS: ReadonlySet<string> = new Set<string>([
  // Paris (13)
  'bulgari-hotel-paris',
  'cheval-blanc-paris',
  'hotel-barriere-le-fouquet-s-paris',
  'four-seasons-hotel-george-v',
  'hotel-de-crillon-a-rosewood-hotel',
  'plaza-athenee-paris',
  'la-reserve-paris-hotel-and-spa',
  'le-bristol-paris',
  'le-meurice',
  'hotel-lutetia',
  'le-royal-monceau-raffles-paris',
  'shangri-la-paris',
  'hotel-the-peninsula-paris',
  // Les Alpes (7)
  'les-airelles-courchevel',
  'cheval-blanc-courchevel',
  'fouquets-courchevel',
  'four-seasons-megeve',
  'hotel-royal-evian',
  'lapogee-courchevel',
  'le-k2-palace',
  // Côte d'Azur — Sud-Est (9)
  'les-airelles-gordes',
  'les-airelles-saint-tropez',
  'chateau-saint-martin-vence',
  'cheval-blanc-saint-tropez',
  'grand-hotel-cap-ferrat',
  'hotel-du-cap-eden-roc',
  'hotel-martinez',
  'la-reserve-ramatuelle',
  'villa-la-coste',
  // Sud-Ouest (2)
  'les-pres-deugenie',
  'les-sources-de-caudalie',
  // Est — Champagne (1)
  'le-royal-champagne-hotel-spa',
  // Caraïbes (1)
  'cheval-blanc-st-barth',
]);

interface PalaceRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly is_palace: boolean;
}

const ENV_CACHE: Record<string, string> = {};

async function loadEnv(): Promise<void> {
  const envPath = path.resolve(REPO_ROOT, 'apps/web/.env.local');
  const txt = await readFile(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/u)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    const k = m?.[1];
    const v = m?.[2];
    if (k !== undefined && v !== undefined) {
      ENV_CACHE[k] = v.trim().replace(/^['"]|['"]$/gu, '');
    }
  }
}

function restCfg(): { readonly url: string; readonly key: string } {
  const url = (ENV_CACHE['NEXT_PUBLIC_SUPABASE_URL'] ?? '').replace(/\/$/u, '');
  const key = ENV_CACHE['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local',
    );
  }
  return { url, key };
}

async function fetchFlaggedPalaces(): Promise<PalaceRow[]> {
  const { url, key } = restCfg();
  const select = 'id,slug,name,city,region,country_code,is_palace';
  const q = `${url}/rest/v1/hotels?select=${select}&is_palace=eq.true&order=country_code.asc,city.asc,name.asc&limit=500`;
  const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('SELECT did not return an array.');
  return json.map((r): PalaceRow => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o['id']),
      slug: String(o['slug']),
      name: String(o['name']),
      city: typeof o['city'] === 'string' ? o['city'] : null,
      region: typeof o['region'] === 'string' ? o['region'] : null,
      country_code: typeof o['country_code'] === 'string' ? o['country_code'] : null,
      is_palace: Boolean(o['is_palace']),
    };
  });
}

async function setPalaceFlag(id: string, value: boolean): Promise<void> {
  const { url, key } = restCfg();
  const res = await fetch(`${url}/rest/v1/hotels?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_palace: value }),
  });
  if (!res.ok)
    throw new Error(`PATCH ${id} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply');
  await loadEnv();

  const flagged = await fetchFlaggedPalaces();
  console.log(`Currently is_palace=true: ${flagged.length} rows.`);

  const toDeflag = flagged.filter((r) => !OFFICIAL_PALACE_SLUGS.has(r.slug));
  const officialPresent = new Set(
    flagged.filter((r) => OFFICIAL_PALACE_SLUGS.has(r.slug)).map((r) => r.slug),
  );
  const officialMissing = [...OFFICIAL_PALACE_SLUGS].filter((s) => !officialPresent.has(s));

  console.log(
    `\nOfficial palaces flagged true: ${officialPresent.size}/${OFFICIAL_PALACE_SLUGS.size}`,
  );
  if (officialMissing.length > 0) {
    console.warn(
      `⚠ ${officialMissing.length} official palace(s) NOT currently flagged (review manually — NOT auto-flagged):`,
    );
    for (const s of officialMissing) console.warn(`    - ${s}`);
  }

  console.log(`\nRows to DEFLAG (is_palace true → false): ${toDeflag.length}`);
  for (const r of toDeflag) {
    console.log(`    - ${r.name} | ${r.city ?? '-'} <${r.slug}> [${r.id}]`);
  }

  if (toDeflag.length === 0) {
    console.log('\n✓ Nothing to deflag — DB already matches the official 33-palace set.');
    return;
  }

  // Backup before any write.
  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');
  const backupPath = path.join(RUNS_DIR, `is-palace-backup-${ts}.json`);
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        official_count: OFFICIAL_PALACE_SLUGS.size,
        flagged_before: flagged.length,
        deflagged: toDeflag.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          city: r.city,
          before: { is_palace: true },
          after: { is_palace: false },
          reason: 'duplicate row of an official palace already flagged on its canonical slug',
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nBackup written → ${path.relative(process.cwd(), backupPath)}`);

  if (!apply) {
    console.log('\n(dry-run) No write performed. Re-run with --apply to deflag.');
    return;
  }

  for (const r of toDeflag) {
    await setPalaceFlag(r.id, false);
    console.log(`  ✓ deflagged ${r.slug}`);
  }

  const after = await fetchFlaggedPalaces();
  const parisAfter = after.filter(
    (r) => r.country_code === 'FR' && (r.city ?? '').toLowerCase().includes('paris'),
  );
  console.log(`\n✓ Done. is_palace=true now: ${after.length} rows (Paris: ${parisAfter.length}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
