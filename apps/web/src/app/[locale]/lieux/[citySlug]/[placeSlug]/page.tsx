import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { placeKindToSchemaClass, isPlaceKind } from '@mch/domain/places';
import { JsonLd } from '@mch/seo';

import {
  PlaceAskConcierge,
  PlaceGygBlock,
  PlaceNearbyHotels,
} from '@/components/lieux/place-blocks';
import { PlaceGallery } from '@/components/lieux/place-gallery';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';
import {
  getGygProductsForPlace,
  getNearbyHotelsForPlace,
  getPlaceBySlug,
} from '@/server/places/get-place-by-slug';
import { listPublishedPlaceParams } from '@/server/places/list-places';
import {
  PLACE_GALLERY_HEIGHT,
  PLACE_GALLERY_TRANSFORM,
  PLACE_GALLERY_WIDTH,
  PLACE_HERO_HEIGHT,
  PLACE_HERO_TRANSFORM,
  PLACE_HERO_WIDTH,
  pickPlaceGallery,
  pickPlaceLocalized,
  placeHeroSrc,
} from '@/server/places/place-view';

// JSON-LD via headers() nonce read forces dynamic; align with the hotel /
// classement precedent (force-dynamic) until hash-based CSP (ADR-0027).
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

export async function generateStaticParams(): Promise<
  { locale: string; citySlug: string; placeSlug: string }[]
