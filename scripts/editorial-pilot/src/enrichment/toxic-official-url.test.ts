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
    // 2026-06-19 backfill sweep — newly discovered squatter families
    // (hotel-name glued into a non-www subdomain of an aggregator domain).
    'https://asiana-capella-suites.hotels-in-hochiminh.com/fr',
    'https://citizenm-bankside.hotels-of-london.com/en',
    'https://etereo-auberge-resorts-collection.hotelsplayadelcarmen.net/en',
    'https://margutta-19.italyromehotels.net/en',
    'https://coworth-park-dorchester-collection-hotel-ascot.berkshiresonline.com/en',
    'https://the-st-regis-chengdu.chengduhotels.net/en',
    'https://rosewood.luangprabanghotels.net/en',
    'https://eilertsmith.hotelstavanger.net/en',
    'https://palais-hansen-kempinski-vienna.hotelsvienna.org/en',
    'https://www.hotels-in-it.com/en/h/boutiquedon1890.html',
    'https://www.hospitalityonline.com/andaz-5th',
    // 2026-06-21 backfill sweep — hyphenated geo-aggregator + HotelsMix family
    'https://etereo-auberge-resorts-collection.hotels-quintana-roo.com/en',
    'https://fairmontthenorfolk.hotelsmixnairobi.com/en',
    'https://hotelsmix.com/en/some-property',
    // 2026-06-22 backfill sweep — `hotels<geo><digits>.com` aggregator
    // (glued non-www subdomain + trailing digits → `.com` is safe here).
    'https://h10waterloo.hotelslondon24.com/es',
    'https://some-hotel.madridhotels24.net/en',
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
    // `<brand>hotels.com` SUFFIX brands the new `.net/.org/.info`-only rule
    // must NOT catch (the AGENTS.md 2026-06-02 near-miss list).
    'https://www.rosewoodhotels.com/en/rosewood-mayakoba',
    'https://www.bulgarihotels.com/en_US/dubai',
    'https://www.comohotels.com/the-halkin',
    'https://www.tajhotels.com/en-in/taj/taj-lake-palace-udaipur',
    // backfill keepers (deep property pages on brand/consortium domains)
    'https://www.fourseasons.com/abudhabi',
    'https://www.jumeirah.com/en/stay/guangzhou/jumeirah-guangzhou',
    'https://www.kempinski.com/en/hotel-gold-coast-city',
    'https://sofitel.accor.com/en/hotels/3569.html',
    'https://mayakoba.com/hotels-overview/rosewood-mayakoba',
    // `hotels`-containing REGISTRABLE domains that are genuine brands/hotels
    // — caught by the old broad rule, MUST survive the subdomain-anchored one.
    'https://www.hotelsbarriere.com/fr/paris/le-fouquets.html',
    'https://www.hotelsbarriere.com/en/la-baule/le-royal',
    'https://www.historichotels.org/us/hotels-resorts/castle-hot-springs',
    'https://www.hotelsquare.com/en',
    'https://hotelsahrai.com',
    // legit brand domains that DO use a property subdomain — the `.com`
    // exclusion on the aggregator rule must keep these valid.
    'https://pasadena.langhamhotels.com/',
    'https://taj.tajhotels.com/en-in/taj-boston/',
    // "Hotel Santa Caterina" — a `hotels...`-prefixed REGISTRABLE `.com`
    // domain with a property subdomain. The targeted `hotelsmix` rule and
    // the `.com` exclusion on the glued-subdomain rule must keep it valid.
    'https://booking.hotelsantacaterina.com/en',
    // legit hotel domains carrying digits — the 2026-06-22 digit-anchored
    // aggregator rule must NOT catch these (no glued-subdomain aggregator shape).
    'https://www.h10hotels.com/en/london-hotels/h10-london-waterloo',
    'https://41hotel.com/discover/stay-local/the-history-of-hotel-41',
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
