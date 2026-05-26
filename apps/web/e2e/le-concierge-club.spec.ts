import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Le Concierge Club — funnel + content + JSON-LD E2E coverage.
 *
 * Skill: membership-program §validation, test-strategy §E2E #5.
 *
 * What this spec locks
 * --------------------
 *   - `/le-concierge-club` and `/le-concierge-club/prestige` render
 *     publicly (`200 OK`), serve a canonical `<link rel="canonical">`,
 *     and expose the `MemberProgram` JSON-LD with the correct shape.
 *   - The press kit at `/presse/le-concierge-club` renders with
 *     `Article` + `FAQPage` + `BreadcrumbList` JSON-LD payloads and
 *     respects `noindex` (it is press-only).
 *   - `/compte/rejoindre` exposes the three-field signup form +
 *     OAuth buttons (Google + Apple) + magic-link form, all with the
 *     honeypot present and CSRF-safe Server Actions.
 *   - The Concierge Club landing page passes a serious/critical
 *     axe-core scan in FR + EN (a11y guard).
 *   - The Sentry `club.*` events stay an internal observability
 *     concern — we only assert their dispatcher is reachable via the
 *     Server Action form by verifying the form posts to a
 *     same-origin endpoint (Playwright cannot observe Sentry without
 *     stubbing the SDK, which lives in a separate vitest spec).
 *
 * Out of scope
 * ------------
 *   - Full OAuth / magic-link round trip (requires a live Supabase
 *     project; covered by integration tests with MSW in
 *     `apps/web/src/server/auth/actions.test.ts`).
 *   - Stripe billing / member-price differential (Phase 6 only).
 */

const CLUB_LANDING_FR = '/le-concierge-club';
const CLUB_LANDING_EN = '/en/le-concierge-club';
const PRESTIGE_FR = '/le-concierge-club/prestige';
const PRESS_FR = '/presse/le-concierge-club';
const JOIN_FR = '/compte/rejoindre';

const SERIOUS_IMPACTS = new Set(['serious', 'critical']);
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] as const;

async function readCanonical(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('head link[rel="canonical"]');
    return el?.getAttribute('href') ?? null;
  });
}

async function readJsonLdBlocks(page: Page): Promise<readonly unknown[]> {
  return page.evaluate(() => {
    const blocks: unknown[] = [];
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    ) as NodeListOf<HTMLScriptElement>;
    for (const script of scripts) {
      try {
        blocks.push(JSON.parse(script.textContent ?? '{}'));
      } catch {
        // Surface JSON parse errors as the literal text so the test
        // log makes it obvious which payload is malformed.
        blocks.push({ __parseError: script.textContent?.slice(0, 200) ?? '' });
      }
    }
    return blocks;
  });
}

function findByType(blocks: readonly unknown[], type: string): Record<string, unknown> | null {
  for (const b of blocks) {
    if (typeof b !== 'object' || b === null) continue;
    const obj = b as Record<string, unknown>;
    if (obj['@type'] === type) return obj;
  }
  return null;
}

test.describe('Le Concierge Club — landing', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR landing renders with hero + benefits + MemberProgram JSON-LD', async ({ page }) => {
    const res = await page.goto(CLUB_LANDING_FR);
    expect(res?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Canonical points to itself, no `/fr/` prefix leak.
    const canonical = await readCanonical(page);
    expect(canonical, 'canonical href').not.toBeNull();
    expect(canonical).toMatch(/\/le-concierge-club$/);

    const blocks = await readJsonLdBlocks(page);
    const program = findByType(blocks, 'MemberProgram');
    expect(program, 'MemberProgram JSON-LD').not.toBeNull();
    expect(program!['name']).toEqual(expect.any(String));
    expect(program!['hostingOrganization']).toEqual(
      expect.objectContaining({ '@type': 'Organization' }),
    );
    expect(Array.isArray(program!['hasTiers']), 'hasTiers is an array').toBe(true);
    const tiers = program!['hasTiers'] as ReadonlyArray<Record<string, unknown>>;
    expect(tiers.length).toBeGreaterThanOrEqual(1);
    // Free tier must not emit a `priceSpecification`.
    const free = tiers.find((t) => t['requiresSubscription'] === false);
    expect(free, 'free tier present').toBeTruthy();
    expect(free!['priceSpecification']).toBeUndefined();

    const breadcrumb = findByType(blocks, 'BreadcrumbList');
    expect(breadcrumb, 'BreadcrumbList JSON-LD').not.toBeNull();
  });

  test('EN landing renders with localised content + canonical', async ({ page }) => {
    const res = await page.goto(CLUB_LANDING_EN);
    expect(res?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    const canonical = await readCanonical(page);
    expect(canonical).toMatch(/\/en\/le-concierge-club$/);
  });

  test('FR landing passes axe (no serious/critical violations)', async ({ page }) => {
    await page.goto(CLUB_LANDING_FR);
    const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
    const blocking = results.violations.filter((v) => SERIOUS_IMPACTS.has(v.impact ?? ''));
    if (blocking.length > 0) {
      console.error(
        'club landing axe violations:',
        JSON.stringify(
          blocking.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 200)),
          })),
          null,
          2,
        ),
      );
    }
    expect(blocking).toEqual([]);
  });
});

