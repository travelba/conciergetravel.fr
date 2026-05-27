/**
 * Resolves the hero video + poster URLs for `<HomeHero>`.
 *
 * The hero asset is hosted on Cloudinary. We keep the public IDs hard-
 * coded here (single source of truth) so the marketing team can swap
 * them without touching code (they edit the Cloudinary alias instead).
 *
 * Returns `null` when no Cloudinary cloud name is configured — the
 * caller falls back to a sober gradient.
 *
 * Pure function — no I/O, no SDK; just URL composition. Safe to call
 * from a Server Component without forcing the page to be dynamic.
 */
export interface HomeHeroMedia {
  readonly videoUrl: string;
  readonly posterUrl: string;
}

/**
 * Cloudinary public ID of the hero video loop.
 *
 * Source: 1280×720 MP4, ~24 s, uploaded as the shared collection
 * https://collection.cloudinary.com/dvbjwh5wy/cc7d472186f25e9ac6527469e0bbca80
 * The same asset acts as the poster source — we extract a still
 * frame at 2 s (past any black intro frames) via the `so_2` Cloudinary
 * video transformation, so the marketing team only has to swap one
 * asset to replace the hero.
 */
const HERO_VIDEO_PUBLIC_ID = 'myconciergetravel_hero_full_zljkwh';

export function resolveHomeHeroMedia(cloudName: string | undefined): HomeHeroMedia | null {
  if (cloudName === undefined || cloudName.length === 0) return null;
  const base = `https://res.cloudinary.com/${cloudName}`;
  return {
    // `f_auto,q_auto` lets Cloudinary serve WebM/AV1 to capable browsers
    // and an MP4 fallback elsewhere. `c_limit,w_1920` caps the longest
    // edge at 1920 px without upscaling the 1280-px source — saves
    // bytes for mobile while preserving sharpness on desktop.
    videoUrl: `${base}/video/upload/f_auto,q_auto:good,c_limit,w_1920/${HERO_VIDEO_PUBLIC_ID}.mp4`,
    // Still frame at 2 s, JPEG, same width policy. Used as the
    // `<video poster>` for fast LCP and as the standalone image
    // shown to `prefers-reduced-motion` users.
    posterUrl: `${base}/video/upload/so_2,f_jpg,q_auto:good,c_limit,w_1920/${HERO_VIDEO_PUBLIC_ID}.jpg`,
  };
}
