import { expect, test } from '@playwright/test';

import { setConsentCookie } from './fixtures/consent';

/**
 * Menu no-404 walk — PR-C (ADR-0021 Vague 4 menu refonte).
 *
 * The 2026-05-26 reference case (Concierge Club shipped 5 pages with
 * zero nav references) and PR-C (12 brand additions, 4-col Destinations
 * mega, 11-entry Concierge mega) both share the same failure mode: a
 * menu entry whose target route silently 404s in production. The
 * `nav-data.test.ts` unit suite checks slug shape and BRAND_FAMILIES
 * alignment but cannot reach Supabase to confirm the targets are
 * actually published. This spec closes that gap by hitting one
 * representative route per mega column and asserting `200 OK` plus a
 * non-empty `<h1>`.
 *
 * Coverage by mega-menu (5 megas, 1 sample per column = 16 routes,
 * plus 5 top-levels). Total runtime budget: ≤ 90 s.
 *
 * If a route legitimately moves (e.g. a ranking is unpublished),
 * update the corresponding `nav-data.ts` entry FIRST and then this
 * spec. Never silence the test.
 */

interface MenuRoute {
  readonly path: string;
  readonly mega: string;
  readonly note: string;
}

/**
 * Top-level mega-menu landings — every entry in the desktop header bar.
 * These MUST always render in both locales.
 */
const TOP_LEVEL: ReadonlyArray<MenuRoute> = [
  { path: '/hotels', mega: 'M1 top', note: 'Hôtels mega-menu landing' },
  { path: '/destination', mega: 'M2 top', note: 'Destinations directory' },
  { path: '/inspiration', mega: 'M3 top', note: 'Inspiration landing' },
  { path: '/classements', mega: 'M4 top', note: 'Classements landing' },
  { path: '/le-concierge', mega: 'M5 top', note: 'Le Concierge landing' },
];

/**
 * Mega-menu sample — one slug per column. Each chosen so a regression
 * (ranking unpublished, brand removed from Supabase, city guide
 * deleted) breaks this spec instead of leaking to production.
 */
const MEGA_SAMPLES: ReadonlyArray<MenuRoute> = [
  // Mega 1 — Hôtels
  { path: '/categorie/palaces-france', mega: 'M1 col1', note: 'Sélections françaises' },
  { path: '/categorie/hotels-5-etoiles', mega: 'M1 col2', note: 'Par type' },
  { path: '/marque/aman', mega: 'M1 col3', note: 'Aman — PR-C international addition' },
  { path: '/marque/four-seasons', mega: 'M1 col3', note: 'Four Seasons — historical roster' },

  // Mega 2 — Destinations (4 cols since PR-C)
  { path: '/destination/paris', mega: 'M2 col1', note: 'France city' },
  {
    path: '/classements/lieu/cote-d-azur',
    mega: 'M2 col2',
    note: 'Régions FR — routed via /classements (ADR-0014 hack)',
  },
  {
    path: '/destination/new-york',
    mega: 'M2 col3',
    note: 'Monde — villes (long-read merged inline in PR-A)',
  },
  {
    path: '/destination/tokyo',
    mega: 'M2 col3',
    note: 'Monde — villes second sample',
  },
  { path: '/guide/italie', mega: 'M2 col4', note: 'Monde — pays' },

  // Mega 4 — Classements (top 6 — sample one French + one international)
  {
    path: '/classement/meilleurs-palaces-france',
    mega: 'M4 row1',
    note: 'Top ranking FR',
  },
  {
    path: '/classement/top-aman-hotels-monde',
    mega: 'M4 row1',
    note: 'Top ranking intl — PR-C swap',
  },

  // Mega 5 — Le Concierge (11 entries since PR-C trim)
  { path: '/le-concierge-club', mega: 'M5 col1', note: 'Club programme' },
  { path: '/le-concierge/methode-editoriale', mega: 'M5 col1', note: 'Méthode éditoriale' },
  { path: '/le-concierge/faq', mega: 'M5 col1', note: 'FAQ' },
  { path: '/le-conseil-du-concierge', mega: 'M5 col2', note: 'Conseil du Concierge index' },
  { path: '/itineraire', mega: 'M5 col2', note: 'Itinéraires hub' },
  { path: '/ouvertures', mega: 'M5 col2', note: 'Ouvertures' },
  { path: '/le-concierge/pour-les-hoteliers', mega: 'M5 col3', note: 'Hôteliers' },
  { path: '/le-concierge/mice-et-seminaires', mega: 'M5 col3', note: 'MICE' },
  { path: '/le-concierge/presse-et-partenaires', mega: 'M5 col3', note: 'Presse' },
];

test.describe('menu no-404 — every mega-menu sample resolves', () => {
  test.beforeEach(async ({ page }) => {
    await setConsentCookie(page, { essential: true, analytics: false });
  });

  for (const route of TOP_LEVEL) {
    test(`${route.mega} — ${route.path}`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status(), `${route.path} (${route.note}) should return 200`).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${route.path} should expose a non-empty <h1>`,
      ).toBeVisible();
    });
  }

  for (const route of MEGA_SAMPLES) {
    test(`${route.mega} — ${route.path}`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status(), `${route.path} (${route.note}) should return 200`).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${route.path} should expose a non-empty <h1>`,
      ).toBeVisible();
    });
  }

  /**
   * Cross-locale parity — pick three pivotal new routes and assert the
   * EN counterpart also resolves. The full intl walk would double the
   * runtime; this samples the routes most likely to drift (newly added
   * Aman brand page, intl ranking, merged city guide).
   */
  test('EN parity — new PR-C routes resolve under /en too', async ({ page }) => {
    const enRoutes: ReadonlyArray<string> = [
      '/en/marque/aman',
      '/en/classement/top-aman-hotels-monde',
      '/en/destination/new-york',
    ];
    for (const path of enRoutes) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${path} should expose an <h1>`,
      ).toBeVisible();
    }
  });
});
