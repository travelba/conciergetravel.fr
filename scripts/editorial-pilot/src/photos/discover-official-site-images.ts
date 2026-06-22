/**
 * Official-site image discovery via Tavily **extract** — phase 1 of the
 * Tier-C long-tail photo top-up.
 *
 * Context (2026-06-22 chantier): ~15 published hotels still sit under 10
 * `gallery_images` because Google Places returned a thin set (obscure
 * independents, Relais & Châteaux lodges, pre-opening / residences
 * properties). Google Places is exhausted for them — the next most
 * defensible legal source is the hotel's **own official / brand site**
 * (`.cursor/skills/photo-pipeline/SKILL.md` §Legal hygiene: official
 * site > Google Places > nothing; NEVER Pinterest / OTA / hotlink).
 *
 * This is the discovery phase (READ-ONLY on the DB). For each hotel it:
 *   1. Resolves a CLEAN official seed URL:
 *        a. a hand-verified per-slug override (this file), else
 *        b. the DB `official_url` IF it passes the toxic / blocklist /
 *           corporate-root veto, else
 *        c. → marked non-sourceable (skipped, reported).
 *   2. Runs Tavily **extract** (`include_images:true`, advanced depth)
 *      on the seed homepage, then on a bounded set of same-domain
 *      gallery/rooms/dining subpages discovered in the homepage
 *      markdown — this is the explicit `tavily_extract` step the PO
 *      asked for (hits the URL directly, renders JS, no search-index
 *      dependency — the right tool for single-property sites).
 *   3. ALSO runs a domain-restricted Tavily **search**
 *      (`include_images:true`) for extra recall on the parent-group DAM
 *      (R&C / Six Senses / Marriott …), reusing the proven
 *      `discover-press-kit-images.ts` query shape.
 *   4. Filters (extension + reject-hints + hostname blocklist), dedups,
 *      and writes a `press-kit-discovery-<slug>-<ts>.json` report — the
 *      SAME schema `upload-press-kit-images.ts` consumes, so the Vision
 *      + Cloudinary APPEND + leak-guard phase 2 is reused verbatim.
 *
 * No supplier URL ever reaches Supabase / the HTML: phase 2 uploads to
 * Cloudinary (`cct/hotels/<slug>/press-<N>`) and stores only the
 * Cloudinary public_id. This script only writes a JSON report on disk.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/discover-official-site-images.ts \
 *     --slugs=six-senses-milan,la-residence-de-la-pinede --set-official
 *
 *   --set-official : PATCH hotels.official_url with the verified seed
 *                    when the DB value is NULL or failed the veto (table
 *                    `hotels` only — improves EEAT + lets phase 2 trust
 *                    the host). Off by default (read-only).
 *
 * Output: scripts/editorial-pilot/runs/press-kit-discovery-<slug>-<ts>.json
 *
 * Skills: photo-pipeline, photo-quality-seo-geo-agentique,
 *         content-enrichment-pipeline, api-integration
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '../env.js';
import { isToxicOfficialUrl } from '../enrichment/toxic-official-url.js';
import { tavilySearch, type TavilyImage } from '../enrichment/tavily-client.js';
import { loadPhotoEnv } from './env-photos.js';
import {
  isBlocklistedHostname,
  isCorporateRootUrl,
  isWhitelistedHostname,
  trustedDomainsForHotel,
} from './parent-group-mapping.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── Hand-verified official seed URLs ──────────────────────────────────────

/**
 * Per-slug verified official / brand URL. Used when the DB `official_url`
 * is NULL or fails the veto (squatter / OTA / blog). Every entry here was
 * eyeballed by a human — these are the hotel's own site or the operating
 * brand's dedicated property page, NEVER a corporate root. Keep small.
 *
 * Why an explicit map instead of `backfill-official-url.ts`: that script's
 * confidence rubric is (correctly) conservative for unattended catalogue
 * runs and rejects legitimate brand-path URLs (`chevalblanc.com/.../st-tropez`,
 * `marriott.com/.../the-st-regis-lhasa-resort`). For this hand-verified
 * 15-hotel batch we pin them and accept the small maintenance debt.
 */
