'use client';

/**
 * HotelRoomsGrid — kit `template-hotel.html` rooms showcase (section #chambres).
 *
 * Renders the room catalogue as the kit `.rooms-carousel` (horizontal
 * scroll-snap track of `.room-v2` cards). Each card carries a `.mini-gallery`
 * (the per-room `images[]`, kit `.mg-track` + `.mg-dots`), the room name +
 * description, a `.rv2-facts` list (surface / bed / occupancy) and a
 * `.rv2-cta` row (price + "Sélectionner" → indexable room sub-page).
 *
 * Client component: the only interactivity is the carousel prev/next nav and
 * the per-gallery active-dot sync (scroll listeners). All copy is passed in as
 * `labels` so the component stays i18n-free, and every room is always in the
 * DOM (carousel track) so the catalogue stays crawlable / linkable (SEO).
 */
import { type ComponentProps, useCallback, useRef } from 'react';

import { RoomMiniGallery } from '@/components/hotel/room-mini-gallery';
import { Link } from '@/i18n/navigation';

type LinkHref = ComponentProps<typeof Link>['href'];

export interface HotelRoomFactLine {
  readonly kind: 'area' | 'bed';
  readonly text: string;
}

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
  /**
   * Per-room mini-gallery (kit `.mini-gallery`). Pre-built Cloudinary `src`
   * URLs + alt text. Empty when the room has no photo — the card then shows a
   * sober placeholder instead of fabricating an image.
   */
  readonly images: readonly { readonly src: string; readonly alt: string }[];
  /** Fallback alt / placeholder label when `images` is empty. */
  readonly imageAlt: string;
  /** Short factual chips (surface, bed, occupancy) for `.rv2-facts`. */
  readonly facts: readonly string[];
  /** Typed facts with icon hints for kit HTML renderer (area vs bed). */
  readonly factLines?: readonly HotelRoomFactLine[];
  /**
   * Pre-formatted live "from" price (multi-supplier / Travelport overlay).
   * When present (and the grid receives `bookHref`/`bookLabel`), the card
   * surfaces the live price + a booking CTA instead of the indicative
   * `priceLabel`. `null` keeps the editorial indicative price.
   */
  readonly livePriceText: string | null;
  /** Per-room accessible label for the booking CTA (when `livePriceText`). */
  readonly bookAria: string | null;
  /** Indexable room sub-page path (kit HTML renderer). */
  readonly roomPageHref?: string | undefined;
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
    readonly prevRoom: string;
    readonly nextRoom: string;
    readonly seeAll: string;
    readonly prevPhoto: string;
    readonly nextPhoto: string;
    readonly photoN: string;
  };
  readonly defaultVisible?: number;
  /** Shared booking destination for live-price cards (Phase 6 pilot). */
  readonly bookHref?: LinkHref | undefined;
  /** Booking CTA label (e.g. "Réserver"); required to show the live CTA. */
  readonly bookLabel?: string | undefined;
}

const CONCIERGE_STAR = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />
  </svg>
);

function FactIcon(): React.ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 13l9-9 9 9M5 11v9h14v-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HotelRoomsGrid({
  slug,
  rooms,
  labels,
  bookHref,
  bookLabel,
}: HotelRoomsGridProps): React.ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByCard = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (track === null) return;
    const first = track.querySelector<HTMLElement>('.room-v2');
    const step = first !== null ? first.offsetWidth + 18 : track.clientWidth * 0.8;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  return (
    <div className="mch-kit">
      <div className="carousel rooms-carousel">
        <div ref={trackRef} className="carousel-track">
          {rooms.map((room) => {
            const roomHref = {
              pathname: '/hotel/[slug]/chambres/[roomSlug]',
              params: { slug, roomSlug: room.slug },
            } as const;
            const showLiveCta =
              room.livePriceText !== null && bookHref !== undefined && bookLabel !== undefined;
            const pickOverlay = room.isConciergePick ? (
              <span className="cc-pick">
                {CONCIERGE_STAR}
                {labels.conciergePick}
              </span>
            ) : room.isSignature ? (
              <span className="cc-pick">
                {CONCIERGE_STAR}
                {labels.signatureBadge}
              </span>
            ) : null;

            return (
              <article
                key={room.id}
                className={room.isConciergePick ? 'room-v2 room-concierge' : 'room-v2'}
              >
                <RoomMiniGallery
                  images={room.images}
                  placeholder={room.imageAlt}
                  labels={{
                    prevPhoto: labels.prevPhoto,
                    nextPhoto: labels.nextPhoto,
                    photoN: labels.photoN,
                  }}
                  overlay={pickOverlay}
                />
                <div className="rv2-body">
                  <h3>
                    <Link href={roomHref} className="hover:underline">
                      {room.name}
                    </Link>
                  </h3>
                  {room.description !== null && room.description !== '' ? (
                    <p className="rv2-desc">{room.description}</p>
                  ) : null}
                  {room.conciergeNote !== null && room.conciergeNote !== '' ? (
                    <p className="cc-why">{room.conciergeNote}</p>
                  ) : null}
                  {room.facts.length > 0 ? (
                    <ul className="rv2-facts">
                      {room.facts.map((fact) => (
                        <li key={fact}>
                          <FactIcon />
                          {fact}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="rv2-cta">
                    {showLiveCta ? (
                      <span className="rv2-price" data-room-price-live>
                        {room.livePriceText}
                      </span>
                    ) : room.priceLabel !== null ? (
                      <span className="rv2-price" data-room-price>
                        {room.priceLabel}
                      </span>
                    ) : (
                      <span />
                    )}
                    {showLiveCta ? (
                      <Link
                        href={bookHref as LinkHref}
                        aria-label={room.bookAria ?? bookLabel}
                        className="btn btn-or"
                      >
                        {bookLabel}
                      </Link>
                    ) : (
                      <Link href={roomHref} className="btn btn-or">
                        {labels.viewDetail}
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {rooms.length > 1 ? (
          <>
            <button
              type="button"
              className="carousel-nav prev"
              aria-label={labels.prevRoom}
              onClick={() => scrollByCard(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="carousel-nav next"
              aria-label={labels.nextRoom}
              onClick={() => scrollByCard(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
