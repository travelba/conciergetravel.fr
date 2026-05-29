/**
 * Country label → ISO-3166-1 alpha-2 lookup.
 *
 * - Lookup is case-insensitive (briefs sometimes capitalise loosely:
 *   "Émirats Arabes Unis" vs "Émirats arabes unis").
 * - Multi-country labels (e.g. `Kenya / Afrique du Sud` for a safari
 *   crossing borders, or `France / Italie` for a Paris–Venice train) are
 *   resolved to the FIRST listed country — the DB stores exactly one
 *   `country_code` per itinerary and the editor surfaces the secondary
 *   region in the page body, not in the schema.
 */
const COUNTRY_LABEL_TO_ISO: Readonly<Record<string, string>> = {
  // ─── Original itinerary scope (FR + 9 destinations) ──────────────────────
  france: 'FR',
  japon: 'JP',
  japan: 'JP',
  italie: 'IT',
  italy: 'IT',
  maroc: 'MA',
  morocco: 'MA',
  espagne: 'ES',
  spain: 'ES',
  'émirats arabes unis': 'AE',
  'united arab emirates': 'AE',
  uae: 'AE',
  maldives: 'MV',
  'états-unis': 'US',
  'united states': 'US',
  usa: 'US',
  kenya: 'KE',
  'afrique du sud': 'ZA',
  'south africa': 'ZA',
  indonésie: 'ID',
  indonesia: 'ID',
  // ─── Forbes 5-Star 2026 expansion (51 countries) ─────────────────────────
  // Source: global-sources/forbes-5-star-2026.json — ISO 3166-1 alpha-2.
  // Added 2026-05-29 to support the `fetch-forbes-5-star.ts` pipeline.
  anguilla: 'AI',
  azerbaijan: 'AZ',
  barbados: 'BB',
  brazil: 'BR',
  brésil: 'BR',
  bresil: 'BR',
  cambodia: 'KH',
  cambodge: 'KH',
  canada: 'CA',
  'cayman islands': 'KY',
  china: 'CN',
  chine: 'CN',
  'costa rica': 'CR',
  'czech republic': 'CZ',
  'république tchèque': 'CZ',
  czechia: 'CZ',
  fiji: 'FJ',
  fidji: 'FJ',
  'french polynesia': 'PF',
  'polynésie française': 'PF',
  greece: 'GR',
  grèce: 'GR',
  grece: 'GR',
  'hong kong': 'HK',
  hungary: 'HU',
  hongrie: 'HU',
  ireland: 'IE',
  irlande: 'IE',
  kuwait: 'KW',
  koweït: 'KW',
  malaysia: 'MY',
  malaisie: 'MY',
  malta: 'MT',
  malte: 'MT',
  mauritius: 'MU',
  'île maurice': 'MU',
  'ile maurice': 'MU',
  mexico: 'MX',
  mexique: 'MX',
  monaco: 'MC',
  montenegro: 'ME',
  monténégro: 'ME',
  netherlands: 'NL',
  'pays-bas': 'NL',
  philippines: 'PH',
  portugal: 'PT',
  'puerto rico': 'PR',
  'porto rico': 'PR',
  qatar: 'QA',
  rwanda: 'RW',
  'saint vincent and the grenadines': 'VC',
  'saudi arabia': 'SA',
  'arabie saoudite': 'SA',
  seychelles: 'SC',
  singapore: 'SG',
  singapour: 'SG',
  'south korea': 'KR',
  corée: 'KR',
  'corée du sud': 'KR',
  'st barts': 'BL',
  'saint-barthélemy': 'BL',
  'saint barthelemy': 'BL',
  switzerland: 'CH',
  suisse: 'CH',
  thailand: 'TH',
  thaïlande: 'TH',
  thailande: 'TH',
  turkey: 'TR',
  turquie: 'TR',
  'turks & caicos': 'TC',
  'turks and caicos': 'TC',
  'united kingdom': 'GB',
  'royaume-uni': 'GB',
  uk: 'GB',
  vietnam: 'VN',
  // ─── MICHELIN Keys 2025 expansion (additional countries) ─────────────────
  // Added 2026-05-29 to support `fetch-michelin-keys.ts`. ISO 3166-1 alpha-2.
  // Only entries NOT already covered by the Original or Forbes blocks above.
  chile: 'CL',
  chili: 'CL',
  peru: 'PE',
  pérou: 'PE',
  perou: 'PE',
  namibia: 'NA',
  namibie: 'NA',
  croatia: 'HR',
  croatie: 'HR',
  india: 'IN',
  inde: 'IN',
  indonesie: 'ID',
  'sri lanka': 'LK',
  germany: 'DE',
  allemagne: 'DE',
};

function normaliseLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function countryCodeFromLabel(label: string): string {
  const direct = COUNTRY_LABEL_TO_ISO[normaliseLabel(label)];
  if (direct !== undefined) return direct;
  // Multi-country brief? Split on common separators and pick the first
  // segment that resolves. This keeps cross-border itineraries
  // ("Kenya / Afrique du Sud", "France / Italie") usable without forcing
  // the editor to coin a fake aggregate ISO code.
  const segments = label
    .split(/[/&+,]|et\s/iu)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const segment of segments) {
    const found = COUNTRY_LABEL_TO_ISO[normaliseLabel(segment)];
    if (found !== undefined) return found;
  }
  throw new Error(`Unknown destination_country "${label}" — extend country-codes.ts`);
}

/** Brief slugs sometimes differ from DB slugs (ADR-0008 flat slug drift).
 *  Resolved against `public.hotels.slug` on 2026-05-22 via Supabase MCP.
 *  `plaza-athenee-paris` is already the DB slug — no alias needed.
 *
 *  When adding a new alias: first verify the target slug exists in
 *  `public.hotels`. Then re-run `pnpm itineraries:snapshot-hotels` so
 *  the slug→uuid map picks it up. */
export const HOTEL_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'ritz-paris': 'hotel-ritz-paris',
  'hotel-de-crillon': 'hotel-de-crillon-a-rosewood-hotel',
  // Paris
  'four-seasons-george-v': 'four-seasons-hotel-george-v',
  // Côte d'Azur
  'grand-hotel-du-cap-ferrat': 'grand-hotel-cap-ferrat',
  'la-chevre-d-or': 'chateau-de-la-chevre-d-or',
  // Provence
  'oustau-de-baumaniere': 'baumaniere-les-baux-de-provence',
  'crillon-le-brave': 'hotel-crillon-le-brave',
  // Champagne
  'royal-champagne': 'le-royal-champagne-hotel-spa',
  // Lyon
  'intercontinental-lyon-grand-hotel-dieu': 'intercontinental-lyon-hotel-dieu',
  // Pays Basque
  brindos: 'brindos-lac-and-chateau',
  // Toscane
  'belmond-castello-di-casole': 'castello-di-casole-a-belmond-hotel',
  // Venise (terminus Orient Express)
  'belmond-hotel-cipriani': 'hotel-cipriani',
  // Bali (Jimbaran)
  'four-seasons-jimbaran': 'four-seasons-resort-bali-at-jimbaran-bay',
};

export function resolveHotelSlugHint(hint: string): string {
  return HOTEL_SLUG_ALIASES[hint] ?? hint;
}
