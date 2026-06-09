/**
 * Room photo ordering — interior / bedroom first for card carousels and room
 * sub-pages (user-facing rule: one visible tile, prefer the bedroom shot).
 */

export interface RoomDisplayImage {
  readonly publicId: string;
  readonly alt: string;
  readonly category?: string | null;
}

const INTERIOR_CATEGORIES = new Set(['room', 'suite', 'interior']);

const PRIMARY_ALT = /\b(chambre|bedroom|suite|interior|intérieur|interieur|chambres?)\b/i;
const SECONDARY_ALT =
  /\b(salle de bain|bathroom|salon|living|terrasse|terrace|vue|view|exterior|façade|facade|balcon)\b/i;

function roomImageSortScore(image: {
  readonly alt: string;
  readonly category?: string | null;
}): number {
  const category = (image.category ?? '').toLowerCase();
  if (INTERIOR_CATEGORIES.has(category)) return 0;
  if (PRIMARY_ALT.test(image.alt)) return 0;
  if (category === 'detail') {
    return SECONDARY_ALT.test(image.alt) && !PRIMARY_ALT.test(image.alt) ? 3 : 1;
  }
  if (SECONDARY_ALT.test(image.alt)) return 3;
  return 2;
}

/** Stable sort: lower score = shown first (bedroom / interior preferred). */
export function sortRoomDisplayImages<T extends RoomDisplayImage>(
  images: readonly T[],
): readonly T[] {
  return images
    .map((image, index) => ({ image, index, score: roomImageSortScore(image) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ image }) => image);
}

/**
 * Merge `hero_image` with `images[]`, dedupe by public_id, then sort with
 * interior-first rule (hero is not forced to the front when it is a bathroom).
 */
export function mergeRoomGalleryImages(args: {
  readonly heroImage: string | null;
  readonly images: readonly RoomDisplayImage[];
  readonly heroAlt: string;
}): readonly RoomDisplayImage[] {
  const seen = new Set<string>();
  const merged: RoomDisplayImage[] = [];

  if (args.heroImage !== null && args.heroImage.length > 0) {
    const heroFromGallery = args.images.find((img) => img.publicId === args.heroImage);
    merged.push(
      heroFromGallery ?? {
        publicId: args.heroImage,
        alt: args.heroAlt,
        category: null,
      },
    );
    seen.add(args.heroImage);
  }

  for (const image of args.images) {
    if (seen.has(image.publicId)) continue;
    seen.add(image.publicId);
    merged.push(image);
  }

  return sortRoomDisplayImages(merged);
}