const OFFICIAL_URL_OVERRIDES: Readonly<Record<string, string>> = {
  // Six Senses Milan — group DAM (cdn.sixsenses.com whitelisted).
  'six-senses-milan': 'https://www.sixsenses.com/en/hotels/milan',
  // Six Senses Bangkok — pre-opening property page (may be thin).
  'six-senses-bangkok': 'https://www.sixsenses.com/en/hotels/bangkok',
  // Ex-Résidence de la Pinède = Cheval Blanc St-Tropez (chevalblanc.com whitelisted).
  'la-residence-de-la-pinede': 'https://www.chevalblanc.com/en/maison/st-tropez',
  // St. Regis Lhasa — Marriott property page (cache.marriott.com whitelisted).
  'the-st-regis-lhasa-resort':
    'https://www.marriott.com/en-us/hotels/lxaxr-the-st-regis-lhasa-resort/overview/',
  // SLH Rome boutiques — own dedicated sites.
  'babuino-181': 'https://www.romeluxurysuites.com/babuino181/',
  'margutta-19': 'https://www.margutta19.com/',
  // Ovolo Central HK — group property page.
  'ovolo-central': 'https://ovolohotels.com/ovolo/central/',
  // Fouquet's Mykonos — Barrière brand page.
  'fouquet-s-mykonos': 'https://www.hotelsbarriere.com/en/mykonos/fouquets.html',
  // Kempinski Prague (Hybernská) — brand page.
  'kempinski-hybernska': 'https://www.kempinski.com/en/hotel-hybernska',
  // Kempinski Residences & Suites Doha — brand page.
  'kempinski-residences-and-suites-doha': 'https://www.kempinski.com/en/residences-doha',
};

// ─── CLI ────────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slugs: readonly string[];
  readonly setOfficial: boolean;
  readonly maxSubpages: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: readonly string[] = [];
  let setOfficial = false;
  let maxSubpages = 4;
  for (const arg of argv) {
    if (arg === '--set-official') setOfficial = true;
    else if (arg.startsWith('--slug=')) slugs = [arg.slice('--slug='.length).trim()];
    else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--max-subpages=')) {
      const n = Number.parseInt(arg.slice('--max-subpages='.length), 10);
      if (Number.isFinite(n) && n >= 0) maxSubpages = n;
    }
  }
  if (slugs.length === 0) {
    throw new Error('[discover-official] Pass --slug=<s> or --slugs=<a,b,c>');
  }
  return { slugs, setOfficial, maxSubpages };
}

// ─── Hotel meta ──────────────────────────────────────────────────────────────

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly official_url: string | null;
  readonly gallery_count: number;
}

interface RawHotelRow {
  readonly id: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly country_code: unknown;
  readonly luxury_tier: unknown;
  readonly official_url: unknown;
  readonly gallery_images: unknown;
}

function buildSupabaseCfg(): SupabaseRestConfig {
  const env = loadPhotoEnv();
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

async function fetchHotelMeta(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<readonly HotelRow[]> {
  const inFilter = `slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
  const raws = await selectHotels<RawHotelRow>(cfg, {
    columns: 'id,slug,name,city,country_code,luxury_tier,official_url,gallery_images',
    filters: [inFilter],
  });
  return raws.map((row) => {
    const gallery = Array.isArray(row.gallery_images) ? row.gallery_images : [];
    return {
      id: String(row.id),
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

// ─── Seed URL resolution ─────────────────────────────────────────────────────

interface SeedResolution {
  readonly seed: string | null;
  readonly source: 'override' | 'db-clean' | 'none';
  readonly reason: string;
}

function urlIsClean(url: string): { ok: boolean; reason: string } {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
  if (isToxicOfficialUrl(url)) return { ok: false, reason: 'toxic-squatter' };
  if (isBlocklistedHostname(host)) return { ok: false, reason: 'blocklisted-host' };
  if (isCorporateRootUrl(url)) return { ok: false, reason: 'corporate-root' };
  return { ok: true, reason: 'clean' };
}

function resolveSeed(hotel: HotelRow): SeedResolution {
  const override = OFFICIAL_URL_OVERRIDES[hotel.slug];
  if (override) {
    const v = urlIsClean(override);
    if (v.ok) return { seed: override, source: 'override', reason: 'hand-verified' };
    return { seed: null, source: 'none', reason: `override-failed-veto(${v.reason})` };
  }
  if (hotel.official_url) {
    const v = urlIsClean(hotel.official_url);
    if (v.ok) return { seed: hotel.official_url, source: 'db-clean', reason: 'db-official-url' };
    return { seed: null, source: 'none', reason: `db-url-unusable(${v.reason})` };
  }
  return { seed: null, source: 'none', reason: 'no-official-url' };
}

// ─── Tavily extract (include_images) — self-contained ────────────────────────

interface ExtractImagesResult {
  readonly images: readonly string[];
  readonly markdown: string;
}

const TAVILY_KEY = loadEnv().TAVILY_API_KEY;

/**
 * Self-contained POST to Tavily /extract with `include_images:true`.
 * The shared `tavily-client.ts` helper doesn't expose `include_images`
 * on extract, and we keep this script to a single new file (no edit to
 * the shared client the parallel `places` worker may rely on). Returns
 * both the discovered image URLs and the page markdown (used to find
 * same-domain gallery subpages).
 */
async function extractWithImages(url: string): Promise<ExtractImagesResult> {
  if (!TAVILY_KEY) throw new Error('TAVILY_API_KEY missing');
  const body = {
    urls: [url],
    extract_depth: 'advanced',
    include_images: true,
    format: 'markdown',
  };
  const MAX = 4;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX; attempt += 1) {
    try {
      const res = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TAVILY_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const t = await res.text();
        if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
          await sleep(1500 * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`Tavily extract ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        results?: { url?: string; raw_content?: string; images?: unknown }[];
      };
      const first = json.results?.[0];
      const rawImages = Array.isArray(first?.images) ? first?.images : [];
      const images = rawImages.filter((i): i is string => typeof i === 'string' && i.length > 0);
      // Also harvest markdown image refs `![alt](url)` as a fallback —
      // some pages expose images only inline, not in the images[] array.
      const markdown = typeof first?.raw_content === 'string' ? first.raw_content : '';
      const mdImgs = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gu)].map(
        (m) => m[1] as string,
      );
      return { images: [...new Set([...images, ...mdImgs])], markdown };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX) await sleep(1500 * 2 ** (attempt - 1));
    }
  }
  throw lastErr ?? new Error('extract failed');
}

