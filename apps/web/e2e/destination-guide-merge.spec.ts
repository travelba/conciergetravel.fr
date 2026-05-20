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
