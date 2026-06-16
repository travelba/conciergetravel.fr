import { env } from '@/lib/env';

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
  'conrad-los-angeles',
] as const;

export type HotelKitSlug = (typeof HOTEL_KIT_SLUGS)[number];

/**
 * Post-Airelles template validation batch — walk FR+EN before flipping
 * `MCH_HOTEL_KIT_CATALOGUE_ROLLOUT`. Excludes Gordes (reference) + Courchevel / Prés
 * (regional wave-5 cohort).
 */
export const HOTEL_KIT_VALIDATE_BATCH_SLUGS = [
  'prince-de-galles-paris',
  'cheval-blanc-paris',
  'le-bristol-paris',
  'shangri-la-paris',
] as const;

export type HotelKitValidateBatchSlug = (typeof HOTEL_KIT_VALIDATE_BATCH_SLUGS)[number];

export function isHotelKitSlug(slug: string): slug is HotelKitSlug {
  return (HOTEL_KIT_SLUGS as readonly string[]).includes(slug);
}

export function isHotelKitValidateBatchSlug(slug: string): slug is HotelKitValidateBatchSlug {
  return (HOTEL_KIT_VALIDATE_BATCH_SLUGS as readonly string[]).includes(slug);
}

export function isHotelKitCatalogueRolloutEnabled(): boolean {
  return env.MCH_HOTEL_KIT_CATALOGUE_ROLLOUT;
}

/** Whether the hotel page should render `HotelPageKit` (pilots + optional catalogue rollout). */
export function shouldRenderHotelKitPage(slug: string, isPublished: boolean): boolean {
  if (!isPublished) return false;
  if (isHotelKitSlug(slug)) return true;
  return isHotelKitCatalogueRolloutEnabled();
}
