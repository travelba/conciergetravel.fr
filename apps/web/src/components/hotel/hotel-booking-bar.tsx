import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';

interface HotelBookingBarProps {
  readonly locale: SupportedLocale;
  readonly name: string;
  readonly city: string;
  readonly countryLabel: string;
}

/**
 * Sticky, rectangular search/booking bar for the golden-template fiche.
 *
 * Rendered as a sibling of the hero `<header>` (page level) — NOT inside it —
 * so its sticky containing block is the whole `<main>` and the bar stays
 * pinned just below the site header for the entire page scroll. At rest it
 * straddles the hero bottom edge (`-mt-8`).
 *
 * Phase 1 constraint (AGENTS.md §4ter): purely visual. "Voir les tarifs"
 * routes to `/le-concierge/reserver` — no GDS round-trip. It re-lands as the
 * live `<BookingWidget>` trigger in Phase 6 without markup churn.
 */
export async function HotelBookingBar({
  locale,
  name,
  city,
  countryLabel,
}: HotelBookingBarProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <div className="max-w-editorial sticky top-[68px] z-30 mx-auto -mt-8 mb-12 px-4">
      <div className="flex flex-col divide-y divide-neutral-200 border border-neutral-200 bg-white shadow-xl ring-1 ring-black/5 sm:flex-row sm:items-stretch sm:divide-x sm:divide-y-0">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3">
          <SearchIcon />
          <span className="text-fg truncate text-sm font-medium">
            {name} — {city}, {countryLabel}
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <CalendarIcon />
          <span className="text-muted text-sm">{t('hero.datesPlaceholder')}</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <GuestsIcon />
          <span className="text-muted text-sm">{t('hero.guests')}</span>
        </div>
        <Link
          href="/le-concierge/reserver"
          className="flex cursor-pointer items-center justify-center bg-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-700"
        >
          {t('hero.seeRates')}
        </Link>
      </div>
    </div>
  );
}

function SearchIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="text-muted h-4 w-4 shrink-0"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="text-muted h-4 w-4 shrink-0"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="text-muted h-4 w-4 shrink-0"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  );
}
