'use client';

import type { ReactElement } from 'react';

/**
 * Window event broadcast by {@link HotelGalleryTrigger} and listened to by
 * `<HotelGalleryLightbox>`. Decouples the (server-rendered) hero header from
 * the gallery client island without prop-drilling a shared store: the header
 * fires the event, the lightbox opens at the requested index.
 */
export const GALLERY_OPEN_EVENT = 'mch:open-hotel-gallery';

/**
 * `mode` decides which view the gallery dialog opens on:
 * - `'grid'` (default for the hero "Voir les photos" trigger) → the full
 *   luxury mosaic of every photo.
 * - `'single'` → the one-photo lightbox positioned at `index`.
 */
export interface GalleryOpenDetail {
  readonly index: number;
  readonly mode?: 'grid' | 'single';
}

interface HotelGalleryTriggerProps {
  readonly label: string;
  /** Total photo count rendered as "(N)" when > 0. */
  readonly count: number | null;
  readonly className?: string;
  /** Index the lightbox should open at when `mode === 'single'`. */
  readonly index?: number;
  /** View to open. Defaults to the mosaic grid (the "Voir les photos" intent). */
  readonly mode?: 'grid' | 'single';
}

/**
 * Inert-friendly button that opens the hotel gallery lightbox from anywhere on
 * the page (currently the golden-template hero header). Dispatches a window
 * `CustomEvent` so it stays a tiny standalone island — no context provider,
 * no shared ref. Falls back to a no-op if the lightbox is not mounted.
 */
export function HotelGalleryTrigger({
  label,
  count,
  className,
  index = 0,
  mode = 'grid',
}: HotelGalleryTriggerProps): ReactElement {
  const handleClick = (): void => {
    window.dispatchEvent(
      new CustomEvent<GalleryOpenDetail>(GALLERY_OPEN_EVENT, { detail: { index, mode } }),
    );
  };

  const text = count !== null && count > 0 ? `${label} (${count})` : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className !== undefined ? `cursor-pointer ${className}` : 'cursor-pointer'}
      aria-label={text}
    >
      <CameraIcon />
      <span>{text}</span>
    </button>
  );
}

function CameraIcon(): ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
      <path
        d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l.7-1.4A1.5 1.5 0 0 1 8.74 4.8h6.52a1.5 1.5 0 0 1 1.34.8l.7 1.4h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
