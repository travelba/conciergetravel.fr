import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * ADR-0022 — `/destination/[citySlug]` international unblock.
 *
 * Until 2026-05-28 the `/destination/[city]` route hard-filtered
 * `country_code === 'FR'`, returning 404 for every international slug
 * (Marrakech, NYC, Tokyo, Bali, Mykonos, …) regardless of the
 * underlying catalogue state. This spec pins the new contract :
 *
 * - The route renders 200 OK for an international slug that has at
 *   least one published hotel (`marrakech`).
 * - The page emits a JSON-LD `Place` whose `address.addressCountry`
 *   reflects the real ISO-2 (`MA` for Marrakech), not the previous
 *   hard-coded `'FR'`.
 * - On-menu international slugs that don't (yet) have a published
 *   hotel render the noindex empty-state instead of 404 — same
 *   policy as FR menu slugs (skill `seo-technical` §Indexability).
 *
 * Slug source — these are the literal `citySlug(city)` outputs from
 * `public.hotels` (so `marrakech`, not `marrakech-morocco`). See
 * `apps/web/src/components/layout/nav-data.ts`
 * `TOP_INTL_DESTINATION_NAV_ENTRIES`.
 */
test.describe('ADR-0022 — destination international rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('/fr/destination/marrakech renders 200 with international JSON-LD', async ({ page }) => {
    const response = await page.goto('/destination/marrakech', { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'route must render 200, not 404').toBe(200);

    // H1 title contains the city
    await expect(page.locator('h1')).toContainText(/Marrakech/i);

    // JSON-LD `Place.address.addressCountry === 'MA'` — pinned by
    // ADR-0022. We grep the rendered HTML rather than parsing each
    // script tag (multiple JSON-LD blocks per page).
    const html = await page.content();
    expect(html).toContain('"addressCountry":"MA"');
    // Must not silently fall back to FR — that was the pre-ADR bug.
    expect(html.match(/"addressCountry":"FR"/g)?.length ?? 0).toBe(0);
  });

  test('/en/destination/marrakech mirrors the FR rendering with English copy', async ({ page }) => {
    const response = await page.goto('/en/destination/marrakech', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(/Marrakech/i);
    const html = await page.content();
    expect(html).toContain('"addressCountry":"MA"');
  });

  test('/fr/destination/<unknown-intl-slug> still 404s (preserves crawl budget)', async ({
    page,
  }) => {
    const response = await page.goto('/destination/bogota-typo-slug-2026', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(404);
  });
});
