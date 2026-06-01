import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { SupportedLocale } from '@/i18n/supported-locale';

interface HotelEnBrefProps {
  readonly locale: SupportedLocale;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly district: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly totalRooms: number | null;
  readonly suites: number | null;
  readonly checkInFrom: string | null;
  readonly checkOutUntil: string | null;
  readonly petsAllowed: boolean | null;
  readonly openedYear: number | null;
  readonly lastRenovatedYear: number | null;
  readonly architects: readonly string[];
  /** Human-formatted last-update label (freshness signal). */
  readonly lastUpdatedLabel: string | null;
  /** Raw ISO-8601 timestamp for the machine-readable `<time dateTime>`. */
  readonly lastUpdatedIso: string | null;
}

/**
 * "En bref" — the single consolidated summary block of the hotel fiche
 * (fiche-reorganisation plan, F1). Merges the former `<HotelTldr>`
 * (AEO synthesis sentence) and `<HotelFactSheet>` (factual `<dl>`) into
 * one card so the top of the page no longer stacks four near-duplicate
 * "résumé" blocks.
 *
 * Structure (LLM-ingestion friendly — skill: geo-llm-optimization §AEO):
 *  1. A one-sentence, quotable synthesis (status + location + inventory).
 *  2. A `<dl>/<dt>/<dd>` of ground-truthable facts (address, category,
 *     rooms, check-in/out, pets, history, architects, coordinates).
 *  3. A single freshness badge — the **only** visible "updated at" signal
 *     on the page (footer + per-block duplicates removed). The JSON-LD
 *     `Hotel.dateModified` mirrors it.
 *
 * Deliberately drops the old `bookingMode` CTA hint: the site is
 * editorial-only until Phase 6 (ADR-0024) and the conversion slot lives
 * in the sticky rail, not in this block.
 *
 * Stable id `#en-bref` — referenced by the Hotel JSON-LD
 * `speakable.cssSelector` (page passes the updated selector list) and by
 * the sticky table of contents. `data-aeo` + `data-llm-summary` preserve
 * the GEO-audit grep surface inherited from `<HotelFactSheet>`.
 */
