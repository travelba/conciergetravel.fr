/**
 * sync-google-reviews.ts — Google Maps / Business Profile review sync.
 *
 * Fetches Place Details (rating, userRatingCount, up to 5 reviews with
 * substantive comments, newest first, any rating 1–5) and
 * PATCHes `hotels.google_rating`, `google_reviews_count`, `google_reviews`,
 * `last_reviews_sync`. Resolves `google_place_id` via geocode when missing.
 *
 * CLI
 * ---
 *   --slug=<slug>       single hotel
 *   --all-published     all `is_published = true` rows
 *   --with-place-id     restrict --all-published to rows that already carry a
 *                       `google_place_id` (skips the costly geocode round-trip
 *                       — the catalogue-wide AggregateRating roll-out target)
 *   --resume            skip slugs already recorded `ok`/`skip` in any
 *                       out/google-reviews-runlog-*.jsonl (retries `fail`)
 *   --limit=<n>         process at most N hotels (wave batching)
 *   --dry-run           skip PATCH, print preview
 *
 * Examples
 * --------
 *   pnpm reviews:sync --slug=les-airelles-gordes
 *   pnpm reviews:sync --slug=les-airelles-gordes --dry-run
 *   pnpm reviews:sync --all-published
 *   pnpm reviews:sync --all-published --with-place-id --resume --limit=500
 */

import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defaultPlacesConfig,
  fetchPlaceDetails,
  geocodeHotelQuery,
} from '@mch/integrations/google-places';
import { mergeGoogleReviewCache } from '@mch/domain/reviews';

import { loadPhotoEnv } from '../photos/env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly google_place_id: string | null;
  readonly google_reviews: unknown;
}

const HOTEL_COLUMNS = 'id, slug, name, city, country_code, google_place_id, google_reviews';

