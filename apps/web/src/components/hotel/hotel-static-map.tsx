import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';
import { buildMapboxExternalMapHref, buildMapboxStaticImageUrl } from '@/lib/maps/mapbox-static';

interface HotelStaticMapProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
}

/**
 * Static map preview for the hotel location block — CDC §2 bloc 7.
 *
 * Renders a Mapbox Static Images snapshot tinted to the editorial kit
 * (light basemap + taupe pin). Falls back to nothing when the public
 * token is unset (local dev without Mapbox credentials).
 */
export async function HotelStaticMap({
  locale,
  hotelName,
  latitude,
  longitude,
  zoom = 15,
}: HotelStaticMapProps): Promise<React.ReactElement | null> {
  const accessToken = getMapboxAccessToken();
  if (accessToken === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.location' });

  const imageUrl = buildMapboxStaticImageUrl({
    latitude,
    longitude,
    zoom,
    accessToken,
  });
  const mapHref = buildMapboxExternalMapHref(latitude, longitude);

  return (
    <figure className="border-border bg-bg mt-4 overflow-hidden rounded-lg border">
      {/* eslint-disable-next-line @next/next/no-img-element -- Mapbox Static Images URL; next/image adds no CDN benefit */}
      <img
        src={imageUrl}
        alt={t('staticMapAlt', { hotelName })}
        loading="lazy"
        decoding="async"
        className="border-border aspect-[20/9] w-full border-0 object-cover"
      />
      <figcaption className="text-muted flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[0.7rem]">
        <span>
          {t.rich('mapAttribution', {
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
          })}
        </span>
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg underline"
        >
          {t('viewMap')}
        </a>
      </figcaption>
    </figure>
  );
}