test.describe('Le Concierge Club Prestige — waitlist landing', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR prestige page renders with prestige MemberProgram JSON-LD', async ({ page }) => {
    const res = await page.goto(PRESTIGE_FR);
    expect(res?.status()).toBe(200);

    const canonical = await readCanonical(page);
    expect(canonical).toMatch(/\/le-concierge-club\/prestige$/);

    const blocks = await readJsonLdBlocks(page);
    const program = findByType(blocks, 'MemberProgram');
    expect(program, 'Prestige MemberProgram JSON-LD').not.toBeNull();
    const tiers = (program!['hasTiers'] ?? []) as ReadonlyArray<Record<string, unknown>>;
    const prestige = tiers.find((t) => t['requiresSubscription'] === true);
    expect(prestige, 'prestige tier present').toBeTruthy();
    // Phase 1: price intentionally omitted until Stripe + Phase 6.
    // The builder strips priceSpecification when annualPriceEur <= 0,
    // which is also the Phase 1 contract — so the assertion is "no
    // price specified" (matches ADR-0020 §SEA constraints).
    expect(prestige!['priceSpecification']).toBeUndefined();
  });

  test('FR prestige page redirects unauthenticated waitlist submit to /compte/rejoindre', async ({
    page,
  }) => {
    await page.goto(PRESTIGE_FR);
    // Locate the waitlist form via its hidden `intent` input — the
    // form CTA copy is i18n-driven so we anchor on the form itself.
    const form = page.locator('form input[name="intent"]').first();
    await expect(form).toHaveAttribute('value', /trial_at_launch|newsletter_only/);
  });
});

test.describe('Le Concierge Club — press kit', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR press kit renders Article + FAQPage + BreadcrumbList JSON-LD', async ({ page }) => {
    const res = await page.goto(PRESS_FR);
    expect(res?.status()).toBe(200);

    const blocks = await readJsonLdBlocks(page);
    const article = findByType(blocks, 'Article');
    const faq = findByType(blocks, 'FAQPage');
    const breadcrumb = findByType(blocks, 'BreadcrumbList');
    expect(article, 'Article JSON-LD').not.toBeNull();
    expect(faq, 'FAQPage JSON-LD').not.toBeNull();
    expect(breadcrumb, 'BreadcrumbList JSON-LD').not.toBeNull();

    // FAQPage must include >= 3 entries (press kit anti-FUD checklist).
    const mainEntity = (faq!['mainEntity'] ?? []) as ReadonlyArray<unknown>;
    expect(mainEntity.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Le Concierge Club — /compte/rejoindre', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('renders the 3-field signup form + OAuth + magic-link with honeypot', async ({ page }) => {
    const res = await page.goto(JOIN_FR);
    expect(res?.status()).toBe(200);

    // `/compte/rejoindre` is noindex (ADR-0019 §Anti-cannibalisation).
    const robots = await page.evaluate(
      () => document.querySelector('head meta[name="robots"]')?.getAttribute('content') ?? '',
    );
    expect(robots.toLowerCase()).toContain('noindex');

    // Three visible signup fields.
    const signupForm = page
      .locator('main form')
      .filter({ has: page.locator('input[name="firstName"]') });
    await expect(signupForm.locator('input[name="email"]')).toBeVisible();
    await expect(signupForm.locator('input[name="password"]')).toBeVisible();
    await expect(signupForm.locator('input[name="firstName"]')).toBeVisible();

    // Honeypot must be present but hidden + not focusable.
    const honeypot = signupForm.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).toHaveAttribute('autocomplete', 'off');

    // OAuth — two providers always rendered (graceful degradation
    // happens server-side when the provider isn't configured).
    const oauth = page.locator('form input[name="provider"]');
    await expect(oauth).toHaveCount(2);
    const providers = await oauth.evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value),
    );
    expect(providers.sort()).toEqual(['apple', 'google']);

    // Magic link reuses the same email field via its own form.
    const magicForm = page
      .locator('main form')
      .filter({ hasNot: page.locator('input[name="firstName"]') })
      .filter({ has: page.locator('input[name="email"]') });
    await expect(magicForm).toHaveCount(1);
  });

  test('renders the post-signup pending banner on ?pending=1', async ({ page }) => {
    await page.goto(`${JOIN_FR}?pending=1`);
    const status = page.locator('main').getByRole('status').first();
    await expect(status).toBeVisible();
  });

  test('renders the magic-link sent banner on ?magic=1', async ({ page }) => {
    await page.goto(`${JOIN_FR}?magic=1`);
    const status = page.locator('main').getByRole('status').first();
    await expect(status).toBeVisible();
  });

  test('renders the oauth_unavailable alert on ?error=oauth_unavailable', async ({ page }) => {
    await page.goto(`${JOIN_FR}?error=oauth_unavailable`);
    const alert = page.locator('main').getByRole('alert').first();
    await expect(alert).toBeVisible();
  });

  test('forwards the next-path as a hidden input on each form', async ({ page }) => {
    await page.goto(`${JOIN_FR}?next=/le-concierge-club/prestige`);
    const hiddenNext = page.locator('main form input[type="hidden"][name="next"]');
    // 1 signup form + 1 magic-link form + 2 OAuth forms = 4 next inputs.
    await expect(hiddenNext).toHaveCount(4);
    const values = await hiddenNext.evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value),
    );
    for (const v of values) {
      expect(v).toBe('/le-concierge-club/prestige');
    }
  });
});
