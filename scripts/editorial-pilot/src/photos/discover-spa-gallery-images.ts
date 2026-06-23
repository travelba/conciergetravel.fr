/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Headless-browser SPA gallery image discovery — phase 1 of the Tier-C
 * long-tail photo top-up, for the hotels Tavily-extract CANNOT read.
 *
 * Context (2026-06-22 chantier): a residual of ~12 published hotels still
 * sit under 10 `gallery_images`. Many share one trait — their official
 * site is a **JS single-page-app** (Next.js / React slider, lightbox,
 * lazy-loaded `<img>`) whose gallery is empty in the static HTML, so
 * `tavily_extract` (and the markdown image-ref fallback) return 0 usable
 * photos. The capitalised verdict in `.cursor/skills/photo-pipeline/SKILL.md`
 * §JS-SPA: the only legal source left is to RENDER the official page in a
 * real browser, let the JS hydrate, open/scroll the gallery, and harvest
 * the DOM. That is what this script does.
 *
 * Pipeline position (mirrors `discover-official-site-images.ts`):
 *   1. Resolve a CLEAN official seed URL (per-slug override → DB
 *      `official_url` passing the toxic/blocklist/corporate-root veto).
 *   2. Render the seed in headless Chromium (Playwright, reused from the
 *      e2e dep tree of `apps/web` via `createRequire` — no new package).
 *      Accept cookies, click gallery/lightbox toggles, scroll to trigger
 *      lazy-load, then extract the highest-resolution image URLs from the
 *      rendered DOM: `<img src/currentSrc/srcset>`, `<source srcset>`,
 *      CSS `background-image`, `<a href>` → image, `__NEXT_DATA__` /
 *      ld+json / preload-link JSON blobs.
 *   3. Filter to property scope: trusted domain (own + parent-group DAM)
 *      OR globally-whitelisted CDN, reject logos/icons/sprites/social/
 *      framework-bundle assets, min width ~1000px, dedup by image identity
 *      keeping the best-resolution variant. Aligned with
 *      `upload-press-kit-images.ts`'s `passesSourceFilter` so every
 *      candidate written here survives phase 2's source gate.
 *   4. Write `press-kit-discovery-<slug>-<ts>.json` — the SAME schema
 *      `upload-press-kit-images.ts` consumes, so the Vision (real-photo +
 *      category + alt/caption + quality) + Cloudinary strict-APPEND +
 *      leak-guard phase 2 is reused verbatim (no duplicated logic).
 *
 * READ-ONLY on the DB. The only writes are JSON files in `runs/`:
 *   - one `press-kit-discovery-<slug>-<ts>.json` per hotel, AND
 *   - one `spa-gallery-backup-<date>.json` snapshotting every target's
 *     current `{id, slug, hero_image, gallery_images}` BEFORE phase 2
 *     ever touches the DB (the mission's mandatory pre-write backup).
 *
 * No supplier URL ever reaches Supabase / the HTML — phase 2 uploads to
 * Cloudinary (`cct/hotels/<slug>/press-<N>`) and stores only the
 * Cloudinary public_id.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/discover-spa-gallery-images.ts \
 *     --slugs=kempinski-residences-and-suites-doha,yihe-mansions \
 *     --max-scroll=14 --settle-ms=4500
 *
 *   --backup-only : write the spa-gallery backup snapshot and exit (no
 *                   browser). Useful to capture the pre-write DB state.
 *   --headful     : launch a visible browser (local debugging only).
 *
 * Skills: photo-pipeline, photo-quality-seo-geo-agentique,
 *         content-enrichment-pipeline, windows-dev-environment
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isToxicOfficialUrl } from '../enrichment/toxic-official-url.js';
import { loadPhotoEnv } from './env-photos.js';
import {
  isBlocklistedHostname,
  isCorporateRootUrl,
  isWhitelistedHostname,
  trustedDomainsForHotel,
} from './parent-group-mapping.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── Minimal Playwright surface (typed locally; module loaded at runtime) ────
//
// We DON'T add `playwright` to `editorial-pilot`'s package.json — it's
// already in the tree via `apps/web`'s `@playwright/test` dev dep (pnpm
// isolated node-linker hides it from this package's `node_modules`, so a
// bare `import` fails type resolution AND runtime). `createRequire` rooted
// at `apps/web/package.json` resolves it. This minimal interface covers
// only the calls we make.

