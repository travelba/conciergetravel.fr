import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';
import { buildMapboxExternalMapHref } from '@/lib/maps/mapbox-static';
import type { LocalisedPointOfInterest } from '@/server/hotels/get-hotel-by-slug';

import { HotelGalleryViewPhotosLink } from './hotel-gallery-view-link';
import { HotelInteractiveMap, type HotelMapPoi } from './hotel-interactive-map';
import { HotelStaticMap } from './hotel-static-map';

interface HotelLocationMapProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly pois: readonly LocalisedPointOfInterest[];
}

function poiMapId(poi: LocalisedPointOfInterest): string {
  return poi.osmId ?? `${poi.name}-${poi.latitude ?? 0}-${poi.longitude ?? 0}`;
}

function toMapPois(pois: readonly LocalisedPointOfInterest[]): readonly HotelMapPoi[] {
  const result: HotelMapPoi[] = [];
  for (const poi of pois) {
    if (poi.latitude === null || poi.longitude === null) continue;
    result.push({
      id: poiMapId(poi),
      name: poi.name,
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
}: HotelLocationMapProps): Promise<React.ReactElement | null> {
  const accessToken = getMapboxAccessToken();
  if (accessToken === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.location' });
  const mapHref = buildMapboxExternalMapHref(latitude, longitude);
  const mapPois = toMapPois(pois);

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

  return (
    <>
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
          mapHref={mapHref}
          viewMapLabel={t('viewMap')}
        >
          {attribution}
        </HotelInteractiveMap>
      </div>
      <HotelGalleryViewPhotosLink label={t('viewPhotosFromHotel')} />
    </>
  );
}
