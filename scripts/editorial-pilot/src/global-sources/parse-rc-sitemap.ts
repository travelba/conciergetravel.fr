/**
 * parse-rc-sitemap.ts — split the R&C sitemap XML into typed URL buckets.
 *
 * Input:  global-sources/rc-sitemap.xml (raw XML, ~450 KB, ~2300 URLs).
 * Output: global-sources/rc-hotel-urls.json       (~476 hotels)
 *         global-sources/rc-restaurant-urls.json  (~551 restaurants)
 *         global-sources/rc-destination-urls.json (~170 destination listings, overwrites the bootstrap list)
 *
 * The sitemap is the canonical source of truth for the R&C catalogue. The
 * "destinations pages" enumerated by Tavily map are incomplete because of
 * client-side lazy loading; the sitemap is what R&C themselves expose to
 * search engines.
 *
 * Usage:
 *   pnpm rc:sitemap            # parse + save 3 URL lists
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

const SITEMAP = resolve(ROOT, 'rc-sitemap.xml');

interface UrlEntry {
  readonly loc: string;
  readonly lastmod: string | null;
}

function parseSitemap(xml: string): UrlEntry[] {
  const out: UrlEntry[] = [];
  // The sitemap is small enough to parse with a single regex pass.
  // We deliberately avoid xml2js / fast-xml-parser to stay dep-free.
  const rx = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?\s*<\/url>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(xml)) !== null) {
    out.push({ loc: m[1] ?? '', lastmod: m[2] ?? null });
  }
  return out;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function main(): void {
  const xml = readFileSync(SITEMAP, 'utf8');
  const entries = parseSitemap(xml);
  console.log(`[parse] ${entries.length} <url> entries in sitemap`);

  const hotels: string[] = [];
  const restaurants: string[] = [];
  const destinations: string[] = [];
  const other: string[] = [];

  for (const e of entries) {
    if (!e.loc.includes('/fr/')) continue;
    if (/\/fr\/hotel\/[^/]+\/?$/.test(e.loc)) {
      hotels.push(trimTrailingSlash(e.loc));
    } else if (/\/fr\/restaurant\/[^/]+\/?$/.test(e.loc)) {
      restaurants.push(trimTrailingSlash(e.loc));
    } else if (/\/fr\/destinations\//.test(e.loc)) {
      destinations.push(trimTrailingSlash(e.loc));
    } else {
      other.push(trimTrailingSlash(e.loc));
    }
  }

  const dedupe = (arr: string[]): string[] => Array.from(new Set(arr)).sort();

  const hotelUrls = dedupe(hotels);
  const restaurantUrls = dedupe(restaurants);
  const destinationUrls = dedupe(destinations);

  console.log(
    `[buckets] hotels=${hotelUrls.length} restaurants=${restaurantUrls.length} destinations=${destinationUrls.length} other=${other.length}`,
  );

  writeFileSync(
    resolve(ROOT, 'rc-hotel-urls.json'),
    JSON.stringify(
      {
        _meta: {
          source: 'https://www.relaischateaux.com/fr/rc-sitemap.xml',
          parsed_at: new Date().toISOString(),
          count: hotelUrls.length,
        },
        urls: hotelUrls,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(ROOT, 'rc-restaurant-urls.json'),
    JSON.stringify(
      {
        _meta: {
          source: 'https://www.relaischateaux.com/fr/rc-sitemap.xml',
          parsed_at: new Date().toISOString(),
          count: restaurantUrls.length,
        },
        urls: restaurantUrls,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(ROOT, 'rc-destination-urls.json'),
    JSON.stringify(
      {
        _meta: {
          source: 'https://www.relaischateaux.com/fr/rc-sitemap.xml',
          parsed_at: new Date().toISOString(),
          note: 'Overwrites the bootstrap list from tavily_map. Sitemap exposes ~170 destinations vs ~115 visible via crawler.',
          count: destinationUrls.length,
        },
        destinations: destinationUrls,
      },
      null,
      2,
    ),
  );

  console.log(`[done] wrote 3 URL lists to ${ROOT}`);
}

main();
