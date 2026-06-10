import 'server-only';

import type { Metadata } from 'next';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import {
  buildHotelDiscoverRobots,
  buildHotelOgImages,
  buildHotelOpenGraphAlternates,
  buildHotelSeoTitle,
} from '@/lib/seo/hotel-page-seo';
import { isHotelIndexable } from '@/server/hotels/indexability';
import {
  readFactualSummary,
  readHeroImage,
  type HotelDetail,
  type HotelDetailRow,
} from '@/server/hotels/get-hotel-by-slug';

import { patchKitGoldenRow } from './patch-kit-golden-row';
import type { HotelKitModel } from './prepare-hotel-kit-model';

const FALLBACK_OG_HERO = 'cct/hotels/les-airelles-gordes/press-1';

function siteOrigin(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? 'https://myconciergehotel.com';
  return raw.replace(/\/$/, '');
}

function pickName(row: HotelDetailRow, locale: Locale): string {
  const enName = row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name;
  return pickByLocale(locale, row.name, enName);
}

function pickDescription(row: HotelDetailRow, locale: Locale): string | null {
  return pickLocalizedText(locale, row.description_fr, row.description_en);
}

/** Shared SEO metadata shape for kit fiches — no Travelport, no HTML assembly. */
export function composeHotelKitMetadata(input: {
  readonly locale: 'fr' | 'en';
  readonly slugFr: string;
  readonly slugEn: string;
  readonly row: HotelDetailRow;
  readonly name: string;
  readonly city: string;
  readonly district: string;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly description: string | null;
  readonly factualSummaryText: string | null;
  readonly heroPublicId: string | null;
  readonly cloudName: string;
}): Metadata {
  const titleOverride = pickLocalizedText(
    input.locale,
    input.row.meta_title_fr,
    input.row.meta_title_en,
  );
  const descOverride = pickLocalizedText(
    input.locale,
    input.row.meta_desc_fr,
    input.row.meta_desc_en,
  );

  const title =
    titleOverride !== null && titleOverride !== ''
      ? titleOverride
      : buildHotelSeoTitle({
          name: input.name,
          city: input.city,
          district: input.district,
          region: input.region,
          isPalace: input.isPalace,
          stars: input.stars,
          locale: input.locale,
        });

  const description =
    descOverride !== null && descOverride !== ''
      ? descOverride
      : (input.factualSummaryText ?? input.description?.slice(0, 160) ?? undefined);

  const canonicalPath = getPathname({
    locale: input.locale,
    href: {
      pathname: '/hotel/[slug]',
      params: {
        slug: pickByLocale(input.locale, input.slugFr, input.slugEn),
      },
    },
  });
  const canonicalUrl = `${siteOrigin()}${canonicalPath}`;

  const ogImagePublicId = input.heroPublicId ?? FALLBACK_OG_HERO;
  const ogImages = buildHotelOgImages(input.cloudName, ogImagePublicId, input.name);
  const firstOgImage = ogImages[0];
  const ogImageUrl = firstOgImage !== undefined ? firstOgImage.url : '';

  const isStub = !isHotelIndexable(input.row);

  return {
    title: { absolute: title },
    description: description !== undefined ? description.slice(0, 160) : undefined,
    robots: buildHotelDiscoverRobots(isStub),
    alternates: {
      canonical: canonicalPath,
      languages: buildHreflangAlternates((l) =>
        getPathname({
          locale: l,
          href: {
            pathname: '/hotel/[slug]',
            params: { slug: l === 'en' ? input.slugEn : input.slugFr },
          },
        }),
      ),
    },
    openGraph: {
      type: 'website',
      title: input.name,
      description: description !== undefined ? description.slice(0, 200) : undefined,
      locale: ogLocale(input.locale),
      alternateLocale: [...buildHotelOpenGraphAlternates(input.locale)],
      siteName: 'MyConciergeHotel',
      url: canonicalUrl,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.name,
      description: description !== undefined ? description.slice(0, 200) : undefined,
      images: [ogImageUrl],
    },
  };
}

/**
 * Lightweight kit metadata for `generateMetadata` — avoids the full
 * `prepareHotelKitModel` pipeline (Travelport, related hotels, HTML).
 */
export function buildHotelKitMetadata(locale: Locale, detail: HotelDetail): Metadata {
  if (locale !== 'fr' && locale !== 'en') {
    throw new Error(`Hotel kit metadata supports fr/en only, got ${locale}`);
  }
  const kitLocale = locale;
  const row = patchKitGoldenRow(detail.row);
  const factualSummary = readFactualSummary(row, kitLocale);
  const slugFr = row.slug;
  const slugEn = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;

  return composeHotelKitMetadata({
    locale: kitLocale,
    slugFr,
    slugEn,
    row,
    name: pickName(row, kitLocale),
    city: row.city,
    district: row.district ?? '',
    region: row.region,
    isPalace: row.is_palace,
    stars: row.stars as 1 | 2 | 3 | 4 | 5,
    description: pickDescription(row, kitLocale),
    factualSummaryText: factualSummary?.text ?? null,
    heroPublicId: readHeroImage(row),
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  });
}

/** Derives metadata from a fully-built kit model (tests / JSON-LD tooling). */
export function buildHotelKitMetadataFromModel(model: HotelKitModel): Metadata {
  return composeHotelKitMetadata({
    locale: model.locale,
    slugFr: model.slugFr,
    slugEn: model.slugEn,
    row: model.row,
    name: model.name,
    city: model.city,
    district: model.district,
    region: model.region,
    isPalace: model.isPalace,
    stars: model.stars,
    description: model.description,
    factualSummaryText: model.factualSummary?.text ?? null,
    heroPublicId: readHeroImage(model.row),
    cloudName: model.cloudName,
  });
}
