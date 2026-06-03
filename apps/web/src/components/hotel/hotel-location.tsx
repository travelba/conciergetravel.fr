import { getTranslations } from 'next-intl/server';

import { PracticalInfo } from '@/components/hotel/practical-info';
import type { SupportedLocale } from '@/i18n/supported-locale';
import {
  deriveTravelEstimate,
  deriveWalkMinutes,
  formatDistanceMeters,
} from '@/lib/format-distance';

/**
 * Local alias for the translator instance returned by next-intl. Keeps
 * the helper components below typesafe without re-importing the
 * `TranslationValues` shape — next-intl already publishes a precise
 * polymorphic signature, we just forward it.
 */
type Translator = Awaited<ReturnType<typeof getTranslations>>;
import { formatOpeningHoursToday, parseOpeningHoursForToday } from '@/lib/poi-hours';
import type {
  LocalisedLocation,
  LocalisedPoiBucketTips,
  LocalisedPointOfInterest,
  LocalisedTransport,
  PoiBucket,
  TransportMode,
} from '@/server/hotels/get-hotel-by-slug';

import { HotelStaticMap } from './hotel-static-map';

interface HotelLocationProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly city: string;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly location: LocalisedLocation;
  /**
   * Golden template only: render the address + static map + transport list,
   * but NOT the POI buckets. The buckets (visit / do / shop) are relocated
   * under the "Conseil du Concierge" cluster via {@link HotelNeighbourhoodBuckets}
   * so #lieu stays a focused "where + how to get there" block. Defaults to
   * `false` — every other fiche keeps the buckets inline.
   */
  readonly omitPois?: boolean;
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

