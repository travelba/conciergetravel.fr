'use client';

import { useCallback, useRef, useState } from 'react';

export interface RoomMiniGalleryImage {
  readonly src: string;
  readonly alt: string;
}

export interface RoomMiniGalleryLabels {
  readonly prevPhoto: string;
  readonly nextPhoto: string;
  readonly photoN: string;
}

export interface RoomMiniGalleryProps {
  readonly images: readonly RoomMiniGalleryImage[];
  readonly placeholder: string;
  readonly labels: RoomMiniGalleryLabels;
  /** `card` = room grid tile (4/3, rounded top). `hero` = room sub-page lead. */
  readonly variant?: 'card' | 'hero';
  readonly className?: string;
}

/**
 * Per-room photo carousel — one image visible at a time (kit `.mini-gallery` +
 * scroll-snap). Swipe on touch; prev/next arrows on hover / always on mobile.
 */
export function RoomMiniGallery({
  images,
  placeholder,
  labels,
  variant = 'card',
  className,
}: RoomMiniGalleryProps): React.ReactElement {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (track === null) return;
      const clamped = Math.max(0, Math.min(images.length - 1, index));
      track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
      setActive(clamped);
    },
    [images.length],
  );

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (track === null) return;
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    setActive((prev) => (prev === index ? prev : index));
  }, []);

  const step = useCallback(
    (dir: -1 | 1) => {
      scrollToIndex(active + dir);
    },
    [active, scrollToIndex],
  );

  const rootClass = [
    'mini-gallery',
    variant === 'hero' ? 'mini-gallery--hero' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (images.length === 0) {
    return (
      <div className={rootClass}>
        <div className="mg-track">
          <span className="text-muted flex h-full w-full items-center justify-center bg-neutral-100 text-xs">
            {placeholder}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div ref={trackRef} className="mg-track" onScroll={onScroll}>
        {images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary asset (photo-quality rules)
          <img key={img.src} src={img.src} alt={img.alt} loading="lazy" decoding="async" />
        ))}
      </div>
      {images.length > 1 ? (
        <>
          <div className="mg-dots">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                className={i === active ? 'on' : undefined}
                aria-label={labels.photoN.replace('{n}', String(i + 1))}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => scrollToIndex(i)}
              />
            ))}
          </div>
          <div className="mg-nav" aria-hidden={false}>
            <button
              type="button"
              className="mg-arw mg-prev"
              aria-label={labels.prevPhoto}
              onClick={() => step(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="mg-arw mg-next"
              aria-label={labels.nextPhoto}
              onClick={() => step(1)}
            >
              ›
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
