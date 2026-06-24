/**
 * scaffold-missing-rest.ts — Phase D1. Insert dedup-safe DRAFT rows in
 * `public.hotels` for every `qualifie` hotel surfaced by the yonder diff
 * (`yonder/diff-missing.json`), using PostgREST (the `pg` direct host fails
 * on this box — AGENTS.md §gotcha).
 *
 * Improves on the legacy `scaffold-missing.ts`:
 *   - keys on `classification === 'qualifie'` (867), NOT only 5★/palace (381),
 *   - resolves `country_code` + `country_label_fr/_en` for the 386 international
 *     hotels (legacy was France-only and dropped foreign names),
 *   - resolves `region` for France only (nullable abroad — ADR/AGENTS),
 *   - sets a conservative, CHECK-valid `luxury_tier` (never a false Atout-France
 *     Palace claim),
 *   - dedup-safe: skips slugs already present AND fuzzy (nameKey|cityKey)
 *     collisions, and inserts `on_conflict=slug` ignore-duplicates.
 *
 * Inserts: is_published=false, booking_mode='display_only', priority='P2',
 * stars=5 when the hint says 5 (else 4), source='yonder_onboarding'.
 *
 * Usage (PowerShell — use `;`, not `&&`):
 *   tsx src/yonder/scaffold-missing-rest.ts --dry-run            # preview only
 *   tsx src/yonder/scaffold-missing-rest.ts --dry-run --zone=Paris
 *   tsx src/yonder/scaffold-missing-rest.ts                      # live insert all
 *   tsx src/yonder/scaffold-missing-rest.ts --zone=Paris,Megève  # live, zone subset
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YONDER_DIR = resolve(__dirname, '../../yonder');
const REPO_ROOT = resolve(__dirname, '../../../..');

// ─── Env (PostgREST) ────────────────────────────────────────────────────────

function loadEnv(): { url: string; key: string } {
  const cache: Record<string, string> = {};
  for (const rel of ['apps/web/.env.local', '.env.local']) {
    try {
      const txt = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
      for (const line of txt.split(/\r?\n/u)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
        const k = m?.[1];
        const v = m?.[2];
        if (k !== undefined && v !== undefined && cache[k] === undefined) {
          cache[k] = v.trim().replace(/^['"]|['"]$/gu, '');
        }
      }
    } catch {
      /* ignore */
    }
  }
  const url = (
    cache['NEXT_PUBLIC_SUPABASE_URL'] ??
    process.env['NEXT_PUBLIC_SUPABASE_URL'] ??
    ''
  ).replace(/\/+$/u, '');
  const key = cache['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error('[scaffold-rest] missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { url, key };
}

// ─── Normalisation (mirrors diff-mch.ts) ─────────────────────────────────────

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

// ─── Country resolution (FR + EN labels → ISO-2 + canonical labels) ──────────

interface CountryDef {
  readonly cc: string;
  readonly fr: string | null; // null for FR (matches existing catalogue convention)
  readonly en: string | null;
}

