import 'server-only';

import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';
import { buildBrandOrganizationJsonLd } from '@/lib/jsonld/brand-organization';

import { SeoJsonLd } from './json-ld';

interface SiteSeoJsonLdProps {
  readonly locale: Locale;
  /** Per-request CSP nonce, read once at the layout boundary. */
  readonly nonce: string | undefined;
}

/**
 * Site-wide SEO graph, rendered once from the locale layout so it ships on
 * every page's initial server HTML.
 *
 * Carries the brand **Organization** node (a `TravelAgency`, single source of
 * truth with a stable `@id`). The sibling **WebSite** node is intentionally
 * NOT emitted here: per ADR-0014 §2.2 Google expects `WebSite` at the site
 * root only, so the home page renders it via `buildWebsiteJsonLd` + `SeoJsonLd`.
 * Both builders live together in `lib/jsonld/brand-organization.ts`, keeping
 * the common root nodes in one place.
 */
export function SiteSeoJsonLd({ locale, nonce }: SiteSeoJsonLdProps): ReactElement {
  return <SeoJsonLd nonce={nonce} nodes={buildBrandOrganizationJsonLd(locale)} />;
}
