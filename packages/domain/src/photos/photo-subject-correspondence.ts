/**
 * Photo-subject correspondence — structural gates ensuring each rendered
 * photo slot points at the right subject (POI venue, spa, dining, …).
 *
 * Layer 1 (this module): fast metadata checks — no Vision API.
 * Layer 2 (editorial-pilot): `verify-photo-subject-correspondence.ts` — optional Vision QA.
 *
 * CDC §2.2bis · skill `photo-pipeline` §Photo-subject correspondence.
 */

/** Gallery slot prefixes that must never back POI cards or mislabeled blocks. */
export const HOTEL_GALLERY_RECYCLE_PREFIXES = [
  'press-',
  'hero',
  'room-',
  'suite-',
  'exterior-',
  'dining-',
  'lobby-',
] as const;

export const POI_DEDICATED_SEGMENT = '/poi-';

export type PhotoSubjectBlock = 'poi' | 'spa' | 'dining' | 'experience' | 'hero' | 'events';

export interface GalleryImageLike {
  readonly public_id?: string | null;
  readonly category?: string | null;
  readonly alt_fr?: string | null;
  readonly alt_en?: string | null;
}

export interface PhotoSlotExpectation {
  /** Last path segment or suffix, e.g. `press-17` or `poi-arc-de-triomphe`. */
  readonly publicIdSuffix: string;
  readonly block: PhotoSubjectBlock;
  /** Allowed `gallery_images.category` values for this slot. */
  readonly expectedCategories: readonly string[];
}

export interface PoiStructuralIssue {
  readonly index: number;
  readonly name: string | null;
  readonly imagePublicId: string | null;
  readonly code: 'missing_image' | 'recycled_gallery' | 'not_dedicated_poi' | 'alt_name_mismatch';
  readonly detail: string;
}

export interface PoiStructuralCorrespondence {
  readonly total: number;
  readonly ok: number;
  readonly issues: readonly PoiStructuralIssue[];
}

export interface GalleryAltCategoryIssue {
  readonly publicId: string;
  readonly category: string;
  readonly altFr: string;
  readonly code: 'spa_labeled_as_room' | 'dining_labeled_as_room' | 'room_labeled_as_spa';
  readonly detail: string;
}

export interface GalleryStructuralCorrespondence {
  readonly total: number;
  readonly issues: readonly GalleryAltCategoryIssue[];
}

export interface PhotoSlotMismatch {
  readonly publicIdSuffix: string;
  readonly block: PhotoSubjectBlock;
  readonly expectedCategories: readonly string[];
  readonly actualCategory: string | null;
  readonly detail: string;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Last segment of a Cloudinary public_id (`cct/hotels/slug/poi-x` → `poi-x`). */
export function publicIdLastSegment(publicId: string): string {
  const trimmed = publicId.trim();
  const slash = trimmed.lastIndexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/** True when the id is a dedicated POI asset (`…/poi-{slug}`), not hotel gallery. */
export function isDedicatedPoiImagePublicId(imagePublicId: unknown): boolean {
  if (!nonEmptyString(imagePublicId)) return false;
  return imagePublicId.includes(POI_DEDICATED_SEGMENT);
}

/** True when a POI reuses a hotel gallery slot (`press-*`, `room-*`, …). */
export function isRecycledHotelGalleryPublicId(imagePublicId: unknown): boolean {
  if (!nonEmptyString(imagePublicId)) return false;
  const segment = publicIdLastSegment(imagePublicId).toLowerCase();
  if (segment.startsWith('poi-')) return false;
  return HOTEL_GALLERY_RECYCLE_PREFIXES.some((prefix) => segment.startsWith(prefix));
}

function readPoiName(poi: Record<string, unknown>): string | null {
  if (nonEmptyString(poi['name_fr'])) return poi['name_fr'].trim();
  if (nonEmptyString(poi['name'])) return poi['name'].trim();
  if (nonEmptyString(poi['name_en'])) return poi['name_en'].trim();
  return null;
}

function readPoiImagePublicId(poi: Record<string, unknown>): string | null {
  const raw = poi['image_public_id'] ?? poi['imagePublicId'];
  return nonEmptyString(raw) ? raw.trim() : null;
}

const ALT_STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  "d'",
  'et',
  'the',
  'a',
  'an',
  'paris',
  'france',
]);

function significantTokens(text: string): readonly string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !ALT_STOP_WORDS.has(t));
}

/**
 * POI alt_fr should mention at least one significant token from the POI name
 * (e.g. "Musée Yves Saint Laurent" → alt contains "yves" or "laurent" or "musee").
 */
export function poiAltMatchesName(poiName: string, altFr: unknown): boolean {
  if (!nonEmptyString(altFr)) return false;
  const nameTokens = significantTokens(poiName);
  if (nameTokens.length === 0) return true;
  const altNorm = altFr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return nameTokens.some((token) => altNorm.includes(token));
}

/**
 * Structural POI photo contract (CDC D9 + D9bis + D13):
 * - every POI has image_public_id
 * - id is dedicated `poi-*`, never recycled `press-*`
 * - optional alt_fr overlaps POI name when alt is present on the POI row
 */
