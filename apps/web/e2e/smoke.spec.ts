import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Smoke: every public landing surface boots, renders the chrome
 * (skip-link / header / footer / consent), and the FR locale lives at
 * the root while EN lives under `/en` (routing.ts).
 *
 * The consent cookie is pre-set so the banner does not occlude the
 * footer/copy assertions. Banner-specific behaviour lives in
 * `consent.spec.ts`.
 */
test.describe('smoke / public landing', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR home renders header + footer + main landmark', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'home should return 200').toBe(200);

    await expect(page).toHaveTitle(/.+/);
    expect(await page.locator('html').getAttribute('lang')).toBe('fr');

    // Skip-link is the first focusable element on every page.
    await expect(page.getByRole('link', { name: 'Aller au contenu principal' })).toHaveAttribute(
      'href',
      '#main',
    );

    // Header brand + main landmark.
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Footer copyright + Manage cookies button.
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(new Date().getFullYear().toString());
    await expect(footer.getByRole('button', { name: 'Gérer les cookies' })).toBeVisible();
  });

  test('EN home is served under /en with correct lang', async ({ page }) => {
    const response = await page.goto('/en');
    expect(response?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('skip-link jumps to #main when activated', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Aller au contenu principal' });

    // Focus the skip link explicitly and press Enter to mimic a keyboard user.
    await skip.focus();
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');

    // The browser updates the URL hash; the #main element receives focus.
    await expect(page).toHaveURL(/#main$/);
    const mainFocused = await page.evaluate(
      () => document.activeElement?.id ?? document.activeElement?.tagName,
    );
    expect(mainFocused).toBe('main');
  });

  test('all four legal pages render with the expected H1', async ({ page }) => {
    const legalRoutes: ReadonlyArray<{ readonly path: string; readonly h1: RegExp }> = [
      { path: '/mentions-legales', h1: /Mentions légales/i },
      { path: '/confidentialite', h1: /Politique de confidentialité/i },
      { path: '/cgv', h1: /Conditions générales de vente/i },
      { path: '/cookies', h1: /Politique cookies/i },
    ];

    for (const { path, h1 } of legalRoutes) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should return 200`).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();

      // Legal pages MUST stay indexable (no `noindex` meta). Querying
      // `head meta[*]` via the standard locator triggers Playwright's
      // visibility auto-wait — head children are not visible — so we
      // pierce via `evaluate` instead.
      const robots = await page.evaluate(() => {
        const el = document.querySelector('head meta[name="robots"]');
        return el?.getAttribute('content') ?? null;
      });
      if (robots !== null) {
        expect(robots.toLowerCase(), `${path} robots meta`).not.toContain('noindex');
      }
    }
  });

  /**
   * ADR-0014 new landings (PR #71) — `/marques`, `/inspiration`,
   * `/itineraire`, `/le-concierge`. Each is `force-dynamic` (CSP nonce
   * for JSON-LD) and therefore invisible to `next build`. The hotfix
   * PR #72 showed the failure mode: a missing or nested i18n namespace
   * leaks the raw key shape (`<word>.<word>`) into `<title>` and
   * `<meta name="description">` and the page eventually 500s when
   * `t.raw('faq.items').map(...)` runs on a string. We pin a smoke
   * assertion per landing so the next regression bounces in CI rather
   * than in production.
   *
   * Cross-ref: `.cursor/skills/nextjs-app-router/SKILL.md`
   * §Internationalization — "Namespace nesting fails silently".
   */
  test('ADR-0014 landings return 200 + render a translated H1', async ({ page }) => {
    const landings: ReadonlyArray<{ readonly path: string; readonly h1Hint: RegExp }> = [
      { path: '/marques', h1Hint: /\w/ },
      { path: '/inspiration', h1Hint: /\w/ },
      { path: '/itineraire', h1Hint: /\w/ },
      { path: '/le-concierge', h1Hint: /\w/ },
    ];

    for (const { path, h1Hint } of landings) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should return 200`).toBe(200);

      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1, `${path} should expose an <h1>`).toBeVisible();
      await expect(h1, `${path} <h1> should not be empty`).toHaveText(h1Hint);
    }
  });

  test('/le-concierge does not leak raw i18n namespace keys (PR #72 regression)', async ({
    page,
  }) => {
    // The raw-namespace shape is `<word>.<word>` with NO whitespace
    // around the dot — distinctive enough to never collide with a
    // legitimate sentence-ending period (we tolerate "Tip. Body" but
    // not "concierge.metaTitle").
    const rawKeyPattern = /\b[a-z][a-zA-Z0-9]+\.[a-z][a-zA-Z0-9]+\b/;

    const res = await page.goto('/le-concierge');
    expect(res?.status()).toBe(200);

    const title = await page.title();
    expect(
      title,
      `<title> should be translated, not a raw next-intl key. Got: "${title}".`,
    ).not.toMatch(rawKeyPattern);

    const description = await page.evaluate(() => {
      const el = document.querySelector('head meta[name="description"]');
      return el?.getAttribute('content') ?? '';
    });
    expect(
      description,
      `<meta name="description"> should be translated. Got: "${description}".`,
    ).not.toMatch(rawKeyPattern);

    // The FAQ block iterates `t.raw('faq.items')` — if the namespace
    // resolution silently degrades to a string, the `<details>` map
    // throws and the section disappears entirely.
    await expect(
      page.getByRole('heading', { level: 2 }).filter({ hasText: /FAQ|questions/i }),
      'FAQ heading must render — confirms t.raw("faq.items") yielded an array',
    ).toBeVisible();
  });

  test('/en/le-concierge serves the English namespace', async ({ page }) => {
    const res = await page.goto('/en/le-concierge');
    expect(res?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    const title = await page.title();
    expect(title).not.toMatch(/\b[a-z][a-zA-Z0-9]+\.[a-z][a-zA-Z0-9]+\b/);
  });
});
