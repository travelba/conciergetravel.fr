import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Voix Concierge — ADR-0011 / Phase 7 (`p7-qa-ci`).
 *
 * Guards the contract that the synthetic hotel detail surfaces the
 * `<ConciergeAdvice>` block introduced by Phase 1 of the restructuring,
 * and that its copy is accessible (axe scan scoped to the section).
 *
 * The synthetic hotel ships an FR + EN advice from `dev-fake-hotel-detail.ts`
 * and the assertions stay anchored on stable substrings ("Mon conseil",
 * "My tip") rather than the full body so editorial copy can evolve.
 *
 * Skill: editorial-long-read-rendering, geo-llm-optimization,
 * test-strategy §E2E.
 */

const FR_PATH = '/hotel/hotel-de-test-e2e';
const EN_PATH = '/en/hotel/hotel-de-test-e2e-en';

test.describe('Voix Concierge — fiche hôtel', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR — bloc ConciergeAdvice visible avec eyebrow, titre et corps', async ({ page }) => {
    const res = await page.goto(FR_PATH);
    expect(res?.status()).toBe(200);

    const section = page.locator('#concierge-advice');
    await expect(section).toBeVisible();
    await expect(section.getByText(/le conseil du concierge/i)).toBeVisible();
    await expect(section.getByRole('heading', { level: 2, name: /chambre 305/i })).toBeVisible();
    await expect(section).toContainText(/Mon conseil/iu);
    await expect(section).toContainText(/305/);
  });

  test('EN — ConciergeAdvice block surfaces the English advice', async ({ page }) => {
    const res = await page.goto(EN_PATH);
    expect(res?.status()).toBe(200);

    const section = page.locator('#concierge-advice');
    await expect(section).toBeVisible();
    await expect(section.getByText(/concierge'?s tip/i)).toBeVisible();
    await expect(section.getByRole('heading', { level: 2, name: /room 305/i })).toBeVisible();
    await expect(section).toContainText(/My tip/iu);
  });

  test('FR — axe scan sur le bloc ConciergeAdvice ne remonte aucune violation A/AA', async ({
    page,
  }) => {
    await page.goto(FR_PATH);
    await page.locator('#concierge-advice').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#concierge-advice')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('FR — le bloc est positionné AVANT la FAQ (contrat ADR-0011 §position)', async ({
    page,
  }) => {
    await page.goto(FR_PATH);
    const advice = page.locator('#concierge-advice');
    const faqHeading = page.getByRole('heading', { level: 2, name: /questions fréquentes/i });
    await expect(advice).toBeVisible();
    await expect(faqHeading).toBeVisible();
    const [adviceTop, faqTop] = await Promise.all([
      advice.evaluate((el) => el.getBoundingClientRect().top),
      faqHeading.evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(adviceTop).toBeLessThan(faqTop);
  });
});
