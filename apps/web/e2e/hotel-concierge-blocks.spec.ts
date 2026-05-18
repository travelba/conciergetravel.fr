import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Concierge-voice restructuring — WS5 phase 1.
 *
 * Guards the contract that the synthetic hotel detail surfaces:
 *   1. The three POI bucket sections (visit / do / shop) with the
 *      Concierge-voice titles + leads + the i18n tip fallback.
 *   2. The events block with the Concierge-voice tip fallback.
 *   3. The FAQ section with the first item rendered as `<details open>`
 *      so the answer text is in the DOM at load (skill:
 *      `geo-llm-optimization` §AEO — several LLM crawlers skip closed
 *      `<details>` bodies).
 *   4. The new `ItemList` JSON-LD payload for the `visit` bucket
 *      (skill: `structured-data-schema-org`) — complements the existing
 *      `nearbyAttractions` on the parent `Hotel` node.
 *
 * Activated by the `MCH_E2E_FAKE_HOTEL_ID` seam — see
 * `dev-fake-hotel-detail.ts` which ships 3 POIs (one per bucket) and
 * one upcoming event so all blocks exercise their happy path.
 *
 * Skill: test-strategy §E2E, geo-llm-optimization, structured-data-schema-org.
 */

const FR_PATH = '/hotel/hotel-de-test-e2e';

async function readJsonLd(page: import('@playwright/test').Page): Promise<readonly unknown[]> {
  return page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    );
    return scripts.map((s) => {
      try {
        return JSON.parse(s.textContent ?? 'null');
      } catch {
        return null;
      }
    });
  });
}

test.describe('Concierge blocks — fiche hôtel (WS5 phase 1)', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  test('FR — POI buckets render Concierge titles + tip fallback per bucket', async ({ page }) => {
    const res = await page.goto(FR_PATH);
    expect(res?.status()).toBe(200);

    // Three buckets, three titles — all the new Concierge-voice copy.
    await expect(
      page.getByRole('heading', { name: /Ce qu['’]on visite dans le quartier/i }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ce qu['’]on y fait/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Le pratique du quartier/i })).toBeVisible();

    // One tip block per bucket (3 total). They share the
    // `data-concierge-tip="bucket-*"` marker.
    const tips = page.locator('[data-concierge-tip^="bucket-"]');
    await expect(tips).toHaveCount(3);

    // The visit-bucket tip falls back to the i18n template since no
    // humanized `bucket_tip_fr` is on the fake hotel.
    await expect(page.locator('[data-concierge-tip="bucket-visit"]')).toContainText(
      /Mon conseil\s*:/i,
    );
  });

  test('FR — events block exposes Concierge tip fallback', async ({ page }) => {
    await page.goto(FR_PATH);

    const tip = page.locator('[data-concierge-tip="events"]');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Mon conseil\s*:/i);
  });

  test('FR — first FAQ item is rendered as <details open> (GEO rule)', async ({ page }) => {
    await page.goto(FR_PATH);

    const faqSection = page.locator('#faq');
    await expect(faqSection).toBeVisible();

    const firstDetails = faqSection.locator('details').first();
    // `open` attribute is reflected as a boolean property on HTMLDetailsElement.
    const isOpen = await firstDetails.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(isOpen).toBe(true);

    // Subsequent items stay closed by default — only the first opens.
    const detailsCount = await faqSection.locator('details').count();
    if (detailsCount > 1) {
      const secondOpen = await faqSection
        .locator('details')
        .nth(1)
        .evaluate((el) => (el as HTMLDetailsElement).open);
      expect(secondOpen).toBe(false);
    }
  });

  test('FR — ItemList JSON-LD for the visit bucket is present and valid', async ({ page }) => {
    await page.goto(FR_PATH);

    const payloads = await readJsonLd(page);
    const itemList = payloads.find(
      (p): p is Record<string, unknown> =>
        p !== null &&
        typeof p === 'object' &&
        (p as Record<string, unknown>)['@type'] === 'ItemList',
    );
    expect(itemList, 'expected an ItemList JSON-LD payload on the page').toBeDefined();

    expect(itemList?.['@context']).toBe('https://schema.org');
    expect(itemList?.['name']).toMatch(/Ce qu['’]on visite dans le quartier/i);
    const items = itemList?.['itemListElement'];
    expect(Array.isArray(items)).toBe(true);
    expect((items as readonly unknown[]).length).toBeGreaterThan(0);

    const first = (items as readonly Record<string, unknown>[])[0];
    expect(first?.['@type']).toBe('ListItem');
    expect(first?.['position']).toBe(1);
    const nested = first?.['item'] as Record<string, unknown> | undefined;
    expect(nested?.['@type']).toBe('Museum');
    expect(nested?.['name']).toMatch(/Louvre/i);
  });

  test('FR — Hotel.nearbyAttractions carries the enriched POI fields', async ({ page }) => {
    await page.goto(FR_PATH);

    const payloads = await readJsonLd(page);
    const hotel = payloads.find(
      (p): p is Record<string, unknown> =>
        p !== null && typeof p === 'object' && (p as Record<string, unknown>)['@type'] === 'Hotel',
    );
    expect(hotel).toBeDefined();

    const nearby = hotel?.['nearbyAttractions'];
    expect(Array.isArray(nearby)).toBe(true);
    const louvre = (nearby as readonly Record<string, unknown>[]).find((p) =>
      typeof p['name'] === 'string' ? /Louvre/i.test(p['name']) : false,
    );
    expect(louvre, 'expected the Louvre POI inside nearbyAttractions').toBeDefined();
    // Description forwarded from the enriched POI (WS5 phase 1).
    expect(louvre?.['description']).toMatch(/cinq minutes/i);
    // Schema.org class derived from the OSM `type` via osmToSchemaClass.
    expect(louvre?.['@type']).toBe('Museum');
  });
});