/**
 * From the homepage markdown, find up to `max` same-domain subpage URLs
 * whose path hints at a gallery / rooms / dining section (the richest
 * image pages). Keeps Tavily extract credit usage bounded.
 */
const SUBPAGE_HINTS = [
  'galer', // gallery / galerie / galleria
  'photo',
  'room',
  'chambre',
  'suite',
  'accommod',
  'aloggi',
  'dining',
  'restaurant',
  'cuisine',
  'spa',
  'wellness',
  'pool',
  'the-hotel',
  'hotel',
  'la-maison',
  'maison',
  'resort',
];

/** Number of non-empty path segments. `/en/hotels/milan` → 3, `/` → 0. */
function pathDepth(pathname: string): number {
  return pathname.split('/').filter((s) => s.length > 0).length;
}

/**
 * Find up to `max` same-domain gallery/rooms subpages.
 *
 * CRITICAL correctness guard: on a multi-property brand domain
 * (sixsenses.com, marriott.com, kempinski.com …) the property homepage
 * links to EVERY sibling property via the global nav. Crawling those by a
 * loose hint match contaminates the fiche with another hotel's photos, and
 * Vision CANNOT catch cross-property contamination (a Six Senses Bhutan pool
 * looks like a luxury pool). So when the seed itself is a deep property path
 * (depth ≥ 2, e.g. `/en/hotels/milan`), we ONLY accept subpages whose path
 * starts with the seed prefix (`/en/hotels/milan/...`). For shallow
 * single-property roots (depth ≤ 1) we keep the broader hint match.
 */
function findSubpages(
  markdown: string,
  seedHost: string,
  seedPathPrefix: string,
  max: number,
): readonly string[] {
  if (max <= 0) return [];
  const bareHost = seedHost.replace(/^www\./u, '');
  const prefix = seedPathPrefix.replace(/\/$/u, '').toLowerCase();
  const prefixIsDeep = pathDepth(prefix) >= 2;
  const links = [...markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/gu)].map((m) => m[1] as string);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    let host: string;
    let path: string;
    try {
      const u = new URL(link);
      host = u.hostname.toLowerCase().replace(/^www\./u, '');
      path = u.pathname.toLowerCase();
    } catch {
      continue;
    }
    if (host !== bareHost) continue;
    if (path === '' || path === '/') continue;
    if (prefixIsDeep) {
      // Only same-property children of the deep seed path.
      if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
    } else if (!SUBPAGE_HINTS.some((h) => path.includes(h))) {
      continue;
    }
    const normalized = link.split('#')[0] ?? link;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= max) break;
  }
  return out;
}

// ─── Image filtering ─────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

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
  'logo-',
  'placeholder',
  'thumbnail-small',
  'avatar',
  '/wp-content/themes/',
  'pixel',
  '/flags/',
  'spinner',
  'loader',
];

