import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import type { Metadata } from 'next';

import { JsonLd } from '@mch/seo';

import { buildCloudinarySrc } from '@mch/ui';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

import { isHotelKitSlug } from './is-hotel-kit-slug';

/** Token map aligned with `DA/docs/TEMPLATES_GUIDE.md`. */
export interface HotelKitLocaleContent {
  readonly HOTEL_NOM: string;
  readonly VILLE: string;
  readonly VILLE_SLUG: string;
  readonly PAYS: string;
  readonly PAYS_SLUG: string;
  readonly PAYS_ISO: string;
  readonly SLUG_HOTEL: string;
  readonly TYPE: string;
  readonly ETOILES: string;
  readonly ETOILES_SYMBOLES: string;
  readonly ACCROCHE_LIEU: string;
  readonly ARRONDISSEMENT: string;
  readonly DISTINCTION: string;
  readonly META_DESCRIPTION: string;
  readonly OG_DESCRIPTION: string;
  readonly SCHEMA_DESCRIPTION: string;
  readonly ADRESSE_RUE: string;
  readonly CODE_POSTAL: string;
  readonly LATITUDE: string;
  readonly LONGITUDE: string;
  readonly NOTE: string;
  readonly NOTE_FR: string;
  readonly NOTE_LABEL: string;
  readonly NB_AVIS: string;
  readonly NB_PHOTOS: string;
  readonly ATOUT_1: string;
  readonly ATOUT_2: string;
  readonly ATOUT_3: string;
  readonly ATOUT_4: string;
  readonly PRIX_NOUS: string;
  readonly PRIX_OFFICIEL: string;
  readonly PRIX_BOOKING: string;
  readonly PRIX_EXPEDIA: string;
  readonly title: string;
}

interface HotelKitManifest {
  readonly slug: string;
  readonly bodyTemplate: string;
  readonly fr: HotelKitLocaleContent;
  readonly en: HotelKitLocaleContent;
}

const CONTENT_DIR = path.join(process.cwd(), 'src/content/hotels');

let cachedManifest: HotelKitManifest | null = null;

function loadManifest(): HotelKitManifest {
  if (cachedManifest !== null) return cachedManifest;
  const raw = fs.readFileSync(path.join(CONTENT_DIR, 'les-airelles-gordes.json'), 'utf8');
  cachedManifest = JSON.parse(raw) as HotelKitManifest;
  return cachedManifest;
}

function loadBodyTemplate(fileName: string): string {
  return fs.readFileSync(path.join(CONTENT_DIR, fileName), 'utf8');
}

function localizePaths(html: string, locale: Locale): string {
  if (locale === 'fr') return html;
  return html
    .replaceAll('href="/fr/', 'href="/en/')
    .replaceAll(
      '/reservation/sandbox/les-airelles-gordes/chambres',
      '/reservation/sandbox/les-airelles-gordes-en/chambres',
    )
    .replaceAll('href="/en/hotel/les-airelles-gordes"', 'href="/en/hotel/les-airelles-gordes-en"');
}

function siteOrigin(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? 'https://myconciergehotel.com';
  return raw.replace(/\/$/, '');
}

export function getHotelKitLocaleContent(
  slug: string,
  locale: Locale,
): HotelKitLocaleContent | null {
  if (!isHotelKitSlug(slug)) return null;
  const manifest = loadManifest();
  return locale === 'en' ? manifest.en : manifest.fr;
}

export function getHotelKitBodyHtml(locale: Locale): string {
  const manifest = loadManifest();
  const html = loadBodyTemplate(manifest.bodyTemplate);
  return localizePaths(html, locale);
}

export function buildHotelKitMetadata(slug: string, locale: Locale): Metadata | null {
  const content = getHotelKitLocaleContent(slug, locale);
  if (content === null) return null;

  const slugFr = 'les-airelles-gordes';
  const slugEn = 'les-airelles-gordes-en';
  const canonicalPath = getPathname({
    locale,
    href: {
      pathname: '/hotel/[slug]',
      params: { slug: locale === 'en' ? slugEn : slugFr },
    },
  });
  const origin = siteOrigin();
  const absoluteUrl = `${origin}${canonicalPath}`;

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const ogImageUrl = buildCloudinarySrc({
    cloudName,
    publicId: 'cct/hotels/les-airelles-gordes/press-1',
    transforms: 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630',
  });

  return {
    title: { absolute: content.title },
    description: content.META_DESCRIPTION,
    alternates: {
      canonical: canonicalPath,
      languages: buildHreflangAlternates((l) =>
        getPathname({
          locale: l,
          href: {
            pathname: '/hotel/[slug]',
            params: { slug: l === 'en' ? slugEn : slugFr },
          },
        }),
      ),
    },
    openGraph: {
      type: 'website',
      title: content.HOTEL_NOM,
      description: content.OG_DESCRIPTION,
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
      url: absoluteUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: content.HOTEL_NOM }],
    },
    twitter: {
      card: 'summary_large_image',
      title: content.HOTEL_NOM,
      description: content.OG_DESCRIPTION,
      images: [ogImageUrl],
    },
  };
}

export function buildHotelKitJsonLd(slug: string, locale: Locale): Record<string, unknown>[] {
  const content = getHotelKitLocaleContent(slug, locale);
  if (content === null) return [];

  const origin = siteOrigin();
  const canonicalPath = getPathname({
    locale,
    href: {
      pathname: '/hotel/[slug]',
      params: { slug: content.SLUG_HOTEL },
    },
  });
  const url = `${origin}${canonicalPath}`;

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const heroUrl = buildCloudinarySrc({
    cloudName,
    publicId: 'cct/hotels/les-airelles-gordes/press-1',
    transforms: 'f_auto,q_auto,w_1200,h_900,c_fill,g_auto',
  });

  const hotelNode = JsonLd.withSchemaOrgContext(
    JsonLd.hotelJsonLd({
      name: content.HOTEL_NOM,
      url,
      starRating: Number(content.ETOILES) as 5,
      isPalace: true,
      description: content.SCHEMA_DESCRIPTION,
      images: [heroUrl],
      amenityFeatures: [content.ATOUT_1, content.ATOUT_2, content.ATOUT_3, content.ATOUT_4],
      telephone: '+33 4 90 72 12 12',
      numberOfRooms: 40,
      priceRange: '€€€€',
      aggregateRating: {
        ratingValue: Number(content.NOTE),
        reviewCount: Number(content.NB_AVIS.replace(/\s/g, '')),
        bestRating: 5,
        worstRating: 1,
      },
      geo: {
        latitude: Number(content.LATITUDE),
        longitude: Number(content.LONGITUDE),
      },
      address: {
        streetAddress: content.ADRESSE_RUE,
        addressLocality: content.VILLE,
        postalCode: content.CODE_POSTAL,
        addressCountry: content.PAYS_ISO,
        addressRegion: "Provence-Alpes-Côte d'Azur",
      },
    }),
  );

  const breadcrumbNode = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: locale === 'fr' ? 'Accueil' : 'Home',
        url: `${origin}${getPathname({ locale, href: '/' })}`,
      },
      { name: content.PAYS, url: `${origin}${getPathname({ locale, href: '/destination' })}` },
      {
        name: content.VILLE,
        url: `${origin}${getPathname({ locale, href: { pathname: '/destination/[citySlug]', params: { citySlug: content.VILLE_SLUG } } })}`,
      },
      { name: content.HOTEL_NOM, url },
    ]),
  );

  return [hotelNode, breadcrumbNode] as unknown as Record<string, unknown>[];
}
