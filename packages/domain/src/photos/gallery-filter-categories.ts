/**
 * Kit fiche gallery — 5 UI filter categories × 5 photos (CDC §2.2 kit, 2026-06-10).
 *
 * Hero is always a separate `view`/`exterior` asset and must not appear in
 * `gallery_images[]`. Legacy Payload catalogue still targets 30 photos / 10
 * CDC categories until Phase 2 migration.
 */

/** User-facing mosaic filter ids (Chambres, Piscine, Restaurant, Spa, Vue). */
export const KIT_GALLERY_FILTER_UI_IDS = ['view', 'room', 'pool', 'restaurant', 'spa'] as const;

/** Side vignettes on the "Tous" mosaic (one per non-view filter). */
export const KIT_GALLERY_MOSAIC_SIDE_TILE_COUNT = 4;

/**
 * Minimum gallery photos in a filter category before its tab is shown.
 * Kit publish gates still require {@link KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY}
 * for full 5×5 compliance — this lower bar is UI-only for partial catalogues.
 */
export const KIT_GALLERY_FILTER_TAB_MIN_PHOTOS = 1;

export type KitGalleryFilterUiId = (typeof KIT_GALLERY_FILTER_UI_IDS)[number];

/** Strict gallery slot count for kit fiches (hero excluded). */
export const KIT_GALLERY_SLOT_COUNT = 25;

export const KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY = 5;

/** Legacy kit wave-5 minimum until all fiches migrate to 25-slot model. */
export const KIT_GALLERY_LEGACY_MIN = 30;

/**
 * Honest-gallery floor (2026-06-16). The 5×5 / 25 / 30 targets are aspirational;
 * a kit fiche may ship fewer slots when re-sourcing honestly drops foreign or
 * mislabelled pixels. Each category needs only one real photo for its mosaic
 * tile — strict per-category counts are no longer a publish blocker.
 */
export const KIT_GALLERY_MIN_SLOT_COUNT = 5;

export interface GalleryCategoryCarrier {
  readonly category?: string | null;
}

export interface GalleryPublicIdCarrier extends GalleryCategoryCarrier {
  readonly publicId?: string;
}

export function normalizeGalleryDbCategoryToFilter(
  category: string | null | undefined,
): KitGalleryFilterUiId | null {
  const value = category?.trim().toLowerCase() ?? '';
  if (value === '') return null;
  if (
    value === 'room' ||
    value === 'suite' ||
    value === 'bedroom' ||
    value === 'detail' ||
    value === 'bathroom' ||
    value === 'interior'
  ) {
    return 'room';
  }
  if (value === 'pool' || value === 'swimming_pool') return 'pool';
  if (value === 'restaurant' || value === 'dining' || value === 'bar') return 'restaurant';
  if (value === 'spa' || value === 'wellness') return 'spa';
  if (value === 'view' || value === 'exterior' || value === 'facade' || value === 'landscape') {
    return 'view';
  }
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
 * (hero covers Vue). Fills remaining slots from gallery order when a category
 * is missing (legacy / partial catalogues such as the 12-photo Airelles pilot).
 */
export function pickKitMosaicRepresentativeThumbnails<T extends GalleryPublicIdCarrier>(
  images: readonly T[],
  sideTileCount: number,
  options?: { readonly excludePublicIds?: readonly string[] },
): readonly T[] {
  if (images.length === 0 || sideTileCount <= 0) return [];

  const exclude = new Set(options?.excludePublicIds ?? []);
  const eligible = images.filter((img) => {
    const id = img.publicId ?? '';
    return id === '' || !exclude.has(id);
  });

  const picked: T[] = [];
  const pickedIds = new Set<string>();

  for (const filter of KIT_GALLERY_FILTER_UI_IDS) {
    if (filter === 'view') continue;
    const match = eligible.find((img) => {
      const id = img.publicId ?? '';
      if (id !== '' && pickedIds.has(id)) return false;
      return normalizeGalleryDbCategoryToFilter(img.category ?? null) === filter;
    });
    if (match !== undefined) {
      picked.push(match);
      const id = match.publicId ?? '';
      if (id !== '') pickedIds.add(id);
    }
    if (picked.length >= sideTileCount) break;
  }

  if (picked.length < sideTileCount) {
    for (const img of eligible) {
      const id = img.publicId ?? '';
      if (id !== '' && pickedIds.has(id)) continue;
      picked.push(img);
      if (id !== '') pickedIds.add(id);
      if (picked.length >= sideTileCount) break;
    }
  }

  return picked.slice(0, sideTileCount);
}

/** Best view/exterior shot for the mosaic lead when the page hero is already shown elsewhere. */
export function pickBestViewGalleryImage<T extends GalleryPublicIdCarrier>(
  images: readonly T[],
  options?: { readonly excludePublicIds?: readonly string[] },
): T | undefined {
  if (images.length === 0) return undefined;
  const exclude = new Set(options?.excludePublicIds ?? []);
  const eligible = images.filter((img) => {
    const id = img.publicId ?? '';
    return id === '' || !exclude.has(id);
  });
  const viewMatch = eligible.find(
    (img) => normalizeGalleryDbCategoryToFilter(img.category ?? null) === 'view',
  );
  if (viewMatch !== undefined) return viewMatch;
  return eligible[0];
}
