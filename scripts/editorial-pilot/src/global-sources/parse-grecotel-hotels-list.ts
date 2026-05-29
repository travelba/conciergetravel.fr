/**
 * parse-grecotel-hotels-list.ts — extract the canonical list of Grecotel
 * properties from the public `/hotels-list/` index page.
 *
 * Why this page and not the sitemap?
 *   - The WordPress sitemap at https://www.grecotel.com/wp-content/uploads/sitemap.xml
 *     contains only ~75 URLs and does NOT enumerate individual hotel pages
 *     (their permalink lives at the root: `/amirandes/`, `/capesounio/`, …).
 *   - The `/hotels-list/` page is the canonical user-facing index and
 *     renders all properties server-side (WordPress = no SPA, no lazy
 *     load). Plain `curl + regex` is sufficient.
 *
 * Pipeline:
 *   1. Fetch /hotels-list/ HTML (cached to global-sources/_grecotel_hotels_list.html
 *      on first run; re-fetch with --refresh).
 *   2. Extract `href="https://www.grecotel.com/<slug>/"` candidates.
 *   3. Filter against a denylist of non-hotel pages (about, awards,
 *      careers, collection-level landing pages, sitemap, etc.).
 *   4. Emit global-sources/grecotel-hotel-urls.json keyed by sanitized slug.
 *
 * Usage:
 *   pnpm grecotel:list           # parse (uses cache if present)
 *   pnpm grecotel:list --refresh # force re-fetch
 *
 * Skill: api-integration (HTTP discipline), content-modeling, llm-output-robustness.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
mkdirSync(ROOT, { recursive: true });

const CACHE_HTML = resolve(ROOT, '_grecotel_hotels_list.html');
const SOURCE_URL = 'https://www.grecotel.com/hotels-list/';

// Non-hotel slugs surfaced by the same regex on the /hotels-list/ page.
// Curated by hand — these are the WordPress static pages, collection
// landings, marketing categories, and policy/legal pages.
const NON_HOTEL_SLUGS: ReadonlySet<string> = new Set([
  'all-inclusive-collection',
  'awards',
  'careers',
  'contact',
  'family-holidays',
  'greece-hotels-resorts',
  'homes-villas',
  'hotel-restaurants',
  'hotels-list',
  'hotels-resorts-experiences',
  'hotels-resorts-stories',
  'luxury-holiday-deals',
  'luxury-resorts',
  'media-library',
  'news-stories',
  'pets-policy',
  'privacy-policy',
  'sitemap',
  'spa-hotels',
  'sustainability',
  'the-iconic-collection',
  'the-luxme-all-inclusive-collection',
  'wedding-hotels',
  'wp-json',
  'year-round-escapes',
  'about-us',
  'partners-data-protection',
  'hr-data-protection',
  'quotelier',
  'quotelier-en',
  'careers',
  'interns',
  'picasso-in-crete-exhibition',
  'cape-sounio-duplicate',
  'hotel-resorts-duplicate',
  'test-page',
  'test',
  'booking-test',
  'grecotel-location-test',
  'contact-draft',
  'activity',
  'vlt',
  'athens-offices',
  'dine-club-terms-and-conditions',
  'luxme-dining-terms-and-conditions',
  'frequently-asked-questions',
  'refer',
]);

interface HotelEntry {
  /** Canonical slug as printed in the Grecotel URL (e.g. "capesounio", "luxme-whitepalace"). */
  readonly slug: string;
  /** Full canonical URL with trailing slash (Grecotel's permalink format). */
  readonly url: string;
}

async function fetchHotelsList(refresh: boolean): Promise<string> {
  if (!refresh && existsSync(CACHE_HTML)) {
    const cached = readFileSync(CACHE_HTML, 'utf8');
    if (cached.length > 10_000) {
      console.log(`[fetch] using cached /hotels-list/ (${cached.length} chars)`);
      return cached;
    }
  }
  console.log(`[fetch] GET ${SOURCE_URL}`);
  // Mimic a real browser UA — Grecotel WP otherwise serves a barebones response.
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`[fetch] HTTP ${res.status} on ${SOURCE_URL}`);
  }
  const html = await res.text();
  writeFileSync(CACHE_HTML, html);
  console.log(`[fetch] saved ${html.length} chars to ${CACHE_HTML}`);
  return html;
}

function extractHotelSlugs(html: string): HotelEntry[] {
  // Match href to root-level slug URLs: /<slug>/ with no further path segment.
  // Grecotel uses lowercase a-z, digits, hyphens. Anchor on trailing slash.
  const rx = /href="(https:\/\/www\.grecotel\.com\/([a-z0-9-]+)\/)"/g;
  const seen = new Set<string>();
  const entries: HotelEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const url = m[1] ?? '';
    const slug = m[2] ?? '';
    if (!slug || seen.has(slug)) continue;
    if (NON_HOTEL_SLUGS.has(slug)) continue;
    // Skip very short or numeric-only slugs (artifacts of href noise)
    if (slug.length < 3) continue;
    seen.add(slug);
    entries.push({ slug, url });
  }
  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

function main(): void {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');

  void fetchHotelsList(refresh).then((html) => {
    const hotels = extractHotelSlugs(html);
    console.log(`\n[parse] ${hotels.length} hotel candidates after denylist filter:`);
    for (const h of hotels) console.log(`  ${h.slug.padEnd(28)} → ${h.url}`);

    const out = {
      _meta: {
        source: SOURCE_URL,
        parsed_at: new Date().toISOString(),
        denylist_size: NON_HOTEL_SLUGS.size,
        count: hotels.length,
      },
      hotels,
    };
    const dest = resolve(ROOT, 'grecotel-hotel-urls.json');
    writeFileSync(dest, JSON.stringify(out, null, 2));
    console.log(`\n[done] wrote ${hotels.length} hotels to ${dest}`);
  });
}

main();
