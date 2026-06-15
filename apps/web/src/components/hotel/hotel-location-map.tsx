import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { formatDistanceMeters } from '@/lib/format-distance';
import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';
import { buildMapboxExternalMapHref } from '@/lib/maps/mapbox-static';
import type { LocalisedPointOfInterest } from '@/server/hotels/get-hotel-by-slug';

import { HotelInteractiveMap, type HotelMapPoi } from './hotel-interactive-map';
import { HotelStaticMap } from './hotel-static-map';

interface HotelLocationMapProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly pois: readonly LocalisedPointOfInterest[];
  /** Kit fiches reuse `.kit-static-map` spacing inside `#acces`. */
  readonly surface?: 'default' | 'kit';
}

function poiMapId(poi: LocalisedPointOfInterest): string {
  return poi.osmId ?? `${poi.name}-${poi.latitude ?? 0}-${poi.longitude ?? 0}`;
}

function formatPoiDistanceLabel(
  poi: LocalisedPointOfInterest,
  locale: SupportedLocale,
  walkMinutesLabel: (count: number) => string,
): string {
  const distance = formatDistanceMeters(poi.distanceMeters, locale);
  if (poi.walkMinutes !== null && poi.walkMinutes > 0) {
    return `${distance} · ${walkMinutesLabel(poi.walkMinutes)}`;
  }
  return distance;
}

function toMapPois(
  pois: readonly LocalisedPointOfInterest[],
  locale: SupportedLocale,
  walkMinutesLabel: (count: number) => string,
): readonly HotelMapPoi[] {
  const result: HotelMapPoi[] = [];
  for (const poi of pois) {
    if (poi.latitude === null || poi.longitude === null) continue;
    result.push({
      id: poiMapId(poi),
      name: poi.name,
      category: poi.category,
      distanceLabel: formatPoiDistanceLabel(poi, locale, walkMinutesLabel),
      latitude: poi.latitude,
      longitude: poi.longitude,
      bucket: poi.bucket,
    });
  }
  return result;
}

/**
 * Responsive map for the location block — static snapshot on mobile,
 * interactive Mapbox GL on desktop (≥ lg).
 */
export async function HotelLocationMap({
  locale,
  hotelName,
  latitude,
  longitude,
  pois,
  surface = 'default',
}: HotelLocationMapProps): Promise<React.ReactElement | null> {
  const accessToken = getMapboxAccessToken();
  if (accessToken === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.location' });
  const mapHref = buildMapboxExternalMapHref(latitude, longitude);
  const mapPois = toMapPois(pois, locale, (count) => t('walkMinutes', { count }));
  const legendLabels = {
    visit: t('mapLegend.visit'),
    do: t('mapLegend.do'),
    eat: t('mapLegend.eat'),
    shop: t('mapLegend.shop'),
  } as const;

  const attribution = t.rich('mapAttribution', {
    mapbox: (chunks) => (
      <a
        href="https://www.mapbox.com/about/maps/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-fg underline"
      >
        {chunks}
      </a>
    ),
    osm: (chunks) => (
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-fg underline"
      >
        {chunks}
      </a>
    ),
  });

  const wrapperClass = surface === 'kit' ? 'hotel-kit-map-slot-inner kit-static-map' : 'mt-4';

  return (
    <div className={wrapperClass}>
      <div className="lg:hidden">
        <HotelStaticMap
          locale={locale}
          hotelName={hotelName}
          latitude={latitude}
          longitude={longitude}
        />
      </div>
      <div className="hidden lg:block">
        <HotelInteractiveMap
          accessToken={accessToken}
          hotelName={hotelName}
          latitude={latitude}
          longitude={longitude}
          pois={mapPois}
          legendLabels={legendLabels}
          mapHref={mapHref}
          viewMapLabel={t('viewMap')}
        >
          {attribution}
        </HotelInteractiveMap>
      </div>
    </div>
  );
}
