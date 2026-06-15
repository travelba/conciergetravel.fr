/**
 * Kit fiche gallery — 5 UI filter categories × 5 photos (CDC §2.2 kit, 2026-06-10).
 *
 * Hero is always a separate `view`/`exterior` asset and must not appear in
 * `gallery_images[]`. Legacy Payload catalogue still targets 30 photos / 10
 * CDC categories until Phase 2 migration.
 */

/** User-facing mosaic filter ids (Chambres, Piscine, Restaurant, Spa, Vue). */
export const KIT_GALLERY_FILTER_UI_IDS = ['view', 'room', 'pool', 'restaurant', 'spa'] as const;

export type KitGalleryFilterUiId = (typeof KIT_GALLERY_FILTER_UI_IDS)[number];

/** Strict gallery slot count for kit fiches (hero excluded). */
export const KIT_GALLERY_SLOT_COUNT = 25;

export const KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY = 5;

/** Legacy kit wave-5 minimum until all fiches migrate to 25-slot model. */
export const KIT_GALLERY_LEGACY_MIN = 30;

export interface GalleryCategoryCarrier {
  readonly category?: string | null;
}

export function normalizeGalleryDbCategoryToFilter(
  category: string | null | undefined,
): KitGalleryFilterUiId | null {
  const value = category?.trim().toLowerCase() ?? '';
  if (value === '') return null;
  if (value === 'room' || value === 'suite' || value === 'bedroom') return 'room';
  if (value === 'pool' || value === 'swimming_pool') return 'pool';
  if (value === 'restaurant' || value === 'dining' || value === 'bar') return 'restaurant';
  if (value === 'spa' || value === 'wellness') return 'spa';
  if (value === 'view' || value === 'exterior' || value === 'facade') return 'view';
  return null;
}

export function countGalleryPhotosByFilterCategory(
  images: readonly GalleryCategoryCarrier[],
): Readonly<Record<KitGalleryFilterUiId, number>> {
  const counts: Record<KitGalleryFilterUiId, number> = {
    view: 0,
    room: 0,
    pool: 0,
    restaurant: 0,
    spa: 0,
  };
  for (const image of images) {
    const filter = normalizeGalleryDbCategoryToFilter(image.category ?? null);
    if (filter !== null) {
      counts[filter] += 1;
    }
  }
  return counts;
}

/** True when every UI filter category has exactly five gallery photos. */
export function hasKitGalleryFiveByFiveStructure(
  images: readonly GalleryCategoryCarrier[],
): boolean {
  if (images.length !== KIT_GALLERY_SLOT_COUNT) return false;
  const counts = countGalleryPhotosByFilterCategory(images);
  return KIT_GALLERY_FILTER_UI_IDS.every(
    (id) => counts[id] === KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY,
  );
}

/**
 * Pick one representative thumbnail per non-view filter for the "Tous" mosaic
 * (hero covers Vue). Falls back to array order when the 5×5 structure is absent.
 */
export function pickKitMosaicRepresentativeThumbnails<T extends GalleryCategoryCarrier>(
  images: readonly T[],
  sideTileCount: number,
): readonly T[] {
  if (images.length === 0 || sideTileCount <= 0) return [];

  if (hasKitGalleryFiveByFiveStructure(images)) {
    const picked: T[] = [];
    for (const filter of KIT_GALLERY_FILTER_UI_IDS) {
      if (filter === 'view') continue;
      const match = images.find(
        (img) => normalizeGalleryDbCategoryToFilter(img.category ?? null) === filter,
      );
      if (match !== undefined) picked.push(match);
      if (picked.length >= sideTileCount) break;
    }
    if (picked.length >= sideTileCount) return picked.slice(0, sideTileCount);
  }

  return images.slice(0, sideTileCount);
}
