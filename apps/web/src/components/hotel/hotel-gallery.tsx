import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedGalleryImage } from '@/server/hotels/get-hotel-by-slug';

import { HotelGalleryLightbox, type GalleryLightboxImage } from './hotel-gallery-lightbox';

interface HotelGalleryProps {
  readonly locale: SupportedLocale;
  readonly cloudName: string;
  readonly hero: { readonly publicId: string; readonly alt: string } | null;
  readonly images: readonly LocalisedGalleryImage[];
}

/**
 * Media gallery for the hotel detail page — CDC §2 bloc 2.
 *
 * Server-rendered wrapper that prepares the translations and clamps the
 * thumbnail count, then delegates rendering (including LCP hero, grid and
 * the lightbox dialog) to the `<HotelGalleryLightbox>` client island.
 *
 * Why a thin RSC wrapper
 * ----------------------
 * - Keeps the translation calls server-side (no client bundle of
 *   `next-intl`).
 * - The client island still benefits from SSR so the hero `<HotelImage>`
 *   with `priority` remains the LCP candidate and is delivered in the
 *   initial HTML.
 */
const MAX_THUMBNAILS = 6;

export async function HotelGallery({
  locale,
  cloudName,
  hero,
  images,
}: HotelGalleryProps): Promise<React.ReactElement | null> {
  if (hero === null && images.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const thumbnails: readonly GalleryLightboxImage[] = images
    .slice(0, MAX_THUMBNAILS)
    .map((img) => ({ publicId: img.publicId, alt: img.alt }));
  const overflowCount = Math.max(0, images.length - MAX_THUMBNAILS);

  return (
    <HotelGalleryLightbox
      cloudName={cloudName}
      hero={hero}
      thumbnails={thumbnails}
      overflowCount={overflowCount}
      translations={{
        thumbnailsLabel: t('gallery.thumbnailsLabel'),
        openLightbox: t('gallery.openLightbox'),
        lightboxLabel: t('gallery.lightboxLabel'),
        previousImage: t('gallery.previousImage'),
        nextImage: t('gallery.nextImage'),
        closeLightbox: t('gallery.closeLightbox'),
        // Pass the raw ICU template — interpolated client-side because a
        // closure cannot cross the RSC boundary (Next 15.3 throws
        // "Functions cannot be passed directly to Client Components").
        lightboxCounterTemplate: t.raw('gallery.lightboxCounter') as string,
      }}
    />
  );
}
