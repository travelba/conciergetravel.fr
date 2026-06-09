/**
 * Press-kit image upload — phase 2 of the discovery → upload pipeline.
 *
 * Reads the JSON output of `discover-press-kit-images.ts`, applies a
 * per-slug **hostname whitelist** to drop the noise (boutique pages,
 * tier-3 magazines, OTA CDNs), then for each surviving URL:
 *   1. Calls OpenAI Vision (gpt-4o-mini) for category + alt FR/EN +
 *      caption FR/EN + quality_score (1-10). See
 *      `photo-quality-seo-geo-agentique` SKILL.
 *   2. Uploads to Cloudinary via the shared `uploadFromUrl` helper at
 *      public_id `cct/hotels/<slug>/press-<N>` (idempotent —
 *      re-running overwrites the same public_id, not duplicates).
 *   3. Appends the row to `hotels.gallery_images` (jsonb), preserving
 *      existing entries.
 *
 * If a hotel currently has no `hero_image`, the first uploaded photo
 * (sorted by quality_score desc, then by category preference) is also
 * promoted to `hero_image`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/upload-press-kit-images.ts \
 *     --discovery=runs/press-kit-discovery-le-bristol-paris-<ts>.json \
 *     --limit=12
 *
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/upload-press-kit-images.ts \
 *     --discovery-dir=runs \
 *     --slugs=le-bristol-paris,akelarre,al-moudira,alila-jabal-akhdar \
 *     --limit=12 --dry-run
 *
 * Skills: photo-pipeline, photo-quality-seo-geo-agentique,
 *         api-integration, llm-output-robustness
 */

import { readFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  configureCloudinary,
  uploadFromUrl,
  type CloudinaryUploadInput,
} from '@mch/integrations/cloudinary';

import { loadEnv } from '../env.js';
import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import {
  isBlocklistedHostname,
  isWhitelistedHostname,
  trustedDomainsForHotel,
} from './parent-group-mapping.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── CLI parsing ───────────────────────────────────────────────────────────

interface CliArgs {
  readonly discoveryFiles: readonly string[];
  readonly limitPerHotel: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let discoveryFile: string | null = null;
  let discoveryDir: string | null = null;
  let slugs: readonly string[] = [];
  let limitPerHotel = 12;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--discovery=')) discoveryFile = arg.slice('--discovery='.length);
    else if (arg.startsWith('--discovery-dir='))
      discoveryDir = arg.slice('--discovery-dir='.length);
    else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--limit=')) {
      limitPerHotel = Number.parseInt(arg.slice('--limit='.length), 10);
    }
  }

  let discoveryFiles: string[] = [];
  if (discoveryFile) {
    discoveryFiles = [resolve(discoveryFile)];
  } else if (discoveryDir) {
    const dir = resolve(discoveryDir);
    const all = readdirSync(dir).filter(
      (f) => f.startsWith('press-kit-discovery-') && f.endsWith('.json'),
    );
    if (slugs.length > 0) {
      // Latest file per slug.
      const bySlug = new Map<string, string>();
      for (const f of all.sort()) {
        for (const s of slugs) {
          if (f.startsWith(`press-kit-discovery-${s}-`)) {
            bySlug.set(s, f); // last one wins (sort asc → latest timestamp)
          }
        }
      }
      discoveryFiles = [...bySlug.values()].map((f) => resolve(dir, f));
    } else {
      discoveryFiles = all.map((f) => resolve(dir, f));
    }
  } else {
    throw new Error('[upload-press-kit] Pass --discovery=<file> or --discovery-dir=<dir>');
  }

  if (discoveryFiles.length === 0) {
    throw new Error('[upload-press-kit] No discovery file matched');
  }

  return { discoveryFiles, limitPerHotel, dryRun };
}

// ─── Discovery JSON schema (must match writer in discover-press-kit-images.ts) ─

const DiscoveryImageSchema = z.object({
  url: z.string().url(),
  description: z.string().nullable(),
  fromQueries: z.array(z.string()),
  hostname: z.string(),
  extension: z.string().nullable(),
});

const DiscoveryReportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  officialUrl: z.string().nullable(),
  inferredDomain: z.string().nullable(),
  currentGalleryCount: z.number(),
  totalUniqueImages: z.number(),
  images: z.array(DiscoveryImageSchema),
});

