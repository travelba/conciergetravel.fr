import { pickBestViewGalleryImage } from '@mch/domain/photos';

import type { LocalisedGalleryImage } from '@/server/hotels/get-hotel-by-slug';

export interface HotelGalleryHeroDescriptor {
  readonly publicId: string;
  readonly alt: string;
  readonly caption: string | null;
  readonly category?: string | null;
}

export interface BuildHotelGalleryViewModelInput {
  readonly heroPublicId: string | null;
  readonly galleryImages: readonly LocalisedGalleryImage[];
  readonly hotelName: string;
  /**
   * Golden-template fiches render `heroPublicId` as a full-bleed overlay hero
   * above the gallery. The inline mosaic then promotes the best remaining view
   * shot (never duplicates the overlay asset).
   */
  readonly omitOverlayHeroFromMosaic?: boolean;
}

export interface HotelGalleryViewModel {
  readonly hero: HotelGalleryHeroDescriptor | null;
  readonly gridImages: readonly LocalisedGalleryImage[];
}

/**
 * Canonical hero + grid split for `<HotelGallery>` on every hotel fiche.
 * Kit pilots and legacy CDC pages share this view model (Airelles mosaic spec).
 */
export function buildHotelGalleryViewModel(
  input: BuildHotelGalleryViewModelInput,
): HotelGalleryViewModel {
  const { heroPublicId, galleryImages, hotelName, omitOverlayHeroFromMosaic = false } = input;

  const galleryWithoutOverlayHero =
    heroPublicId !== null
      ? galleryImages.filter((g) => g.publicId !== heroPublicId)
      : [...galleryImages];

  if (omitOverlayHeroFromMosaic) {
    const mosaicLead = pickBestViewGalleryImage(galleryWithoutOverlayHero);
    if (mosaicLead === undefined) {
      return { hero: null, gridImages: galleryWithoutOverlayHero };
    }
    return {
      hero: {
        publicId: mosaicLead.publicId,
        alt: mosaicLead.alt,
        caption: mosaicLead.caption,
        category: mosaicLead.category ?? 'view',
      },
      gridImages: galleryWithoutOverlayHero.filter((g) => g.publicId !== mosaicLead.publicId),
    };
  }

  const heroGalleryMatch =
    heroPublicId !== null ? galleryImages.find((g) => g.publicId === heroPublicId) : undefined;

  if (heroPublicId !== null) {
    return {
      hero: {
        publicId: heroPublicId,
        alt: heroGalleryMatch?.alt ?? hotelName,
        caption: heroGalleryMatch?.caption ?? null,
        category: heroGalleryMatch?.category ?? 'exterior',
      },
      gridImages: galleryWithoutOverlayHero,
    };
  }

  const fallbackLead = galleryImages[0];
  if (fallbackLead === undefined) {
    return { hero: null, gridImages: [] };
  }

  return {
    hero: {
      publicId: fallbackLead.publicId,
      alt: fallbackLead.alt,
      caption: fallbackLead.caption,
      category: fallbackLead.category ?? 'exterior',
    },
    gridImages: galleryImages.length > 1 ? galleryImages.slice(1) : [],
  };
}
