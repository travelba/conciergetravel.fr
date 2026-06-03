/**
 * Bulk Algolia re-indexer (skill: search-engineering).
 *
 * The Payload `afterChange` hooks (`syncHotelPublicationToAlgolia` /
 * `syncCityPublicationToAlgolia`) keep Algolia in sync **one row at a
 * time** when an editor publishes. There was no way to (re)build the
 * indices from scratch — so a fresh Algolia app stayed empty and the
 * homepage / `/recherche` autocomplete returned nothing.
 *
 * This script reads the **published** catalogue straight from Postgres
 * and pushes the full `hotels_<locale>` + `cities_<locale>` indices,
 * reusing the exact same mappers the hooks use
 * (`buildHotelAlgoliaRecord` / `buildCityAlgoliaRecord`) so the record
 * shape is identical. Cities are derived by grouping hotels on the
 * canonical `citySlug` (no `cities` table exists) — the objectID is a
 * deterministic UUIDv5 of the slug so re-runs are idempotent.
 *
 * Usage (from repo root):
 *   pnpm --filter @mch/editorial-pilot search:reindex            # full push
 *   pnpm --filter @mch/editorial-pilot search:reindex:dry        # build only
 *   pnpm --filter @mch/editorial-pilot search:reindex -- --hotels-only
 *   pnpm --filter @mch/editorial-pilot search:reindex -- --cities-only
 *
 * Required env (root .env.local):
 *   NEXT_PUBLIC_ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY, ALGOLIA_INDEX_PREFIX
 *   DATABASE_URL | SUPABASE_DB_POOLER_URL | SUPABASE_DB_URL
 */

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { algoliasearch } from 'algoliasearch';
import {
  AlgoliaCityRecordSchema,
  AlgoliaHotelRecordSchema,
  buildCityAlgoliaRecord,
  buildHotelAlgoliaRecord,
  citiesIndexName,
  CitySourceRowSchema,
  DEFAULT_CITIES_INDEX_SETTINGS,
  DEFAULT_HOTELS_INDEX_SETTINGS,
  defaultHotelSynonyms,
  hotelsIndexName,
  HotelSourceRowSchema,
  type AlgoliaCityRecord,
  type AlgoliaHotelRecord,
  type SearchLocale,
} from '@mch/integrations/algolia-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

const LOCALES: readonly SearchLocale[] = ['fr', 'en'];
const PAGE_SIZE = 1000;
const MAX_PAGES = 12;

/** Fixed namespace for deterministic city objectIDs (UUIDv5). */
const CITY_NAMESPACE = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

interface Cli {
  readonly dryRun: boolean;
  readonly hotelsOnly: boolean;
  readonly citiesOnly: boolean;
}

function parseCli(argv: readonly string[]): Cli {
  const set = new Set(argv);
  return {
    dryRun: set.has('--dry-run'),
    hotelsOnly: set.has('--hotels-only'),
    citiesOnly: set.has('--cities-only'),
  };
}

/**
 * Mirrors `apps/web/src/server/destinations/cities.ts#citySlug` exactly —
 * the resolver in `catalog-countries.ts` and the annuaire route both use
 * it, so the derived city slug here must match byte-for-byte or the
 * `/hotels/<pays>/<ville>` deep-link validity check breaks.
 */