function extractExtension(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop() ?? '';
    const dot = last.lastIndexOf('.');
    if (dot === -1) return null;
    return (
      last
        .slice(dot + 1)
        .toLowerCase()
        .split('?')[0] ?? null
    );
  } catch {
    return null;
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function looksLikeRejectedAsset(url: string): boolean {
  const low = url.toLowerCase();
  return REJECT_HINTS.some((h) => low.includes(h));
}

/**
 * Many luxury DAMs serve photos through EXTENSIONLESS CDN URLs — R&C's
 * `d1m7xnn75ypr6t.cloudfront.net/images/media/<UUID>` and
 * `…/transform/<UUID>/?io=transform&format=webp`, Contentful, imgix… An
 * extension-only filter silently drops 100% of these (yihe-mansions /
 * royal-chundu pulled 49-56 real photos but kept 0). Accept an
 * extensionless URL only when (a) the host is a globally-trusted image
 * CDN AND (b) the path/query looks like a delivered image (so we still
 * reject the CDN's JS/CSS/API endpoints).
 */
function hasImageQueryOrPathHint(url: string): boolean {
  const low = url.toLowerCase();
  if (/[?&](format|fm)=(webp|jpe?g|png|avif)/u.test(low)) return true;
  if (low.includes('io=transform') || low.includes('/transform/')) return true;
  return /\/(images?|media|photos?|gallery|assets?|uploads?)\//u.test(low);
}

function passesImageFilter(url: string): boolean {
  if (!url || url.length === 0) return false;
  if (looksLikeRejectedAsset(url)) return false;
  const host = getHostname(url);
  if (isBlocklistedHostname(host)) return false;
  const ext = extractExtension(url);
  if (ext !== null && IMAGE_EXTENSIONS.has(ext)) return true;
  // Extensionless (or transform-suffixed) — only trust whitelisted CDNs
  // that actually look like they're serving an image.
  if (ext === 'svg') return false; // logos / icons
  if (isWhitelistedHostname(host) && hasImageQueryOrPathHint(url)) return true;
  return false;
}

// ─── Discovery report (matches upload-press-kit-images.ts schema) ────────────

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
  readonly totalUniqueImages: number;
  readonly images: readonly DiscoveredImage[];
}

function buildQueries(name: string): readonly { label: string; query: string }[] {
  return [
    { label: 'rooms-suites', query: `${name} rooms suites accommodations` },
    { label: 'dining-spa', query: `${name} restaurant dining spa pool` },
    { label: 'exterior', query: `${name} exterior facade gardens view` },
  ];
}

