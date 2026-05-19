import { assertNever } from '@/lib/assert-never';

/**
 * `SupportedLocale` — canonical type for the **data layer**.
 *
 * This is intentionally **wider** than `routing.locales` (FR/EN today):
 * V2 scope (FR/EN/DE/ES/IT) is baked into the type so every `pickXxx` /
 * `readXxx` is forced — at compile time — to enumerate every locale that
 * is being planned for production. The Phase 4 activation of `de` / `es` /
 * `it` will then only require flipping `routing.locales` + producing the
 * editorial content; the readers are already exhaustive.
 *
 * **Scope vs `KnownLocale` (in `runtime.ts`)** — `KnownLocale` is the full
 * 8-locale set including V3 (AR/ZH/JA). It governs the **presentation
 * layer** helpers (URL prefix, OG tag, Intl tag, hreflang key) so they are
 * V3-ready ahead of the data layer. `SupportedLocale` stays at V2 scope
 * to match the planned DB-column / `*_translations`-table coverage. The
 * two narrow → widen in lockstep with the runbook.
 *
 * Cross-references:
 * - Runbook: `docs/runbooks/i18n-v2-rollout.md` §Phase 1c
 * - ADR: `docs/adr/0012-multilingual-db-schema.md`
 * - Skill: `.cursor/skills/seo-technical/SKILL.md` §V2 multilingual rollout
 */
export type SupportedLocale = 'fr' | 'en' | 'de' | 'es' | 'it';

/**
 * V1 locales — the ones for which the DB carries real columns today.
 * Useful in narrowing helpers when the caller has already filtered out
 * the "data layer pre-migration" locales.
 */
export type V1Locale = 'fr' | 'en';

/**
 * Predicate — has the data layer been migrated for this locale yet?
 *
 * Returns `false` for `de` / `es` / `it` until Phase 3 migrations 0034 +
 * 0035 land in production. Readers that want to short-circuit the
 * pickXxx switch can call this first and bail out to a documented FR
 * fallback.
 */
export function isV1Locale(locale: SupportedLocale): locale is V1Locale {
  return locale === 'fr' || locale === 'en';
}

/**
 * Picks a localized text field with the V2 fallback policy.
 *
 * - FR → `fr ?? en ?? null`
 * - EN → `en ?? fr ?? null`
 * - DE / ES / IT → `fr ?? en ?? null` (FR fallback during the migration
 *   window — `*_translations` rows for these locales do not exist
 *   yet, cf. [ADR-0012](../../../../docs/adr/0012-multilingual-db-schema.md)
 *   §Phase 3).
 *
 * Centralising the policy in one place keeps the V2 → Phase 3 transition
 * surgical: the day translations land, only this function (+ the schema
 * + a couple of column reads) need to change. Every reader downstream
 * stays untouched.
 *
 * Returns `null` if both inputs are nullish. Pair with `?? defaultValue`
 * at the call site when the caller needs a guaranteed string.
 */
export function pickLocalizedText(
  locale: SupportedLocale,
  fr: string | null | undefined,
  en: string | null | undefined,
): string | null {
  switch (locale) {
    case 'fr':
    case 'de':
    case 'es':
    case 'it':
      return fr ?? en ?? null;
    case 'en':
      return en ?? fr ?? null;
    default:
      return assertNever(locale);
  }
}

/**
 * Picks one of two branches based on locale, with the same V2 fallback
 * policy as `pickLocalizedText`. Use for non-text branches —
 * candidate-key arrays, single-column picks without a fallback chain,
 * SQL column names, or anywhere the FR/EN branches are not simple
 * `string | null` cells.
 */
export function pickByLocale<T>(locale: SupportedLocale, frBranch: T, enBranch: T): T {
  switch (locale) {
    case 'fr':
    case 'de':
    case 'es':
    case 'it':
      return frBranch;
    case 'en':
      return enBranch;
    default:
      return assertNever(locale);
  }
}
