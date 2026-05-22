const COUNTRY_LABEL_TO_ISO: Readonly<Record<string, string>> = {
  France: 'FR',
  Japon: 'JP',
  Japan: 'JP',
  Italie: 'IT',
  Italy: 'IT',
  Maroc: 'MA',
  Morocco: 'MA',
  Espagne: 'ES',
  Spain: 'ES',
  'Émirats arabes unis': 'AE',
  'United Arab Emirates': 'AE',
  Maldives: 'MV',
  'États-Unis': 'US',
  'United States': 'US',
  Kenya: 'KE',
  'Afrique du Sud': 'ZA',
  'South Africa': 'ZA',
  Indonésie: 'ID',
  Indonesia: 'ID',
};

export function countryCodeFromLabel(label: string): string {
  const direct = COUNTRY_LABEL_TO_ISO[label.trim()];
  if (direct !== undefined) return direct;
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
