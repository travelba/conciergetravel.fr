import { defineRouting } from 'next-intl/routing';

/**
 * `routing` — single source of truth for next-intl routing, navigation
 * and middleware.
 *
 * CDC §3.1 — FR (default) is served from `/` and EN is served from
 * `/en/...`. `localePrefix: 'as-needed'` achieves this natively without
 * per-locale prefix overrides. Explicit `prefixes: { fr: '/' }` triggers
 * an infinite redirect loop in next-intl 3.x because `'/'` is treated as
 * a real prefix segment.
 *
 * V2 readiness — Phase 2 (ADR-0012)
 * ---------------------------------
 *
 * `pathnames` declares the *internal* pathname (left side, what
 * `app/[locale]/...` exposes) and the *external* pathname per locale
 * (right side, what the user sees in the URL). This delivers two things:
 *
 *   1. **SEO** — once a V2 locale activates (Phase 4) it instantly gets
 *      the native slug (e.g. `/de/suche` instead of `/de/recherche`).
 *      Search engines treat these as locale-specific URLs which is the
 *      requirement of `.cursor/rules/seo-geo.mdc` §Slugs d'URL.
 *
 *   2. **Type safety** — the navigation APIs created by
 *      `createNavigation(routing)` in `navigation.ts` become strictly
 *      typed against this object. `<Link href="/recherche">` compiles
 *      only because `/recherche` appears as a key below; a typo will
 *      fail at compile time, not at click time.
 *
 * Slug-localisation policy (ADR-0012 §Phase 2)
 * --------------------------------------------
 *
 * **UI / system routes** (`/recherche`, `/compte/*`, `/cgv`, `/reservation/*`,
 * etc.) — localised in every locale because they carry no SEO equity
 * tied to the FR slug. `/en/search`, `/de/suche`, `/es/buscar`,
 * `/it/cerca` are what natives expect.
 *
 * **Editorial / hotel routes** (`/hotel/[slug]`, `/destination`,
 * `/destination/[citySlug]`, `/guide`, `/guide/[citySlug]`, `/marque/...`,
 * `/categorie/...`, `/classement/...`, `/classements`, `/hotels`,
 * `/guides`) — kept identical across all locales. Two reasons:
 *
 *   - **ADR-0008 (flat hotel slug)** — the slug *is* the canonical URL
 *     identifier for the hotel across the whole product; localising the
 *     container word (`/hotel/` → `/hotels/`) without changing the slug
 *     itself adds cognitive noise without any SEO benefit (Google
 *     dedupes via the slug, not the container).
 *
 *   - **Preservation of existing SEO equity** — `/destination/paris` and
 *     `/guide/paris` are already published and (sparsely) indexed on the
 *     `.fr` domain. Renaming them post-launch would force a 301 with no
 *     editorial upside.
 *
 * **AR / ZH / JA (V3)** — not listed here. Adding them requires
 * script-specific decisions (Romanised slug? Transliterated slug?
 * Native script?) that are out of scope for V2. The V2 entries below
 * stay correct when AR/ZH/JA land — only the `_AR/_ZH/_JA` rows of
 * each entry need filling in.
 *
 * next-intl 3.26.5 inference gotcha
 * ---------------------------------
 * The `const AppPathnames` generic on `defineRouting` fails to
 * propagate into a nested object literal: without `as const` on the
 * `pathnames` block the inferred `AppPathnames` collapses to `never`
 * and `createNavigation(routing)` silently produces the untyped
 * navigation API. The probe in `_routing-type-probe.test.ts` catches
 * regressions if next-intl is upgraded and inference is fixed
 * upstream.
 *
 * @see .cursor/rules/seo-geo.mdc §Slugs d'URL
 * @see .cursor/skills/seo-technical/SKILL.md §V2 multilingual rollout
 * @see docs/runbooks/i18n-v2-rollout.md §Phase 2
 * @see docs/adr/0008-url-structure-hotel-flat.md
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  pathnames: {
    // ---------------------------------------------------------------------
    // Home + system routes
    // ---------------------------------------------------------------------
    '/': '/',

    // ---------------------------------------------------------------------
    // UI / system routes — slugs localised per locale
    // ---------------------------------------------------------------------

    '/recherche': {
      fr: '/recherche',
      en: '/search',
      // V2 placeholders — activated once added to `routing.locales`.
      // de: '/suche', es: '/buscar', it: '/cerca',
    },

    '/a-propos': {
      fr: '/a-propos',
      en: '/about',
      // de: '/ueber-uns', es: '/sobre-nosotros', it: '/chi-siamo',
    },

    // Account area
    '/compte': {
      fr: '/compte',
      en: '/account',
      // de: '/konto', es: '/cuenta', it: '/account',
    },
    '/compte/connexion': {
      fr: '/compte/connexion',
      en: '/account/sign-in',
      // de: '/konto/anmelden', es: '/cuenta/iniciar-sesion', it: '/account/accedi',
    },
    '/compte/inscription': {
      fr: '/compte/inscription',
      en: '/account/sign-up',
      // de: '/konto/registrieren', es: '/cuenta/registrarse', it: '/account/registrati',
    },
    '/compte/deconnexion': {
      fr: '/compte/deconnexion',
      en: '/account/sign-out',
      // de: '/konto/abmelden', es: '/cuenta/cerrar-sesion', it: '/account/disconnetti',
    },
    '/compte/favoris': {
      fr: '/compte/favoris',
      en: '/account/favorites',
      // de: '/konto/favoriten', es: '/cuenta/favoritos', it: '/account/preferiti',
    },
    '/compte/mot-de-passe-oublie': {
      fr: '/compte/mot-de-passe-oublie',
      en: '/account/forgot-password',
      // de: '/konto/passwort-vergessen', es: '/cuenta/recuperar-contrasena', it: '/account/password-dimenticata',
    },
    '/compte/nouveau-mot-de-passe': {
      fr: '/compte/nouveau-mot-de-passe',
      en: '/account/new-password',
      // de: '/konto/neues-passwort', es: '/cuenta/nueva-contrasena', it: '/account/nuova-password',
    },

    // Booking tunnel
    '/reservation/start': {
      fr: '/reservation/start',
      en: '/booking/start',
      // de: '/buchung/start', es: '/reserva/inicio', it: '/prenotazione/inizio',
    },
    '/reservation/invite': {
      fr: '/reservation/invite',
      en: '/booking/guest',
      // de: '/buchung/gast', es: '/reserva/huesped', it: '/prenotazione/ospite',
    },
    '/reservation/recap': {
      fr: '/reservation/recap',
      en: '/booking/summary',
      // de: '/buchung/zusammenfassung', es: '/reserva/resumen', it: '/prenotazione/riepilogo',
    },
    '/reservation/payment': {
      fr: '/reservation/payment',
      en: '/booking/payment',
      // de: '/buchung/zahlung', es: '/reserva/pago', it: '/prenotazione/pagamento',
    },
    '/reservation/confirmation/[ref]': {
      fr: '/reservation/confirmation/[ref]',
      en: '/booking/confirmation/[ref]',
      // de: '/buchung/bestaetigung/[ref]', es: '/reserva/confirmacion/[ref]', it: '/prenotazione/conferma/[ref]',
    },
    '/reservation/offer/[offerId]/lock': {
      fr: '/reservation/offer/[offerId]/lock',
      en: '/booking/offer/[offerId]/lock',
      // de: '/buchung/angebot/[offerId]/sperren', es: '/reserva/oferta/[offerId]/bloquear', it: '/prenotazione/offerta/[offerId]/blocca',
    },

    // Auth callback (system route — same name everywhere)
    '/auth/callback': '/auth/callback',

    // Legal pages
    '/cgv': {
      fr: '/cgv',
      en: '/terms',
      // de: '/agb', es: '/terminos', it: '/termini',
    },
    '/confidentialite': {
      fr: '/confidentialite',
      en: '/privacy',
      // de: '/datenschutz', es: '/privacidad', it: '/privacy',
    },
    '/cookies': '/cookies',
    '/mentions-legales': {
      fr: '/mentions-legales',
      en: '/legal-notice',
      // de: '/impressum', es: '/aviso-legal', it: '/note-legali',
    },

    // ---------------------------------------------------------------------
    // Editorial / hotel routes — slugs identical per locale
    // (ADR-0008 + preservation of existing SEO equity)
    // ---------------------------------------------------------------------

    '/hotel/[slug]': '/hotel/[slug]',
    '/hotel/[slug]/chambres/[roomSlug]': '/hotel/[slug]/chambres/[roomSlug]',
    '/hotels': '/hotels',
    '/destination': '/destination',
    '/destination/[citySlug]': '/destination/[citySlug]',
    '/guide/[citySlug]': '/guide/[citySlug]',
    '/guides': '/guides',
    '/marque/[brandSlug]': '/marque/[brandSlug]',
    '/marques': '/marques',
    // Vague 6 — international country guides. First template
    // (Italie) ships in PR #91; the remaining 7 countries (Suisse,
    // Maroc, EAU, Maldives, Thaïlande, Japon, USA) ship in
    // follow-up PRs with parallel structure.
    '/guide/italie': {
      fr: '/guide/italie',
      en: '/guide/italy',
    },
    '/guide/suisse': {
      fr: '/guide/suisse',
      en: '/guide/switzerland',
    },
    '/guide/maroc': {
      fr: '/guide/maroc',
      en: '/guide/morocco',
    },
    '/guide/maldives': {
      fr: '/guide/maldives',
      en: '/guide/maldives',
    },
    '/guide/emirats-arabes-unis': {
      fr: '/guide/emirats-arabes-unis',
      en: '/guide/uae',
    },
    '/guide/japon': {
      fr: '/guide/japon',
      en: '/guide/japan',
    },
    '/guide/thailande': {
      fr: '/guide/thailande',
      en: '/guide/thailand',
    },
    '/guide/etats-unis': {
      fr: '/guide/etats-unis',
      en: '/guide/usa',
    },
    '/categorie/[categorySlug]': '/categorie/[categorySlug]',
    '/classement/[slug]': '/classement/[slug]',
    '/classements': '/classements',
    '/classements/[axe]/[valeur]': '/classements/[axe]/[valeur]',
    '/inspiration': '/inspiration',
    '/le-concierge': '/le-concierge',
    '/itineraire': '/itineraire',
    '/itineraire/[slug]': '/itineraire/[slug]',
  } as const,
});

export type Locale = (typeof routing.locales)[number];

export function isRoutingLocale(candidate: string | undefined): candidate is Locale {
  if (candidate === undefined) return false;
  for (const l of routing.locales) {
    if (l === candidate) return true;
  }
  return false;
}

/** Request locale from Accept-Language / prefix — falls back to default when unknown. */
export function resolveLocale(candidate: string | undefined): Locale {
  if (isRoutingLocale(candidate)) return candidate;
  return routing.defaultLocale;
}
