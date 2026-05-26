'use client';

import { HotelImage } from '@mch/ui';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface GalleryLightboxImage {
  readonly publicId: string;
  readonly alt: string;
}

type GalleryLayout = 'default' | 'mosaic';

interface HotelGalleryLightboxProps {
  readonly cloudName: string;
  readonly layout?: GalleryLayout;
  readonly hero: GalleryLightboxImage | null;
  /** Visible grid tiles (≤ 11 — see `MAX_THUMBNAILS` in the RSC wrapper). */
  readonly thumbnails: readonly GalleryLightboxImage[];
  /**
   * C4 — full image catalogue used by the lightbox cycle. When omitted
   * (legacy callers), the lightbox falls back to `thumbnails`. When set,
   * the lightbox navigates the entire CDC §2 ≥ 30-photo set even though
   * only `thumbnails.length` tiles are visible above the fold.
   */
  readonly lightboxImages?: readonly GalleryLightboxImage[];
  readonly overflowCount: number;
  readonly translations: {
    readonly thumbnailsLabel: string;
    readonly openLightbox: string;
    readonly lightboxLabel: string;
    /**
     * Template containing `{current}` and `{total}` placeholders (the raw
     * ICU message), interpolated client-side. We pass the template instead
     * of a closure so the prop stays serialisable across the RSC boundary
     * — Next 15 rejects function props from a Server Component.
     */
    readonly lightboxCounterTemplate: string;
    readonly previousImage: string;
    readonly nextImage: string;
    readonly closeLightbox: string;
  };
}

/**
 * Client island for the hotel detail page gallery (CDC §2 bloc 2 polish).
 *
 * Renders the same SSR-friendly layout as the prior pure-RSC implementation
 * (hero + 2-to-6 thumbnail grid + "+N" overflow chip) BUT each tile is now
 * a `<button>` that opens a native `<dialog>` lightbox at the matching
 * index.
 *
 * Why a client island
 * -------------------
 * The hero `<HotelImage>` keeps `priority` so it stays the LCP candidate and
 * is delivered in the initial HTML — the JS bundle only adds interactivity
 * on hydration. Bundle delta measured locally ≈ 3 KB (gzipped) including
 * the dialog logic.
 *
 * Lightbox UX
 * -----------
 * - Native `<dialog>` via `showModal()` — backdrop, ESC-to-close, focus
 *   trap and a11y semantics are all handled by the platform.
 * - `aria-modal=true` + labelled by an off-screen `<h2>`.
 * - Arrow keys (←/→) navigate, Escape closes. Click on backdrop closes.
 * - Counter "n / total" announced via `aria-live="polite"`.
 * - Cloudinary transforms target a max 1600×1067 frame (3:2) — generous
 *   enough for ≥27" desktop but bandwidth-bounded vs the raw 3840 px
 *   originals, capped with `c_limit` so portrait shots aren't cropped.
 *
 * Accessibility (skill: accessibility)
 * ------------------------------------
 * - Triggers are real `<button>` elements with `aria-label` describing
 *   the action ("View larger photo: <alt>").
 * - Navigation buttons inside the dialog have descriptive aria-labels and
 *   become focusable only when the dialog is open.
 * - `Tab` cycles between Prev / Image / Next / Close — focus stays inside
 *   the dialog because `<dialog showModal>` natively traps focus.
 */
const MAX_DIALOG_TRANSFORMS = 'f_auto,q_auto:good,c_limit,w_1600,h_1067';

/** Stitch hotel-detail mosaic — hero 2×2 + four tiles on the right (desktop). */
const MOSAIC_SIDE_TILES = 4;

