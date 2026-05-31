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
  /**
   * Editorial "does this photo instantly convey the hotel's character"
   * score (1-10) — distinct from `quality_score` which is purely
   * technical (sharpness, composition, lighting). Drives hero + TOP 5
   * selection (see `pickHero` / `selectTop4` below).
   */
  readonly representativeness?: number | null;
  /** True when the photo is wide-framed + emblematic enough to be the page hero. */
  readonly hero_suitable?: boolean | null;
  readonly [key: string]: unknown;
}

export interface VisionAnswer {
  readonly category: VisionCategory;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly quality_score: number;
  readonly representativeness: number;
  readonly hero_suitable: boolean;
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

/**
 * Photos still missing the `representativeness` editorial score — the ones
 * a `--backfill-scores` pass must (re)classify so `curate-top-photos` can
 * rank them. A photo categorised by an older Vision pass (category only,
 * no representativeness/hero_suitable) is included here.
 */
export function imagesNeedingScores(gallery: readonly GalleryImage[]): readonly GalleryImage[] {
  return gallery.filter((img) => typeof img.representativeness !== 'number');
}

/** True when at least one photo still lacks a `representativeness` score. */
export function hotelNeedsScores(gallery: readonly GalleryImage[]): boolean {
  if (gallery.length === 0) return false;
  return imagesNeedingScores(gallery).length > 0;
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
    representativeness: answer.representativeness,
    hero_suitable: answer.hero_suitable,
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

// ---------------------------------------------------------------------------
// TOP 5 selection — hero + first 4 gallery shots (curate-top-photos.ts)
// ---------------------------------------------------------------------------

/**
 * Categories that can carry the page hero. A hero must give the hotel's
 * "tendance" at first glance — a signature facade, an iconic view, the
 * signature pool, or the emblematic lobby. A close-up `detail` or an
 * anonymous `room` does not qualify as a hero (low representativeness).
 */
export const HERO_CATEGORIES = ['exterior', 'view', 'pool', 'lobby'] as const;

/**
 * Diversity order for the 4 tiles shown next to the hero in the
 * above-the-fold mosaic (`hotel-gallery.tsx`). We pick the best photo of
 * each category in this order (skipping the hero's category) so the
 * TOP 5 showcases the hotel's range — a room, the dining, a pool/view,
 * a signature detail. `suite` folds into `room` (see `normalizeForCoverage`).
 */
export const TOP4_CATEGORY_PRIORITY = [
  'room',
  'dining',
  'pool',
  'view',
  'detail',
  'spa',
  'lobby',
  'exterior',
  'events',
  'concierge',
] as const;

/**
 * Combined ranking score. `representativeness` (how much the photo
 * conveys the hotel's character) is weighted twice the technical
 * `quality_score`, because the TOP 5's job is to communicate the
 * hotel's tendance, not just be sharp. Missing values default to 0 so a
 * not-yet-scored gallery degrades to plain `quality_score` ordering.
 */
export function combinedScore(img: GalleryImage): number {
  const rep = typeof img.representativeness === 'number' ? img.representativeness : 0;
  const quality = typeof img.quality_score === 'number' ? img.quality_score : 0;
  return rep * 2 + quality;
}

/** Stable descending comparator on `combinedScore` (preserves source order on ties). */
function byScoreDescStable(gallery: readonly GalleryImage[]): GalleryImage[] {
  return gallery
    .map((img, index) => ({ img, index }))
    .sort((a, b) => {
      const diff = combinedScore(b.img) - combinedScore(a.img);
      if (diff !== 0) return diff;
      return a.index - b.index;
    })
    .map((entry) => entry.img);
}

/**
 * Pick the hero — the single most emblematic photo. Preference cascade:
 *   1. `hero_suitable` photos in a signature category (`HERO_CATEGORIES`).
 *   2. any `hero_suitable` photo.
 *   3. the highest combined-score photo (last resort, e.g. un-scored gallery).
 * Returns `null` for an empty gallery.
 */
export function pickHero(gallery: readonly GalleryImage[]): string | null {
  if (gallery.length === 0) return null;
  const heroCats = HERO_CATEGORIES as readonly string[];
  const suitable = gallery.filter((img) => img.hero_suitable === true);
  const signature = suitable.filter(
    (img) =>
      typeof img.category === 'string' && heroCats.includes(normalizeForCoverage(img.category)),
  );
  const pool = signature.length > 0 ? signature : suitable.length > 0 ? suitable : gallery;
  const best = byScoreDescStable(pool)[0];
  return best?.public_id ?? null;
}

/**
 * Select up to 4 gallery photos (excluding the hero) that maximise
 * category diversity, then fill any remaining slots with the best
 * leftover photos. Returns the chosen `public_id`s in display order.
 */
export function selectTop4(
  gallery: readonly GalleryImage[],
  heroPublicId: string | null,
): string[] {
  const candidates = gallery.filter((img) => img.public_id !== heroPublicId);
  const heroImg = gallery.find((img) => img.public_id === heroPublicId) ?? null;
  const heroCat =
    heroImg !== null && typeof heroImg.category === 'string'
      ? normalizeForCoverage(heroImg.category)
      : null;

  const picked: string[] = [];
  const usedIds = new Set<string>();

  for (const cat of TOP4_CATEGORY_PRIORITY) {
    if (picked.length >= 4) break;
    if (cat === heroCat) continue;
    const inCat = candidates.filter(
      (img) =>
        !usedIds.has(img.public_id) &&
        typeof img.category === 'string' &&
        normalizeForCoverage(img.category) === cat,
    );
    if (inCat.length === 0) continue;
    const best = byScoreDescStable(inCat)[0];
    if (best === undefined) continue;
    picked.push(best.public_id);
    usedIds.add(best.public_id);
  }

  // Fill remaining slots with the best leftover photos regardless of category.
  if (picked.length < 4) {
    const leftover = byScoreDescStable(candidates.filter((img) => !usedIds.has(img.public_id)));
    for (const img of leftover) {
      if (picked.length >= 4) break;
      picked.push(img.public_id);
      usedIds.add(img.public_id);
    }
  }

  return picked;
}

export interface OrderGalleryResult {
  /** The chosen hero `public_id` (also written to `hotels.hero_image`). */
  readonly heroPublicId: string | null;
  /**
   * Gallery to persist in `hotels.gallery_images`, hero EXCLUDED (mirrors
   * the `galleryWithoutHero` shape produced by `sync-hotel-photos.ts`):
   * the diverse TOP 4 first, then the rest by descending score.
   */
  readonly orderedGallery: readonly GalleryImage[];
}

/**
 * Compute the curated hero + gallery ordering for a hotel.
 *
 * The first 4 entries of `orderedGallery` are the diversity-curated tiles
 * that, together with the hero, form the above-the-fold mosaic and the
 * 5 `ImageObject` JSON-LD nodes (`page.tsx` slices `gallery.slice(0, 5)`).
 * Pure + idempotent: re-running on an already-ordered gallery is a no-op.
 */
export function orderGallery(gallery: readonly GalleryImage[]): OrderGalleryResult {
  const heroPublicId = pickHero(gallery);
  const top4 = selectTop4(gallery, heroPublicId);
  const top4Set = new Set(top4);
  const byId = new Map(gallery.map((img) => [img.public_id, img]));

  const orderedTop4 = top4
    .map((id) => byId.get(id))
    .filter((img): img is GalleryImage => img !== undefined);

  const rest = byScoreDescStable(
    gallery.filter((img) => img.public_id !== heroPublicId && !top4Set.has(img.public_id)),
  );

  return { heroPublicId, orderedGallery: [...orderedTop4, ...rest] };
}
