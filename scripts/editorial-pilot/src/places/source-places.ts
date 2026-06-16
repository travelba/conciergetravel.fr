/**
 * source-places.ts — sourcing pipeline for the "lieux à visiter" catalogue.
 *
 * Per city anchor:
 *   1. Discover candidate places via Google Places (New) `searchNearby`
 *      (worldwide, well-structured). Map each to our visit/do taxonomy.
 *   2. (optional `--enrich`) Generate the editorial envelope (factual
 *      summary FR/EN + short description) in the Concierge voice via the
 *      shared `llmExtract` helper (dynamic import — no OPENAI needed for
 *      the base scaffold run).
 *   3. Match GetYourGuide products to each place by coordinates (Palier A
 *      deeplink monetisation). Skipped when GYG is disabled/unconfigured.
 *   4. UPSERT `places` (scaffold rows, is_published=false) +
 *      `place_gyg_products`. Idempotent — re-runs merge by source_ref /
 *      (place_id, gyg_tour_id).
 *
 * Editorial fields are intentionally left for the enrichment pass (same
 * scaffold-then-enrich pattern as the hotels catalogue); a place only
 * goes `is_published=true` once it clears the Payload validators.
 *
 * CLI
 * ---
 *   --city=<key>        : city_key (e.g. paris). Required.
 *   --anchor=lat,lng    : search centre (defaults to a built-in city anchor)
 *   --radius=N          : search radius metres (default 2500, max 50000)
 *   --bucket=visit|do|all (default all)
 *   --max=N             : cap candidates kept (default 40)
 *   --enrich            : run the LLM editorial pass
 *   --no-gyg            : skip GetYourGuide matching
 *   --dry-run           : compute + print, skip the UPSERT
 */
import {
  defaultPlacesConfig,
  searchNearbyPois,
  type GooglePlacesClientConfig,
  type NormalisedPlacePoi,
} from '@mch/integrations/google-places';
import {
  getYourGuideConfigFromSharedEnv,
  searchGygToursByCoords,
  type ParsedGygTour,
} from '@mch/integrations/getyourguide';

import { loadPhotoEnv } from '../photos/env-photos.js';

import { mapGoogleTypeToKind, slugify } from './place-slug.js';
import { selectTable, upsertRows, type SupabaseRestConfig } from './supabase-places.js';

interface CliArgs {
  readonly city: string | null;
  readonly anchor: { lat: number; lng: number } | null;
  readonly radius: number;
  readonly bucket: 'visit' | 'do' | 'all';
  readonly max: number;
  readonly enrich: boolean;
  readonly noGyg: boolean;
  readonly dryRun: boolean;
  readonly country: string;
}

/** Built-in city anchors for the pilot. Extend per rollout wave. */
const CITY_ANCHORS: Readonly<Record<string, { lat: number; lng: number; city: string }>> = {
  paris: { lat: 48.8566, lng: 2.3522, city: 'Paris' },
};

function parseArgs(argv: readonly string[]): CliArgs {
  let city: string | null = null;
  let anchor: { lat: number; lng: number } | null = null;
  let radius = 2500;
  let bucket: 'visit' | 'do' | 'all' = 'all';
  let max = 40;
  let enrich = false;
  let noGyg = false;
  let dryRun = false;
  let country = 'FR';
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--anchor=')) {
      const [la, ln] = arg.slice('--anchor='.length).split(',');
      const lat = Number.parseFloat(la ?? '');
      const lng = Number.parseFloat(ln ?? '');
      if (Number.isFinite(lat) && Number.isFinite(lng)) anchor = { lat, lng };
    } else if (arg.startsWith('--radius=')) radius = Number.parseInt(arg.slice(9), 10);
    else if (arg === '--bucket=visit') bucket = 'visit';
    else if (arg === '--bucket=do') bucket = 'do';
    else if (arg.startsWith('--max=')) max = Number.parseInt(arg.slice(6), 10);
    else if (arg === '--enrich') enrich = true;
    else if (arg === '--no-gyg') noGyg = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--country=')) country = arg.slice('--country='.length);
  }
  return { city, anchor, radius, bucket, max, enrich, noGyg, dryRun, country };
}

interface PlaceScaffold {
  readonly slug: string;
  readonly source_ref: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly bucket: 'visit' | 'do';
  readonly kind: string;
  readonly name: string;
  readonly city_key: string;
  readonly city: string;
  readonly country_code: string;
}

function candidateToScaffold(
  poi: NormalisedPlacePoi,
  cityKey: string,
  cityName: string,
  country: string,
  bucketFilter: 'visit' | 'do' | 'all',
  usedSlugs: Set<string>,
): PlaceScaffold | null {
  const mapping = mapGoogleTypeToKind(poi.primaryType, poi.types);
  if (mapping === null) return null;
  if (bucketFilter !== 'all' && mapping.bucket !== bucketFilter) return null;

  let slug = slugify(poi.name);
  if (slug.length === 0) return null;
  // Disambiguate same-name places within the batch.
  if (usedSlugs.has(slug)) slug = `${slug}-${poi.placeId.slice(-6).toLowerCase()}`;
  usedSlugs.add(slug);

  return {
    slug,
    source_ref: `gp/${poi.placeId}`,
    latitude: poi.latitude,
    longitude: poi.longitude,
    bucket: mapping.bucket,
    kind: mapping.kind,
    name: poi.name,
    city_key: cityKey,
    city: cityName,
    country_code: country,
  };
}

