import { buildCloudinarySrc } from '@mch/ui';

import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';

import type { PlaceDetail } from './get-place-by-slug';
import type { PlaceListItem } from './list-places';

/** Localised view of a place fiche, ready to render. */
export interface PlaceLocalizedView {
  readonly name: string;
  readonly factualSummary: string | null;
  readonly description: string | null;
  readonly metaTitle: string | null;
  readonly metaDesc: string | null;
  readonly conciergeTitle: string | null;
  readonly conciergeBody: string | null;
  readonly faq: ReadonlyArray<{ question: string; answer: string }>;
}

function pick(
  fr: string | null | undefined,
  en: string | null | undefined,
  locale: Locale,
): string | null {
  const primary = locale === 'en' ? en : fr;
  const fallback = locale === 'en' ? fr : en;
  if (typeof primary === 'string' && primary.trim().length > 0) return primary;
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback;
  return null;
}

export function pickPlaceLocalized(place: PlaceDetail, locale: Locale): PlaceLocalizedView {
  const advice = place.concierge_advice ?? null;
  const adviceLoc = locale === 'en' ? (advice?.en ?? advice?.fr) : (advice?.fr ?? advice?.en);

  const faq: Array<{ question: string; answer: string }> = [];
  for (const e of place.faq ?? []) {
    const q = pick(e.q_fr, e.q_en, locale);
    const a = pick(e.a_fr, e.a_en, locale);
    if (q !== null && a !== null) faq.push({ question: q, answer: a });
  }

  return {
    name: pick(place.name, place.name_en, locale) ?? place.name,
    factualSummary: pick(place.factual_summary_fr, place.factual_summary_en, locale),
    description: pick(place.description_fr, place.description_en, locale),
    metaTitle: pick(place.meta_title_fr, place.meta_title_en, locale),
    metaDesc: pick(place.meta_desc_fr, place.meta_desc_en, locale),
    conciergeTitle: adviceLoc?.title ?? null,
    conciergeBody: adviceLoc?.body ?? null,
    faq,
  };
}

/** In-app path (no locale prefix) to a place fiche. EN uses slug_en when set. */
export function placePathname(
  locale: Locale,
  citySlug: string,
  slugFr: string,
  slugEn: string | null,
): string {
  const slug = locale === 'en' && slugEn !== null && slugEn.length > 0 ? slugEn : slugFr;
  return `/lieux/${citySlug}/${slug}`;
}

/** In-app path to the city ranking/index. */
export function placeCityPathname(citySlug: string): string {
  return `/lieux/${citySlug}`;
}

/**
 * Resolve a place `hero_image` (Cloudinary public_id OR absolute URL)
 * into a delivery URL. Returns `null` when unset / unconfigured.
 */
export function placeHeroSrc(heroImage: string | null, transforms?: string): string | null {
  if (heroImage === null || heroImage.trim().length === 0) return null;
  if (/^https?:\/\//u.test(heroImage)) return heroImage;
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined || cloudName.length === 0) return null;
  return buildCloudinarySrc({
    cloudName,
    publicId: heroImage,
    ...(transforms !== undefined ? { transforms } : {}),
  });
}

// ---------------------------------------------------------------------------
// Gallery — shared delivery transforms so the rendered <img>/<Image> and the
// JSON-LD `ImageObject.contentUrl` agree on the exact URL + dimensions
// (Hard Rule 16: declared width/height must match the delivered transform).
// ---------------------------------------------------------------------------

/** Hero (above-the-fold, `priority`). */
export const PLACE_HERO_TRANSFORM = 'c_fill,w_1600,h_700,f_auto,q_auto';
export const PLACE_HERO_WIDTH = 1600;
export const PLACE_HERO_HEIGHT = 700;

/** Gallery tile (lazy). 4:3 landscape, sized for a 3-col desktop grid. */
export const PLACE_GALLERY_TRANSFORM = 'c_fill,w_800,h_600,f_auto,q_auto';
export const PLACE_GALLERY_WIDTH = 800;
export const PLACE_GALLERY_HEIGHT = 600;

/** A gallery image ready to render (Cloudinary public_id + localised alt). */
export interface PlaceGalleryImage {
  readonly publicId: string;
  readonly alt: string;
  readonly category: string | null;
}

/**
 * Localised, render-ready gallery for a place fiche. Drops entries with an
 * empty `public_id`; falls back to the place name when no localised alt is
 * stored. Returns `[]` (caller self-elides) when the column is unset.
 */
export function pickPlaceGallery(place: PlaceDetail, locale: Locale): readonly PlaceGalleryImage[] {
  const out: PlaceGalleryImage[] = [];
  for (const item of place.gallery_images ?? []) {
    const publicId = typeof item.public_id === 'string' ? item.public_id.trim() : '';
    if (publicId.length === 0) continue;
    out.push({
      publicId,
      alt: pick(item.alt_fr, item.alt_en, locale) ?? place.name,
      category: item.category ?? null,
    });
  }
  return out;
}

/** Localised display name for a list item (ranking cards). */
export function pickListName(item: PlaceListItem, locale: Locale): string {
  return pick(item.name, item.name_en, locale) ?? item.name;
}

/** Localised factual summary for a list item. */
export function pickListSummary(item: PlaceListItem, locale: Locale): string | null {
  return pick(item.factual_summary_fr, item.factual_summary_en, locale);
}
