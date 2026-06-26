/**
 * Pure per-URL checks. Each operates on the fetched `{ url, status, html }`
 * and returns zero or more `Finding`s. No network here — the link/image
 * liveness checks (which need HEAD requests) live in `crawl.ts` and reuse
 * the same `Finding` shape.
 *
 * Scaffolding leak detection on the rendered page uses `pageHasLeak` — a
 * high-precision PROSE subset of the shared editorial gate. The full gate
 * flags lexical tokens (`wikidata`, Q-ids, backticks) that are legitimate
 * EEAT source attributions in a rendered page; see `page-leak.ts` for why
 * the page context needs its own detector.
 */

import {
  countOpeningTags,
  extractAlternates,
  extractCanonical,
  extractJsonLdBlocks,
  extractMetaDescription,
  extractTitle,
  visibleText,
  type Alternate,
} from './lib/html.js';
import { pageHasLeak } from './page-leak.js';

export type Severity = 'fail' | 'warn' | 'info';

export interface Finding {
  readonly check: string;
  readonly severity: Severity;
  readonly message: string;
}

export interface StaticCheckInput {
  readonly url: string;
  readonly status: number;
  readonly html: string;
}

export interface StaticCheckConfig {
  /** Status codes treated as healthy (default `[200]`). */
  readonly okStatuses: ReadonlySet<number>;
  /** Locales that, when alternates exist, must both be present. */
  readonly expectedLocales: readonly string[];
  /** Path prefixes (after locale) that are hotel-list surfaces. */
  readonly listingPathPattern: RegExp;
  /** Title length SEO band [min, max]. */
  readonly titleBand: readonly [number, number];
  /** Meta description length SEO band [min, max]. */
  readonly metaDescBand: readonly [number, number];
}

export const DEFAULT_CONFIG: StaticCheckConfig = {
  okStatuses: new Set([200]),
  expectedLocales: ['fr', 'en'],
  listingPathPattern: /\/(classement|classements|categorie|marque|destination|hotels|lieux)\b/u,
  titleBand: [15, 70],
  metaDescBand: [110, 170],
};

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/u, '') || '/';
  } catch {
    return url;
  }
}

/** Run every pure check and return the merged findings list. */
export function runStaticChecks(
  input: StaticCheckInput,
  config: StaticCheckConfig = DEFAULT_CONFIG,
): readonly Finding[] {
  const findings: Finding[] = [];

  // 1 — HTTP status.
  if (!config.okStatuses.has(input.status)) {
    findings.push({
      check: 'http-status',
      severity: 'fail',
      message: `HTTP ${input.status} (expected ${[...config.okStatuses].join('/')})`,
    });
    // A non-200 page has no meaningful body to check further.
    return findings;
  }

  const { html } = input;

  // 2 — exactly one <h1>.
  const h1Count = countOpeningTags(html, 'h1');
  if (h1Count === 0) {
    findings.push({ check: 'h1', severity: 'fail', message: 'no <h1> on page' });
  } else if (h1Count > 1) {
    findings.push({ check: 'h1', severity: 'warn', message: `${h1Count} <h1> tags (expected 1)` });
  }

  // 3 — <title>.
  const title = extractTitle(html);
  if (title === null) {
    findings.push({ check: 'title', severity: 'fail', message: 'missing or empty <title>' });
  } else if (title.length < config.titleBand[0] || title.length > config.titleBand[1]) {
    findings.push({
      check: 'title',
      severity: 'warn',
      message: `title length ${title.length} outside [${config.titleBand[0]}, ${config.titleBand[1]}]`,
    });
  }

  // 4 — meta description.
  const metaDesc = extractMetaDescription(html);
  if (metaDesc === null) {
    findings.push({
      check: 'meta-description',
      severity: 'warn',
      message: 'missing or empty meta description',
    });
  } else if (metaDesc.length < config.metaDescBand[0] || metaDesc.length > config.metaDescBand[1]) {
    findings.push({
      check: 'meta-description',
      severity: 'warn',
      message: `meta description length ${metaDesc.length} outside [${config.metaDescBand[0]}, ${config.metaDescBand[1]}]`,
    });
  }

  // 5 — canonical present + self-referential (path-level).
  const canonical = extractCanonical(html);
  if (canonical === null) {
    findings.push({ check: 'canonical', severity: 'warn', message: 'no canonical link' });
  } else if (pathnameOf(canonical) !== pathnameOf(input.url)) {
    findings.push({
      check: 'canonical',
      severity: 'warn',
      message: `canonical points elsewhere: ${pathnameOf(canonical)} ≠ ${pathnameOf(input.url)}`,
    });
  }

  // 6 — hreflang parity (only when the page declares alternates at all).
  findings.push(...checkHreflang(extractAlternates(html), config));

  // 7 — scaffolding leak in visible prose (NOT in JSON-LD, where Q-ids live).
  if (pageHasLeak(visibleText(html))) {
    findings.push({
      check: 'scaffolding-leak',
      severity: 'fail',
      message: 'pipeline/brief scaffolding leaked into rendered prose',
    });
  }

  // 8 — JSON-LD: parseable, no frozen Offer, AggregateRating on /5.
  findings.push(...checkJsonLd(extractJsonLdBlocks(html)));

  // 9 — list-page value (anti "0 hôtels").
  if (config.listingPathPattern.test(pathnameOf(input.url))) {
    const text = visibleText(html);
    if (/\b0\s+h[oô]tels?\b/iu.test(text)) {
      findings.push({
        check: 'list-value',
        severity: 'fail',
        message: 'listing page renders "0 hôtels" (empty result leaked to prod)',
      });
    }
  }

  return findings;
}

