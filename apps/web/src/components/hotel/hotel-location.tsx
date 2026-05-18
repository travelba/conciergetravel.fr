import { getTranslations } from 'next-intl/server';

import { deriveWalkMinutes, formatDistanceMeters } from '@/lib/format-distance';

/**
 * Local alias for the translator instance returned by next-intl. Keeps
 * the helper components below typesafe without re-importing the
 * `TranslationValues` shape — next-intl already publishes a precise
 * polymorphic signature, we just forward it.
 */
type Translator = Awaited<ReturnType<typeof getTranslations>>;
import {
  formatOpeningHoursToday,
  parseOpeningHoursForToday,
} from '@/lib/poi-hours';
import type {
  LocalisedLocation,
  LocalisedPointOfInterest,
  LocalisedTransport,
  PoiBucket,
  TransportMode,
} from '@/server/hotels/get-hotel-by-slug';

import { HotelStaticMap } from './hotel-static-map';

interface HotelLocationProps {
  readonly locale: 'fr' | 'en';
  readonly hotelName: string;
  readonly city: string;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly location: LocalisedLocation;
}

const TRANSPORT_MODE_ORDER: readonly TransportMode[] = [
  'metro',
  'rer',
  'tram',
  'bus',
  'train',
  'taxi',
  'airport_shuttle',
];

/**
 * Bucket render order on the hotel page — `visit` first (anchor
 * destination signal — what the city is famous for), then `do`
 * (experiential — what the traveller will actually do), then `shop`
 * (utilitarian — what they'll be glad to know).
 *
 * Each bucket renders its own `<section>` with an `aria-labelledby` so
 * screen readers and the table of contents can jump straight to the
 * sub-section.
 */
const BUCKET_ORDER: readonly PoiBucket[] = ['visit', 'do', 'shop'];

function sortByWalk(pois: readonly LocalisedPointOfInterest[]): readonly LocalisedPointOfInterest[] {
  return [...pois].sort((a, b) => {
    const da = deriveWalkMinutes(a.walkMinutes, a.distanceMeters) ?? Number.MAX_SAFE_INTEGER;
    const db = deriveWalkMinutes(b.walkMinutes, b.distanceMeters) ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return a.distanceMeters - b.distanceMeters;
  });
}

function sortTransports(transports: readonly LocalisedTransport[]): readonly LocalisedTransport[] {
  return [...transports].sort((a, b) => {
    const ai = TRANSPORT_MODE_ORDER.indexOf(a.mode);
    const bi = TRANSPORT_MODE_ORDER.indexOf(b.mode);
    if (ai !== bi) return ai - bi;
    return a.distanceMeters - b.distanceMeters;
  });
}

/**
 * Groups POIs by the editorial bucket carried in the row. Legacy
 * rows without a `bucket` field still resolve to a sane default
 * thanks to {@link inferBucketFromType} in `get-hotel-by-slug.ts`,
 * so this groupBy never drops entries.
 */
function groupByBucket(
  pois: readonly LocalisedPointOfInterest[],
): Record<PoiBucket, readonly LocalisedPointOfInterest[]> {
  const out: Record<PoiBucket, LocalisedPointOfInterest[]> = { visit: [], do: [], shop: [] };
  for (const p of pois) out[p.bucket].push(p);
  return {
    visit: sortByWalk(out.visit),
    do: sortByWalk(out.do),
    shop: sortByWalk(out.shop),
  };
}

/**
 * Returns the median walking time across all POIs — used as the
 * AEO intro hook ("À ≤ X minutes à pied du quartier"). Falls back
 * to a sensible default when the catalogue is empty.
 */
function medianWalk(pois: readonly LocalisedPointOfInterest[]): number {
  if (pois.length === 0) return 5;
  const xs = pois
    .map((p) => deriveWalkMinutes(p.walkMinutes, p.distanceMeters))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (xs.length === 0) return 5;
  const mid = Math.floor(xs.length / 2);
  const value = xs.length % 2 === 1 ? xs[mid] : Math.round(((xs[mid - 1] ?? 0) + (xs[mid] ?? 0)) / 2);
  return value ?? 5;
}

