'use client';

import { HotelImage } from '@mch/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GALLERY_OPEN_EVENT, type GalleryOpenDetail } from './hotel-gallery-trigger';

export interface GalleryLightboxImage {
  readonly publicId: string;
  readonly alt: string;
  /**
   * Full-sentence editorial caption (localised, `caption_fr/_en`). When
   * present it is burned onto the photo as a luxury overlay (gradient
   * scrim + serif). Falls back to nothing — the `alt` stays on the `<img>`
   * for accessibility regardless.
   */
  readonly caption?: string | null;
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
  /**
   * When `true`, the visible mosaic/grid is NOT rendered — only the (closed)
   * `<dialog>` + its window-event listener stay mounted. Used by the
   * golden-template fiche where photos are reached exclusively through the
   * hero header `<HotelGalleryTrigger>` ("Voir les photos"), so the redundant
   * inline mosaic is dropped without losing the lightbox.
   */
  readonly hideGrid?: boolean;
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
    /** Eyebrow shown atop the full-screen mosaic (e.g. "La galerie"). */
    readonly mosaicEyebrow: string;
    /** Pre-interpolated "N photos" label for the mosaic header. */
    readonly mosaicCountLabel: string;
    /** Back-to-mosaic affordance shown in single-photo view. */
    readonly backToGallery: string;
    /** Hover chip on editorial spread tiles ("Voir en grand"). */
    readonly mosaicViewFull: string;
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

/** Mosaic tile crop — square-ish 4:3 frame, smart-gravity centred. */
const MOSAIC_TILE_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_900,h_675';

const MOSAIC_HERO_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_1200,h_900';

/** Editorial spread — asymmetric magazine rhythm inside the full-gallery dialog. */
const EDITORIAL_LEAD_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_1800,h_720';
const EDITORIAL_PORTRAIT_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_800,h_1000';
const EDITORIAL_PANORAMA_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_1600,h_686';
const EDITORIAL_FEATURE_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_1100,h_733';
const EDITORIAL_ACCENT_TRANSFORMS = 'f_auto,q_auto:good,c_fill,g_auto,w_700,h_933';

/** Inline mosaic — hero spans half the grid on desktop; thumbs ~¼ width. */
const MOSAIC_HERO_SIZES = '(max-width: 768px) 100vw, 50vw';
const MOSAIC_THUMB_SIZES = '(max-width: 768px) 50vw, 25vw';

const EDITORIAL_DIALOG_CLASS =
  'm-0 h-[94vh] w-[98vw] max-w-[1280px] overflow-hidden rounded-lg border border-[#8c7b5a]/20 bg-[#f6f1e7] p-0 text-[#2b2722] shadow-[0_18px_50px_rgba(22,20,15,0.18)] backdrop:bg-[#2b2722]/45';

const EDITORIAL_IMAGE_HOVER_CLASS =
  'absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.04]';

/**
 * Kit `.htl-gallery img` zoom — premium 0.7s editorial easing
 * (`--ease-editorial: cubic-bezier(.2,.7,.2,1)`) + scale-105 on hover, applied
 * to every tile (hero + side) so the inline mosaic matches the HTML kit.
 *
 * `absolute inset-0` keeps the photo flush with the full tile so the entire
 * hover surface is clickable (not just the intrinsic `<img>` box).
 */
const KIT_MOSAIC_IMAGE_CLASS =
  'absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-105';

/** Shared affordance — kit animates zoom on hover; cursor must signal click. */
const GALLERY_TILE_BUTTON_CLASS =
  'focus-visible:ring-ring group relative block h-full w-full min-h-0 cursor-pointer overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2';

/** Lightbox chrome controls (back, close, prev/next). */
const LIGHTBOX_CTRL_CLASS =
  'cursor-pointer focus-visible:ring-ring rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40';

const LIGHTBOX_CLOSE_GRID_CLASS =
  'cursor-pointer shrink-0 border border-[#8c7b5a]/35 bg-[#f6f1e7] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#4a4439] transition-colors hover:bg-[#efe8da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c7b5a]/50';

/** Stitch hotel-detail mosaic — hero 2×2 + four tiles on the right (desktop). */
const MOSAIC_SIDE_TILES = 4;

/**
 * Luxury caption overlay burned onto a gallery photo (CDC §2 bloc 2 polish
 * + photo-quality-seo-geo-agentique — captions are LLM-citable AND a brand
 * signal). A bottom-anchored gradient scrim keeps the serif text legible
 * over any image; a hairline amber rule echoes the Concierge accent used
 * across the fiche (`bg-gold-400/80`). `pointer-events-none` so the
 * overlay never blocks the underlying button/navigation.
 *
 * `reveal="always"` is used on focal photos (single view, mosaic lead);
 * `reveal="hover"` fades the caption in on hover/focus for the smaller
 * mosaic tiles so the grid stays calm at rest.
 */
type EditorialRowKind = 'lead' | 'duo' | 'panorama' | 'split';

interface EditorialRowItem {
  readonly image: GalleryLightboxImage;
  readonly globalIndex: number;
}

interface EditorialRow {
  readonly kind: EditorialRowKind;
  readonly items: readonly EditorialRowItem[];
}

interface EditorialTileSpec {
  readonly aspectClass: string;
  readonly width: number;
  readonly height: number;
  readonly transforms: string;
  readonly sizes: string;
  readonly layoutClass: string;
  readonly captionSize: 'sm' | 'md' | 'lg';
}

/**
 * Magazine spread rhythm (DA `.mosaic` / `.magazine`) — lead shot, portrait
 * pairs, panoramas and asymmetric splits repeat so 30+ photos never feel
 * like a uniform thumbnail grid.
 */
function buildEditorialRows(images: readonly GalleryLightboxImage[]): readonly EditorialRow[] {
  const lead = images[0];
  if (lead === undefined) return [];

  const rows: EditorialRow[] = [{ kind: 'lead', items: [{ image: lead, globalIndex: 0 }] }];

  let index = 1;
  const cycle: readonly EditorialRowKind[] = ['duo', 'panorama', 'split', 'duo', 'panorama'];
  let cyclePos = 0;

  while (index < images.length) {
    const kind = cycle[cyclePos % cycle.length];
    cyclePos += 1;

    if (kind === 'duo') {
      const slice = images.slice(index, index + 2);
      rows.push({
        kind: 'duo',
        items: slice.map((image, offset) => ({ image, globalIndex: index + offset })),
      });
      index += slice.length;
      continue;
    }

    if (kind === 'panorama') {
      const image = images[index];
      if (image === undefined) break;
      rows.push({
        kind: 'panorama',
        items: [{ image, globalIndex: index }],
      });
      index += 1;
      continue;
    }

    const slice = images.slice(index, index + 2);
    if (slice.length === 1) {
      const image = slice[0];
      if (image === undefined) break;
      rows.push({
        kind: 'panorama',
        items: [{ image, globalIndex: index }],
      });
      index += 1;
    } else {
      rows.push({
        kind: 'split',
        items: slice.map((image, offset) => ({ image, globalIndex: index + offset })),
      });
      index += 2;
    }
  }

  return rows;
}

function tileSpecForRow(kind: EditorialRowKind, position: number): EditorialTileSpec {
  if (kind === 'lead') {
    return {
      aspectClass: 'aspect-[5/2] sm:aspect-[2/1]',
      width: 1800,
      height: 720,
      transforms: EDITORIAL_LEAD_TRANSFORMS,
      sizes: '(max-width: 768px) 100vw, 90vw',
      layoutClass: 'w-full',
      captionSize: 'lg',
    };
  }
  if (kind === 'panorama') {
    return {
      aspectClass: 'aspect-[21/9]',
      width: 1600,
      height: 686,
      transforms: EDITORIAL_PANORAMA_TRANSFORMS,
      sizes: '(max-width: 768px) 100vw, 90vw',
      layoutClass: 'w-full',
      captionSize: 'md',
    };
  }
  if (kind === 'duo') {
    return {
      aspectClass: 'aspect-[4/5]',
      width: 800,
      height: 1000,
      transforms: EDITORIAL_PORTRAIT_TRANSFORMS,
      sizes: '(max-width: 768px) 100vw, 45vw',
      layoutClass: 'min-w-0 flex-1',
      captionSize: 'md',
    };
  }
  // split — position 0 = wide feature, 1 = tall accent
  if (position === 0) {
    return {
      aspectClass: 'aspect-[3/2] md:aspect-[3/2]',
      width: 1100,
      height: 733,
      transforms: EDITORIAL_FEATURE_TRANSFORMS,
      sizes: '(max-width: 768px) 100vw, 58vw',
      layoutClass: 'min-w-0 md:flex-[7]',
      captionSize: 'md',
    };
  }
  return {
    aspectClass: 'aspect-[3/4]',
    width: 700,
    height: 933,
    transforms: EDITORIAL_ACCENT_TRANSFORMS,
    sizes: '(max-width: 768px) 100vw, 35vw',
    layoutClass: 'min-w-0 md:flex-[5]',
    captionSize: 'sm',
  };
}

function formatEditorialIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Caption below the frame — magazine spread, not a dark overlay. */
function EditorialSpreadCaption({
  caption,
  index,
  size = 'md',
}: {
  readonly caption: string;
  readonly index: number;
  readonly size?: 'sm' | 'md' | 'lg';
}): React.ReactElement {
  const textSize =
    size === 'lg'
      ? 'text-base sm:text-lg'
      : size === 'sm'
        ? 'text-[13px] sm:text-sm'
        : 'text-sm sm:text-[15px]';
  return (
    <figcaption className="mt-4 border-l-2 border-[#8c7b5a]/45 pl-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#8c7b5a]">
        {formatEditorialIndex(index)}
      </span>
      <p className={`text-[#2b2722]/88 text-pretty font-serif italic leading-snug ${textSize}`}>
        {caption}
      </p>
    </figcaption>
  );
}

function GalleryExpandHint({ label }: { readonly label: string }): React.ReactElement {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-[#2b2722]/55 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/95 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M8 4H4v4M20 16v4h-4M4 16v4h4M20 4h-4v4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}

function GalleryCaptionOverlay({
  caption,
  reveal,
  size = 'md',
}: {
  readonly caption: string;
  readonly reveal: 'always' | 'hover';
  readonly size?: 'sm' | 'md' | 'lg';
}): React.ReactElement {
  const textSize =
    size === 'lg'
      ? 'text-[15px] sm:text-lg'
      : size === 'sm'
        ? 'text-[12px] sm:text-[13px]'
        : 'text-[13px] sm:text-sm';
  return (
    <figcaption
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-14 sm:px-6 sm:pb-5 ${
        reveal === 'hover'
          ? 'opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100'
          : ''
      }`}
    >
      <span aria-hidden className="bg-gold-400/80 mb-2 block h-px w-8" />
      <p className={`text-pretty font-serif leading-snug text-white/95 ${textSize}`}>{caption}</p>
    </figcaption>
  );
}

export function HotelGalleryLightbox({
  cloudName,
  layout = 'default',
  hero,
  thumbnails,
  lightboxImages,
  overflowCount,
  translations,
  hideGrid = false,
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
  // 'grid' = full luxury mosaic of every photo; 'single' = one-photo
  // lightbox with prev/next. The hero "Voir les photos" trigger opens
  // 'grid'; clicking a mosaic tile (or an inline thumbnail) drills into
  // 'single'.
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const total = allImages.length;
  const editorialRows = useMemo(() => buildEditorialRows(allImages), [allImages]);

  const openAt = useCallback(
    (index: number): void => {
      if (index < 0 || index >= total) return;
      setCurrentIndex(index);
      setViewMode('single');
      setIsOpen(true);
    },
    [total],
  );

  const openGrid = useCallback((): void => {
    if (total === 0) return;
    setViewMode('grid');
    setIsOpen(true);
  }, [total]);

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

  // Allow any page-level trigger (e.g. the golden-template hero header
  // `<HotelGalleryTrigger>`) to open the lightbox via a window event,
  // without prop-drilling a shared ref/store across the RSC boundary.
  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<GalleryOpenDetail>).detail;
      if (detail?.mode === 'single') {
        const index = typeof detail.index === 'number' ? detail.index : 0;
        openAt(index < total ? index : 0);
        return;
      }
      // Default ("Voir les photos") → open the full mosaic.
      openGrid();
    };
    window.addEventListener(GALLERY_OPEN_EVENT, handler);
    return () => window.removeEventListener(GALLERY_OPEN_EVENT, handler);
  }, [openAt, openGrid, total]);

  // Keyboard navigation while the dialog is mounted and open.
  useEffect(() => {
    if (!isOpen || viewMode !== 'single') return;
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
  }, [goNext, goPrev, isOpen, viewMode]);

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
      readonly transforms?: string;
      readonly sizes?: string;
    },
  ): React.ReactElement => (
    <button
      type="button"
      className={opts.className ?? GALLERY_TILE_BUTTON_CLASS}
      onClick={() => openAt(galleryIndex)}
      aria-label={`${translations.openLightbox} : ${img.alt}`}
    >
      <HotelImage
        cloudName={cloudName}
        publicId={img.publicId}
        alt={img.alt}
        width={opts.width ?? 600}
        height={opts.height ?? 450}
        variant={opts.variant ?? 'thumbnail'}
        priority={opts.priority ?? false}
        {...(opts.transforms !== undefined ? { transforms: opts.transforms } : {})}
        {...(opts.sizes !== undefined ? { sizes: opts.sizes } : {})}
        className={
          opts.imageClassName ??
          'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
        }
      />
      {opts.showOverflow === true && (opts.overflowCountLabel ?? 0) > 0 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/55 text-base font-medium text-white"
        >
          +{opts.overflowCountLabel}
        </span>
      ) : null}
    </button>
  );

  const renderEditorialTile = (
    item: EditorialRowItem,
    kind: EditorialRowKind,
    position: number,
    priority = false,
  ): React.ReactElement => {
    const spec = tileSpecForRow(kind, position);
    const caption = item.image.caption ?? item.image.alt;
    return (
      <figure key={`${item.image.publicId}-${item.globalIndex}`} className={spec.layoutClass}>
        <button
          type="button"
          onClick={() => openAt(item.globalIndex)}
          aria-label={`${translations.openLightbox} : ${item.image.alt}`}
          className="group block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c7b5a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f1e7]"
        >
          <div
            className={`relative overflow-hidden rounded-lg shadow-[0_10px_30px_rgba(22,20,15,0.1)] ${spec.aspectClass}`}
          >
            <HotelImage
              cloudName={cloudName}
              publicId={item.image.publicId}
              alt={item.image.alt}
              width={spec.width}
              height={spec.height}
              transforms={spec.transforms}
              sizes={spec.sizes}
              priority={priority}
              className={EDITORIAL_IMAGE_HOVER_CLASS}
            />
            <GalleryExpandHint label={translations.mosaicViewFull} />
          </div>
          <EditorialSpreadCaption
            caption={caption}
            index={item.globalIndex}
            size={spec.captionSize}
          />
        </button>
      </figure>
    );
  };

  const renderEditorialRow = (row: EditorialRow, rowIndex: number): React.ReactElement => {
    if (row.kind === 'lead' || row.kind === 'panorama') {
      const item = row.items[0];
      if (item === undefined) return <div key={`row-${rowIndex}`} />;
      return (
        <div key={`row-${rowIndex}`} className="w-full">
          {renderEditorialTile(item, row.kind, 0, rowIndex === 0)}
        </div>
      );
    }
    if (row.kind === 'duo') {
      return (
        <div
          key={`row-${rowIndex}`}
          className="flex flex-col gap-8 md:flex-row md:items-stretch md:gap-6 lg:gap-8"
        >
          {row.items.map((item, position) => renderEditorialTile(item, row.kind, position))}
        </div>
      );
    }
    return (
      <div
        key={`row-${rowIndex}`}
        className="flex flex-col gap-8 md:flex-row md:items-start md:gap-6 lg:gap-8"
      >
        {row.items.map((item, position) => renderEditorialTile(item, row.kind, position))}
      </div>
    );
  };

  return (
    <section aria-labelledby="gallery-title" className={hideGrid ? '' : 'mb-16'}>
      <h2 id="gallery-title" className="sr-only">
        {translations.lightboxLabel}
      </h2>

      {!hideGrid && layout === 'mosaic' && hero !== null ? (
        // Kit `.htl-gallery` mosaic — hero 2×2 left + four rounded tiles, 10px
        // gutter, fixed 440px frame on desktop and the premium 0.7s editorial
        // zoom (DA crème/taupe: `--ease-editorial`). Tailwind mirror of the kit
        // CSS so the client island stays self-contained (no `.mch-kit` wrap).
        <div
          className="grid h-auto grid-cols-1 gap-2.5 md:h-[440px] md:grid-cols-4 md:grid-rows-2"
          data-gallery-layout="mosaic"
        >
          {renderTileButton(hero, 0, {
            className: `${GALLERY_TILE_BUTTON_CLASS} min-h-[240px] md:col-span-2 md:row-span-2 md:min-h-0`,
            priority: true,
            width: 1200,
            height: 900,
            variant: 'hero',
            transforms: MOSAIC_HERO_TRANSFORMS,
            sizes: MOSAIC_HERO_SIZES,
            imageClassName: KIT_MOSAIC_IMAGE_CLASS,
          })}
          {mosaicTiles.map((img, idx) => {
            const galleryIndex = idx + 1;
            const isLast = idx === mosaicTiles.length - 1;
            const overflowLabel =
              isLast && mosaicOverflowOnLast
                ? overflowCount + Math.max(0, thumbnails.length - MOSAIC_SIDE_TILES)
                : 0;
            return (
              <div key={img.publicId} className="relative hidden min-h-0 md:contents">
                {renderTileButton(img, galleryIndex, {
                  className: `${GALLERY_TILE_BUTTON_CLASS} hidden md:block`,
                  showOverflow: isLast && overflowLabel > 0,
                  overflowCountLabel: overflowLabel,
                  width: 900,
                  height: 675,
                  transforms: MOSAIC_TILE_TRANSFORMS,
                  sizes: MOSAIC_THUMB_SIZES,
                  imageClassName: KIT_MOSAIC_IMAGE_CLASS,
                })}
              </div>
            );
          })}
        </div>
      ) : null}

      {!hideGrid &&
      (layout === 'default' || (layout === 'mosaic' && hero === null)) &&
      hero !== null ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
          {renderTileButton(hero, 0, {
            className: `${GALLERY_TILE_BUTTON_CLASS} h-full rounded-lg`,
            priority: true,
            width: 1600,
            height: 900,
            variant: 'hero',
            transforms: MOSAIC_HERO_TRANSFORMS,
            sizes: MOSAIC_HERO_SIZES,
            imageClassName:
              'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]',
          })}
        </div>
      ) : null}

      {!hideGrid &&
      (layout === 'default' || (layout === 'mosaic' && hero === null)) &&
      thumbnails.length > 0 ? (
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
                  className: `${GALLERY_TILE_BUTTON_CLASS} h-full rounded-md`,
                  showOverflow: isOverflowSlot,
                  overflowCountLabel: overflowCount,
                  width: 600,
                  height: 600,
                  transforms: MOSAIC_TILE_TRANSFORMS,
                  sizes: MOSAIC_THUMB_SIZES,
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
        aria-label={translations.lightboxLabel}
        aria-modal="true"
        onClose={close}
        onClick={onBackdropClick}
        className={
          viewMode === 'grid'
            ? EDITORIAL_DIALOG_CLASS
            : 'm-0 w-full max-w-5xl rounded-lg bg-black/95 p-0 text-white backdrop:bg-black/80'
        }
      >
        {viewMode === 'grid' ? (
          <div className="flex h-full flex-col">
            <header className="shrink-0 border-b border-[#8c7b5a]/25 px-6 py-6 md:px-10 md:py-7">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.34em] text-[#8c7b5a]">
                    {translations.mosaicEyebrow}
                  </p>
                  <p className="mt-2 font-serif text-2xl font-medium leading-tight text-[#2b2722] md:text-[2rem]">
                    {translations.lightboxLabel}
                  </p>
                  <p className="mt-1.5 text-sm text-[#6f675b]">{translations.mosaicCountLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className={LIGHTBOX_CLOSE_GRID_CLASS}
                  aria-label={translations.closeLightbox}
                >
                  {translations.closeLightbox}
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10">
              <div className="mx-auto flex max-w-[1120px] flex-col gap-10 md:gap-14">
                {editorialRows.map((row, rowIndex) => renderEditorialRow(row, rowIndex))}
              </div>
            </div>
          </div>
        ) : current !== undefined ? (
          <div className="relative">
            {/* Single-photo top bar — back to mosaic + close. */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3 text-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`${LIGHTBOX_CTRL_CLASS} inline-flex items-center gap-1.5`}
              >
                <span aria-hidden>←</span>
                {translations.backToGallery}
              </button>
              <button
                type="button"
                onClick={close}
                className={LIGHTBOX_CTRL_CLASS}
                aria-label={translations.closeLightbox}
              >
                ✕
              </button>
            </div>

            <figure className="relative mt-3 aspect-[3/2] w-full">
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
              <GalleryCaptionOverlay
                caption={current.caption ?? current.alt}
                reveal="always"
                size="lg"
              />
            </figure>

            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <button
                type="button"
                onClick={goPrev}
                className={LIGHTBOX_CTRL_CLASS}
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
              <button
                type="button"
                onClick={goNext}
                className={LIGHTBOX_CTRL_CLASS}
                aria-label={translations.nextImage}
                disabled={total <= 1}
              >
                →
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