function checkHreflang(
  alternates: readonly Alternate[],
  config: StaticCheckConfig,
): readonly Finding[] {
  if (alternates.length === 0) return [];
  const langs = new Set(alternates.map((a) => a.hreflang.toLowerCase().split('-')[0] ?? ''));
  const missing = config.expectedLocales.filter((l) => !langs.has(l));
  if (missing.length > 0) {
    return [
      {
        check: 'hreflang',
        severity: 'warn',
        message: `alternates present but missing locale(s): ${missing.join(', ')}`,
      },
    ];
  }
  return [];
}

interface JsonLdNode {
  readonly '@type'?: unknown;
  readonly bestRating?: unknown;
  readonly [key: string]: unknown;
}

/** Collect every object node in a parsed JSON-LD value (handles @graph + arrays). */
function collectNodes(value: unknown, acc: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, acc);
    return;
  }
  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    acc.push(node);
    for (const key of Object.keys(node)) collectNodes(node[key], acc);
  }
}

function typeMatches(type: unknown, target: string): boolean {
  if (typeof type === 'string') return type === target;
  if (Array.isArray(type)) return type.some((t) => t === target);
  return false;
}

function checkJsonLd(blocks: readonly string[]): readonly Finding[] {
  const findings: Finding[] = [];
  for (const [i, block] of blocks.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      findings.push({
        check: 'jsonld-parse',
        severity: 'fail',
        message: `JSON-LD block #${i + 1} is not valid JSON`,
      });
      continue;
    }
    const nodes: JsonLdNode[] = [];
    collectNodes(parsed, nodes);

    // Phase 6 booking is frozen — no Offer must ship on any public surface.
    if (nodes.some((n) => typeMatches(n['@type'], 'Offer'))) {
      findings.push({
        check: 'jsonld-offer-frozen',
        severity: 'fail',
        message: 'Offer JSON-LD present (Phase 6 booking is frozen — must not emit Offer)',
      });
    }

    // AggregateRating must be on the /5 scale (Hard Rule 11).
    for (const n of nodes) {
      if (typeMatches(n['@type'], 'AggregateRating')) {
        const best = n.bestRating;
        const ok = best === '5' || best === 5;
        if (!ok) {
          findings.push({
            check: 'jsonld-rating-scale',
            severity: 'fail',
            message: `AggregateRating.bestRating = ${JSON.stringify(best)} (expected "5")`,
          });
        }
      }
    }
  }
  return findings;
}