interface PwRawImage {
  readonly url: string;
  readonly w: number;
  readonly source: string;
}

interface PwPage {
  goto(
    url: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number },
  ): Promise<unknown>;
  waitForLoadState(state: 'networkidle', opts?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<R>(fn: () => R): Promise<R>;
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  mouse: { wheel(deltaX: number, deltaY: number): Promise<void> };
  close(): Promise<void>;
}

interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}

interface PwBrowser {
  newContext(opts?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    locale?: string;
    deviceScaleFactor?: number;
    ignoreHTTPSErrors?: boolean;
  }): Promise<PwContext>;
  close(): Promise<void>;
}

interface PwChromium {
  launch(opts?: { headless?: boolean; args?: readonly string[] }): Promise<PwBrowser>;
}

interface PlaywrightModule {
  readonly chromium: PwChromium;
}

function loadPlaywright(): PlaywrightModule {
  const repoRoot = resolve(__dirname, '..', '..', '..', '..');
  const requireFromWeb = createRequire(resolve(repoRoot, 'apps', 'web', 'package.json'));
  // `chromium` is a non-enumerable lazy getter on the module exports — read
  // it directly rather than probing with `in`/Object.keys (both miss it).
  const mod = requireFromWeb('@playwright/test') as { chromium?: unknown };
  const chromium = mod.chromium;
  if (
    typeof chromium !== 'object' ||
    chromium === null ||
    typeof (chromium as { launch?: unknown }).launch !== 'function'
  ) {
    throw new Error('[discover-spa] @playwright/test did not expose a usable chromium.launch');
  }
  return { chromium: chromium as PwChromium };
}

// ─── Hand-verified official seed URLs (mirrors discover-official-site) ───────

const OFFICIAL_URL_OVERRIDES: Readonly<Record<string, string>> = {
  'six-senses-milan': 'https://www.sixsenses.com/en/hotels/milan',
  'six-senses-bangkok': 'https://www.sixsenses.com/en/hotels/bangkok',
  'la-residence-de-la-pinede': 'https://www.chevalblanc.com/en/maison/st-tropez',
  'the-st-regis-lhasa-resort':
    'https://www.marriott.com/en-us/hotels/lxaxr-the-st-regis-lhasa-resort/overview/',
  'babuino-181': 'https://www.romeluxurysuites.com/babuino181/',
  'margutta-19': 'https://www.margutta19.com/',
  'ovolo-central': 'https://ovolohotels.com/ovolo/central/',
  'fouquet-s-mykonos': 'https://www.hotelsbarriere.com/en/mykonos/fouquets.html',
  'kempinski-hybernska': 'https://www.kempinski.com/en/hotel-hybernska',
  'kempinski-residences-and-suites-doha': 'https://www.kempinski.com/en/residences-doha',
  'yihe-mansions': 'https://www.relaischateaux.com/us/hotel/yihe-mansions',
};

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slugs: readonly string[];
  readonly maxScroll: number;
  readonly navTimeoutMs: number;
  readonly settleMs: number;
  readonly headful: boolean;
  readonly backupOnly: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: readonly string[] = [];
  let maxScroll = 12;
  let navTimeoutMs = 45000;
  let settleMs = 3500;
  let headful = false;
  let backupOnly = false;
  for (const arg of argv) {
    if (arg === '--headful') headful = true;
    else if (arg === '--backup-only') backupOnly = true;
    else if (arg.startsWith('--slug=')) slugs = [arg.slice('--slug='.length).trim()];
    else if (arg.startsWith('--slugs=')) {
      // PowerShell turns an unquoted `a,b,c` value into a space-joined token,
      // so split on commas AND whitespace to be robust to both forms.
      slugs = arg
        .slice('--slugs='.length)
        .split(/[\s,]+/u)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--max-scroll=')) {
      const n = Number.parseInt(arg.slice('--max-scroll='.length), 10);
      if (Number.isFinite(n) && n >= 0) maxScroll = n;
    } else if (arg.startsWith('--nav-timeout-ms=')) {
      const n = Number.parseInt(arg.slice('--nav-timeout-ms='.length), 10);
      if (Number.isFinite(n) && n > 0) navTimeoutMs = n;
    } else if (arg.startsWith('--settle-ms=')) {
      const n = Number.parseInt(arg.slice('--settle-ms='.length), 10);
      if (Number.isFinite(n) && n >= 0) settleMs = n;
    }
  }
  if (slugs.length === 0) {
    throw new Error('[discover-spa] Pass --slug=<s> or --slugs=<a,b,c>');
  }
  return { slugs, maxScroll, navTimeoutMs, settleMs, headful, backupOnly };
}

