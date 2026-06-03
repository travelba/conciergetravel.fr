import { JsonLd } from '@mch/seo';

import { env } from '@/lib/env';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * Canonical brand Organization (OTA) JSON-LD — single source of truth.
 *
 * MyConciergeHotel is an IATA travel agency, so the most specific correct
 * Schema.org type is `TravelAgency` (a subtype of `LocalBusiness` →
 * `Organization`). One — and only one — brand node is emitted site-wide
 * from `[locale]/layout.tsx`, carrying a stable `@id` so any other node
 * (`WebSite.publisher`, `Article.publisher`…) can *reference* the brand
 * instead of re-declaring a duplicate Organization per page.
 *
 * Individual hotels are NEVER represented by this node: they are emitted as
 * `Hotel` (`LocalBusiness` subtype) on their own fiche. Keeping the brand
 * Organization separate from the hotel entities prevents the "16 Organization"
 * noise the Rich Results Test flagged.
 */

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/** Site origin without a trailing slash. */
function resolveSiteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Stable, locale-independent `@id` of the brand Organization. Use this from
 * any page that wants to point at the brand (e.g. `publisher: { '@id': … }`).
 */
export function brandOrganizationId(): string {
  return `${resolveSiteUrl()}#organization`;
}

/** Brand-level description (kept short + stable — not page-specific copy). */
function brandDescription(locale: Locale): string {
  return locale === 'en'
    ? "The Concierge's Selection — an IATA travel agency curating extraordinary hotels (Atout France Palaces, Forbes Five Star, MICHELIN Keys, Relais & Châteaux). Editorial picks, GDS net rates, secure Amadeus payment, loyalty from the first night."
    : "La sélection du Concierge — agence de voyages IATA qui sélectionne des hôtels d'exception (Palaces Atout France, Forbes Five Star, Clés MICHELIN, Relais & Châteaux). Sélection éditoriale, tarifs nets GDS, paiement sécurisé Amadeus, fidélité dès la première nuit.";
}

/**
 * Builds the Schema.org-wrapped brand Organization node for the given locale.
 * `sameAs` is intentionally omitted until the brand owns public social
 * profiles (Phase 2: LinkedIn / Crunchbase / Trustpilot) — fabricating
 * unverifiable profile URLs would breach EEAT.
 */
export function buildBrandOrganizationJsonLd(
  locale: Locale,
): ReturnType<typeof JsonLd.withSchemaOrgContext> {
  const siteUrl = resolveSiteUrl();
  return JsonLd.withSchemaOrgContext(
    JsonLd.travelAgencyJsonLd({
      id: `${siteUrl}#organization`,
      name: 'MyConciergeHotel',
      url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
      logoUrl: `${siteUrl}/logos/logo-dark.png`,
      description: brandDescription(locale),
      iataCode: 'FR',
      contactEmail: 'contact@myconciergehotel.com',
    }),
  );
}

/**
 * Canonical site-level `WebSite` node (with the Google sitelinks SearchAction).
 *
 * Factored here next to the brand Organization so both "common" root nodes
 * share one source of truth. `publisher` points at the brand by stable `@id`
 * so Organization + WebSite form a single connected graph. Emitted ONLY from
 * the site root (the home page) per ADR-0014 §2.2 — Google expects the
 * `WebSite` node at the root, not on every page.
 */
export function buildWebsiteJsonLd(locale: Locale): ReturnType<typeof JsonLd.withSchemaOrgContext> {
  const siteUrl = resolveSiteUrl();
  const searchUrl = `${siteUrl}${getPathname({ locale, href: '/recherche' })}`;
  return JsonLd.withSchemaOrgContext({
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: 'MyConciergeHotel',
    url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
    publisher: { '@id': brandOrganizationId() },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${searchUrl}?destination={search_term_string}`,
      },
      // `query-input` is required by Google for the sitelinks search box.
      // The literal string contract is fragile but mandated by schema.org.
      'query-input': 'required name=search_term_string',
    },
  });
}
