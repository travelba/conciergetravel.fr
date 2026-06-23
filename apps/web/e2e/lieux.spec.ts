import AxeBuilder from '@axe-core/playwright';
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

/**
 * Navigate hub → city → fiche and return the first published place-fiche
 * path (`/lieux/<city>/<place>`), or `null` when no published place is
 * reachable (credential-less CI server). Shared by the deep cases below so
 * each one self-skips identically when the DB is absent.
 */
async function resolveFirstPublishedFicheHref(page: Page): Promise<string | null> {
  await page.goto('/lieux');
  const cityLinks = page.locator('main a[href*="/lieux/"]');
  if ((await cityLinks.count()) === 0) return null;
  await cityLinks.first().click();
  await expect(page).toHaveURL(/\/lieux\/[^/]+$/);
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href]'));
    const match = anchors.find((a) => /\/lieux\/[^/]+\/[^/]+$/.test(a.getAttribute('href') ?? ''));
    return match?.getAttribute('href') ?? null;
  });
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] as const;

/**
 * Deep coverage for the lieux vertical shipped this session — gallery
 * rendering, TouristAttraction `image[]` JSON-LD, the hotel ↔ lieux reverse
 * maillage, the draft-city 404, the locale-negotiation gotcha, and an axe
 * scan on the fiche.
 *
 * Determinism contract
 * --------------------
 * - The **draft-city 404** and the **locale gotcha** are DB-independent:
 *   they assert HTTP status / redirect behaviour that holds with or without
 *   Supabase credentials, so they always run.
 * - Every **data-dependent** case (gallery, JSON-LD image, maillage, a11y)
 *   walks hub → city → fiche and `test.skip`s cleanly when no published
 *   place is reachable (credential-less CI), mirroring the baseline walk in
 *   the first describe block. Against a DB-backed dev/preview server they
 *   run green. None of them assert timings/animations.
 */