> {
  try {
    const params = await listPublishedPlaceParams();
    const out: { locale: string; citySlug: string; placeSlug: string }[] = [];
    for (const p of params) {
      out.push({ locale: 'fr', citySlug: p.citySlug, placeSlug: p.slugFr });
      out.push({ locale: 'en', citySlug: p.citySlug, placeSlug: p.slugEn ?? p.slugFr });
    }
    return out;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string; placeSlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, citySlug, placeSlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const place = await getPlaceBySlug(citySlug, placeSlug);
  if (place === null) return {};
  const locale = raw;
  const view = pickPlaceLocalized(place, locale);

  const title = view.metaTitle ?? `${view.name} | MyConciergeHotel`;
  const description = view.metaDesc ?? view.factualSummary ?? undefined;

  // Use the canonical FR/EN slugs so hreflang points at the localized URL.
  const buildPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: {
        pathname: '/lieux/[citySlug]/[placeSlug]',
        params: {
          citySlug,
          placeSlug: l === 'en' && place.slug_en ? place.slug_en : place.slug,
        },
      },
    });

  const hero = placeHeroSrc(place.hero_image ?? null, 'c_fill,w_1200,h_630,f_auto,q_auto');

  return {
    title,
    ...(description !== undefined ? { description } : {}),
    alternates: {
      canonical: buildPath(locale),
      languages: buildHreflangAlternates(buildPath),
    },
    openGraph: {
      title,
      ...(description !== undefined ? { description } : {}),
      type: 'article',
      locale: ogLocale(locale),
      ...(hero !== null ? { images: [{ url: hero }] } : {}),
    },
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string; placeSlug: string }>;
}) {
  const { locale: raw, citySlug, placeSlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const place = await getPlaceBySlug(citySlug, placeSlug);
  if (place === null) notFound();

  const [t, gygProducts, nearbyHotels] = await Promise.all([
    getTranslations({ locale, namespace: 'lieux' }),
    getGygProductsForPlace(place.id),
    getNearbyHotelsForPlace(place.id),
  ]);

  const view = pickPlaceLocalized(place, locale);
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const canonicalSlug = locale === 'en' && place.slug_en ? place.slug_en : place.slug;
  const canonical = `${origin}${getPathname({
    locale,
    href: {
      pathname: '/lieux/[citySlug]/[placeSlug]',
      params: { citySlug, placeSlug: canonicalSlug },
    },
  })}`;
  const cityHref = getPathname({
    locale,
    href: { pathname: '/lieux/[citySlug]', params: { citySlug } },
  });

  const hero = placeHeroSrc(place.hero_image ?? null, PLACE_HERO_TRANSFORM);
  const gallery = pickPlaceGallery(place, locale);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const schemaType = isPlaceKind(place.kind)
    ? placeKindToSchemaClass(place.kind)
    : 'TouristAttraction';

  // ---- JSON-LD ----
  // ImageObject[] (Hard Rule 16): hero (representativeOfPage) + gallery, with
  // dimensions that match the delivered Cloudinary transform.
  const imageObjects: NonNullable<
    Parameters<typeof JsonLd.touristAttractionJsonLd>[0]['image']
  >[number][] = [];
  if (hero !== null) {
    imageObjects.push({
      contentUrl: hero,
      caption: view.name,
      width: PLACE_HERO_WIDTH,
      height: PLACE_HERO_HEIGHT,
      representativeOfPage: true,
    });
  }
  for (const img of gallery) {
    const src = placeHeroSrc(img.publicId, PLACE_GALLERY_TRANSFORM);
    if (src === null) continue;
    imageObjects.push({
      contentUrl: src,
      caption: img.alt,
      width: PLACE_GALLERY_WIDTH,
      height: PLACE_GALLERY_HEIGHT,
    });
  }

  const attractionNode = JsonLd.touristAttractionJsonLd({
    schemaType,
    name: view.name,
    url: canonical,
    ...(view.factualSummary !== null ? { description: view.factualSummary } : {}),
    ...(place.latitude !== null && place.longitude !== null
      ? { latitude: place.latitude, longitude: place.longitude }
      : {}),
    ...(place.address !== null && place.address !== undefined
      ? { streetAddress: place.address }
      : {}),
    addressLocality: place.city,
    addressCountry: place.country_code,
    ...(imageObjects.length > 0 ? { image: imageObjects } : {}),
  });

  const breadcrumbNode = JsonLd.breadcrumbJsonLd([
    {
      name: t('breadcrumbHome'),
      url: `${origin}${getPathname({ locale, href: { pathname: '/' } })}`,
    },
    { name: place.city, url: `${origin}${cityHref}` },
    { name: view.name, url: canonical },
  ]);

  const faqNode =
    view.faq.length > 0
      ? JsonLd.faqPageJsonLd(view.faq.map((e) => ({ question: e.question, answer: e.answer })))
      : null;

  const nearbyHotelsNode =
    nearbyHotels.length > 0
      ? JsonLd.itemListJsonLd({
          name: t('nearbyHotelsHeading'),
          items: nearbyHotels.map((h) => ({
            name: h.name,
            url: `${origin}${getPathname({
              locale,
              href: { pathname: '/hotel/[slug]', params: { slug: h.slug } },
            })}`,
          })),
        })
      : null;

  const jsonLdNodes = [
    JsonLd.withSchemaOrgContext(attractionNode),
    JsonLd.withSchemaOrgContext(breadcrumbNode),
    faqNode !== null ? JsonLd.withSchemaOrgContext(faqNode) : null,
    nearbyHotelsNode !== null ? JsonLd.withSchemaOrgContext(nearbyHotelsNode) : null,
  ].filter((n): n is NonNullable<typeof n> => n !== null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {jsonLdNodes.map((node, i) => (
        <JsonLdScript key={i} data={node} nonce={nonce} />
      ))}

      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <a
              href={`${getPathname({ locale, href: { pathname: '/' } })}`}
              className="hover:underline"
            >
              {t('breadcrumbHome')}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li>
            <a href={cityHref} className="hover:underline">
              {place.city}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground font-medium" aria-current="page">
            {view.name}
          </li>
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{view.name}</h1>
        {view.factualSummary !== null ? (
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">
            {view.factualSummary}
          </p>
        ) : null}
      </header>

      {hero !== null ? (
        <div className="mt-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary hero, served pre-sized */}
          <img src={hero} alt={view.name} className="h-[42vh] w-full object-cover" />
        </div>
      ) : null}

      <PlaceGallery images={gallery} cloudName={cloudName} heading={t('galleryHeading')} />

      {view.description !== null ? (
        <section aria-labelledby="about-heading" className="mt-12">
          <h2 id="about-heading" className="text-2xl font-semibold tracking-tight">
            {t('aboutHeading')}
          </h2>
          <div className="prose prose-neutral mt-4 max-w-none whitespace-pre-line text-base leading-relaxed">
            {view.description}
          </div>
        </section>
      ) : null}

      {view.conciergeBody !== null ? (
        <section
          aria-labelledby="concierge-heading"
          className="mt-12 rounded-lg border-l-4 border-amber-500 bg-amber-50/60 p-6"
        >
          <h2 id="concierge-heading" className="text-xl font-semibold tracking-tight">
            <span aria-hidden="true">⭐ </span>
            {view.conciergeTitle ?? t('conciergeAdviceHeading')}
          </h2>
          <p className="mt-3 text-base leading-relaxed">{view.conciergeBody}</p>
        </section>
      ) : null}

      <PlaceGygBlock
        products={gygProducts}
        locale={locale}
        labels={{
          heading: t('bookHeading'),
          bookVia: t('bookVia'),
          fromPrice: t('fromPrice'),
          reviews: t('reviews'),
        }}
      />

      <PlaceAskConcierge
        labels={{
          heading: t('askConciergeHeading'),
          body: t('askConciergeBody'),
          cta: t('askConciergeCta'),
        }}
      />

      {view.faq.length > 0 ? (
        <section aria-labelledby="faq-heading" className="mt-12">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
            {t('faqHeading')}
          </h2>
          <dl className="mt-6 space-y-5">
            {view.faq.map((e, i) => (
              <div key={i} className="border-border border-b pb-4">
                <dt className="font-medium">{e.question}</dt>
                <dd className="text-muted-foreground mt-2 text-sm leading-relaxed">{e.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <PlaceNearbyHotels
        hotels={nearbyHotels}
        locale={locale}
        labels={{
          heading: t('nearbyHotelsHeading'),
          intro: t('nearbyHotelsIntro'),
          walkMinutes: (min: number) => t('walkMinutes', { min }),
          distanceMeters: (m: number) => t('distanceMeters', { m }),
        }}
      />
    </main>
  );
}
