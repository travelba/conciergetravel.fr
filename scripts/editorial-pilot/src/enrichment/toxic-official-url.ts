/**
 * toxic-official-url.ts — single source of truth for "this URL is NOT a
 * legitimate hotel official site".
 *
 * Why this exists
 * ---------------
 * The 2026-06-02 EEAT cleanup found ~140 published hotels whose
 * `hotels.official_url` pointed at an SEO-squatter landing page, a
 * booking engine, or an OTA — not the hotel's own site. Two pipelines
 * touch `official_url` and BOTH must reject the same set:
 *
 *   1. `convert-wikidata-to-external-sources.ts` projects `official_url`
 *      into the `external_sources` provenance array (EEAT surface read
 *      by Google / AI Overviews / the page footer). A toxic value here
 *      poisons the citation graph.
 *   2. `photos/backfill-official-url.ts` proposes a fresh `official_url`
 *      from a Tavily search. The squatter network embeds the hotel name
 *      in the hostname (`lessourcesdecaudalie.com-hotel.com`,
 *      `slshotel.ae-dubai.info`, `scribe.parishotelinn.com`), so it
 *      sails through the "hotel-name-in-host" high-confidence rule
 *      unless we explicitly veto it.
 *
 * Keeping the detector in one module guarantees the converter and the
 * backfill can never drift apart.
 *
 * Design — why these patterns are safe against legitimate domains
 * ---------------------------------------------------------------
 * The country-glued rule matches a bare 2-letter segment IMMEDIATELY
 * followed by a hyphen (`.fr-`, `.ae-`, `.sa-`, `.uk-`). Real multiword
 * hotel domains never look like that: their first segment is a full
 * word (`leroch-hotel.com`, `sofitel-paris-baltimore.com`,
 * `lareserve-paris.com`, `le-petit-nice.fr`) so the hyphen never sits
 * right after a 2-char token. The cc-list is explicit (not `[a-z]{2}`)
 * to avoid catching a hypothetical legit `.co-op.com`.
 *
 * Forward-only: when a new squatter family is discovered, add a clause
 * here + a fixture in `toxic-official-url.test.ts`.
 */

/**
 * SEO-squatter / booking-engine / OTA host families that are NEVER a
 * hotel's own official site. Matched against the full URL (lowercased)
 * so both the scheme and the path are available to the regex.
 */
// Host-anchored OTA / meta-search domains. Anchored with `(?:^|[./])` so
// a brand domain like `rosewoodhotels.com` is never matched by the
// `hotels.com` clause (substring match would be a false positive).
const OTA_HOSTS = [
  String.raw`tripadvisor\.[a-z.]+`,
  String.raw`booking\.com`,
  String.raw`agoda\.(?:com|net)`,
  String.raw`hotels\.com`,
  String.raw`expedia\.[a-z.]+`,
  String.raw`trivago\.[a-z.]+`,
  String.raw`kayak\.[a-z.]+`,
  String.raw`hostelworld\.com`,
  String.raw`ostrovok\.ru`,
  String.raw`makemytrip\.com`,
  String.raw`trip\.com`,
  String.raw`priceline\.com`,
].join('|');

