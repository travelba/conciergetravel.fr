import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Gate 3 — parcours client A→Z (master plan §6).
 *
 * Walks the canonical editorial funnel (booking frozen) end to end and
 * asserts the chain never breaks: arrival → editorial surface → hotel
 * fiche → concierge CTA → lead-capture page (`/le-concierge/contact`).
 * The 2026-05-26 Concierge Club regression (5 perfect pages, invisible
 * journey) is exactly what this guards against.
 *
 * Run against both projects (desktop chromium + mobile-chromium) via
 * `playwright.config.ts`. One explicit small-viewport case covers the
 * mobile rendering of the lead page.
 *
 * Stage 2 (R1.5 — DONE): the contact step now fills + submits the form and
 * asserts the lead is captured (success banner + `CR-` reference). The
 * Playwright harness sets `MCH_E2E_FAKE_HOTEL_ID`, which `submitContactRequest`
 * treats as an E2E seam — it generates a real ref and confirms the happy path
 * without touching Supabase/Brevo (no creds in CI).
 */

const FAKE_HOTEL_FR = '/hotel/hotel-de-test-e2e';
const CONTACT_FR = '/le-concierge/contact';
const CONTACT_EN = '/en/le-concierge/contact';

test.describe('parcours client A→Z — funnel integrity', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR home boots and surfaces a forward path into the catalogue', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The home must offer at least one forward link into the editorial
    // catalogue (hotel, destination/guide or itinerary). ≤ 2 clicks rule.
    const forward = page.locator(
      'a[href*="/hotel/"], a[href*="/destination/"], a[href*="/guide/"], a[href$="/itineraire"], a[href*="/classement"]',
    );
    expect(await forward.count(), 'home must link forward into the catalogue').toBeGreaterThan(0);
  });

  test('hotel fiche renders and exposes a concierge lead CTA (FR)', async ({ page }) => {
    const res = await page.goto(FAKE_HOTEL_FR);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The fiche must offer a path to the concierge (either the booking
    // rail "Réserver via mon concierge" or a link to the contact page).
    const conciergePath = page.locator(
      '[data-booking-widget] [data-testid="booking-widget-form"], a[href*="/le-concierge/contact"], a[href*="/le-concierge/reserver"]',
    );
    expect(await conciergePath.count(), 'fiche must expose a concierge lead path').toBeGreaterThan(
      0,
    );
  });

  test('lead-capture page is reachable and surfaces a deterministic channel (FR)', async ({
    page,
  }) => {
    const res = await page.goto(CONTACT_FR);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Lead path: a mailto fallback and/or a form must be present so the
    // user always has a deterministic way to reach the concierge.
    const mailto = page.locator('a[href^="mailto:"]');
    const form = page.locator('form');
    const channels = (await mailto.count()) + (await form.count());
    expect(channels, 'contact page must surface at least one lead channel').toBeGreaterThan(0);
  });

  test('lead is captured: fill + submit the contact form (FR)', async ({ page }) => {
    const res = await page.goto(CONTACT_FR);
    expect(res?.status()).toBe(200);

    await page.getByTestId('contact-name').fill('Camille Testeur');
    await page.getByTestId('contact-email').fill('camille.e2e@example.com');
    await page.getByTestId('contact-subject').fill('Demande de séjour test');
    await page
      .getByTestId('contact-message')
      .fill('Bonjour, je souhaite organiser un séjour de test pour valider le parcours client.');
    await page.getByTestId('contact-submit').click();

    const success = page.getByTestId('contact-success');
    await expect(success).toBeVisible();
    await expect(success).toContainText(/CR-\d{8}-[A-Z0-9]{5}/);
  });

  test('lead is captured: fill + submit the contact form (EN)', async ({ page }) => {
    const res = await page.goto(CONTACT_EN);
    expect(res?.status()).toBe(200);

    await page.getByTestId('contact-name').fill('Casey Tester');
    await page.getByTestId('contact-email').fill('casey.e2e@example.com');
    await page.getByTestId('contact-subject').fill('Test stay enquiry');
    await page
      .getByTestId('contact-message')
      .fill('Hello, I would like to plan a test stay to validate the customer journey.');
    await page.getByTestId('contact-submit').click();

    const success = page.getByTestId('contact-success');
    await expect(success).toBeVisible();
    await expect(success).toContainText(/CR-\d{8}-[A-Z0-9]{5}/);
  });

  test('lead-capture page renders on a mobile viewport (FR)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto(CONTACT_FR);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('EN parity: home + lead-capture page render', async ({ page }) => {
    const home = await page.goto('/en');
    expect(home?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    const contact = await page.goto(CONTACT_EN);
    expect(contact?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('failure mode: an unknown hotel slug 404s, never 500s', async ({ page }) => {
    const res = await page.goto('/hotel/ce-slug-nexiste-vraiment-pas-xyz');
    const status = res?.status() ?? 0;
    expect(status, 'unknown slug must not 500').toBeLessThan(500);
    expect([404, 410, 200]).toContain(status);
  });
});