export async function HotelEnBref({
  locale,
  name,
  city,
  region,
  isPalace,
  stars,
  address,
  postalCode,
  district,
  latitude,
  longitude,
  totalRooms,
  suites,
  checkInFrom,
  checkOutUntil,
  petsAllowed,
  openedYear,
  lastRenovatedYear,
  architects,
  lastUpdatedLabel,
  lastUpdatedIso,
}: HotelEnBrefProps): Promise<ReactElement> {
  const tldr = await getTranslations({ locale, namespace: 'hotelTldr' });
  const fs = await getTranslations({ locale, namespace: 'hotelPage.factSheet' });

  // Synthesis sentence — status drives the template; international hotels
  // (migration 0033) carry an empty region and use the `*NoRegion` shape.
  const hasRegion = region.trim().length > 0;
  const firstSentenceKey = isPalace
    ? hasRegion
      ? 'firstSentencePalace'
      : 'firstSentencePalaceNoRegion'
    : hasRegion
      ? 'firstSentenceFiveStar'
      : 'firstSentenceFiveStarNoRegion';
  const firstSentence = hasRegion
    ? tldr(firstSentenceKey, { name, city, region })
    : tldr(firstSentenceKey, { name, city });

  let inventorySentence: string | null = null;
  if (totalRooms !== null && totalRooms > 0) {
    inventorySentence =
      suites !== null && suites > 0
        ? tldr('inventoryWithSuites', { rooms: totalRooms, suites })
        : tldr('inventoryRoomsOnly', { rooms: totalRooms });
  }

  // Factual `<dl>` rows — skip any null value so the block shrinks
  // gracefully on partial-data hotels.
  const addressLine: string | null =
    address !== null
      ? postalCode !== null && !address.includes(postalCode)
        ? `${address}, ${postalCode} ${city}`
        : address
      : null;

  const categoryLabel = isPalace ? fs('categoryPalace') : fs('categoryStars', { count: stars });

  const roomsLine: string | null =
    totalRooms !== null
      ? suites !== null && suites > 0
        ? fs('roomsWithSuites', { rooms: totalRooms, suites })
        : fs('roomsOnly', { rooms: totalRooms })
      : null;

  const checkInLine: string | null =
    checkInFrom !== null && checkOutUntil !== null
      ? fs('checkInOut', { in: checkInFrom, out: checkOutUntil })
      : checkInFrom !== null
        ? fs('checkInOnly', { in: checkInFrom })
        : checkOutUntil !== null
          ? fs('checkOutOnly', { out: checkOutUntil })
          : null;

  const petsLine: string | null =
    petsAllowed === null ? null : petsAllowed ? fs('petsYes') : fs('petsNo');

  const historyLine: string | null =
    openedYear !== null
      ? lastRenovatedYear !== null && lastRenovatedYear !== openedYear
        ? fs('historyOpenedRenovated', { opened: openedYear, renovated: lastRenovatedYear })
        : fs('historyOpenedOnly', { opened: openedYear })
      : lastRenovatedYear !== null
        ? fs('historyRenovatedOnly', { renovated: lastRenovatedYear })
        : null;

  let architectLine: string | null = null;
  if (architects.length === 1 && architects[0] !== undefined) {
    architectLine = tldr('architectSingle', { name: architects[0] });
  } else if (architects.length >= 2 && architects[0] !== undefined && architects[1] !== undefined) {
    architectLine = tldr('architectPair', { a: architects[0], b: architects[1] });
  }

  const geoLine: string | null =
    latitude !== null && longitude !== null
      ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      : null;

  const entries: Array<{ key: string; label: string; value: string }> = [];
  if (addressLine !== null) {
    entries.push({ key: 'address', label: fs('addressLabel'), value: addressLine });
  }
  if (district !== null && district !== '') {
    entries.push({ key: 'district', label: fs('districtLabel'), value: district });
  }
  entries.push({ key: 'category', label: fs('categoryLabel'), value: categoryLabel });
  if (roomsLine !== null) {
    entries.push({ key: 'rooms', label: fs('roomsLabel'), value: roomsLine });
  }
  if (checkInLine !== null) {
    entries.push({ key: 'checkin', label: fs('checkInOutLabel'), value: checkInLine });
  }
  if (petsLine !== null) {
    entries.push({ key: 'pets', label: fs('petsLabel'), value: petsLine });
  }
  if (historyLine !== null) {
    entries.push({ key: 'history', label: fs('historyLabel'), value: historyLine });
  }
  if (architectLine !== null) {
    entries.push({ key: 'architect', label: fs('architectLabel'), value: architectLine });
  }
  if (geoLine !== null) {
    entries.push({ key: 'geo', label: fs('geoLabel'), value: geoLine });
  }

  return (
    <aside
      id="en-bref"
      data-aeo
      data-llm-summary
      aria-label={tldr('eyebrow')}
      className="border-outline-variant bg-surface-container-low mb-16 scroll-mt-24 border p-6 md:p-8"
    >
      <p className="text-primary-heritage text-label-caps tracking-caps mb-3 uppercase">
        {tldr('eyebrow')}
      </p>
      <p className="text-on-surface text-body-lg leading-relaxed">
        {firstSentence}
        {inventorySentence !== null ? ' ' + inventorySentence + '.' : ''}
      </p>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.key} className="text-body-md flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-on-surface-variant shrink-0 font-medium sm:min-w-[8rem]">
              {entry.label}
            </dt>
            <dd className="text-on-surface">{entry.value}</dd>
          </div>
        ))}
      </dl>
      {lastUpdatedLabel !== null ? (
        <p
          data-freshness
          className="border-outline-variant text-on-surface-variant text-label-caps mt-6 inline-flex max-w-full items-center gap-1.5 border px-3 py-1"
          aria-label={fs('updatedAtAria', { date: lastUpdatedLabel })}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 16"
            width={12}
            height={12}
            className="text-primary-heritage shrink-0"
          >
            <path
              d="M5 1.5v1.25M11 1.5v1.25M2.5 5.75h11M3.5 3.25h9a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.25a1 1 0 0 1 1-1Z"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
            />
          </svg>
          <span className="truncate">
            {fs('updatedAtShort')}{' '}
            {lastUpdatedIso !== null ? (
              <time dateTime={lastUpdatedIso} className="text-on-surface font-medium">
                {lastUpdatedLabel}
              </time>
            ) : (
              <span className="text-on-surface font-medium">{lastUpdatedLabel}</span>
            )}
          </span>
        </p>
      ) : null}
    </aside>
  );
}
