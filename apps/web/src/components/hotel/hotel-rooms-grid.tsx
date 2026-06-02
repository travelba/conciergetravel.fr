'use client';

/**
 * HotelRoomsGrid — golden-template (Airelles Gordes) rooms showcase.
 *
 * Renders the room catalogue as a 3-up card grid (photo + name +
 * description + CTA to the room sub-page). To keep the section compact
 * on hotels with a long room list, only the first `defaultVisible`
 * cards are shown; a toggle reveals the rest.
 *
 * Client component: the only interactivity is the show-more toggle.
 * All copy is passed in as `labels` so the component stays i18n-free,
 * and the full room list is always in the DOM after expansion (SEO).
 */
import { useState } from 'react';

import { Link } from '@/i18n/navigation';

export interface HotelRoomCardVM {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSignature: boolean;
  readonly isConciergePick: boolean;
  readonly conciergeNote: string | null;
  readonly occupancy: string | null;
  readonly priceLabel: string | null;
  readonly imageSrc: string | null;
  readonly imageAlt: string;
}

export interface HotelRoomsGridProps {
  readonly slug: string;
  readonly rooms: readonly HotelRoomCardVM[];
  readonly labels: {
    readonly viewDetail: string;
    readonly signatureBadge: string;
    readonly signatureAria: string;
    readonly conciergePick: string;
    readonly showAll: string;
    readonly showLess: string;
  };
  readonly defaultVisible?: number;
}

export function HotelRoomsGrid({ slug, rooms, labels, defaultVisible = 3 }: HotelRoomsGridProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = rooms.length > defaultVisible;
  const visibleRooms = expanded || !hasOverflow ? rooms : rooms.slice(0, defaultVisible);

  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-3">
        {visibleRooms.map((room) => {
          const roomHref = {
            pathname: '/hotel/[slug]/chambres/[roomSlug]',
            params: { slug, roomSlug: room.slug },
          } as const;
          return (
            <li key={room.id} className="h-full">
              <article
                className={
                  room.isConciergePick
                    ? 'bg-bg flex h-full flex-col overflow-hidden rounded-xl border border-amber-300 shadow-sm ring-2 ring-amber-200'
                    : 'border-border bg-bg flex h-full flex-col overflow-hidden rounded-xl border'
                }
              >
                <Link
                  href={roomHref}
                  className="group relative block aspect-[4/3] overflow-hidden bg-neutral-100"
                >
                  {room.imageSrc !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary asset, see photo-quality rules (no next/image on hotel assets)
                    <img
                      src={room.imageSrc}
                      alt={room.imageAlt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="text-muted flex h-full w-full items-center justify-center text-xs">
                      {room.name}
                    </span>
                  )}
                  {room.isConciergePick ? (
                    <span
                      className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white shadow"
                      aria-label={labels.conciergePick}
                    >
                      <span aria-hidden>★</span>
                      {labels.conciergePick}
                    </span>
                  ) : room.isSignature ? (
                    <span
                      className="absolute left-3 top-3 rounded-md border border-amber-200 bg-amber-50/95 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-amber-900"
                      aria-label={labels.signatureAria}
                    >
                      {labels.signatureBadge}
                    </span>
                  ) : null}
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="text-fg font-serif text-lg leading-tight">
                      <Link href={roomHref} className="hover:underline">
                        {room.name}
                      </Link>
                    </h3>
                    {room.occupancy !== null ? (
                      <span className="text-muted shrink-0 text-xs">{room.occupancy}</span>
                    ) : null}
                  </header>

                  {room.description !== null && room.description !== '' ? (
                    <p className="text-muted mt-2 line-clamp-3 text-sm">{room.description}</p>
                  ) : null}

                  <div className="mt-auto flex items-baseline justify-between gap-2 pt-4">
                    <Link
                      href={roomHref}
                      className="border-border text-fg hover:bg-fg hover:text-bg inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                    >
                      {labels.viewDetail}
                      <span aria-hidden>→</span>
                    </Link>
                    {room.priceLabel !== null ? (
                      <span className="text-muted text-xs" data-room-price>
                        {room.priceLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {hasOverflow ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="border-border text-fg hover:bg-fg hover:text-bg inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? labels.showLess : labels.showAll}
            <span
              aria-hidden
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
            >
              ↓
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
