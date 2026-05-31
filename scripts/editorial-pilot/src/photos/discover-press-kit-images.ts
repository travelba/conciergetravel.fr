/**
 * Press-kit image discovery for hotel fiches.
 *
 * Use case (2026-05-31 chantier): 4 flagship hotels (Le Bristol Paris,
 * Akelarre, Al Moudira, Alila Jabal Akhdar) need their gallery padded
 * to ≥ 30 photos. Three already have 9 photos from Google Places API;
 * Le Bristol has only 1. The CDC §2 Hard Rule 9 + ADR-0023 require
 * sources to be official (`.cursor/rules/photo-quality.mdc`) — never
 * TripAdvisor, never Pinterest.
 *
 * This script is the **discovery phase** (READ-ONLY). It runs Tavily
 * Search restricted to the hotel's official domain, with
 * `include_images: true` so Tavily extracts direct image URLs from
 * each rendered page. The output is a JSON file per hotel that lists
 * candidate URLs + their inferred descriptions. The PO reviews the
 * file before the upload phase (`upload-press-kit-images.ts`)
 * actually downloads and persists anything.
 *
 * Why separate the phases?
 *   - Cloudinary uploads are quasi-irreversible (counted in plan).
 *   - Hotel official websites sometimes include UI icons, logos,
 *     placeholder skins, etc. that should not enter the gallery.
 *   - The PO is the editorial gate before any image is committed to
 *     `gallery_images` jsonb.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/discover-press-kit-images.ts --slug=le-bristol-paris
 *
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/discover-press-kit-images.ts \
 *     --slugs=le-bristol-paris,akelarre,al-moudira,alila-jabal-akhdar
 *
 * Output: scripts/editorial-pilot/runs/press-kit-discovery-<slug>-<ts>.json
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique, api-integration
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tavilySearch, type TavilyImage } from '../enrichment/tavily-client.js';
import { loadPhotoEnv } from './env-photos.js';
import {
  isBlocklistedHostname,
  isCorporateRootUrl,
  trustedDomainsForHotel,
} from './parent-group-mapping.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Types ─────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slugs: readonly string[];
}

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly official_url: string | null;
  readonly gallery_count: number;
}

interface DiscoveryQuery {
  readonly label: string;
  readonly query: string;
}

interface DiscoveredImage {
  readonly url: string;
  readonly description: string | null;
  readonly fromQueries: readonly string[];
  readonly hostname: string;
  readonly extension: string | null;
}

interface DiscoveryReport {
  readonly slug: string;
  readonly name: string;
  readonly officialUrl: string | null;
  readonly inferredDomain: string | null;
  readonly currentGalleryCount: number;
  readonly queries: readonly { label: string; query: string; imageCount: number }[];
  readonly totalUniqueImages: number;
  readonly images: readonly DiscoveredImage[];
}

// ─── CLI parsing ───────────────────────────────────────────────────────────

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: readonly string[] = [];
  for (const arg of argv) {
    if (arg.startsWith('--slug=')) {
      slugs = [arg.slice('--slug='.length).trim()];
    } else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  if (slugs.length === 0) {
    throw new Error('[discover-press-kit] Pass --slug=<s> or --slugs=<a,b,c>');
  }
  return { slugs };
}

// ─── Supabase helpers ──────────────────────────────────────────────────────

function buildSupabaseRestConfig(): SupabaseRestConfig {
  const env = loadPhotoEnv();
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

interface RawHotelRow {
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly country_code: unknown;
  readonly luxury_tier: unknown;
  readonly official_url: unknown;
  readonly gallery_images: unknown;
}

async function fetchHotelMeta(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<readonly HotelRow[]> {
  // PostgREST `in.(a,b,c)` filter syntax.
  const inFilter = `slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
  const raws = await selectHotels<RawHotelRow>(cfg, {
    columns: 'slug,name,city,country_code,luxury_tier,official_url,gallery_images',
    filters: [inFilter],
    limit: slugs.length,
  });

  return raws.map((row) => {
    const gallery = Array.isArray(row.gallery_images) ? row.gallery_images : [];
    return {
      slug: String(row.slug),
      name: String(row.name),
      city: typeof row.city === 'string' ? row.city : '',
      country_code: typeof row.country_code === 'string' ? row.country_code : null,
      luxury_tier: typeof row.luxury_tier === 'string' ? row.luxury_tier : null,
      official_url: typeof row.official_url === 'string' ? row.official_url : null,
      gallery_count: gallery.length,
    };
  });
}

// ─── Domain inference ──────────────────────────────────────────────────────

/**
 * Domain inference is centralised in `parent-group-mapping.ts` so
 * `discover-press-kit-images.ts`, `upload-press-kit-images.ts` and
 * `audit-photo-readiness.ts` share the same single source of truth.
 *
 * The helper combines:
 *   - the hotel's own `official_url` hostname
 *   - the parent group's press-kit CDN(s) (Oetker, Hyatt, R&C, …)
 *     resolved via {@link inferParentGroup} using `official_url` then
 *     `luxury_tier` then a small slug-pinned override map.
 *
 * Add a new parent group? Edit `parent-group-mapping.ts` once and
 * every consumer benefits — no per-script forks.
 */
