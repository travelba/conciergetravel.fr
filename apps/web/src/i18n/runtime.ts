/**
 * i18n runtime helpers — centralised locale-aware mappings.
 *
 * Created as part of ADR-0012 Phase 1 (refactor type-safe).
 * See `.cursor/skills/seo-technical/SKILL.md` §V2 multilingual rollout.
 *
 * Purpose
 * -------
 * Today (May 2026) the codebase contains 32+ files with hardcoded ternaries
 * `locale === 'fr' ? a : 'en' ? b` (200+ occurrences). Each one is a silent
 * fallback waiting to happen when a 3rd locale is added to `routing.locales`.
 *
 * This module provides the *single source of truth* for locale-keyed
 * mappings: every helper here is exhaustive over `KnownLocale` (all 8
 * locales planned across V1/V2/V3). When a new locale is added to
 * `routing.locales`, the type-level guard at the bottom fails to compile
 * until the corresponding entry is added to every map.
 *
 * Behaviour for the current FR/EN active locales is **identical** to the
 * ternaries scattered in the codebase — this file is additive. The codemod
 * that replaces those ternaries with calls to these helpers is a separate
 * PR (ADR-0012 Phase 1, refactor mechanics).
 *
 * Design rules
 * - Pure functions, no I/O, no Next.js / Supabase imports.
 * - Every mapping is a `Record<KnownLocale, T>` (no `Partial`, no fallback).
 *   This forces every future locale to be explicitly assigned, even if the
 *   value is identical to another locale's.
 * - Exhaustiveness over `KnownLocale`, not over `Locale`. `Locale` widens
 *   each time `routing.locales` grows; `KnownLocale` is the planned final
 *   set. The compile-time guard (`_KnownLocaleCoversRoutingLocale`) enforces
 *   `Locale ⊆ KnownLocale`.
 */

import { routing, type Locale } from './routing';

/**
 * All locales planned for the product across V1 (live), V2 (de/es/it),
 * and V3 (ar/zh/ja). This is the **target set** — `routing.locales`
 * grows over time and must always be a subset of this.
 *
 * If you remove a locale here, the compile-time guard at the bottom of
 * this file will fail until `routing.locales` is also reduced.
 */
export type KnownLocale = 'fr' | 'en' | 'de' | 'es' | 'it' | 'ar' | 'zh' | 'ja';

// ---------------------------------------------------------------------------
// Helper 1 — URL path prefix
// ---------------------------------------------------------------------------

/**
 * URL prefix to prepend to in-app paths for a given locale.
 *
 * The default locale (FR today) returns an empty string — `localePrefix:
 * 'as-needed'` in next-intl means the default locale lives at `/`, others
 * at `/<locale>/...`. This helper respects `routing.defaultLocale` as the
 * source of truth, so flipping the default in `routing.ts` propagates here
 * without code changes.
 *
 * @example
 *   localePathPrefix('fr')  // ''
 *   localePathPrefix('en')  // '/en'
 *   localePathPrefix('de')  // '/de'
 */
export function localePathPrefix(locale: Locale): string {
  return locale === routing.defaultLocale ? '' : `/${locale}`;
}

/**
 * Compose a locale-aware in-app path. Replaces the 30+ hand-rolled
 * `locale === 'en' ? \`/en${path}\` : path` ternaries scattered through
 * the codebase (hotel detail, room sub-page, sitemaps, lock action, …).
 *
 * @throws when `path` does not start with `/` — defensive guard against
 *         callers that already concatenated a prefix.
 *
 * @example
 *   withLocalePath('fr', '/hotel/le-bristol')  // '/hotel/le-bristol'
 *   withLocalePath('en', '/hotel/le-bristol')  // '/en/hotel/le-bristol'
 *   withLocalePath('de', '/hotel/le-bristol')  // '/de/hotel/le-bristol'
 */
export function withLocalePath(locale: Locale, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`withLocalePath: path must start with '/', got: ${path}`);
  }
  return `${localePathPrefix(locale)}${path}`;
}

// ---------------------------------------------------------------------------
// Helper 2 — BCP-47 tag for Intl.* APIs
// ---------------------------------------------------------------------------

/**
 * BCP-47 language tag for use with `Intl.DateTimeFormat`, `Intl.NumberFormat`,
 * `Intl.Collator`, etc. The EN tag is `en-GB` to match the codebase's
 * existing date formatting choice — see `hotel/[slug]/page.tsx`.
 *
 * Region codes encode the **dominant target market** for each locale:
 *  - de-DE (Germany — V2 priority over AT/CH per audit mai 2026)
 *  - es-ES (Spain — neutral Castilian, not LATAM)
 *  - it-IT (Italy)
 *  - ar-SA (MSA, Saudi Arabia as anchor)
 *  - zh-CN (Mandarin, mainland; simplified script)
 *  - ja-JP (Japan)
 *
 * Changing a region code is a marketing decision (see brief). When that
 * happens, audit every `Intl.DateTimeFormat(intlLocaleTag(...))` call site
 * for cosmetic regressions (date order, decimal separator, currency glyph).
 */
