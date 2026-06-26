/**
 * Crawl orchestrator: fetch each page, run the pure static checks, then the
 * network checks (internal links + images live) under a bounded concurrency
 * pool with a shared asset-status cache.
 */

import { extractAnchorHrefs, extractImageUrls } from './lib/html.js';
import { createAssetProber, fetchPage, type AssetProbe } from './lib/http.js';
import { DEFAULT_CONFIG, runStaticChecks, type Finding, type StaticCheckConfig } from './checks.js';

export interface CrawlOptions {
  readonly base: string;
  readonly concurrency: number;
  readonly pageTimeoutMs: number;
  readonly assetTimeoutMs: number;
  readonly checkLinks: boolean;
  readonly checkImages: boolean;
  /** Max distinct internal links probed per page. */
  readonly maxLinksPerPage: number;
  /** Max distinct images probed per page. */
  readonly maxImagesPerPage: number;
  readonly staticConfig: StaticCheckConfig;
  /** Optional progress callback. */
  readonly onResult?: ((result: UrlResult, index: number, total: number) => void) | undefined;
}

export interface UrlResult {
  readonly url: string;
  readonly status: number | null;
  readonly elapsedMs: number;
  readonly findings: readonly Finding[];
  readonly worstSeverity: 'fail' | 'warn' | 'ok';
}

export function defaultCrawlOptions(base: string): CrawlOptions {
  return {
    base,
    concurrency: 8,
    pageTimeoutMs: 25_000,
    assetTimeoutMs: 12_000,
    checkLinks: true,
    checkImages: true,
    maxLinksPerPage: 25,
    maxImagesPerPage: 15,
    staticConfig: DEFAULT_CONFIG,
  };
}

function worst(findings: readonly Finding[]): 'fail' | 'warn' | 'ok' {
  if (findings.some((f) => f.severity === 'fail')) return 'fail';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  return 'ok';
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

function resolveInternalLinks(html: string, pageUrl: string, base: string): readonly string[] {
  const out = new Set<string>();
  for (const href of extractAnchorHrefs(html)) {
    const trimmed = href.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith('#') ||
      /^(mailto:|tel:|javascript:|data:)/iu.test(trimmed)
    ) {
      continue;
    }
    let abs: string;
    try {
      abs = new URL(trimmed, pageUrl).toString();
    } catch {
      continue;
    }
    // Strip fragment — we only care about the resource.
    const noHash = abs.split('#')[0] ?? abs;
    if (sameHost(noHash, base)) out.add(noHash);
  }
  return [...out];
}

function resolveImages(html: string, pageUrl: string): readonly string[] {
  const out = new Set<string>();
  for (const src of extractImageUrls(html)) {
    try {
      out.add(new URL(src, pageUrl).toString());
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
}

function summariseBroken(kind: string, probes: readonly AssetProbe[]): Finding | null {
  const broken = probes.filter((p) => p.status === null || p.status >= 400);
  if (broken.length === 0) return null;
  const sample = broken
    .slice(0, 5)
    .map((p) => `${p.url} → ${p.status ?? 'ERR'}`)
    .join('; ');
  return {
    check: kind,
    severity: 'fail',
    message: `${broken.length} broken ${kind === 'broken-links' ? 'internal link(s)' : 'image(s)'}: ${sample}${broken.length > 5 ? ' …' : ''}`,
  };
}

async function auditOne(
  url: string,
  opts: CrawlOptions,
  probe: (u: string) => Promise<AssetProbe>,
): Promise<UrlResult> {
  const page = await fetchPage(url, opts.pageTimeoutMs);
  if (page === null) {
    return {
      url,
      status: null,
      elapsedMs: 0,
      findings: [{ check: 'fetch', severity: 'fail', message: 'request failed / timed out' }],
      worstSeverity: 'fail',
    };
  }

  const findings: Finding[] = [
    ...runStaticChecks({ url, status: page.status, html: page.html }, opts.staticConfig),
  ];

  // Only probe assets when the page itself rendered (200 + html).
  if (page.status === 200 && page.html.length > 0) {
    if (opts.checkLinks) {
      const links = resolveInternalLinks(page.html, page.finalUrl, opts.base).slice(
        0,
        opts.maxLinksPerPage,
      );
      const probes = await Promise.all(links.map(probe));
      const f = summariseBroken('broken-links', probes);
      if (f) findings.push(f);
    }
    if (opts.checkImages) {
      const images = resolveImages(page.html, page.finalUrl).slice(0, opts.maxImagesPerPage);
      const probes = await Promise.all(images.map(probe));
      const f = summariseBroken('broken-images', probes);
      if (f) findings.push(f);
    }
  }

  return {
    url,
    status: page.status,
    elapsedMs: page.elapsedMs,
    findings,
    worstSeverity: worst(findings),
  };
}

/** Audit a list of URLs under a bounded worker pool. */
export async function crawl(
  urls: readonly string[],
  opts: CrawlOptions,
): Promise<readonly UrlResult[]> {
  const probe = createAssetProber(opts.assetTimeoutMs);
  const results: UrlResult[] = new Array<UrlResult>(urls.length);
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= urls.length) return;
      const url = urls[i];
      if (url === undefined) return;
      const result = await auditOne(url, opts, probe);
      results[i] = result;
      done += 1;
      opts.onResult?.(result, done, urls.length);
    }
  }

  const pool = Array.from({ length: Math.min(opts.concurrency, urls.length) }, () => worker());
  await Promise.all(pool);
  return results;
}
