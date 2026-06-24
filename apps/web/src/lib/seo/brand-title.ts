/**
 * Brand-suffix de-duplication for document `<title>` fields.
 *
 * The root layout (`app/layout.tsx`) sets a metadata title template
 * `'%s · MyConciergeHotel'`, which appends the brand to every page whose
 * `title` is returned as a plain string. Several routes (hotel, room,
 * itinerary, lieu) build a `title` that *already* ends with a brand
 * suffix — either from a DB-stored `meta_title_*` column ("… |
 * MyConciergeHotel") or from an i18n fallback. The template then appends
 * the brand a second time, producing "… | MyConciergeHotel ·
 * MyConciergeHotel" in the SERP.
 *
 * `stripBrandSuffix` removes any trailing brand suffix so the template
 * adds the brand exactly once. It is separator-agnostic (pipe, em-dash,
 * en-dash, middle dot, hyphen) and idempotent. Open Graph / Twitter
 * titles do NOT use the template, so they keep the brand and must NOT be
 * passed through this helper.
 */

export const BRAND_NAME = 'MyConciergeHotel';

// Matches one trailing " <separator> MyConciergeHotel" segment.
// Separators: `|` `—` (U+2014) `·` (U+00B7) `–` (U+2013) `-`.
const TRAILING_BRAND_SUFFIX = /\s*[|\u2014\u00b7\u2013-]\s*MyConciergeHotel\s*$/u;

export function stripBrandSuffix(title: string): string {
  let out = title.trim();
  // Loop to collapse a doubled suffix if a source ever stacked two.
  while (TRAILING_BRAND_SUFFIX.test(out)) {
    out = out.replace(TRAILING_BRAND_SUFFIX, '').trim();
  }
  return out;
}
