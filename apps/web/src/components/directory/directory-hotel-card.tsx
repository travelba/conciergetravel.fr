import type { ReactElement } from 'react';

import { HotelCard } from '@/components/shared/hotel-card';
import type { DirectoryHotel } from '@/server/annuaire/directory-shared';

/**
 * `<DirectoryHotelCard>` — OTA-style result row for the annuaire surfaces
 * (`/hotels/[pays]`, `/hotels/[pays]/[ville]`). ADR-0026.
 *
 * Thin adapter over the unified `<HotelCard>` (row variant): it maps the
 * `DirectoryHotel` shape to the card model and keeps the historical
 * `data-*` attributes used by analytics / e2e. The honest differentiator
 * stays the distinction badge (Palace / N★) — no fabricated price or score.
 * When a hotel has no photo yet an elegant monogram placeholder keeps the
 * row height stable.
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

  const media =
    hotel.thumbnailUrl !== null ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={hotel.thumbnailUrl}
        alt={`${hotel.name} — ${hotel.city}`}
        loading="lazy"
        decoding="async"
      />
    ) : (
      <div
        role="img"
        aria-label={hotel.name}
        className="from-surface-container to-surface-container-high flex h-full w-full items-center justify-center bg-gradient-to-br"
      >
        <span className="text-muted/40 font-serif text-4xl">{monogram(hotel.name)}</span>
      </div>
    );

  return (
    <HotelCard
      href={{ pathname: '/hotel/[slug]', params: { slug: hotel.slug } }}
      variant="row"
      name={hotel.name}
      location={location}
      distinction={{
        label: hotel.isPalace ? palaceLabel : `${hotel.stars}${starsSuffix}`,
        isPalace: hotel.isPalace,
      }}
      brandLabel={hotel.brand?.label ?? null}
      excerpt={hotel.excerpt}
      ctaLabel={viewLabel}
      media={media}
      dataAttrs={{
        'data-hotel-id': hotel.id,
        'data-stars': hotel.stars,
        'data-palace': hotel.isPalace ? '1' : '0',
        'data-brand': hotel.brand?.slug ?? '',
        'data-district': hotel.district ?? '',
        'data-city': hotel.city,
        'data-name': hotel.name,
      }}
    />
  );
}
