/**
 * Backfill `width`/`height` on `hotels.gallery_images` entries
 * (skill: photo-quality-seo-geo-agentique — Hard Rule 16).
 *
 * Why
 * ---
 * The JSON-LD `ImageObject` nodes emitted on every hotel fiche require
 * intrinsic `width`/`height` (Google Rich Results + GEO citation). Most
 * gallery rows were written before the upload helper carried dimensions
 * forward, so ~21.8 k of 23 k entries lack them. The pixel sizes live on
 * Cloudinary; this script reads them via the Admin API and folds them
 * back into the JSONB array — **non-destructive** (only adds two keys;
 * never removes or reorders entries).
 *
 * Pipeline
 * --------
 * 1. List every `cct/hotels/` asset via the Admin API → public_id→{w,h}.
 * 2. Select published hotels (id, slug, gallery_images).
 * 3. For each entry missing positive width/height, fill from the map.
 * 4. PATCH `gallery_images` for the hotels that changed (preserving every
 *    other column).
 *
 * Idempotent — re-runs only touch entries still missing dimensions.
 *
 * CLI
 * ---
 *   pnpm tsx src/photos/backfill-dimensions.ts --dry-run
 *   pnpm tsx src/photos/backfill-dimensions.ts --slug=ritz-paris
 *   pnpm tsx src/photos/backfill-dimensions.ts            # full catalogue
 */

import { configureCloudinary, listUploadedDimensions } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from './supabase-rest.js';

interface CliArgs {
  readonly dryRun: boolean;
  readonly slug: string | null;
  readonly includeDrafts: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let slug: string | null = null;
  let includeDrafts = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--include-drafts') includeDrafts = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: pnpm tsx src/photos/backfill-dimensions.ts [--dry-run] [--slug=<slug>] [--include-drafts]',
      );
      process.exit(0);
    } else console.warn(`Ignoring unknown arg: ${arg}`);
  }
  return { dryRun, slug, includeDrafts };
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly gallery_images: unknown;
}

/** A gallery entry we can safely read/extend (public_id is the join key). */
interface GalleryEntry {
  public_id?: unknown;
  width?: unknown;
  height?: unknown;
  [key: string]: unknown;
}

function isObject(v: unknown): v is GalleryEntry {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasPositiveDims(e: GalleryEntry): boolean {
  return typeof e.width === 'number' && e.width > 0 && typeof e.height === 'number' && e.height > 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsCloudinary: true, needsGooglePlaces: false });

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

  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log('→ Listing Cloudinary dimensions under cct/hotels/ …');
  const dims = await listUploadedDimensions('cct/hotels/', (n, total) => {
    process.stdout.write(`\r  fetched page (+${n}), ${total} assets so far …   `);
  });
  process.stdout.write('\n');
  if (!dims.ok) {
    throw new Error(`Cloudinary Admin API failed: ${JSON.stringify(dims.error)}`);
  }
  const dimMap = dims.value;
  console.log(`  ${dimMap.size} Cloudinary assets indexed.\n`);

  const filters: string[] = [];
  if (!args.includeDrafts) filters.push('is_published=eq.true');
  if (args.slug !== null) filters.push(`slug=eq.${args.slug}`);

  const hotels = await selectHotels<HotelRow>(supa, {
    columns: 'id, slug, gallery_images',
    filters,
  });
  console.log(`→ Scanning ${hotels.length} hotel(s).\n`);

  let hotelsChanged = 0;
  let entriesFilled = 0;
  let entriesMissingInCloudinary = 0;
  let entriesAlreadyOk = 0;
  const missingSamples: string[] = [];

  for (const hotel of hotels) {
    if (!Array.isArray(hotel.gallery_images)) continue;
    let changed = false;
    const next = hotel.gallery_images.map((raw) => {
      if (!isObject(raw)) return raw;
      if (hasPositiveDims(raw)) {
        entriesAlreadyOk += 1;
        return raw;
      }
      const pid = typeof raw.public_id === 'string' ? raw.public_id : null;
      const found = pid !== null ? dimMap.get(pid) : undefined;
      if (found === undefined) {
        entriesMissingInCloudinary += 1;
        if (pid !== null && missingSamples.length < 10) missingSamples.push(pid);
        return raw;
      }
      changed = true;
      entriesFilled += 1;
      return { ...raw, width: found.width, height: found.height };
    });

    if (changed) {
      hotelsChanged += 1;
      if (!args.dryRun) {
        await patchHotelById(supa, hotel.id, { gallery_images: next });
      }
    }
  }

  console.log('=== Summary ===');
  console.log(`Mode:                       ${args.dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  console.log(`Hotels scanned:             ${hotels.length}`);
  console.log(`Hotels updated:             ${hotelsChanged}`);
  console.log(`Entries filled (w/h added): ${entriesFilled}`);
  console.log(`Entries already OK:         ${entriesAlreadyOk}`);
  console.log(`Entries not in Cloudinary:  ${entriesMissingInCloudinary}`);
  if (missingSamples.length > 0) {
    console.log(`  sample missing public_ids: ${missingSamples.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