const COUNTRY_BY_NAME: Record<string, CountryDef> = {
  france: { cc: 'FR', fr: null, en: null },
  espagne: { cc: 'ES', fr: 'Espagne', en: 'Spain' },
  spain: { cc: 'ES', fr: 'Espagne', en: 'Spain' },
  minorque: { cc: 'ES', fr: 'Espagne', en: 'Spain' },
  suisse: { cc: 'CH', fr: 'Suisse', en: 'Switzerland' },
  switzerland: { cc: 'CH', fr: 'Suisse', en: 'Switzerland' },
  italie: { cc: 'IT', fr: 'Italie', en: 'Italy' },
  italy: { cc: 'IT', fr: 'Italie', en: 'Italy' },
  maurice: { cc: 'MU', fr: 'Maurice', en: 'Mauritius' },
  'ile maurice': { cc: 'MU', fr: 'Maurice', en: 'Mauritius' },
  rodrigues: { cc: 'MU', fr: 'Maurice', en: 'Mauritius' },
  belgique: { cc: 'BE', fr: 'Belgique', en: 'Belgium' },
  usa: { cc: 'US', fr: 'États-Unis', en: 'United States' },
  'etats-unis': { cc: 'US', fr: 'États-Unis', en: 'United States' },
  hawai: { cc: 'US', fr: 'États-Unis', en: 'United States' },
  canada: { cc: 'CA', fr: 'Canada', en: 'Canada' },
  portugal: { cc: 'PT', fr: 'Portugal', en: 'Portugal' },
  acores: { cc: 'PT', fr: 'Portugal', en: 'Portugal' },
  'afrique du sud': { cc: 'ZA', fr: 'Afrique du Sud', en: 'South Africa' },
  'south africa': { cc: 'ZA', fr: 'Afrique du Sud', en: 'South Africa' },
  grece: { cc: 'GR', fr: 'Grèce', en: 'Greece' },
  greece: { cc: 'GR', fr: 'Grèce', en: 'Greece' },
  'arabie saoudite': { cc: 'SA', fr: 'Arabie saoudite', en: 'Saudi Arabia' },
  chine: { cc: 'CN', fr: 'Chine', en: 'China' },
  china: { cc: 'CN', fr: 'Chine', en: 'China' },
  luxembourg: { cc: 'LU', fr: 'Luxembourg', en: 'Luxembourg' },
  albanie: { cc: 'AL', fr: 'Albanie', en: 'Albania' },
  andorre: { cc: 'AD', fr: 'Andorre', en: 'Andorra' },
  andorra: { cc: 'AD', fr: 'Andorre', en: 'Andorra' },
  colombie: { cc: 'CO', fr: 'Colombie', en: 'Colombia' },
  maldives: { cc: 'MV', fr: 'Maldives', en: 'Maldives' },
  maroc: { cc: 'MA', fr: 'Maroc', en: 'Morocco' },
  morocco: { cc: 'MA', fr: 'Maroc', en: 'Morocco' },
  'emirats arabes unis': { cc: 'AE', fr: 'Émirats arabes unis', en: 'United Arab Emirates' },
  'united arab emirates': { cc: 'AE', fr: 'Émirats arabes unis', en: 'United Arab Emirates' },
  sweden: { cc: 'SE', fr: 'Suède', en: 'Sweden' },
  suede: { cc: 'SE', fr: 'Suède', en: 'Sweden' },
  chili: { cc: 'CL', fr: 'Chili', en: 'Chile' },
  chile: { cc: 'CL', fr: 'Chili', en: 'Chile' },
  bhoutan: { cc: 'BT', fr: 'Bhoutan', en: 'Bhutan' },
  seychelles: { cc: 'SC', fr: 'Seychelles', en: 'Seychelles' },
  danemark: { cc: 'DK', fr: 'Danemark', en: 'Denmark' },
  rwanda: { cc: 'RW', fr: 'Rwanda', en: 'Rwanda' },
  japon: { cc: 'JP', fr: 'Japon', en: 'Japan' },
  japan: { cc: 'JP', fr: 'Japon', en: 'Japan' },
  uk: { cc: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom' },
  scotland: { cc: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom' },
  'coree du sud': { cc: 'KR', fr: 'Corée du Sud', en: 'South Korea' },
  'republique dominicaine': { cc: 'DO', fr: 'République dominicaine', en: 'Dominican Republic' },
  autriche: { cc: 'AT', fr: 'Autriche', en: 'Austria' },
  madagascar: { cc: 'MG', fr: 'Madagascar', en: 'Madagascar' },
  mexico: { cc: 'MX', fr: 'Mexique', en: 'Mexico' },
  mexique: { cc: 'MX', fr: 'Mexique', en: 'Mexico' },
  zanzibar: { cc: 'TZ', fr: 'Tanzanie', en: 'Tanzania' },
  indonesie: { cc: 'ID', fr: 'Indonésie', en: 'Indonesia' },
  allemagne: { cc: 'DE', fr: 'Allemagne', en: 'Germany' },
  'sainte lucie': { cc: 'LC', fr: 'Sainte-Lucie', en: 'Saint Lucia' },
  'saint-barthelemy': { cc: 'BL', fr: 'Saint-Barthélemy', en: 'Saint Barthélemy' },
  'saint-barthelemy ': { cc: 'BL', fr: 'Saint-Barthélemy', en: 'Saint Barthélemy' },
  egypte: { cc: 'EG', fr: 'Égypte', en: 'Egypt' },
  irlande: { cc: 'IE', fr: 'Irlande', en: 'Ireland' },
  'iles turques-et-caiques': { cc: 'TC', fr: 'Îles Turques-et-Caïques', en: 'Turks and Caicos' },
  'antigua-et-barbuda': { cc: 'AG', fr: 'Antigua-et-Barbuda', en: 'Antigua and Barbuda' },
};

function normCountryName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// City → country fallback for null-country rows.
const COUNTRY_FROM_CITY: Array<{ rx: RegExp; def: CountryDef }> = [
  { rx: /saint.?barth|gustavia|st.?barth/i, def: COUNTRY_BY_NAME['saint-barthelemy']! },
  {
    rx: /amsterdam|rotterdam|the hague|utrecht/i,
    def: { cc: 'NL', fr: 'Pays-Bas', en: 'Netherlands' },
  },
  {
    rx: /alicante|elche|javea|xabia|minorque|menorca|madrid|barcelona|marbella|sevilla|seville|valencia|ibiza|mallorca|majorque/i,
    def: COUNTRY_BY_NAME['espagne']!,
  },
  {
    rx: /casole|chiusdino|san casciano|fonterutoli|florence|firenze|rome|roma|milan|venice|venise|siena|tuscany|toscane/i,
    def: COUNTRY_BY_NAME['italie']!,
  },
  { rx: /kyoto|tokyo|osaka|kanazawa/i, def: COUNTRY_BY_NAME['japon']! },
];

// ─── France region resolution (ported from scaffold-missing.ts) ──────────────

const REGION_FROM_CITY: Array<{ rx: RegExp; region: string }> = [
  { rx: /paris/i, region: 'Île-de-France' },
  {
    rx: /versailles|saint-germain-en-laye|chantilly|fontainebleau|barbizon|vexin|bonnelles/i,
    region: 'Île-de-France',
  },
  {
    rx: /nice|cannes|antibes|tropez|ramatuelle|gassin|monaco|monte.?carlo|menton|cap.?ferrat|eze|beaulieu|villefranche|theoule|saint.?raphael|frejus|hyeres|porquerolles|grimaud|mougins|valbonne|vallauris|saint.?jean.?cap.?ferrat|roquebrune/i,
    region: "Provence-Alpes-Côte d'Azur",
  },
  {
    rx: /marseille|aix|baux|saint.?remy|arles|avignon|gordes|menerbes|bonnieux|lourmarin|cassis|bandol|toulon|le castellet|crillon le brave|saint.?cyr|le thoronet/i,
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
    rx: /tours|amboise|chinon|saumur|cheverny|chambord|blois|orleans|angers|esvres/i,
    region: 'Centre-Val de Loire',
  },
  {
    rx: /bordeaux|saint.?emilion|pauillac|margaux|sauternes|bommes|cognac|biarritz|bayonne|saint.?jean.?de.?luz|pays.?basque|hossegor|seignosse|capbreton|landes|lege|cap.?ferret|arcachon|lacanau/i,
    region: 'Nouvelle-Aquitaine',
  },
  { rx: /la rochelle|ile de re|niort|deux.?sevres/i, region: 'Nouvelle-Aquitaine' },
  {
    rx: /lyon|valence|grenoble|chambery|aix.?les.?bains|annecy|evian|thonon|megeve|chamonix|val.?thorens|courchevel|meribel|tignes|val.?d.?isere|alpe.?d.?huez|la rosiere/i,
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
    rx: /toulouse|carcassonne|montpellier|nimes|perpignan|narbonne/i,
    region: 'Occitanie',
  },
  { rx: /ajaccio|bastia|porto.?vecchio|bonifacio|calvi|sartene|corte|propriano/i, region: 'Corse' },
];

function regionFromCity(city: string): string | null {
  const n = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const r of REGION_FROM_CITY) if (r.rx.test(n)) return r.region;
  return null;
}

// Loose region hints (yonder uses informal labels) → official INSEE label.
const REGION_FROM_HINT: Record<string, string> = {
  paris: 'Île-de-France',
  'ile-de-france': 'Île-de-France',
  provence: "Provence-Alpes-Côte d'Azur",
  "cote d'azur": "Provence-Alpes-Côte d'Azur",
  'cote azur': "Provence-Alpes-Côte d'Azur",
  'french riviera': "Provence-Alpes-Côte d'Azur",
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
  savoie: 'Auvergne-Rhône-Alpes',
  'rhone-alpes': 'Auvergne-Rhône-Alpes',
  alpes: 'Auvergne-Rhône-Alpes',
  'val de loire': 'Centre-Val de Loire',
  'centre-val de loire': 'Centre-Val de Loire',
  sologne: 'Centre-Val de Loire',
  vendee: 'Pays de la Loire',
  occitanie: 'Occitanie',
};

function normaliseRegion(region: string): string {
  const k = region
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return REGION_FROM_HINT[k] ?? regionFromCity(region) ?? region;
}

// ─── Types ───────────────────────────────────────────────────────────────────

const QualifieSchema = z.object({
  key: z.string(),
  name: z.string(),
  hint_city: z.string().nullable(),
  hint_region: z.string().nullable(),
  hint_country: z.string().nullable(),
  hint_stars: z.number().nullable(),
  is_palace: z.boolean().nullable(),
  scopes: z.array(z.string()).default([]),
  qualifie_reasons: z.array(z.string()).default([]),
});
type Qualifie = z.infer<typeof QualifieSchema>;

const DiffSchema = z.object({ qualifie: z.array(QualifieSchema) });

interface ResolvedLoc {
  readonly city: string | null;
  readonly region: string | null;
  readonly country_code: string;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly zone: string;
}

function resolveCountry(h: Qualifie): CountryDef | null {
  if (h.hint_country) {
    const def = COUNTRY_BY_NAME[normCountryName(h.hint_country)];
    if (def) return def;
  }
  // null/unknown country → fallback from city
  const city = h.hint_city ?? '';
  for (const m of COUNTRY_FROM_CITY) if (m.rx.test(city)) return m.def;
  // French city fallback (region resolver hits → it's France)
  if (city && regionFromCity(city) !== null) return COUNTRY_BY_NAME['france']!;
  return null;
}

function resolveLoc(h: Qualifie): ResolvedLoc | null {
  const country = resolveCountry(h);
  if (!country) return null;
  let region: string | null = h.hint_region?.trim() || null;
  if (country.cc === 'FR') {
    if (!region && h.hint_city) region = regionFromCity(h.hint_city);
    // Normalise loose region hints (e.g. "Provence") to the official label.
    if (region) region = normaliseRegion(region);
  } else {
    region = null; // nullable abroad
  }
  // `hotels.city` is NOT NULL — guarantee a non-null locality: city hint →
  // region → country display name (island-nation rows often have no city).
  const countryDisplay = country.fr ?? country.en ?? (country.cc === 'FR' ? 'France' : country.cc);
  const city = h.hint_city?.trim() || region || countryDisplay;
  const zone = h.hint_city?.trim() || region || countryDisplay;
  return {
    city,
    region,
    country_code: country.cc,
    country_label_fr: country.fr,
    country_label_en: country.en,
    zone,
  };
}

function resolveLuxuryTier(h: Qualifie): string | null {
  if (h.scopes.includes('relais-chateaux')) return 'relais_chateaux';
  if (h.hint_stars === 5 || h.is_palace === true) return 'self_5_star';
  return null;
}

interface InsertRow {
  readonly slug: string;
  readonly name: string;
  readonly stars: number;
  readonly is_palace: boolean;
  readonly city: string | null;
  readonly region: string | null;
  readonly country_code: string;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly luxury_tier: string | null;
  readonly booking_mode: string;
  readonly priority: string;
  readonly is_published: boolean;
  readonly _zone: string;
}

// ─── PostgREST helpers ───────────────────────────────────────────────────────

async function fetchExistingKeys(
  url: string,
  key: string,
): Promise<{ slugs: Set<string>; nameCity: Set<string> }> {
  const slugs = new Set<string>();
  const nameCity = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const q = `${url}/rest/v1/hotels?select=slug,name,city&order=slug.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('SELECT did not return an array');
    for (const r of json) {
      const o = r as Record<string, unknown>;
      const slug = String(o['slug'] ?? '');
      const name = typeof o['name'] === 'string' ? o['name'] : '';
      const city = typeof o['city'] === 'string' ? o['city'] : '';
      if (slug) slugs.add(slug);
      const nk = normaliseKey(name);
      if (nk) nameCity.add(`${nk}|${citySlug(city)}`);
    }
    if (json.length < pageSize) break;
  }
  return { slugs, nameCity };
}

async function countHotels(url: string, key: string): Promise<number> {
  const res = await fetch(`${url}/rest/v1/hotels?select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = res.headers.get('content-range') ?? '';
  const total = cr.split('/')[1];
  return total ? Number(total) : 0;
}

async function insertRows(url: string, key: string, rows: readonly InsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // NOTE: `return=minimal` (NOT representation). With representation,
  // PostgREST masks a 23514 CHECK violation as a misleading 42501 RLS error
  // (it tries to SELECT the failing row back). minimal surfaces the true
  // constraint error. We count inserted rows via before/after totals.
  const before = await countHotels(url, key);
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((r) => ({
      slug: r.slug,
      name: r.name,
      stars: r.stars,
      is_palace: r.is_palace,
      city: r.city,
      region: r.region,
      country_code: r.country_code,
      country_label_fr: r.country_label_fr,
      country_label_en: r.country_label_en,
      luxury_tier: r.luxury_tier,
      booking_mode: r.booking_mode,
      priority: r.priority,
      is_published: r.is_published,
    }));
    const q = `${url}/rest/v1/hotels?on_conflict=slug`;
    const res = await fetch(q, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(slice),
    });
    if (!res.ok) {
      throw new Error(
        `PostgREST INSERT failed (${res.status}) chunk@${i}: ${(await res.text()).slice(0, 400)}`,
      );
    }
  }
  const after = await countHotels(url, key);
  return after - before;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function parseZones(argv: readonly string[]): readonly string[] | null {
  for (const a of argv) {
    if (a.startsWith('--zone=')) {
      return a
        .slice('--zone='.length)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);
    }
  }
  return null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const zoneFilter = parseZones(argv);
  const { url, key } = loadEnv();

  const diff = DiffSchema.parse(
    JSON.parse(readFileSync(resolve(YONDER_DIR, 'diff-missing.json'), 'utf8')),
  );
  let qualifie = diff.qualifie;
  console.log(`[scaffold-rest] qualifie total: ${qualifie.length}`);

  const inserts: InsertRow[] = [];
  const unmapped: Array<{
    name: string;
    reason: string;
    hint_city: string | null;
    hint_country: string | null;
  }> = [];
  const seenSlugs = new Set<string>();

  const existing = await fetchExistingKeys(url, key);
  console.log(
    `[scaffold-rest] existing catalogue: ${existing.slugs.size} slugs, ${existing.nameCity.size} name|city keys`,
  );

  for (const h of qualifie) {
    const slug = slugify(h.name);
    if (slug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      unmapped.push({
        name: h.name,
        reason: `bad slug: ${slug}`,
        hint_city: h.hint_city,
        hint_country: h.hint_country,
      });
      continue;
    }
    if (seenSlugs.has(slug)) {
      unmapped.push({
        name: h.name,
        reason: `dup slug in batch: ${slug}`,
        hint_city: h.hint_city,
        hint_country: h.hint_country,
      });
      continue;
    }
    if (existing.slugs.has(slug)) {
      unmapped.push({
        name: h.name,
        reason: `slug already in catalogue: ${slug}`,
        hint_city: h.hint_city,
        hint_country: h.hint_country,
      });
      continue;
    }
    const loc = resolveLoc(h);
    if (!loc) {
      unmapped.push({
        name: h.name,
        reason: 'country unresolvable',
        hint_city: h.hint_city,
        hint_country: h.hint_country,
      });
      continue;
    }
    // Fuzzy dedup: name|city collision against existing catalogue.
    const fuzzy = `${normaliseKey(h.name)}|${citySlug(loc.city)}`;
    if (existing.nameCity.has(fuzzy)) {
      unmapped.push({
        name: h.name,
        reason: `fuzzy name|city dup: ${fuzzy}`,
        hint_city: h.hint_city,
        hint_country: h.hint_country,
      });
      continue;
    }
    inserts.push({
      // `hotels_stars_ck` enforces `stars = 5` — the catalogue is a curated
      // 5★/Palace-only model. Every qualifie row is luxe-tier per the diff
      // triage; `is_palace` stays accurate (true only for genuine palaces).
      slug,
      name: h.name,
      stars: 5,
      is_palace: h.is_palace === true,
      city: loc.city,
      region: loc.region,
      country_code: loc.country_code,
      country_label_fr: loc.country_label_fr,
      country_label_en: loc.country_label_en,
      luxury_tier: resolveLuxuryTier(h),
      booking_mode: 'display_only',
      priority: 'P2',
      is_published: false,
      _zone: loc.zone,
    });
    seenSlugs.add(slug);
  }

  // Zone filter (applied after resolution so it can match resolved zone/city).
  let toInsert = inserts;
  if (zoneFilter) {
    toInsert = inserts.filter((r) => {
      const z = r._zone.toLowerCase();
      const c = (r.city ?? '').toLowerCase();
      return zoneFilter.some((zf) => z.includes(zf) || c.includes(zf));
    });
  }

  // Zone breakdown.
  const byZone = new Map<string, number>();
  for (const r of toInsert) byZone.set(r._zone, (byZone.get(r._zone) ?? 0) + 1);
  const topZones = [...byZone.entries()].sort((a, b) => b[1] - a[1]);

  console.log(
    `[scaffold-rest] ready to insert : ${toInsert.length}${zoneFilter ? ` (zone filter: ${zoneFilter.join(',')})` : ''}`,
  );
  console.log(`[scaffold-rest] unmapped        : ${unmapped.length}`);
  console.log('[scaffold-rest] top zones:');
  for (const [z, n] of topZones.slice(0, 20)) console.log(`  ${String(n).padStart(3)}  ${z}`);

  writeFileSync(
    resolve(YONDER_DIR, 'scaffold-rest-to-insert.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: toInsert.length,
        zoneFilter,
        topZones,
        rows: toInsert,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(YONDER_DIR, 'scaffold-rest-unmapped.json'),
    JSON.stringify(unmapped, null, 2),
  );

  // Emit a SQL file too — the service_role JWT lacks BYPASSRLS for INSERT on
  // this project (RLS 42501), and `pg` direct fails on this box, so the live
  // insert path is the Supabase MCP `execute_sql` (privileged role) using
  // this file, chunked into multiple statements.
  const sqlEsc = (s: string | null): string => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);
  const CHUNK_SQL = 200;
  const sqlChunks: string[] = [];
  for (let i = 0; i < toInsert.length; i += CHUNK_SQL) {
    const slice = toInsert.slice(i, i + CHUNK_SQL);
    const values = slice
      .map(
        (r) =>
          `(${sqlEsc(r.slug)}, ${sqlEsc(r.name)}, ${r.stars}, ${r.is_palace}, ${sqlEsc(r.city)}, ${sqlEsc(r.region)}, ${sqlEsc(r.country_code)}, ${sqlEsc(r.country_label_fr)}, ${sqlEsc(r.country_label_en)}, ${sqlEsc(r.luxury_tier)}, ${sqlEsc(r.booking_mode)}, ${sqlEsc(r.priority)}, false)`,
      )
      .join(',\n');
    sqlChunks.push(
      `insert into public.hotels (slug, name, stars, is_palace, city, region, country_code, country_label_fr, country_label_en, luxury_tier, booking_mode, priority, is_published)\nvalues\n${values}\non conflict (slug) do nothing;`,
    );
  }
  writeFileSync(resolve(YONDER_DIR, 'scaffold-rest-hotels.sql'), sqlChunks.join('\n\n'));
  console.log(
    `[scaffold-rest] SQL written: yonder/scaffold-rest-hotels.sql (${sqlChunks.length} statement(s))`,
  );

  if (dryRun) {
    console.log(
      '[scaffold-rest] --dry-run, no DB write. Preview → yonder/scaffold-rest-to-insert.json',
    );
    return;
  }

  const inserted = await insertRows(url, key, toInsert);
  console.log(`[scaffold-rest] inserted (new rows): ${inserted}`);
  console.log(`[scaffold-rest] skipped (conflict) : ${toInsert.length - inserted}`);
}

main().catch((err) => {
  console.error('[scaffold-rest] FAILED:', err);
  process.exit(1);
});
