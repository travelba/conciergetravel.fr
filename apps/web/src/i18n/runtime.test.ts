import { describe, expect, it } from 'vitest';

import {
  buildHreflangAlternates,
  hreflangKey,
  intlLocaleTag,
  localePathPrefix,
  ogLocale,
  withLocalePath,
} from './runtime';

describe('localePathPrefix', () => {
  it('returns an empty string for the default locale (FR)', () => {
    expect(localePathPrefix('fr')).toBe('');
  });

  it('returns "/<locale>" for non-default locales', () => {
    expect(localePathPrefix('en')).toBe('/en');
  });
});

describe('withLocalePath', () => {
  it('does not prefix the path for the default locale', () => {
    expect(withLocalePath('fr', '/hotel/le-bristol')).toBe('/hotel/le-bristol');
  });

  it('prefixes the path with the locale for non-default locales', () => {
    expect(withLocalePath('en', '/hotel/le-bristol-paris')).toBe('/en/hotel/le-bristol-paris');
  });

  it('throws when path does not start with "/"', () => {
    expect(() => withLocalePath('fr', 'hotel/le-bristol')).toThrow(/must start with/);
  });

  it('handles the root path correctly', () => {
    expect(withLocalePath('fr', '/')).toBe('/');
    expect(withLocalePath('en', '/')).toBe('/en/');
  });
});

describe('intlLocaleTag', () => {
  it('returns BCP-47 tags with region for the live locales', () => {
    expect(intlLocaleTag('fr')).toBe('fr-FR');
    expect(intlLocaleTag('en')).toBe('en-GB');
  });
});

describe('ogLocale', () => {
  it('returns OG-format locale (underscore separator) for the live locales', () => {
    expect(ogLocale('fr')).toBe('fr_FR');
    expect(ogLocale('en')).toBe('en_US');
  });
});

describe('hreflangKey', () => {
  it('uses the full region tag for the default locale (historical asymmetry)', () => {
    expect(hreflangKey('fr')).toBe('fr-FR');
  });

  it('uses the short ISO 639-1 code for non-default locales', () => {
    expect(hreflangKey('en')).toBe('en');
  });
});

describe('buildHreflangAlternates', () => {
  it('emits one entry per active locale plus x-default → default locale', () => {
    const alternates = buildHreflangAlternates((locale) =>
      locale === 'fr' ? '/hotel/le-bristol' : `/${locale}/hotel/le-bristol-paris`,
    );

    expect(alternates).toEqual({
      'fr-FR': '/hotel/le-bristol',
      en: '/en/hotel/le-bristol-paris',
      'x-default': '/hotel/le-bristol',
    });
  });

  it('returns identical content for the default locale and x-default', () => {
    const alternates = buildHreflangAlternates((locale) => `/${locale}/some/path`);
    expect(alternates['x-default']).toBe(alternates['fr-FR']);
  });

  it('replicates the existing hotel detail page mapping shape', () => {
    // Reproduces the literal in apps/web/src/app/[locale]/hotel/[slug]/page.tsx
    // generateMetadata. The codemod that replaces that literal with a call
    // to buildHreflangAlternates must produce byte-identical output for
    // the active locales.
    const slugFr = 'le-bristol';
    const slugEn = 'le-bristol-paris';
    const alternates = buildHreflangAlternates((locale) =>
      locale === 'fr' ? `/hotel/${slugFr}` : `/${locale}/hotel/${slugEn}`,
    );
    expect(alternates).toStrictEqual({
      'fr-FR': `/hotel/${slugFr}`,
      en: `/en/hotel/${slugEn}`,
      'x-default': `/hotel/${slugFr}`,
    });
  });
});
