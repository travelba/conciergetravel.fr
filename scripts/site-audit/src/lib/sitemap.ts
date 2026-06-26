/**
 * Sitemap discovery — the source of truth for "every published URL".
 *
 * The site exposes a sitemap index at `/sitemap.xml` pointing at seven
 * sub-sitemaps (`/sitemaps/{hotels,rooms,hubs,guides,rankings,itineraries,
 * places}.xml`). We parse the index, then each sub-sitemap, to enumerate
 * the full set of canonical URLs to audit.
 *
 * `extractLocs` is pure (testable on fixture XML); `loadSitemapUrls` does
 * the network walk.
 */

import { fetchText } from './http.js';

/** All `<loc>…</loc>` values in a sitemap or sitemap-index document. */
export function extractLocs(xml: string): readonly string[] {
  const out: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) {
      const loc = m[1].trim().replace(/&amp;/giu, '&');
      if (loc.length > 0) out.push(loc);
    }
  }
  return out;
}

/** Last path segment of a sub-sitemap URL, e.g. `hotels` for `…/hotels.xml`. */
export function sitemapGroupName(url: string): string {
  const tail = url.split('/').pop() ?? url;
  return tail.replace(/\.xml$/iu, '');
}

export interface SitemapGroup {
  readonly name: string;
  readonly sitemapUrl: string;
  readonly urls: readonly string[];
}

export interface LoadSitemapOptions {
  /** Restrict to these group names (e.g. `['hotels','rankings']`). */
  readonly only?: readonly string[] | undefined;
  /** Cap the number of URLs kept per group (after fetch). */
  readonly perGroupLimit?: number | undefined;
  /** Per-request timeout (ms). */
  readonly timeoutMs?: number | undefined;
}

/**
 * Walk the sitemap index at `<base>/sitemap.xml` and return one group per
 * sub-sitemap, each carrying its URLs. A sub-sitemap that is itself a flat
 * urlset (no nested index) is handled transparently — `extractLocs` returns
 * the page URLs directly.
 */
export async function loadSitemapUrls(
  base: string,
  opts: LoadSitemapOptions = {},
): Promise<readonly SitemapGroup[]> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const indexUrl = `${base.replace(/\/$/u, '')}/sitemap.xml`;
  const indexXml = await fetchText(indexUrl, timeoutMs);
  if (indexXml === null) {
    throw new Error(`Could not fetch sitemap index at ${indexUrl}`);
  }

  const childLocs = extractLocs(indexXml);
  // A sitemap index lists <loc>…/foo.xml</loc>; a flat urlset lists page
  // URLs. Detect the index shape by the `.xml` suffix on its locs.
  const subSitemaps = childLocs.filter((u) => /\.xml(\?|$)/iu.test(u));

  if (subSitemaps.length === 0) {
    // `/sitemap.xml` was already a flat urlset.
    return [{ name: 'root', sitemapUrl: indexUrl, urls: capUrls(childLocs, opts.perGroupLimit) }];
  }

  const groups: SitemapGroup[] = [];
  for (const sm of subSitemaps) {
    const name = sitemapGroupName(sm);
    if (opts.only && !opts.only.includes(name)) continue;
    const xml = await fetchText(sm, timeoutMs);
    if (xml === null) {
      groups.push({ name, sitemapUrl: sm, urls: [] });
      continue;
    }
    groups.push({ name, sitemapUrl: sm, urls: capUrls(extractLocs(xml), opts.perGroupLimit) });
  }
  return groups;
}

function capUrls(urls: readonly string[], limit: number | undefined): readonly string[] {
  if (limit === undefined || limit <= 0 || urls.length <= limit) return urls;
  return urls.slice(0, limit);
}
