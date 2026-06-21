/**
 * backfill-place-photos.ts — photo pipeline for the "lieux à visiter"
 * vertical (`public.places`). Sister of the hotel photo orchestrator
 * `../photos/sync-hotel-photos.ts`, reusing the SAME battle-tested
 * helpers — only the entity (place vs hotel) and the Cloudinary folder
 * differ:
 *
 *   - Sourcing: Google Places Photo API via
 *     `searchPlaceByNameAndCity` + `fetchPlacePhotos`
 *     (@mch/integrations/google-places) — the legally-clean, attributed
 *     source already used by the hotels Tier 2. NO Pinterest / OTA
 *     hotlink (photo-pipeline §legal hygiene).
 *   - Upload: `uploadFromUrl` (@mch/integrations/cloudinary) — fetches
 *     the source bytes itself (Commons/Places 429 work-around), caps at
 *     2400px without upscaling, retries on rate-limit. We pass the new
 *     `folder` override so place assets land under
 *     `cct/places/{cityKey}/{placeSlug}` instead of `cct/hotels/...`.
 *   - Alt enrichment: keyword + context in FR **and** EN (Hard Rule 16):
 *     `"Abbaye de Sénanque, monument à Gordes"`, not `"abbaye"`.
 *   - DB write: PATCH ONLY `hero_image` + `gallery_images` on the place
 *     row (disjoint from the editorial columns faq/description/summary/
 *     is_published that the enrichment + auto-publish loops own — so this
 *     pipeline can run in parallel without lost-updates).
 *
 * The first sourced photo becomes the `hero_image`; the rest fill
 * `gallery_images` (hero is NOT duplicated into the gallery — mirrors the
 * kit `hero_not_in_gallery` invariant).
 *
 * ISOLATION GUARD: refuses `--city=paris` unless `--allow-paris` is passed
 * (a Paris enrichment + auto-publish loop runs continuously — see the task
 * brief). Validate new rollouts on Gordes (`--city=gordes`) first.
 *
 * CLI
 * ---
 *   --city=<key>      city_key (required, e.g. gordes). NOT paris (guarded).
 *   --limit=N         cap places processed (default 50)
 *   --per-place=N     gallery photos kept beyond the hero (default 6)
 *   --force           re-process places that already have a hero_image
 *   --throttle-ms=N   sleep between places (default 400; Places QPM guard)
 *   --dry-run         source + print, skip Cloudinary upload + DB write
 *
 * Examples
 * --------
 *   cd scripts/editorial-pilot
 *   $env:NODE_NO_WARNINGS='1'
 *   npx tsx src/places/backfill-place-photos.ts --city=gordes --limit=3 --dry-run
 *   npx tsx src/places/backfill-place-photos.ts --city=gordes --limit=3
 *
 * Skills: photo-pipeline, api-integration, llm-output-robustness.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isPlaceKind, type PlaceKind } from '@mch/domain/places';
import {
  configureCloudinary,
  toGalleryRow,
  uploadFromUrl,
  type CloudinaryUploadInput,
} from '@mch/integrations/cloudinary';
import {
  defaultPlacesConfig,
  fetchPlacePhotos,
  searchPlaceByNameAndCity,
  type GooglePlacesClientConfig,
} from '@mch/integrations/google-places';

import { loadPhotoEnv, requirePhotoEnv } from '../photos/env-photos.js';

import { patchById, selectTable, type SupabaseRestConfig } from './supabase-places.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly city: string;
  readonly limit: number;
  readonly perPlace: number;
  readonly force: boolean;
  readonly throttleMs: number;
  readonly allowParis: boolean;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city: string | null = null;
  let limit = 50;
  let perPlace = 6;
  let force = false;
  let throttleMs = 400;
  let allowParis = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length).trim().toLowerCase();
    else if (arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--per-place=')) {
      perPlace = Number.parseInt(arg.slice('--per-place='.length), 10);
    } else if (arg.startsWith('--throttle-ms=')) {
      throttleMs = Number.parseInt(arg.slice('--throttle-ms='.length), 10);
    } else if (arg === '--force') force = true;
    else if (arg === '--allow-paris') allowParis = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else console.warn(`Ignoring unknown CLI arg: ${arg}`);
  }
  if (city === null || city.length === 0) {
    throw new Error('--city=<key> is required (e.g. --city=gordes). See --help.');
  }
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (!Number.isFinite(perPlace) || perPlace < 0) perPlace = 6;
  return { city, limit, perPlace, force, throttleMs, allowParis, dryRun };
}

function printHelp(): void {
  console.log(`Usage: npx tsx src/places/backfill-place-photos.ts --city=<key> [options]

Options
-------
  --city=<key>     city_key (required, e.g. gordes). paris is guarded.
  --limit=N        cap places processed (default 50)
  --per-place=N    gallery photos beyond the hero (default 6)
  --force          re-process places that already have a hero_image
  --throttle-ms=N  sleep between places (default 400)
  --allow-paris    explicit opt-in to touch city_key=paris (loop-drained only)
  --dry-run        source + print, skip Cloudinary upload + DB write`);
}

// ---------------------------------------------------------------------------
// Place row + alt enrichment
// ---------------------------------------------------------------------------

interface PlaceRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string;
  readonly city_key: string;
  readonly kind: string;
  readonly hero_image: string | null;
}

const PLACE_COLS = 'id, slug, name, name_en, city, city_key, kind, hero_image';

/** Keyword-rich kind labels for alt text (Hard Rule 16). */
const KIND_LABEL_FR: Readonly<Record<PlaceKind, string>> = {
  museum: 'musée',
  monument: 'monument',
  garden: 'jardin',
  viewpoint: 'point de vue',
  place_of_worship: 'lieu de culte',
  theatre: 'théâtre',
  guided_tour: 'visite guidée',
  shopping: 'lieu de shopping',
  outdoor: 'site de plein air',
  attraction: 'attraction touristique',
};

