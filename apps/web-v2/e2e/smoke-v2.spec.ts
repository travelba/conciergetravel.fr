import { expect, test } from '@playwright/test';

/**
 * Smoke: home → recherche → hotel detail on web-v2 demo data.
 */
test.describe('smoke v2 / booking journey', () => {
  test('home → search → hotel detail renders', async ({ page }) => {
    const home = await page.goto('/');
    expect(home?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.locator('a[href="/recherche"]').first().click();
    await expect(page).toHaveURL(/\/recherche/);
    await expect(page.getByRole('heading', { level: 1, name: /résultats/i })).toBeVisible();

    const hotelLink = page.getByRole('link', { name: /le meurice/i }).first();
    await expect(hotelLink).toBeVisible();
    await hotelLink.click();
    await expect(page).toHaveURL(/\/hotel\/le-meurice/);
    await expect(page.getByRole('heading', { level: 1, name: /le meurice/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /conseil du concierge/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /questions fréquentes/i })).toBeVisible();
  });

  test('account hub exposes tile links', async ({ page }) => {
    const response = await page.goto('/compte');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('link', { name: /mes séjours/i })).toHaveAttribute(
      'href',
      /\/compte\/voyages/,
    );
    await expect(page.getByRole('link', { name: /favoris/i })).toHaveAttribute(
      'href',
      /\/compte\/favoris/,
    );
  });
});
