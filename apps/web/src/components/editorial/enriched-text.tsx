import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Typed href for an editorial auto-link. Mirrors the shape next-intl's
 * `<Link>` accepts so the link map values can be passed straight through
 * without runtime string concatenation (Phase 2 of i18n V2 — replaces the
 * legacy `withLocalePath('/hotel/...')` string-building pattern).
 */
export type EditorialLink = Extract<ComponentProps<typeof Link>['href'], { pathname: string }>;
export type EditorialLinkMap = ReadonlyMap<string, EditorialLink>;

/**
 * Auto-links named entities (Palaces, cities, brands, categories,
 * rankings) inside a long-form body text. The component is the
 * cornerstone of the "maillage interne très puissant" requirement:
 * every editorial paragraph weaves its way back into the site's
 * navigation graph without manual hand-rolling per article.
 *
 * Entities are passed in via the `linkMap` prop — a build-time
 * dictionary { displayName → href } prepared by the page-level
 * server component (cf. `apps/web/src/server/editorial/build-link-map.ts`).
 *
 * Implementation:
 *   - Splits the body on whitespace-preserving regex.
 *   - Replaces FIRST occurrence of each linkable entity per paragraph
 *     (rule: never link the same entity twice in the same paragraph
 *     to avoid over-linking — Google penalty signal).
 *   - Skips matches inside hrefs (already linked) — handled by the
 *     fact that linkMap entries don't contain HTML.
 *
 * Skill: seo-technical §internal-linking, performance-engineering.
 */

interface Props {
  readonly body: string;
  readonly locale: Locale;
  readonly linkMap: EditorialLinkMap;
  /** Cap on auto-links per paragraph (default 4 — avoid over-linking). */
  readonly maxLinksPerParagraph?: number;
}

interface MatchRange {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly href: EditorialLink;
}

/**
 * Pre-compiled link-map entry. The corpus grew from ~200 to ~5000+
 * entries (B4 — full-catalogue auto-link map), so the entry list is
 * compiled once per link-map INSTANCE (WeakMap cache below) instead of
 * once per `<EnrichedText>` render — a guide page mounts the component
 * for every section body, and re-deriving 5000 entries per section was
 * a large share of the 20 s server render the 2026-07-02 audit measured
 * on `/destination/paris`.
 *
 * The word-boundary regex is compiled LAZILY (`pattern` starts `null`):
 * `findMatches` pre-filters with a cheap lowercase `String.includes`
 * before touching the regex, so in practice only the handful of entries
 * actually present in a paragraph ever pay the `new RegExp` cost — not
 * all 5000.
 */
interface CompiledEntry {
  readonly name: string;
  readonly lower: string;
  readonly href: EditorialLink;
  pattern: RegExp | null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Unicode-aware word-boundary pattern, compiled on first use per entry. */
function entryPattern(entry: CompiledEntry): RegExp {
  if (entry.pattern === null) {
    entry.pattern = new RegExp(
      `(?<=^|[^\\p{L}\\p{N}])${escapeRegex(entry.name)}(?=[^\\p{L}\\p{N}]|$)`,
      'iu',
    );
  }
  return entry.pattern;
}

/**
 * Compiles the link map once per link-map instance: drops sub-3-char
 * names and sorts by descending name length so longer strings match
 * first ("Plaza Athénée" before "Plaza"). Regexes are NOT built here —
 * see `entryPattern`.
 *
 * Keyed by the Map's identity: `buildEditorialLinkMap` produces one Map
 * per page render, shared by every `<EnrichedText>` on that page, so the
 * WeakMap collapses N per-section compilations into one and lets the
 * whole entry list be GC'd with the request.
 */
const compiledCache = new WeakMap<EditorialLinkMap, readonly CompiledEntry[]>();

function compileEntries(linkMap: EditorialLinkMap): readonly CompiledEntry[] {
  const cached = compiledCache.get(linkMap);
  if (cached !== undefined) return cached;
  const compiled: CompiledEntry[] = [];
  for (const [name, href] of linkMap) {
    if (name.length < 3) continue;
    compiled.push({
      name,
      lower: name.toLowerCase(),
      href,
      pattern: null,
    });
  }
  compiled.sort((a, b) => b.name.length - a.name.length);
  compiledCache.set(linkMap, compiled);
  return compiled;
}

/**
 * Find all candidate matches in a paragraph. Each entity is matched
 * case-INSENSITIVELY but its surface form keeps the original casing
 * from the text. Word-boundary check uses Unicode-aware delimiters
 * (handles French accents, hyphens, apostrophes). `entries` is the
 * render-scoped pre-compiled list (see `compileEntries`).
 */
function findMatches(paragraph: string, entries: readonly CompiledEntry[]): MatchRange[] {
  const results: MatchRange[] = [];
  const used = new Set<string>();
  const paragraphLower = paragraph.toLowerCase();

  for (const entry of entries) {
    if (used.has(entry.lower)) continue;
    // Cheap pre-filter: a case-insensitive regex can only match when the
    // lowercased needle occurs as a substring. Skipping early avoids both
    // the lazy regex compile and the `.exec` scan for the ~99 % of the
    // 5000-entry corpus that is absent from any given paragraph.
    if (!paragraphLower.includes(entry.lower)) continue;
    // Non-global regex: `.exec` always scans from index 0, so reusing the
    // pre-compiled instance across paragraphs is safe (no lastIndex state).
    const m = entryPattern(entry).exec(paragraph);
    if (m === null) continue;
    const start = m.index;
    const end = start + entry.name.length;

    // Skip if overlaps an already-claimed range.
    let overlap = false;
    for (const r of results) {
      if (start < r.end && end > r.start) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    results.push({ start, end, text: paragraph.slice(start, end), href: entry.href });
    used.add(entry.lower);
  }

  return results.sort((a, b) => a.start - b.start);
}

function renderParagraph(
  paragraph: string,
  entries: readonly CompiledEntry[],
  maxLinks: number,
  keyBase: string,
): ReactNode {
  const matches = findMatches(paragraph, entries).slice(0, maxLinks);
  if (matches.length === 0) return paragraph;

  const out: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) out.push(paragraph.slice(cursor, m.start));
    out.push(
      <Link
        key={`${keyBase}-${i}`}
        href={m.href}
        className="text-fg decoration-fg/30 hover:decoration-fg underline underline-offset-2"
      >
        {m.text}
      </Link>,
    );
    cursor = m.end;
  });
  if (cursor < paragraph.length) out.push(paragraph.slice(cursor));
  return out;
}

export function EnrichedText({
  body,
  locale: _locale,
  linkMap,
  maxLinksPerParagraph = 4,
}: Props): ReactElement {
  // `locale` stays in the prop signature for backwards compatibility with
  // the editorial server components. The Link component itself picks up
  // the current locale via the next-intl request context, so we no longer
  // need to thread it down to each individual link.
  void _locale;
  // Compile the link map ONCE per render (not per paragraph) — see
  // `compileEntries`. Critical now the map carries the full catalogue.
  const entries = compileEntries(linkMap);
  // Split on blank lines to render proper paragraphs.
  const paragraphs = body
    .split(/\n{2,}/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <div className="text-fg/90 space-y-4 leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i}>{renderParagraph(p, entries, maxLinksPerParagraph, `p${i}`)}</p>
      ))}
    </div>
  );
}