const KIND_LABEL_EN: Readonly<Record<PlaceKind, string>> = {
  museum: 'museum',
  monument: 'landmark',
  garden: 'garden',
  viewpoint: 'viewpoint',
  place_of_worship: 'place of worship',
  theatre: 'theatre',
  guided_tour: 'guided tour',
  shopping: 'shopping destination',
  outdoor: 'outdoor site',
  attraction: 'tourist attraction',
};

function placeKindOf(raw: string): PlaceKind {
  return isPlaceKind(raw) ? raw : 'attraction';
}

interface AltPair {
  readonly altFr: string;
  readonly altEn: string;
}

/**
 * Build enriched alt text for a place photo. `idx` 0 = hero (no view
 * suffix), 1..N = gallery (with a view counter so the n-th tile reads
 * distinctly). EN name falls back to the FR name when no localised name.
 */
function buildAlt(place: PlaceRow, kind: PlaceKind, idx: number): AltPair {
  const nameFr = place.name;
  const nameEn = place.name_en !== null && place.name_en.length > 0 ? place.name_en : place.name;
  const labelFr = KIND_LABEL_FR[kind];
  const labelEn = KIND_LABEL_EN[kind];
  if (idx === 0) {
    return {
      altFr: `${nameFr}, ${labelFr} à ${place.city}`,
      altEn: `${nameEn}, ${labelEn} in ${place.city}`,
    };
  }
  return {
    altFr: `${nameFr} à ${place.city} — ${labelFr}, vue ${String(idx)}`,
    altEn: `${nameEn} in ${place.city} — ${labelEn}, view ${String(idx)}`,
  };
}

// ---------------------------------------------------------------------------
// Runlog
// ---------------------------------------------------------------------------