type DiscoveryReport = z.infer<typeof DiscoveryReportSchema>;
type DiscoveryImage = z.infer<typeof DiscoveryImageSchema>;

function readDiscoveryFile(path: string): DiscoveryReport {
  const raw = readFileSync(path, 'utf-8');
  const parsed = DiscoveryReportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `[upload-press-kit] Invalid discovery JSON at ${path}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

// ─── Per-slug hostname whitelist (optional ADD-ON, never the only gate) ─────

/**
 * Per-slug CDN hints. These are EXTRA allowances for hotels whose
 * legitimate press-kit CDN isn't covered by `trustedDomainsForHotel`
 * (own domain + parent-group DAM) nor by `HOSTNAME_WHITELIST_GLOBAL`.
 *
 * IMPORTANT: unlike the previous design, an empty/absent entry does
 * NOT mean "pass everything". The source filter below is
 * **safe-by-default** — a hotel with no per-slug hint still only
 * accepts images on its trusted domains or a globally-trusted CDN.
 */
const SLUG_EXTRA_ALLOWED_HOSTS: Readonly<Record<string, readonly string[]>> = {
  // Oetker Collection → Contentful CDN
  'le-bristol-paris': ['images.eu.ctfassets.net'],
  // Akelarre own WordPress + R&C CDN
  akelarre: ['akelarre.net', 'storage.googleapis.com/webimages-p1shrd'],
  // Wix CDN (moudira.com is built on Wix)
  'al-moudira': ['static.wixstatic.com'],
  // Hyatt corporate DAM
  'alila-jabal-akhdar': ['assets.hyatt.com'],
  // Fawn Bluff's brand site (fawnbluff.com) differs from its `official_url`
  // parent path (flospitality.com/fawnbluff). Both are legitimate.
  'fawn-bluff-private-lodge': ['fawnbluff.com'],
  // Fairmont properties whose own brand site differs from the
  // `fairmont.com/<city>` parent path. Both are official Accor-operated
  // domains (added during the 2026-06-08 press-kit pilot — these carried
  // the bulk of the usable imagery: 9 and 3 candidates respectively).
  'fairmont-jasper-park-lodge': ['jasper-park-lodge.com'],
  'fairmont-royal-york': ['thefairmontroyalyork.com'],
};

/**
 * Safe-by-default source filter. An image is accepted ONLY when it is
 * not blocklisted AND it comes from a domain we trust for this hotel.
 *
 * Why this replaced the old pass-through default (2026-05-31): the
 * previous `passesWhitelist` returned `true` for any slug missing a
 * hardcoded entry — so a non-tuned hotel (the 99% case for a
 * catalogue-wide B2 sourcing run) would happily upload Instagram,
 * Condé Nast, Telegraph, agency-CDN images to Cloudinary, violating
 * the photo-quality hard rule. The blocklist + trusted-domain resolver
 * already exist in `parent-group-mapping.ts`; this wires them in so
 * the filter is correct for EVERY slug, tuned or not.
 *
 * Three checks, in order:
 *   1. Reject if the hostname OR the full URL matches the global
 *      blocklist (catches `cdn-xxx.nitrocdn.com/...cdninstagram.com/...`
 *      proxies where the blocked term is in the PATH, not the host).
 *   2. Accept if the host/URL is on a trusted domain for this hotel
 *      (own official domain + parent-group DAM) — URL substring match
 *      so a NitroPack/Cloudflare proxy of the official site's own
 *      `wp-content/uploads` still passes.
 *   3. Accept if the host is a globally-trusted CDN (Contentful, S3,
 *      Cloudfront, parent-group DAMs…) or an explicit per-slug hint.
 * Otherwise reject.
 */
function passesSourceFilter(
  slug: string,
  img: DiscoveryImage,
  trustedDomains: readonly string[],
): boolean {
  const url = img.url.toLowerCase();
  const host = img.hostname.toLowerCase();

  // 1. Hard blocklist — check both hostname and full URL.
  if (isBlocklistedHostname(host)) return false;
  if (isBlocklistedHostname(url)) return false;

  // 2. Trusted domains for this specific hotel (own + parent group).
  if (
    trustedDomains.some(
      (d) => host === d || host.endsWith(`.${d}`) || url.includes(`/${d}/`) || url.includes(d),
    )
  ) {
    return true;
  }

  // 3. Globally-trusted CDNs + per-slug extra hints.
  if (isWhitelistedHostname(host)) return true;
  const extra = SLUG_EXTRA_ALLOWED_HOSTS[slug];
  if (extra && extra.some((e) => host.includes(e.toLowerCase()) || url.includes(e.toLowerCase()))) {
    return true;
  }

  return false;
}

// ─── OpenAI Vision (categorize + alt + caption + quality) ──────────────────

/**
 * Categories follow the project's `gallery_images.category` enum
 * (see `.cursor/rules/photo-quality.mdc`).
 */
const CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'bathroom',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
  'gym',
] as const;

const VisionResponseSchema = z.object({
  category: z.enum(CATEGORIES),
  alt_fr: z.string().min(10).max(120),
  alt_en: z.string().min(10).max(120),
  caption_fr: z.string().min(20).max(200),
  caption_en: z.string().min(20).max(200),
  quality_score: z.number().int().min(1).max(10),
  keep: z.boolean(),
});

type VisionResponse = z.infer<typeof VisionResponseSchema>;

interface VisionContext {
  readonly hotelName: string;
  readonly city: string;
  readonly tavilyHint: string | null;
}

/**
 * Fetch an image URL and return it as a base64 data URI suitable for
 * OpenAI Vision. We do this ourselves because:
 *   1. Some hotel CDNs (notably `assets.hyatt.com`) hotlink-protect
 *      against OpenAI's egress (`Error while downloading`).
 *   2. We can pass a UA + Accept header that gets through 99% of
 *      bot defences.
 * Capped at 5 MB to keep the Vision payload reasonable (Vision accepts
 * up to 20 MB but we don't need full-res for category extraction).
 */
async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'MyConciergeHotelBot/1.0 (+https://myconciergehotel.com; contact: tech@myconciergehotel.com)',
      Accept: 'image/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`fetch source ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error('empty source body');
  if (buf.byteLength > 5 * 1024 * 1024) {
    throw new Error(`source too large for vision pass: ${buf.byteLength} bytes`);
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

async function visionAnalyse(imageUrl: string, ctx: VisionContext): Promise<VisionResponse> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error('[upload-press-kit] OPENAI_API_KEY required for Vision pass');
  }

  const hintLine =
    ctx.tavilyHint && ctx.tavilyHint.length > 0
      ? `Tavily hint: "${ctx.tavilyHint.slice(0, 200)}"`
      : 'No Tavily hint.';

  const prompt = `You are a luxury hotel content editor cataloguing photos for ${ctx.hotelName} in ${ctx.city}.

${hintLine}

Analyse the image and return STRICT JSON matching this schema:
{
  "category": one of: ${CATEGORIES.join(', ')},
  "alt_fr": 10-100 chars, format "[Adjectif] [Hôtel] [Ville]" — must include hotel name + city,
  "alt_en": 10-100 chars, same format in English,
  "caption_fr": 20-140 chars, complete sentence describing the scene (FR),
  "caption_en": 20-140 chars, complete sentence in English,
  "quality_score": integer 1-10 (10 = magazine cover quality, 1 = blurry/wrong),
  "keep": true if the image is publishable on a luxury hotel page, false if it shows a person's face, is blurry, is a product (clothing, mug, poster), or is irrelevant to the hotel
}

Be strict on "keep": refuse logos, product close-ups, magazine covers, photos with identifiable client faces.
Examples of good alt:
  - "Façade Hôtel Le Bristol Paris 8e"
  - "Suite Mountain View Alila Jabal Akhdar"

Reply with ONLY the JSON object, no markdown, no preamble.`;

  // Fetch the image ourselves and pass it as base64 — some hotel CDNs
  // hotlink-block OpenAI's egress. Falls back to raw URL on small CDNs
  // that won't accept our UA (rare).
  let imagePayloadUrl: string;
  try {
    imagePayloadUrl = await fetchAsDataUri(imageUrl);
  } catch (e) {
    // Best-effort fallback: try the bare URL — OpenAI may still get it.
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`    [vision-fetch-fail] ${msg} — falling back to URL`);
    imagePayloadUrl = imageUrl;
  }

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imagePayloadUrl, detail: 'low' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 400,
  };

  // Retry with back-off on transient rate limits (429) and 5xx. Freshly
  // funded OpenAI accounts sit on a low usage tier, so Vision bursts
  // trip the per-minute cap; honour `Retry-After` when present, else
  // exponential back-off. A non-retryable error (400 unsupported image,
  // 401 bad key) throws immediately.
  const MAX_ATTEMPTS = 6;
  let res: Response | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) break;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      const t = await res.text();
      throw new Error(`[upload-press-kit] OpenAI ${res.status}: ${t.slice(0, 300)}`);
    }
    const retryAfterHeader = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
    const backoffMs = Number.isFinite(retryAfterHeader)
      ? Math.min(retryAfterHeader * 1000, 20000)
      : Math.min(1500 * 2 ** (attempt - 1), 20000);
    await res.text().catch(() => undefined);
    await sleep(backoffMs);
  }
  if (!res) {
    throw new Error('[upload-press-kit] OpenAI request never executed');
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('[upload-press-kit] OpenAI returned no content');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error(`[upload-press-kit] OpenAI returned non-JSON: ${content.slice(0, 200)}`);
  }

  const validated = VisionResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `[upload-press-kit] Vision schema violation: ${validated.error.issues
        .map((i) => `${i.path.join('.')}=${i.message}`)
        .join('; ')}`,
    );
  }
  return validated.data;
}