async function discoverForHotel(hotel: HotelRow, seed: string): Promise<DiscoveryReport> {
  const seedHost = getHostname(seed).toLowerCase();
  let seedPath = '/';
  try {
    seedPath = new URL(seed).pathname;
  } catch {
    seedPath = '/';
  }
  // A deep property path on a brand domain (e.g. /en/hotels/milan) means the
  // domain hosts many other hotels — the domain-restricted SEARCH would pull
  // their photos, which Vision can't reject. Only run the broad search for
  // shallow single-property seeds (depth ≤ 1).
  const seedIsSingleProperty = pathDepth(seedPath) <= 1;
  const trusted = trustedDomainsForHotel({
    slug: hotel.slug,
    officialUrl: seed,
    luxuryTier: hotel.luxury_tier,
  });

  // url → { description, fromQueries[] }
  const buckets = new Map<string, { description: string | null; fromQueries: string[] }>();
  const add = (url: string, label: string, description: string | null): void => {
    if (!passesImageFilter(url)) return;
    const existing = buckets.get(url);
    if (existing) {
      if (!existing.fromQueries.includes(label)) existing.fromQueries.push(label);
      if (!existing.description && description) existing.description = description;
    } else {
      buckets.set(url, { description, fromQueries: [label] });
    }
  };

  // 1. Tavily EXTRACT on the seed homepage.
  let homepageMarkdown = '';
  try {
    const home = await extractWithImages(seed);
    homepageMarkdown = home.markdown;
    for (const u of home.images) add(u, 'extract:home', null);
    console.log(`    extract:home          ${home.images.length} raw image URL(s)`);
  } catch (e) {
    console.warn(`    [extract:home FAIL] ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Tavily EXTRACT on bounded same-PROPERTY gallery/rooms subpages.
  const subpages = findSubpages(homepageMarkdown, seedHost, seedPath, 4);
  for (const sub of subpages) {
    await sleep(500);
    try {
      const r = await extractWithImages(sub);
      for (const u of r.images) add(u, 'extract:subpage', null);
      console.log(`    extract:subpage       ${r.images.length} from ${sub.slice(0, 70)}`);
    } catch (e) {
      console.warn(
        `    [extract:subpage FAIL] ${sub.slice(0, 60)} — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // 3. Domain-restricted Tavily SEARCH (include_images) for extra recall —
  //    SKIPPED for deep brand-property seeds to avoid cross-property leakage.
  if (!seedIsSingleProperty) {
    console.log('    search:skipped (multi-property brand domain — extract-only)');
  }
  for (const { label, query } of seedIsSingleProperty ? buildQueries(hotel.name) : []) {
    await sleep(400);
    try {
      const resp = await tavilySearch({
        query,
        searchDepth: 'advanced',
        maxResults: 10,
        includeImages: true,
        includeImageDescriptions: true,
        ...(trusted.length > 0 ? { includeDomains: [...trusted] } : {}),
      });
      let kept = 0;
      for (const img of resp.images) {
        if (passesImageFilter(img.url)) kept += 1;
        add(img.url, `search:${label}`, img.description);
      }
      console.log(`    search:${label.padEnd(12)}  ${kept} image(s)`);
    } catch (e) {
      console.warn(`    [search:${label} FAIL] ${e instanceof Error ? e.message : String(e)}`);
    }
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
  // Most-cited first (likely hero), then alpha.
  images.sort((a, b) => {
    if (b.fromQueries.length !== a.fromQueries.length) {
      return b.fromQueries.length - a.fromQueries.length;
    }
    return a.url.localeCompare(b.url);
  });

  return {
    slug: hotel.slug,
    name: hotel.name,
    officialUrl: seed,
    inferredDomain: trusted.length > 0 ? trusted.join(' + ') : null,
    currentGalleryCount: hotel.gallery_count,
    totalUniqueImages: images.length,
    images,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = buildSupabaseCfg();

  const hotels = await fetchHotelMeta(cfg, args.slugs);
  if (hotels.length === 0) {
    console.error(`[discover-official] No hotels found for: ${args.slugs.join(',')}`);
    process.exit(2);
  }
  const bySlug = new Map(hotels.map((h) => [h.slug, h]));
  const ordered = args.slugs
    .map((s) => bySlug.get(s))
    .filter((h): h is HotelRow => h !== undefined);

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');

  console.log(
    `[discover-official] ${ordered.length} hotel(s) — setOfficial=${args.setOfficial} — out → ${runsDir}\\press-kit-discovery-<slug>-${ts}.json`,
  );

  const residuals: { slug: string; reason: string }[] = [];

  for (const hotel of ordered) {
    console.log(`\n[${hotel.slug}] ${hotel.name} — ${hotel.city} (${hotel.gallery_count} photos)`);
    const { seed, source, reason } = resolveSeed(hotel);
    if (seed === null) {
      console.warn(`  [SKIP] non-sourceable: ${reason}`);
      residuals.push({ slug: hotel.slug, reason });
      continue;
    }
    console.log(`  seed (${source}): ${seed}`);

    // Optionally fix the DB official_url with the verified seed.
    if (args.setOfficial && source === 'override' && hotel.official_url !== seed) {
      try {
        await patchHotelById(cfg, hotel.id, { official_url: seed });
        console.log(`  [DB] official_url ${hotel.official_url ?? 'NULL'} → ${seed}`);
      } catch (e) {
        console.warn(
          `  [DB-FAIL] could not set official_url: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    try {
      const report = await discoverForHotel(hotel, seed);
      const outPath = resolve(runsDir, `press-kit-discovery-${hotel.slug}-${ts}.json`);
      writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`  → ${report.totalUniqueImages} unique candidate(s) — saved ${outPath}`);
      if (report.totalUniqueImages === 0) {
        residuals.push({ slug: hotel.slug, reason: 'no-extractable-images' });
      }
    } catch (e) {
      console.error(`  [FAIL] ${e instanceof Error ? e.message : String(e)}`);
      residuals.push({ slug: hotel.slug, reason: 'discovery-error' });
    }
  }

  console.log('\n[discover-official] done.');
  if (residuals.length > 0) {
    console.log('  Non-sourceable / empty:');
    for (const r of residuals) console.log(`    ${r.slug.padEnd(40)} ${r.reason}`);
  }
}

void main().catch((e: unknown) => {
  console.error(`[discover-official] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
