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

/** Localised display name for a list item (ranking cards). */
export function pickListName(item: PlaceListItem, locale: Locale): string {
  return pick(item.name, item.name_en, locale) ?? item.name;
}

/** Localised factual summary for a list item. */
export function pickListSummary(item: PlaceListItem, locale: Locale): string | null {
  return pick(item.factual_summary_fr, item.factual_summary_en, locale);
}
