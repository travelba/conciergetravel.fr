import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Homepage discoverability walk — ADR-0021 + user-acceptance-loop.
 *
 * The 2026-05-26 reference case (Concierge Club shipped 5 pages with
 * zero nav entries) is the worst-case scenario this spec guards against:
 * a brand-new landing exists at a URL, but no user can reach it from
 * `/` in ≤ 2 clicks. We assert the click-path explicitly for the three
 * highest-stakes deeplinks of the new home:
 *
 *   - The 20 published itineraries hub (`/itineraire`)
 *   - The editorial method page (`/le-concierge/methode-editoriale`)
 *   - The international destination guides (`/destination/[city]` via
 *     `<HomeGuidesStrip>` or `<HomeDestinationGrid>`)
 *
 * Each walk: start from `/`, click ONE link from the home (the strip's
 * CTA or any card), confirm the resulting URL + a hero element.
 */
test.describe('homepage discoverability — ≤ 2 clicks rule', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR home links to /itineraire in ≤ 1 click via the itineraries strip CTA', async ({
    page,
  }) => {
    await page.goto('/');

    // Look for a link whose href ends with `/itineraire` or `/itineraires`.
    // The strip renders 3 itinerary cards + a "Voir tous les itinéraires" CTA.
    const itineraryLinks = page.locator('a[href$="/itineraire"], a[href$="/itineraires"]');
    expect(
      await itineraryLinks.count(),
      'home must surface ≥ 1 link to the itineraries hub',
    ).toBeGreaterThan(0);

    const itineraryCta = itineraryLinks.first();
    await itineraryCta.scrollIntoViewIfNeeded();
    await itineraryCta.click();

    await expect(page).toHaveURL(/\/itineraire/);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('FR home links to /le-concierge/methode-editoriale in ≤ 1 click', async ({ page }) => {
    await page.goto('/');

    const methodLinks = page.locator('a[href$="/le-concierge/methode-editoriale"]');
    expect(
      await methodLinks.count(),
      'home must surface ≥ 1 link to the editorial method page',
    ).toBeGreaterThan(0);

    await methodLinks.first().scrollIntoViewIfNeeded();
    await methodLinks.first().click();

    await expect(page).toHaveURL(/\/le-concierge\/methode-editoriale$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('FR home guides strip surfaces at least one editorial guide link', async ({ page }) => {
    await page.goto('/');

    // The guides strip should render at least one `/destination/{slug}`
    // link. We accept either /destination or /guide (ADR-0015 merged
    // the two and a 308 redirect keeps the latter alive).
    const guideLinks = page.locator(
      'a[href^="/destination/"], a[href^="/guide/"], a[href^="/en/destination/"]',
    );
    expect(
      await guideLinks.count(),
      'home must expose at least one destination/guide card link',
    ).toBeGreaterThan(0);
  });

  test('FR home does NOT contain the "en France" boundary phrase anywhere in the main landmark', async ({
    page,
  }) => {
    await page.goto('/');
    const main = page.getByRole('main');
    const mainText = (await main.textContent()) ?? '';

    // Allow "Atout France" (legitimate label name) but reject the
    // geographic-boundary phrasing "en France" as a scope statement.
    // We use the "en France" pattern with a trailing space/period/comma
    // boundary to avoid matching "Atout France" itself.
    const violations = mainText.match(/\ben France(?=[\s,.;:]|$)/gu) ?? [];
    expect(violations, 'home main must not bound the catalogue scope to France').toHaveLength(0);
  });

  test('EN home does NOT contain "France\'s Palaces" or "in France" as a boundary phrase', async ({
    page,
  }) => {
    await page.goto('/en');
    const main = page.getByRole('main');
    const mainText = (await main.textContent()) ?? '';

    const violations = mainText.match(/\bin France(?=[\s,.;:]|$)|France'?s Palaces?/giu) ?? [];
    expect(violations, 'EN home main must not bound the catalogue scope to France').toHaveLength(0);
  });
});