interface RunlogEntry {
  readonly ts: string;
  readonly city: string;
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly uploaded?: number;
  readonly hero?: string;
  readonly reason?: string;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `place-photos-runlog-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Per-place processing
// ---------------------------------------------------------------------------

interface PlaceOutcome {
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly uploaded: number;
  readonly hero: string | null;
  readonly reason?: string;
}

async function processPlace(
  place: PlaceRow,
  args: CliArgs,
  supa: SupabaseRestConfig,
  placesCfg: GooglePlacesClientConfig,
): Promise<PlaceOutcome> {
  console.log(`\n→ ${place.slug} (${place.name}, ${place.city})`);

  if (!args.force && place.hero_image !== null && place.hero_image.trim().length > 0) {
    console.log(`  skip — already has hero_image (${place.hero_image}). Use --force to re-source.`);
    return { slug: place.slug, outcome: 'skip', uploaded: 0, hero: null, reason: 'has hero' };
  }

  const kind = placeKindOf(place.kind);
  const wanted = args.perPlace + 1; // hero + gallery

  // 1. Google Places search → photo names.
  const search = await searchPlaceByNameAndCity(placesCfg, place.name, place.city);
  if (!search.ok) {
    console.warn(`  [places] search failed: ${JSON.stringify(search.error)}`);
    return { slug: place.slug, outcome: 'skip', uploaded: 0, hero: null, reason: 'search failed' };
  }
  if (search.value.photos.length === 0) {
    console.warn(`  [places] place ${search.value.id} has 0 photos`);
    return { slug: place.slug, outcome: 'skip', uploaded: 0, hero: null, reason: 'no photos' };
  }

  // 2. Resolve photo media URLs (signed, temporary — uploaded immediately).
  const photos = await fetchPlacePhotos(placesCfg, search.value.photos, wanted);
  if (!photos.ok || photos.value.length === 0) {
    console.warn(
      `  [places] fetch failed / empty: ${JSON.stringify(photos.ok ? 'empty' : photos.error)}`,
    );
    return { slug: place.slug, outcome: 'skip', uploaded: 0, hero: null, reason: 'fetch empty' };
  }
  console.log(`  sourced ${String(photos.value.length)} photo(s) from Google Places`);

  const folder = `cct/places/${place.city_key}/${place.slug}`;

  if (args.dryRun) {
    for (let i = 0; i < photos.value.length; i++) {
      const alt = buildAlt(place, kind, i);
      const pid = i === 0 ? 'hero' : `gallery-${String(i)}`;
      console.log(`  [dry-run] ${folder}/${pid}  alt_fr="${alt.altFr}" | alt_en="${alt.altEn}"`);
    }
    return {
      slug: place.slug,
      outcome: 'ok',
      uploaded: photos.value.length,
      hero: `${folder}/hero`,
    };
  }

  // 3. Upload each photo to Cloudinary under cct/places/<city>/<slug>.
  let hero: string | null = null;
  const gallery: ReturnType<typeof toGalleryRow>[] = [];
  let galleryIdx = 0;
  let uploaded = 0;
  for (let i = 0; i < photos.value.length; i++) {
    const photo = photos.value[i];
    if (photo === undefined) continue;
    const alt = buildAlt(place, kind, i);
    const publicIdShort = i === 0 ? 'hero' : `gallery-${String(i)}`;
    const input: CloudinaryUploadInput = {
      sourceUrl: photo.downloadUrl,
      hotelSlug: place.slug, // tags only; folder is overridden below
      source: 'places',
      index: i + 1,
      publicIdShort,
      folder,
      altFr: alt.altFr,
      altEn: alt.altEn,
      category: kind,
      extraTags: ['place', place.city_key, 'google_places', 'attributed'],
    };
    const res = await uploadFromUrl(input);
    if (!res.ok) {
      console.warn(`  [upload #${String(i + 1)}] FAILED: ${JSON.stringify(res.error)}`);
      continue;
    }
    uploaded += 1;
    console.log(
      `  [upload #${String(i + 1)}] OK ${res.value.public_id} (${String(res.value.width)}x${String(res.value.height)})`,
    );
    if (i === 0) {
      hero = res.value.public_id;
    } else {
      galleryIdx += 1;
      gallery.push(toGalleryRow(res.value, input));
    }
  }

  if (uploaded === 0 || hero === null) {
    return {
      slug: place.slug,
      outcome: 'fail',
      uploaded,
      hero: null,
      reason: 'all uploads failed',
    };
  }

  // 4. PATCH ONLY the photo columns (never the editorial columns the
  //    enrichment / auto-publish loops own).
  await patchById(supa, 'places', place.id, {
    hero_image: hero,
    gallery_images: gallery,
  });
  console.log(`  DB updated: hero=${hero}, gallery=${String(galleryIdx)} item(s)`);

  return { slug: place.slug, outcome: 'ok', uploaded, hero };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.city === 'paris' && !args.allowParis) {
    throw new Error(
      'Refusing --city=paris: a Paris enrichment + auto-publish loop runs continuously. ' +
        'Pass --allow-paris ONLY after that loop is drained (see task brief).',
    );
  }

  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsCloudinary: !args.dryRun, needsGooglePlaces: true });
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    throw new Error('GOOGLE_PLACES_API_KEY required');
  }

  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const placesCfg = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);

  if (!args.dryRun) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
    if (
      CLOUDINARY_CLOUD_NAME === undefined ||
      CLOUDINARY_API_KEY === undefined ||
      CLOUDINARY_API_SECRET === undefined
    ) {
      throw new Error('Cloudinary env missing after requirePhotoEnv check');
    }
    configureCloudinary({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
    });
  }

  const runlogPath = ensureRunlog();
  console.log(`[backfill-place-photos] args: ${JSON.stringify(args)}`);
  console.log(`Runlog: ${runlogPath}\n`);

  const filters = [`city_key=eq.${args.city}`, 'is_published=eq.true'];
  const places = await selectTable<PlaceRow>(supa, 'places', {
    columns: PLACE_COLS,
    filters,
    order: 'slug.asc',
    limit: args.limit,
  });
  if (places.length === 0) {
    console.log(`No published places matched city_key=${args.city}. Done.`);
    return;
  }
  console.log(`Selected ${String(places.length)} place(s) for city_key=${args.city}.`);

  const results: PlaceOutcome[] = [];
  for (const place of places) {
    try {
      const outcome = await processPlace(place, args, supa, placesCfg);
      results.push(outcome);
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        city: args.city,
        slug: outcome.slug,
        outcome: outcome.outcome,
        uploaded: outcome.uploaded,
        ...(outcome.hero !== null ? { hero: outcome.hero } : {}),
        ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  CRASH on ${place.slug}: ${msg}`);
      results.push({ slug: place.slug, outcome: 'fail', uploaded: 0, hero: null, reason: msg });
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        city: args.city,
        slug: place.slug,
        outcome: 'fail',
        reason: msg.slice(0, 200),
      });
    }
    if (args.throttleMs > 0) await sleep(args.throttleMs);
  }

  const ok = results.filter((r) => r.outcome === 'ok').length;
  const skip = results.filter((r) => r.outcome === 'skip').length;
  const fail = results.filter((r) => r.outcome === 'fail').length;
  const totalUploaded = results.reduce((acc, r) => acc + r.uploaded, 0);
  console.log(`\n=== Summary (city_key=${args.city}) ===`);
  console.log(`OK:   ${String(ok)}`);
  console.log(`SKIP: ${String(skip)}`);
  console.log(`FAIL: ${String(fail)}`);
  console.log(`Total photos uploaded: ${String(totalUploaded)}`);
  console.log(`Runlog: ${runlogPath}`);
}

main().catch((e: unknown) => {
  console.error('[backfill-place-photos] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