function sortByWalk(
  pois: readonly LocalisedPointOfInterest[],
): readonly LocalisedPointOfInterest[] {
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
  const value =
    xs.length % 2 === 1 ? xs[mid] : Math.round(((xs[mid - 1] ?? 0) + (xs[mid] ?? 0)) / 2);
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
  omitPois = false,
}: HotelLocationProps): Promise<React.ReactElement | null> {
  const hasPois = location.pointsOfInterest.length > 0 && !omitPois;
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
              bucketTips={location.bucketTips}
              t={t}
            />
          ))
        : null}

      {hasTransports ? (
        <div className="mt-8" aria-labelledby="location-transports-title">
          <h3 id="location-transports-title" className="text-fg mb-2 font-medium">
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
                  {(() => {
                    const tt = deriveTravelEstimate(tr.walkMinutes, tr.distanceMeters);
                    if (tt === null) return '';
                    return ` · ${
                      tt.mode === 'drive'
                        ? t('location.driveMinutes', { count: tt.minutes })
                        : t('location.walkMinutes', { count: tt.minutes })
                    }`;
                  })()}
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
 * Neighbourhood buckets (visit / do / shop) extracted from
 * {@link HotelLocation} so the golden-template fiche can render them under the
 * "Conseil du Concierge" cluster instead of inside #lieu. Renders the AEO
 * "≤ X min walk" lead line followed by one block per non-empty bucket, each
 * carrying its concierge-voice tip and the per-POI practical handoff
 * (website / phone / hours / price / reservation / tip). Self-elides when the
 * row carries no POI. Pure RSC — no `'use client'`.
 */
export async function HotelNeighbourhoodBuckets({
  locale,
  location,
}: {
  readonly locale: SupportedLocale;
  readonly location: LocalisedLocation;
}): Promise<React.ReactElement | null> {
  if (location.pointsOfInterest.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const buckets = groupByBucket(location.pointsOfInterest);
  // The intro hook says "à X minutes à pied" — base it on the genuinely
  // walkable POIs (≤ ~1.5 km) so far-flung activities (a winery, a balloon
  // departure 18 km away) don't inflate the median into a misleading
  // "27-minute walk". Falls back to all POIs when none are walkable.
  const walkablePois = location.pointsOfInterest.filter((p) => p.distanceMeters <= 1500);
  const introWalk = medianWalk(walkablePois.length > 0 ? walkablePois : location.pointsOfInterest);
  return (
    <div className="mt-2">
      <p data-aeo="location-intro" className="text-fg/90 max-w-prose text-sm leading-relaxed">
        {t('location.intro', { walkMinutes: introWalk })}
      </p>
      {BUCKET_ORDER.filter((b) => buckets[b].length > 0).map((bucket) => (
        <PoiBucketSection
          key={bucket}
          bucket={bucket}
          locale={locale}
          pois={buckets[bucket]}
          bucketTips={location.bucketTips}
          t={t}
        />
      ))}
    </div>
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
  bucketTips,
  t,
}: {
  readonly bucket: PoiBucket;
  readonly locale: SupportedLocale;
  readonly pois: readonly LocalisedPointOfInterest[];
  readonly bucketTips: LocalisedPoiBucketTips;
  readonly t: Translator;
}): React.ReactElement {
  const titleId = `location-bucket-${bucket}-title`;
  const conciergeTip = bucketTips[bucket] ?? t(`location.buckets.${bucket}.tipFallback`);
  return (
    <div className="mt-8" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-fg font-medium">
        {t(`location.buckets.${bucket}.title`)}
      </h3>
      <p className="text-muted mt-1 max-w-prose text-sm leading-relaxed">
        {t(`location.buckets.${bucket}.lead`)}
      </p>
      <p
        data-concierge-tip={`bucket-${bucket}`}
        className="border-accent/30 bg-accent/5 text-fg/90 mt-3 max-w-prose rounded-md border-l-2 px-3 py-2 text-sm italic leading-snug"
      >
        {conciergeTip}
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pois.map((poi) => (
          <PoiRichCard
            key={`${poi.osmId ?? `${poi.name}-${poi.distanceMeters}`}`}
            locale={locale}
            poi={poi}
            t={t}
            icon={resolvePoiIcon(bucket, poi)}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Unified POI tile used by every bucket (visit / do / shop). Renders a
 * per-type medallion glyph on the left and a stacked body on the right:
 * name + category, distance/travel, a clamped description, a row of
 * compact badges (today's hours / pricing / nearest transit) and the
 * expandable {@link PracticalInfo} handoff. The `icon` is resolved upstream
 * by {@link resolvePoiIcon} so this component stays presentation-only.
 */
function PoiRichCard({
  locale,
  poi,
  t,
  icon,
}: {
  readonly locale: SupportedLocale;
  readonly poi: LocalisedPointOfInterest;
  readonly t: Translator;
  readonly icon: React.ReactNode;
}): React.ReactElement {
  const distance = formatDistanceMeters(poi.distanceMeters, locale);
  // Walking up to ~20 min, driving beyond that — "42 min à pied" reads as
  // broken guidance for a place a guest would obviously reach by car.
  const travel = deriveTravelEstimate(poi.walkMinutes, poi.distanceMeters);
  const { hoursLabel, hoursClosed, pricingLabel } = computePoiBadges(poi, locale, t);

  const transitBadge =
    poi.nearestTransit !== null
      ? t('location.nearestTransitBadge', {
          mode: t(
            `location.transportMode.${poi.nearestTransit.mode === 'subway' ? 'metro' : poi.nearestTransit.mode === 'light_rail' ? 'rer' : poi.nearestTransit.mode === 'rail' ? 'train' : poi.nearestTransit.mode === 'monorail' ? 'train' : poi.nearestTransit.mode}`,
          ),
          line: poi.nearestTransit.lineRef ?? '_',
          name: poi.nearestTransit.name,
          distance: formatDistanceMeters(poi.nearestTransit.distanceMeters, locale),
        })
      : null;

  return (
    <li className="border-border bg-bg hover:border-accent/40 flex h-full gap-4 rounded-xl border p-4 transition-colors sm:p-5">
      <PoiMedallion icon={icon} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-fg font-medium leading-snug">{poi.name}</span>
        {poi.category !== null ? <span className="text-muted text-xs">{poi.category}</span> : null}

        <p className="text-muted mt-0.5 text-xs tabular-nums">
          {distance}
          {travel !== null
            ? ` · ${
                travel.mode === 'drive'
                  ? t('location.driveMinutes', { count: travel.minutes })
                  : t('location.walkMinutes', { count: travel.minutes })
              }`
            : ''}
        </p>

        {poi.description !== null ? (
          <p className="text-fg/85 mt-1 line-clamp-3 text-sm leading-snug">{poi.description}</p>
        ) : null}

        {hoursLabel !== null || pricingLabel !== null || transitBadge !== null ? (
          <ul className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {hoursLabel !== null ? (
              <li
                className={
                  hoursClosed
                    ? 'border-border text-muted rounded-full border px-2 py-0.5 italic'
                    : 'border-accent/40 text-accent rounded-full border px-2 py-0.5'
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
            {transitBadge !== null ? (
              <li className="border-border text-fg/80 rounded-full border px-2 py-0.5">
                {transitBadge}
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className="mt-auto pt-2">
          <PracticalInfo
            hours={poi.hours}
            priceNote={poi.priceNote}
            phone={poi.phone}
            address={poi.address}
            website={poi.website}
            reservationUrl={poi.reservationUrl}
            tip={poi.tip}
            labels={{
              title: t('practical.title'),
              hoursLabel: t('practical.hoursLabel'),
              priceLabel: t('practical.priceLabel'),
              phoneLabel: t('practical.phoneLabel'),
              addressLabel: t('practical.addressLabel'),
              website: t('practical.website'),
              reserve: t('practical.reserve'),
              conciergeTip: t('practical.conciergeTip'),
            }}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * Shared "today's hours" + pricing badge computation for a POI. Consumed
 * by the unified {@link PoiRichCard} (visit / do / shop) so every bucket
 * reads from the exact same logic — the opening hours are parsed against
 * the UTC weekday so the rendered string is ISR-stable regardless of the
 * viewer's timezone.
 */
function computePoiBadges(
  poi: LocalisedPointOfInterest,
  locale: SupportedLocale,
  t: Translator,
): { hoursLabel: string | null; hoursClosed: boolean; pricingLabel: string | null } {
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

  return { hoursLabel, hoursClosed, pricingLabel };
}

// ---------------------------------------------------------------------------
// "Commerces à proximité" (shop bucket) — per-trade medallion glyphs,
// aligned on the upcoming-events visual language. The visit / do glyph
// families live just below; all three feed {@link resolvePoiIcon}.
// ---------------------------------------------------------------------------

/**
 * Normalised commerce families used to pick the medallion glyph. Mapped
 * from the raw OSM `type` and the localised `category`/`name` via
 * {@link resolveShopKind}. Exhaustive `Record` (see {@link SHOP_ICON_PATHS})
 * so a new family can't be added without a glyph.
 */
type ShopKind =
  | 'bakery'
  | 'pharmacy'
  | 'grocery'
  | 'wine'
  | 'oil'
  | 'cheese'
  | 'greengrocer'
  | 'butcher'
  | 'florist'
  | 'fashion'
  | 'books'
  | 'market'
  | 'bank'
  | 'beauty'
  | 'other';

/**
 * Keyword table driving {@link resolveShopKind}. Each family lists the
 * substrings (FR + EN + raw OSM tokens) that map onto it. Order matters:
 * the first family with a hit wins, so the more specific families
 * (oil mill, cheese, wine) are listed before the generic `grocery`.
 */
const SHOP_KIND_KEYWORDS: readonly (readonly [ShopKind, readonly string[]])[] = [
  ['bakery', ['boulang', 'patiss', 'pâtiss', 'bakery', 'pastry', 'viennois']],
  ['pharmacy', ['pharmac', 'chemist', 'parapharma']],
  ['oil', ['moulin', 'huile', 'olive oil', 'oil mill']],
  ['cheese', ['fromag', 'cheese', 'crémerie', 'cremerie', 'dairy']],
  ['wine', ['caviste', 'vin', 'wine', 'cave', 'spirits', 'œnolog', 'oenolog']],
  ['greengrocer', ['primeur', 'fruits', 'légume', 'legume', 'greengrocer', 'verger']],
  ['butcher', ['bouch', 'charcut', 'butcher', 'viande']],
  ['florist', ['fleur', 'florist', 'flower']],
  ['books', ['librair', 'book', 'presse', 'newsagent', 'journ', 'tabac']],
  ['market', ['marché', 'marche', 'market', 'halle']],
  ['bank', ['banque', 'bank', 'atm', 'distributeur', 'bureau de change', 'post_office', 'poste']],
  ['beauty', ['coiff', 'beaut', 'beauty', 'hairdress', 'spa', 'esthét', 'esthet', 'parfum']],
  ['fashion', ['mode', 'vêtement', 'vetement', 'clothes', 'fashion', 'boutique', 'concept store', 'maroquin', 'chauss', 'bijou', 'jewel']],
  [
    'grocery',
    ['épicer', 'epicer', 'grocery', 'deli', 'supermarket', 'supermarché', 'convenience', 'alimentation', 'gourmet', 'delicatessen', 'food', 'store', 'shop'],
  ],
];

function resolveShopKind(
  rawType: string | null,
  category: string | null,
  name: string | null,
): ShopKind {
  const haystack = `${rawType ?? ''} ${category ?? ''} ${name ?? ''}`.toLowerCase();
  for (const [kind, keywords] of SHOP_KIND_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return kind;
  }
  return 'other';
}

const SHOP_ICON_PATHS: Record<ShopKind, React.ReactNode> = {
  // Baguette / loaf.
  bakery: <path d="M4 14c-1.5-1.5-1.5-4 0-5.5l9-4.5c2-1 4.5 0 5.5 2s0 4.5-2 5.5l-9 4.5c-1.2.6-2.6.4-3.5-.5zM8 9l8-4M10 12l8-4" />,
  // Mortar & pestle / cross — pharmacy.
  pharmacy: (
    <>
      <path d="M12 3v4M10 5h4" />
      <rect x="5" y="9" width="14" height="11" rx="2" />
      <path d="M12 12v5M9.5 14.5h5" />
    </>
  ),
  // Shopping bag — generic grocery / deli / fine food.
  grocery: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  // Wine bottle + glass.
  wine: (
    <>
      <path d="M8 3h3v7a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 7h5" />
      <path d="M16 3v6a3 3 0 0 0 3 3m-3-3a3 3 0 0 1-3 3m3 9v-6" />
    </>
  ),
  // Olive branch — oil mill.
  oil: (
    <>
      <path d="M5 19c4-1 7-4 9-8 1.5-3 4-5 5-5" />
      <path d="M14 8a2 2 0 1 0 0 .01M10 12a2 2 0 1 0 0 .01M16 5a2 2 0 1 0 0 .01" />
    </>
  ),
  // Cheese wedge.
  cheese: (
    <>
      <path d="M4 16v-3l13-6 3 4v5z" />
      <path d="M4 13h16M9 14.5v.01M13 15v.01M16 14v.01" />
    </>
  ),
  // Apple — greengrocer.
  greengrocer: (
    <>
      <path d="M12 7c-2-2-6-1.5-6 3 0 5 3.5 9 6 9s6-4 6-9c0-4.5-4-5-6-3z" />
      <path d="M12 7c0-2 1-3.5 3-4" />
    </>
  ),
  // Cleaver — butcher.
  butcher: (
    <>
      <path d="M4 4l9 9M4 4c3 0 6 3 6 6M14 10l6 6a2 2 0 0 1-3 3l-6-6" />
    </>
  ),
  // Flower — florist.
  florist: (
    <>
      <path d="M12 9a3 3 0 1 0 0 .01M12 9c0-3-2-5-4-5s-1 4 1 5M12 9c0-3 2-5 4-5s1 4-1 5M12 12v8M9 16h6" />
    </>
  ),
  // Hanger — fashion.
  fashion: (
    <>
      <path d="M12 4a2 2 0 0 0 0 4c1 0 1.5.8 0 1.6L4 14a1.5 1.5 0 0 0 .8 2.8h14.4A1.5 1.5 0 0 0 20 14l-8-4.4" />
    </>
  ),
  // Open book.
  books: (
    <>
      <path d="M12 6c-2-1.2-4.5-1.5-7-1v13c2.5-.5 5-.2 7 1 2-1.2 4.5-1.5 7-1V5c-2.5-.5-5-.2-7 1zM12 6v13" />
    </>
  ),
  // Market stall / awning.
  market: (
    <>
      <path d="M4 9l1-4h14l1 4M4 9h16M4 9v11h16V9M4 9c0 1.5 1 2.5 2.7 2.5S9.3 10.5 9.3 9M9.3 9c0 1.5 1.2 2.5 2.7 2.5S14.7 10.5 14.7 9M14.7 9c0 1.5 1 2.5 2.7 2.5S20 10.5 20 9" />
    </>
  ),
  // Banknote — bank / ATM / bureau de change.
  bank: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v.01M18 15v.01" />
    </>
  ),
  // Scissors — hairdresser / beauty.
  beauty: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8 8.5 20 17M8 15.5 20 7" />
    </>
  ),
  // Storefront — generic catch-all.
  other: (
    <>
      <path d="M4 9l1-4h14l1 4M4 9h16M5 9v11h14V9M9 20v-5h6v5" />
    </>
  ),
};

function PoiMedallion({ icon }: { readonly icon: React.ReactNode }): React.ReactElement {
  return (
    <div
      aria-hidden
      className="border-accent/30 bg-accent/10 text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "À visiter" (visit bucket) — heritage / culture glyphs.
// ---------------------------------------------------------------------------

type VisitKind =
  | 'castle'
  | 'religious'
  | 'museum'
  | 'monument'
  | 'garden'
  | 'viewpoint'
  | 'nature'
  | 'water'
  | 'landmark';

const VISIT_KIND_KEYWORDS: readonly (readonly [VisitKind, readonly string[]])[] = [
  ['castle', ['castle', 'château', 'chateau', 'fort', 'citadelle', 'palais', 'palace']],
  [
    'religious',
    ['monaster', 'monastère', 'abbey', 'abbaye', 'church', 'église', 'eglise', 'cathedral', 'cathédrale', 'chapel', 'chapelle', 'basilique', 'religious', 'couvent', 'prieuré', 'prieure', 'cloître', 'cloitre'],
  ],
  ['museum', ['museum', 'musée', 'musee', 'gallery', 'galerie', 'exhibition', 'exposition', 'écomusée', 'ecomusee']],
  ['garden', ['garden', 'jardin', 'park', 'parc', 'botaniqu', 'arboretum']],
  ['viewpoint', ['viewpoint', 'belvédère', 'belvedere', 'panorama', 'point de vue', 'observatoire']],
  ['water', ['beach', 'plage', 'lake', 'lac', 'rivière', 'riviere', 'fontaine', 'source', 'cascade', 'gorge']],
  ['nature', ['nature', 'mountain', 'montagne', 'forest', 'forêt', 'foret', 'massif', 'réserve', 'reserve', 'site naturel']],
  [
    'monument',
    ['monument', 'heritage', 'patrimoine', 'memorial', 'mémorial', 'ruins', 'ruine', 'vestige', 'troglo', 'site', 'arc', 'pont', 'bridge', 'remparts', 'tour'],
  ],
];

function resolveVisitKind(rawType: string, category: string | null, name: string): VisitKind {
  const haystack = `${rawType} ${category ?? ''} ${name}`.toLowerCase();
  for (const [kind, keywords] of VISIT_KIND_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return kind;
  }
  return 'landmark';
}

const VISIT_ICON_PATHS: Record<VisitKind, React.ReactNode> = {
  // Crenellated castle.
  castle: (
    <path d="M4 21V9l2 1V7l2 1V7l2-1v3l2-1V7l2 1V7l2-1v3l2-1v12M4 21h16M9 21v-4h6v4" />
  ),
  // Bell tower / abbey with a cross.
  religious: (
    <>
      <path d="M12 2v4M10 4h4" />
      <path d="M6 22V11l6-4 6 4v11M6 22h12M10 22v-5h4v5" />
    </>
  ),
  // Classical museum facade (pediment + columns).
  museum: (
    <>
      <path d="M3 9l9-5 9 5M3 9h18" />
      <path d="M5 9v9M9 9v9M15 9v9M19 9v9M3 21h18" />
    </>
  ),
  // Triumphal arch / monument.
  monument: <path d="M6 21V11a6 6 0 0 1 12 0v10M6 21h12M10 21v-7a2 2 0 0 1 4 0v7" />,
  // Tree — garden / park.
  garden: (
    <>
      <path d="M12 3c-3 0-5 3-4 6-2 .6-3 4 0 5h8c3-1 2-4.4 0-5 1-3-1-6-4-6z" />
      <path d="M12 14v7M9 18h6" />
    </>
  ),
  // Mountains + sun — viewpoint.
  viewpoint: (
    <>
      <path d="M3 18l6-8 4 5 2-3 6 6M3 18h18" />
      <path d="M16 6a2 2 0 1 0 .01 0" />
    </>
  ),
  // Plain mountains — nature.
  nature: <path d="M3 20l6-11 4 6 2-3 6 8zM3 20h18" />,
  // Sun + waves — beach / lake.
  water: (
    <>
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M15 7a2.5 2.5 0 1 0 .01 0" />
    </>
  ),
  // Map pin — generic landmark.
  landmark: (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" />
      <path d="M12 10a2 2 0 1 0 .01 0" />
    </>
  ),
};

// ---------------------------------------------------------------------------
// "À faire" (do bucket) — experience / activity glyphs. The raw OSM `type`
// is often the catch-all `activity`, so the resolver also leans on the
// `name` (e.g. "Vol en montgolfière" → ballooning, "vélos" → cycling).
// ---------------------------------------------------------------------------

type DoKind =
  | 'dining'
  | 'tasting'
  | 'hiking'
  | 'cycling'
  | 'ballooning'
  | 'market'
  | 'swimming'
  | 'sport'
  | 'activity';

const DO_KIND_KEYWORDS: readonly (readonly [DoKind, readonly string[]])[] = [
  ['ballooning', ['montgolf', 'mongolf', 'balloon', 'air balloon']],
  ['cycling', ['vélo', 'velo', 'bike', 'cycl', 'vtt', 'e-bike', 'bicycl']],
  [
    'tasting',
    ['winery', 'wine', 'vin', 'dégustation', 'degustation', 'domaine', 'vignoble', 'œnolog', 'oenolog', 'cellar', 'cave'],
  ],
  ['hiking', ['hike', 'rando', 'trail', 'sentier', 'trek', 'col ', 'summit', 'gr ', 'marche', 'balade']],
  ['market', ['market', 'marché', 'marche', 'halle', 'brocante']],
  [
    'swimming',
    ['kayak', 'canoë', 'canoe', 'paddle', 'rafting', 'baignade', 'swim', 'nautique', 'plonge', 'voile', 'sailing', 'water'],
  ],
  ['sport', ['golf', 'tennis', 'equestr', 'équestr', 'cheval', 'ski', 'escalade', 'climb', 'sport', 'yoga']],
  ['dining', ['restaurant', 'bistro', 'bistrot', 'table', 'brasserie', 'dining', 'gastronom', 'trattoria', 'guinguette']],
];

function resolveDoKind(rawType: string, category: string | null, name: string): DoKind {
  const haystack = `${rawType} ${category ?? ''} ${name}`.toLowerCase();
  for (const [kind, keywords] of DO_KIND_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return kind;
  }
  return 'activity';
}

const DO_ICON_PATHS: Record<DoKind, React.ReactNode> = {
  // Fork + knife — restaurant.
  dining: (
    <>
      <path d="M6 3v18M4 3v6a2 2 0 0 0 4 0V3" />
      <path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9v18" />
    </>
  ),
  // Wine glass — tasting / winery.
  tasting: <path d="M8 3h8l-1 6a3 3 0 0 1-6 0zM12 15v6M9 21h6" />,
  // Summit flag — hiking.
  hiking: (
    <>
      <path d="M5 21V4l10 2.5L5 9" />
      <path d="M3 21h8" />
    </>
  ),
  // Bicycle — cycling.
  cycling: (
    <>
      <path d="M6 18.5a3 3 0 1 0 .01 0M18 18.5a3 3 0 1 0 .01 0" />
      <path d="M6 18.5l4-7h4l-2.5 7M10 11.5 8.5 8H6.5M14 11.5 17 18.5M13.5 8H16" />
    </>
  ),
  // Hot-air balloon — ballooning.
  ballooning: (
    <>
      <path d="M12 3a6 6 0 0 0-6 6c0 3.5 4 7 6 7s6-3.5 6-7a6 6 0 0 0-6-6z" />
      <path d="M10 16h4l-.6 4h-2.8z" />
    </>
  ),
  // Market stall / awning.
  market: (
    <path d="M4 9l1-4h14l1 4M4 9h16M4 9v11h16V9M4 9c0 1.5 1 2.5 2.7 2.5S9.3 10.5 9.3 9M9.3 9c0 1.5 1.2 2.5 2.7 2.5S14.7 10.5 14.7 9M14.7 9c0 1.5 1 2.5 2.7 2.5S20 10.5 20 9" />
  ),
  // Swimmer + waves — water activities.
  swimming: (
    <>
      <path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M7 11a2 2 0 1 0 .01 0M9.5 12.5l4-2.5 3.5 3" />
    </>
  ),
  // Trophy — sport.
  sport: (
    <>
      <path d="M7 4h10v3a5 5 0 0 1-10 0zM7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3" />
      <path d="M9 14h6M10 18h4M9 21h6" />
    </>
  ),
  // Compass — generic activity.
  activity: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
};

/**
 * Resolves the medallion glyph for a POI from its bucket + raw OSM type +
 * localised category + name. Each bucket owns a bespoke icon family
 * (heritage for `visit`, experiences for `do`, trades for `shop`) so a
 * château, an abbey, a hot-air balloon and a bakery each read at a glance.
 */
function resolvePoiIcon(bucket: PoiBucket, poi: LocalisedPointOfInterest): React.ReactNode {
  if (bucket === 'visit') return VISIT_ICON_PATHS[resolveVisitKind(poi.type, poi.category, poi.name)];
  if (bucket === 'do') return DO_ICON_PATHS[resolveDoKind(poi.type, poi.category, poi.name)];
  return SHOP_ICON_PATHS[resolveShopKind(poi.type, poi.category, poi.name)];
}