// ─── Hotel meta ───────────────────────────────────────────────────────────────

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly luxury_tier: string | null;
  readonly official_url: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: ReadonlyArray<Record<string, unknown>>;
  readonly gallery_count: number;
}

interface RawHotelRow {
  readonly id: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly luxury_tier: unknown;
  readonly official_url: unknown;
  readonly hero_image: unknown;
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
  // PostgREST `in.()` filtering via the tiny helper proved brittle with the
  // raw query-string append; fetch the catalogue and filter slugs in JS —
  // robust and the target set is tiny anyway.
  const wanted = new Set(slugs);
  const all = await selectHotels<RawHotelRow>(cfg, {
    columns: 'id,slug,name,city,luxury_tier,official_url,hero_image,gallery_images',
  });
  const raws = all.filter((row) => typeof row.slug === 'string' && wanted.has(row.slug));
  return raws.map((row) => {
    const gallery = Array.isArray(row.gallery_images)
      ? (row.gallery_images as Array<Record<string, unknown>>)
      : [];
    return {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      city: typeof row.city === 'string' ? row.city : '',
      luxury_tier: typeof row.luxury_tier === 'string' ? row.luxury_tier : null,
      official_url: typeof row.official_url === 'string' ? row.official_url : null,
      hero_image: typeof row.hero_image === 'string' ? row.hero_image : null,
      gallery_images: gallery,
      gallery_count: gallery.length,
    };
  });
}

// ─── Seed URL resolution ──────────────────────────────────────────────────────

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

// ─── In-page DOM harvester (runs inside the browser) ─────────────────────────

/**
 * Serialised in the browser context. Collects candidate image URLs from
 * every rendered surface, resolving each to an absolute URL and recording
 * the best-known intrinsic width (from srcset descriptor or naturalWidth).
 * Returns at most `cap` entries to keep the bridge payload bounded.
 */
