/**
 * Pure HTML extraction helpers for the site auditor.
 *
 * The audited pages are server-rendered Next.js output with stable,
 * well-formed markup, so targeted regex extraction is reliable enough
 * for a health crawl AND keeps the package dependency-free (no jsdom /
 * cheerio install). Every function here is pure — no network, no I/O —
 * so it is unit-testable against fixture strings.
 *
 * If a future page ships markup these helpers cannot parse, prefer
 * tightening the regex here (with a fixture in `html.test.ts`) over
 * adding a heavyweight DOM dependency.
 */

const MINIMAL_ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/gu, ' '],
  [/&amp;/gu, '&'],
  [/&lt;/gu, '<'],
  [/&gt;/gu, '>'],
  [/&quot;/gu, '"'],
  [/&#0?39;/gu, "'"],
  [/&apos;/gu, "'"],
  [/&#x27;/giu, "'"],
];

/** Decode the handful of HTML entities that matter for text comparison. */
export function decodeEntities(text: string): string {
  let out = text;
  for (const [re, rep] of MINIMAL_ENTITIES) out = out.replace(re, rep);
  return out;
}

/** Count opening tags of `tag` (e.g. `h1`). Case-insensitive. */
export function countOpeningTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'giu');
  return (html.match(re) ?? []).length;
}

/** First non-empty `<title>` text, or null. */
export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  if (!m || m[1] === undefined) return null;
  const text = decodeEntities(m[1].replace(/\s+/gu, ' ').trim());
  return text.length > 0 ? text : null;
}

/** `<meta name="description" content="…">`, or null. */
export function extractMetaDescription(html: string): string | null {
  const tag = html.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/iu);
  if (!tag) return null;
  const c = tag[0].match(/\bcontent=["']([\s\S]*?)["']/iu);
  if (!c || c[1] === undefined) return null;
  const text = decodeEntities(c[1].replace(/\s+/gu, ' ').trim());
  return text.length > 0 ? text : null;
}

/** `<link rel="canonical" href="…">`, or null. */
export function extractCanonical(html: string): string | null {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/iu);
  if (!tag) return null;
  const h = tag[0].match(/\bhref=["']([^"']+)["']/iu);
  return h && h[1] !== undefined ? h[1] : null;
}

export interface Alternate {
  readonly hreflang: string;
  readonly href: string;
}

/** All `<link rel="alternate" hreflang="…" href="…">` pairs. */
export function extractAlternates(html: string): readonly Alternate[] {
  const out: Alternate[] = [];
  const tags = html.match(/<link\b[^>]*\brel=["']alternate["'][^>]*>/giu) ?? [];
  for (const tag of tags) {
    const hl = tag.match(/\bhreflang=["']([^"']+)["']/iu);
    const hf = tag.match(/\bhref=["']([^"']+)["']/iu);
    if (hl && hl[1] !== undefined && hf && hf[1] !== undefined) {
      out.push({ hreflang: hl[1], href: hf[1] });
    }
  }
  return out;
}

/** All `<a href="…">` targets (raw, may be relative or anchors). */
export function extractAnchorHrefs(html: string): readonly string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref=["']([^"']+)["']/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Decode entities: in HTML, `&` is serialised as `&amp;`, so a raw
    // extraction yields `/_next/image?url=…&amp;w=1920` which 400s when
    // requested verbatim (Next reads `amp;w` instead of `w`).
    if (m[1] !== undefined) out.push(decodeEntities(m[1]));
  }
  return out;
}

/**
 * All image URLs referenced by `<img>` — `src` plus the first candidate of
 * `srcset` (the smallest descriptor) so we exercise at least one real asset
 * URL per image without HEAD-ing every responsive variant.
 */
export function extractImageUrls(html: string): readonly string[] {
  const out = new Set<string>();
  const tags = html.match(/<img\b[^>]*>/giu) ?? [];
  for (const tag of tags) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/iu);
    if (src && src[1] !== undefined && !src[1].startsWith('data:')) out.add(decodeEntities(src[1]));
    const ss = tag.match(/\bsrcset=["']([^"']+)["']/iu);
    if (ss && ss[1] !== undefined) {
      const first = ss[1].split(',')[0]?.trim().split(/\s+/u)[0];
      if (first !== undefined && first.length > 0 && !first.startsWith('data:')) {
        out.add(decodeEntities(first));
      }
    }
  }
  return [...out];
}

/** Raw inner text of every `<script type="application/ld+json">` block. */
export function extractJsonLdBlocks(html: string): readonly string[] {
  const out: string[] = [];
  const re = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) out.push(m[1].trim());
  }
  return out;
}

/**
 * Best-effort visible text: strip `<script>` / `<style>` / `<noscript>` and
 * all tags, decode the common entities, collapse whitespace. Used for prose
 * leak detection — running the scaffolding gate on the FULL html would match
 * the legit Wikidata `sameAs` URLs / Q-ids inside the JSON-LD blocks.
 */
export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/giu, ' ')
      .replace(/<style[\s\S]*?<\/style>/giu, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/giu, ' ')
      .replace(/<[^>]+>/gu, ' '),
  )
    .replace(/\s+/gu, ' ')
    .trim();
}