const TOXIC_OFFICIAL_URL_RE: RegExp = new RegExp(
  [
    // `*.com-hotel.com` / `*.com-hotel.info` — the largest squatter net
    // (`lessourcesdecaudalie.com-hotel.com`, `margutta19hotel.com-hotel.com`).
    String.raw`\.com-hotel\.(?:com|info)(?:[/:?#]|$)`,
    // Country-code-glued spam SLDs: `.ae-dubai.info`, `.sa-riyadh.info`,
    // `.uk-hotel.info`, `.fr-provencehotel.com`. Explicit cc list keeps
    // it conservative (won't catch a legit `.co-op.com`).
    String.raw`\.(?:fr|ae|sa|uk|us|de|es|it|pt|gr|ch|be|nl|ru)-[a-z0-9]+\.(?:com|info|net)(?:[/:?#]|$)`,
    // `*hotelinn.com` network (`scribe.parishotelinn.com`).
    String.raw`(?:^|[./])[a-z0-9-]*hotelinn\.com(?:[/:?#]|$)`,
    // `<geo>parishotel.com` / `<geo>provencehotel.com` no-cc variants.
    String.raw`(?:^|[./])[a-z0-9-]*(?:paris|provence|riviera|cote)hotel[a-z0-9-]*\.com(?:[/:?#]|$)`,
    // Generic third-party booking engines / chain portals.
    String.raw`(?:^|[./])h-rez\.com(?:[/:?#]|$)`,
    String.raw`(?:^|[./])ubyemaar\.com(?:[/:?#]|$)`,
    String.raw`(?:^|[./])reserve-online\.[a-z.]+(?:[/:?#]|$)`,
    String.raw`(?:^|[./])hotel-dir\.[a-z.]+(?:[/:?#]|$)`,
    // Geo-glued hotel-aggregator SLDs that masquerade as official sites
    // for hard-to-source chains (`hotels-riyadh.com`, `hotels-dubai.org`,
    // `riyadh-hotels-sa.com`, `hotelsofsantorini.com`). They embed the
    // hotel/brand name in a subdomain so they pass "name-in-host".
    // The `[a-z0-9-]+` (hyphens allowed) covers multiword geos like
    // `hotels-quintana-roo.com` (2026-06-21 backfill —
    // `etereo-auberge-resorts-collection.hotels-quintana-roo.com`). Safe:
    // the mandatory `hotels-` hyphen-prefix never appears in a legit brand
    // domain (`hotelsbarriere.com`, `historichotels.org` have no hyphen there).
    String.raw`(?:^|[./])hotels-[a-z0-9-]+\.(?:com|org|net|info)(?:[/:?#]|$)`,
    // `hotelsmix<geo>` aggregator network (HotelsMix) — glues the hotel
    // name into a non-www subdomain on a `.com` TLD, so it escapes the
    // `.net/.org/.info`-only glued-subdomain rule below
    // (`fairmontthenorfolk.hotelsmixnairobi.com`, 2026-06-21 backfill).
    // Targeted to the `hotelsmix` brand specifically — a broad `hotels<geo>`
    // `.com` rule would false-positive on legit `booking.hotelsantacaterina.com`
    // ("Hotel Santa Caterina"), which is exactly why `.com` is excluded below.
    String.raw`(?:^|[./])hotelsmix[a-z0-9-]*\.(?:com|org|net|info)(?:[/:?#]|$)`,
    // `hotels<geo><digits>` / `<geo>hotels<digits>` aggregator network that
    // glues the hotel name into a NON-www subdomain on ANY TLD incl. `.com`
    // (`h10waterloo.hotelslondon24.com`, 2026-06-22 backfill). The trailing
    // DIGITS are the safe discriminator: they let this rule include `.com`
    // (which the digit-less glued-subdomain rule below must exclude to spare
    // `booking.hotelsantacaterina.com`, `pasadena.langhamhotels.com`). A
    // legit brand never registers `hotels<word><digits>.com`.
    String.raw`//(?!www\.)[a-z0-9-]+\.(?:hotels[a-z]+|[a-z]+hotels)\d+\.(?:com|org|net|info)(?:[/:?#]|$)`,
    String.raw`(?:^|[./])[a-z0-9]+-hotels-[a-z]{2}\.(?:com|org|net|info)(?:[/:?#]|$)`,
    String.raw`(?:^|[./])hotelsof[a-z0-9]+\.(?:com|org|net|info)(?:[/:?#]|$)`,
    // `hotels-in-<geo>` / `hotels-of-<geo>` aggregator SLDs. Unambiguous:
    // no legitimate brand registers `hotels-in-X` / `hotels-of-X`
    // (`asiana-capella-suites.hotels-in-hochiminh.com`, `www.hotels-in-it.com`).
    String.raw`(?:^|[./])hotels-(?:in|of)-[a-z0-9]+\.(?:com|org|net|info)(?:[/:?#]|$)`,
    // `hotels<geo>` / `<geo>hotels` aggregator registrable domains that glue
    // the hotel name into a NON-www subdomain on a `.net`/`.org`/`.info` TLD
    // (`the-st-regis-chengdu.chengduhotels.net`, `palais-...hotelsvienna.org`,
    // `margutta-19.italyromehotels.net`). TWO safety guards stacked:
    //   (1) the mandatory glued non-www subdomain skips `www.`/bare brand
    //       domains (`www.hotelsbarriere.com`, `www.hotelsquare.com`,
    //       `historichotels.org`, `rosewoodhotels.com`, `comohotels.com`);
    //   (2) `.com` is EXCLUDED so legit brands that DO use property
    //       subdomains stay safe (`pasadena.langhamhotels.com`,
    //       `taj.tajhotels.com`). The squatters in this family all use
    //       `.net`/`.org`/`.info`. The few `.com` geo-squatters are a finite
    //       set NULLed by hand — adding `.com` here would silently drop real
    //       Langham/Taj official subdomains.
    String.raw`//(?!www\.)[a-z0-9-]+\.(?:hotels[a-z]{3,}|[a-z]{3,}hotels)\.(?:net|org|info)(?:[/:?#]|$)`,
    // `<region>online` regional-aggregator family (`berkshiresonline.com`,
    // `hospitalityonline.com`) that fronts a non-official landing page.
    String.raw`(?:^|[./])[a-z]+online\.(?:com|net|org|info)(?:[/:?#]|$)`,
    // OTAs + meta-search.
    String.raw`(?:^|[./])(?:${OTA_HOSTS})(?:[/:?#]|$)`,
  ].join('|'),
  'iu',
);

/**
 * Returns `true` when the URL is a known squatter / booking-engine / OTA
 * host that must never be stored as a hotel's `official_url`.
 *
 * Defensive: a malformed URL is treated as non-toxic (the caller's other
 * validation will reject it) — we only flag URLs we positively recognise.
 *
 * ⚠ SCOPE — this detector is for the `official_url` FIELD only. Do NOT apply
 * it verbatim when cleaning the `external_sources` provenance array: there the
 * OTA review/booking hosts (TripAdvisor, Booking.com, …) are LEGITIMATE EEAT
 * references rendered in the page footer (AGENTS.md Phase 5). A 2026-06-19
 * external_sources sweep that reused this helper flagged 129 hotels but 107
 * were valid TripAdvisor citations — only the 22 SEO-squatter entries
 * (reserve-online / hotel-dir / hotels-<geo> / ae-<city> …) were genuinely
 * toxic. When de-polluting provenance, exclude the OTA hosts first (keep them)
 * and strip only the squatter families.
 */
export function isToxicOfficialUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  return TOXIC_OFFICIAL_URL_RE.test(url);
}
