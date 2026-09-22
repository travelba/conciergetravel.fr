import { defineRouting } from 'next-intl/routing';

/**
 * v2 routing — simplified from apps/web. FR default (`localePrefix: 'as-needed`).
 * Includes `/programme-membre` (v2-only member program route).
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  pathnames: {
    '/': '/',

    '/recherche': {
      fr: '/recherche',
      en: '/search',
    },

    '/compte': {
      fr: '/compte',
      en: '/account',
    },

    '/compte/voyages': {
      fr: '/compte/voyages',
      en: '/account/trips',
    },
    '/compte/favoris': {
      fr: '/compte/favoris',
      en: '/account/favorites',
    },
    '/compte/profil': {
      fr: '/compte/profil',
      en: '/account/profile',
    },
    '/compte/preferences': {
      fr: '/compte/preferences',
      en: '/account/preferences',
    },
    '/compte/securite': {
      fr: '/compte/securite',
      en: '/account/security',
    },
    '/compte/confidentialite': {
      fr: '/compte/confidentialite',
      en: '/account/privacy',
    },

    '/programme-membre': {
      fr: '/programme-membre',
      en: '/member-program',
    },

    '/hotel/[slug]': '/hotel/[slug]',
    '/hotels': '/hotels',
    '/hotels/[pays]': '/hotels/[pays]',
    '/hotels/[pays]/[ville]': '/hotels/[pays]/[ville]',
    '/classement/[slug]': '/classement/[slug]',
    '/classements': '/classements',
    '/classements/[axe]/[valeur]': '/classements/[axe]/[valeur]',

    '/destination': '/destination',
    '/destination/[citySlug]': '/destination/[citySlug]',
    '/lieux': '/lieux',
    '/itineraires': '/itineraires',
    '/categorie/[slug]': '/categorie/[slug]',
    '/marque/[slug]': '/marque/[slug]',
    '/label/[slug]': '/label/[slug]',
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

export function resolveLocale(candidate: string | undefined): Locale {
  if (isRoutingLocale(candidate)) return candidate;
  return routing.defaultLocale;
}
