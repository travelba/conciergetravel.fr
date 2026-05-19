/**
 * Compile-time exhaustiveness helper.
 *
 * Use as the `default:` branch of a `switch` over a union to force TypeScript
 * to flag every missing case at compile time. If a non-`never` value reaches
 * this function at runtime, it throws (defensive — should be unreachable in
 * a typechecked codebase).
 *
 * Why this matters for i18n V2 — widening `SupportedLocale` from
 * `'fr' | 'en'` to `'fr' | 'en' | 'de' | 'es' | 'it'` without `assertNever`
 * lets old `if (locale === 'fr') return X; return Y;` patterns silently
 * serve EN content for DE/ES/IT URLs (silent fallback, SEO disaster). With
 * `assertNever`, the compiler refuses to build until every reader explicitly
 * handles the new locales (and the reader can decide: real translation,
 * explicit FR fallback during the migration window, or `null`).
 *
 * @example
 * ```ts
 * switch (locale) {
 *   case 'fr': return row.name;
 *   case 'en': return row.name_en ?? row.name;
 *   case 'de':
 *   case 'es':
 *   case 'it':
 *     // No DB column yet — fall back to FR until migration 0034+.
 *     return row.name;
 *   default:
 *     return assertNever(locale);
 * }
 * ```
 */
export function assertNever(x: never): never {
  throw new Error(`assertNever: unreachable value reached at runtime: ${String(x)}`);
}