// ─── Supabase helpers ──────────────────────────────────────────────────────

interface HotelDbRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly hero_image: string | null;
  readonly official_url: string | null;
  readonly luxury_tier: string | null;
  readonly gallery_images: ReadonlyArray<Record<string, unknown>>;
}

interface RawHotelDbRow {
  readonly id: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly hero_image: unknown;
  readonly official_url: unknown;
  readonly luxury_tier: unknown;
  readonly gallery_images: unknown;
}

async function fetchHotelRow(cfg: SupabaseRestConfig, slug: string): Promise<HotelDbRow> {
  const raws = await selectHotels<RawHotelDbRow>(cfg, {
    columns: 'id,slug,name,city,hero_image,official_url,luxury_tier,gallery_images',
    filters: [`slug=eq.${encodeURIComponent(slug)}`],
    limit: 1,
  });
  if (raws.length === 0) {
    throw new Error(`[upload-press-kit] Hotel not found: ${slug}`);
  }
  const row = raws[0]!;
  const gallery = Array.isArray(row.gallery_images)
    ? (row.gallery_images as Array<Record<string, unknown>>)
    : [];
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    city: typeof row.city === 'string' ? row.city : '',
    hero_image: typeof row.hero_image === 'string' ? row.hero_image : null,
    official_url: typeof row.official_url === 'string' ? row.official_url : null,
    luxury_tier: typeof row.luxury_tier === 'string' ? row.luxury_tier : null,
    gallery_images: gallery,
  };
}