function inferDomainList(
  slug: string,
  officialUrl: string | null,
  luxuryTier: string | null,
): readonly string[] {
  return trustedDomainsForHotel({ slug, officialUrl, luxuryTier });
}

// ─── Discovery queries ─────────────────────────────────────────────────────

function buildQueries(hotel: HotelRow): readonly DiscoveryQuery[] {
  const name = hotel.name;
  return [
    { label: 'press-kit', query: `${name} press kit media library` },
    { label: 'rooms-suites', query: `${name} rooms suites accommodations` },
    { label: 'dining-spa', query: `${name} restaurant dining spa wellness` },
    { label: 'exterior-pool', query: `${name} exterior facade pool gardens` },
  ];
}

// ─── Image filtering ───────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif', // discarded later in upload phase but kept here for visibility
]);

// Heuristics: reject tiny placeholder / icon / social sprites.
const REJECT_HINTS = [
  '/icon',
  '/icons/',
  '/logo',
  '/sprite',
  '/favicon',
  '/social',
  '/share-',
  '-icon.',
  '-logo.',
  'placeholder',
  'thumbnail-small',
  'avatar',
  '/wp-content/themes/',
];

/**
 * Hostname blocklist (`HOSTNAME_BLOCKLIST_GLOBAL`) is centralised in
 * `parent-group-mapping.ts`. Same source of truth for discovery,
 * upload, and the catalogue audit.
 */

function extractExtension(url: string): string | null {
  try {
    const u = new URL(url);
    const lastSegment = u.pathname.split('/').pop() ?? '';
    const dot = lastSegment.lastIndexOf('.');
    if (dot === -1) return null;
    return (
      lastSegment
        .slice(dot + 1)
        .toLowerCase()
        .split('?')[0] ?? null
    );
  } catch {
    return null;
  }
}

