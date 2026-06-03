import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Route } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Search autocomplete — progressive-enhancement combobox on the hero
 * (`CatalogSearchForm`) and header (`HeaderQuickSearch`).
 *
 * Skill: search-engineering, accessibility §combobox. The dropdown is a
 * client island that calls `GET /api/search/suggest` after hydration.
 * CI boots without Algolia credentials, so we mock that single endpoint
 * to exercise the rendered states (deep-link navigation, keyboard nav,
 * grouping) deterministically.
 *
 * The native `<form method="get">` fallback (typing + Enter posts
 * `?destination=…`) is covered by `home-redesign.spec.ts`; this spec
 * focuses on the enhancement layer.
 */

const SUGGEST_GLOB = '**/api/search/suggest**';

interface SuggestBody {
  readonly ok: true;
  readonly query: string;
  readonly locale: 'fr' | 'en';
  readonly hotels: ReadonlyArray<{
    readonly objectID: string;
    readonly name: string;
    readonly city: string;
    readonly region: string;
    readonly country: string | null;
    readonly slug: string;
    readonly href: string;
    readonly is_palace: boolean;
    readonly stars: number;
  }>;
  readonly cities: ReadonlyArray<{
    readonly objectID: string;
    readonly name: string;
    readonly region: string;
    readonly country: string | null;
    readonly slug: string;
    readonly href: string;
    readonly hotels_count: number;
    readonly is_popular: boolean;
  }>;
  readonly countries: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly slug: string;
    readonly href: string;
    readonly hotels_count: number;
  }>;
}

function mockBody(locale: 'fr' | 'en'): SuggestBody {
  const prefix = locale === 'en' ? '/en' : '';
  return {
    ok: true,
    query: 'par',
    locale,
    cities: [
      {
        objectID: '11111111-1111-1111-1111-111111111111',
        name: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        slug: 'paris',
        // A city search now deep-links to the country-scoped annuaire
        // directory `/hotels/<pays>/<ville>` (ADR-0026), not the legacy
        // `/destination/<slug>` hub.
        href: `${prefix}/hotels/france/paris`,
        hotels_count: 42,
        is_popular: true,
      },
    ],
    countries: [
      {
        code: 'FR',
        name: 'France',
        slug: 'france',
        href: `${prefix}/hotels/france`,
        hotels_count: 280,
      },
    ],
    hotels: [
      {
        objectID: '22222222-2222-2222-2222-222222222222',
        name: 'Le Meurice',
        city: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        slug: 'le-meurice',
        href: `${prefix}/hotel/le-meurice`,
        is_palace: true,
        stars: 5,
      },
    ],
  };
}

async function fulfilSuggest(route: Route, locale: 'fr' | 'en'): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockBody(locale)),
  });
}

test.describe('search autocomplete (hero + header)', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR — hero combobox shows grouped suggestions and deep-links to a hotel', async ({
    page,
  }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');

    const combobox = page.locator('#home-hero-search-destination');
    await expect(combobox).toHaveAttribute('role', 'combobox');
    await expect(combobox).toHaveAttribute('aria-expanded', 'false');

    await combobox.fill('par');

    // Listbox opens with a Destinations group + a Hotels group.
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    // City option (Destinations group) — matched on the region label so
    // it doesn't collide with the hotel option ("…· Paris").
    await expect(page.getByRole('option', { name: /Île-de-France/ })).toBeVisible();

    const hotelOption = page.getByRole('option', { name: /Le Meurice/ });
    await expect(hotelOption).toBeVisible();

    await hotelOption.click();
    await expect(page).toHaveURL(/\/hotel\/le-meurice$/);
  });

  test('FR — keyboard navigation sets aria-activedescendant and Enter navigates', async ({
    page,
  }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');

    const combobox = page.locator('#home-hero-search-destination');
    await combobox.fill('par');
    await expect(page.getByRole('listbox')).toBeVisible();

    // First ArrowDown highlights the first option (the Paris destination).
    await combobox.press('ArrowDown');
    const activeId = await combobox.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();

    // Flat order is cities → countries → hotels, so reaching the hotel
    // option (Le Meurice) takes three steps: city, country, hotel. Enter
    // then follows its deep link.
    await combobox.press('ArrowDown');
    await combobox.press('ArrowDown');
    await combobox.press('Enter');
    await expect(page).toHaveURL(/\/hotel\/le-meurice$/);
  });

  test('FR — Enter on free text (no active option) submits the native search form', async ({
    page,
  }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');

    const combobox = page.locator('#home-hero-search-destination');
    // Type with real key events (after focusing) so the controlled input's
    // onChange is guaranteed wired post-hydration, then wait for the suggest
    // response so the dropdown is genuinely open before we press Enter.
    await combobox.click();
    await combobox.pressSequentially('par');
    await page.waitForResponse((r) => r.url().includes('/api/search/suggest'));
    await expect(page.getByRole('listbox')).toBeVisible();

    // No ArrowDown → no active option → Enter must submit the form
    // (catalogue free-text search), landing on /recherche?destination=par.
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/recherche')),
      combobox.press('Enter'),
    ]);
    expect(new URL(request.url()).searchParams.get('destination')).toBe('par');
  });

  test('FR — open dropdown has no critical axe violations', async ({ page }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');
    await page.locator('#home-hero-search-destination').fill('par');
    await expect(page.getByRole('listbox')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(
      critical,
      `axe critical violations: ${JSON.stringify(critical.map((v) => v.id))}`,
    ).toEqual([]);
  });

  test('FR — countries group deep-links to the annuaire directory', async ({ page }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');

    const combobox = page.locator('#home-hero-search-destination');
    await combobox.fill('par');
    await expect(page.getByRole('listbox')).toBeVisible();

    // The dropdown carries a Pays group; its option deep-links to the
    // per-country directory `/hotels/<slug>` (ADR-0026) so a country
    // query lands on every hotel in that country. Scope to the group so
    // the matcher doesn't collide with the city / hotel lines that now
    // also display "· France".
    const countryOption = page.getByRole('group', { name: 'Pays' }).getByRole('option');
    await expect(countryOption).toHaveCount(1);
    await expect(countryOption).toContainText('France');
    await countryOption.click();
    await expect(page).toHaveURL(/\/hotels\/france$/);
  });

  test('FR — city option deep-links to the annuaire city directory', async ({ page }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'fr'));
    await page.goto('/');

    const combobox = page.locator('#home-hero-search-destination');
    await combobox.fill('par');
    await expect(page.getByRole('listbox')).toBeVisible();

    // The Paris city line (matched on its region label so it doesn't
    // collide with the hotel option "… · Paris") now lands on the
    // country-scoped annuaire `/hotels/<pays>/<ville>` (ADR-0026).
    const cityOption = page.getByRole('option', { name: /Île-de-France/ });
    await expect(cityOption).toBeVisible();
    await cityOption.click();
    await expect(page).toHaveURL(/\/hotels\/france\/paris$/);
  });

  test('EN — hero combobox deep-links to the localized hotel path', async ({ page }) => {
    await page.route(SUGGEST_GLOB, (route) => fulfilSuggest(route, 'en'));
    await page.goto('/en');

    const combobox = page.locator('#home-hero-search-destination');
    await expect(combobox).toHaveAttribute('role', 'combobox');
    await combobox.fill('par');

    const hotelOption = page.getByRole('option', { name: /Le Meurice/ });
    await expect(hotelOption).toBeVisible();
    await hotelOption.click();
    await expect(page).toHaveURL(/\/en\/hotel\/le-meurice$/);
  });
});