// ─── Upload pipeline ───────────────────────────────────────────────────────

interface PerHotelOutcome {
  readonly slug: string;
  readonly uploaded: number;
  readonly skipped: number;
  readonly errors: number;
  readonly heroPromoted: boolean;
}

interface PerImageOutcome {
  readonly url: string;
  readonly status: 'uploaded' | 'skipped' | 'failed';
  readonly publicId?: string;
  readonly category?: string;
  readonly qualityScore?: number;
  readonly reason?: string;
}

async function processHotel(
  report: DiscoveryReport,
  supabaseCfg: SupabaseRestConfig,
  limit: number,
  dryRun: boolean,
  runLogPath: string,
): Promise<PerHotelOutcome> {
  const slug = report.slug;
  console.log(`\n[${slug}] (${report.name})`);

  const dbRow = await fetchHotelRow(supabaseCfg, slug);

  // Safe-by-default source filter scoped to THIS hotel's trusted
  // domains (own official domain + parent-group DAM). Prefer the DB
  // `official_url` (authoritative) but fall back to the discovery
  // report's copy.
  const trustedDomains = trustedDomainsForHotel({
    slug,
    officialUrl: dbRow.official_url ?? report.officialUrl,
    luxuryTier: dbRow.luxury_tier,
  });
  const filtered = report.images.filter((img) => passesSourceFilter(slug, img, trustedDomains));
  console.log(
    `  ${report.images.length} candidates → ${filtered.length} after source filter ` +
      `(trusted: ${trustedDomains.length > 0 ? trustedDomains.join(', ') : 'none'}; limit ${limit})`,
  );

  if (filtered.length === 0) {
    console.warn(
      `  [WARN] no images survived the source filter — all candidates were blocklisted or off-domain`,
    );
    return { slug, uploaded: 0, skipped: 0, errors: 0, heroPromoted: false };
  }

  const existingPublicIds = new Set(
    dbRow.gallery_images
      .map((row) => row['public_id'])
      .filter((id): id is string => typeof id === 'string'),
  );

  // Choose the next press index so we never collide with existing entries.
  let pressIndex = 1;
  while (existingPublicIds.has(`cct/hotels/${slug}/press-${pressIndex}`)) pressIndex += 1;

  const toProcess = filtered.slice(0, limit);
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const img of toProcess) {
    const perImg: PerImageOutcome = await processImage(slug, dbRow, img, pressIndex, dryRun).catch(
      (e: unknown) => ({
        url: img.url,
        status: 'failed' as const,
        reason: e instanceof Error ? e.message : String(e),
      }),
    );

    appendFileSync(runLogPath, `${JSON.stringify({ slug, ...perImg })}\n`, 'utf-8');

    if (perImg.status === 'uploaded') {
      uploaded += 1;
      pressIndex += 1;
    } else if (perImg.status === 'skipped') {
      skipped += 1;
    } else {
      errors += 1;
    }

    // Smooth the request rate to stay under the per-minute Vision cap.
    await sleep(800);
    console.log(
      `    [${perImg.status.toUpperCase().padEnd(8)}] ${img.url.slice(0, 80)}${
        perImg.reason ? ` — ${perImg.reason.slice(0, 80)}` : ''
      }`,
    );
  }

  // processImage stashes the detailed JSONB row in RUN_ACCUMULATOR.
  // Read it back in input order so the gallery keeps a stable layout.
  const newGalleryRows = toProcess
    .map((img) => RUN_ACCUMULATOR.get(`${slug}:${img.url}`))
    .filter((r): r is Record<string, unknown> => r !== undefined);

  // Hero promotion: if there's no hero AND we uploaded something,
  // pick the highest-quality exterior/lobby/view photo.
  let heroPromoted = false;
  let newHero: string | null = dbRow.hero_image;
  if (newHero === null && newGalleryRows.length > 0) {
    const scored = newGalleryRows
      .map((r) => ({
        publicId: typeof r['public_id'] === 'string' ? r['public_id'] : '',
        category: typeof r['category'] === 'string' ? r['category'] : 'other',
        qualityScore: typeof r['quality_score'] === 'number' ? r['quality_score'] : 0,
      }))
      .filter((s) => s.publicId.length > 0);
    const preferenceOrder = ['exterior', 'view', 'lobby', 'pool', 'room', 'dining', 'spa'];
    scored.sort((a, b) => {
      const aPref = preferenceOrder.indexOf(a.category);
      const bPref = preferenceOrder.indexOf(b.category);
      const ai = aPref === -1 ? 99 : aPref;
      const bi = bPref === -1 ? 99 : bPref;
      if (ai !== bi) return ai - bi;
      return b.qualityScore - a.qualityScore;
    });
    if (scored[0]) {
      newHero = scored[0].publicId;
      heroPromoted = true;
    }
  }

  // Persist to Supabase.
  if (!dryRun && newGalleryRows.length > 0) {
    const merged = [...dbRow.gallery_images, ...newGalleryRows];
    await patchHotelById(supabaseCfg, dbRow.id, {
      gallery_images: merged,
      ...(heroPromoted ? { hero_image: newHero } : {}),
    });
    console.log(
      `  [DB] patched hotels: gallery ${dbRow.gallery_images.length} → ${merged.length}${
        heroPromoted ? ` + hero promoted to ${newHero}` : ''
      }`,
    );
  } else if (dryRun) {
    console.log(
      `  [DRY-RUN] would patch gallery (+${newGalleryRows.length}) ${heroPromoted ? '+ hero' : ''}`,
    );
  }

  return { slug, uploaded, skipped, errors, heroPromoted };
}

