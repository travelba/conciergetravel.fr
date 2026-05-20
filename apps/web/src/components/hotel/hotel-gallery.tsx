import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedGalleryImage } from '@/server/hotels/get-hotel-by-slug';

import { HotelGalleryLightbox, type GalleryLightboxImage } from './hotel-gallery-lightbox';
import { HotelImagePlaceholder } from './hotel-image-placeholder';

interface HotelGalleryProps {
  readonly locale: SupportedLocale;
  readonly cloudName: string;
  readonly hero: { readonly publicId: string; readonly alt: string } | null;
  readonly images: readonly LocalisedGalleryImage[];
  readonly hotelName: string;
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
 *
 * Placeholder fallback (CDC §2 bloc 2 + skills/responsive-ui-architecture)
 * ------------------------------------------------------------------------
 * Hotels with full editorial content but no Cloudinary uploads yet (the
 * 239 `needs_publish_gates` bucket) used to render an empty section. We
 * now drop a sober `<HotelImagePlaceholder>` hero+grid so the layout
 * stays stable and the rest of the fiche (sections, FAQ, concierge
 * advice) still has a visual anchor. Real photos overwrite this slot
 * later via the standard `gallery_images` flow.
 */
const MAX_THUMBNAILS = 6;
const PLACEHOLDER_THUMBNAILS = 5;

export async function HotelGallery({
  locale,
  cloudName,
  hero,
  images,
  hotelName,
}: HotelGalleryProps): Promise<React.ReactElement | null> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  if (hero === null && images.length === 0) {
    return (
      <section aria-label={t('gallery.thumbnailsLabel')} className="grid gap-3 md:grid-cols-3">
        <HotelImagePlaceholder
          variant="hero"
          hotelName={hotelName}
          className="md:col-span-2 md:row-span-2"
        />
        {Array.from({ length: PLACEHOLDER_THUMBNAILS }).map((_, idx) => (
          <HotelImagePlaceholder key={idx} variant="thumbnail" hotelName={hotelName} />
        ))}
      </section>
    );
  }

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
