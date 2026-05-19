/**
 * scaffold-missing.ts — insert draft Supabase rows for every missing 5★ /
 * Palace hotel surfaced by extract-yonder.ts + diff-mch.mjs.
 *
 * Filters applied :
 *   - hint_stars === 5  OR  is_palace === true
 *   - hint_country !== explicitly foreign (FR filter already in diff)
 *
 * Hotels that lack hint_city / hint_region are heuristically filled from the
 * yonder source URL (e.g. `/plus-beaux-hotels-nice` → city='Nice'). Unmappable
 * rows are written to `yonder/scaffold-unmapped.json` for human review and
 * NOT inserted.
 *
 * Insert columns: slug, name, stars=5, is_palace, region, city, booking_mode,
 * priority, is_published=false (draft).
 * `priority = 'P2'` flags auto-imports (so existing P0/P1 priorities take
 * precedence in editorial pipelines).
 *
 * Usage:
 *   pnpm yonder:scaffold              # actually insert
 *   pnpm yonder:scaffold -- --dry-run # preview SQL only, write to file
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YONDER_DIR = resolve(__dirname, '../../yonder');
const ENV = resolve(__dirname, '../../../../.env.local');

// ─── Load .env.local ──────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

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

// City + region resolution from yonder URL slugs
const CITY_FROM_URL: Array<{ rx: RegExp; city: string; region: string }> = [
  {
    rx: /\/plus-beaux-hotels-nice\b|cote-azur\b/,
    city: 'Nice',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /-paris(-\d+)?\b|\/paris-/, city: 'Paris', region: 'Île-de-France' },
  { rx: /\/meilleurs-hotels-paris-12\b/, city: 'Paris', region: 'Île-de-France' },
  { rx: /chantilly/, city: 'Chantilly', region: 'Hauts-de-France' },
  { rx: /reims/, city: 'Reims', region: 'Grand Est' },
  { rx: /champagne/, city: 'Reims', region: 'Grand Est' },
  { rx: /colmar/, city: 'Colmar', region: 'Grand Est' },
  { rx: /alsace/, city: 'Strasbourg', region: 'Grand Est' },
  { rx: /strasbourg/, city: 'Strasbourg', region: 'Grand Est' },
  { rx: /bourgogne/, city: 'Beaune', region: 'Bourgogne-Franche-Comté' },
  { rx: /dijon/, city: 'Dijon', region: 'Bourgogne-Franche-Comté' },
  { rx: /pommard/, city: 'Pommard', region: 'Bourgogne-Franche-Comté' },
  { rx: /sologne/, city: 'Cheverny', region: 'Centre-Val de Loire' },
  { rx: /val-de-loire|val-de-loire/, city: 'Tours', region: 'Centre-Val de Loire' },
  { rx: /tours\b/, city: 'Tours', region: 'Centre-Val de Loire' },
  { rx: /chambord/, city: 'Chambord', region: 'Centre-Val de Loire' },
  { rx: /provence/, city: 'Aix-en-Provence', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /alpilles/, city: 'Saint-Rémy-de-Provence', region: "Provence-Alpes-Côte d'Azur" },
  {
    rx: /saint-tropez|ramatuelle|gassin|st-tropez/,
    city: 'Saint-Tropez',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /antibes/, city: 'Antibes', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /cannes/, city: 'Cannes', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /monaco/, city: 'Monaco', region: 'Monaco' },
  { rx: /luberon/, city: 'Gordes', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /marseille/, city: 'Marseille', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /corse/, city: 'Porto-Vecchio', region: 'Corse' },
  { rx: /vendee/, city: 'Les Sables-d’Olonne', region: 'Pays de la Loire' },
  { rx: /atlantique/, city: 'La Baule', region: 'Pays de la Loire' },
  { rx: /la-baule/, city: 'La Baule', region: 'Pays de la Loire' },
  { rx: /la-rochelle/, city: 'La Rochelle', region: 'Nouvelle-Aquitaine' },
  { rx: /bordeaux/, city: 'Bordeaux', region: 'Nouvelle-Aquitaine' },
  { rx: /sud-ouest/, city: 'Bordeaux', region: 'Nouvelle-Aquitaine' },
  { rx: /biarritz|pays-basque/, city: 'Biarritz', region: 'Nouvelle-Aquitaine' },
  { rx: /hossegor|seignosse/, city: 'Hossegor', region: 'Nouvelle-Aquitaine' },
  { rx: /lyon/, city: 'Lyon', region: 'Auvergne-Rhône-Alpes' },
  { rx: /val-thorens/, city: 'Val Thorens', region: 'Auvergne-Rhône-Alpes' },
  { rx: /megeve/, city: 'Megève', region: 'Auvergne-Rhône-Alpes' },
  { rx: /courchevel/, city: 'Courchevel', region: 'Auvergne-Rhône-Alpes' },
  { rx: /lac-leman|evian/, city: 'Évian-les-Bains', region: 'Auvergne-Rhône-Alpes' },
  { rx: /dinard/, city: 'Dinard', region: 'Bretagne' },
  { rx: /vexin/, city: 'Magny-en-Vexin', region: 'Île-de-France' },
  { rx: /bercy/, city: 'Paris', region: 'Île-de-France' },
  { rx: /bastille/, city: 'Paris', region: 'Île-de-France' },
  { rx: /montmartre/, city: 'Paris', region: 'Île-de-France' },
  { rx: /quartier-latin/, city: 'Paris', region: 'Île-de-France' },
  { rx: /marais/, city: 'Paris', region: 'Île-de-France' },
  { rx: /champs-elysees|tour-eiffel|seine\b/, city: 'Paris', region: 'Île-de-France' },
  { rx: /gare-de-lyon/, city: 'Paris', region: 'Île-de-France' },
  { rx: /ile-de-france/, city: 'Versailles', region: 'Île-de-France' },
  { rx: /thoronet|var\b/, city: 'Le Thoronet', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /vosges/, city: 'Gérardmer', region: 'Grand Est' },
];

const REGION_FROM_HINT: Record<string, string> = {
  paris: 'Île-de-France',
  'île-de-france': 'Île-de-France',
  'ile-de-france': 'Île-de-France',
  provence: "Provence-Alpes-Côte d'Azur",
  "cote d'azur": "Provence-Alpes-Côte d'Azur",
  "côte d'azur": "Provence-Alpes-Côte d'Azur",
  'cote azur': "Provence-Alpes-Côte d'Azur",
  corse: 'Corse',
  champagne: 'Grand Est',
  alsace: 'Grand Est',
  bourgogne: 'Bourgogne-Franche-Comté',
  normandie: 'Normandie',
  bretagne: 'Bretagne',
  'sud-ouest': 'Nouvelle-Aquitaine',
  aquitaine: 'Nouvelle-Aquitaine',
  'pays basque': 'Nouvelle-Aquitaine',
  'pays-basque': 'Nouvelle-Aquitaine',
  auvergne: 'Auvergne-Rhône-Alpes',
  'rhone-alpes': 'Auvergne-Rhône-Alpes',
  'val de loire': 'Centre-Val de Loire',
  'centre-val de loire': 'Centre-Val de Loire',
  sologne: 'Centre-Val de Loire',
  savoie: 'Auvergne-Rhône-Alpes',
  vendee: 'Pays de la Loire',
  'loire-atlantique': 'Pays de la Loire',
};

// Last-chance lookup by hotel name (for the long tail Yonder doesn't tag).
const CITY_FROM_NAME: Array<{ rx: RegExp; city: string; region: string }> = [
  { rx: /megev|fermes de marie/i, city: 'Megève', region: 'Auvergne-Rhône-Alpes' },
  { rx: /chais monnet|cognac/i, city: 'Cognac', region: 'Nouvelle-Aquitaine' },
  { rx: /cap estel|eze|chevre d.?or/i, city: 'Èze', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /monte.?carlo|metropole|hermitage monte/i, city: 'Monte-Carlo', region: 'Monaco' },
  { rx: /miramar beach|theoule/i, city: 'Théoule-sur-Mer', region: "Provence-Alpes-Côte d'Azur" },
  {
    rx: /maybourne riviera|roquebrune/i,
    city: 'Roquebrune-Cap-Martin',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /cheneviere|port-en-bessin/i, city: 'Port-en-Bessin', region: 'Normandie' },
  {
    rx: /hameau des baux|petites maisons.*baux/i,
    city: 'Les Baux-de-Provence',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /la baule|hermitage la baule/i, city: 'La Baule', region: 'Pays de la Loire' },
  { rx: /deauville|le royal deauville/i, city: 'Deauville', region: 'Normandie' },
  { rx: /barriere/i, city: 'Deauville', region: 'Normandie' },
  {
    rx: /chateau de fonscolombe|puy.?sainte.?reparade/i,
    city: 'Le Puy-Sainte-Réparade',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /castellet/i, city: 'Le Castellet', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /juana|antibes/i, city: 'Antibes', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /tour d.?argent/i, city: 'Paris', region: 'Île-de-France' },
  { rx: /bommes|lafaurie/i, city: 'Bommes', region: 'Nouvelle-Aquitaine' },
  { rx: /soorts|hossegor/i, city: 'Soorts-Hossegor', region: 'Nouvelle-Aquitaine' },
  { rx: /bonnelles|le barn/i, city: 'Bonnelles', region: 'Île-de-France' },
  { rx: /kaysersberg|chambard/i, city: 'Kaysersberg', region: 'Grand Est' },
  {
    rx: /la croix.?valmer|lily of the valley/i,
    city: 'La Croix-Valmer',
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /beaulieu/i, city: 'Beaulieu-sur-Mer', region: "Provence-Alpes-Côte d'Azur" },
  { rx: /bonifacio|capu biancu/i, city: 'Bonifacio', region: 'Corse' },
];

const FOREIGN_NAME_RX =
  /the montenotte|budapest|london|tokyo|rome|milan|venise|barcelona|marrakech|riad|dubai|maldives|bangkok|bali|new york/i;

// City → region fallback when hint_city is provided but hint_region is null.
const REGION_FROM_CITY: Array<{ rx: RegExp; region: string }> = [
  { rx: /paris/i, region: 'Île-de-France' },
  {
    rx: /versailles|saint-germain-en-laye|chantilly|fontainebleau|barbizon|vexin|bonnelles/i,
    region: 'Île-de-France',
  },
  {
    rx: /nice|cannes|antibes|tropez|ramatuelle|gassin|monaco|monte.?carlo|menton|cap.?ferrat|eze|beaulieu|villefranche|theoule|saint.?raphael|frejus|hyeres|porquerolles|grimaud/i,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    rx: /marseille|aix|baux|saint.?remy|arles|avignon|gordes|menerbes|bonnieux|lourmarin|cassis|bandol|toulon|le castellet|crillon le brave|saint.?cyr/i,
    region: "Provence-Alpes-Côte d'Azur",
  },
  { rx: /reims|epernay|chalons|champagne/i, region: 'Grand Est' },
  {
    rx: /strasbourg|colmar|kaysersberg|riquewihr|obernai|alsace|metz|nancy|vosges|gerardmer/i,
    region: 'Grand Est',
  },
  {
    rx: /beaune|pommard|dijon|chablis|vougeot|nuits.?saint.?georges|bourgogne|jura|besancon/i,
    region: 'Bourgogne-Franche-Comté',
  },
  {
    rx: /tours|amboise|chinon|saumur|cheverny|chambord|blois|orleans|angers/i,
    region: 'Centre-Val de Loire',
  },
  {
    rx: /bordeaux|saint.?emilion|pauillac|margaux|sauternes|bommes|cognac|biarritz|bayonne|saint.?jean.?de.?luz|pays.?basque|hossegor|seignosse|capbreton|landes/i,
    region: 'Nouvelle-Aquitaine',
  },
  { rx: /la rochelle|ile de re|niort|deux.?sevres/i, region: 'Nouvelle-Aquitaine' },
  {
    rx: /lyon|valence|grenoble|chambery|aix.?les.?bains|annecy|geneva|geneve|evian|thonon|megeve|chamonix|val.?thorens|courchevel|meribel|tignes|val.?d.?isere|alpe.?d.?huez|crozet|gex|divonne|saint.?genis.?pouilly/i,
    region: 'Auvergne-Rhône-Alpes',
  },
  {
    rx: /la baule|nantes|le mans|sables.?d.?olonne|vendee|noirmoutier|saint.?gilles.?croix.?de.?vie/i,
    region: 'Pays de la Loire',
  },
  { rx: /dinard|saint.?malo|rennes|quimper|brest|carnac|vannes|belle.?ile/i, region: 'Bretagne' },
  {
    rx: /deauville|honfleur|trouville|cabourg|caen|bayeux|rouen|le havre|etretat|port.?en.?bessin/i,
    region: 'Normandie',
  },
  { rx: /lille|le touquet|amiens|arras/i, region: 'Hauts-de-France' },
  {
    rx: /toulouse|carcassonne|montpellier|nimes|perpignan|narbonne|biarritz/i,
    region: 'Occitanie',
  },
  { rx: /ajaccio|bastia|porto.?vecchio|bonifacio|calvi|sartene|corte|propriano/i, region: 'Corse' },
  { rx: /arcachon|cap.?ferret|lacanau/i, region: 'Nouvelle-Aquitaine' },
];

function regionFromCity(city: string): string | null {
  const normalised = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const r of REGION_FROM_CITY) if (r.rx.test(normalised)) return r.region;
  return null;
}

function resolveCityRegion(
  hintCity: string | null,
  hintRegion: string | null,
  sources: string[],
  name?: string,
): { city: string; region: string } | null {
  if (name && FOREIGN_NAME_RX.test(name)) return null;
  let city = hintCity?.trim() ?? '';
  let region = hintRegion?.trim() ?? '';

  // Normalise region via lookup
  if (region) {
    const k = region.toLowerCase();
    region = REGION_FROM_HINT[k] ?? region;
  }

  if (!city || !region) {
    for (const url of sources) {
      for (const m of CITY_FROM_URL) {
        if (m.rx.test(url)) {
          if (!city) city = m.city;
          if (!region) region = m.region;
          break;
        }
      }
      if (city && region) break;
    }
  }

  // Fallback : if we have city but no region (rare), guess from city
  if (city && !region) {
    region = regionFromCity(city) ?? '';
  }
  // Last chance: match hotel name itself
  if ((!city || !region) && name) {
    for (const m of CITY_FROM_NAME) {
      if (m.rx.test(name)) {
        if (!city) city = m.city;
        if (!region) region = m.region;
        break;
      }
    }
  }
  if (!city || !region) return null;
  return { city, region };
}

interface MissingHotel {
  name: string;
  hint_city: string | null;
  hint_region: string | null;
  hint_stars: number | null;
  is_palace: boolean | null;
  sources: string[];
  candidate_slug: string;
}

const missing: MissingHotel[] = JSON.parse(
  readFileSync(resolve(YONDER_DIR, 'diff-missing.json'), 'utf8'),
);

// Overlay classifications from `unknowns-classified.json` produced by
// `pnpm yonder:classify`. Promotes hotels where the LLM classification says
// 5★ / Palace, so they enter the same insertion path as natively-tagged
// 5★ entries from diff-missing.json. Idempotent: missing file = noop.
type ClassifiedRow = {
  key: string;
  name: string;
  hint_city: string | null;
  classification: {
    stars: number | null;
    is_palace: boolean | null;
    is_5_star_or_palace: boolean;
    is_in_france: boolean | null;
  } | null;
};
let promoted = 0;
try {
  const classifiedPath = resolve(YONDER_DIR, 'unknowns-classified.json');
  const classified: ClassifiedRow[] = JSON.parse(readFileSync(classifiedPath, 'utf8'));
  const byName = new Map(missing.map((m) => [m.name, m]));
  for (const c of classified) {
    if (!c.classification) continue;
    if (!c.classification.is_5_star_or_palace) continue;
    if (c.classification.is_in_france === false) continue;
    const target = byName.get(c.name);
    if (!target) continue;
    if (target.hint_stars === 5 || target.is_palace === true) continue; // already in-scope
    if (c.classification.stars === 5) target.hint_stars = 5;
    if (c.classification.is_palace === true) target.is_palace = true;
    promoted++;
  }
  console.log(`[scaffold] promoted via classifier: ${promoted}`);
} catch {
  console.log('[scaffold] no unknowns-classified.json (skip promotion)');
}

const inScope = missing.filter((h) => h.hint_stars === 5 || h.is_palace === true);

const inserts: Array<{
  slug: string;
  name: string;
  city: string;
  region: string;
  is_palace: boolean;
  sources: string[];
}> = [];
const unmapped: Array<MissingHotel & { reason: string }> = [];
const seenSlugs = new Set<string>();

for (const h of inScope) {
  const slug = slugify(h.name);
  if (slug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    unmapped.push({ ...h, reason: `bad slug: ${slug}` });
    continue;
  }
  if (seenSlugs.has(slug)) {
    unmapped.push({ ...h, reason: `duplicate slug: ${slug}` });
    continue;
  }
  const loc = resolveCityRegion(h.hint_city, h.hint_region, h.sources, h.name);
  if (!loc) {
    unmapped.push({ ...h, reason: 'no city/region resolvable' });
    continue;
  }
  inserts.push({
    slug,
    name: h.name,
    city: loc.city,
    region: loc.region,
    is_palace: h.is_palace === true,
    sources: h.sources,
  });
  seenSlugs.add(slug);
}

console.log(`[scaffold] in scope (5★ or palace): ${inScope.length}`);
console.log(`[scaffold] ready to insert       : ${inserts.length}`);
console.log(`[scaffold] unmapped (human-rev) : ${unmapped.length}`);
writeFileSync(resolve(YONDER_DIR, 'scaffold-unmapped.json'), JSON.stringify(unmapped, null, 2));
writeFileSync(resolve(YONDER_DIR, 'scaffold-to-insert.json'), JSON.stringify(inserts, null, 2));

// SQL preview
const sqlLines: string[] = [
  '-- Scaffold hotels missing from MCH but cited on yonder.fr',
  '-- Generated by scripts/editorial-pilot/src/yonder/scaffold-missing.ts',
  `-- Total inserts: ${inserts.length}`,
  '',
];
for (const i of inserts) {
  const esc = (s: string) => s.replace(/'/g, "''");
  sqlLines.push(
    `insert into public.hotels (slug, name, stars, is_palace, region, city, booking_mode, priority, is_published)
values ('${esc(i.slug)}', '${esc(i.name)}', 5, ${i.is_palace}, '${esc(i.region)}', '${esc(i.city)}', 'display_only', 'P2', false)
on conflict (slug) do nothing;`,
  );
}
writeFileSync(resolve(YONDER_DIR, 'scaffold-hotels.sql'), sqlLines.join('\n'));

if (DRY_RUN) {
  console.log('[scaffold] --dry-run, skipping insert. Preview: yonder/scaffold-hotels.sql');
  process.exit(0);
}

// ─── Connect to Supabase + run ─────────────────────────────────────────────
const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['DATABASE_URL'] ?? '').replace(
  /\?sslmode=require/,
  '',
);
if (!conn) {
  console.error('[scaffold] No DB connection string in .env.local');
  process.exit(1);
}
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const before = await cli.query('select count(*) as n from public.hotels');
console.log(`[scaffold] hotels before: ${before.rows[0]?.['n'] ?? '?'}`);

let inserted = 0;
let skipped = 0;
for (const i of inserts) {
  try {
    const r = await cli.query(
      `insert into public.hotels (slug, name, stars, is_palace, region, city, booking_mode, priority, is_published)
       values ($1, $2, 5, $3, $4, $5, 'display_only', 'P2', false)
       on conflict (slug) do nothing
       returning id`,
      [i.slug, i.name, i.is_palace, i.region, i.city],
    );
    if ((r.rowCount ?? 0) > 0) inserted++;
    else skipped++;
  } catch (e) {
    console.error(`  fail ${i.slug}: ${(e as Error).message}`);
    skipped++;
  }
}
const after = await cli.query('select count(*) as n from public.hotels');
console.log(`[scaffold] hotels after : ${after.rows[0]?.['n'] ?? '?'}`);
console.log(`[scaffold] inserted     : ${inserted}`);
console.log(`[scaffold] skipped (dup): ${skipped}`);

await cli.end();
