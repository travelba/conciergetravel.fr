import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedGalleryImage } from '@/server/hotels/get-hotel-by-slug';

import { HotelGalleryLightbox, type GalleryLightboxImage } from './hotel-gallery-lightbox';
import { HotelImagePlaceholder } from './hotel-image-placeholder';

interface HotelGalleryProps {
  readonly locale: SupportedLocale;
  readonly cloudName: string;
  readonly hero: {
    readonly publicId: string;
    readonly alt: string;
    readonly caption?: string | null;
  } | null;
  readonly images: readonly LocalisedGalleryImage[];
  readonly hotelName: string;
  /**
   * Golden-template fiche: hide the inline mosaic and keep only the lightbox
   * (opened from the hero header "Voir les photos" trigger). See
   * `<HotelGalleryLightbox>` `hideGrid`.
   */
  readonly hideGrid?: boolean;
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
/**
 * C4 — cap the *visible* thumbnail grid at 11 tiles (6 above the fold,
 * 5 lazy-loaded on scroll). Anything beyond is reachable through the
 * "+N" overflow chip on the 11th tile and the lightbox iterates the
 * full 30+ photo set. Cap is empirical: tested on iPhone 12 mini
 * (2-column grid) and 27" desktop (6-column grid), both stay under
 * 2 vertical rows before requiring scroll.
 *
 * CDC §2 bloc 2 mandates ≥ 30 photos at the publication gate; this
 * grid surfaces the strongest 11 while the lightbox honours the full
 * catalogue without bandwidth penalty (thumbnails use `c_thumb,w_400`).
 */
const MAX_THUMBNAILS = 11;
const PLACEHOLDER_MOSAIC_TILES = 4;

export async function HotelGallery({
  locale,
  cloudName,
  hero,
  images,
  hotelName,
  hideGrid = false,
}: HotelGalleryProps): Promise<React.ReactElement | null> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  if (hero === null && images.length === 0) {
    // Nothing to show and no lightbox content — render nothing (golden
    // template never wants the placeholder mosaic).
    if (hideGrid) return null;
    return (
      <section
        aria-label={t('gallery.thumbnailsLabel')}
        className="mb-16 grid h-auto grid-cols-1 gap-1 md:h-[500px] md:grid-cols-4 md:grid-rows-2"
        data-gallery-layout="mosaic-placeholder"
      >
        <HotelImagePlaceholder
          variant="hero"
          hotelName={hotelName}
          className="min-h-[240px] md:col-span-2 md:row-span-2 md:min-h-0 md:rounded-none"
        />
        {Array.from({ length: PLACEHOLDER_MOSAIC_TILES }).map((_, idx) => (
          <HotelImagePlaceholder
            key={idx}
            variant="thumbnail"
            hotelName={hotelName}
            className="hidden min-h-0 md:block md:rounded-none"
          />
        ))}
      </section>
    );
  }

  // C4 — visible grid stays capped at 11 tiles; the lightbox receives
  // the full image set so navigation cycles through the entire CDC §2
  // ≥ 30-photo corpus without forcing a 30-tile grid on initial load.
  const thumbnails: readonly GalleryLightboxImage[] = images
    .slice(0, MAX_THUMBNAILS)
    .map((img) => ({ publicId: img.publicId, alt: img.alt, caption: img.caption }));
  const allLightboxImages: readonly GalleryLightboxImage[] = images.map((img) => ({
    publicId: img.publicId,
    alt: img.alt,
    caption: img.caption,
  }));
  const overflowCount = Math.max(0, images.length - MAX_THUMBNAILS);
  const galleryTotal = (hero !== null ? 1 : 0) + allLightboxImages.length;

  return (
    <HotelGalleryLightbox
      cloudName={cloudName}
      layout="mosaic"
      hero={hero}
      thumbnails={thumbnails}
      lightboxImages={allLightboxImages}
      overflowCount={overflowCount}
      hideGrid={hideGrid}
      translations={{
        thumbnailsLabel: t('gallery.thumbnailsLabel'),
        openLightbox: t('gallery.openLightbox'),
        lightboxLabel: t('gallery.lightboxLabel'),
        previousImage: t('gallery.previousImage'),
        nextImage: t('gallery.nextImage'),
        closeLightbox: t('gallery.closeLightbox'),
        mosaicEyebrow: t('gallery.mosaicEyebrow'),
        mosaicCountLabel: t('gallery.mosaicCount', { count: galleryTotal }),
        backToGallery: t('gallery.backToGallery'),
        // Pass the raw ICU template — interpolated client-side because a
        // closure cannot cross the RSC boundary (Next 15.3 throws
        // "Functions cannot be passed directly to Client Components").
        lightboxCounterTemplate: t.raw('gallery.lightboxCounter') as string,
      }}
    />
  );
}