async function matchGygProducts(scaffold: PlaceScaffold): Promise<readonly ParsedGygTour[]> {
  const cfg = getYourGuideConfigFromSharedEnv();
  const res = await searchGygToursByCoords(cfg, {
    latitude: scaffold.latitude,
    longitude: scaffold.longitude,
    radiusKm: 1,
    limit: 4,
    locale: 'fr',
  });
  if (!res.ok) {
    if (res.error.kind !== 'disabled' && res.error.kind !== 'unconfigured') {
      console.warn(`  [gyg] ${scaffold.slug}: ${res.error.kind}`);
    }
    return [];
  }
  return res.value;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.city === null) {
    console.error('[source-places] --city=<key> is required (e.g. --city=paris)');
    process.exit(1);
  }
  const env = loadPhotoEnv();
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    console.error('[source-places] GOOGLE_PLACES_API_KEY required for sourcing.');
    process.exit(1);
  }
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const gplaces: GooglePlacesClientConfig = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);

  const builtIn = CITY_ANCHORS[args.city];
  const anchor =
    args.anchor ?? (builtIn !== undefined ? { lat: builtIn.lat, lng: builtIn.lng } : null);
  const cityName = builtIn?.city ?? args.city;
  if (anchor === null) {
    console.error(`[source-places] no built-in anchor for "${args.city}"; pass --anchor=lat,lng`);
    process.exit(1);
  }

  console.log(
    `[source-places] city=${args.city} anchor=${String(anchor.lat)},${String(anchor.lng)} ` +
      `radius=${String(args.radius)}m bucket=${args.bucket}`,
  );

  const search = await searchNearbyPois(gplaces, anchor.lat, anchor.lng, {
    radiusMeters: args.radius,
    maxResults: 20,
    languageCode: 'fr',
  });
  if (!search.ok) {
    console.error('[source-places] Google nearby search failed:', search.error.kind);
    process.exit(1);
  }

  const usedSlugs = new Set<string>();
  const scaffolds: PlaceScaffold[] = [];
  for (const poi of search.value) {
    if (scaffolds.length >= args.max) break;
    const sc = candidateToScaffold(poi, args.city, cityName, args.country, args.bucket, usedSlugs);
    if (sc !== null) scaffolds.push(sc);
  }

  console.log(
    `[source-places] ${String(search.value.length)} candidates → ${String(
      scaffolds.length,
    )} kept (visit/do).`,
  );

  if (scaffolds.length === 0) {
    console.log('[source-places] nothing to upsert.');
    return;
  }

  // 1. Upsert the place scaffolds (need ids back for product linkage).
  if (args.dryRun) {
    for (const s of scaffolds) console.log(`  ${s.bucket}/${s.kind}  ${s.slug}  (${s.name})`);
  } else {
    await upsertRows(
      cfg,
      'places',
      scaffolds.map((s) => ({
        slug: s.slug,
        source_ref: s.source_ref,
        latitude: s.latitude,
        longitude: s.longitude,
        bucket: s.bucket,
        kind: s.kind,
        name: s.name,
        city_key: s.city_key,
        city: s.city,
        country_code: s.country_code,
      })),
      'city_key,slug',
    );
  }

  // 2. Re-select to resolve ids by source_ref, then match GYG + upsert.
  if (!args.noGyg && !args.dryRun) {
    const sourceRefs = scaffolds.map((s) => `"${s.source_ref}"`).join(',');
    const stored = await selectTable<{
      id: string;
      source_ref: string;
      latitude: number;
      longitude: number;
    }>(cfg, 'places', {
      columns: 'id, source_ref, latitude, longitude',
      filters: [`source_ref=in.(${sourceRefs})`],
      order: 'id.asc',
    });
    let productCount = 0;
    for (const row of stored) {
      const scaffold = scaffolds.find((s) => s.source_ref === row.source_ref);
      if (scaffold === undefined) continue;
      const tours = await matchGygProducts(scaffold);
      if (tours.length === 0) continue;
      const productRows = tours.map((t, i) => ({
        place_id: row.id,
        gyg_tour_id: t.tourId,
        title: t.title,
        abstract: t.abstract,
        price_from_minor: t.priceFromMinor,
        currency: t.currency,
        rating: t.rating,
        review_count: t.reviewCount,
        deeplink_url: t.deeplinkUrl,
        image_url: t.imageUrl,
        sort_order: (i + 1) * 10,
      }));
      await upsertRows(cfg, 'place_gyg_products', productRows, 'place_id,gyg_tour_id');
      productCount += productRows.length;
    }
    console.log(`[source-places] matched ${String(productCount)} GYG products.`);
  }

  if (args.enrich && !args.dryRun) {
    // Editorial enrichment is a heavy LLM pass — imported lazily so the
    // base scaffold run does not require OPENAI_API_KEY.
    const { enrichPlacesEditorial } = await import('./enrich-places-editorial.js');
    await enrichPlacesEditorial(cfg, args.city);
  }

  console.log(`[source-places] ${args.dryRun ? 'DRY-RUN ' : ''}done.`);
}

main().catch((e: unknown) => {
  console.error('[source-places] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