function looksLikeRejectedAsset(url: string): boolean {
  const low = url.toLowerCase();
  return REJECT_HINTS.some((hint) => low.includes(hint));
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ─── Discovery loop ────────────────────────────────────────────────────────

async function discoverForHotel(hotel: HotelRow): Promise<DiscoveryReport> {
  const domains = inferDomainList(hotel.slug, hotel.official_url, hotel.luxury_tier);
  const queries = buildQueries(hotel);

  // url → { description, fromQueries[] }
  const buckets = new Map<string, { description: string | null; fromQueries: string[] }>();

  const queryStats: { label: string; query: string; imageCount: number }[] = [];

  for (const { label, query } of queries) {
    const response = await tavilySearch({
      query,
      searchDepth: 'advanced',
      maxResults: 10,
      includeImages: true,
      includeImageDescriptions: true,
      // Restrict to the trusted domains (own + parent group). Tavily
      // applies this to the result pages; images themselves can live
      // on any CDN those pages reference (Contentful, Wix, GCS…).
      // Legitimacy is therefore inherited from the source page.
      ...(domains.length > 0 ? { includeDomains: [...domains] } : {}),
    });

    let kept = 0;
    for (const img of response.images) {
      if (passesFilter(img)) {
        kept += 1;
        const existing = buckets.get(img.url);
        if (existing) {
          if (!existing.fromQueries.includes(label)) existing.fromQueries.push(label);
          if (!existing.description && img.description) existing.description = img.description;
        } else {
          buckets.set(img.url, {
            description: img.description,
            fromQueries: [label],
          });
        }
      }
    }
    queryStats.push({ label, query, imageCount: kept });
    // Small inter-query pause to stay friendly with Tavily rate limits.
    await sleep(400);
  }

  const images: DiscoveredImage[] = [];
  for (const [url, meta] of buckets) {
    images.push({
      url,
      description: meta.description,
      fromQueries: meta.fromQueries,
      hostname: getHostname(url),
      extension: extractExtension(url),
    });
  }

  // Sort: most-cited first (likely the hero / iconic images), then alpha.
  images.sort((a, b) => {
    if (b.fromQueries.length !== a.fromQueries.length) {
      return b.fromQueries.length - a.fromQueries.length;
    }
    return a.url.localeCompare(b.url);
  });

  return {
    slug: hotel.slug,
    name: hotel.name,
    officialUrl: hotel.official_url,
    inferredDomain: domains.length > 0 ? domains.join(' + ') : null,
    currentGalleryCount: hotel.gallery_count,
    queries: queryStats,
    totalUniqueImages: images.length,
    images,
  };
}

function passesFilter(img: TavilyImage): boolean {
  if (!img.url || img.url.length === 0) return false;
  const ext = extractExtension(img.url);
  if (ext === null || !IMAGE_EXTENSIONS.has(ext)) return false;
  if (looksLikeRejectedAsset(img.url)) return false;
  if (isBlocklistedHostname(getHostname(img.url))) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseCfg = buildSupabaseRestConfig();

  const hotels = await fetchHotelMeta(supabaseCfg, args.slugs);
  if (hotels.length === 0) {
    console.error(`[discover-press-kit] No hotels found for slugs: ${args.slugs.join(',')}`);
    process.exit(2);
  }

  // Recompose in the same order as the input.
  const bySlug = new Map(hotels.map((h) => [h.slug, h]));
  const ordered = args.slugs
    .map((slug) => bySlug.get(slug))
    .filter((h): h is HotelRow => h !== undefined);

  const missingSlugs = args.slugs.filter((s) => !bySlug.has(s));
  if (missingSlugs.length > 0) {
    console.warn(`[discover-press-kit] WARN: slugs not found: ${missingSlugs.join(',')}`);
  }

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');

  console.log(
    `[discover-press-kit] processing ${ordered.length} hotel(s) — output → ${runsDir}\\press-kit-discovery-<slug>-${ts}.json`,
  );

  for (const hotel of ordered) {
    console.log(`\n[${hotel.slug}] (${hotel.name} — ${hotel.city}, ${hotel.country_code ?? '??'})`);
    const domains = inferDomainList(hotel.slug, hotel.official_url, hotel.luxury_tier);
    console.log(`  current gallery_count = ${hotel.gallery_count}`);
    console.log(`  official_url          = ${hotel.official_url ?? 'NONE'}`);
    console.log(
      `  trusted domains       = ${domains.length > 0 ? domains.join(', ') : 'NONE — fallback to global search'}`,
    );

    if (!hotel.official_url) {
      console.warn(
        `  [WARN] No official_url in DB — discovery will run unrestricted (less reliable for legal sourcing). Recommend setting hotels.official_url first.`,
      );
    } else if (isCorporateRootUrl(hotel.official_url)) {
      // 2026-05-31 incident: corporate-root URLs (e.g.
      // `https://www.mandarinoriental.com/`) poison the Tavily crawl
      // with photos from sibling properties. We refuse to source from
      // them — the operator must either set a hotel-specific path
      // (`/hotels/cristallo-cortina`) or null the field out so the
      // parent-DAM-only fallback applies.
      console.error(
        `  [SKIP ] official_url is a corporate root (${hotel.official_url}) — this would mix photos from every property in the chain. Fix the row in Supabase (set a hotel-specific path) before re-running.`,
      );
      continue;
    }

    try {
      const report = await discoverForHotel(hotel);
      console.log(
        `  → ${report.totalUniqueImages} unique image URLs across ${report.queries.length} queries`,
      );
      for (const q of report.queries) {
        console.log(
          `     · ${q.label.padEnd(14)} ${q.imageCount.toString().padStart(3)} image(s) — "${q.query}"`,
        );
      }

      const outPath = resolve(runsDir, `press-kit-discovery-${hotel.slug}-${ts}.json`);
      writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`  → saved ${outPath}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [FAIL] ${msg}`);
    }
  }

  console.log(
    `\n[discover-press-kit] done. Review the JSON files, then run upload-press-kit-images.ts.`,
  );
}

void main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[discover-press-kit] fatal: ${msg}`);
  process.exit(1);
});
