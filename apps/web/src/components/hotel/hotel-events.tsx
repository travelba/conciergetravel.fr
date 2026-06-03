import { getTranslations } from 'next-intl/server';

import { pickByLocale, type SupportedLocale } from '@/i18n/supported-locale';
import { formatDistanceMeters } from '@/lib/format-distance';
import type { EventCategory, LocalisedUpcomingEvent } from '@/server/hotels/get-hotel-by-slug';

/**
 * Local alias for the next-intl translator instance. See
 * `hotel-location.tsx` for the same pattern.
 */
type Translator = Awaited<ReturnType<typeof getTranslations>>;

interface HotelEventsProps {
  readonly locale: SupportedLocale;
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

  // Concierge-voice tip at section level. WS5 phase 1 ships the
  // i18n fallback; phase 3 (`run-humanizer-events.ts`) writes a
  // contextual sentence (e.g. cite a specific upcoming festival) on
  // the hotel row that the reader will surface when present.
  const conciergeTip = t('events.tipFallback');

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
        <p
          data-concierge-tip="events"
          className="border-accent/30 bg-bg text-fg/90 mt-2 max-w-prose rounded-md border-l-2 px-3 py-2 text-sm italic leading-snug"
        >
          {conciergeTip}
        </p>
      </header>

      <ul
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-aeo="upcoming-events"
      >
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
 * Per-event calendar card. A tear-off date chip (day + month, or a
 * recurrence glyph for year-round fixtures) anchors the card visually
 * like a calendar entry; the body carries category, title, the precise
 * date label, venue + distance + pricing, an optional description and
 * the official-source link.
 */
function EventCard({
  locale,
  event,
  t,
}: {
  readonly locale: SupportedLocale;
  readonly event: LocalisedUpcomingEvent;
  readonly t: Translator;
}): React.ReactElement {
  const dateParts = getEventDateParts(event.startDate, event.endDate, locale);
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

  const metaParts = [
    event.venueName !== null && event.venueName.length > 0 ? event.venueName : null,
    distance,
    pricingLabel,
  ].filter((p): p is string => p !== null && p.length > 0);

  return (
    <li className="border-border bg-bg hover:border-accent/40 flex h-full gap-4 rounded-xl border p-4 transition-colors sm:p-5">
      <DateChip parts={dateParts} category={event.category} />
      <div className="flex min-w-0 flex-col gap-1">
        <CategoryBadge category={event.category} t={t} />
        <h3 className="text-fg mt-0.5 text-base font-medium leading-snug">{event.name}</h3>
        <p className="text-accent text-xs font-medium tabular-nums">{dateLabel}</p>
        {metaParts.length > 0 ? (
          <p className="text-muted text-xs">{metaParts.join(' · ')}</p>
        ) : null}
        {event.description !== null ? (
          <p className="text-fg/90 mt-1 line-clamp-3 text-sm leading-relaxed">
            {event.description}
          </p>
        ) : null}
        {event.url !== null ? (
          <p className="mt-auto pt-1 text-xs">
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

/**
 * Calendar tear-off chip. Decorative (`aria-hidden`) — the precise,
 * year-bearing date label lives in the card body for assistive tech.
 *
 * Dated events show a day + short-month tear-off; permanent (year-round)
 * fixtures have no meaningful single date, so the chip falls back to the
 * category glyph — a clearer "what kind of outing" signal than the old
 * generic recurrence arrows.
 */
function DateChip({
  parts,
  category,
}: {
  readonly parts: EventDateParts;
  readonly category: EventCategory;
}): React.ReactElement {
  return (
    <div
      aria-hidden
      className="border-border bg-surface-1 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border"
    >
      {parts.kind === 'year-round' ? (
        <CategoryIcon category={category} className="text-accent h-7 w-7" strokeWidth={1.5} />
      ) : (
        <>
          <span className="text-fg text-lg font-semibold leading-none tabular-nums">
            {parts.day}
          </span>
          <span className="text-muted mt-1 text-[10px] font-medium uppercase tracking-wide">
            {parts.month}
          </span>
        </>
      )}
    </div>
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
    <span className="bg-surface-1 text-muted inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider">
      <CategoryIcon category={category} />
      {t(`events.category.${category}`)}
    </span>
  );
}

/**
 * Category glyph mapped 1:1 onto the six `EVENT_CATEGORIES` buckets so the
 * card telegraphs the *kind* of outing at a glance (concert, exhibition,
 * festival, sport, stage, other). Decorative — the textual category label
 * sits right next to it for assistive tech, so the SVG is `aria-hidden`.
 *
 * The `Record<EventCategory, …>` makes the mapping exhaustive: adding a
 * seventh category to `EVENT_CATEGORIES` is a compile error here until a
 * glyph is provided (TS strict, no silent fallback).
 */
const CATEGORY_ICON_PATHS: Record<EventCategory, React.ReactNode> = {
  // Musical note — concerts (classical + pop).
  concert: (
    <>
      <path d="M9 17V4l10-2v13" />
      <circle cx="6" cy="17" r="3" />
      <circle cx="16" cy="15" r="3" />
    </>
  ),
  // Framed picture — temporary exhibitions.
  expo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </>
  ),
  // Sparkle/star burst — festivals (music, arts, gastronomy).
  festival: (
    <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9z" />
  ),
  // Trophy — sporting fixtures (marathons, regattas, tennis).
  sport: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M6 4h12v4a6 6 0 0 1-12 0z" />
      <path d="M6 6H3.5v1A3.5 3.5 0 0 0 7 10.5M18 6h2.5v1A3.5 3.5 0 0 1 17 10.5" />
    </>
  ),
  // Comedy mask — theatre, opera, dance.
  theater: (
    <>
      <path d="M4 5c0 8 3.5 14 8 14s8-6 8-14c0 0-4 2-8 2S4 5 4 5z" />
      <path d="M9 11h.01M15 11h.01M9.5 14.5c1.2 1 3.8 1 5 0" />
    </>
  ),
  // Calendar — generic catch-all.
  other: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </>
  ),
};

function CategoryIcon({
  category,
  className = 'text-accent h-3.5 w-3.5 shrink-0',
  strokeWidth = 1.7,
}: {
  readonly category: EventCategory;
  readonly className?: string;
  readonly strokeWidth?: number;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {CATEGORY_ICON_PATHS[category]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Date formatting — purely server-side (Intl.DateTimeFormat is fine,
// no hydration mismatch risk because the rendered string is the same
// across renders given the same `Date`).
// ---------------------------------------------------------------------------

/**
 * Calendar-chip parts: either a year-round fixture (rendered as a
 * recurrence glyph) or a dated entry exposing the start day + short
 * month for the tear-off chip.
 */
type EventDateParts =
  | { readonly kind: 'year-round' }
  | { readonly kind: 'dated'; readonly day: string; readonly month: string };

/**
 * Decompose an event date range into the glanceable chip parts. The
 * year-round heuristic mirrors `formatEventDates` (1 Jan → 31 Dec of the
 * same year reads as a permanent fixture, not a dated event).
 */
function getEventDateParts(
  startIso: string,
  endIso: string | null,
  locale: SupportedLocale,
): EventDateParts {
  const start = new Date(`${startIso}T00:00:00Z`);
  if (endIso !== null && endIso !== startIso) {
    const end = new Date(`${endIso}T00:00:00Z`);
    if (
      start.getUTCFullYear() === end.getUTCFullYear() &&
      start.getUTCMonth() === 0 &&
      start.getUTCDate() === 1 &&
      end.getUTCMonth() === 11 &&
      end.getUTCDate() === 31
    ) {
      return { kind: 'year-round' };
    }
  }
  const day = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric' }).format(start);
  const month = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' })
    .format(start)
    .replace(/\.$/u, '');
  return { kind: 'dated', day, month };
}

/**
 * Format an event date range as a compact string per locale:
 *   single-day   → "12 juin 2026"        / "12 Jun 2026"
 *   multi-day    → "12 juin – 15 sept."  / "12 Jun – 15 Sep 2026"
 *
 * Always emits the year for the end date so the badge is unambiguous
 * even when the run spans into next year.
 */
function formatEventDates(
  startIso: string,
  endIso: string | null,
  locale: SupportedLocale,
): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  // Continental locales (FR/DE/ES/IT) keep the long month form; EN uses
  // short ("Sep" rather than "September") to match newsroom convention.
  // Phase 1c-β will move the choice into `next-intl` if a locale wants
  // to diverge further.
  const monthFull: Intl.DateTimeFormatOptions['month'] = pickByLocale(locale, 'long', 'short');
  const fmtFull = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: monthFull,
    year: 'numeric',
  });
  if (endIso === null || endIso === startIso) {
    return fmtFull.format(start);
  }
  const end = new Date(`${endIso}T00:00:00Z`);
  // A full calendar year (1 Jan → 31 Dec of the same year) reads as a
  // permanent fixture, not a dated event — surface it as "open year-round"
  // rather than the literal "1 janv. – 31 décembre 2026".
  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === 0 &&
    start.getUTCDate() === 1 &&
    end.getUTCMonth() === 11 &&
    end.getUTCDate() === 31
  ) {
    return pickByLocale(locale, 'Ouvert toute l’année', 'Open year-round');
  }
  const fmtShort = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
  // If the year is the same, only show the year on the end side.
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear === endYear) {
    return `${fmtShort.format(start)} – ${fmtFull.format(end)}`;
  }
  return `${fmtFull.format(start)} – ${fmtFull.format(end)}`;
}