/**
 * Location section for the hotel detail page — CDC §2 bloc 10.
 *
 * Surfaces:
 *   - The textual address (when available) + a static map.
 *   - An AEO lead line that opens the section with a quotable answer
 *     to the "what's around the hotel?" question — LLMs favour this
 *     shape for citation.
 *   - **Three sub-sections** (visit / do / shop) — splitting by intent
 *     is what travel publishers do (Yonder, Mr & Mrs Smith, Tablet)
 *     and what LLMs need to surface a coherent "things to do near X"
 *     answer.
 *   - A list of transport stations grouped by mode (metro first).
 *
 * Pure RSC. Self-elides when the row carries no address, no POI and
 * no transport entry.
 */
export async function HotelLocation({
  locale,
  hotelName,
  city,
  address,
  postalCode,
  latitude,
  longitude,
  location,
}: HotelLocationProps): Promise<React.ReactElement | null> {
  const hasPois = location.pointsOfInterest.length > 0;
  const hasTransports = location.transports.length > 0;
  if (!hasPois && !hasTransports && address === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const addressLine: string | null =
    address !== null
      ? postalCode !== null && !address.includes(postalCode)
        ? `${address}, ${postalCode} ${city}`
        : address
      : null;

  const mapHref =
    latitude !== null && longitude !== null
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`
      : null;

  const buckets = groupByBucket(location.pointsOfInterest);
  const transports = sortTransports(location.transports);
  const introWalk = medianWalk(location.pointsOfInterest);

  return (
    <section aria-labelledby="location-title" className="mb-12">
      <h2 id="location-title" className="text-fg mb-3 font-serif text-2xl">
        {t('sections.location')}
      </h2>

      {addressLine !== null ? (
        <p className="text-fg text-sm">
          <span className="text-muted">{t('location.addressLabel')}</span> {addressLine}
        </p>
      ) : (
        <p className="text-fg text-sm">
          <span className="text-muted">{t('location.cityLabel')}</span> {city}
        </p>
      )}

      {latitude !== null && longitude !== null ? (
        <HotelStaticMap
          locale={locale}
          hotelName={hotelName}
          latitude={latitude}
          longitude={longitude}
        />
      ) : null}

      {mapHref !== null ? (
        <p className="mt-3 text-sm">
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-fg underline"
            aria-label={t('location.mapAria', { hotelName })}
          >
            {t('location.viewMap')}
          </a>
        </p>
      ) : null}

      {hasPois ? (
        <p
          data-aeo="location-intro"
          className="text-fg/90 mt-6 max-w-prose text-sm leading-relaxed"
        >
          {t('location.intro', { walkMinutes: introWalk })}
        </p>
      ) : null}

      {hasPois
        ? BUCKET_ORDER.filter((b) => buckets[b].length > 0).map((bucket) => (
            <PoiBucketSection
              key={bucket}
              bucket={bucket}
              locale={locale}
              pois={buckets[bucket]}
              t={t}
            />
          ))
        : null}

      {hasTransports ? (
        <div className="mt-8" aria-labelledby="location-transports-title">
          <h3
            id="location-transports-title"
            className="text-fg mb-2 font-medium"
          >
            {t('location.transportsTitle')}
          </h3>
          <ul className="divide-border flex flex-col divide-y">
            {transports.map((tr) => (
              <li
                key={`${tr.mode}-${tr.line ?? ''}-${tr.station}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-fg">
                    <span className="text-muted text-xs uppercase tracking-wider">
                      {t(`location.transportMode.${tr.mode}`)}
                      {tr.line !== null ? ` ${tr.line}` : ''}
                    </span>{' '}
                    {tr.station}
                  </span>
                  {tr.notes !== null ? (
                    <span className="text-muted text-xs">{tr.notes}</span>
                  ) : null}
                </div>
                <span className="text-muted text-xs tabular-nums">
                  {t('location.distanceMeters', { meters: tr.distanceMeters })}
                  {tr.walkMinutes !== null
                    ? ` · ${t('location.walkMinutes', { count: tr.walkMinutes })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Single sub-section ("À visiter" / "À faire" / "Services & commerces").
 * Renders its own `<h3>` + AEO lead + a list of POI cards. Already
 * receives the POIs pre-sorted by walking distance.
 *
 * Kept as a local component (no `export`) because the front-end never
 * needs to render a bucket in isolation — always together with the
 * parent section's address + map block.
 */
function PoiBucketSection({
  bucket,
  locale,
  pois,
  t,
}: {
  readonly bucket: PoiBucket;
  readonly locale: 'fr' | 'en';
  readonly pois: readonly LocalisedPointOfInterest[];
  readonly t: Translator;
}): React.ReactElement {
  const titleId = `location-bucket-${bucket}-title`;
  return (
    <div className="mt-8" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-fg font-medium">
        {t(`location.buckets.${bucket}.title`)}
      </h3>
      <p className="text-muted mt-1 max-w-prose text-sm leading-relaxed">
        {t(`location.buckets.${bucket}.lead`)}
      </p>
      <ul className="divide-border mt-3 flex flex-col divide-y">
        {pois.map((poi) => (
          <PoiCard
            key={`${poi.osmId ?? `${poi.name}-${poi.distanceMeters}`}`}
            locale={locale}
            poi={poi}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
}

function PoiCard({
  locale,
  poi,
  t,
}: {
  readonly locale: 'fr' | 'en';
  readonly poi: LocalisedPointOfInterest;
  readonly t: Translator;
}): React.ReactElement {
  const distance = formatDistanceMeters(poi.distanceMeters, locale);
  const walk = deriveWalkMinutes(poi.walkMinutes, poi.distanceMeters);

  // Opening hours — parse only when raw OSM string is present. We
  // intentionally read UTC weekday so the rendered text is ISR-stable
  // across viewers in different timezones.
  let hoursLabel: string | null = null;
  let hoursClosed = false;
  if (poi.openingHours !== null) {
    const parsed = parseOpeningHoursForToday(poi.openingHours);
    const formatted = formatOpeningHoursToday(parsed, locale);
    if (parsed.kind === 'closed') {
      hoursClosed = true;
      hoursLabel = t('location.openHoursTodayClosed');
    } else if (parsed.kind === '24_7') {
      hoursLabel = t('location.openHoursTodayAllDay');
    } else if (formatted !== null) {
      hoursLabel = t('location.openHoursToday', { hours: formatted });
    }
  }

  // Pricing badge.
  let pricingLabel: string | null = null;
  if (poi.pricing !== null) {
    const { type, amountEur, currency } = poi.pricing;
    if (type === 'free') {
      pricingLabel = t('location.pricing.free');
    } else if (type === 'donation') {
      pricingLabel = t('location.pricing.donation');
    } else if (type === 'mixed') {
      pricingLabel = t('location.pricing.mixed');
    } else if (amountEur !== null) {
      pricingLabel = t('location.pricing.paid', { amount: amountEur, currency });
    } else {
      pricingLabel = t('location.pricing.paidNoAmount');
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-fg font-medium">{poi.name}</span>
          {poi.category !== null ? (
            <span className="text-muted text-xs">{poi.category}</span>
          ) : null}
        </div>
        <span className="text-muted text-xs tabular-nums">
          {distance}
          {walk !== null ? ` · ${t('location.walkMinutes', { count: walk })}` : ''}
        </span>
      </div>

      {poi.description !== null ? (
        <p className="text-fg/85 max-w-prose text-sm leading-snug">{poi.description}</p>
      ) : null}

      {hoursLabel !== null || pricingLabel !== null || poi.nearestTransit !== null ? (
        <ul className="flex flex-wrap items-center gap-2 text-xs">
          {hoursLabel !== null ? (
            <li
              className={
                hoursClosed
                  ? 'border-border text-muted rounded-full border px-2 py-0.5 italic'
                  : 'border-border text-fg/80 rounded-full border px-2 py-0.5'
              }
            >
              {hoursLabel}
            </li>
          ) : null}
          {pricingLabel !== null ? (
            <li className="border-border text-fg/80 rounded-full border px-2 py-0.5">
              {pricingLabel}
            </li>
          ) : null}
          {poi.nearestTransit !== null ? (
            <li className="border-border text-fg/80 rounded-full border px-2 py-0.5">
              {t('location.nearestTransitBadge', {
                mode: t(`location.transportMode.${poi.nearestTransit.mode === 'subway' ? 'metro' : poi.nearestTransit.mode === 'light_rail' ? 'rer' : poi.nearestTransit.mode === 'rail' ? 'train' : poi.nearestTransit.mode === 'monorail' ? 'train' : poi.nearestTransit.mode}`),
                line: poi.nearestTransit.lineRef ?? '_',
                name: poi.nearestTransit.name,
                distance: formatDistanceMeters(poi.nearestTransit.distanceMeters, locale),
              })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
