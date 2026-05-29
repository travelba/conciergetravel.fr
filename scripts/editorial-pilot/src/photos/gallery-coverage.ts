/**
 * gallery-coverage.ts — pure helpers for the Vision categorisation batch.
 *
 * Keeps the network-free logic (which photos need classifying, how to
 * merge a Vision answer back into a gallery row, category-coverage maths)
 * separate from the OpenAI/Supabase runner so it can be unit-tested.
 *
 * The 10 CDC categories that gate indexability (photo-quality.mdc):
 *   exterior · lobby · room · dining · spa · pool · view · detail ·
 *   concierge · events
 * (`suite` folds into `room`, `other` never counts toward coverage.)
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique.
 */

export const VISION_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'suite',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
  'other',
] as const;

export type VisionCategory = (typeof VISION_CATEGORIES)[number];

/** The 10 distinct categories that count toward the CDC coverage floor. */
export const CDC_COVERAGE_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
] as const;

/** A gallery row as stored in `hotels.gallery_images`. */
export interface GalleryImage {
  readonly public_id: string;
  readonly alt_fr?: string | null;
  readonly alt_en?: string | null;
  readonly caption_fr?: string | null;
  readonly caption_en?: string | null;
  readonly category?: string | null;
  readonly quality_score?: number | null;
  readonly [key: string]: unknown;
}

export interface VisionAnswer {
  readonly category: VisionCategory;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly quality_score: number;
  readonly keep: boolean;
  readonly reason_if_drop: string | null;
}

/** `suite` collapses to `room` for coverage purposes. */
function normalizeForCoverage(category: string): string {
  return category === 'suite' ? 'room' : category;
}

/** Distinct CDC categories already covered by a gallery (ignores `other`/null). */
export function coveredCategories(gallery: readonly GalleryImage[]): ReadonlySet<string> {
  const covered = new Set<string>();
  for (const img of gallery) {
    if (typeof img.category !== 'string' || img.category.length === 0) continue;
    const norm = normalizeForCoverage(img.category);
    if ((CDC_COVERAGE_CATEGORIES as readonly string[]).includes(norm)) {
      covered.add(norm);
    }
  }
  return covered;
}

export function coverageCount(gallery: readonly GalleryImage[]): number {
  return coveredCategories(gallery).size;
}

/** Photos still missing a (non-empty) category — the ones to classify. */
export function imagesNeedingCategory(gallery: readonly GalleryImage[]): readonly GalleryImage[] {
  return gallery.filter(
    (img) => typeof img.category !== 'string' || img.category.trim().length === 0,
  );
}

export interface EligibilityOptions {
  /** Re-classify every photo regardless of current state. */
  readonly force?: boolean;
  /** Coverage floor below which a hotel is still eligible. Default 10. */
  readonly coverageFloor?: number;
}

/**
 * A hotel is eligible for the batch when it has gallery photos AND either
 * `force`, or some photos lack a category, or coverage is below the floor.
 */
export function hotelNeedsCategorisation(
  gallery: readonly GalleryImage[],
  opts: EligibilityOptions = {},
): boolean {
  if (gallery.length === 0) return false;
  if (opts.force === true) return true;
  if (imagesNeedingCategory(gallery).length > 0) return true;
  return coverageCount(gallery) < (opts.coverageFloor ?? 10);
}

/**
 * Merge a Vision answer onto a gallery row, preserving every other field.
 * Only the classification fields are overwritten.
 */
export function applyVisionAnswer(img: GalleryImage, answer: VisionAnswer): GalleryImage {
  return {
    ...img,
    category: answer.category,
    alt_fr: answer.alt_fr,
    alt_en: answer.alt_en,
    caption_fr: answer.caption_fr,
    caption_en: answer.caption_en,
    quality_score: answer.quality_score,
  };
}

export interface MergeResult {
  /** Final gallery to persist (dropped photos removed). */
  readonly gallery: readonly GalleryImage[];
  /** public_ids dropped by Vision (keep=false) — logged, not persisted. */
  readonly dropped: ReadonlyArray<{ public_id: string; reason: string }>;
  /** How many rows were updated with a fresh classification. */
  readonly classified: number;
}

/**
 * Apply a map of `public_id → VisionAnswer` to a gallery. Rows the LLM
 * marked `keep=false` are removed (and reported). Rows without an answer
 * are left untouched.
 */
export function mergeVisionAnswers(
  gallery: readonly GalleryImage[],
  answers: ReadonlyMap<string, VisionAnswer>,
): MergeResult {
  const out: GalleryImage[] = [];
  const dropped: Array<{ public_id: string; reason: string }> = [];
  let classified = 0;
  for (const img of gallery) {
    const answer = answers.get(img.public_id);
    if (answer === undefined) {
      out.push(img);
      continue;
    }
    if (!answer.keep) {
      dropped.push({ public_id: img.public_id, reason: answer.reason_if_drop ?? 'keep=false' });
      continue;
    }
    out.push(applyVisionAnswer(img, answer));
    classified++;
  }
  return { gallery: out, dropped, classified };
}