export function evaluatePoiStructuralCorrespondence(
  pointsOfInterest: unknown,
): PoiStructuralCorrespondence {
  const items = Array.isArray(pointsOfInterest) ? (pointsOfInterest as unknown[]) : [];
  const issues: PoiStructuralIssue[] = [];

  items.forEach((item, index) => {
    const rec = asRecord(item);
    if (rec === null) return;

    const name = readPoiName(rec);
    const imagePublicId = readPoiImagePublicId(rec);

    if (imagePublicId === null) {
      issues.push({
        index,
        name,
        imagePublicId: null,
        code: 'missing_image',
        detail: 'POI missing image_public_id',
      });
      return;
    }

    if (isRecycledHotelGalleryPublicId(imagePublicId)) {
      issues.push({
        index,
        name,
        imagePublicId,
        code: 'recycled_gallery',
        detail: `POI reuses hotel gallery slot (${publicIdLastSegment(imagePublicId)})`,
      });
      return;
    }

    if (!isDedicatedPoiImagePublicId(imagePublicId)) {
      issues.push({
        index,
        name,
        imagePublicId,
        code: 'not_dedicated_poi',
        detail: 'image_public_id is not a dedicated poi-* asset',
      });
      return;
    }

    const altFr = rec['alt_fr'] ?? rec['altFr'];
    if (name !== null && nonEmptyString(altFr) && !poiAltMatchesName(name, altFr)) {
      issues.push({
        index,
        name,
        imagePublicId,
        code: 'alt_name_mismatch',
        detail: 'alt_fr does not mention POI name tokens',
      });
    }
  });

  return {
    total: items.length,
    ok: items.length - issues.length,
    issues,
  };
}

const ROOM_ALT = /\b(chambre|suite|bedroom|lit|headboard|oreiller|bathroom|salle de bain)\b/i;
const SPA_ALT = /\b(spa|hammam|sauna|soin|wellness|calma|massage|treatment)\b/i;
const DINING_ALT =
  /\b(restaurant|bar|dining|brasserie|terrasse|table|café|cafe|petit.?d[eé]jeuner)\b/i;

/**
 * Heuristic cross-check: declared gallery category vs alt_fr vocabulary.
 * Catches the classic "category=spa but alt describes a bedroom" mismatch.
 */
export function evaluateGalleryAltCategoryCorrespondence(
  gallery: unknown,
): GalleryStructuralCorrespondence {
  const items = Array.isArray(gallery) ? (gallery as unknown[]) : [];
  const issues: GalleryAltCategoryIssue[] = [];

  for (const item of items) {
    const rec = asRecord(item);
    if (rec === null) continue;
    const publicId = rec['public_id'];
    const categoryRaw = rec['category'];
    const altFr = rec['alt_fr'];
    if (!nonEmptyString(publicId) || !nonEmptyString(categoryRaw) || !nonEmptyString(altFr)) {
      continue;
    }

    const category = categoryRaw.toLowerCase().trim();
    const hasRoom = ROOM_ALT.test(altFr);
    const hasSpa = SPA_ALT.test(altFr);
    const hasDining = DINING_ALT.test(altFr);

    if (category === 'spa' && hasRoom && !hasSpa) {
      issues.push({
        publicId,
        category,
        altFr,
        code: 'spa_labeled_as_room',
        detail: 'category=spa but alt_fr describes a room/bathroom',
      });
    } else if (category === 'dining' && hasRoom && !hasDining) {
      issues.push({
        publicId,
        category,
        altFr,
        code: 'dining_labeled_as_room',
        detail: 'category=dining but alt_fr describes a room',
      });
    } else if (category === 'room' && hasSpa && !hasRoom) {
      issues.push({
        publicId,
        category,
        altFr,
        code: 'room_labeled_as_spa',
        detail: 'category=room but alt_fr describes spa/wellness',
      });
    }
  }

  return { total: items.length, issues };
}

function findGalleryRowBySuffix(
  gallery: readonly GalleryImageLike[],
  suffix: string,
): GalleryImageLike | undefined {
  const normalized = suffix.toLowerCase();
  return gallery.find((row) => {
    if (!nonEmptyString(row.public_id)) return false;
    return publicIdLastSegment(row.public_id).toLowerCase() === normalized;
  });
}

/**
 * Kit golden manifests can declare expected categories per Cloudinary slot
 * (e.g. `press-17` → spa). Fails when the gallery row category diverges.
 */
export function evaluatePhotoSlotExpectations(
  gallery: unknown,
  expectations: readonly PhotoSlotExpectation[],
): readonly PhotoSlotMismatch[] {
  const items = Array.isArray(gallery) ? (gallery as GalleryImageLike[]) : [];
  const mismatches: PhotoSlotMismatch[] = [];

  for (const slot of expectations) {
    const row = findGalleryRowBySuffix(items, slot.publicIdSuffix);
    if (row === undefined) continue;
    const actual = nonEmptyString(row.category) ? row.category.toLowerCase().trim() : null;
    const expected = slot.expectedCategories.map((c) => c.toLowerCase());
    if (actual === null || !expected.includes(actual)) {
      mismatches.push({
        publicIdSuffix: slot.publicIdSuffix,
        block: slot.block,
        expectedCategories: slot.expectedCategories,
        actualCategory: actual,
        detail:
          actual === null
            ? `slot ${slot.publicIdSuffix} (${slot.block}) has no category`
            : `slot ${slot.publicIdSuffix} (${slot.block}) category=${actual}, expected ${expected.join('|')}`,
      });
    }
  }

  return mismatches;
}

export interface PoiDedicatedImageCoverage {
  readonly total: number;
  readonly dedicated: number;
}

/** @deprecated Prefer evaluatePoiStructuralCorrespondence — kept for existing gates. */
export function evaluatePoiDedicatedImages(pointsOfInterest: unknown): PoiDedicatedImageCoverage {
  const structural = evaluatePoiStructuralCorrespondence(pointsOfInterest);
  const hardFails = structural.issues.filter(
    (i) =>
      i.code === 'recycled_gallery' || i.code === 'not_dedicated_poi' || i.code === 'missing_image',
  );
  return {
    total: structural.total,
    dedicated: structural.total - hardFails.length,
  };
}
