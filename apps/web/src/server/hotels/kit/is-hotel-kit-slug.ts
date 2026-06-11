/**
 * Pilot slugs rendered with the DA kit shell (`mch-kit hotel-page`) + full data stack.
 * Keep in sync with `scripts/editorial-pilot/src/hotels/kit-fiche-acceptance-gates.ts`.
 * PO acceptance gates D15–D19 apply to every slug listed here.
 */
export const HOTEL_KIT_SLUGS = [
  'les-airelles-gordes',
  'les-airelles-gordes-en',
  'prince-de-galles-paris',
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

export type HotelKitSlug = (typeof HOTEL_KIT_SLUGS)[number];

export function isHotelKitSlug(slug: string): slug is HotelKitSlug {
  return (HOTEL_KIT_SLUGS as readonly string[]).includes(slug);
}
