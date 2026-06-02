import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';

import { HotelFavoriteButton } from './hotel-favorite-button';
import { HotelShareButton } from './hotel-share-button';

interface HotelHeroOverlayProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly name: string;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly canonicalUrl: string;
  readonly localePath: string;
  readonly description: string | null;
  readonly cloudName: string;
  readonly heroPublicId: string | null;
  readonly heroAlt: string;
  readonly countryLabel: string;
  readonly cityHubSlug: string;
}

const HERO_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_2400,h_1350';

/**
 * Full-bleed cinematic hotel header (golden-template variant — L'Artisien
 * inspired). The hero photo runs edge-to-edge with a legibility scrim;
 * breadcrumb sits top-left, share/save float top-right, and the identity
 * block (stars + H1 + address) is centred. A floating, INERT booking bar
 * straddles the bottom edge.
 *
 * Phase 1 constraint (AGENTS.md §4ter): the booking bar is purely visual.
 * "Voir les tarifs" anchors to `#booking` (the passive `<BookingComingSoon>`
 * rail) — no GDS round-trip, no live availability. It re-lands as the live
 * `<BookingWidget>` trigger in Phase 6 without markup churn.
 */
export async function HotelHeroOverlay({
  locale,
  hotelId,
  name,
  address,
  postalCode,
  city,
  district,
  region,
  isPalace,
  stars,
  canonicalUrl,
  localePath,
  description,
  cloudName,
  heroPublicId,
  heroAlt,
  countryLabel,
  cityHubSlug,
}: HotelHeroOverlayProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const addressLine = formatAddressLine(address ?? '', postalCode, city, district);

  return (
    <header
      id="hotel-hero"
      data-hotel-hero
      className="relative left-1/2 -ml-[50vw] -mt-10 w-screen sm:-mt-14"
    >
      {/* Cinematic image band */}
      <div className="relative h-[64vh] min-h-[440px] w-full overflow-hidden md:h-[72vh]">
        {heroPublicId !== null ? (
          <HotelImage
            cloudName={cloudName}
            publicId={heroPublicId}
            alt={heroAlt}
            width={2400}
            height={1350}
            transforms={HERO_TRANSFORMS}
            priority
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-800" aria-hidden />
        )}

        {/* Legibility scrim — darker top (breadcrumb) and bottom (bar) */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/55"
        />

        {/* Content layer */}
        <div className="max-w-editorial relative mx-auto flex h-full flex-col px-4">
          {/* Top row — breadcrumb + actions */}
          <div className="flex items-start justify-between gap-4 pt-6">
            <nav
              aria-label={t('breadcrumb.hotels')}
              className="flex flex-wrap items-center gap-2 text-xs text-white/80 sm:text-sm"
            >
              <Link href="/" className="transition-colors hover:text-white">
                {t('breadcrumb.home')}
              </Link>
              <span aria-hidden className="text-white/40">
                /
              </span>
              <Link href="/destination" className="transition-colors hover:text-white">
                {countryLabel}
              </Link>
              <span aria-hidden className="text-white/40">
                /
              </span>
              <Link
                href={{ pathname: '/destination/[citySlug]', params: { citySlug: cityHubSlug } }}
                className="transition-colors hover:text-white"
              >
                {city}
              </Link>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <HotelShareButton
                hotelName={name}
                shareText={description !== null ? description.slice(0, 160) : null}
                canonicalUrl={canonicalUrl}
                buttonClassName="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm backdrop-blur transition-colors hover:bg-white"
              />
              <HotelFavoriteButton
                hotelId={hotelId}
                hotelName={name}
                returnPath={localePath}
                buttonClassName="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm backdrop-blur transition-colors hover:bg-white"
              />
            </div>
          </div>

          {/* Centred identity block */}
          <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center text-white">
            <div
              className="flex items-center gap-1.5 text-white"
              aria-label={isPalace ? t('hero.palace') : t('hero.stars', { count: stars })}
            >
              {Array.from({ length: stars }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>

            {isPalace ? (
              <span className="mt-3 inline-block rounded-full border border-white/50 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-white/90">
                {t('hero.palaceBadge')}
              </span>
            ) : null}

            <h1 className="mt-3 max-w-3xl font-serif text-3xl font-medium tracking-tight drop-shadow-sm sm:text-5xl md:text-6xl">
              {name}
            </h1>

            {addressLine.length > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-white/90 sm:text-sm">
                <LocationIcon />
                <span>{addressLine}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/*
        The search/booking bar is rendered as a page-level sibling
        (`<HotelBookingBar>`) so it can stay sticky for the whole page scroll —
        a bar nested here would un-stick the moment the short hero scrolls out.
      */}
      <span className="sr-only" data-canonical-path={localePath} data-region={region} />
    </header>
  );
}

function formatAddressLine(
  address: string,
  postalCode: string | null,
  city: string,
  district: string | null,
): string {
  const parts: string[] = [];
  if (address.trim().length > 0) parts.push(address.trim());
  const locality =
    postalCode !== null && postalCode !== '' ? `${postalCode} ${city}`.trim() : city.trim();
  if (locality.length > 0) parts.push(locality);
  if (district !== null && district !== '' && !locality.includes(district)) {
    parts.push(district);
  }
  return parts.join(', ');
}

function StarIcon(): ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
      <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94L12 2.5z" />
    </svg>
  );
}

function LocationIcon(): ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}
