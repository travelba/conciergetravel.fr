/**
 * Zero-photo / null-hero backfill orchestrator.
 *
 * Closes the single largest visual gap in the catalogue: published hotels
 * that have **no hero AND an empty gallery** (`hero_image IS NULL` and
 * `gallery_images` null/empty). Those render a broken `og:image`, no LCP
 * hero, and a bare fiche.
 *
 * Strategy (reuses the canonical Tier-B APPEND pipeline — never the
 * destructive `sync-hotel-photos` overwrite, see photo-pipeline SKILL
 * §"Tier B backfill: APPEND … never sync overwrite"):
 *
 *   1. Derive the live target from the DB each pass (a hotel that already
 *      received photos drops out automatically — the DB is the checkpoint).
 *   2. Partition the target across N disjoint workers by a STABLE slug hash
 *      (so resuming / running multiple workers never re-shuffles owners).
 *   3. Exclude slugs already attempted (tracked in a per-worker checkpoint
 *      file) so the irreducible 0-Google-Places residual is not retried
 *      forever.
 *   4. For each sub-chunk: spawn `gen-places-discovery` (Google Places →
 *      discovery JSON), then `upload-press-kit-images` (OpenAI Vision curate
 *      → Cloudinary `cct/hotels/<slug>/press-N` → APPEND gallery + promote
 *      hero). Both persist per-hotel, so a crash loses at most the
 *      in-flight sub-chunk.
 *   5. Verify each sub-chunk against the DB (gallery length + hero) and
 *      append the result to the checkpoint.
 *
 * Guardrails are all enforced downstream by the reused scripts: Google
 * Places URLs are on `lh3.googleusercontent.com` (globally whitelisted),
 * the upload source filter is safe-by-default, Vision emits alt_fr+alt_en
 * (Hard Rule 16), width/height come from the Cloudinary response, and only
 * `cct/hotels/...` public_ids ever land in the DB (no supplier hotlink).
 *
 * CLI
 *   # single worker, whole target, live:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/run-zero-photo-backfill.ts --worker=0 --workers=1
 *
 *   # 3 disjoint parallel workers (launch each in its own terminal):
 *   ... run-zero-photo-backfill.ts --worker=0 --workers=3
 *   ... run-zero-photo-backfill.ts --worker=1 --workers=3
 *   ... run-zero-photo-backfill.ts --worker=2 --workers=3
 *
 *   # smoke test (no Cloudinary upload, no DB write):
 *   ... run-zero-photo-backfill.ts --worker=0 --workers=1 --max-hotels=3 --dry-run
 *
 * Flags
 *   --worker=<n>       this worker's id (0-based). Default 0.
 *   --workers=<n>      total worker count for the stable partition. Default 1.
 *   --chunk=<n>        hotels per spawn cycle. Default 10.
 *   --per-hotel=<n>    Google Places photos fetched per hotel. Default 14.
 *   --limit=<n>        max photos uploaded per hotel. Default 8.
 *   --max-hotels=<n>   stop after processing N hotels this run (smoke/test).
 *   --dry-run          pass --dry-run to the upload step (no upload, no write).
 *
 * Skills: photo-pipeline, photo-quality-seo-geo-agentique, api-integration,
 *         windows-dev-environment (disjoint-worker discipline)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPhotoEnv } from './env-photos.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '..', '..', 'runs');

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly worker: number;
  readonly workers: number;
  readonly chunk: number;
  readonly perHotel: number;
  readonly limit: number;
  readonly maxHotels: number | null;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let worker = 0;
  let workers = 1;
  let chunk = 10;
  let perHotel = 14;
  let limit = 8;
  let maxHotels: number | null = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--worker='))
      worker = Number.parseInt(arg.slice('--worker='.length), 10);
    else if (arg.startsWith('--workers='))
      workers = Number.parseInt(arg.slice('--workers='.length), 10);
    else if (arg.startsWith('--chunk=')) chunk = Number.parseInt(arg.slice('--chunk='.length), 10);
    else if (arg.startsWith('--per-hotel='))
      perHotel = Number.parseInt(arg.slice('--per-hotel='.length), 10);
    else if (arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--max-hotels='))
      maxHotels = Number.parseInt(arg.slice('--max-hotels='.length), 10);
  }
  if (!Number.isFinite(worker) || worker < 0) worker = 0;
  if (!Number.isFinite(workers) || workers < 1) workers = 1;
  if (worker >= workers) throw new Error(`--worker (${worker}) must be < --workers (${workers})`);
  if (!Number.isFinite(chunk) || chunk < 1) chunk = 10;
  if (!Number.isFinite(perHotel) || perHotel < 1) perHotel = 14;
  if (!Number.isFinite(limit) || limit < 1) limit = 8;
  return { worker, workers, chunk, perHotel, limit, maxHotels, dryRun };
}

// ─── Stable partition ──────────────────────────────────────────────────────

/** Deterministic FNV-1a hash → stable worker assignment regardless of order. */
function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ─── Supabase target derivation + verification ───────────────────────────────

