/** Pilot slugs rendered with the DA kit shell (`mch-kit hotel-page`) + full data stack. */
export const HOTEL_KIT_SLUGS = ['les-airelles-gordes', 'les-airelles-gordes-en'] as const;

export type HotelKitSlug = (typeof HOTEL_KIT_SLUGS)[number];

export function isHotelKitSlug(slug: string): slug is HotelKitSlug {
  return (HOTEL_KIT_SLUGS as readonly string[]).includes(slug);
}
