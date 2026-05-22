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
 *  `plaza-athenee-paris` is already the DB slug — no alias needed. */
export const HOTEL_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'ritz-paris': 'hotel-ritz-paris',
  'hotel-de-crillon': 'hotel-de-crillon-a-rosewood-hotel',
};

export function resolveHotelSlugHint(hint: string): string {
  return HOTEL_SLUG_ALIASES[hint] ?? hint;
}
