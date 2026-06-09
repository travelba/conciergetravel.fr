import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import {
  buildOpenStreetMapEmbedUrl,
  buildOpenStreetMapHotelHref,
} from '@/lib/maps/openstreetmap-embed';

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
 * Embeds the official OpenStreetMap export widget (no API key). We avoid
 * Wikimedia Maps tile hotlinking because `maps.wikimedia.org` returns 403
 * for non-WMF domains.
 */
export async function HotelStaticMap({
  locale,
  hotelName,
  latitude,
  longitude,
  zoom = 15,
}: HotelStaticMapProps): Promise<React.ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage.location' });

  const embedUrl = buildOpenStreetMapEmbedUrl({ latitude, longitude, zoom });
  const osmHref = buildOpenStreetMapHotelHref(latitude, longitude, zoom);

  return (
    <figure className="border-border bg-bg mt-4 overflow-hidden rounded-lg border">
      <iframe
        title={t('staticMapAlt', { hotelName })}
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="border-border aspect-[20/9] w-full border-0"
      />
      <figcaption className="text-muted flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[0.7rem]">
        <span>
          {t.rich('mapAttribution', {
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
          href={osmHref}
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
