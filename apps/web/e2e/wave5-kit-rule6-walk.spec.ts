/**
 * Rule 6 — wave-5 kit PO walk (prod). Captures DOM checks + section screenshots.
 *
 *   pnpm exec playwright test wave5-kit-rule6-walk --config=playwright.prod.config.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { setConsentCookie } from './fixtures/consent';

const BASE = process.env['PLAYWRIGHT_BASE_URL'] ?? 'https://myconciergehotel.com';
const OUT_DIR = join(
  process.cwd(),
  '..',
  '..',
  'scripts',
  'editorial-pilot',
  'runs',
  'wave5-walk-2026-06-12',
);

const WAVE5_SLUGS = [
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

type Locale = 'fr' | 'en';
type Viewport = 'desktop' | 'mobile';

function hotelPath(slug: string, locale: Locale): string {
  return locale === 'en' ? `/en/hotel/${slug}` : `/hotel/${slug}`;
}

async function shot(
  page: Page,
  slug: string,
  locale: Locale,
  viewport: Viewport,
  section: string,
): Promise<void> {
  const file = join(OUT_DIR, `${slug}-${locale}-${viewport}-${section}.png`);
  await page.screenshot({ path: file, fullPage: false });
}

async function walkHotel(
  page: Page,
  slug: string,
  locale: Locale,
  viewport: Viewport,
): Promise<void> {
  const w = viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  await page.setViewportSize(w);
  await setConsentCookie(page, { essential: true, analytics: false });

  const res = await page.goto(`${BASE}${hotelPath(slug, locale)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  expect(res?.status()).toBe(200);
  await page.waitForTimeout(4000);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // 1 — #chambres
  const chambres = page.locator('#chambres');
  await chambres.scrollIntoViewIfNeeded();
  await expect(chambres).toBeVisible();
  const roomCards = chambres.locator('article.room-v2');
  await expect(roomCards.first()).toBeVisible();
  await expect(chambres.locator('.cc-pick, [class*="pick"]').first()).toBeVisible();
  const roomImg = roomCards.first().locator('img').first();
  await expect(roomImg).toHaveAttribute('src', /cloudinary|\/kit\//);
  await shot(page, slug, locale, viewport, 'chambres');

  // 2 — #hotel-en-bref (spa + resto)
  const bref = page.locator('#hotel-en-bref');
  await bref.scrollIntoViewIfNeeded();
  await expect(bref).toBeVisible();
  const restoCards = bref.locator('article.resto-card');
  const expCards = bref.locator('article.exp-card');
  await expect(expCards.first()).toBeVisible();
  if ((await restoCards.count()) > 0) {
    const restoSrc = await restoCards.first().locator('img').first().getAttribute('src');
    expect(restoSrc ?? '').not.toContain('htl_resto.jpg');
  }
  await shot(page, slug, locale, viewport, 'hotel-en-bref');

  // 3 — #acces (GMB)
  const acces = page.locator('#acces');
  await acces.scrollIntoViewIfNeeded();
  await expect(acces).toBeVisible();
  await shot(page, slug, locale, viewport, 'acces');

  // 4 — FAQ + concierge questions
  const faq = page.locator('#faq');
  await faq.scrollIntoViewIfNeeded();
  await expect(faq).toBeVisible();
  const cq = page.locator('#concierge-questions');
  await cq.scrollIntoViewIfNeeded();
  await expect(cq).toBeVisible();
  await shot(page, slug, locale, viewport, 'faq');

  // 5 — #autour
  const autour = page.locator('#autour');
  await autour.scrollIntoViewIfNeeded();
  await expect(autour).toBeVisible();
  await shot(page, slug, locale, viewport, 'autour');
}

test.describe('wave-5 kit Rule 6 walk (prod)', () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
  });

  for (const slug of WAVE5_SLUGS) {
    for (const locale of ['fr', 'en'] as const) {
      for (const viewport of ['desktop', 'mobile'] as const) {
        test(`${slug} ${locale} ${viewport}`, async ({ page }) => {
          await walkHotel(page, slug, locale, viewport);
        });
      }
    }
  }
});
