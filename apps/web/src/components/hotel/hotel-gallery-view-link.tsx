'use client';

import type { ReactElement } from 'react';

import { GALLERY_CATEGORY_FILTER_EVENT } from './hotel-gallery-trigger';

interface HotelGalleryViewPhotosLinkProps {
  readonly label: string;
}

/**
 * Opens the hotel gallery lightbox filtered on the "Vue" category.
 * Decoupled from the gallery RSC island via a window CustomEvent.
 */
export function HotelGalleryViewPhotosLink({
  label,
}: HotelGalleryViewPhotosLinkProps): ReactElement {
  const handleClick = (): void => {
    window.dispatchEvent(
      new CustomEvent(GALLERY_CATEGORY_FILTER_EVENT, {
        detail: { category: 'vue' },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-accent hover:text-fg focus-visible:ring-accent/50 mt-2 cursor-pointer text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      {label}
    </button>
  );
}
