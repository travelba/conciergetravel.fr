import type { Metadata } from 'next';

import type { Locale } from '@/i18n/routing';
import { buildCloudinarySrc } from '@mch/ui';

type HotelOgImage = {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly type: 'image/jpeg';
};

/** JSON-LD FAQPage cap — full FAQ stays in HTML for GEO; schema stays lean. */
export const HOTEL_JSON_LD_FAQ_MAX = 20;

const OG_IMAGE_TRANSFORMS = 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630';

export function pickHotelJsonLdFaqEntries<
  T extends { readonly question: string; readonly answer: string },
>(entries: readonly T[], max = HOTEL_JSON_LD_FAQ_MAX): T[] {
  return entries.slice(0, max);
}

export function buildHotelOgImageUrl(cloudName: string, publicId: string): string {
  return buildCloudinarySrc({
    cloudName,
    publicId,
    transforms: OG_IMAGE_TRANSFORMS,
  });
}

export function buildHotelOgImages(
  cloudName: string,
  publicId: string,
  alt: string,
): HotelOgImage[] {
  const url = buildHotelOgImageUrl(cloudName, publicId);
  return [{ url, width: 1200, height: 630, alt, type: 'image/jpeg' }];
}

/** Google Discover + long AI snippets — indexable hotel fiches only. */
export function buildHotelDiscoverRobots(isStub: boolean): Metadata['robots'] | undefined {
  if (isStub) return { index: false, follow: true };
  return {
    googleBot: {
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  };
}

export function buildHotelOpenGraphAlternates(locale: Locale): readonly string[] {
  const other = locale === 'fr' ? 'en_US' : 'fr_FR';
  return [other];
}

/**
 * When the hotel name already embeds the city ("Airelles Gordes, La Bastide"),
 * prefer district/region in the title slot to avoid "Gordes … Gordes".
 */
export function resolveHotelTitleLocation(params: {
  readonly name: string;
  readonly city: string;
  readonly district: string;
  readonly region: string;
}): string {
  const nameLower = params.name.toLowerCase();
  const cityLower = params.city.toLowerCase();
  if (!nameLower.includes(cityLower)) return params.city;

  const district = params.district.trim();
  if (district.length > 0 && !district.toLowerCase().includes(cityLower)) {
    return district;
  }
  const region = params.region.trim();
  if (region.length > 0) return region;
  return params.city;
}

export function buildHotelSeoTitle(params: {
  readonly name: string;
  readonly city: string;
  readonly district: string;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: number;
  readonly locale: 'fr' | 'en';
}): string {
  const location = resolveHotelTitleLocation(params);
  const category = params.isPalace
    ? 'Palace'
    : params.locale === 'en'
      ? `${params.stars}★ Hotel`
      : `Hôtel ${params.stars}★`;
  return `${params.name} — ${category} ${location} | MyConciergeHotel`;
}

/** FR room/gallery alts — replace anglicism "Deluxe Valley" with "Deluxe Vallée". */
export function normalizeHotelImageAltFr(alt: string): string {
  return alt.replace(/\bDeluxe Valley\b/giu, 'Deluxe Vallée');
}