export function HotelGalleryLightbox({
  cloudName,
  layout = 'default',
  hero,
  thumbnails,
  lightboxImages,
  overflowCount,
  translations,
}: HotelGalleryLightboxProps): React.ReactElement {
  // C4 — the lightbox cycles through the full set (≥ 30 when available),
  // while the visible grid stays capped. When `lightboxImages` is set,
  // we honour the full catalogue; otherwise we mirror the visible grid
  // for backwards compatibility with any other caller.
  const allImages = useMemo<readonly GalleryLightboxImage[]>(() => {
    const base = lightboxImages ?? thumbnails;
    return hero !== null ? [hero, ...base] : base;
  }, [hero, lightboxImages, thumbnails]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const total = allImages.length;

  const openAt = useCallback(
    (index: number): void => {
      if (index < 0 || index >= total) return;
      setCurrentIndex(index);
      setIsOpen(true);
    },
    [total],
  );

  const close = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const goPrev = useCallback((): void => {
    if (total === 0) return;
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback((): void => {
    if (total === 0) return;
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  // Sync the React `isOpen` state with the native <dialog> show/close API.
  // Direct DOM calls are required because <dialog> has no controlled prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Keyboard navigation while the dialog is mounted and open.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, isOpen]);

  // Close when the user clicks the backdrop. The native dialog reports
  // backdrop clicks as a click on the <dialog> element itself with the
  // event target equal to the dialog (not a child).
  const onBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) close();
    },
    [close],
  );

  const current = total > 0 ? allImages[currentIndex] : undefined;

  const mosaicTiles = thumbnails.slice(0, MOSAIC_SIDE_TILES);
  const mosaicOverflowOnLast =
    mosaicTiles.length === MOSAIC_SIDE_TILES &&
    (overflowCount > 0 || thumbnails.length > MOSAIC_SIDE_TILES);

  const renderTileButton = (
    img: GalleryLightboxImage,
    galleryIndex: number,
    opts: {
      readonly showOverflow?: boolean;
      readonly overflowCountLabel?: number;
      readonly className?: string;
      readonly imageClassName?: string;
      readonly priority?: boolean;
      readonly width?: number;
      readonly height?: number;
      readonly variant?: 'hero' | 'thumbnail';
    },
  ): React.ReactElement => (
    <button
      type="button"
      className={
        opts.className ??
        `focus-visible:ring-ring group block h-full w-full focus-visible:outline-none focus-visible:ring-2${opts.showOverflow === true ? 'relative' : ''}`
      }
      onClick={() => openAt(galleryIndex)}
      aria-label={`${translations.openLightbox} : ${img.alt}`}
    >
      <HotelImage
        cloudName={cloudName}
        publicId={img.publicId}
        alt={img.alt}
        width={opts.width ?? 400}
        height={opts.height ?? 400}
        variant={opts.variant ?? 'thumbnail'}
        priority={opts.priority ?? false}
        className={
          opts.imageClassName ??
          'h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
        }
      />
      {opts.showOverflow === true && (opts.overflowCountLabel ?? 0) > 0 ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-medium text-white"
        >
          +{opts.overflowCountLabel}
        </span>
      ) : null}
    </button>
  );

  return (
    <section aria-labelledby="gallery-title" className="mb-16">
      <h2 id="gallery-title" className="sr-only">
        {translations.lightboxLabel}
      </h2>

      {layout === 'mosaic' && hero !== null ? (
        <div
          className="grid h-auto grid-cols-1 gap-1 md:h-[500px] md:grid-cols-4 md:grid-rows-2"
          data-gallery-layout="mosaic"
        >
          <figure className="relative min-h-[240px] overflow-hidden md:col-span-2 md:row-span-2 md:min-h-0">
            {renderTileButton(hero, 0, {
              priority: true,
              width: 1600,
              height: 1067,
              variant: 'hero',
            })}
          </figure>
          {mosaicTiles.map((img, idx) => {
            const galleryIndex = idx + 1;
            const isLast = idx === mosaicTiles.length - 1;
            const overflowLabel =
              isLast && mosaicOverflowOnLast
                ? overflowCount + Math.max(0, thumbnails.length - MOSAIC_SIDE_TILES)
                : 0;
            return (
              <figure
                key={img.publicId}
                className="relative hidden min-h-0 overflow-hidden md:block"
              >
                {renderTileButton(img, galleryIndex, {
                  showOverflow: isLast && overflowLabel > 0,
                  overflowCountLabel: overflowLabel,
                })}
              </figure>
            );
          })}
        </div>
      ) : null}

      {(layout === 'default' || (layout === 'mosaic' && hero === null)) && hero !== null ? (
        <figure className="relative aspect-[16/9] overflow-hidden rounded-lg">
          {renderTileButton(hero, 0, {
            priority: true,
            width: 1600,
            height: 900,
            variant: 'hero',
            imageClassName:
              'h-full w-full transition-transform duration-300 group-hover:scale-[1.01]',
          })}
        </figure>
      ) : null}

      {(layout === 'default' || (layout === 'mosaic' && hero === null)) && thumbnails.length > 0 ? (
        <ul
          aria-label={translations.thumbnailsLabel}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6"
        >
          {thumbnails.map((img, idx) => {
            const isOverflowSlot = idx === thumbnails.length - 1 && overflowCount > 0;
            const galleryIndex = hero !== null ? idx + 1 : idx;
            return (
              <li key={img.publicId} className="relative aspect-square overflow-hidden rounded-md">
                {renderTileButton(img, galleryIndex, {
                  showOverflow: isOverflowSlot,
                  overflowCountLabel: overflowCount,
                })}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* The dialog has explicit keyboard paths (Escape closes natively, the
          on-screen ✕ button, and global arrow-key handler); the onClick here
          only adds the optional backdrop-click-to-close convenience.
          (eslint-config-next 16 no longer flags these jsx-a11y rules on
          <dialog>, so the previous disable directive was removed.) */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        onClose={close}
        onClick={onBackdropClick}
        className="w-full max-w-5xl rounded-lg bg-black/95 p-0 text-white backdrop:bg-black/80"
      >
        <h2 id={titleId} className="sr-only">
          {translations.lightboxLabel}
        </h2>

        {current !== undefined ? (
          <div className="relative">
            <div className="relative aspect-[3/2] w-full">
              <HotelImage
                cloudName={cloudName}
                publicId={current.publicId}
                alt={current.alt}
                width={1600}
                height={1067}
                transforms={MAX_DIALOG_TRANSFORMS}
                sizes="(max-width: 768px) 100vw, 80vw"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <button
                type="button"
                onClick={goPrev}
                className="focus-visible:ring-ring rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                aria-label={translations.previousImage}
                disabled={total <= 1}
              >
                ←
              </button>
              <p aria-live="polite" className="text-white/80">
                {translations.lightboxCounterTemplate
                  .replace('{current}', String(currentIndex + 1))
                  .replace('{total}', String(total))}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="focus-visible:ring-ring rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                  aria-label={translations.nextImage}
                  disabled={total <= 1}
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="focus-visible:ring-ring rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                  aria-label={translations.closeLightbox}
                >
                  ✕
                </button>
              </div>
            </div>

            <p className="px-4 pb-4 text-sm text-white/70">{current.alt}</p>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