const INTL_LOCALE_TAG: Record<KnownLocale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

export function intlLocaleTag(locale: Locale): string {
  return INTL_LOCALE_TAG[locale];
}

// ---------------------------------------------------------------------------
// Helper 3 — Open Graph locale
// ---------------------------------------------------------------------------

/**
 * Open Graph locale identifier (`og:locale`). Format is `<lang>_<REGION>`
 * with an underscore, per the OG protocol — not the BCP-47 hyphen.
 *
 * The EN value is `en_US` (not `en_GB`) to match the codebase's existing
 * choice — Open Graph is consumed primarily by Facebook/LinkedIn which
 * normalise both forms but the dominant share/test convention is US.
 *
 * Used by:
 *  - `hotel/[slug]/page.tsx` generateMetadata → openGraph.locale
 *  - `[locale]/layout.tsx` generateMetadata → openGraph.locale
 *  - Any future generateMetadata that emits OG tags
 */
const OG_LOCALE: Record<KnownLocale, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  de: 'de_DE',
  es: 'es_ES',
  it: 'it_IT',
  ar: 'ar_SA',
  zh: 'zh_CN',
  ja: 'ja_JP',
};

export function ogLocale(locale: Locale): string {
  return OG_LOCALE[locale];
}

// ---------------------------------------------------------------------------
// Helper 4 — hreflang alternates map
// ---------------------------------------------------------------------------

/**
 * Hreflang key used in `Metadata.alternates.languages`. This is the value
 * Google reads from `<link rel="alternate" hreflang="…">`.
 *
 * Convention preserved from the existing codebase:
 *  - FR (default locale) uses the full region tag `fr-FR`.
 *  - All other locales use the short ISO 639-1 code.
 *
 * The asymmetry is historical. Google honours both forms; the short form
 * is the safest fallback because it matches both `de` and `de-DE` searches.
 * Changing this requires updating every existing `alternates.languages`
 * literal in lockstep and verifying with Screaming Frog post-deployment.
 */
const HREFLANG_KEY: Record<KnownLocale, string> = {
  fr: 'fr-FR',
  en: 'en',
  de: 'de',
  es: 'es',
  it: 'it',
  ar: 'ar',
  zh: 'zh',
  ja: 'ja',
};

export function hreflangKey(locale: Locale): string {
  return HREFLANG_KEY[locale];
}

/**
 * Build the full `Metadata.alternates.languages` map for a given path
 * shape. The caller provides a function that returns the canonical path
 * for a locale (typically because the slug differs per locale — see e.g.
 * `slug_en` on hotels), and this helper iterates over `routing.locales`
 * and adds the `x-default` entry.
 *
 * Replaces the hand-rolled `alternates.languages` literals scattered
 * across `hotel/[slug]/page.tsx`, `recherche/page.tsx`, `[locale]/layout.tsx`,
 * etc. — those literals only know about FR and EN today and would lie to
 * Google the moment a 3rd locale is added.
 *
 * @example
 *   buildHreflangAlternates((locale) =>
 *     locale === 'en' ? `/en/hotel/${slugEn}` : `/hotel/${slugFr}`
 *   )
 *   // → { 'fr-FR': '/hotel/le-bristol',
 *   //     'en': '/en/hotel/le-bristol-paris',
 *   //     'x-default': '/hotel/le-bristol' }
 *
 * @example When DE is added to routing.locales (post-Phase 3) the same
 *   call returns an extra `'de': '/de/hotel/<slug-de>'` entry
 *   automatically — no per-call-site change needed.
 */
export function buildHreflangAlternates(
  hrefForLocale: (locale: Locale) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of routing.locales) {
    out[hreflangKey(locale)] = hrefForLocale(locale);
  }
  out['x-default'] = hrefForLocale(routing.defaultLocale);
  return out;
}

// ---------------------------------------------------------------------------
// Compile-time guards
// ---------------------------------------------------------------------------

/**
 * Compile-time assertion that every locale present in `routing.locales`
 * is also present in `KnownLocale` (and therefore in every mapping above).
 *
 * If someone widens `routing.locales` with a string that is not in
 * `KnownLocale`, the assignment below fails to compile with a clear
 * "type 'X' is not assignable to type 'never'" message — pointing
 * directly at this file.
 *
 * The inverse is **not** asserted: `KnownLocale` may legitimately contain
 * locales not yet in `routing.locales` (the V2/V3 locales waiting to be
 * activated). That asymmetry is intentional.
 */
type _LocaleSubsetOfKnown = Locale extends KnownLocale ? true : never;

/**
 * Type-level guard exported so tsc (`noUnusedLocals: true`) keeps it
 * in scope. **Do not import.** The double-underscore prefix is the
 * convention in this repo for "exists only to anchor a compile-time
 * assertion". A `Record<KnownLocale, …>` map deeper in this file
 * would also catch missing locales, but emits an opaque error site;
 * this constant gives a single, explicit failure point with a
 * comment trail.
 */
export const __LOCALE_IS_KNOWN: _LocaleSubsetOfKnown = true;
