import type { Metadata } from 'next';

import type { Locale } from '@/i18n/routing';
import { buildCloudinarySrc } from '@mch/ui';

import { DEFAULT_OG_IMAGE } from './og-defaults';

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

/**
 * Open Graph / Twitter image fallback chain — guarantees a NON-empty
 * `og:image` on EVERY hotel fiche, including the handful (4 at 2026-06-29)
 * that carry zero photos. A page-level `openGraph` object fully overrides
 * the root layout's default `images` (Next.js does NOT deep-merge it), so a
 * photo-less fiche would otherwise emit zero `og:image` — not even the brand
 * card the layout intends as the floor.
 *
 * Cascade:
 *   1. hero photo (Cloudinary, OG-cropped 1200×630)            ┐ a real
 *   2. first gallery photo (when the row has no `hero_image`)  ┘ property shot
 *   3. site brand card `/og/default.jpg` (absolute via `origin`, 1200×630)
 */
export function resolveHotelOgImages(params: {
  readonly cloudName: string;
  readonly heroPublicId: string | null;
  readonly fallbackGalleryPublicId: string | null;
  readonly alt: string;
  readonly origin: string;
}): HotelOgImage[] {
  const { cloudName, heroPublicId, fallbackGalleryPublicId, alt, origin } = params;
  const publicId = heroPublicId ?? fallbackGalleryPublicId;
  if (publicId !== null) {
    return buildHotelOgImages(cloudName, publicId, alt);
  }
  return [
    {
      url: `${origin}${DEFAULT_OG_IMAGE.url}`,
      width: DEFAULT_OG_IMAGE.width,
      height: DEFAULT_OG_IMAGE.height,
      alt,
      type: DEFAULT_OG_IMAGE.type,
    },
  ];
}

/** Absolute URL of the site brand-card OG image (the zero-photo JSON-LD floor). */
export function buildDefaultOgImageUrl(origin: string): string {
  return `${origin}${DEFAULT_OG_IMAGE.url}`;
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
