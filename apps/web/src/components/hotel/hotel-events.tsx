import { getTranslations } from 'next-intl/server';

import { formatDistanceMeters } from '@/lib/format-distance';
import type { EventCategory, LocalisedUpcomingEvent } from '@/server/hotels/get-hotel-by-slug';

/**
 * Local alias for the next-intl translator instance. See
 * `hotel-location.tsx` for the same pattern.
 */
type Translator = Awaited<ReturnType<typeof getTranslations>>;

interface HotelEventsProps {
  readonly locale: 'fr' | 'en';
  readonly hotelName: string;
  readonly city: string;
  readonly events: readonly LocalisedUpcomingEvent[];
}

/**
 * "Évènements à venir" / "Upcoming events" block (CDC §2 — "À
 * proximité").
 *
 * Renders **only** when at least one event is present — the surface
 * self-elides on hotels for which DT has no upcoming programming
 * (typical: Cheval Blanc St-Barth or hotels in DOM-TOM where the
 * regional ODT does not publish to DATAtourisme).
 *
 * Sort + cap (5) come from the reader (`readUpcomingEvents`); this
 * component is pure presentation. It is a Server Component — no
 * `'use client'` directive needed.
 */
export default async function HotelEvents({
  locale,
  hotelName,
  city,
  events,
}: HotelEventsProps): Promise<React.ReactElement | null> {
  if (events.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <section
      id="evenements"
      aria-labelledby="hotel-events-title"
      className="bg-surface-2 mt-12 scroll-mt-24 rounded-2xl px-6 py-8 sm:px-8"
    >
      <header className="flex flex-col gap-2">
        <h2 id="hotel-events-title" className="text-fg text-2xl font-semibold sm:text-3xl">
          {t('events.title')}
        </h2>
        <p className="text-muted max-w-prose text-sm leading-relaxed">
          {t('events.lead', { hotelName, city })}
        </p>
      </header>

      <ul className="divide-border mt-6 flex flex-col divide-y" data-aeo="upcoming-events">
        {events.map((event) => (
          <EventCard
            key={event.dtUuid ?? `${event.name}-${event.startDate}`}
            locale={locale}
            event={event}
            t={t}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Per-event card. Surfaces date range, venue + distance, optional
 * description, optional pricing badge, optional official-source link.
 */
function EventCard({
  locale,
  event,
  t,
}: {
  readonly locale: 'fr' | 'en';
  readonly event: LocalisedUpcomingEvent;
  readonly t: Translator;
}): React.ReactElement {
  const dateLabel = formatEventDates(event.startDate, event.endDate, locale);
  const distance = formatDistanceMeters(event.distanceMeters, locale);

  let pricingLabel: string | null = null;
  if (event.pricing !== null) {
    if (event.pricing.type === 'free') {
      pricingLabel = t('events.pricing.free');
    } else if (event.pricing.amountEur !== null) {
      pricingLabel = t('events.pricing.paid', { amount: event.pricing.amountEur });
    } else {
      pricingLabel = t('events.pricing.paidNoAmount');
    }
  }

  return (
    <li className="py-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-fg text-base font-medium">
            <CategoryBadge category={event.category} t={t} />
            <span className="ml-2">{event.name}</span>
          </h3>
          <span className="text-muted text-xs tabular-nums">{dateLabel}</span>
        </div>
        <p className="text-muted text-xs">
          {event.venueName !== null && event.venueName.length > 0 ? `${event.venueName} · ` : ''}
          {distance}
          {pricingLabel !== null ? ` · ${pricingLabel}` : ''}
        </p>
        {event.description !== null ? (
          <p className="text-fg/90 mt-1 max-w-prose text-sm leading-relaxed">{event.description}</p>
        ) : null}
        {event.url !== null ? (
          <p className="mt-1 text-xs">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline focus-visible:underline"
            >
              {t('events.officialSource')}
            </a>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function CategoryBadge({
  category,
  t,
}: {
  readonly category: EventCategory;
  readonly t: Translator;
}): React.ReactElement {
  return (
    <span className="bg-surface-1 text-muted inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider">
      {t(`events.category.${category}`)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date formatting — purely server-side (Intl.DateTimeFormat is fine,
// no hydration mismatch risk because the rendered string is the same
// across renders given the same `Date`).
// ---------------------------------------------------------------------------

/**
 * Format an event date range as a compact string per locale:
 *   single-day   → "12 juin 2026"        / "12 Jun 2026"
 *   multi-day    → "12 juin – 15 sept."  / "12 Jun – 15 Sep 2026"
 *
 * Always emits the year for the end date so the badge is unambiguous
 * even when the run spans into next year.
 */
function formatEventDates(startIso: string, endIso: string | null, locale: 'fr' | 'en'): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const fmtFull = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: locale === 'fr' ? 'long' : 'short',
    year: 'numeric',
  });
  if (endIso === null || endIso === startIso) {
    return fmtFull.format(start);
  }
  const end = new Date(`${endIso}T00:00:00Z`);
  const fmtShort = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: locale === 'fr' ? 'short' : 'short',
  });
  // If the year is the same, only show the year on the end side.
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear) {
    return `${fmtShort.format(start)} – ${fmtFull.format(end)}`;
  }
  return `${fmtFull.format(start)} – ${fmtFull.format(end)}`;
}