interface CliArgs {
  readonly slug: string | null;
  readonly allPublished: boolean;
  readonly withPlaceId: boolean;
  readonly resume: boolean;
  readonly limit: number | null;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let allPublished = false;
  let withPlaceId = false;
  let resume = false;
  let limit: number | null = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--all-published') allPublished = true;
    else if (arg === '--with-place-id') withPlaceId = true;
    else if (arg === '--resume') resume = true;
    else if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`--limit must be a positive integer (got "${arg}").`);
      }
      limit = parsed;
    } else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: pnpm reviews:sync --slug=<slug> | --all-published [--with-place-id] [--resume] [--limit=<n>] [--dry-run]',
      );
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown CLI arg: ${arg}`);
    }
  }
  if (slug === null && !allPublished) {
    throw new Error('Either --slug=<hotel-slug> or --all-published is required.');
  }
  if (slug !== null && allPublished) {
    throw new Error('Use only one of --slug or --all-published.');
  }
  return { slug, allPublished, withPlaceId, resume, limit, dryRun };
}

/**
 * Build the set of already-processed slugs from every daily runlog so a
 * killed wave can resume losslessly. We treat `ok` (written) and `skip`
 * (Google returned no rating/reviews — deterministic, no point retrying)
 * as done, and deliberately leave `fail` out so transient HTTP / quota
 * errors are retried on the next wave.
 */
function loadProcessedSlugs(outDir: string): Set<string> {
  const done = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(outDir);
  } catch {
    return done;
  }
  for (const file of files) {
    if (!/^google-reviews-runlog-.*\.jsonl$/u.test(file)) continue;
    let content: string;
    try {
      content = readFileSync(resolve(outDir, file), 'utf8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (parsed === null || typeof parsed !== 'object') continue;
      const row = parsed as Record<string, unknown>;
      const slug = row['slug'];
      const outcome = row['outcome'];
      if (typeof slug !== 'string') continue;
      if (outcome === 'ok' || outcome === 'skip') done.add(slug);
    }
  }
  return done;
}

function countryNameFor(code: string | null): string {
  if (code === null || code === 'FR') return 'France';
  return code;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `google-reviews-runlog-${date}.jsonl`);
}

interface RunlogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly placeId?: string;
  readonly rating?: number | null;
  readonly reviewCount?: number | null;
  readonly storedReviews?: number;
  readonly reason?: string;
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

async function pickHotels(cfg: SupabaseRestConfig, args: CliArgs): Promise<HotelRow[]> {
  if (args.slug !== null) {
    return selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLUMNS,
      filters: [`slug=eq.${encodeURIComponent(args.slug)}`],
      limit: 1,
    });
  }
  const filters = ['is_published=eq.true'];
  if (args.withPlaceId) filters.push('google_place_id=not.is.null');
  return selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLUMNS,
    filters,
    order: 'slug.asc',
  });
}

async function resolvePlaceId(
  placesCfg: ReturnType<typeof defaultPlacesConfig>,
  hotel: HotelRow,
): Promise<{ placeId: string; resolvedVia: 'stored' | 'geocode' } | null> {
  const stored = hotel.google_place_id?.trim();
  if (stored !== undefined && stored.length > 0) {
    return { placeId: stored, resolvedVia: 'stored' };
  }
  const geo = await geocodeHotelQuery(placesCfg, hotel.name, hotel.city, {
    country: countryNameFor(hotel.country_code),
  });
  if (!geo.ok) return null;
  return { placeId: geo.value.placeId, resolvedVia: 'geocode' };
}

function parseStoredGoogleReviews(raw: unknown): Array<{
  author: string;
  rating: number;
  text: string;
  publishTime: string | null;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    author: string;
    rating: number;
    text: string;
    publishTime: string | null;
  }> = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const author = row['author'];
    const text = row['text'];
    const rating = row['rating'];
    const publishTime = row['publish_time'];
    if (typeof author !== 'string' || author.trim().length === 0) continue;
    if (typeof text !== 'string' || text.trim().length === 0) continue;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      continue;
    }
    out.push({
      author: author.trim(),
      text: text.trim(),
      rating,
      publishTime:
        typeof publishTime === 'string' && publishTime.trim().length > 0
          ? publishTime.trim()
          : null,
    });
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    throw new Error(
      '[reviews] GOOGLE_PLACES_API_KEY is required. Add it to .env.local before running.',
    );
  }
  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const placesCfg = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);
  const runlogPath = ensureRunlog();

  console.log(`Google reviews sync — args: ${JSON.stringify(args)}`);
  console.log(`Runlog: ${runlogPath}\n`);

  let hotels = await pickHotels(supa, args);
  const selectedCount = hotels.length;

  if (args.resume) {
    const done = loadProcessedSlugs(resolve(__dirname, '../../out'));
    const before = hotels.length;
    hotels = hotels.filter((h) => !done.has(h.slug));
    console.log(`Resume: ${done.size} slug(s) already done; skipping ${before - hotels.length}.`);
  }

  if (args.limit !== null && hotels.length > args.limit) {
    hotels = hotels.slice(0, args.limit);
  }

  if (hotels.length === 0) {
    console.log('No hotels left to process. Done.');
    return;
  }
  console.log(`Selected ${selectedCount} hotel(s); processing ${hotels.length} this wave.\n`);

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const hotel of hotels) {
    process.stdout.write(`→ ${hotel.slug}  `);
    const resolved = await resolvePlaceId(placesCfg, hotel);
    if (resolved === null) {
      console.log('FAIL no_place_id');
      failCount += 1;
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: hotel.slug,
        outcome: 'fail',
        reason: 'no_place_id',
      });
      continue;
    }

    const details = await fetchPlaceDetails(placesCfg, resolved.placeId);
    let effectivePlaceId = resolved.placeId;
    let effectiveDetails = details;
    if (
      !details.ok &&
      details.error.kind === 'http' &&
      details.error.error.kind === 'not_found' &&
      resolved.resolvedVia === 'stored'
    ) {
      const geo = await geocodeHotelQuery(placesCfg, hotel.name, hotel.city, {
        country: countryNameFor(hotel.country_code),
      });
      if (geo.ok) {
        effectivePlaceId = geo.value.placeId;
        effectiveDetails = await fetchPlaceDetails(placesCfg, effectivePlaceId);
      }
    }
    if (!effectiveDetails.ok) {
      console.log(`FAIL ${JSON.stringify(effectiveDetails.error)}`);
      failCount += 1;
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: hotel.slug,
        outcome: 'fail',
        placeId: effectivePlaceId,
        reason: JSON.stringify(effectiveDetails.error).slice(0, 200),
      });
      continue;
    }

    const { rating, userRatingCount, reviews } = effectiveDetails.value;
    if (rating === null && userRatingCount === null && reviews.length === 0) {
      console.log('SKIP no_google_data');
      skipCount += 1;
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: hotel.slug,
        outcome: 'skip',
        placeId: effectivePlaceId,
        reason: 'no_google_data',
      });
      continue;
    }

    const incomingCandidates = reviews.map((review) => ({
      author: review.author,
      rating: review.rating,
      text: review.text,
      publishTime: review.publish_time ?? null,
    }));
    const existingCandidates = parseStoredGoogleReviews(hotel.google_reviews);
    const mergedCandidates = mergeGoogleReviewCache(existingCandidates, incomingCandidates, {
      maxStored: 5,
    });
    const mergedReviews = mergedCandidates.map((review) => {
      const row: Record<string, unknown> = {
        author: review.author,
        rating: review.rating,
        text: review.text,
      };
      if (review.publishTime !== null) row['publish_time'] = review.publishTime;
      return row;
    });

    const resolvedVia = effectivePlaceId !== resolved.placeId ? 'geocode' : resolved.resolvedVia;
    console.log(
      `OK ${resolvedVia} rating=${rating ?? '—'} count=${userRatingCount ?? '—'} quotes=${mergedReviews.length} (api=${reviews.length} merged=${existingCandidates.length})`,
    );

    const payload: Record<string, unknown> = {
      google_rating: rating,
      google_reviews_count: userRatingCount,
      google_reviews: mergedReviews,
      last_reviews_sync: new Date().toISOString(),
    };
    if (effectivePlaceId !== (hotel.google_place_id?.trim() ?? '')) {
      payload.google_place_id = effectivePlaceId;
    }

    if (!args.dryRun) {
      try {
        await patchHotelById(supa, hotel.id, payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ↳ DB write failed: ${msg.slice(0, 200)}`);
        failCount += 1;
        logEntry(runlogPath, {
          ts: new Date().toISOString(),
          slug: hotel.slug,
          outcome: 'fail',
          placeId: effectivePlaceId,
          reason: msg.slice(0, 200),
        });
        continue;
      }
    }

    okCount += 1;
    logEntry(runlogPath, {
      ts: new Date().toISOString(),
      slug: hotel.slug,
      outcome: 'ok',
      placeId: effectivePlaceId,
      rating,
      reviewCount: userRatingCount,
      storedReviews: mergedReviews.length,
    });
  }

  console.log(`\nDone — ok=${okCount} skip=${skipCount} fail=${failCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
