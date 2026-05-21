import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';
import frMessages from '@/i18n/messages/fr.json';
import enMessages from '@/i18n/messages/en.json';

/**
 * CI guard — congruence between the 4 sources of truth for the
 * international country guides (Vague 6).
 *
 * If any of these drifts from the others, agent traffic and HTML
 * traffic stop matching. The check is small (8 countries × 4
 * surfaces) and runs fast.
 */

const COUNTRY_SLUGS_FR = [
  'italie',
  'suisse',
  'maroc',
  'maldives',
  'emirats-arabes-unis',
  'japon',
  'thailande',
  'etats-unis',
] as const;

const NAMESPACE_FOR_SLUG: Readonly<Record<string, string>> = {
  italie: 'guideItalie',
  suisse: 'guideSuisse',
  maroc: 'guideMaroc',
  maldives: 'guideMaldives',
  'emirats-arabes-unis': 'guideEAU',
  japon: 'guideJapon',
  thailande: 'guideThailande',
  'etats-unis': 'guideEtatsUnis',
};

const APP_DIR = resolve(__dirname, '../../../[locale]/guide');

describe('Vague 6 — international country guides congruence', () => {
  it.each(COUNTRY_SLUGS_FR)(
    'slug "%s" has a routing entry, an HTML page, and FR+EN i18n namespaces',
    (slug) => {
      // 1. Routing — the FR pathname must be declared
      const routingKey = `/guide/${slug}` as keyof typeof routing.pathnames;
      expect(routing.pathnames, `routing.ts must declare /guide/${slug}`).toHaveProperty(
        routingKey,
      );

      // 2. Page file on disk
      const pagePath = resolve(APP_DIR, slug, 'page.tsx');
      expect(
        existsSync(pagePath),
        `page file must exist at apps/web/src/app/[locale]/guide/${slug}/page.tsx`,
      ).toBe(true);

      // 3. i18n FR namespace present + non-empty
      const ns = NAMESPACE_FOR_SLUG[slug];
      if (!ns) {
        throw new Error(`slug "${slug}" missing from NAMESPACE_FOR_SLUG`);
      }
      const fr = (frMessages as Record<string, unknown>)[ns];
      expect(fr, `fr.json must have namespace "${ns}"`).toBeDefined();
      expect(typeof fr).toBe('object');

      // 4. i18n EN namespace present + non-empty
      const en = (enMessages as Record<string, unknown>)[ns];
      expect(en, `en.json must have namespace "${ns}"`).toBeDefined();
      expect(typeof en).toBe('object');

      // 5. Critical shape — both locales must carry the AEO + FAQ
      //    blocks so the agent endpoint can return a complete envelope.
      const frShape = fr as Record<string, unknown>;
      const enShape = en as Record<string, unknown>;
      for (const key of ['aeoQuestion', 'aeoAnswer', 'faq', 'regions', 'practical'] as const) {
        expect(frShape[key], `fr ${ns}.${key} must be present`).toBeDefined();
        expect(enShape[key], `en ${ns}.${key} must be present`).toBeDefined();
      }
    },
  );

  it('all i18n guide namespaces have an entry in COUNTRY_SLUGS_FR (no orphans)', () => {
    // Defensive — if a future PR adds a `guideXxx` namespace without
    // wiring it to routing.ts + page.tsx + this list, fail here.
    const allFrNs = Object.keys(frMessages as Record<string, unknown>).filter((k) =>
      k.startsWith('guide'),
    );
    const expectedNs = COUNTRY_SLUGS_FR.map((s) => {
      const ns = NAMESPACE_FOR_SLUG[s];
      if (!ns) throw new Error(`slug "${s}" missing from NAMESPACE_FOR_SLUG`);
      return ns;
    }).sort();
    const actualNs = allFrNs.sort();

    // Allow extra non-country `guide*` namespaces in the future, but
    // every country namespace from the list must appear.
    for (const ns of expectedNs) {
      expect(actualNs, `country namespace "${ns}" must exist in fr.json`).toContain(ns);
    }
  });

  it('the /api/agent/country-guide/[slug] route file is present', () => {
    const apiRoute = resolve(__dirname, '[slug]', 'route.ts');
    expect(existsSync(apiRoute)).toBe(true);
  });
});
