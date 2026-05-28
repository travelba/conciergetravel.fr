import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Homepage redesign — selective rebuild (plan `home_rebrand_inspiré_4_sites`).
 *
 * Asserts the 10-section structure ships and that the new contracts hold:
 *   §1  Hero      — Booking-style search preview: destination active,
 *                    dates + guests `aria-disabled="true"` with no `name`
 *                    so only `destination` reaches `/recherche`.
 *   §2  Editor letter — visible eyebrow + link to the editorial method.
 *   §3  Openings grid — "Le Concierge a frappé à leur porte" (≤ 4 cards
 *                    + CTA "Voir toutes les ouvertures →" pointing to
 *                    `/ouvertures` — the dedicated openings hub). At
 *                    least one card carries a tier badge (Palace, R&C,
 *                    boutique, château, or stars). The legacy "Les fiches
 *                    du moment" `HomeHotelGrid` was retired 2026-05-26.
 *   §4  Concierge advice carousel — either ≥ 1 advice card or the sober
 *                    fallback message (never a 500).
 *   §8  AEO FAQ   — 4 `<details>` items, first one open, all 4 questions
 *                    in the DOM at load (LLM crawler contract).
 *   §9  Club ribbon — single "Discover Le Concierge Club" CTA.
 *
 * Coverage: FR (`/`) + EN (`/en`). Hero rebrand assertions live in
 * `homepage-hero.spec.ts` — this spec focuses on the redesign deltas.
 */
