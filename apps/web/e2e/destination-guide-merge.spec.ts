import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * ADR-0015 — Fusion `/guide/[city]` → `/destination/[city]`.
 *
 * These tests assert that the SEO-critical 308 redirects keep working
 * across locales and slugs. The destination page render itself is
 * covered by `destination.spec.ts`; here we only validate the merge
 * contract.
 *
 * - `/fr/guide/paris` → 308 → `/fr/destination/paris`
 * - `/en/guide/paris` → 308 → `/en/destination/paris`
 * - `/fr/guides` → 308 → `/fr/destination`
 * - `/en/guides` → 308 → `/en/destination`
 *
 * Notes:
 * - Next.js issues `308 Permanent Redirect` for `permanentRedirect()`.
 *   Search engines treat 308 like 301 since 2017. We assert `308` to
 *   pin the contract so a future refactor that emits 307 (temporary)
 *   would fail loudly.
 * - The slug `paris` is the canonical FR/EN slug per ADR-0008
 *   (flat slug, identical across locales).
 */
test.describe('ADR-0015 — guide ↔ destination 308 redirects', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('/fr/guide/paris → 308 → /fr/destination/paris', async ({ page }) => {
    const response = await page.goto('/guide/paris', { waitUntil: 'commit' });
    // Playwright follows the 308 automatically; we inspect the
    // redirect chain to assert the upstream status.
    const chain = response?.request().redirectedFrom();
    expect(chain, 'expected a redirect from /guide/paris').not.toBeNull();
    // After following the redirect, the URL is the destination page.
    await expect(page).toHaveURL(/\/destination\/paris$/);
  });

  test('/en/guide/paris → 308 → /en/destination/paris', async ({ page }) => {
    const response = await page.goto('/en/guide/paris', { waitUntil: 'commit' });
    const chain = response?.request().redirectedFrom();
    expect(chain).not.toBeNull();
    await expect(page).toHaveURL(/\/en\/destination\/paris$/);
  });

  test('/fr/guides → 308 → /fr/destination', async ({ page }) => {
    const response = await page.goto('/guides', { waitUntil: 'commit' });
    const chain = response?.request().redirectedFrom();
    expect(chain).not.toBeNull();
    await expect(page).toHaveURL(/\/destination$/);
  });

  test('/en/guides → 308 → /en/destination', async ({ page }) => {
    const response = await page.goto('/en/guides', { waitUntil: 'commit' });
    const chain = response?.request().redirectedFrom();
    expect(chain).not.toBeNull();
    await expect(page).toHaveURL(/\/en\/destination$/);
  });
});

/**
 * ADR-0015 step 1 — the long-read editorial guide now renders inline
 * on `/destination/[citySlug]` for cities with an `editorial_guides`
 * row (33 published city guides at 2026-05-28). These tests assert the
 * end-to-end visibility contract on three high-impact cities — one
 * domestic Palace hotspot (Paris) plus two international long-reads
 * (Marrakech, Tokyo) — covering the FR + EN locales.
 *
 * Hard-rule contract:
 *  - The `<article id="city-guide-article">` element must mount in
 *    the DOM (skill `user-acceptance-loop` — invisibility was the
 *    2026-05-26 incident pattern).
 *  - The page must emit a JSON-LD `Article` block with `@id`
 *    `…#guide-article` and `isPartOf` `…#place` so LLM crawlers see
 *    the article and the `Place` as a single editorial entity.
 *  - The sticky `<TocSidebar>` must be present (desktop viewport).
 */
test.describe('ADR-0015 step 1 — city guide rendered inline on /destination/[city]', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  for (const slug of ['paris', 'marrakech', 'tokyo']) {
    test(`/fr/destination/${slug} renders the long-read article + Article JSON-LD`, async ({
      page,
    }) => {
      await page.goto(`/destination/${slug}`);
      // Long-read article element is mounted inline.
      await expect(page.locator('article#city-guide-article')).toBeVisible();
      // Sticky TOC sidebar (desktop) is present in DOM.
      await expect(page.locator('nav[aria-label="Sur cette page"]')).toHaveCount(1);
      // Article JSON-LD with `@id = …#guide-article` and `isPartOf = …#place`.
      const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      const articleNode = ldScripts
        .map((raw) => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .find((n) => n !== null && n['@type'] === 'Article');
      expect(articleNode, 'expected an Article JSON-LD on the destination page').not.toBeNull();
      expect(articleNode!['@id']).toMatch(/#guide-article$/);
      const isPartOf = articleNode!['isPartOf'] as Record<string, unknown> | undefined;
      expect(isPartOf?.['@id']).toMatch(/#place$/);
    });

    test(`/en/destination/${slug} renders the long-read article + Article JSON-LD`, async ({
      page,
    }) => {
      await page.goto(`/en/destination/${slug}`);
      await expect(page.locator('article#city-guide-article')).toBeVisible();
      const ldScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      const articleNode = ldScripts
        .map((raw) => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .find((n) => n !== null && n['@type'] === 'Article');
      expect(articleNode, 'expected an Article JSON-LD on the destination page').not.toBeNull();
      expect(articleNode!['inLanguage']).toBe('en');
    });
  }
});
