import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { NearbyHotelLink, PlaceGygProduct } from '@/server/places/get-place-by-slug';
import type { PlaceListItem } from '@/server/places/list-places';
import { pickListName, pickListSummary, placeHeroSrc } from '@/server/places/place-view';

/** Format a minor-unit price (cents) into a localized "from X €" string. */
function formatPrice(minor: number | null, currency: string | null, locale: Locale): string | null {
  if (minor === null || minor <= 0) return null;
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} €`;
  }
}

interface GygBlockProps {
  readonly products: readonly PlaceGygProduct[];
  readonly locale: Locale;
  readonly labels: {
    readonly heading: string;
    readonly bookVia: string;
    readonly fromPrice: string;
    readonly reviews: string;
  };
}

/**
 * GetYourGuide affiliate booking block (Palier A — deeplink only, no
 * internal checkout, conforms to the API-last phasing §4ter). Every CTA
 * is an outbound affiliate deeplink built server-side.
 */
export function PlaceGygBlock({ products, locale, labels }: GygBlockProps): ReactElement | null {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="gyg-heading" className="mt-12">
      <h2 id="gyg-heading" className="text-2xl font-semibold tracking-tight">
        {labels.heading}
      </h2>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const price = formatPrice(p.priceFromMinor, p.currency, locale);
          return (
            <li
              key={p.tourId}
              className="border-border bg-bg flex flex-col overflow-hidden rounded-lg border transition hover:shadow-md"
            >
              {p.imageUrl !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote GYG CDN, dimensions unknown
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
              ) : null}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-medium leading-snug">{p.title}</h3>
                {p.abstract !== null ? (
                  <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{p.abstract}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-3 text-sm">
                  {p.rating !== null ? (
                    <span className="font-medium text-amber-800">
                      <span aria-hidden="true">★</span> {p.rating.toFixed(1)}
                      {p.reviewCount !== null ? (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          ({p.reviewCount} {labels.reviews})
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto pt-4">
                  {price !== null ? (
                    <p className="text-muted-foreground text-sm">
                      {labels.fromPrice}{' '}
                      <span className="text-foreground font-semibold">{price}</span>
                    </p>
                  ) : null}
                  <a
                    href={p.deeplinkUrl}
                    target="_blank"
                    rel="nofollow noopener sponsored"
                    className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    {labels.bookVia}
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface AskConciergeProps {
  readonly labels: {
    readonly heading: string;
    readonly body: string;
    readonly cta: string;
  };
}

/** "Ask the Concierge" CTA — links to the static editorial booking flow. */
export function PlaceAskConcierge({ labels }: AskConciergeProps): ReactElement {
  return (
    <section
      aria-labelledby="ask-concierge-heading"
      className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-6"
    >
      <h2 id="ask-concierge-heading" className="text-xl font-semibold tracking-tight">
        {labels.heading}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">{labels.body}</p>
      <Link
        href={{ pathname: '/le-concierge/contact' }}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
      >
        {labels.cta}
      </Link>
    </section>
  );
}

interface NearbyHotelsProps {
  readonly hotels: readonly NearbyHotelLink[];
  readonly locale: Locale;
  readonly labels: {
    readonly heading: string;
    readonly intro: string;
    readonly walkMinutes: (min: number) => string;
    readonly distanceMeters: (m: number) => string;
  };
}

/** "Hotels nearby" maillage retour block (place → hotels). */
export function PlaceNearbyHotels({ hotels, labels }: NearbyHotelsProps): ReactElement | null {
  if (hotels.length === 0) return null;
  return (
    <section aria-labelledby="nearby-hotels-heading" className="mt-12">
      <h2 id="nearby-hotels-heading" className="text-2xl font-semibold tracking-tight">
        {labels.heading}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">{labels.intro}</p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hotels.map((h) => {
          const src = placeHeroSrc(h.heroImage ?? null, 'c_fill,w_600,h_400,f_auto,q_auto');
          const distance =
            h.walkMinutes !== null
              ? labels.walkMinutes(h.walkMinutes)
              : labels.distanceMeters(Math.round(h.distanceMeters));
          return (
            <li
              key={h.slug}
              className="border-border bg-bg overflow-hidden rounded-lg border transition hover:shadow-md"
            >
              <Link
                href={{ pathname: '/hotel/[slug]', params: { slug: h.slug } }}
                className="focus-visible:ring-ring block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {src !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary, intrinsic dims not needed here
                  <img src={src} alt={h.name} loading="lazy" className="h-40 w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <h3 className="text-base font-medium">{h.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {h.city ? `${h.city} · ` : ''}
                    {distance}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface PlaceRankingCardProps {
  readonly item: PlaceListItem;
  readonly locale: Locale;
  readonly position: number;
  readonly viewLabel: string;
}

/** A single place card for the city ranking/index grid. */
export function PlaceRankingCard({
  item,
  locale,
  position,
  viewLabel,
}: PlaceRankingCardProps): ReactElement {
  const name = pickListName(item, locale);
  const summary = pickListSummary(item, locale);
  const src = placeHeroSrc(item.hero_image ?? null, 'c_fill,w_600,h_400,f_auto,q_auto');
  const slug = locale === 'en' && item.slug_en ? item.slug_en : item.slug;
  return (
    <li className="border-border bg-bg overflow-hidden rounded-lg border transition hover:shadow-md">
      <Link
        href={{
          pathname: '/lieux/[citySlug]/[placeSlug]',
          params: { citySlug: item.city_key, placeSlug: slug },
        }}
        className="focus-visible:ring-ring block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {src !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary, intrinsic dims not needed here
          <img src={src} alt={name} loading="lazy" className="h-44 w-full object-cover" />
        ) : null}
        <div className="p-5">
          <p className="text-sm font-semibold text-amber-800">N°{position}</p>
          <h3 className="mt-1 text-lg font-medium leading-snug">{name}</h3>
          {summary !== null ? (
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{summary}</p>
          ) : null}
          <span className="mt-3 inline-block text-sm font-medium text-neutral-900 underline underline-offset-4">
            {viewLabel}
          </span>
        </div>
      </Link>
    </li>
  );
}
