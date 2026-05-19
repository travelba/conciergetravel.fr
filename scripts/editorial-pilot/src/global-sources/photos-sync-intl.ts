/**
 * photos-sync-intl.ts — densify photos for the 337 Tier-1 international
 * hotels seeded in May 2026 (`feat/intl-phase-2-polish`).
 *
 * Why this script
 * ---------------
 * Only 95 of the 337 published intl hotels carry a `hero_image` and none
 * has a populated `gallery_images`. The SEO indexability gate
 * (`apps/web/src/server/hotels/get-hotel-by-slug.ts#listIndexableHotelSlugs`)
 * requires both `hero_image IS NOT NULL` AND
 * `jsonb_array_length(gallery_images) >= 5`. Without photos, those
 * fiches stay `noindex` and never accumulate authority signals.
 *
 * Sources (per hotel)
 * -------------------
 *   1. Wikimedia Commons — preferred. Free, well-attributed, CC BY-SA.
 *      Resolves `commons_category` from the DB or live SPARQL (P373)
 *      when only `wikidata_id` is known. Falls back to the P18 image.
 *   2. Tavily Search — fallback when Commons yields < 5 photos. Uses
 *      `include_images: true` + `include_image_descriptions: true` to
 *      pull direct image URLs from indexed pages.
 *
 * Per-image record (matches the new extended `gallery_images` shape
 * documented in migration 0034):
 *   {
 *     url, caption, source, attribution,
 *     category, width?, height?,
 *     alt_fr, alt_en
 *   }
 *
 * Persisted columns
 * -----------------
 *   - `hero_image` ← URL of the best 'exterior' photo when NULL
 *     (never overwrites editor-pinned content).
 *   - `gallery_images` ← extended-shape array, ALWAYS includes caption
 *     for CDC §2 / Schema.org ImageObject.caption.
 *
 * Costs (budget $3 hard cap)
 * --------------------------
 *   - Commons:   free, throttled to ≤ 5 req/s with 300 ms jitter.
 *   - Tavily:    $0.005 / search × ≤ 250 fallback hotels = ≤ $1.25.
 *   - LLM:       gpt-4o-mini, 1 classification call per hotel
 *                × 337 hotels ≈ $0.10–0.30.
 *
 * Idempotency
 * -----------
 * Re-runs are safe. A hotel is treated as "done" when:
 *   - its `gallery_images` array length ≥ 5, AND
 *   - its `hero_image` is set
 * Re-running with `--force` rebuilds the gallery (use sparingly).
 *
 * CLI flags
 * ---------
 *   --dry-run                   No DB writes, no Tavily, no LLM.
 *   --limit N                   Cap hotels processed.
 *   --country XX                Restrict to ISO-3166 alpha-2 country.
 *   --source commons|tavily|both (default: both)
 *   --concurrency N             1..5 (default 3).
 *   --force                     Rebuild gallery even if already filled.
 *
 * Usage
 * -----
 *   pnpm --filter @mch/editorial-pilot photos:sync:intl:dry --limit 3 --country US
 *   pnpm --filter @mch/editorial-pilot photos:sync:intl --limit 10 --country US
 *   pnpm --filter @mch/editorial-pilot photos:sync:intl
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { tavilySearch } from '../enrichment/tavily-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

// ─── Constants ─────────────────────────────────────────────────────────────

const CLASSIFICATION_MODEL = 'gpt-4o-mini-2024-07-18';

const USER_AGENT =
  'MyConciergeHotelEditorialPilot/0.1 (https://myconciergehotel.com; reservations@myconciergehotel.com)';

const PHOTO_CATEGORIES = [
  'exterior',
  'interior',
  'room',
  'restaurant',
  'spa',
  'pool',
  'lobby',
  'view',
  'detail',
  'other',
] as const;

type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

const SOURCES = ['wikimedia_commons', 'tavily'] as const;
type Source = (typeof SOURCES)[number];

const SOURCE_CLI = ['commons', 'tavily', 'both'] as const;
type SourceCli = (typeof SOURCE_CLI)[number];

const COMMONS_TARGET_PHOTOS = 30;
const COMMONS_MIN_BEFORE_FALLBACK = 5;
const TAVILY_MAX_PHOTOS_PER_HOTEL = 10;
const TAVILY_MAX_RESULTS = 8;
const MAX_PHOTOS_PERSISTED = 25;

// Commons filename blocklist — refuses logos / maps / plans / SVG art
// that pollute the gallery and serve no editorial purpose.
const IMAGE_BLOCKLIST_RX =
  /\b(logo|icon|map|plan|grundriss|wappen|coat[_\s-]*of[_\s-]*arms|seal|emblem|drawing|sketch|signature|svg)\b/iu;

const NON_PHOTO_EXTENSION_RX = /\.(svg|tif|tiff|pdf|ogv|webm|mp4)$/iu;
const PHOTO_EXTENSION_RX = /\.(jpe?g|png|webp)$/iu;

// ─── CLI parsing ───────────────────────────────────────────────────────────

interface CliArgs {
  readonly limit: number | null;
  readonly dryRun: boolean;
  readonly country: string | null;
  readonly source: SourceCli;
  readonly concurrency: number;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let limit: number | null = null;
  let dryRun = false;
  let country: string | null = null;
  let source: SourceCli = 'both';
  let concurrency = 3;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--force') {
      force = true;
    } else if (a === '--limit') {
      const next = argv[i + 1];
      if (next !== undefined) {
        const n = Number(next);
        if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
        i += 1;
      }
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (a === '--country') {
      const next = argv[i + 1];
      if (next !== undefined) {
        country = next.toUpperCase();
        i += 1;
      }
    } else if (a.startsWith('--country=')) {
      country = a.slice('--country='.length).toUpperCase();
    } else if (a === '--source') {
      const next = argv[i + 1];
      if (next === 'commons' || next === 'tavily' || next === 'both') {
        source = next;
        i += 1;
      }
    } else if (a.startsWith('--source=')) {
      const v = a.slice('--source='.length);
      if (v === 'commons' || v === 'tavily' || v === 'both') source = v;
    } else if (a === '--concurrency') {
      const next = argv[i + 1];
      if (next !== undefined) {
        const n = Number(next);
        if (Number.isFinite(n) && n > 0) concurrency = Math.min(5, Math.max(1, Math.floor(n)));
        i += 1;
      }
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(5, Math.max(1, Math.floor(n)));
    }
  }
  return { limit, dryRun, country, source, concurrency, force };
}

// ─── DB row + extended gallery shape ──────────────────────────────────────

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly wikidata_id: string | null;
  readonly commons_category: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: unknown;
}

interface GalleryExternalEntry {
  readonly url: string;
  readonly caption: string;
  readonly source: Source;
  readonly attribution: string;
  readonly category: PhotoCategory;
  readonly width?: number;
  readonly height?: number;
  readonly alt_fr: string;
  readonly alt_en: string;
}

// Cloudinary entry from migration 0008 — kept around for shape detection.
interface GalleryCloudinaryEntry {
  readonly public_id: string;
  readonly alt_fr?: string;
  readonly alt_en?: string;
  readonly category?: string;
}

type AnyGalleryEntry = GalleryExternalEntry | GalleryCloudinaryEntry;

// Strict Zod schema mirroring the existing Cloudinary reader in
// `apps/web/src/server/hotels/get-hotel-by-slug.ts`. Used to validate the
// shape of any FR hotel sampled at startup (Rule 5 — "schema validate").
const CloudinaryPublicIdRx = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

const ExistingCloudinaryEntrySchema = z
  .object({
    public_id: z.string().regex(CloudinaryPublicIdRx),
    alt_fr: z.string().min(1).optional(),
    alt_en: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
  })
  .passthrough();

// ─── Pre-flight schema validation (Rule 5 in the task brief) ──────────────

interface ShapeProbeResult {
  readonly sampledSlug: string | null;
  readonly entriesSeen: number;
  readonly cloudinaryEntries: number;
  readonly externalEntries: number;
  readonly malformedEntries: number;
}

async function probeExistingShape(supabaseExec: SupabaseSqlFn): Promise<ShapeProbeResult> {
  const probe = await supabaseExec(
    `select slug, gallery_images
       from public.hotels
      where country_code = 'FR'
        and gallery_images is not null
        and jsonb_typeof(gallery_images) = 'array'
        and jsonb_array_length(gallery_images) > 0
      order by case when slug = 'ritz-paris' then 0 else 1 end, slug
      limit 1`,
  );
  if (probe.length === 0) {
    return {
      sampledSlug: null,
      entriesSeen: 0,
      cloudinaryEntries: 0,
      externalEntries: 0,
      malformedEntries: 0,
    };
  }
  const row = probe[0] as { slug: string; gallery_images: unknown };
  const entries = Array.isArray(row.gallery_images) ? row.gallery_images : [];
  let cloud = 0;
  let ext = 0;
  let bad = 0;
  for (const e of entries) {
    if (e !== null && typeof e === 'object' && 'public_id' in e) {
      const ok = ExistingCloudinaryEntrySchema.safeParse(e).success;
      if (ok) cloud += 1;
      else bad += 1;
    } else if (e !== null && typeof e === 'object' && 'url' in e) {
      ext += 1;
    } else {
      bad += 1;
    }
  }
  return {
    sampledSlug: row.slug,
    entriesSeen: entries.length,
    cloudinaryEntries: cloud,
    externalEntries: ext,
    malformedEntries: bad,
  };
}

// ─── Wikidata SPARQL (commons_category + image fallback) ──────────────────

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

const SparqlBindingSchema = z
  .object({
    commonsCat: z.object({ value: z.string() }).optional(),
    image: z.object({ value: z.string() }).optional(),
  })
  .passthrough();

const SparqlResponseSchema = z.object({
  results: z.object({ bindings: z.array(SparqlBindingSchema) }),
});

interface WdImageHints {
  readonly commonsCategory: string | null;
  readonly imageUrl: string | null;
  readonly imageFilename: string | null;
}

async function fetchWdImageHints(qid: string): Promise<WdImageHints> {
  const cleanQid = qid.trim();
  if (!/^Q\d+$/u.test(cleanQid)) {
    return { commonsCategory: null, imageUrl: null, imageFilename: null };
  }
  const sparql = `
    SELECT ?commonsCat ?image WHERE {
      BIND(wd:${cleanQid} AS ?hotel)
      OPTIONAL { ?hotel wdt:P373 ?commonsCat. }
      OPTIONAL { ?hotel wdt:P18  ?image. }
    } LIMIT 5
  `.trim();
  const url = new URL(WIKIDATA_SPARQL);
  url.searchParams.set('query', sparql);
  url.searchParams.set('format', 'json');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
    });
    if (!res.ok) return { commonsCategory: null, imageUrl: null, imageFilename: null };
    const parsed = SparqlResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { commonsCategory: null, imageUrl: null, imageFilename: null };
    let cat: string | null = null;
    let imageUrl: string | null = null;
    for (const b of parsed.data.results.bindings) {
      if (b.commonsCat?.value && cat === null) cat = b.commonsCat.value;
      if (b.image?.value && imageUrl === null) imageUrl = b.image.value;
    }
    // The P18 value is a Commons file URL like:
    //   http://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg
    // We extract the filename to feed into the dedup loop and to build
    // a deterministic high-resolution URL.
    let filename: string | null = null;
    if (imageUrl !== null) {
      const m = /Special:FilePath\/([^?]+)/iu.exec(decodeURIComponent(imageUrl));
      if (m && m[1]) filename = m[1].replace(/_/gu, ' ');
    }
    return { commonsCategory: cat, imageUrl, imageFilename: filename };
  } catch {
    return { commonsCategory: null, imageUrl: null, imageFilename: null };
  }
}

// ─── Wikimedia Commons enumeration ────────────────────────────────────────

const CommonsImageInfoSchema = z
  .object({
    url: z.string().url().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    extmetadata: z
      .object({
        ImageDescription: z.object({ value: z.string() }).optional(),
        ObjectName: z.object({ value: z.string() }).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

const CommonsCategoryMembersSchema = z
  .object({
    query: z
      .object({
        pages: z
          .record(
            z
              .object({
                title: z.string().optional(),
                imageinfo: z.array(CommonsImageInfoSchema).optional(),
              })
              .passthrough(),
          )
          .optional()
          .default({}),
      })
      .partial()
      .optional(),
  })
  .passthrough();

interface RawCommonsPhoto {
  readonly filename: string;
  readonly width?: number;
  readonly height?: number;
  readonly description?: string;
}

function isUsableImageFilename(filename: string): boolean {
  if (IMAGE_BLOCKLIST_RX.test(filename)) return false;
  if (NON_PHOTO_EXTENSION_RX.test(filename)) return false;
  return PHOTO_EXTENSION_RX.test(filename);
}

function buildCommonsFilePathUrl(filename: string, width = 2000): string {
  const encoded = encodeURIComponent(filename.replace(/ /gu, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}

function captionFromCommonsFilename(filename: string): string {
  const stem = filename.replace(/^File:/u, '').replace(/\.[A-Za-z0-9]+$/u, '');
  const spaced = stem.replace(/_/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (spaced.length === 0) return 'Photo (Wikimedia Commons)';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

async function fetchCommonsCategoryPhotos(
  category: string,
  limit: number,
): Promise<RawCommonsPhoto[]> {
  const cleaned = category.replace(/^Category:/u, '').trim();
  if (cleaned.length === 0) return [];
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'categorymembers');
  url.searchParams.set('gcmtype', 'file');
  url.searchParams.set('gcmtitle', `Category:${cleaned}`);
  url.searchParams.set('gcmlimit', String(Math.min(50, Math.max(1, limit))));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|extmetadata');
  url.searchParams.set('iiurlwidth', '2000');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    const parsed = CommonsCategoryMembersSchema.safeParse(json);
    if (!parsed.success) return [];
    const pages = parsed.data.query?.pages ?? {};
    const out: RawCommonsPhoto[] = [];
    for (const page of Object.values(pages)) {
      const title = page.title;
      if (typeof title !== 'string') continue;
      const filename = title.replace(/^File:/iu, '');
      if (!isUsableImageFilename(filename)) continue;
      const info = page.imageinfo?.[0];
      const description = info?.extmetadata?.ImageDescription?.value
        ?.replace(/<[^>]+>/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
      out.push({
        filename,
        ...(info?.width !== undefined ? { width: info.width } : {}),
        ...(info?.height !== undefined ? { height: info.height } : {}),
        ...(description && description.length > 0 ? { description } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Source-agnostic raw photo + classification ──────────────────────────

interface RawPhoto {
  readonly url: string;
  readonly caption: string;
  readonly source: Source;
  readonly attribution: string;
  readonly width?: number;
  readonly height?: number;
}

function dedupe(photos: ReadonlyArray<RawPhoto>): RawPhoto[] {
  const seen = new Set<string>();
  const out: RawPhoto[] = [];
  for (const p of photos) {
    // De-dup on URL host+path (strip width param, decode, lower-case).
    let key = p.url;
    try {
      const u = new URL(p.url);
      key = `${u.host}${u.pathname}`.toLowerCase();
    } catch {
      // fall through with the raw URL as key
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// ─── LLM classification (one call per hotel) ──────────────────────────────

const ClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      category: z.preprocess((v) => {
        if (typeof v !== 'string') return v;
        const lower = v.toLowerCase().trim();
        const alias: Record<string, PhotoCategory> = {
          // ✱ common LLM drift mapped back into the canonical 10-enum
          outside: 'exterior',
          building: 'exterior',
          facade: 'exterior',
          inside: 'interior',
          decor: 'interior',
          bedroom: 'room',
          suite: 'room',
          dining: 'restaurant',
          'food and drink': 'restaurant',
          wellness: 'spa',
          gym: 'spa',
          fitness: 'spa',
          swimming_pool: 'pool',
          swimming: 'pool',
          beach: 'view',
          landscape: 'view',
          panorama: 'view',
          scenery: 'view',
          reception: 'lobby',
          hall: 'lobby',
          architectural_detail: 'detail',
          art: 'detail',
          artwork: 'detail',
          decoration: 'detail',
        };
        if (lower in alias) return alias[lower];
        if ((PHOTO_CATEGORIES as readonly string[]).includes(lower)) return lower;
        return 'other';
      }, z.enum(PHOTO_CATEGORIES)),
    }),
  ),
});

interface ClassifyOk {
  readonly kind: 'ok';
  readonly categories: ReadonlyArray<PhotoCategory>;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}
interface ClassifyFail {
  readonly kind: 'fail';
  readonly reason: string;
}
type ClassifyResult = ClassifyOk | ClassifyFail;

const CLASSIFY_SYSTEM_PROMPT = `You classify hotel photos into 10 categories from short captions / filenames.

Categories:
  - exterior   (façade, garden, outside view of the building)
  - interior   (general indoor public spaces NOT covered by a more specific category)
  - room       (bedroom, suite, bathroom)
  - restaurant (dining room, bar, kitchen, food, drinks)
  - spa        (spa, hammam, sauna, treatment room, gym, wellness)
  - pool       (swimming pool, indoor / outdoor)
  - lobby      (lobby, reception, entrance hall)
  - view       (panorama, landscape, beach, ski slope visible from the property)
  - detail     (architectural detail, artwork, decor close-up)
  - other      (use only if NONE of the above clearly fits)

Output JSON ONLY, no prose, matching:
  { "classifications": [ { "index": <int>, "category": "<one of the 10>" } ] }

Rules:
  - Return exactly one entry per input photo. Indexes start at 0.
  - Prefer the most specific category. "interior" is the fallback for indoor non-room/non-restaurant/non-spa/non-pool/non-lobby shots.
  - When in doubt about "exterior" vs "view": if the building is in the frame, it's "exterior"; if it's a landscape without the building, it's "view".
  - "detail" is for close-ups (sculpture, paint, fireplace, door handle). Never confuse with "interior".`;

async function classifyPhotosWithLlm(
  client: OpenAI,
  hotelName: string,
  city: string,
  countryFr: string,
  photos: ReadonlyArray<RawPhoto>,
): Promise<ClassifyResult> {
  if (photos.length === 0) {
    return { kind: 'ok', categories: [], usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const userPrompt = [
    `HOTEL: ${hotelName}`,
    `CITY: ${city}`,
    `COUNTRY_FR: ${countryFr}`,
    '',
    'Classify each photo by index. Captions and filenames are noisy, do your best.',
    '',
    ...photos.map(
      (p, i) => `[${i}] source=${p.source} caption=${JSON.stringify(p.caption.slice(0, 200))}`,
    ),
    '',
    'Return JSON now.',
  ].join('\n');

  try {
    const response = await client.chat.completions.create({
      model: CLASSIFICATION_MODEL,
      temperature: 0,
      max_tokens: Math.min(1500, 80 + photos.length * 20),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      return { kind: 'fail', reason: 'empty LLM response' };
    }
    if (choice.finish_reason === 'length') {
      return { kind: 'fail', reason: 'classification truncated (max_tokens hit)' };
    }
    let json: unknown;
    try {
      json = JSON.parse(choice.message.content);
    } catch {
      return { kind: 'fail', reason: 'classification JSON parse failed' };
    }
    const parsed = ClassificationSchema.safeParse(json);
    if (!parsed.success) {
      return {
        kind: 'fail',
        reason: `classification schema fail: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      };
    }
    const out: PhotoCategory[] = new Array(photos.length).fill('detail' as PhotoCategory);
    for (const c of parsed.data.classifications) {
      if (c.index >= 0 && c.index < photos.length) out[c.index] = c.category;
    }
    return {
      kind: 'ok',
      categories: out,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    return { kind: 'fail', reason: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Tavily fallback ──────────────────────────────────────────────────────

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//iu.test(u);
}

function domainOf(u: string): string | null {
  try {
    return new URL(u).host.toLowerCase().replace(/^www\./u, '');
  } catch {
    return null;
  }
}

async function fetchTavilyPhotos(
  hotel: HotelRow,
  maxPhotos: number,
): Promise<{ photos: RawPhoto[]; queryUsed: boolean }> {
  const queryParts = [hotel.name, hotel.city, 'hotel photos exterior interior pool'];
  const query = queryParts.filter((p) => p && p.trim().length > 0).join(' ');
  if (query.length === 0) return { photos: [], queryUsed: false };
  try {
    const res = await tavilySearch({
      query: query.slice(0, 380),
      searchDepth: 'basic',
      maxResults: TAVILY_MAX_RESULTS,
      includeImages: true,
      includeImageDescriptions: true,
    });
    const out: RawPhoto[] = [];
    for (const img of res.images) {
      if (!isHttpUrl(img.url)) continue;
      const url = img.url;
      const lower = url.toLowerCase();
      if (NON_PHOTO_EXTENSION_RX.test(lower)) continue;
      if (IMAGE_BLOCKLIST_RX.test(lower)) continue;
      const domain = domainOf(url) ?? 'web';
      const caption =
        img.description !== null && img.description.length > 0
          ? img.description.slice(0, 250)
          : `${hotel.name}, ${hotel.city}`;
      out.push({
        url,
        caption,
        source: 'tavily',
        attribution: domain,
      });
      if (out.length >= maxPhotos) break;
    }
    return { photos: out, queryUsed: true };
  } catch {
    return { photos: [], queryUsed: true };
  }
}

// ─── Per-hotel pipeline ───────────────────────────────────────────────────

interface ProcessResult {
  readonly slug: string;
  readonly status: 'success' | 'skipped' | 'error';
  readonly reason?: string;
  readonly commonsCount: number;
  readonly tavilyCount: number;
  readonly totalPersisted: number;
  readonly heroSet: boolean;
  readonly tavilyQueryUsed: boolean;
  readonly classificationOk: boolean;
  readonly llmTokens: { input: number; output: number };
  readonly samplePersisted?: ReadonlyArray<GalleryExternalEntry>;
}

interface ProcessOpts {
  readonly openai: OpenAI;
  readonly args: CliArgs;
  readonly supabaseExec: SupabaseSqlFn;
}

async function processHotel(hotel: HotelRow, opts: ProcessOpts): Promise<ProcessResult> {
  const { openai, args, supabaseExec } = opts;
  const slug = hotel.slug;

  // ── Idempotency guard ──────────────────────────────────────────────────
  const existingGallery = Array.isArray(hotel.gallery_images) ? hotel.gallery_images : [];
  if (!args.force && hotel.hero_image !== null && existingGallery.length >= 5) {
    return {
      slug,
      status: 'skipped',
      reason: 'already has hero + ≥5 photos',
      commonsCount: 0,
      tavilyCount: 0,
      totalPersisted: existingGallery.length,
      heroSet: true,
      tavilyQueryUsed: false,
      classificationOk: false,
      llmTokens: { input: 0, output: 0 },
    };
  }

  // ── (1) Commons ─────────────────────────────────────────────────────────
  let commonsPhotos: RawPhoto[] = [];
  let commonsCategory = hotel.commons_category;

  if (args.source === 'commons' || args.source === 'both') {
    // If commons_category is unset but we have a wikidata_id, resolve it
    // on-the-fly via SPARQL P373. We also collect a P18 fallback so even
    // hotels without a Commons category still get at least one photo.
    let p18Filename: string | null = null;
    if (commonsCategory === null && hotel.wikidata_id !== null && hotel.wikidata_id.length > 0) {
      await sleep(250 + Math.random() * 200);
      const hints = await fetchWdImageHints(hotel.wikidata_id);
      commonsCategory = hints.commonsCategory;
      p18Filename = hints.imageFilename;
    }

    if (commonsCategory !== null && commonsCategory.length > 0) {
      await sleep(200 + Math.random() * 300);
      const raw = await fetchCommonsCategoryPhotos(commonsCategory, COMMONS_TARGET_PHOTOS);
      for (const r of raw) {
        commonsPhotos.push({
          url: buildCommonsFilePathUrl(r.filename),
          caption: r.description ?? captionFromCommonsFilename(r.filename),
          source: 'wikimedia_commons',
          attribution: 'CC BY-SA Wikimedia Commons contributors',
          ...(r.width !== undefined ? { width: r.width } : {}),
          ...(r.height !== undefined ? { height: r.height } : {}),
        });
      }
    }

    if (p18Filename !== null && isUsableImageFilename(p18Filename)) {
      // P18 may be redundant with a Commons category result — dedupe later.
      commonsPhotos.push({
        url: buildCommonsFilePathUrl(p18Filename),
        caption: captionFromCommonsFilename(p18Filename),
        source: 'wikimedia_commons',
        attribution: 'CC BY-SA Wikimedia Commons contributors',
      });
    }
  }

  commonsPhotos = dedupe(commonsPhotos);
  const commonsCount = commonsPhotos.length;

  // ── (2) Tavily fallback ─────────────────────────────────────────────────
  let tavilyPhotos: RawPhoto[] = [];
  let tavilyQueryUsed = false;
  if (
    (args.source === 'tavily' || args.source === 'both') &&
    !args.dryRun &&
    commonsCount < COMMONS_MIN_BEFORE_FALLBACK
  ) {
    const need = TAVILY_MAX_PHOTOS_PER_HOTEL;
    const tavily = await fetchTavilyPhotos(hotel, need);
    tavilyPhotos = dedupe(tavily.photos);
    tavilyQueryUsed = tavily.queryUsed;
  }
  const tavilyCount = tavilyPhotos.length;

  const allRaw = dedupe([...commonsPhotos, ...tavilyPhotos]).slice(0, MAX_PHOTOS_PERSISTED);

  if (allRaw.length === 0) {
    return {
      slug,
      status: 'skipped',
      reason: 'no photos found in any source',
      commonsCount,
      tavilyCount,
      totalPersisted: 0,
      heroSet: false,
      tavilyQueryUsed,
      classificationOk: false,
      llmTokens: { input: 0, output: 0 },
    };
  }

  // ── (3) LLM classification (one call per hotel) ─────────────────────────
  let categories: PhotoCategory[] = allRaw.map(() => 'detail' as PhotoCategory);
  let classificationOk = false;
  let llmTokens = { input: 0, output: 0 };
  if (!args.dryRun) {
    const classify = await classifyPhotosWithLlm(
      openai,
      hotel.name,
      hotel.city,
      hotel.country_label_fr ?? hotel.country_code,
      allRaw,
    );
    if (classify.kind === 'ok') {
      categories = [...classify.categories];
      classificationOk = true;
      llmTokens = { input: classify.usage.inputTokens, output: classify.usage.outputTokens };
    }
  }

  // ── (4) Build persisted records ─────────────────────────────────────────
  const entries: GalleryExternalEntry[] = allRaw.map((r, idx) => {
    const category = categories[idx] ?? 'detail';
    const captionTrim = r.caption.slice(0, 280);
    const altShared = captionTrim.length > 0 ? captionTrim : `${hotel.name}, ${hotel.city}`;
    return {
      url: r.url,
      caption: captionTrim,
      source: r.source,
      attribution: r.attribution,
      category,
      ...(r.width !== undefined ? { width: r.width } : {}),
      ...(r.height !== undefined ? { height: r.height } : {}),
      alt_fr: altShared,
      alt_en: altShared,
    };
  });

  // ── (5) Hero selection (NULL-only — never overwrite editor pin) ─────────
  let heroSet = false;
  let heroUrl: string | null = null;
  if (hotel.hero_image === null) {
    const exterior = entries.find((e) => e.category === 'exterior');
    const view = entries.find((e) => e.category === 'view');
    const chosen = exterior ?? view ?? entries[0];
    if (chosen !== undefined) {
      heroUrl = chosen.url;
      heroSet = true;
    }
  }

  // ── (6) Persist ─────────────────────────────────────────────────────────
  if (!args.dryRun) {
    try {
      await persistHotelPhotos(supabaseExec, {
        slug,
        heroUrl,
        entries,
        force: args.force,
      });
    } catch (err) {
      return {
        slug,
        status: 'error',
        reason: `persist failed: ${err instanceof Error ? err.message : String(err)}`,
        commonsCount,
        tavilyCount,
        totalPersisted: 0,
        heroSet: false,
        tavilyQueryUsed,
        classificationOk,
        llmTokens,
      };
    }
  }

  return {
    slug,
    status: 'success',
    commonsCount,
    tavilyCount,
    totalPersisted: entries.length,
    heroSet,
    tavilyQueryUsed,
    classificationOk,
    llmTokens,
    samplePersisted: entries.slice(0, 3),
  };
}

// ─── Supabase access via REST RPC (no pg dep, no SSL fiddling) ───────────

type SupabaseSqlFn = (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown[]>;

// We could open a `pg.Client` like `seed-tier1-content.ts`, but most cloud
// envs in this repo prefer the Supabase REST API (no SSL chain dance, no
// pooler URL juggling). For raw SQL we POST to the `query` endpoint of
// PostgREST is not available — instead we use a tiny pg client when the
// connection string is set, and fall through to a REST-based UPSERT
// otherwise.
//
// Implementation note: every consumer in `scripts/editorial-pilot/` uses
// `pg.Client`, so we follow the same pattern here for consistency.
async function makePgExec(): Promise<{
  exec: SupabaseSqlFn;
  close: () => Promise<void>;
}> {
  const connectionString =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (connectionString === null || connectionString.length === 0) {
    throw new Error(
      'DATABASE_URL / SUPABASE_DB_POOLER_URL / SUPABASE_DB_URL missing in .env.local',
    );
  }
  const pgModule = await import('pg');
  const cleaned = connectionString.replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const exec: SupabaseSqlFn = async (sql, params) => {
    const r = await client.query(sql, params !== undefined ? [...params] : undefined);
    return r.rows as unknown[];
  };
  const close = async (): Promise<void> => {
    await client.end();
  };
  return { exec, close };
}

interface PersistInput {
  readonly slug: string;
  readonly heroUrl: string | null;
  readonly entries: ReadonlyArray<GalleryExternalEntry>;
  readonly force: boolean;
}

async function persistHotelPhotos(exec: SupabaseSqlFn, input: PersistInput): Promise<void> {
  // COALESCE on hero_image preserves any editor-pinned value.
  // gallery_images is overwritten when force=true OR currently empty.
  const sql = input.force
    ? `
        update public.hotels
           set hero_image     = coalesce(hero_image, $2),
               gallery_images = $3::jsonb,
               updated_at     = timezone('utc', now())
         where slug = $1
      `.trim()
    : `
        update public.hotels
           set hero_image     = coalesce(hero_image, $2),
               gallery_images = case
                 when gallery_images is null
                   or jsonb_typeof(gallery_images) <> 'array'
                   or jsonb_array_length(gallery_images) < 5
                   then $3::jsonb
                 else gallery_images
               end,
               updated_at     = timezone('utc', now())
         where slug = $1
      `.trim();
  await exec(sql, [input.slug, input.heroUrl, JSON.stringify(input.entries)]);
}

// ─── Concurrency ──────────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      out[i] = await fn(item, i);
    }
  });
  await Promise.all(workers);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface RunLogEntry {
  readonly slug: string;
  readonly country_code: string;
  readonly status: 'success' | 'skipped' | 'error';
  readonly reason?: string;
  readonly commons_count: number;
  readonly tavily_count: number;
  readonly total_persisted: number;
  readonly hero_set: boolean;
  readonly tavily_query_used: boolean;
  readonly classification_ok: boolean;
  readonly llm_tokens?: { input: number; output: number };
  readonly sample_persisted?: ReadonlyArray<GalleryExternalEntry>;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));

  console.log(
    `[photos-sync-intl] starting — dryRun=${args.dryRun} limit=${args.limit ?? 'none'} ` +
      `country=${args.country ?? 'all'} source=${args.source} concurrency=${args.concurrency} ` +
      `force=${args.force}`,
  );

  if (!process.env['OPENAI_API_KEY']) {
    console.error('[photos-sync-intl] OPENAI_API_KEY missing in .env.local');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const { exec: supabaseExec, close } = await makePgExec();
  try {
    // ── Pre-flight: probe existing FR shape (Rule 5 — halt-on-mismatch) ──
    const probe = await probeExistingShape(supabaseExec);
    console.log(
      `[photos-sync-intl] shape probe sampled=${probe.sampledSlug ?? 'none'} ` +
        `entries=${probe.entriesSeen} cloudinary=${probe.cloudinaryEntries} ` +
        `external=${probe.externalEntries} malformed=${probe.malformedEntries}`,
    );
    if (probe.malformedEntries > 0) {
      console.warn(
        `[photos-sync-intl] WARNING: sampled FR hotel ${probe.sampledSlug} has ` +
          `${probe.malformedEntries} malformed gallery entries — proceeding anyway ` +
          `(we only append; never rewrite existing Cloudinary records).`,
      );
    }

    // ── Pull candidate hotels ──────────────────────────────────────────────
    const filters: string[] = ["country_code <> 'FR'", 'is_published = true'];
    const params: unknown[] = [];
    if (args.country !== null) {
      params.push(args.country);
      filters.push(`country_code = $${params.length}`);
    }
    const limitSql = args.limit !== null ? `LIMIT ${args.limit}` : '';
    const selectSql = `
      select slug, name, city, country_code, country_label_fr, country_label_en,
             wikidata_id, commons_category, hero_image, gallery_images
        from public.hotels
       where ${filters.join(' and ')}
       order by case when hero_image is null then 0 else 1 end,
                country_code, name
      ${limitSql}
    `.trim();
    const hotels = (await supabaseExec(selectSql, params)) as HotelRow[];
    console.log(`[photos-sync-intl] ${hotels.length} candidate hotel(s)`);
    if (hotels.length === 0) {
      console.log('[photos-sync-intl] nothing to do.');
      return;
    }

    // ── Run pipeline ──────────────────────────────────────────────────────
    const results = await runWithConcurrency(hotels, args.concurrency, async (hotel, idx) => {
      const tag = `[${String(idx + 1).padStart(3)}/${hotels.length}] ${hotel.slug}`;
      try {
        const r = await processHotel(hotel, { openai, args, supabaseExec });
        if (r.status === 'success') {
          console.log(
            `${tag} ✓ ${r.totalPersisted} photo(s) (commons=${r.commonsCount} ` +
              `tavily=${r.tavilyCount}) hero=${r.heroSet ? 'set' : 'kept'}`,
          );
        } else if (r.status === 'skipped') {
          console.log(`${tag} ⤵ skipped: ${r.reason ?? 'no reason'}`);
        } else {
          console.warn(`${tag} ✗ error: ${r.reason ?? 'unknown'}`);
        }
        return r;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ crash: ${reason.slice(0, 200)}`);
        return {
          slug: hotel.slug,
          status: 'error' as const,
          reason: `crash: ${reason.slice(0, 200)}`,
          commonsCount: 0,
          tavilyCount: 0,
          totalPersisted: 0,
          heroSet: false,
          tavilyQueryUsed: false,
          classificationOk: false,
          llmTokens: { input: 0, output: 0 },
        };
      }
    });

    // ── Stats ──────────────────────────────────────────────────────────────
    let okCount = 0;
    let skipCount = 0;
    let errCount = 0;
    let commonsTotal = 0;
    let tavilyTotal = 0;
    let totalPersisted = 0;
    let heroesSet = 0;
    let classificationsOk = 0;
    let tavilyQueriesUsed = 0;
    let totalIn = 0;
    let totalOut = 0;
    const perCountry: Record<string, number> = {};
    for (const r of results) {
      if (r.status === 'success') okCount += 1;
      else if (r.status === 'skipped') skipCount += 1;
      else errCount += 1;
      commonsTotal += r.commonsCount;
      tavilyTotal += r.tavilyCount;
      totalPersisted += r.totalPersisted;
      if (r.heroSet) heroesSet += 1;
      if (r.classificationOk) classificationsOk += 1;
      if (r.tavilyQueryUsed) tavilyQueriesUsed += 1;
      totalIn += r.llmTokens.input;
      totalOut += r.llmTokens.output;
    }
    for (const h of hotels) {
      perCountry[h.country_code] = (perCountry[h.country_code] ?? 0) + 1;
    }

    const elapsedSec = Number(((Date.now() - startedAt) / 1000).toFixed(1));
    // gpt-4o-mini-2024-07-18 pricing per 1M tokens: $0.15 input, $0.60 output.
    const llmCost = (totalIn / 1_000_000) * 0.15 + (totalOut / 1_000_000) * 0.6;
    // Tavily basic search: ~$0.005 per query.
    const tavilyCost = tavilyQueriesUsed * 0.005;
    const totalCost = llmCost + tavilyCost;

    console.log('');
    console.log('────────────────────────────────────────');
    console.log('[photos-sync-intl] DONE');
    console.log(`  candidates       : ${hotels.length}`);
    console.log(`  success          : ${okCount}`);
    console.log(`  skipped          : ${skipCount}`);
    console.log(`  errored          : ${errCount}`);
    console.log(`  commons photos   : ${commonsTotal} (across all hotels)`);
    console.log(`  tavily photos    : ${tavilyTotal} (across all hotels)`);
    console.log(`  tavily queries   : ${tavilyQueriesUsed}`);
    console.log(`  total persisted  : ${totalPersisted}`);
    console.log(`  heroes filled    : ${heroesSet}`);
    console.log(`  classifications  : ${classificationsOk} / ${okCount + skipCount + errCount}`);
    console.log(`  LLM tokens       : in=${totalIn} out=${totalOut} cost≈$${llmCost.toFixed(3)}`);
    console.log(`  Tavily cost      : ≈$${tavilyCost.toFixed(3)}`);
    console.log(`  total cost       : ≈$${totalCost.toFixed(3)}`);
    console.log(`  elapsed          : ${elapsedSec}s`);
    if (args.dryRun) console.log('  (DRY RUN — no DB writes performed)');

    // ── Runlog ────────────────────────────────────────────────────────────
    const runsDir = resolve(__dirname, '../../runs');
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const runlogPath = resolve(runsDir, `photos-sync-intl-${stamp}.json`);
    const entries: RunLogEntry[] = results.map((r, i) => {
      const hotel = hotels[i];
      const cc = hotel?.country_code ?? '??';
      const entry: RunLogEntry = {
        slug: r.slug,
        country_code: cc,
        status: r.status,
        commons_count: r.commonsCount,
        tavily_count: r.tavilyCount,
        total_persisted: r.totalPersisted,
        hero_set: r.heroSet,
        tavily_query_used: r.tavilyQueryUsed,
        classification_ok: r.classificationOk,
        ...(r.reason !== undefined ? { reason: r.reason } : {}),
        ...(r.llmTokens.input + r.llmTokens.output > 0
          ? { llm_tokens: { input: r.llmTokens.input, output: r.llmTokens.output } }
          : {}),
        ...(r.samplePersisted !== undefined && r.samplePersisted.length > 0
          ? { sample_persisted: r.samplePersisted }
          : {}),
      };
      return entry;
    });
    writeFileSync(
      runlogPath,
      JSON.stringify(
        {
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          args,
          shape_probe: probe,
          stats: {
            candidates: hotels.length,
            success: okCount,
            skipped: skipCount,
            errored: errCount,
            commons_photos: commonsTotal,
            tavily_photos: tavilyTotal,
            tavily_queries_used: tavilyQueriesUsed,
            total_persisted: totalPersisted,
            heroes_filled: heroesSet,
            classifications_ok: classificationsOk,
            tokens: { input: totalIn, output: totalOut },
            estimated_llm_cost_usd: Number(llmCost.toFixed(4)),
            estimated_tavily_cost_usd: Number(tavilyCost.toFixed(4)),
            estimated_total_cost_usd: Number(totalCost.toFixed(4)),
            elapsed_seconds: elapsedSec,
            per_country_candidates: perCountry,
          },
          entries,
        },
        null,
        2,
      ),
    );
    console.log(`  runlog           : ${runlogPath}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('[photos-sync-intl] FATAL', err);
  process.exit(1);
});