function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uuidV5(name: string): string {
  const nsHex = CITY_NAMESPACE.replace(/-/g, '');
  const nsBytes = Buffer.from(nsHex, 'hex');
  const hash = createHash('sha1');
  hash.update(nsBytes);
  hash.update(Buffer.from(name, 'utf8'));
  const bytes = hash.digest().subarray(0, 16);
  const b6 = bytes[6] ?? 0;
  const b8 = bytes[8] ?? 0;
  bytes[6] = (b6 & 0x0f) | 0x50;
  bytes[8] = (b8 & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function resolveConnectionString(): string {
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (conn === null) throw new Error('No DB connection string (DATABASE_URL / SUPABASE_DB_*).');
  return conn;
}

interface AlgoliaConfig {
  readonly appId: string;
  readonly adminKey: string;
  readonly prefix: string;
}

function resolveAlgoliaConfig(): AlgoliaConfig {
  const appId = process.env['NEXT_PUBLIC_ALGOLIA_APP_ID'] ?? '';
  const adminKey = process.env['ALGOLIA_ADMIN_API_KEY'] ?? '';
  const prefix = process.env['ALGOLIA_INDEX_PREFIX'] ?? 'dev_';
  if (appId.length === 0 || adminKey.length === 0) {
    throw new Error(
      'Missing NEXT_PUBLIC_ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY in root .env.local.',
    );
  }
  return { appId, adminKey, prefix };
}

const HOTEL_COLUMNS = [
  'id',
  'slug',
  'slug_en',
  'name',
  'name_en',
  'city',
  'district',
  'region',
  'country_code',
  'country_label_fr',
  'country_label_en',
  'is_palace',
  'stars',
  'amenities',
  'highlights',
  'description_fr',
  'description_en',
  'is_little_catalog',
  'priority',
  'google_rating',
  'google_reviews_count',
  'is_published',
].join(', ');

type RawHotel = Record<string, unknown>;

async function fetchPublishedHotels(): Promise<readonly RawHotel[]> {
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = resolveConnectionString().replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const out: RawHotel[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const offset = page * PAGE_SIZE;
      const res = await client.query<RawHotel>(
        `select ${HOTEL_COLUMNS} from public.hotels
         where is_published = true
         order by priority asc, name asc
         limit ${PAGE_SIZE} offset ${offset}`,
      );
      out.push(...res.rows);
      if (res.rows.length < PAGE_SIZE) break;
    }
    return out;
  } finally {
    await client.end();
  }
}

function str(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

interface BuildResult {
  readonly frHotels: readonly AlgoliaHotelRecord[];
  readonly enHotels: readonly AlgoliaHotelRecord[];
  readonly frCities: readonly AlgoliaCityRecord[];
  readonly enCities: readonly AlgoliaCityRecord[];
  readonly skippedHotels: number;
  readonly skippedCities: number;
}

interface CityAccumulator {
  name: string;
  region: string | null;
  countryCode: string;
  count: number;
}

function buildRecords(rows: readonly RawHotel[]): BuildResult {
  const frHotels: AlgoliaHotelRecord[] = [];
  const enHotels: AlgoliaHotelRecord[] = [];
  const cityMap = new Map<string, CityAccumulator>();
  let skippedHotels = 0;

  for (const raw of rows) {
    const countryCode = str(raw['country_code']);
    const countryLabelFr = str(raw['country_label_fr']);
    const countryLabelEn = str(raw['country_label_en']);
    // `region` is null for ~87% of the catalogue (international rows);
    // the record schema requires a string, so coalesce to the country
    // label (or ISO code) — keeps the row searchable + indexable.
    const region = str(raw['region']) ?? countryLabelFr ?? countryLabelEn ?? countryCode ?? '—';

    const source = {
      id: raw['id'],
      slug: raw['slug'],
      slug_en: raw['slug_en'] ?? null,
      name: raw['name'],
      name_en: raw['name_en'] ?? null,
      city: raw['city'],
      district: raw['district'] ?? null,
      region,
      country_code: countryCode,
      country_label_fr: countryLabelFr,
      country_label_en: countryLabelEn,
      is_palace: raw['is_palace'],
      stars: typeof raw['stars'] === 'string' ? Number(raw['stars']) : raw['stars'],
      amenities: raw['amenities'],
      highlights: raw['highlights'],
      description_fr: raw['description_fr'] ?? null,
      description_en: raw['description_en'] ?? null,
      is_little_catalog: raw['is_little_catalog'],
      priority: raw['priority'],
      google_rating: raw['google_rating'] ?? null,
      google_reviews_count:
        typeof raw['google_reviews_count'] === 'string'
          ? Number(raw['google_reviews_count'])
          : (raw['google_reviews_count'] ?? null),
      is_published: raw['is_published'],
    };

    const parsed = HotelSourceRowSchema.safeParse(source);
    if (!parsed.success) {
      skippedHotels += 1;
      continue;
    }
    const row = parsed.data;

    const fr = AlgoliaHotelRecordSchema.safeParse(buildHotelAlgoliaRecord('fr', row));
    const en = AlgoliaHotelRecordSchema.safeParse(buildHotelAlgoliaRecord('en', row));
    if (fr.success) frHotels.push(fr.data);
    if (en.success) enHotels.push(en.data);

    // Accumulate the derived city.
    const slug = citySlug(row.city);
    if (slug.length > 0 && row.country_code !== null && row.country_code !== undefined) {
      const existing = cityMap.get(slug);
      const rowRegion = str(raw['region']);
      if (existing === undefined) {
        cityMap.set(slug, {
          name: row.city,
          region: rowRegion,
          countryCode: row.country_code,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (existing.region === null && rowRegion !== null) existing.region = rowRegion;
      }
    }
  }

  const frCities: AlgoliaCityRecord[] = [];
  const enCities: AlgoliaCityRecord[] = [];
  let skippedCities = 0;

  for (const [slug, acc] of cityMap) {
    const source = {
      id: uuidV5(slug),
      slug,
      slug_en: null,
      name: acc.name,
      name_en: null,
      region: acc.region ?? acc.countryCode,
      country_code: acc.countryCode,
      hotels_count: acc.count,
      is_popular: false,
      aliases: [],
      is_published: true,
    };
    const parsed = CitySourceRowSchema.safeParse(source);
    if (!parsed.success) {
      skippedCities += 1;
      continue;
    }
    const fr = AlgoliaCityRecordSchema.safeParse(buildCityAlgoliaRecord('fr', parsed.data));
    const en = AlgoliaCityRecordSchema.safeParse(buildCityAlgoliaRecord('en', parsed.data));
    if (fr.success) frCities.push(fr.data);
    if (en.success) enCities.push(en.data);
  }

  return { frHotels, enHotels, frCities, enCities, skippedHotels, skippedCities };
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const cfg = resolveAlgoliaConfig();

  console.log('[reindex] reading published catalogue from Postgres…');
  const rows = await fetchPublishedHotels();
  console.log(`[reindex] fetched ${rows.length} published hotels.`);

  const built = buildRecords(rows);
  console.log(
    `[reindex] built records — hotels fr=${built.frHotels.length} en=${built.enHotels.length} ` +
      `(skipped ${built.skippedHotels}); cities fr=${built.frCities.length} en=${built.enCities.length} ` +
      `(skipped ${built.skippedCities}); prefix="${cfg.prefix}".`,
  );

  if (cli.dryRun) {
    const sampleCity = built.frCities.find((c) => c.slug === 'paris') ?? built.frCities[0];
    const sampleHotel = built.frHotels[0];
    console.log('[reindex] DRY RUN — no push. Samples:');
    if (sampleHotel) console.log('  hotel:', JSON.stringify(sampleHotel).slice(0, 240));
    if (sampleCity) console.log('  city :', JSON.stringify(sampleCity));
    return;
  }

  const client = algoliasearch(cfg.appId, cfg.adminKey);

  if (!cli.citiesOnly) {
    for (const locale of LOCALES) {
      const indexName = hotelsIndexName(cfg.prefix, locale);
      const objects = locale === 'fr' ? built.frHotels : built.enHotels;
      await client.setSettings({ indexName, indexSettings: { ...DEFAULT_HOTELS_INDEX_SETTINGS } });
      await client.saveObjects({ indexName, objects: [...objects] });
      await client.saveSynonyms({
        indexName,
        synonymHit: defaultHotelSynonyms(locale).map((e) => ({
          objectID: e.objectID,
          type: 'synonym' as const,
          synonyms: [...e.synonyms],
        })),
        replaceExistingSynonyms: true,
      });
      console.log(`[reindex] hotels → ${indexName}: ${objects.length} objects pushed.`);
    }
  }

  if (!cli.hotelsOnly) {
    for (const locale of LOCALES) {
      const indexName = citiesIndexName(cfg.prefix, locale);
      const objects = locale === 'fr' ? built.frCities : built.enCities;
      await client.setSettings({ indexName, indexSettings: { ...DEFAULT_CITIES_INDEX_SETTINGS } });
      await client.saveObjects({ indexName, objects: [...objects] });
      console.log(`[reindex] cities → ${indexName}: ${objects.length} objects pushed.`);
    }
  }

  console.log('[reindex] done.');
}

main().catch((e: unknown) => {
  console.error('[reindex] FAILED:', e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  process.exitCode = 1;
});
