import { describe, expect, it } from 'vitest';

import { isToxicOfficialUrl } from './toxic-official-url.js';

describe('isToxicOfficialUrl', () => {
  // ── Squatter / booking-engine / OTA families that MUST be flagged ──
  const TOXIC = [
    // `.com-hotel.(com|info)` network
    'https://relaisetchateauxlechambard.com-hotel.com',
    'https://lessourcesdecaudalie.com-hotel.com',
    'https://margutta19hotel.com-hotel.com',
    'https://grecotelmarinepalaceaquapark.com-hotel.com',
    'https://hotelmurmuribarcelona.com-hotel.com',
    'https://penhalongaresort.com-hotel.com',
    'https://romeohotelnaples.com-hotel.com',
    // country-code-glued spam SLDs
    'https://le-petit-nice-passedat.fr-provencehotel.com/en',
    'https://slshotel.ae-dubai.info/fr',
    'https://thestregisdowntown.ae-dubai.info',
    // *hotelinn.com network
    'https://scribe.parishotelinn.com/en',
    // booking engines / Emaar portal
    'https://spicers-peak-ldg-maryvale.h-rez.com',
    'https://www.ubyemaar.com/en-ae/experiences/address-sky-view',
    'https://astir-egnatia.reserve-online.net/property/GRECASTIR',
    'https://murmuri-hotel-barcelona.hotel-dir.com/en',
    // geo-glued hotel-aggregator SLDs
    'https://four-seasons-11321.hotels-riyadh.com/en',
    'https://www.hotels-dubai.org/en/property/slshotel-residences/reviews.html',
    'https://the-st-regis.riyadh-hotels-sa.com/en',
    'https://grace-santorini.hotelsofsantorini.com/en',
    // OTAs
    'https://www.trivago.com/en-US/oar/hotel-las-ventanas',
    'https://www.booking.com/hotel/it/londra-palace.html',
    'https://www.tripadvisor.fr/Hotel_Review-g187147.html',
    'https://us.trip.com/hotels/detail/12345',
  ];

  // ── Genuine official sites that MUST NOT be flagged (regression guard) ──
  const LEGIT = [
    'https://www.lafantaisie.com',
    'https://www.lareserve-paris.com/en',
    'https://leroch-hotel.com',
    'https://www.londrapalace.com',
    'https://www.passalacqua.it/en',
    'https://thecalilehotel.com',
    'https://www.monsieurgeorge.com',
    'https://www.molinodealcuneza.com',
    'https://www.minosbeach.com',
    'https://www.palazzoripetta.com/en',
    'https://www.lenarcisseblanc.com/en/location',
    'https://www.sofitelrome.com',
    'https://www.sofitel-paris-baltimore.com/en',
    'https://www.hotelpraktikrambla.com/en',
    'https://www.hotelmanfredi.com',
    'https://thegainsboroughbathspa.co.uk/pages/the-gainsborough-story.html',
    // known luxury parent-brand domains with a hotel path
    'https://www.relaischateaux.com/us/hotel/le-vieux-logis',
    'https://www.lhw.com/hotel/Le-Sirenuse-Positano-Italy',
    'https://www.marriott.com/en-us/hotels/vcegl-the-gritti-palace/overview',
    'https://www.ritzcarlton.com/en/hotels/dxbrz-the-ritz-carlton-dubai/overview',
    'https://www.hyatt.com/park-hyatt/en-US/chiph-park-hyatt-chicago',
    'https://www.belmond.com/hotels/europe/italy/costa-smeralda/belmond-romazzino',
    'https://www.sixsenses.com/en/hotels-resorts/europe/spain/ibiza',
    'https://www.raffles.com/thepalm-dubai',
    'https://www.oneandonlyresorts.com/the-palm',
    'https://www.grecotel.com/luxme-daphnilabay',
    'https://www.lesjardinsdelakoutoubia.com/en/legal-notices',
    'https://airelles.com/en/destination/gordes-hotel/la-bastide-5-star',
    // near-miss brand domains the new aggregator rules must NOT catch
    'https://www.fairmont.com/en/hotels/riyadh/fairmont-riyadh.html',
    'https://www.comogroup.com/property/como-alpina-dolomites',
    'https://theromeocollection.com/en/romeo-napoli',
    'https://portofino.eighthotels.it/en',
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