interface TargetRow {
  readonly slug: string;
  readonly galleryCount: number;
  readonly hasHero: boolean;
}

interface RawRow {
  readonly slug: unknown;
  readonly hero_image: unknown;
  readonly gallery_images: unknown;
}

function galleryLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Live target: published, no hero, empty gallery. */
async function loadTarget(cfg: SupabaseRestConfig): Promise<TargetRow[]> {
  const raws = await selectHotels<RawRow>(cfg, {
    columns: 'slug,hero_image,gallery_images',
    filters: ['is_published=eq.true', 'hero_image=is.null'],
    order: 'slug.asc',
  });
  return raws
    .map((r) => ({
      slug: String(r.slug),
      galleryCount: galleryLen(r.gallery_images),
      hasHero: typeof r.hero_image === 'string' && r.hero_image.length > 0,
    }))
    .filter((r) => !r.hasHero && r.galleryCount === 0);
}

/** Verify a set of slugs against the DB (post-upload). */
async function verifySlugs(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<Map<string, { galleryCount: number; hasHero: boolean }>> {
  const out = new Map<string, { galleryCount: number; hasHero: boolean }>();
  if (slugs.length === 0) return out;
  const inFilter = `slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
  const raws = await selectHotels<RawRow>(cfg, {
    columns: 'slug,hero_image,gallery_images',
    filters: [inFilter],
    limit: slugs.length,
  });
  for (const r of raws) {
    out.set(String(r.slug), {
      galleryCount: galleryLen(r.gallery_images),
      hasHero: typeof r.hero_image === 'string' && r.hero_image.length > 0,
    });
  }
  return out;
}

// ─── Checkpoint ──────────────────────────────────────────────────────────────

interface CheckpointEntry {
  readonly galleryCount: number;
  readonly hasHero: boolean;
  readonly ts: string;
}

interface Checkpoint {
  worker: number;
  workers: number;
  startedAt: string;
  updatedAt: string;
  attempted: Record<string, CheckpointEntry>;
}

function checkpointPath(worker: number): string {
  return resolve(RUNS_DIR, `zero-photo-backfill-checkpoint-w${worker}.json`);
}

function loadCheckpoint(args: CliArgs): Checkpoint {
  const path = checkpointPath(args.worker);
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Checkpoint;
      if (parsed && typeof parsed.attempted === 'object') return parsed;
    } catch {
      /* fall through to fresh */
    }
  }
  const now = new Date().toISOString();
  return {
    worker: args.worker,
    workers: args.workers,
    startedAt: now,
    updatedAt: now,
    attempted: {},
  };
}

function saveCheckpoint(cp: Checkpoint): void {
  cp.updatedAt = new Date().toISOString();
  writeFileSync(checkpointPath(cp.worker), JSON.stringify(cp, null, 2), 'utf8');
}

// ─── Child process spawn ──────────────────────────────────────────────────────

function runChild(scriptRel: string, args: readonly string[]): Promise<number> {
  return new Promise((resolveExit) => {
    const cmd = ['exec', 'tsx', scriptRel, ...args];
    const child = spawn('pnpm', cmd, {
      cwd: resolve(__dirname, '..', '..'),
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', (err) => {
      console.error(`[orchestrator] spawn error for ${scriptRel}:`, err);
      resolveExit(1);
    });
  });
}

/** Detect discovery files for `slug` newer than `sinceMs`. */
function hasFreshDiscovery(slug: string, sinceMs: number): boolean {
  let files: string[];
  try {
    files = readdirSync(RUNS_DIR);
  } catch {
    return false;
  }
  const prefix = `press-kit-discovery-${slug}-`;
  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith('.json')) continue;
    try {
      if (statSync(resolve(RUNS_DIR, f)).mtimeMs >= sinceMs - 1000) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  mkdirSync(RUNS_DIR, { recursive: true });
  const cp = loadCheckpoint(args);

  console.log(`[orchestrator] worker ${args.worker}/${args.workers} — deriving target from DB…`);
  const target = await loadTarget(cfg);
  const mine = target.filter((t) => slugHash(t.slug) % args.workers === args.worker);
  const pending = mine.filter((t) => cp.attempted[t.slug] === undefined).map((t) => t.slug);

  console.log(
    `[orchestrator] target(global)=${target.length}  mine(partition ${args.worker}/${args.workers})=${mine.length}  ` +
      `alreadyAttempted=${mine.length - pending.length}  pending=${pending.length}`,
  );

  const cappedPending = args.maxHotels !== null ? pending.slice(0, args.maxHotels) : pending;
  const chunks = chunkArray(cappedPending, args.chunk);

  let processed = 0;
  let withPhotos = 0;
  let heroDerived = 0;
  let empty = 0;

  for (const [ci, slugs] of chunks.entries()) {
    const sinceMs = Date.now();
    console.log(
      `\n[orchestrator] ===== chunk ${ci + 1}/${chunks.length} (${slugs.length} hotels) =====\n` +
        `  ${slugs.join(', ')}`,
    );

    // 1. Google Places discovery → JSON.
    await runChild('src/photos/gen-places-discovery.ts', [
      `--slugs=${slugs.join(',')}`,
      `--per-hotel=${args.perHotel}`,
    ]);

    // 2. Split: slugs that produced a fresh discovery file → upload; others → empty.
    const withFiles = slugs.filter((s) => hasFreshDiscovery(s, sinceMs));
    const noFiles = slugs.filter((s) => !withFiles.includes(s));
    for (const s of noFiles) {
      cp.attempted[s] = { galleryCount: 0, hasHero: false, ts: new Date().toISOString() };
      empty += 1;
      processed += 1;
    }
    if (noFiles.length > 0) {
      console.log(
        `  [orchestrator] ${noFiles.length} hotel(s) with 0 Google Places photos: ${noFiles.join(', ')}`,
      );
    }

    // 3. Vision-curated upload + APPEND + hero promote.
    if (withFiles.length > 0) {
      const uploadArgs = [
        '--discovery-dir=runs',
        `--slugs=${withFiles.join(',')}`,
        `--limit=${args.limit}`,
      ];
      if (args.dryRun) uploadArgs.push('--dry-run');
      await runChild('src/photos/upload-press-kit-images.ts', uploadArgs);
    }

    // 4. Verify against the DB + checkpoint.
    if (!args.dryRun && withFiles.length > 0) {
      const verified = await verifySlugs(cfg, withFiles);
      for (const s of withFiles) {
        const v = verified.get(s) ?? { galleryCount: 0, hasHero: false };
        cp.attempted[s] = {
          galleryCount: v.galleryCount,
          hasHero: v.hasHero,
          ts: new Date().toISOString(),
        };
        processed += 1;
        if (v.galleryCount > 0) withPhotos += 1;
        else empty += 1;
        if (v.hasHero) heroDerived += 1;
      }
    } else if (args.dryRun) {
      for (const s of withFiles) {
        cp.attempted[s] = { galleryCount: -1, hasHero: false, ts: new Date().toISOString() };
        processed += 1;
      }
    }

    saveCheckpoint(cp);
    console.log(
      `[orchestrator] checkpoint saved — processed=${processed} withPhotos=${withPhotos} ` +
        `heroDerived=${heroDerived} empty=${empty}`,
    );
  }

  console.log(
    `\n[orchestrator] DONE worker ${args.worker}/${args.workers}\n` +
      `  processed=${processed}  withPhotos=${withPhotos}  heroDerived=${heroDerived}  emptyResidual=${empty}`,
  );
}

void main().catch((e: unknown) => {
  console.error(`[orchestrator] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
