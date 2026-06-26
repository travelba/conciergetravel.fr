import { describe, expect, it } from 'vitest';

import enMessages from './messages/en.json';
import frMessages from './messages/fr.json';

/**
 * Guards the SEO length band of the city-directory meta description
 * (`directoryPage.city.metaDesc`, rendered on `/hotels/[pays]/[ville]`).
 *
 * Why this test exists: the 2026-06-26 L3 site-audit crawl
 * (docs/audits/rankings-health-crawl-2026-06-26.md) found ~52% of the sampled
 * `/hotels/<country>/<city>` pages rendering a meta description BELOW the 110
 * SEO floor — the template's fixed copy was ~74 chars, so short city+country
 * pairs (e.g. "Nice, France") landed at ~88-100 chars. The template was widened.
 *
 * This renders the ACTUAL shipped template via `IntlMessageFormat` (the same
 * ICU engine next-intl uses) for real observed pairs + the realistic length
 * extremes, and asserts every result lands in [110, 170] — so a future edit
 * that shortens the copy below the floor (or overflows it) fails CI instead of
 * silently regressing thousands of directory pages.
 */

const BAND_MIN = 110;
const BAND_MAX = 170;

interface Sample {
  readonly count: number;
  readonly city: string;
  readonly country: string;
}

// Real pairs surfaced by the crawl (were below 110 before the fix) + the
// realistic short/long extremes of the catalogue's city/country names.
const FR_SAMPLES: readonly Sample[] = [
  { count: 1, city: 'Nice', country: 'France' }, // shortest realistic
  { count: 1, city: 'Goa', country: 'Inde' },
  { count: 3, city: 'Minorque', country: 'Espagne' },
  { count: 4, city: 'Venise', country: 'Italie' },
  { count: 2, city: 'Megalochori', country: 'Grèce' },
  { count: 5, city: 'Cashel', country: 'Irlande' },
  { count: 7, city: 'Newbury', country: 'Royaume-Uni' },
  { count: 3, city: 'Torres del Paine', country: 'Chili' },
  { count: 9, city: 'Saint-Paul-de-Vence', country: 'France' },
  { count: 12, city: 'Saint-Jean-Cap-Ferrat', country: 'France' }, // long city
  { count: 6, city: 'Dubaï', country: 'Émirats arabes unis' }, // long country
  { count: 4, city: 'Punta Cana', country: 'République dominicaine' }, // longest country
  { count: 250, city: 'Paris', country: 'France' }, // large count
];

const EN_SAMPLES: readonly Sample[] = [
  { count: 1, city: 'Nice', country: 'France' },
  { count: 1, city: 'Goa', country: 'India' },
  { count: 3, city: 'Minorca', country: 'Spain' },
  { count: 4, city: 'Venice', country: 'Italy' },
  { count: 5, city: 'Cashel', country: 'Ireland' },
  { count: 7, city: 'Newbury', country: 'United Kingdom' },
  { count: 3, city: 'Torres del Paine', country: 'Chile' },
  { count: 9, city: 'Saint-Paul-de-Vence', country: 'France' },
  { count: 12, city: 'Saint-Jean-Cap-Ferrat', country: 'France' },
  { count: 6, city: 'Dubai', country: 'United Arab Emirates' },
  { count: 4, city: 'Punta Cana', country: 'Dominican Republic' },
  { count: 250, city: 'Paris', country: 'France' },
];

/**
 * Faithful ICU render of the `city.metaDesc` template for length checks.
 * Resolves the single `{count, plural, one {…} other {…}}` block (the only
 * plural in this message), substitutes `#` with the locale-formatted number
 * (matching next-intl's `Intl.NumberFormat` output), then fills {city}/{country}.
 * Reads the REAL shipped template string, so it still guards the JSON copy.
 */
function renderCityMetaDesc(template: string, locale: string, s: Sample): string {
  const pluralRe = /\{count,\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/u;
  const num = new Intl.NumberFormat(locale).format(s.count);
  const out = template.replace(pluralRe, (_full, one: string, other: string) =>
    (s.count === 1 ? one : other).replace(/#/gu, num),
  );
  return out.replace(/\{city\}/gu, s.city).replace(/\{country\}/gu, s.country);
}

describe('directoryPage.city.metaDesc — SEO length band', () => {
  it('FR template stays within [110, 170] for real + extreme name lengths', () => {
    const template = frMessages.directoryPage.city.metaDesc;
    for (const s of FR_SAMPLES) {
      const text = renderCityMetaDesc(template, 'fr', s);
      expect(
        text.length,
        `FR "${s.city}, ${s.country}" (count ${s.count}) → ${text.length} chars: "${text}"`,
      ).toBeGreaterThanOrEqual(BAND_MIN);
      expect(
        text.length,
        `FR "${s.city}, ${s.country}" (count ${s.count}) → ${text.length} chars: "${text}"`,
      ).toBeLessThanOrEqual(BAND_MAX);
    }
  });

  it('EN template stays within [110, 170] for real + extreme name lengths', () => {
    const template = enMessages.directoryPage.city.metaDesc;
    for (const s of EN_SAMPLES) {
      const text = renderCityMetaDesc(template, 'en', s);
      expect(
        text.length,
        `EN "${s.city}, ${s.country}" (count ${s.count}) → ${text.length} chars: "${text}"`,
      ).toBeGreaterThanOrEqual(BAND_MIN);
      expect(
        text.length,
        `EN "${s.city}, ${s.country}" (count ${s.count}) → ${text.length} chars: "${text}"`,
      ).toBeLessThanOrEqual(BAND_MAX);
    }
  });
});
