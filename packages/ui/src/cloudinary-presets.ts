/**
 * Cloudinary transformation presets — MyConciergeHotel.com.
 *
 * Single source of truth for every Cloudinary URL the site emits.
 *
 * ## Why this file exists (ADR-0024 — Photo signature transform)
 *
 * The 2026-05-31 filter-preview exercise compared four candidates on
 * six production-grade photos (Akelarre, Al Moudira, Alila Jabal
 * Akhdar — sourced via Google Places API):
 *
 *   - Baseline:    f_auto,q_auto,c_fill,g_auto
 *   - A — Subtle:  + e_improve:50,e_sharpen:200
 *   - B — Editorial: + e_improve:80,e_sharpen:300,e_saturation:20,e_contrast:10
 *   - C — Bold:    + e_improve:100,e_sharpen:400,e_saturation:35,e_contrast:25,e_auto_color
 *
 * **Result:** A/B/C were visually indistinguishable from Baseline at
 * screen resolution. The photos sourced via Google Business Profile
 * are already well-balanced — `e_improve` had nothing to "fix".
 *
 * **Decision (PO 2026-05-31):** Baseline wins on the four axes:
 *   1. Visual — fidelity to the hotelier-curated rendering, zero
 *      sur-traitement risk on skin tones / low-light interiors.
 *   2. SEO / LCP — shortest URL, best CDN cache hit rate, no extra
 *      Cloudinary transformation cost at cold start.
 *   3. GEO — same rendering as Google Business Profile / Bing Image
 *      surfaces, no divergence that LLMs (Perplexity, ChatGPT,
 *      Claude) would flag as a manipulated image.
 *   4. Agentic — `getHotelPhotos` MCP endpoint returns URLs that can
 *      be reused cross-platform without "visual greenwashing" risk.
 *
 * The signature is in the **sourcing** (official only, never Pinterest
 * / TripAdvisor / hotlinks — see `.cursor/rules/photo-quality.mdc`)
 * and in the **alt + caption + structured metadata**, not in
 * post-processing.
 *
 * Skill: `photo-quality-seo-geo-agentique`.
 */

/**
 * The single signature transform used by every hotel image in the
 * production site. Locked 2026-05-31 (ADR-0024).
 *
 *   - `f_auto`  → Cloudinary negotiates AVIF / WebP / JPEG per client
 *   - `q_auto`  → adaptive quality (≈ 85, balances weight vs perceived
 *                  quality). NOT `q_auto:best` (which targets ≈ 95 and
 *                  hurts LCP for marginal visual gain on hotel media).
 *   - `c_fill`  → crop to fit the requested width × height
 *   - `g_auto`  → AI-selected gravity (centers on subject, not corner)
 *
 * Do NOT add `e_improve` / `e_sharpen` / `e_saturation` / `e_contrast`
 * without a new ADR overruling ADR-0024.
 */
export const SIGNATURE_TRANSFORM = 'f_auto,q_auto,c_fill,g_auto' as const;

/**
 * LQIP (Low-Quality Image Placeholder) used for the hero blur-up.
 * 20 px wide, blurred, served instantly, ~ 300 bytes.
 *
 * Used in `<HotelHero>` to remove FOIT on slow connections without
 * shipping a base64 inline blur (which inflates the HTML).
 */
export const SIGNATURE_LQIP = 'w_20,q_1,e_blur:1000,f_auto' as const;

/**
 * Hero placement: above-the-fold, eager-loaded, large.
 * Width 2400 hits Retina on a 1440 viewport and 4K on a 2560 viewport.
 * Aspect 16:9 (1350) is the editorial standard for hotel hero shots.
 */
export const HERO_TRANSFORM = `w_2400,h_1350,${SIGNATURE_TRANSFORM}` as const;

/**
 * Gallery card: below-the-fold, lazy-loaded, medium.
 * Width 1230 fits the 3-column desktop grid (1230 × 820 = 3:2).
 */
export const GALLERY_TRANSFORM = `w_1230,h_820,${SIGNATURE_TRANSFORM}` as const;

/**
 * Thumbnail (search results, sidebar suggestions, breadcrumb avatars).
 * 96 px square fits the smallest cards without re-fetching the hero.
 */
export const THUMBNAIL_TRANSFORM = `w_192,h_192,${SIGNATURE_TRANSFORM}` as const;

/**
 * Aggregate object for ergonomic consumption from components that
 * want a typed map of presets (e.g. `<HotelImage variant="hero" />`
 * resolves via `CLOUDINARY_PRESETS[variant]`).
 */
export const CLOUDINARY_PRESETS = {
  hero: HERO_TRANSFORM,
  gallery: GALLERY_TRANSFORM,
  thumbnail: THUMBNAIL_TRANSFORM,
  signature: SIGNATURE_TRANSFORM,
  lqip: SIGNATURE_LQIP,
} as const;

export type CloudinaryPresetKey = keyof typeof CLOUDINARY_PRESETS;
