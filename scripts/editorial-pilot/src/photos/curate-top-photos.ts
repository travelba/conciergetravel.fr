/**
 * curate-top-photos.ts — re-orders a hotel's gallery so the TOP 5 (hero +
 * the 4 above-the-fold mosaic tiles) instantly conveys the hotel's
 * "tendance" / character.
 *
 * It does NOT touch Cloudinary or fetch anything: it is a pure DB-side
 * curation pass that reads the Vision scores already written by
 * `categorize-with-vision.ts` (`quality_score`, `representativeness`,
 * `hero_suitable`, `category`) and applies `orderGallery` from
 * `gallery-coverage.ts`:
 *
 *   - hero_image      = the most emblematic, hero-suitable signature shot
 *   - gallery_images  = [diverse TOP 4 first, then the rest by score],
 *                       hero excluded (mirrors `sync-hotel-photos.ts`).
 *
 * Because the public fiche renders `hero_image` + `gallery_images.slice(0, 5)`
 * (mosaic + JSON-LD ImageObject), this is exactly the TOP 5 a visitor and
 * an LLM see first.
 *
 * Idempotent — re-running on an already-curated gallery is a no-op.
 *
 * Eligibility (default): published hotels with a non-empty gallery. Use
 * `--require-scores` to skip hotels whose photos have NO `representativeness`
 * yet (i.e. run `photos:categorize` on them first); without the flag the
 * ranking gracefully degrades to `quality_score`-only ordering.
 *
 * Requires Supabase service role (NEXT_PUBLIC_SUPABASE_URL + key). No
 * OpenAI / Cloudinary keys needed.
 *
 * CLI
 * ---
 *   pnpm photos:curate --dry-run --limit=4
 *   pnpm photos:curate --slug=le-bristol-paris
 *   pnpm photos:curate --slugs=le-bristol-paris,le-meurice --concurrency=3
 *   pnpm photos:curate --require-scores
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadPhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';
import { orderGallery, type GalleryImage } from './gallery-coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '../..', 'runs');
const OUT_DIR = resolve(__dirname, '../..', 'out');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

interface Args {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeDrafts: boolean;
  readonly requireScores: boolean;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const num = (k: string): number | undefined => {
    const v = map.get(k);
    return typeof v === 'string' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  const concRaw = num('concurrency');
  const limitRaw = num('limit');
  const slugRaw = map.get('slug');
  const slugsRaw = map.get('slugs');
  const out: Args = {
    dryRun: map.has('dry-run'),
    includeDrafts: map.has('include-drafts'),
    requireScores: map.has('require-scores'),
    concurrency: concRaw !== undefined ? Math.min(6, Math.max(1, concRaw)) : 3,
    ...(typeof slugRaw === 'string' ? { slug: slugRaw } : {}),
    ...(limitRaw !== undefined ? { limit: limitRaw } : {}),
  };
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) return { ...out, slugs: list };
  }
  return out;
}

function printHelp(): void {
  console.log(`Usage: pnpm photos:curate [options]

Options
-------
  --slug=<hotel-slug>   Only curate one specific hotel
  --slugs=a,b,c         Curate a comma-separated list of hotels
  --limit=N             Cap hotels processed
  --concurrency=N       Parallel hotels (default 3; max 6)
  --include-drafts      Also curate unpublished hotels
  --require-scores      Skip hotels whose photos have no representativeness yet
  --dry-run             Compute the ordering but skip the Supabase write
  --help                Show this message

Examples
--------
  pnpm photos:curate --dry-run --limit=4
  pnpm photos:curate --slug=le-bristol-paris
  pnpm photos:curate --slugs=le-bristol-paris,le-meurice --concurrency=3`);
}

// ---------------------------------------------------------------------------
// Hotel rows
// ---------------------------------------------------------------------------

interface HotelPhotoRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly hero_image: string | null;
  readonly gallery_images: readonly GalleryImage[] | null;
}

/** True when at least one gallery photo carries a representativeness score. */
function hasRepresentativeness(gallery: readonly GalleryImage[]): boolean {
  return gallery.some((img) => typeof img.representativeness === 'number');
}

