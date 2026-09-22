'use client';

import { cn } from '../lib/cn';

export type PhotoMosaicItem = {
  id: string;
  alt: string;
  src: string;
};

export type PhotoMosaicProps = {
  photos: PhotoMosaicItem[];
  onPhotoClick?: (photo: PhotoMosaicItem, index: number) => void;
  onShowAll?: () => void;
  className?: string;
};

export function PhotoMosaic({ photos, onPhotoClick, onShowAll, className }: PhotoMosaicProps) {
  const visible = photos.slice(0, 5);
  const [hero, ...thumbnails] = visible;
  const remainingCount = Math.max(photos.length - 5, 0);

  if (hero === undefined) {
    return (
      <div
        className={cn(
          'flex h-[var(--photo-mosaic-height)] items-center justify-center rounded-sm border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-sm text-[var(--color-muted)]',
          className,
        )}
      >
        Aucune photo disponible
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid h-[var(--photo-mosaic-height)] grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onPhotoClick?.(hero, 0)}
        className="relative col-span-2 row-span-2 overflow-hidden focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
      >
        <img
          src={hero.src}
          alt={hero.alt}
          className="size-full object-cover transition-transform duration-[var(--motion-slow)] hover:scale-[1.02]"
        />
      </button>

      {thumbnails.map((photo, index) => {
        const isLast = index === thumbnails.length - 1;
        const showOverlay = isLast && remainingCount > 0;

        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              if (showOverlay && onShowAll !== undefined) {
                onShowAll();
                return;
              }
              onPhotoClick?.(photo, index + 1);
            }}
            className="relative overflow-hidden focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <img
              src={photo.src}
              alt={photo.alt}
              className="size-full object-cover transition-transform duration-[var(--motion-slow)] hover:scale-[1.02]"
            />
            {showOverlay ? (
              <span className="bg-[var(--color-inverse-surface)]/55 absolute inset-0 flex items-center justify-center text-sm font-semibold text-[var(--color-inverse-on-surface)]">
                +{remainingCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