test.describe('lieux vertical — deep coverage (gallery, image JSON-LD, maillage, a11y)', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('a draft / unpublished city 404s cleanly, never 500s', async ({ page }) => {
    // `tokyo` exists only as draft (unpublished) places, so the city route
    // `listPublishedPlacesForCity()` returns `[]` → `notFound()`. On a
    // credential-less server every city is empty → also 404. Deterministic
    // either way; the contract is "never a 500".
    const res = await page.goto('/lieux/tokyo');
    const status = res?.status() ?? 0;
    expect(status, '/lieux/tokyo (draft city) must not 500').toBeLessThan(500);
    expect([404, 410]).toContain(status);
  });

  test('FR canonical /lieux is served as FR without a cross-locale redirect', async ({ page }) => {
    // GOTCHA (capitalised): a headless browser defaults to
    // `Accept-Language: en`, so the un-prefixed FR route `/lieux` would
    // 307-redirect to `/en/lieux`. The Playwright config pins
    // `use.locale = 'fr-FR'` (see playwright.config.ts) so next-intl
    // negotiates FR and the canonical FR route resolves directly — no
    // `/en/` hop. This case locks that behaviour so a future config or
    // middleware change that breaks FR negotiation fails loudly here.
    const res = await page.goto('/lieux');
    expect(res?.status()).toBe(200);
    expect(page.url(), 'FR route must not bounce to the /en tree').not.toMatch(/\/en\//);
    expect(page.url()).toMatch(/\/lieux$/);
    expect(await page.locator('html').getAttribute('lang')).toBe('fr');
  });

  test('a published fiche renders the "En images" gallery with ≥ 1 image', async ({ page }) => {
    const ficheHref = await resolveFirstPublishedFicheHref(page);
    if (ficheHref === null) {
      test.skip(true, 'No published places (credential-less server) — gallery walk skipped.');
      return;
    }
    await page.goto(ficheHref);

    const gallery = page.locator('section[aria-labelledby="gallery-heading"]');
    if ((await gallery.count()) === 0) {
      // DATA: <PlaceGallery> self-elides without gallery_images or a
      // Cloudinary cloud name. Skip rather than fail when the picked fiche
      // simply has no gallery yet (Phase 2 photo pipeline is partial).
      test.skip(true, 'DATA: picked fiche has no gallery section (no gallery_images).');
      return;
    }
    await expect(gallery).toBeVisible();
    const imgs = gallery.locator('img');
    expect(await imgs.count(), 'gallery must render at least one <img>').toBeGreaterThan(0);
    // Stable assertion: the first tile carries a non-empty delivery source
    // (DOM attribute), proving the image is wired — we intentionally do NOT
    // poll naturalWidth (network-dependent on Cloudinary → flaky).
    const firstSrc = await imgs
      .first()
      .evaluate(
        (el: HTMLImageElement) => el.currentSrc || el.src || el.getAttribute('srcset') || '',
      );
    expect(firstSrc.length, 'first gallery tile must have a delivery src/srcset').toBeGreaterThan(
      0,
    );
  });

  test('a published fiche emits TouristAttraction/Place JSON-LD carrying image[]', async ({
    page,
  }) => {
    const ficheHref = await resolveFirstPublishedFicheHref(page);
    if (ficheHref === null) {
      test.skip(true, 'No published places — JSON-LD image walk skipped.');
      return;
    }
    await page.goto(ficheHref);

    const nodes = await readJsonLd(page);
    const placeNode = nodes.find((n) => {
      const t = n['@type'];
      return (
        typeof t === 'string' &&
        /Attraction|Museum|Park|Place|Landmark|Theater|Worship|Church|Garden|BodyOfWater|Bridge/.test(
          t,
        )
      );
    });
    expect(placeNode, 'fiche should emit a TouristAttraction/Place JSON-LD node').toBeTruthy();
    expect(placeNode?.['@context']).toBe('https://schema.org');

    const image = placeNode?.['image'];
    if (image === undefined) {
      // DATA: a place with neither hero nor gallery emits no `image`.
      test.skip(true, 'DATA: picked fiche has no hero/gallery image in JSON-LD.');
      return;
    }
    const imageArr = Array.isArray(image) ? image : [image];
    expect(imageArr.length, 'image[] must carry at least one entry').toBeGreaterThan(0);
    // The builder normalises rich entries (caption/width/height — always set
    // by the page) to ImageObject; bare URL strings stay compact. Accept both.
    const first = imageArr[0];
    if (typeof first === 'string') {
      expect(first.length).toBeGreaterThan(0);
    } else {
      const obj = first as Record<string, unknown>;
      expect(obj['@type']).toBe('ImageObject');
      expect(typeof obj['contentUrl'], 'ImageObject must carry a contentUrl').toBe('string');
      expect((obj['contentUrl'] as string).length).toBeGreaterThan(0);
    }
  });

  test('hotel ↔ lieux maillage: hotel fiche renders the nearby-places block or self-elides', async ({
    page,
  }) => {
    // Anchor on Paris — the data-rich city of the vertical (mirrors the
    // `tokyo` draft anchor above). On a credential-less server `/lieux/paris`
    // 404s → clean skip. We sample a handful of its fiches to find one whose
    // "Hôtels à proximité" block links to a published hotel, then walk it.
    const parisRes = await page.goto('/lieux/paris');
    if ((parisRes?.status() ?? 0) !== 200) {
      test.skip(
        true,
        'No published Paris places (credential-less server) — maillage walk skipped.',
      );
      return;
    }
    const ficheHrefs = await page.evaluate(() => {
      const seen = new Set<string>();
      for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href]'))) {
        const href = a.getAttribute('href') ?? '';
        if (/\/lieux\/[^/]+\/[^/]+$/.test(href)) seen.add(href);
      }
      return [...seen].slice(0, 6);
    });

    let hotelHref: string | null = null;
    for (const fiche of ficheHrefs) {
      await page.goto(fiche);
      hotelHref = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href]')).find(
          (x) => /\/hotel\/[^/]+$/.test(x.getAttribute('href') ?? ''),
        );
        return a?.getAttribute('href') ?? null;
      });
      if (hotelHref !== null) break;
    }
    if (hotelHref === null) {
      test.skip(true, 'DATA: no sampled Paris fiche links to a nearby published hotel.');
      return;
    }

    const res = await page.goto(hotelHref);
    expect(res?.status(), 'hotel fiche must not 500').toBeLessThan(500);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // <HotelNearbyPlaces> self-elides when the hotel has no linked places.
    // Either it is absent (clean elision, no empty block) or present with
    // crawlable links back into the lieux vertical — both pass, neither
    // crashes the page.
    const block = page.locator('#lieux-a-proximite');
    if ((await block.count()) > 0) {
      await expect(block).toBeVisible();
      const links = block.locator('a[href*="/lieux/"]');
      expect(
        await links.count(),
        'nearby-places block must carry crawlable lieux links',
      ).toBeGreaterThan(0);
    }
  });

  test('a published fiche has no serious/critical axe violations', async ({ page }) => {
    const ficheHref = await resolveFirstPublishedFicheHref(page);
    if (ficheHref === null) {
      test.skip(true, 'No published places — a11y scan skipped.');
      return;
    }
    await page.goto(ficheHref);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (blocking.length > 0) {
      console.error(
        'place fiche axe violations:',
        JSON.stringify(
          blocking.map((v) => ({ id: v.id, impact: v.impact, help: v.help })),
          null,
          2,
        ),
      );
    }
    expect(
      blocking.map((v) => v.id),
      'serious/critical axe violations on the place fiche',
    ).toEqual([]);
  });
});
