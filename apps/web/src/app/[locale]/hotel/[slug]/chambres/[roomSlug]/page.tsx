import { HotelImage, buildCloudinarySrc } from '@mch/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { BookingWidget } from '@/components/hotel/booking-widget';
import { ConciergeAdvice } from '@/components/hotel/concierge-advice';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { formatIndicativePriceParts } from '@/lib/format-indicative-price';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';
import { getBestOfferForHotel } from '@/server/hotels/get-best-offer';
import { readConciergeAdvice } from '@/server/hotels/get-hotel-by-slug';
import {
  getRoomBySlug,
  isRoomSubpageIndexable,
  readRoomConciergeAdvice,
  type HotelRoomDetail,
} from '@/server/hotels/get-room-by-slug';
import { listPublishedRoomSlugs } from '@/server/hotels/get-room-by-slug';

/**
 * Room sub-page — CDC §2 bloc 6 (Phase 10.1).
 *
 * Each room type of a published hotel is indexable at
 * `/hotel/{hotel-slug}/chambres/{room-slug}` (FR) and
 * `/en/hotel/{hotel-slug}/chambres/{room-slug}` (EN), with:
 *   - `HotelRoom` JSON-LD (size, occupancy, bed, amenityFeature,
 *     `containedInPlace` back to the parent hotel),
 *   - breadcrumb JSON-LD (Home › Hotels › City › Hotel › Room),
 *   - canonical + hreflang alternates,
 *   - hero LCP image driven by Cloudinary,
 *   - long-form editorial copy + amenity grid,
 *   - return link to the parent hotel detail page.
 *
 * Rendering mode mirrors the parent hotel page (`force-dynamic`): the
 * page reads `headers()` to forward the per-request CSP nonce to its
 * inline `HotelRoom` + `BreadcrumbList` JSON-LD scripts. Combining the
 * dynamic API with `revalidate` would silently strip the nonce and the
 * strict-dynamic CSP would block the structured data — see
 * `components/seo/json-ld.tsx` for the design.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/[\s,;.:!?-]+$/u, '');
  return `${cut}…`;
}

function pickHotelName(detail: HotelRoomDetail, locale: Locale): string {
  const row = detail.hotel.row;
  const enName = row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name;
  return pickByLocale(locale, row.name, enName);
}

function pickHotelSlug(detail: HotelRoomDetail, locale: Locale): string {
  const row = detail.hotel.row;
  const enSlug = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;
  return pickByLocale(locale, row.slug, enSlug);
}

export async function generateStaticParams(): Promise<
  Array<{ locale: string; slug: string; roomSlug: string }>
> {
  try {
    const slugs = await listPublishedRoomSlugs();
    const params: Array<{ locale: string; slug: string; roomSlug: string }> = [];
    for (const s of slugs) {
      params.push({ locale: 'fr', slug: s.hotelSlugFr, roomSlug: s.roomSlug });
      params.push({
        locale: 'en',
        slug: s.hotelSlugEn ?? s.hotelSlugFr,
        roomSlug: s.roomSlug,
      });
    }
    return params;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; roomSlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug, roomSlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;

  const detail = await getRoomBySlug(slug, roomSlug, locale);
  if (!detail) return { robots: { index: false, follow: false } };

  // ADR-0009 + CDC §2 — rooms must be substantive enough to index.
  // Thin sub-pages (< 5 photos OR < 200 words description) keep the
  // human-readable page but ship `noindex,nofollow` so Google and the
  // LLM crawlers don't surface them as a "soft 404" / thin content
  // candidate. The parent hotel page remains the canonical surface.
  const isIndexable = isRoomSubpageIndexable(detail.room);

  const t = await getTranslations({ locale, namespace: 'roomPage' });
  const hotelName = pickHotelName(detail, locale);

  // Signature suites get a "— Suite signature" suffix in the meta-title
  // because they capture the property's hero queries (e.g. "suite vue
  // Tour Eiffel Peninsula"). Surfacing the editorial flag in the
  // SERP listing is documented to lift CTR on the long-tail hero
  // intents that drive room sub-page traffic.
  const baseTitle = t('meta.titleFallback', { roomName: detail.room.name, hotelName });
  const title = detail.room.isSignature
    ? t('meta.signatureSuffix', { base: baseTitle })
    : baseTitle;
  const desc =
    detail.room.shortDescription !== null && detail.room.shortDescription.length > 0
      ? truncate(detail.room.shortDescription, 160)
      : t('meta.descriptionFallback', {
          roomName: detail.room.name,
          hotelName,
          city: detail.hotel.row.city,
        });

  // Slug selection stays locale-aware (data-layer concern) until
  // ADR-0012 Phase 3 collapses dual-locale columns into a single
  // `hotel_translations` table — see docs/runbooks/i18n-v2-rollout.md.
  // URL prefix is centralised via getPathname / buildHreflangAlternates.
  const buildCanonicalPath = (l: Locale): string => {
    const hotelSlug = pickHotelSlug(detail, l);
    return getPathname({
      locale: l,
      href: {
        pathname: '/hotel/[slug]/chambres/[roomSlug]',
        params: { slug: hotelSlug, roomSlug: detail.room.slug },
      },
    });
  };
  const canonical = buildCanonicalPath(locale);
  const absoluteUrl = `${siteOrigin()}${canonical}`;

  // Open Graph / Twitter Card image — mirrors the hotel page treatment
  // (Phase 10.18) so room sub-pages share visibly when posted to social
  // platforms. We pick the room hero image (or the first gallery image)
  // and ship a 1200×630 JPEG via Cloudinary's named transforms — the
  // canonical OG card size that LinkedIn, Twitter, Facebook, Slack and
  // WhatsApp all crop predictably.
  const ogPublicId = detail.room.heroImage ?? detail.room.images[0]?.publicId ?? null;
  const ogImageUrl =
    ogPublicId !== null
      ? buildCloudinarySrc({
          cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          publicId: ogPublicId,
          transforms: 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630',
        })
      : undefined;
  const ogImages =
    ogImageUrl !== undefined
      ? [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: detail.room.images[0]?.alt ?? detail.room.name,
            type: 'image/jpeg' as const,
          },
        ]
      : undefined;

  return {
    title,
    description: desc,
    ...(isIndexable ? {} : { robots: { index: false, follow: false } }),
    alternates: {
      canonical,
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      type: 'website',
      title,
      description: desc,
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
      url: absoluteUrl,
      ...(ogImages !== undefined ? { images: ogImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      ...(ogImageUrl !== undefined ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; roomSlug: string }>;
}) {
  const { locale: raw, slug, roomSlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const detail = await getRoomBySlug(slug, roomSlug, locale);
  if (!detail) notFound();

  const t = await getTranslations('roomPage');
  return renderRoomPage(locale, detail, t);
}

function defaultRoomStay(): {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
} {
  // Mirror the hotel page default (today + 30 / +33). Keeps the room
  // sub-page widget aligned with the parent hotel widget on cold visit.
  const now = new Date();
  const ci = new Date(now.getTime() + 30 * 86_400_000);
  const co = new Date(now.getTime() + 33 * 86_400_000);
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { checkIn: fmt(ci), checkOut: fmt(co), adults: 2, children: 0 };
}

function lockActionFor(locale: Locale, hotelId: string, offerId: string | null): string {
  // Same fallback shape as the parent hotel page — when no live offer
  // is available we ship the synthetic `TEST-OFFER-<id>` so the form
  // still posts, and the lock route returns 400 in production (form
  // is only rendered when bookable anyway). Keeps the room-widget
  // semantics identical to the parent hotel widget.
  const id = offerId ?? `TEST-OFFER-${hotelId}`;
  return getPathname({
    locale,
    href: { pathname: '/reservation/offer/[offerId]/lock', params: { offerId: id } },
  });
}

async function renderRoomPage(
  locale: Locale,
  detail: HotelRoomDetail,
  t: Awaited<ReturnType<typeof getTranslations<'roomPage'>>>,
) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const origin = siteOrigin();
  const hotelName = pickHotelName(detail, locale);
  const hotelLocaleSlug = pickHotelSlug(detail, locale);
  const hotelHref = {
    pathname: '/hotel/[slug]',
    params: { slug: hotelLocaleSlug },
  } as const;
  const hotelUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/hotel/[slug]', params: { slug: hotelLocaleSlug } },
  })}`;
  const roomUrl = `${origin}${getPathname({
    locale,
    href: {
      pathname: '/hotel/[slug]/chambres/[roomSlug]',
      params: { slug: hotelLocaleSlug, roomSlug: detail.room.slug },
    },
  })}`;

  const { room } = detail;
  const hotelRow = detail.hotel.row;
  const heroPublicId = room.heroImage ?? room.images[0]?.publicId ?? null;
  const heroAlt = room.images[0]?.alt ?? room.name;
  const galleryImages = room.images.filter((img) => img.publicId !== heroPublicId);

  const longDescriptionParagraphs =
    room.longDescription !== null && room.longDescription.length > 0
      ? room.longDescription.split(/\n\n+/u)
      : null;

  const jsonLdImages: string[] = [];
  if (heroPublicId !== null) {
    jsonLdImages.push(buildCloudinarySrc({ cloudName, publicId: heroPublicId }));
  }
  for (const img of galleryImages.slice(0, 4)) {
    jsonLdImages.push(buildCloudinarySrc({ cloudName, publicId: img.publicId }));
  }

  const roomJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.hotelRoomJsonLd({
      name: room.name,
      url: roomUrl,
      ...(room.longDescription !== null && room.longDescription.length > 0
        ? { description: truncate(room.longDescription, 500) }
        : room.shortDescription !== null && room.shortDescription.length > 0
          ? { description: truncate(room.shortDescription, 500) }
          : {}),
      ...(room.sizeSqm !== null ? { floorSizeSqm: room.sizeSqm } : {}),
      ...(room.maxOccupancy !== null ? { maxOccupancy: room.maxOccupancy } : {}),
      ...(room.bedType !== null && room.bedType !== '' ? { bed: { typeLabel: room.bedType } } : {}),
      ...(jsonLdImages.length > 0 ? { images: jsonLdImages } : {}),
      ...(room.amenities.length > 0 ? { amenityFeatures: room.amenities } : {}),
      containedInHotelUrl: hotelUrl,
    }),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      {
        name: t('breadcrumb.hotels'),
        url: `${origin}${getPathname({ locale, href: '/recherche' })}`,
      },
      { name: hotelName, url: hotelUrl },
      { name: room.name, url: roomUrl },
    ]),
  );

  // Booking widget data (B5 — same lock funnel as the parent hotel).
  // We pre-fetch the best Amadeus offer for a default stay window so
  // the widget can show a "from" price + use a real `offerId` in the
  // lock URL. Concierge modes (email / display_only) skip the fetch
  // (no offer to surface) and use the concierge form.
  const stay = defaultRoomStay();
  const bookable = hotelRow.booking_mode === 'amadeus' || hotelRow.booking_mode === 'little';
  const fakeEnabled = isFakeOffersEnabled();
  const bestOffer = bookable
    ? await getBestOfferForHotel({
        hotelId: hotelRow.id,
        amadeusHotelId: hotelRow.amadeus_hotel_id !== '' ? hotelRow.amadeus_hotel_id : null,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        childAges: [],
      })
    : {
        offerId: null,
        priceFrom: null,
        limitedAvailability: null,
        availabilityState: 'unknown' as const,
      };

  // Offer JSON-LD (B3 / CDC §2.8). Emitted only when we have a live
  // Amadeus rate — never fabricated. `priceValidUntil` defaults to
  // today + 7 days to align with the parent hotel widget and avoid
  // stale-offer warnings from Google Rich Results / DSA art. 25.
  const offerJsonLd: Record<string, unknown> | null =
    bestOffer.priceFrom !== null && bestOffer.offerId !== null
      ? (JsonLd.withSchemaOrgContext(
          JsonLd.offerJsonLd({
            priceFromEUR: bestOffer.priceFrom.amount.fromMinor / 100,
            url: roomUrl,
            priceValidUntil: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
            availability:
              bestOffer.limitedAvailability !== null ? 'LimitedAvailability' : 'InStock',
          }),
        ) as unknown as Record<string, unknown>)
      : null;

  // Concierge advice (room-level first, falls back to hotel-level so
  // the room page never ships completely without a Voix-du-Concierge
  // anchor — keeps the editorial contract from ADR-0011 + CDC §2).
  const roomAdvice = readRoomConciergeAdvice(room, locale);
  const hotelAdvice = roomAdvice === null ? readConciergeAdvice(hotelRow, locale) : null;
  const conciergeAdvice = roomAdvice ?? hotelAdvice;

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={roomJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {offerJsonLd !== null ? <JsonLdScript data={offerJsonLd} nonce={nonce} /> : null}

      <nav aria-label={t('breadcrumb.label')} className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/recherche" className="hover:underline">
              {t('breadcrumb.hotels')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href={hotelHref} className="hover:underline">
              {hotelName}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {room.name}
          </li>
        </ol>
      </nav>

      <header className="mb-8">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">
          {t('eyebrow', { hotelName })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{room.name}</h1>
          {room.isSignature ? (
            <span
              data-room-signature
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-amber-900"
              aria-label={t('facts.signatureAria')}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 16 16"
                width={10}
                height={10}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 1.5l1.85 4.1 4.4.5-3.3 3 .95 4.4L8 11.4l-3.9 2.1.95-4.4-3.3-3 4.4-.5L8 1.5Z" />
              </svg>
              {t('facts.signatureBadge')}
            </span>
          ) : null}
        </div>

        <dl className="text-fg mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
          {room.sizeSqm !== null ? (
            <div className="flex items-baseline gap-1">
              <dt className="text-muted">{t('facts.size')}</dt>
              <dd className="font-medium">{t('facts.sizeValue', { count: room.sizeSqm })}</dd>
            </div>
          ) : null}
          {room.maxOccupancy !== null ? (
            <div className="flex items-baseline gap-1">
              <dt className="text-muted">{t('facts.occupancy')}</dt>
              <dd className="font-medium">
                {t('facts.occupancyValue', { count: room.maxOccupancy })}
              </dd>
            </div>
          ) : null}
          {room.bedType !== null && room.bedType !== '' ? (
            <div className="flex items-baseline gap-1">
              <dt className="text-muted">{t('facts.bed')}</dt>
              <dd className="font-medium">{room.bedType}</dd>
            </div>
          ) : null}
          {room.indicativePrice !== null
            ? (() => {
                const parts = formatIndicativePriceParts(room.indicativePrice, locale);
                const value =
                  parts.to !== null
                    ? t('facts.indicativePriceRange', { from: parts.from, to: parts.to })
                    : t('facts.indicativePriceFrom', { from: parts.from });
                return (
                  <div className="flex items-baseline gap-1" data-room-price>
                    <dt className="text-muted">{t('facts.price')}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                );
              })()
            : null}
        </dl>
      </header>

      {heroPublicId !== null ? (
        <figure className="relative mb-10 aspect-[16/9] overflow-hidden rounded-lg">
          <HotelImage
            cloudName={cloudName}
            publicId={heroPublicId}
            alt={heroAlt}
            width={1600}
            height={900}
            variant="hero"
            priority
            className="h-full w-full"
          />
        </figure>
      ) : null}

      <section aria-labelledby="room-description-title" className="mb-12 max-w-prose">
        <h2 id="room-description-title" className="text-fg mb-4 font-serif text-2xl">
          {t('sections.description')}
        </h2>
        {longDescriptionParagraphs !== null ? (
          <div className="prose text-fg/90 text-base">
            {longDescriptionParagraphs.map((p, idx) => (
              <p key={idx} className="mb-3 last:mb-0">
                {p}
              </p>
            ))}
          </div>
        ) : room.shortDescription !== null && room.shortDescription.length > 0 ? (
          <p className="text-fg/90 text-base">{room.shortDescription}</p>
        ) : (
          <p className="text-muted text-sm">{t('noDescription')}</p>
        )}
      </section>

      {room.amenities.length > 0 ? (
        <section aria-labelledby="room-amenities-title" className="mb-12">
          <h2 id="room-amenities-title" className="text-fg mb-3 font-serif text-2xl">
            {t('sections.amenities')}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {room.amenities.map((amenity) => (
              <li
                key={amenity}
                className="border-border bg-bg text-fg rounded-md border px-3 py-2 text-sm"
              >
                {amenity}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {galleryImages.length > 0 ? (
        <section aria-labelledby="room-gallery-title" className="mb-12">
          <h2 id="room-gallery-title" className="sr-only">
            {t('sections.gallery')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {galleryImages.slice(0, 8).map((img) => (
              <li key={img.publicId} className="relative aspect-square overflow-hidden rounded-md">
                <HotelImage
                  cloudName={cloudName}
                  publicId={img.publicId}
                  alt={img.alt}
                  width={400}
                  height={400}
                  variant="thumbnail"
                  className="h-full w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BookingWidget
        locale={locale}
        hotelId={hotelRow.id}
        hotelName={hotelName}
        bookingMode={hotelRow.booking_mode}
        defaultStay={stay}
        lockActionUrl={bookable ? lockActionFor(locale, hotelRow.id, bestOffer.offerId) : null}
        fakeEnabled={fakeEnabled}
        priceFrom={bestOffer.priceFrom}
        limitedAvailability={bestOffer.limitedAvailability}
        availabilityState={bestOffer.availabilityState}
        surface="room_widget"
        roomTypeCode={room.roomCode}
      />

      <ConciergeAdvice locale={locale} advice={conciergeAdvice} />

      <aside className="border-border bg-bg flex flex-wrap items-baseline justify-between gap-4 rounded-lg border p-5">
        <p className="text-muted text-sm">{t('returnHint', { hotelName })}</p>
        <Link
          href={hotelHref}
          className="border-border bg-bg text-fg hover:bg-muted/10 inline-flex rounded-md border px-4 py-2 text-sm font-medium"
        >
          {t('returnCta', { hotelName })}
        </Link>
      </aside>
    </main>
  );
}