function harvestImagesInPage(cap: number): PwRawImage[] {
  const out: PwRawImage[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined, w: number, source: string): void => {
    if (!raw) return;
    let abs: string;
    try {
      abs = new URL(raw, document.baseURI).href;
    } catch {
      return;
    }
    if (!abs.startsWith('http')) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({ url: abs, w: Number.isFinite(w) ? w : 0, source });
  };
  const bestFromSrcset = (srcset: string): { url: string; w: number } | null => {
    let best: { url: string; w: number } | null = null;
    for (const part of srcset.split(',')) {
      const seg = part.trim();
      if (seg.length === 0) continue;
      const sp = seg.split(/\s+/u);
      const u = sp[0];
      if (!u) continue;
      const desc = sp[1] ?? '';
      let w = 0;
      if (desc.endsWith('w')) w = Number.parseInt(desc.slice(0, -1), 10) || 0;
      else if (desc.endsWith('x'))
        w = Math.round((Number.parseFloat(desc.slice(0, -1)) || 1) * 1000);
      if (!best || w > best.w) best = { url: u, w };
    }
    return best;
  };

  // 1. <img> — currentSrc (what the browser actually picked) + srcset max + src.
  for (const img of Array.from(document.images)) {
    const nat = img.naturalWidth || 0;
    if (img.srcset) {
      const b = bestFromSrcset(img.srcset);
      if (b) push(b.url, b.w || nat, 'img-srcset');
    }
    push(img.currentSrc || img.src, nat, 'img-src');
  }

  // 2. <source srcset> inside <picture>.
  for (const s of Array.from(document.querySelectorAll('source[srcset]'))) {
    const ss = s.getAttribute('srcset');
    if (ss) {
      const b = bestFromSrcset(ss);
      if (b) push(b.url, b.w, 'source-srcset');
    }
  }

  // 3. CSS background-image on common gallery/hero containers + inline styles.
  const bgSelectors =
    '[style*="background"],[class*="gallery"],[class*="slide"],[class*="hero"],[class*="banner"],[class*="carousel"],[data-bg],[data-background]';
  for (const el of Array.from(document.querySelectorAll(bgSelectors)).slice(0, 600)) {
    const dataBg = el.getAttribute('data-bg') ?? el.getAttribute('data-background');
    if (dataBg) push(dataBg, 0, 'data-bg');
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      for (const m of bg.matchAll(/url\((['"]?)([^'")]+)\1\)/gu)) {
        push(m[2], 0, 'css-bg');
      }
    }
  }

  // 4. <a href> pointing directly at an image (lightbox anchors).
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? '';
    if (/\.(jpe?g|png|webp|avif)(\?|$)/iu.test(href)) push(href, 0, 'a-href');
  }

  // 5. JSON blobs: __NEXT_DATA__, ld+json, preload links — regex image URLs.
  const blobs: string[] = [];
  const nextData = document.getElementById('__NEXT_DATA__');
  if (nextData?.textContent) blobs.push(nextData.textContent);
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    if (s.textContent) blobs.push(s.textContent);
  }
  for (const blob of blobs) {
    for (const m of blob.matchAll(/https?:\\?\/\\?\/[^"'\\\s]+\.(?:jpe?g|png|webp|avif)/giu)) {
      push(m[0].replace(/\\\//gu, '/'), 0, 'json-blob');
    }
  }
  for (const link of Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'))) {
    push(link.getAttribute('href'), 0, 'preload-link');
    const iss = link.getAttribute('imagesrcset');
    if (iss) {
      const b = bestFromSrcset(iss);
      if (b) push(b.url, b.w, 'preload-srcset');
    }
  }

  return out.slice(0, cap);
}

/** In-page: dismiss common cookie/consent banners by clicking accept buttons. */
function dismissConsentInPage(): void {
  const SELECTORS = [
    '#onetrust-accept-btn-handler',
    '.onetrust-accept-btn-handler',
    '#cookie-accept',
    '#accept-cookies',
    '[aria-label*="accept" i]',
    'button[id*="accept" i]',
    'button[class*="accept" i]',
    'button[data-testid*="accept" i]',
  ];
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement) {
      try {
        el.click();
      } catch {
        /* ignore */
      }
    }
  }
  // Text-based fallback (FR/EN accept buttons).
  const TEXTS = ['accept all', 'accept', "j'accepte", 'tout accepter', 'accepter', 'agree'];
  for (const b of Array.from(document.querySelectorAll('button, a[role="button"]'))) {
    const t = (b.textContent ?? '').trim().toLowerCase();
    if (t.length > 0 && t.length < 30 && TEXTS.some((x) => t === x || t.includes(x))) {
      if (b instanceof HTMLElement) {
        try {
          b.click();
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/** In-page: click gallery / "view photos" toggles to reveal lightbox imagery. */
function openGalleryInPage(): number {
  let clicked = 0;
  const TEXTS = [
    'gallery',
    'galerie',
    'galleria',
    'photos',
    'view gallery',
    'view photos',
    'see all photos',
    'voir les photos',
    'voir la galerie',
    'photo gallery',
  ];
  const candidates = Array.from(
    document.querySelectorAll(
      'button, [role="button"], [class*="gallery"], [class*="lightbox"], a[href^="#"]',
    ),
  );
  for (const el of candidates) {
    if (clicked >= 4) break;
    const t = (el.textContent ?? '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') ?? '').toLowerCase();
    const hay = `${t} ${aria}`;
    if (t.length < 40 && TEXTS.some((x) => hay.includes(x))) {
      if (el instanceof HTMLElement) {
        try {
          el.click();
          clicked += 1;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return clicked;
}

// ─── Node-side filtering ──────────────────────────────────────────────────────

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
  'data:image',
  '.svg',
  // Bundled framework assets (Next.js) are logos / icons / brand chrome,
  // never property photography — both the proxied and raw forms.
  '/_next/static/',
  '_next%2fstatic',
  // R&C global sponsor brand (Blancpain watches) — a partner banner that
  // recurs on every R&C property page; never the hotel itself. Caught
  // 2026-06-22 when Vision mislabeled the Blancpain logo as the façade.
  'blancpain',
];

/** Small-image URL signatures (explicit width params / WP thumbnail suffix). */
function looksTooSmall(url: string): boolean {
  const low = url.toLowerCase();
  // WordPress / Next thumbnail suffix `-150x150.jpg`, `-300x200.webp`.
  const dim = low.match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)/u);
  if (dim) {
    const w = Number.parseInt(dim[1] ?? '0', 10);
    if (w > 0 && w < 800) return true;
  }
  // Explicit width query param.
  const q = low.match(/[?&](?:w|width|sw|mw)=(\d{2,4})\b/u);
  if (q) {
    const w = Number.parseInt(q[1] ?? '0', 10);
    if (w > 0 && w < 800) return true;
  }
  return false;
}

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

function hasImageQueryOrPathHint(url: string): boolean {
  const low = url.toLowerCase();
  if (/[?&](format|fm)=(webp|jpe?g|png|avif)/u.test(low)) return true;
  if (low.includes('io=transform') || low.includes('/transform/')) return true;
  return /\/(images?|media|photos?|gallery|assets?|uploads?)\//u.test(low);
}

/** Is this URL even plausibly a deliverable image (extension or trusted CDN hint)? */
function passesImageShape(url: string): boolean {
  if (!url || url.length === 0) return false;
  if (looksLikeRejectedAsset(url)) return false;
  if (looksTooSmall(url)) return false;
  const host = getHostname(url);
  if (isBlocklistedHostname(host)) return false;
  const ext = extractExtension(url);
  if (ext !== null && IMAGE_EXTENSIONS.has(ext)) return true;
  if (ext === 'svg') return false;
  if (hasImageQueryOrPathHint(url)) return true;
  return false;
}

/** Property-scope gate, aligned with upload-press-kit's passesSourceFilter. */
function passesPropertyScope(url: string, trustedDomains: readonly string[]): boolean {
  const host = getHostname(url).toLowerCase();
  const low = url.toLowerCase();
  if (isBlocklistedHostname(host) || isBlocklistedHostname(low)) return false;
  if (
    trustedDomains.some(
      (d) => host === d || host.endsWith(`.${d}`) || low.includes(`/${d}/`) || low.includes(d),
    )
  ) {
    return true;
  }
  return isWhitelistedHostname(host);
}

/**
 * Rewrite a hotlink-blocked origin asset to its public delivery CDN.
 *
 * Kempinski's DAM serves the SAME asset from two hosts: `www.kempinski.com`
 * (origin — 403s third-party fetch, so OpenAI Vision can't download it →
 * "unsupported image" 400) and `storage.kempinski.com` (Cloudflare image
 * resizer — open, content-negotiated webp). Both share the `/ki-cms-prod/`
 * path marker. Rewrite the origin form to the CDN at a Vision-friendly
 * 2000px so the asset is actually fetchable downstream.
 */
function normalizeDeliverableUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.endsWith('kempinski.com') && u.pathname.includes('/ki-cms-prod/')) {
      const idx = u.pathname.indexOf('/ki-cms-prod/');
      const tail = u.pathname.slice(idx + 1); // strip leading slash → ki-cms-prod/...
      return `https://storage.kempinski.com/cdn-cgi/image/w=2000,f=auto,fit=scale-down,g=auto/${tail}`;
    }
    return url;
  } catch {
    return url;
  }
}

/** Bump a width query param up to a large value to fetch higher-res originals. */
function maximizeWidth(url: string): string {
  try {
    const u = new URL(url);
    let touched = false;
    for (const key of ['w', 'width', 'sw', 'mw']) {
      const cur = u.searchParams.get(key);
      if (cur !== null) {
        const n = Number.parseInt(cur, 10);
        if (Number.isFinite(n) && n < 2000) {
          u.searchParams.set(key, '2000');
          touched = true;
        }
      }
    }
    return touched ? u.href : url;
  } catch {
    return url;
  }
}

/**
 * Stable image identity so the SAME source asset served at different
 * hosts / CDN-resize params / sizes collapses to one entry. Strips the
 * Cloudflare `/cdn-cgi/image/<params>/` resizing prefix and any
 * `key=value` transform path segments (Kempinski's `g=auto`,
 * `w=2560,h=1440,…`), then keys on the last two real path segments
 * (folder id + filename) — host-independent.
 */
function dedupKey(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase().replace(/\/cdn-cgi\/image\/[^/]+\//u, '/');
    const segs = p.split('/').filter((s) => s.length > 0 && !s.includes('='));
    const last2 = segs
      .slice(-2)
      .join('/')
      .replace(/-\d{2,4}x\d{2,4}(?=\.)/u, '');
    return last2.length > 0 ? last2 : p;
  } catch {
    return url.toLowerCase();
  }
}

/** Width requested by an explicit URL param (`w=`/`width=`), 0 if none. */
function urlWidthHint(url: string): number {
  const m = url.toLowerCase().match(/\b(?:w|width)=(\d{2,4})\b/u);
  if (m) {
    const n = Number.parseInt(m[1] ?? '0', 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Selection score for a candidate within a dedup group. We prefer the
 * ~2560px variant: large enough for the SIGNATURE_TRANSFORM yet under
 * the Vision-pass 5 MB fetch cap (a raw 4K original often busts it). An
 * unknown-width original is assumed a respectable 1800px so it still
 * beats explicit thumbnails (w=585) but loses to an explicit 2560.
 */
function variantScore(url: string, srcsetW: number): number {
  const eff = Math.max(urlWidthHint(url), srcsetW) || 1800;
  return Math.min(eff, 2560);
}

// ─── Discovery report (matches upload-press-kit-images.ts schema) ─────────────

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

interface HotelRunResult {
  readonly slug: string;
  readonly before: number;
  readonly seed: string | null;
  readonly raw: number;
  readonly candidates: number;
  readonly status: 'ok' | 'no-seed' | 'nav-fail' | 'empty';
  readonly reason: string;
}

// ─── Per-hotel headless run ───────────────────────────────────────────────────

async function discoverForHotel(
  browser: PwBrowser,
  hotel: HotelRow,
  seed: string,
  args: CliArgs,
  runsDir: string,
  ts: string,
): Promise<HotelRunResult> {
  const trusted = trustedDomainsForHotel({
    slug: hotel.slug,
    officialUrl: seed,
    luxuryTier: hotel.luxury_tier,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2400 },
    locale: 'en-US',
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  let raw: PwRawImage[] = [];
  try {
    await page.goto(seed, { waitUntil: 'domcontentloaded', timeout: args.navTimeoutMs });
    try {
      await page.waitForLoadState('networkidle', { timeout: 12000 });
    } catch {
      /* networkidle is best-effort on chatty analytics sites */
    }
    await page.waitForTimeout(args.settleMs);

    // tsx/esbuild's `keepNames` wraps every named function/arrow in a
    // `__name(fn, "…")` helper. When Playwright serialises our harvest
    // helpers to run them in the page, that helper is undefined in the
    // browser → `ReferenceError: __name is not defined`. Shim it first.
    // This arrow has no nested named functions, so it stays __name-free.
    await page.evaluate(() => {
      (globalThis as unknown as { __name?: unknown }).__name = (fn: unknown): unknown => fn;
    });

    // Dismiss cookie consent then settle.
    await page.evaluate(dismissConsentInPage);
    await page.waitForTimeout(800);

    // Try to open the gallery / lightbox.
    const clicks = await page.evaluate(openGalleryInPage);
    if (clicks > 0) await page.waitForTimeout(1500);

    // Scroll to trigger lazy-load.
    for (let i = 0; i < args.maxScroll; i += 1) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(550);
    }
    // Final settle for any late image swaps.
    await page.waitForTimeout(800);
    raw = await page.evaluate(harvestImagesInPage, 600);
  } catch (e) {
    await context.close();
    return {
      slug: hotel.slug,
      before: hotel.gallery_count,
      seed,
      raw: 0,
      candidates: 0,
      status: 'nav-fail',
      reason: e instanceof Error ? e.message.slice(0, 120) : String(e),
    };
  }
  await context.close();

  // Node-side filter → property scope → dedup (keep best-resolution variant).
  const best = new Map<string, { url: string; score: number }>();
  for (const item of raw) {
    if (!passesImageShape(item.url)) continue;
    if (!passesPropertyScope(item.url, trusted)) continue;
    const url = normalizeDeliverableUrl(maximizeWidth(item.url));
    const key = dedupKey(url);
    const score = variantScore(url, item.w);
    const existing = best.get(key);
    if (!existing || score > existing.score) best.set(key, { url, score });
  }

  const images: DiscoveredImage[] = [...best.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .map(({ url }) => ({
      url,
      description: null,
      fromQueries: ['headless-spa'],
      hostname: getHostname(url),
      extension: extractExtension(url),
    }));

  const report: DiscoveryReport = {
    slug: hotel.slug,
    name: hotel.name,
    officialUrl: seed,
    inferredDomain: trusted.length > 0 ? trusted.join(' + ') : null,
    currentGalleryCount: hotel.gallery_count,
    totalUniqueImages: images.length,
    images,
  };
  const outPath = resolve(runsDir, `press-kit-discovery-${hotel.slug}-${ts}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');

  return {
    slug: hotel.slug,
    before: hotel.gallery_count,
    seed,
    raw: raw.length,
    candidates: images.length,
    status: images.length > 0 ? 'ok' : 'empty',
    reason: images.length > 0 ? `saved ${images.length} candidate(s)` : 'no-property-scope-images',
  };
}

// ─── Backup snapshot (mandatory pre-write) ────────────────────────────────────

function writeBackup(hotels: readonly HotelRow[], runsDir: string, dateStr: string): string {
  const snapshot = hotels.map((h) => ({
    id: h.id,
    slug: h.slug,
    hero_image: h.hero_image,
    gallery_images: h.gallery_images,
    gallery_count: h.gallery_count,
  }));
  const path = resolve(runsDir, `spa-gallery-backup-${dateStr}.json`);
  writeFileSync(
    path,
    JSON.stringify({ takenAt: new Date().toISOString(), hotels: snapshot }, null, 2),
    'utf-8',
  );
  return path;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = buildSupabaseCfg();

  const hotels = await fetchHotelMeta(cfg, args.slugs);
  if (hotels.length === 0) {
    console.error(`[discover-spa] No hotels found for: ${args.slugs.join(',')}`);
    process.exit(2);
  }
  const bySlug = new Map(hotels.map((h) => [h.slug, h]));
  const ordered = args.slugs
    .map((s) => bySlug.get(s))
    .filter((h): h is HotelRow => h !== undefined);

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');
  const dateStr = new Date().toISOString().slice(0, 10);

  // Mandatory pre-write backup of every target's current photo state.
  const backupPath = writeBackup(ordered, runsDir, dateStr);
  console.log(`[discover-spa] backup → ${backupPath}`);

  if (args.backupOnly) {
    console.log('[discover-spa] --backup-only: done.');
    return;
  }

  const pw = loadPlaywright();
  const browser = await pw.chromium.launch({
    headless: !args.headful,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const results: HotelRunResult[] = [];
  try {
    for (const hotel of ordered) {
      console.log(
        `\n[${hotel.slug}] ${hotel.name} — ${hotel.city} (${hotel.gallery_count} photos)`,
      );
      const { seed, source, reason } = resolveSeed(hotel);
      if (seed === null) {
        console.warn(`  [SKIP] non-sourceable: ${reason}`);
        results.push({
          slug: hotel.slug,
          before: hotel.gallery_count,
          seed: null,
          raw: 0,
          candidates: 0,
          status: 'no-seed',
          reason,
        });
        continue;
      }
      console.log(`  seed (${source}): ${seed}`);
      const r = await discoverForHotel(browser, hotel, seed, args, runsDir, ts);
      console.log(`  → raw=${r.raw} candidates=${r.candidates} [${r.status}] ${r.reason}`);
      results.push(r);
      await sleep(500);
    }
  } finally {
    await browser.close();
  }

  console.log('\n[discover-spa] SUMMARY');
  for (const r of results) {
    console.log(
      `  ${r.slug.padEnd(40)} before=${String(r.before).padStart(2)} raw=${String(r.raw).padStart(3)} cand=${String(r.candidates).padStart(3)} [${r.status}] ${r.reason}`,
    );
  }
  console.log(`\n[discover-spa] discovery JSON timestamp suffix: ${ts}`);
  console.log(
    '[discover-spa] phase 2: upload-press-kit-images.ts --discovery-dir=runs --slugs=<...>',
  );
}

void main().catch((e: unknown) => {
  console.error(`[discover-spa] fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
