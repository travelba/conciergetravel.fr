import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { intlLocaleTag } from '@/i18n/runtime';
import type { SupportedLocale } from '@/i18n/supported-locale';

interface HotelTldrProps {
  readonly locale: SupportedLocale;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly isPalace: boolean;
  readonly totalRooms: number | null;
  readonly suites: number | null;
  readonly openedYear: number | null;
  readonly architects: readonly string[];
  /** Booking mode — drives the contextual CTA hint. */
  readonly bookingMode: 'amadeus' | 'little' | 'email' | 'display_only';
  /** ISO `YYYY-MM-DD` of last meaningful content update — freshness signal. */
  readonly dateModified: string | null;
}

function formatDateForLocale(iso: string, locale: SupportedLocale): string | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  try {
    return new Intl.DateTimeFormat(intlLocaleTag(locale), {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

const BOOKING_MESSAGE_KEY = {
  amadeus: 'bookingAmadeus',
  little: 'bookingLittle',
  email: 'bookingEmail',
  display_only: 'bookingDisplay',
} as const satisfies Record<HotelTldrProps['bookingMode'], string>;

/**
 * AEO "Quick answer" / TL;DR block (skill: geo-llm-optimization §AEO).
 *
 * Sits at the top of the fiche, immediately after the hero header.
 * Carries the 4-6 facts that LLM ingestion pipelines (Perplexity,
 * SearchGPT, AI Overviews) need to answer the most common queries:
 *
 *   - "Tell me about <hotel>"     → first sentence + status (Palace/5★)
 *   - "Where is <hotel>?"         → city + region
 *   - "How many rooms?"           → inventory line
 *   - "When was it built?"        → opened year + architect
 *   - "How do I book <hotel>?"    → booking-mode-aware CTA hint
 *   - Freshness signal            → dateModified line
 *
 * Stable id `#tldr` — referenced by the Hotel JSON-LD
 * `speakable.cssSelector` so Google Assistant picks up THIS block
 * (rather than a random paragraph) for voice answers.
 *
 * The wrapper is `<aside>` (not `<section>`) so search engines treat
 * it as a complementary summary, not as a duplicate of the main
 * `<h1>` heading. The visible style is a soft amber-tinted card,
 * compact (≤ 4 lines on desktop, ≤ 6 on mobile) so it never pushes
 * the hero gallery below the fold.
 *
 * Async server component — pulls copy via `getTranslations` so
 * DE/ES/IT in Phase 4 just need `messages/{de,es,it}.json` rows
 * (no code change).
 */
export async function HotelTldr({
  locale,
  name,
  city,
  region,
  isPalace,
  totalRooms,
  suites,
  openedYear,
  architects,
  bookingMode,
  dateModified,
}: HotelTldrProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelTldr' });

  // First sentence — status drives one of two structurally different
  // templates (FR/EN differ on whether the word "hôtel" is repeated
  // before the status fragment). Encoding the two shapes as separate
  // ICU templates is cleaner than splicing fragments at runtime.
  // International hotels (migration 0033) carry an empty `region` —
  // we swap to the dedicated `*NoRegion` template so the parenthesised
  // region fragment doesn't render as "({city} ())" — verified against
  // the live production deployment on the-beverly-hills-hotel.
  const hasRegion = region.trim().length > 0;
  const firstSentenceKey = isPalace
    ? hasRegion
      ? 'firstSentencePalace'
      : 'firstSentencePalaceNoRegion'
    : hasRegion
      ? 'firstSentenceFiveStar'
      : 'firstSentenceFiveStarNoRegion';
  const firstSentence = hasRegion
    ? t(firstSentenceKey, { name, city, region })
    : t(firstSentenceKey, { name, city });

  // Inventory line (only when known — never bluff).
  let inventoryLine: string | null = null;
  if (totalRooms !== null && totalRooms > 0) {
    inventoryLine =
      suites !== null && suites > 0
        ? t('inventoryWithSuites', { rooms: totalRooms, suites })
        : t('inventoryRoomsOnly', { rooms: totalRooms });
  }

  // Opened/architect — facts only, no fluff.
  const openedLine = openedYear !== null ? t('openedSince', { year: openedYear }) : null;
  let architectLine: string | null = null;
  if (architects.length === 1 && architects[0] !== undefined) {
    architectLine = t('architectSingle', { name: architects[0] });
  } else if (architects.length >= 2 && architects[0] !== undefined && architects[1] !== undefined) {
    architectLine = t('architectPair', { a: architects[0], b: architects[1] });
  }

  // Booking CTA hint.
  const bookingLine = t(BOOKING_MESSAGE_KEY[bookingMode]);

  const formattedDate = dateModified !== null ? formatDateForLocale(dateModified, locale) : null;

  return (
    <aside
      id="tldr"
      aria-label={t('eyebrow')}
      className="mb-10 rounded-xl border border-amber-200 bg-amber-50/50 p-5 md:p-6"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">
        {t('eyebrow')}
      </p>
      <p className="text-fg text-base leading-relaxed md:text-lg">
        {firstSentence}
        {inventoryLine !== null ? ' ' + inventoryLine + '.' : ''}
      </p>
      {openedLine !== null || architectLine !== null || bookingLine.length > 0 ? (
        <ul className="text-muted mt-3 space-y-1 text-sm md:text-base">
          {openedLine !== null ? <li>• {openedLine}.</li> : null}
          {architectLine !== null ? <li>• {architectLine}</li> : null}
          <li>• {bookingLine}</li>
        </ul>
      ) : null}
      {formattedDate !== null ? (
        <p className="text-muted/80 mt-3 text-xs">{t('updatedAt', { date: formattedDate })}</p>
      ) : null}
    </aside>
  );
}
