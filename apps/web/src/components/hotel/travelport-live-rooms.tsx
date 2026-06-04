import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { intlLocaleTag } from '@/i18n/runtime';
import { getTravelportLiveRoomList } from '@/server/booking/travelport-offer';

interface TravelportLiveRoomsProps {
  readonly slug: string;
  readonly locale: 'fr' | 'en';
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Async server component streamed inside a `<Suspense>` boundary on the hotel
 * fiche. It performs the (cached) Travelport availability lookup so the rest of
 * the page renders immediately instead of blocking on a multi-second upstream
 * call. When the hotel has no live rooms (non-pilot, or no availability) it
 * falls back to the editorial "no rooms" copy.
 *
 * The "Book" links carry default dates consistent with the rail so `/chambres`
 * opens on the same stay the fiche advertised (single, coherent entry point).
 */
export async function TravelportLiveRooms({
  slug,
  locale,
}: TravelportLiveRoomsProps): Promise<ReactElement> {
  const [tHotel, tCard] = await Promise.all([
    getTranslations({ locale, namespace: 'hotelPage' }),
    getTranslations({ locale, namespace: 'reservationRooms.card' }),
  ]);

  const liveRooms = await getTravelportLiveRoomList({ slug, locale });
  if (liveRooms.length === 0) {
    return <p className="text-muted text-sm">{tHotel('noRooms')}</p>;
  }

  const roomsHref = {
    pathname: '/reservation/sandbox/[slug]/chambres',
    params: { slug },
    query: { checkIn: addDaysIso(30), checkOut: addDaysIso(31), adults: '1' },
  } as const;

  const fmtEur = (minor: number): string =>
    new Intl.NumberFormat(intlLocaleTag(locale), {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(minor / 100);

  return (
    <ul className="flex flex-col gap-4" data-live-rooms="travelport">
      {liveRooms.map((liveRoom) => (
        <li key={liveRoom.roomLabel}>
          <article className="border-border bg-bg rounded-lg border p-4 sm:p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-fg font-serif text-lg">{liveRoom.roomLabel}</h3>
              {liveRoom.maxOccupancy !== null ? (
                <p className="text-muted text-xs">
                  {tHotel('rooms.occupancy', { count: liveRoom.maxOccupancy })}
                </p>
              ) : null}
            </header>
            {liveRoom.breakfastIncluded === true || liveRoom.refundable === true ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {liveRoom.breakfastIncluded === true ? (
                  <li className="border-border text-muted rounded-md border px-2 py-0.5 text-xs">
                    {tCard('breakfastIncluded')}
                  </li>
                ) : null}
                {liveRoom.refundable === true ? (
                  <li className="border-border text-muted rounded-md border px-2 py-0.5 text-xs">
                    {tCard('freeCancellation')}
                  </li>
                ) : null}
              </ul>
            ) : null}
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-muted text-xs" data-room-price-live>
                {tCard('from', { price: fmtEur(liveRoom.fromMinor) })}
              </span>
              <Link
                href={roomsHref}
                aria-label={tCard('bookAria', {
                  room: liveRoom.roomLabel,
                  price: fmtEur(liveRoom.fromMinor),
                })}
                className="border-border text-fg hover:bg-fg hover:text-bg inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {tCard('book')}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
