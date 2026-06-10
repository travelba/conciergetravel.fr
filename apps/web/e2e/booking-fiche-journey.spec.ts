import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';
import { E2E_FAKE_HOTEL_ID } from './fixtures/env';

/**
 * Fiche hôtel → sous-page chambre → demande concierge.
 *
 * Uses the synthetic E2E hotel (`hotel-de-test-e2e`, email-mode) served by
 * `dev-fake-hotel-detail.ts` when `MCH_E2E_FAKE_HOTEL_ID` is set.
 */

const FR_PATH = '/hotel/hotel-de-test-e2e';
const EN_PATH = '/en/hotel/hotel-de-test-e2e-en';
const ROOM_SLUG = 'chambre-deluxe-roi';

test.describe('booking — fiche hotel journey', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('fiche rail exposes a live concierge booking form (FR)', async ({ page }) => {
    const res = await page.goto(FR_PATH);
    expect(res?.status()).toBe(200);

    const railForm = page.locator(
      '[data-booking-widget="rail"] [data-testid="booking-widget-form"]',
    );
    await expect(railForm).toBeVisible();
    await expect(railForm.locator('input[name="hotelId"]')).toHaveValue(E2E_FAKE_HOTEL_ID);
    await expect(
      railForm.getByRole('button', { name: /réserver via mon concierge/i }),
    ).toBeEnabled();

    await expect(page.locator('[data-booking-placeholder]')).toHaveCount(0);
  });

  test('fiche rail exposes a live concierge booking form (EN)', async ({ page }) => {
    const res = await page.goto(EN_PATH);
    expect(res?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    const railForm = page.locator(
      '[data-booking-widget="rail"] [data-testid="booking-widget-form"]',
    );
    await expect(railForm).toBeVisible();
    await expect(railForm.getByRole('button', { name: /book via my concierge/i })).toBeEnabled();
  });

  test('room sub-page links to /reservation/start with hotelId', async ({ page }) => {
    const res = await page.goto(`${FR_PATH}/chambres/${ROOM_SLUG}`);
    expect(res?.status()).toBe(200);

    const roomForm = page.locator(
      '[data-booking-widget="room_widget"] [data-testid="booking-widget-form"]',
    );
    await expect(roomForm).toBeVisible();
    await expect(roomForm.locator('input[name="hotelId"]')).toHaveValue(E2E_FAKE_HOTEL_ID);

    await roomForm.getByRole('button', { name: /réserver via mon concierge/i }).click();
    await expect(page).toHaveURL(/\/reservation\/start/);
    await expect(page.url()).toContain(`hotelId=${E2E_FAKE_HOTEL_ID}`);
  });

  test('mobile bar sheet shows live concierge form', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto(FR_PATH);
    expect(res?.status()).toBe(200);

    const cookieAccept = page.getByRole('button', { name: /tout accepter/i });
    if (await cookieAccept.isVisible()) {
      await cookieAccept.click();
    }

    const mobileCta = page.locator('[data-booking-widget="mobile_bar"] .resa-mobile-bar__cta');
    await expect(mobileCta).toBeVisible();
    await expect(mobileCta).toHaveText(/réserver via mon concierge/i);

    await mobileCta.click();
    const sheetForm = page.locator('.resa-mobile-sheet [data-testid="booking-widget-form"]');
    await expect(sheetForm).toBeVisible();
    await expect(
      sheetForm.getByRole('button', { name: /réserver via mon concierge/i }),
    ).toBeEnabled();
  });
});
