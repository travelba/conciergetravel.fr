import { describe, expect, it } from 'vitest';

import { LEGACY_EN_PREFIX_REDIRECTS, matchLegacyEnRedirect } from './i18n/legacy-en-redirects';

/**
 * The redirect logic itself is wired into `middleware.ts` ahead of the
 * next-intl middleware (see comment "// 0. Legacy EN URL redirects").
 * This file exercises the pure `matchLegacyEnRedirect` helper that
 * decides whether a redirect applies — the integration test (request
 * → NextResponse.redirect) would require booting Next.js' Edge runtime
 * with `@supabase/ssr` mocked, which is significantly more brittle
 * than asserting on the table the middleware reads.
 */
describe('matchLegacyEnRedirect', () => {
  it('redirects bare /en/recherche to /en/search', () => {
    expect(matchLegacyEnRedirect('/en/recherche')).toBe('/en/search');
  });

  it('redirects /en/a-propos to /en/about', () => {
    expect(matchLegacyEnRedirect('/en/a-propos')).toBe('/en/about');
  });

  it('redirects /en/cgv to /en/terms', () => {
    expect(matchLegacyEnRedirect('/en/cgv')).toBe('/en/terms');
  });

  it('redirects /en/confidentialite to /en/privacy', () => {
    expect(matchLegacyEnRedirect('/en/confidentialite')).toBe('/en/privacy');
  });

  it('redirects /en/mentions-legales to /en/legal-notice', () => {
    expect(matchLegacyEnRedirect('/en/mentions-legales')).toBe('/en/legal-notice');
  });

  it('redirects bare /en/compte to /en/account', () => {
    expect(matchLegacyEnRedirect('/en/compte')).toBe('/en/account');
  });

  it('redirects every /en/compte/<suffix> to /en/account/<suffix>', () => {
    expect(matchLegacyEnRedirect('/en/compte/connexion')).toBe('/en/account/connexion');
    expect(matchLegacyEnRedirect('/en/compte/inscription')).toBe('/en/account/inscription');
    expect(matchLegacyEnRedirect('/en/compte/favoris')).toBe('/en/account/favoris');
    expect(matchLegacyEnRedirect('/en/compte/deconnexion')).toBe('/en/account/deconnexion');
    expect(matchLegacyEnRedirect('/en/compte/mot-de-passe-oublie')).toBe(
      '/en/account/mot-de-passe-oublie',
    );
  });

  it('redirects /en/reservation/<step> to /en/booking/<step>', () => {
    expect(matchLegacyEnRedirect('/en/reservation/start')).toBe('/en/booking/start');
    expect(matchLegacyEnRedirect('/en/reservation/recap')).toBe('/en/booking/recap');
    expect(matchLegacyEnRedirect('/en/reservation/payment')).toBe('/en/booking/payment');
    expect(matchLegacyEnRedirect('/en/reservation/confirmation/PNR123')).toBe(
      '/en/booking/confirmation/PNR123',
    );
    expect(matchLegacyEnRedirect('/en/reservation/offer/OFFER-1/lock')).toBe(
      '/en/booking/offer/OFFER-1/lock',
    );
  });

  it('returns null for paths that are not legacy EN slugs', () => {
    expect(matchLegacyEnRedirect('/en/search')).toBeNull();
    expect(matchLegacyEnRedirect('/en/account')).toBeNull();
    expect(matchLegacyEnRedirect('/en/booking/start')).toBeNull();
    expect(matchLegacyEnRedirect('/en/hotel/le-bristol')).toBeNull();
    expect(matchLegacyEnRedirect('/recherche')).toBeNull();
    expect(matchLegacyEnRedirect('/compte')).toBeNull();
    expect(matchLegacyEnRedirect('/')).toBeNull();
  });

  it('does not partial-match a non-segment prefix', () => {
    expect(matchLegacyEnRedirect('/en/recherchezzz')).toBeNull();
    expect(matchLegacyEnRedirect('/en/comptez')).toBeNull();
    expect(matchLegacyEnRedirect('/en/reservationz')).toBeNull();
    expect(matchLegacyEnRedirect('/en/cgvz')).toBeNull();
  });

  it('is case-sensitive (URL paths are case-sensitive per RFC 3986)', () => {
    expect(matchLegacyEnRedirect('/EN/recherche')).toBeNull();
    expect(matchLegacyEnRedirect('/en/Recherche')).toBeNull();
  });
});

describe('LEGACY_EN_PREFIX_REDIRECTS table', () => {
  it('contains entries for every Phase 2 localised UI / system route', () => {
    const fromPaths = LEGACY_EN_PREFIX_REDIRECTS.map((entry) => entry.from);
    expect(fromPaths).toContain('/en/recherche');
    expect(fromPaths).toContain('/en/a-propos');
    expect(fromPaths).toContain('/en/compte');
    expect(fromPaths).toContain('/en/reservation');
    expect(fromPaths).toContain('/en/cgv');
    expect(fromPaths).toContain('/en/confidentialite');
    expect(fromPaths).toContain('/en/mentions-legales');
  });

  it('every entry maps a /en/<fr-slug> path to an /en/<en-slug> path', () => {
    for (const entry of LEGACY_EN_PREFIX_REDIRECTS) {
      expect(entry.from).toMatch(/^\/en\/[a-z-]+$/);
      expect(entry.to).toMatch(/^\/en\/[a-z-]+$/);
      expect(entry.from).not.toBe(entry.to);
    }
  });

  it('has no duplicate `from` entries', () => {
    const fromPaths = LEGACY_EN_PREFIX_REDIRECTS.map((entry) => entry.from);
    const unique = new Set(fromPaths);
    expect(unique.size).toBe(fromPaths.length);
  });
});