// Stores the detailed JSONB row we want to push to Supabase, keyed by
// `slug:url`. processImage populates this; the parent loop reads it
// when building the final patch payload. Module-level singleton because
// the orchestrator is single-process and we don't need re-entrancy.
const RUN_ACCUMULATOR = new Map<string, Record<string, unknown>>();

async function processImage(
  slug: string,
  hotel: HotelDbRow,
  img: DiscoveryImage,
  pressIndex: number,
  dryRun: boolean,
): Promise<PerImageOutcome> {
  // 1. Vision pass.
  const vision = await visionAnalyse(img.url, {
    hotelName: hotel.name,
    city: hotel.city,
    tavilyHint: img.description,
  });

  if (!vision.keep) {
    return { url: img.url, status: 'skipped', reason: `vision.keep=false (${vision.category})` };
  }
  if (vision.quality_score < 6) {
    return {
      url: img.url,
      status: 'skipped',
      reason: `low quality_score=${vision.quality_score}`,
    };
  }

  if (dryRun) {
    // Stash the candidate row for the parent loop's logging.
    RUN_ACCUMULATOR.set(`${slug}:${img.url}`, {
      public_id: `cct/hotels/${slug}/press-${pressIndex}`,
      category: vision.category,
      alt_fr: vision.alt_fr,
      alt_en: vision.alt_en,
      caption_fr: vision.caption_fr,
      caption_en: vision.caption_en,
      quality_score: vision.quality_score,
    });
    return {
      url: img.url,
      status: 'uploaded',
      publicId: `cct/hotels/${slug}/press-${pressIndex}`,
      category: vision.category,
      qualityScore: vision.quality_score,
      reason: `[dry-run] ${vision.alt_fr.slice(0, 50)}`,
    };
  }

  // 2. Cloudinary upload.
  const uploadInput: CloudinaryUploadInput = {
    hotelSlug: slug,
    source: 'press',
    index: pressIndex,
    sourceUrl: img.url,
    altFr: vision.alt_fr,
    altEn: vision.alt_en,
    category: vision.category,
    extraTags: ['press-kit', 'tavily-sourced'],
  };
  const result = await uploadFromUrl(uploadInput);
  if (!result.ok) {
    return {
      url: img.url,
      status: 'failed',
      reason: `cloudinary: ${result.error.kind}${'message' in result.error ? `: ${result.error.message}` : ''}`,
    };
  }

  // 3. Build the full DB row + stash it for the parent loop.
  const row: Record<string, unknown> = {
    public_id: result.value.public_id,
    alt_fr: vision.alt_fr,
    alt_en: vision.alt_en,
    category: vision.category,
    caption_fr: vision.caption_fr,
    caption_en: vision.caption_en,
    quality_score: vision.quality_score,
    width: result.value.width,
    height: result.value.height,
  };
  RUN_ACCUMULATOR.set(`${slug}:${img.url}`, row);

  return {
    url: img.url,
    status: 'uploaded',
    publicId: result.value.public_id,
    category: vision.category,
    qualityScore: vision.quality_score,
    reason: vision.alt_fr.slice(0, 60),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !args.dryRun, needsGooglePlaces: false });

  if (!args.dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[upload-press-kit] Cloudinary creds missing despite requirePhotoEnv check');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const supabaseCfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');
  const runLogPath = resolve(runsDir, `press-kit-upload-${ts}.jsonl`);

  console.log(`[upload-press-kit] processing ${args.discoveryFiles.length} discovery file(s)`);
  console.log(
    `  dry-run: ${args.dryRun ? 'YES — no Cloudinary upload, no DB patch' : 'NO — live'}`,
  );
  console.log(`  limit per hotel: ${args.limitPerHotel}`);
  console.log(`  runlog: ${runLogPath}`);

  const outcomes: PerHotelOutcome[] = [];
  for (const file of args.discoveryFiles) {
    const report = readDiscoveryFile(file);
    console.log(`\n  source: ${basename(file)}`);
    const outcome = await processHotel(
      report,
      supabaseCfg,
      args.limitPerHotel,
      args.dryRun,
      runLogPath,
    );
    outcomes.push(outcome);
  }

  console.log('\n[upload-press-kit] SUMMARY');
  for (const o of outcomes) {
    console.log(
      `  ${o.slug.padEnd(22)} uploaded=${o.uploaded.toString().padStart(2)}  skipped=${o.skipped.toString().padStart(2)}  errors=${o.errors.toString().padStart(2)}  hero=${o.heroPromoted ? 'yes' : 'no'}`,
    );
  }
}

void main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[upload-press-kit] fatal: ${msg}`);
  process.exit(1);
});
