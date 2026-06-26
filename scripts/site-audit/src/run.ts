/**
 * Site-wide health auditor (L3) — CLI entry.
 *
 * Walks the sitemap of `--base` (prod by default) and audits every (or a
 * sample of) published URL: HTTP 200, single <h1>, title/meta/canonical,
 * hreflang parity, no scaffolding leak in prose, valid JSON-LD (no frozen
 * Offer, AggregateRating on /5), live internal links + images, and the
 * anti-"0 hôtels" list-page value check.
 *
 * Usage (run from repo root):
 *   pnpm --filter @mch/site-audit audit -- --sample=50
 *   pnpm --filter @mch/site-audit audit -- --only=hotels,rankings --limit=200
 *   pnpm --filter @mch/site-audit audit -- --full --concurrency=12
 *   pnpm --filter @mch/site-audit audit -- --budget-only            # fast: status + h1 only
 *   pnpm --filter @mch/site-audit audit -- --base=https://<preview>.vercel.app
 *   pnpm --filter @mch/site-audit audit -- --urls=/,/hotel/le-meurice
 *
 * Exit code: 1 when the crawl produces findings at/above `--fail-on`
 * (default `fail`), so CI / cron can hard-stop. Use `--fail-on=warn` to
 * also fail on warnings, or `--fail-on=none` to always exit 0 (report only).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { crawl, defaultCrawlOptions, type CrawlOptions, type UrlResult } from './crawl.js';
import { loadSitemapUrls } from './lib/sitemap.js';
import {
  buildHtmlReport,
  buildJsonReport,
  buildTextDigest,
  summarise,
  type ReportPayload,
} from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, '../runs');
const FALLBACK_BASE = 'https://myconciergehotel.com';

interface CliArgs {
  readonly base: string;
  readonly only: readonly string[] | undefined;
  readonly perGroupLimit: number | undefined;
  readonly sample: number | undefined;
  readonly maxUrls: number | undefined;
  readonly urls: readonly string[] | undefined;
  readonly budgetOnly: boolean;
  readonly checkLinks: boolean;
  readonly checkImages: boolean;
  readonly concurrency: number | undefined;
  readonly failOn: 'fail' | 'warn' | 'none';
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) flags.add(body);
    else map.set(body.slice(0, eq), body.slice(eq + 1));
  }
  const num = (key: string): number | undefined => {
    const v = map.get(key);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const list = (key: string): readonly string[] | undefined => {
    const v = map.get(key);
    if (v === undefined) return undefined;
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const rawBase =
    map.get('base') ??
    process.env['SITE_AUDIT_BASE'] ??
    process.env['NEXT_PUBLIC_SITE_URL'] ??
    FALLBACK_BASE;
  const base = rawBase.replace(/\/$/u, '');
  const failOnRaw = map.get('fail-on') ?? 'fail';
  const failOn: CliArgs['failOn'] =
    failOnRaw === 'warn' ? 'warn' : failOnRaw === 'none' ? 'none' : 'fail';

  return {
    base,
    only: list('only'),
    perGroupLimit: num('limit'),
    sample: num('sample'),
    maxUrls: num('max-urls'),
    urls: list('urls'),
    budgetOnly: flags.has('budget-only'),
    checkLinks: !flags.has('no-links'),
    checkImages: !flags.has('no-images'),
    concurrency: num('concurrency'),
    failOn,
  };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

function absolutise(base: string, u: string): string {
  if (/^https?:\/\//iu.test(u)) return u;
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

async function resolveUrlList(args: CliArgs): Promise<readonly string[]> {
  if (args.urls && args.urls.length > 0) {
    return args.urls.map((u) => absolutise(args.base, u));
  }
  const groups = await loadSitemapUrls(args.base, {
    only: args.only,
    perGroupLimit: args.perGroupLimit,
  });
  let all = groups.flatMap((g) => g.urls);
  // De-dupe while preserving order.
  all = [...new Set(all)];
  console.log(
    `Sitemap groups: ${groups.map((g) => `${g.name}=${g.urls.length}`).join(', ')} → ${all.length} URLs`,
  );
  if (args.sample !== undefined && args.sample > 0 && args.sample < all.length) {
    all = shuffle(all).slice(0, args.sample);
    console.log(`Sampled ${all.length} URLs (random).`);
  }
  if (args.maxUrls !== undefined && args.maxUrls > 0 && all.length > args.maxUrls) {
    all = all.slice(0, args.maxUrls);
    console.log(`Capped to ${all.length} URLs (--max-urls).`);
  }
  return all;
}

function buildCrawlOptions(args: CliArgs): CrawlOptions {
  const base = defaultCrawlOptions(args.base);
  return {
    ...base,
    concurrency: args.concurrency ?? base.concurrency,
    checkLinks: args.budgetOnly ? false : args.checkLinks,
    checkImages: args.budgetOnly ? false : args.checkImages,
  };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/gu, '-').slice(0, 19);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`\n🔍 Site audit — base=${args.base} failOn=${args.failOn}\n`);

  const urls = await resolveUrlList(args);
  if (urls.length === 0) {
    console.error('No URLs to audit (sitemap empty or unreachable).');
    process.exit(2);
  }

  const opts = buildCrawlOptions(args);
  const tickEvery = Math.max(1, Math.floor(urls.length / 20));
  const onResult = (r: UrlResult, i: number, total: number): void => {
    if (r.worstSeverity === 'fail') {
      console.log(`  ✗ [${i}/${total}] ${r.url} (${r.status ?? 'ERR'})`);
    } else if (i % tickEvery === 0 || i === total) {
      console.log(`  … ${i}/${total} audited`);
    }
  };

  const results = await crawl(urls, { ...opts, onResult });

  const summary = summarise(results);
  const payload: ReportPayload = {
    generatedAt: new Date().toISOString(),
    base: args.base,
    summary,
    results,
  };

  mkdirSync(RUNS_DIR, { recursive: true });
  const stamp = timestamp();
  const jsonPath = resolve(RUNS_DIR, `site-audit-${stamp}.json`);
  const htmlPath = resolve(RUNS_DIR, `site-audit-${stamp}.html`);
  writeFileSync(jsonPath, buildJsonReport(payload), 'utf8');
  writeFileSync(htmlPath, buildHtmlReport(payload), 'utf8');

  console.log('\n──────── Summary ────────');
  console.log(
    `Total: ${summary.total} | OK: ${summary.ok} | Warn: ${summary.warn} | Fail: ${summary.fail}`,
  );
  const checks = Object.entries(summary.byCheck)
    .filter(([, c]) => c.fail > 0 || c.warn > 0)
    .sort((a, b) => b[1].fail - a[1].fail || b[1].warn - a[1].warn);
  for (const [check, c] of checks) {
    console.log(`  ${check}: ${c.fail} fail, ${c.warn} warn`);
  }
  const digest = buildTextDigest(results);
  if (digest.length > 0) {
    console.log('\n──────── Problems ────────');
    console.log(digest);
  }
  console.log(`\nReports written:\n  ${jsonPath}\n  ${htmlPath}\n`);

  const shouldFail =
    args.failOn === 'none'
      ? false
      : args.failOn === 'warn'
        ? summary.fail > 0 || summary.warn > 0
        : summary.fail > 0;
  process.exit(shouldFail ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('Site audit crashed:', err);
  process.exit(2);
});
