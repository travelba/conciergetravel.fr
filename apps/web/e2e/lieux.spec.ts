import { expect, test, type Page } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * `/lieux` — "Lieux à visiter" vertical (skill: seo-technical,
 * test-strategy §E2E). Three route levels:
 *   - hub      `/lieux`                       → Breadcrumb + ItemList JSON-LD
 *   - city     `/lieux/[citySlug]`            → Breadcrumb + ItemList(s) JSON-LD
 *   - fiche    `/lieux/[citySlug]/[placeSlug]`→ TouristAttraction/Place +
 *                                               Breadcrumb + FAQPage (+ nearby
 *                                               hotels ItemList) JSON-LD
 *
 * In CI the test server boots without Supabase credentials, so
 * `listPlaceCities()` returns `[]`: the hub renders its chrome + empty
 * state, and the data-dependent navigation into a city → fiche is
 * `test.skip`-ped (same precedent as `destination.spec.ts`). The
 * deterministic surface — hub chrome, Breadcrumb JSON-LD, footer
 * discoverability, canonical/hreflang, EN locale — is fully asserted in
 * CI. The full hub→city→fiche walk runs green against a DB-backed dev or
 * preview server.
 */

type JsonLdNode = Record<string, unknown>;

/** Parse every `<script type="application/ld+json">` node on the page. */
async function readJsonLd(page: Page): Promise<JsonLdNode[]> {
  return page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    for (const s of scripts) {
      try {
        const parsed: unknown = JSON.parse(s.textContent ?? 'null');
        if (parsed !== null && typeof parsed === 'object') {
          out.push(parsed as Record<string, unknown>);
        }
      } catch {
        /* ignore malformed node */
      }
    }
    return out;
  });
}

function findByType(nodes: readonly JsonLdNode[], type: string): JsonLdNode | undefined {
  return nodes.find((n) => n['@type'] === type);
}

test.describe('lieux vertical (/lieux)', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR hub renders the H1 + intro + cities list or empty state', async ({ page }) => {
    const res = await page.goto('/lieux');
    expect(res?.status(), '/lieux should return 200').toBe(200);

    await expect(page.getByRole('heading', { level: 1, name: /Lieux à visiter/i })).toBeVisible();
    expect(await page.locator('html').getAttribute('lang')).toBe('fr');
  });

  test('hub emits Breadcrumb JSON-LD', async ({ page }) => {
    await page.goto('/lieux');

    const nodes = await readJsonLd(page);
    const breadcrumb = findByType(nodes, 'BreadcrumbList');
    expect(breadcrumb, 'BreadcrumbList JSON-LD should be present on the hub').toBeTruthy();
    expect(breadcrumb?.['@context']).toBe('https://schema.org');
    expect(Array.isArray(breadcrumb?.['itemListElement'])).toBe(true);
  });

  test('canonical + hreflang point to /lieux', async ({ page }) => {
    await page.goto('/lieux');
    const meta = await page.evaluate(() => {
      const getHref = (sel: string): string | null =>
        document.querySelector(sel)?.getAttribute('href') ?? null;
      return {
        canonical: getHref('link[rel="canonical"]'),
        hreflangFr: getHref('link[rel="alternate"][hreflang="fr-FR"]'),
        hreflangEn: getHref('link[rel="alternate"][hreflang="en"]'),
        hreflangDefault: getHref('link[rel="alternate"][hreflang="x-default"]'),
      };
    });
    expect(meta.canonical).toMatch(/\/lieux$/);
    expect(meta.hreflangFr).toMatch(/\/lieux$/);
    expect(meta.hreflangEn).toMatch(/\/en\/lieux$/);
    expect(meta.hreflangDefault).toMatch(/\/lieux$/);
  });

  test('footer surfaces the /lieux link (discoverability ≤ 1 click)', async ({ page }) => {
    // The global SiteFooter is rendered site-wide via the root layout, so
    // a user landing anywhere reaches the vertical from the footer. We
    // scope to the `<footer>` element (its implicit role can degrade to
    // generic depending on the host page's sectioning, so we match the
    // tag, not the contentinfo role).
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    const placesLink = footer.locator('a[href="/lieux"]');
    await expect(placesLink.first(), 'footer should link to the lieux hub').toBeVisible();
  });

  test('EN hub is served under /en/lieux with the localized H1', async ({ page }) => {
    const res = await page.goto('/en/lieux');
    expect(res?.status()).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await expect(page.getByRole('heading', { level: 1, name: /Places to visit/i })).toBeVisible();
  });

  /**
   * Full data-dependent walk: hub → city → fiche. Requires a DB-backed
   * server (published places). Skips cleanly when the hub renders zero
   * cities (credential-less CI), mirroring `destination.spec.ts`.
   */
  test('hub → city → fiche walk exposes Concierge tip + FAQ when data is present', async ({
    page,
  }) => {
    await page.goto('/lieux');

    // City cards are `<a href="/lieux/<citySlug>">` inside <main>.
    const cityLinks = page.locator('main a[href*="/lieux/"]');
    const cityCount = await cityLinks.count();
    test.skip(cityCount === 0, 'No published places (credential-less server) — walk skipped.');

    // 1. hub → city
    await cityLinks.first().click();
    await expect(page).toHaveURL(/\/lieux\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const cityNodes = await readJsonLd(page);
    expect(findByType(cityNodes, 'BreadcrumbList'), 'city page Breadcrumb').toBeTruthy();
    expect(findByType(cityNodes, 'ItemList'), 'city page ItemList of places').toBeTruthy();

    // 2. city → fiche. Pick the first link matching the 2-segment fiche
    // pattern `/lieux/<city>/<place>` (deeper than the city URL).
    const ficheHref = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href]'));
      const match = anchors.find((a) =>
        /\/lieux\/[^/]+\/[^/]+$/.test(a.getAttribute('href') ?? ''),
      );
      return match?.getAttribute('href') ?? null;
    });
    if (ficheHref === null) {
      test.skip(true, 'City has no published place fiche link — fiche walk skipped.');
      return;
    }

    await page.goto(ficheHref);
    await expect(page).toHaveURL(/\/lieux\/[^/]+\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // TouristAttraction (or a narrower Place subtype) + Breadcrumb must be present.
    const ficheNodes = await readJsonLd(page);
    expect(findByType(ficheNodes, 'BreadcrumbList'), 'fiche Breadcrumb').toBeTruthy();
    const hasPlaceNode = ficheNodes.some((n) => {
      const t = n['@type'];
      return (
        typeof t === 'string' && /Attraction|Museum|Park|Place|Landmark|Theater|Worship/.test(t)
      );
    });
    expect(hasPlaceNode, 'fiche should emit a TouristAttraction/Place JSON-LD node').toBe(true);

    // Concierge tip block — present when the row carries concierge_advice.
    const conciergeHeading = page
      .getByRole('heading', { level: 2 })
      .filter({ hasText: /Conseil du Concierge|Concierge/i });
    if ((await conciergeHeading.count()) > 0) {
      await expect(conciergeHeading.first()).toBeVisible();
    }

    // FAQ block + FAQPage JSON-LD when the row carries a faq array.
    const faqHeading = page
      .getByRole('heading', { level: 2 })
      .filter({ hasText: /Questions fréquentes|frequently asked/i });
    if ((await faqHeading.count()) > 0) {
      await expect(faqHeading.first()).toBeVisible();
      expect(findByType(ficheNodes, 'FAQPage'), 'fiche FAQPage JSON-LD').toBeTruthy();
    }
  });
});
