/**
 * Affiliation → JSON-LD helpers (skill: structured-data-schema-org).
 *
 * Maps `hotels.affiliations` entries (migration 0062, see ADR-0023) to
 * the matching JSON-LD surfaces:
 *
 * - `kind: 'brand'`              → `Hotel.brand` (single Brand node)
 * - `kind: 'label' | 'ranking' | 'guide'` → `Hotel.award[]` strings
 *
 * Only **verified** affiliations are emitted. This is a hard rule
 * (`.cursor/rules/hotel-detail-page.mdc` Hard Rule 14):
 * > Awards rendus en JSON-LD uniquement si `verified: true` côté Payload.
 *
 * The input type `HotelAffiliationLike` is **structural** — we
 * deliberately do not import `@mch/db` here so this package stays at
 * its current dependency surface (`zod` + `schema-dts`). Callers in
 * `apps/web` parse with the canonical `HotelAffiliationSchema` from
 * `@mch/db` and pass the result through; this module receives objects
 * shaped to match.
 */

/**
 * Structural shape of one `hotels.affiliations[]` entry.
 *
 * `| undefined` is spelled out on every optional field so the type is
 * assignable from `@mch/db`'s Zod-inferred `HotelAffiliation` even
 * under `exactOptionalPropertyTypes: true` (Zod's `.optional()`
 * produces `T | undefined` rather than `T?`). See
 * `.cursor/skills/typescript-strict-zod-interop/SKILL.md`.
 */
export interface HotelAffiliationLike {
  readonly kind: 'brand' | 'label' | 'ranking' | 'guide';
  readonly source: string;
  readonly display_name: string;
  readonly verified: boolean;
  readonly since_year?: number | undefined;
  readonly facet_slug?: string | undefined;
  readonly source_url?: string | undefined;
}

/**
 * `Hotel.brand` input — `Hotel.brand` accepts either an `Organization`
 * or a `Brand` schema. We use `Brand` because it correctly models
 * "the marque under which the property is operated" without implying a
 * separate legal entity. When the affiliation carries a `source_url`
 * we surface it on `sameAs` so search engines can disambiguate the
 * chain.
 */
export interface HotelBrandInput {
  readonly name: string;
  /**
   * Optional canonical URL of the brand on its own site (e.g.
   * `https://www.oetkercollection.com/`). Surfaces as `Brand.sameAs[]`
   * when the affiliation provides `source_url`.
   */
  readonly sameAs?: string;
  /**
   * Optional kebab-case identifier — typically the affiliation's
   * `facet_slug` (e.g. `"oetker-collection"`). Surfaces as
   * `Brand.identifier`; downstream consumers (agents, AI overviews)
   * use it to reconcile against `/marque/<slug>` collection pages.
   */
  readonly identifier?: string;
}

/**
 * Sources whose `display_name` would duplicate a string already emitted
 * by the `hotelJsonLd` builder from a separate field (typically the
 * `isPalace` flag). Excluded systematically from the award strings —
 * both surfaces target the same downstream consumer (Google Hotel
 * rich-result test, AI agents) and a duplicated entry only inflates
 * the JSON envelope without adding signal.
 *
 * Currently:
 *   - `palace_atout_france` → already emitted as
 *     "Distinction Palace — Atout France" by `hotelJsonLd` when
 *     `isPalace: true` is forwarded by the caller (page.tsx reads
 *     `row.is_palace`).
 *
 * Add new entries here whenever a builder field starts duplicating an
 * affiliation source.
 */
const SOURCES_EMITTED_ELSEWHERE: ReadonlySet<string> = new Set(['palace_atout_france']);

/**
 * Returns the strings to inject into `Hotel.award[]` from the
 * `affiliations` array.
 *
 * Filtering pipeline:
 *   1. Keep only `verified === true` entries (Hard Rule 14).
 *   2. Keep only awardable kinds (`label`, `ranking`, `guide`).
 *      Brand affiliations are **never** awards — they go to `Hotel.brand`
 *      instead. Schema.org explicitly separates the two.
 *   3. Drop sources whose canonical string is already emitted by the
 *      builder via another field (see `SOURCES_EMITTED_ELSEWHERE`).
 *   4. Map to `display_name` (the human-readable string).
 *   5. Dedupe case-insensitively — different sources sometimes emit
 *      the same award (e.g. Forbes 5-Star may appear via two scrapes
 *      with slightly different `source` slugs after a future rename).
 *   6. Sort by `since_year` desc (most recent renewal first), then by
 *      `display_name` for stability.
 */
export function mapAffiliationsToAwardStrings(
  affiliations: readonly HotelAffiliationLike[],
): string[] {
  const eligible = affiliations.filter(
    (a) =>
      a.verified &&
      (a.kind === 'label' || a.kind === 'ranking' || a.kind === 'guide') &&
      !SOURCES_EMITTED_ELSEWHERE.has(a.source),
  );

  // Stable sort: year desc, then name asc.
  const sorted = eligible.slice().sort((a, b) => {
    const aYear = a.since_year ?? 0;
    const bYear = b.since_year ?? 0;
    if (aYear !== bYear) return bYear - aYear;
    return a.display_name.localeCompare(b.display_name, 'fr');
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const aff of sorted) {
    const trimmed = aff.display_name.trim();
    if (trimmed.length === 0) continue;
    const dedupKey = trimmed.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(trimmed);
  }
  return out;
}

/**
 * Returns the single brand affiliation to inject as `Hotel.brand`, or
 * `null` when none exists.
 *
 * Filtering pipeline:
 *   1. Keep only `kind === 'brand' && verified === true`.
 *   2. If multiple are present (data accident — a hotel should have
 *      **at most one** brand by definition, see ADR-0023), pick the
 *      one with the most recent `since_year` (newest acquisition). On
 *      tie, pick the alphabetically first `display_name` for
 *      determinism.
 *
 * Schema.org allows multiple brands on the same Hotel node, but
 * surfacing more than one creates a wrong signal: a property
 * operated by Aman is not also operated by Six Senses. We enforce
 * single-brand at the JSON-LD boundary to keep the AI/agent graph
 * clean.
 */
export function mapAffiliationsToBrand(
  affiliations: readonly HotelAffiliationLike[],
): HotelBrandInput | null {
  const brands = affiliations
    .filter((a) => a.kind === 'brand' && a.verified)
    .slice()
    .sort((a, b) => {
      const aYear = a.since_year ?? 0;
      const bYear = b.since_year ?? 0;
      if (aYear !== bYear) return bYear - aYear;
      return a.display_name.localeCompare(b.display_name, 'fr');
    });

  const top = brands[0];
  if (top === undefined) return null;

  const trimmed = top.display_name.trim();
  if (trimmed.length === 0) return null;

  // Build in one shot — `HotelBrandInput` is `readonly`, so we cannot
  // mutate after the initial object literal under TS strict mode.
  const hasSameAs = top.source_url !== undefined && /^https:\/\//iu.test(top.source_url);
  const hasIdentifier = top.facet_slug !== undefined && top.facet_slug.length > 0;
  return {
    name: trimmed,
    ...(hasSameAs ? { sameAs: top.source_url } : {}),
    ...(hasIdentifier ? { identifier: top.facet_slug } : {}),
  };
}
