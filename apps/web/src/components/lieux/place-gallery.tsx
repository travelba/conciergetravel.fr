import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import {
  PLACE_GALLERY_HEIGHT,
  PLACE_GALLERY_TRANSFORM,
  PLACE_GALLERY_WIDTH,
  type PlaceGalleryImage,
} from '@/server/places/place-view';

interface PlaceGalleryProps {
  readonly images: readonly PlaceGalleryImage[];
  /** Cloudinary cloud name (resolved from env in the page; '' disables). */
  readonly cloudName: string;
  readonly heading: string;
}

/**
 * Responsive photo gallery for a place fiche (`places.gallery_images`).
 *
 * - Mobile-first 2-col grid → 3-col from `lg`.
 * - Delegates to `<HotelImage>` (`next/image` + Cloudinary delivery) so the
 *   tiles share the catalogue's transform presets and intrinsic sizing.
 * - Every tile is `loading="lazy"` (the hero above keeps `priority`); the
 *   delivered transform (`PLACE_GALLERY_TRANSFORM`) matches the
 *   width/height passed to `next/image` and the JSON-LD `ImageObject`
 *   dimensions (Hard Rule 16).
 * - Self-elides when there is no gallery or no Cloudinary cloud name.
 */
export function PlaceGallery({
  images,
  cloudName,
  heading,
}: PlaceGalleryProps): ReactElement | null {
  if (images.length === 0 || cloudName.length === 0) return null;
  return (
    <section aria-labelledby="gallery-heading" className="mt-12">
      <h2 id="gallery-heading" className="text-2xl font-semibold tracking-tight">
        {heading}
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {images.map((img) => (
          <li key={img.publicId} className="overflow-hidden rounded-lg">
            <HotelImage
              cloudName={cloudName}
              publicId={img.publicId}
              alt={img.alt}
              width={PLACE_GALLERY_WIDTH}
              height={PLACE_GALLERY_HEIGHT}
              variant="card"
              transforms={PLACE_GALLERY_TRANSFORM}
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="aspect-[4/3] h-full w-full"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
