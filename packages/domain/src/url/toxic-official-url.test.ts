import { describe, expect, it } from 'vitest';

import { isToxicOfficialUrl } from './toxic-official-url';

/**
 * Representative regression suite for the shared squatter detector.
 *
 * The exhaustive fixture set (every squatter family discovered across the
 * 2026-06 backfill sweeps + the near-miss legit-brand guards) lives with the
 * write-time guard in
 * `scripts/editorial-pilot/src/enrichment/toxic-official-url.test.ts`, which
 * re-exports THIS function — so both suites pin the same regex. This suite
 * keeps a focused subset so the canonical `@mch/domain/url` export carries its
 * own happy/sad-path coverage in a CI-run package.
 */
describe('isToxicOfficialUrl (@mch/domain/url)', () => {
  const TOXIC = [
    // `.com-hotel.(com|info)` network
    'https://lessourcesdecaudalie.com-hotel.com',
    // country-code-glued spam SLD
    'https://slshotel.ae-dubai.info/fr',
    // geo-aggregator glued subdomain (`.net`)
    'https://the-st-regis-chengdu.chengduhotels.net/en',
    // `hotels-<geo>` aggregator
    'https://four-seasons-11321.hotels-riyadh.com/en',
    // `hotels<geo><digits>.com` aggregator (digit-anchored)
    'https://h10waterloo.hotelslondon24.com/es',
    // OTA / meta-search
    'https://www.booking.com/hotel/it/londra-palace.html',
    'https://www.tripadvisor.fr/Hotel_Review-g187147.html',
  ];

  const LEGIT = [
    'https://www.ritzcarlton.com/en/hotels/dxbrz-the-ritz-carlton-dubai/overview',
    'https://www.lareserve-paris.com/en',
    'https://leroch-hotel.com',
    // near-miss legit brands the aggregator rules must NOT catch
    'https://www.rosewoodhotels.com/en/rosewood-mayakoba',
    'https://pasadena.langhamhotels.com/',
    'https://www.h10hotels.com/en/london-hotels/h10-london-waterloo',
  ];

  it.each(TOXIC)('flags toxic url %s', (url) => {
    expect(isToxicOfficialUrl(url)).toBe(true);
  });

  it.each(LEGIT)('keeps legit url %s', (url) => {
    expect(isToxicOfficialUrl(url)).toBe(false);
  });

  it('returns false for empty / malformed input', () => {
    expect(isToxicOfficialUrl('')).toBe(false);
    expect(isToxicOfficialUrl('not a url')).toBe(false);
  });
});