// ---------------------------------------------------------------------------
// Runlog (JSONL — resumable / auditable, like sync-hotel-photos.ts)
// ---------------------------------------------------------------------------

interface RunlogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'noop' | 'fail';
  readonly heroBefore?: string | null;
  readonly heroAfter?: string | null;
  readonly galleryCount?: number;
  readonly reason?: string;
}

function ensureRunlog(): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(OUT_DIR, `curate-top-photos-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Per-hotel curation
// ---------------------------------------------------------------------------

interface PerHotelResult {
  readonly slug: string;
  readonly name: string;
  readonly outcome: 'ok' | 'skip' | 'noop' | 'fail';
  readonly heroBefore: string | null;
  readonly heroAfter: string | null;
  readonly galleryCount: number;
  readonly top5: readonly string[];
  readonly reason?: string;
}

/** Hero + the first 4 gallery entries = exactly what the fiche surfaces first. */
function top5Of(heroAfter: string | null, gallery: readonly GalleryImage[]): readonly string[] {
  const tiles = gallery.slice(0, 4).map((img) => img.public_id);
  return heroAfter !== null ? [heroAfter, ...tiles] : tiles;
}

/**
 * Fold the current hero back into the photo pool so the selection can
 * re-rank ALL photos (the hero lives in its own `hero_image` column, so a
 * gallery-only pass would silently lose it or never reconsider it). The
 * old hero carries no Vision metadata (the categorize pass only scores
 * `gallery_images`), so it competes at `combinedScore` 0 — which is the
 * desired behaviour: a scored, emblematic gallery shot should out-rank an
 * unscored legacy hero. No photo is dropped, only re-ordered.
 */
function combinePool(
  hero: string | null,
  gallery: readonly GalleryImage[],
): readonly GalleryImage[] {
  if (hero === null) return gallery;
  if (gallery.some((img) => img.public_id === hero)) return gallery;
  return [{ public_id: hero }, ...gallery];
}

async function curateHotel(
  cfg: SupabaseRestConfig,
  row: HotelPhotoRow,
  args: Args,
): Promise<PerHotelResult> {
  const gallery = row.gallery_images ?? [];
  const base = { slug: row.slug, name: row.name, heroBefore: row.hero_image };

  if (gallery.length === 0) {
    return {
      ...base,
      outcome: 'skip',
      heroAfter: row.hero_image,
      galleryCount: 0,
      top5: [],
      reason: 'empty gallery',
    };
  }

  if (args.requireScores && !hasRepresentativeness(gallery)) {
    return {
      ...base,
      outcome: 'skip',
      heroAfter: row.hero_image,
      galleryCount: gallery.length,
      top5: [],
      reason: 'no representativeness scores (run photos:categorize first)',
    };
  }

  const pool = combinePool(row.hero_image, gallery);
  const { heroPublicId, orderedGallery } = orderGallery(pool);
  const top5 = top5Of(heroPublicId, orderedGallery);

  // No-op when the hero AND the gallery order are already what we'd write.
  // `orderedGallery` excludes the (re)selected hero, so when the hero is
  // unchanged it holds exactly the original gallery's photos — compare
  // position-by-position.
  const sameHero = (row.hero_image ?? null) === heroPublicId;
  const sameOrder =
    gallery.length === orderedGallery.length &&
    gallery.every((img, i) => img.public_id === orderedGallery[i]?.public_id);
  if (sameHero && sameOrder) {
    return {
      ...base,
      outcome: 'noop',
      heroAfter: heroPublicId,
      galleryCount: orderedGallery.length,
      top5,
    };
  }

  if (!args.dryRun) {
    await patchHotelById(cfg, row.id, {
      hero_image: heroPublicId,
      gallery_images: orderedGallery,
    });
  }

  return {
    ...base,
    outcome: 'ok',
    heroAfter: heroPublicId,
    galleryCount: orderedGallery.length,
    top5,
  };
}

// ---------------------------------------------------------------------------
// Concurrency pool (mirrors categorize-with-vision.ts)
// ---------------------------------------------------------------------------

function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  return new Promise((resolveAll, rejectAll) => {
    const launchNext = (): void => {
      const myIndex = cursor++;
      if (myIndex >= total) return;
      const item = items[myIndex];
      if (item === undefined) return;
      fn(item, myIndex)
        .then((res) => {
          results[myIndex] = res;
          done++;
          if (onProgress) onProgress(done, total, res);
          if (done === total) resolveAll(results);
          else launchNext();
        })
        .catch(rejectAll);
    };
    if (total === 0) resolveAll([]);
    else for (let i = 0; i < Math.min(limit, total); i++) launchNext();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();

  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[curate] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} requireScores=${args.requireScores}`,
  );

  const filters: string[] = [];
  if (!args.includeDrafts) filters.push('is_published=eq.true');
  if (args.slug !== undefined) filters.push(`slug=eq.${encodeURIComponent(args.slug)}`);
  if (args.slugs !== undefined) {
    filters.push(`slug=in.(${args.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  }
  filters.push('gallery_images=not.is.null');

  const rows = await selectHotels<HotelPhotoRow>(cfg, {
    columns: 'id,slug,name,hero_image,gallery_images',
    filters,
    order: 'slug.asc',
  });

  const eligible = rows.filter((r) => (r.gallery_images ?? []).length > 0);
  const targets = args.limit !== undefined ? eligible.slice(0, args.limit) : eligible;

  console.log(
    `[curate] fetched=${rows.length} eligible=${eligible.length} processing=${targets.length}`,
  );
  if (targets.length === 0) {
    console.log('[curate] nothing to do.');
    return;
  }

  const runlogPath = ensureRunlog();
  console.log(`[curate] runlog: ${runlogPath}`);

  const startedAt = Date.now();
  const results = await withConcurrency(
    targets,
    args.concurrency,
    async (row) => {
      try {
        return await curateHotel(cfg, row, args);
      } catch (err) {
        return {
          slug: row.slug,
          name: row.name,
          outcome: 'fail' as const,
          heroBefore: row.hero_image,
          heroAfter: row.hero_image,
          galleryCount: (row.gallery_images ?? []).length,
          top5: [],
          reason: (err as Error).message.slice(0, 200),
        };
      }
    },
    (doneCount, total, last) => {
      const status =
        last.outcome === 'fail'
          ? `FAIL: ${last.reason ?? ''}`
          : last.outcome === 'skip'
            ? `SKIP (${last.reason ?? ''})`
            : last.outcome === 'noop'
              ? 'noop (already optimal)'
              : `hero ${last.heroBefore ?? '∅'} → ${last.heroAfter ?? '∅'} | top5=${last.top5.join(', ')}`;
      console.log(`[curate] ${doneCount}/${total} ${last.slug} → ${status}`);
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: last.slug,
        outcome: last.outcome,
        heroBefore: last.heroBefore,
        heroAfter: last.heroAfter,
        galleryCount: last.galleryCount,
        ...(last.reason !== undefined ? { reason: last.reason } : {}),
      });
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.outcome === 'ok').length;
  const noopCount = results.filter((r) => r.outcome === 'noop').length;
  const skipCount = results.filter((r) => r.outcome === 'skip').length;
  const failCount = results.filter((r) => r.outcome === 'fail').length;

  console.log('---');
  console.log(`[curate] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`[curate] ok=${okCount} noop=${noopCount} skip=${skipCount} fail=${failCount}`);

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `curate-top-photos-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      { startedAt: new Date(startedAt).toISOString(), elapsedMs, dryRun: args.dryRun, results },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[curate] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[curate] FATAL', err);
  process.exit(1);
});
