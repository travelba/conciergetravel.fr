import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { DirectoryHotel } from '@/server/annuaire/directory-shared';

/**
 * `<DirectoryHotelCard>` — OTA-style result row for the annuaire surfaces
 * (`/hotels/[pays]`, `/hotels/[pays]/[ville]`). ADR-0026.
 *
 * Follows the established OTA listing grammar (Booking / Expedia): a photo
 * thumbnail with the distinction badge overlaid, the hotel name + location,
 * a short factual excerpt and a clear call-to-action. Stacks (image on top)
 * on mobile, goes side-by-side on `sm+`.
 *
 * Deliberately free of price / availability / fabricated review scores —
 * the booking APIs are frozen until Phase 6 and ratings without a real
 * Amadeus/Google source are forbidden. The honest differentiator is the
 * distinction badge (Palace / N★). When a hotel has no photo yet (Phase 1,
 * most of the catalogue) an elegant monogram placeholder keeps the row
 * height stable.
 *
 * Presentational Server Component — all localised strings + the resolved
 * thumbnail URL are passed in by the parent, so the card stays free of
 * i18n / env coupling and trivially testable.
 */
interface DirectoryHotelCardProps {
  readonly hotel: DirectoryHotel;
  readonly palaceLabel: string;
  /** Star glyph suffix, e.g. "★". */
  readonly starsSuffix: string;
  readonly viewLabel: string;
  /** When true, the city (and optional district) is shown in the meta row. */
  readonly showCity?: boolean;
}

function monogram(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter.length > 0 ? letter : 'H';
}

export function DirectoryHotelCard({
  hotel,
  palaceLabel,
  starsSuffix,
  viewLabel,
  showCity = false,
}: DirectoryHotelCardProps): ReactElement {
  const location =
    showCity && hotel.district !== null && hotel.district.length > 0
      ? `${hotel.city} · ${hotel.district}`
      : showCity
        ? hotel.city
        : (hotel.district ?? '');

  const distinction = hotel.isPalace ? palaceLabel : `${hotel.stars}${starsSuffix}`;

  return (
    <Link
      href={{ pathname: '/hotel/[slug]', params: { slug: hotel.slug } }}
      prefetch={false}
      data-hotel-id={hotel.id}
      data-stars={hotel.stars}
      data-palace={hotel.isPalace ? '1' : '0'}
      data-brand={hotel.brand?.slug ?? ''}
      data-district={hotel.district ?? ''}
      data-city={hotel.city}
      data-name={hotel.name}
      className="border-border bg-bg group flex h-full flex-col overflow-hidden rounded-xl border transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:flex-row"
    >
      {/* Thumbnail — image on top (mobile) / left rail (sm+). */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-stone-100 sm:aspect-auto sm:w-52 md:w-56">
        {hotel.thumbnailUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hotel.thumbnailUrl}
            alt={`${hotel.name} — ${hotel.city}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            role="img"
            aria-label={hotel.name}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200"
          >
            <span className="font-serif text-4xl text-stone-300">{monogram(hotel.name)}</span>
          </div>
        )}
        <span
          className={
            hotel.isPalace
              ? 'absolute left-3 top-3 inline-flex items-center rounded-full bg-amber-700/95 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm'
              : 'absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-800 shadow-sm backdrop-blur-sm'
          }
        >
          {distinction}
        </span>
      </div>

      {/* Body. */}
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-fg font-serif text-lg leading-snug group-hover:text-amber-700 md:text-xl">
          {hotel.name}
        </h3>
        {location.length > 0 ? (
          <p className="text-muted mt-1 inline-flex items-center gap-1 text-xs">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              aria-hidden="true"
              className="shrink-0 fill-current opacity-70"
            >
              <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {location}
          </p>
        ) : null}
        {hotel.brand !== null ? (
          <p className="mt-1.5">
            <span className="border-border text-muted inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide">
              {hotel.brand.label}
            </span>
          </p>
        ) : null}
        {hotel.excerpt.length > 0 ? (
          <p className="text-muted mt-2 line-clamp-2 text-sm">{hotel.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-end pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-amber-800">
            {viewLabel}
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