test.describe('homepage redesign — 10 sections', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR — hero search posts only `destination`, dates + guests are aria-disabled', async ({
    page,
  }) => {
    await page.goto('/');

    const destination = page.locator('#home-hero-search-destination');
    await expect(destination).toBeVisible();
    await expect(destination).toHaveAttribute('name', 'destination');

    const dates = page.locator('#home-hero-search-dates');
    await expect(dates).toBeAttached();
    await expect(dates).toHaveAttribute('aria-disabled', 'true');
    expect(await dates.getAttribute('name')).toBeNull();

    const guests = page.locator('#home-hero-search-guests');
    await expect(guests).toBeAttached();
    await expect(guests).toHaveAttribute('aria-disabled', 'true');
    expect(await guests.getAttribute('name')).toBeNull();

    // The disabled fields must NOT carry any explanatory tooltip — we
    // do not communicate on Phase 1 limitations.
    expect(await dates.getAttribute('title')).toBeNull();
    expect(await guests.getAttribute('title')).toBeNull();

    // Posting the form should route to /recherche?destination=<value>
    // (only the destination param). Use Playwright's request interception
    // to capture the navigation target without actually loading the page.
    await destination.fill('Paris');
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/recherche')),
      destination.press('Enter'),
    ]);
    const url = new URL(request.url());
    expect(url.searchParams.get('destination')).toBe('Paris');
    expect(url.searchParams.has('checkin')).toBe(false);
    expect(url.searchParams.has('checkout')).toBe(false);
    expect(url.searchParams.has('guests')).toBe(false);
  });

  test('EN — hero search works the same with the EN-localised submit label', async ({ page }) => {
    await page.goto('/en');
    const destination = page.locator('#home-hero-search-destination');
    await expect(destination).toBeVisible();
    const submit = page.getByRole('button', { name: /search the catalogue/i });
    await expect(submit).toBeVisible();
  });

  test('FR — "Le mot du Concierge" renders with link to the editorial method', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', {
      name: /Bienvenue chez votre hôtelier de confiance/i,
    });
    await expect(heading).toBeVisible();
    const methodLink = page.getByRole('link', { name: /Notre méthode éditoriale/i });
    await expect(methodLink).toBeVisible();
    await expect(methodLink).toHaveAttribute('href', /\/le-concierge\/methode-editoriale$/u);
  });

  test('EN — editor letter signature line points to /le-concierge/editorial-method', async ({
    page,
  }) => {
    await page.goto('/en');
    const heading = page.getByRole('heading', {
      name: /Welcome from your trusted hotelier/i,
    });
    await expect(heading).toBeVisible();
    const methodLink = page.getByRole('link', { name: /Our editorial method/i });
    await expect(methodLink).toBeVisible();
    await expect(methodLink).toHaveAttribute('href', /\/le-concierge\/editorial-method$/u);
  });

  test('FR — openings grid renders + CTA points at /ouvertures', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: /Le Concierge a frappé à leur porte/i });
    await expect(heading).toBeVisible();

    // The CTA "Voir toutes les ouvertures →" must point at the
    // dedicated openings hub — discoverability blocker captured by
    // `.cursor/rules/user-acceptance-before-commit.mdc` (2026-05-26
    // reference case).
    const seeAll = page.getByRole('link', { name: /Voir toutes les ouvertures/i });
    await expect(seeAll).toBeVisible();
    await expect(seeAll).toHaveAttribute('href', /\/ouvertures$/u);

    // Tier badges are one of: Palace, Relais & Châteaux, Boutique-hôtel,
    // Château-hôtel, or a stars sequence (★★★★★). The grid degrades
    // gracefully when the catalogue has no published rows with a hero
    // image (Supabase outage etc.) — we annotate instead of failing.
    const section = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /Le Concierge a frappé/i }) });
    if ((await section.locator('li').count()) > 0) {
      const text = (await section.textContent()) ?? '';
      const hasTierBadge = /(Palace|Relais & Châteaux|Boutique-hôtel|Château-hôtel|★)/u.test(text);
      expect(hasTierBadge, 'at least one tier badge should be present').toBe(true);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'HomeOpeningsGrid empty — degraded Supabase or no published rows with hero.',
      });
    }
  });

  test('FR — /ouvertures hub surfaces the AEO + FAQ blocks and the breadcrumb', async ({
    page,
  }) => {
    await page.goto('/ouvertures');

    // Breadcrumb back to home.
    const homeCrumb = page.getByRole('link', { name: /Retour à l'accueil/i });
    await expect(homeCrumb.first()).toBeVisible();

    // AEO block — visible question heading + answer in the DOM.
    const aeoTitle = page.locator('#ouvertures-aeo-title');
    await expect(aeoTitle).toBeVisible();
    await expect(aeoTitle).toContainText(/hôtels d'exception/i);

    // FAQ block — at least 9 Q&A items (10 authored, first one open).
    const faqHeading = page.getByRole('heading', {
      name: /Questions fréquentes sur les ouvertures et visites du Concierge/i,
    });
    await expect(faqHeading).toBeVisible();
    const faqSection = page.locator('section').filter({ has: faqHeading });
    const items = faqSection.locator('details');
    expect(await items.count()).toBeGreaterThanOrEqual(9);
    await expect(items.nth(0)).toHaveAttribute('open', '');
  });

  test('FR — Concierge advice carousel renders ≥ 1 card OR the sober fallback', async ({
    page,
  }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: /Trois secrets, choisis du jour/i });
    await expect(heading).toBeVisible();
    const section = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /Trois secrets/i }) });
    const cards = section.locator('li');
    const cardCount = await cards.count();
    if (cardCount === 0) {
      // Fallback path — the empty-state copy must be present.
      await expect(section).toContainText(/Notre conciergerie compile les conseils du jour/i);
    } else {
      expect(cardCount).toBeGreaterThan(0);
    }
  });

  test('FR — AEO FAQ has 4 Q&A and the first one is open', async ({ page }) => {
    await page.goto('/');
    const aeoSection = page.locator('[data-aeo]');
    await expect(aeoSection).toBeVisible();
    const items = aeoSection.locator('details');
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveAttribute('open', '');
    // All 4 answers must be in the DOM at load (LLM crawler contract —
    // closed <details> is OK but the content must be present).
    const answersText = (await aeoSection.textContent()) ?? '';
    expect(answersText).toMatch(/Comment MyConciergeHotel sélectionne/i);
    expect(answersText).toMatch(/Booking|Hotels.com/i);
    expect(answersText).toMatch(/Conseil du Concierge/i);
    expect(answersText).toMatch(/Le Concierge Club/i);
  });

  test('FR — Le Concierge Club ribbon surfaces the canonical CTA', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /Découvrir Le Concierge Club/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /\/le-concierge-club$/u);
  });

  test('FR — homepage has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(
      critical,
      `axe critical violations: ${JSON.stringify(critical.map((v) => v.id))}`,
    ).toEqual([]);
  });
});
