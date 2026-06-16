'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import type { PoiBucket } from '@mch/domain/pois';
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import {
  buildHotelPoiMarkerElement,
  buildPoiMapPopupHtml,
  POI_BUCKET_DOT_COLORS,
} from '@/lib/maps/poi-marker-element';
import {
  applyMchMapTheme,
  buildPinSvg,
  MCH_MAP_COLORS,
  MCH_MAPBOX_STYLE,
} from '@/lib/maps/mapbox-theme';

export const POI_HOVER_EVENT = 'mch:poi-hover';

export interface PoiHoverDetail {
  readonly poiId: string | null;
}

export interface HotelMapPoi {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly distanceLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly bucket: PoiBucket;
}

export interface HotelMapLegendLabels {
  readonly visit: string;
  readonly do: string;
  readonly eat: string;
  readonly shop: string;
}

interface HotelInteractiveMapProps {
  readonly accessToken: string;
  readonly hotelName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
  readonly pois: readonly HotelMapPoi[];
  readonly legendLabels: HotelMapLegendLabels;
  readonly mapHref: string;
  readonly viewMapLabel: string;
  readonly children: ReactNode;
}

const LEGEND_BUCKETS: readonly PoiBucket[] = ['visit', 'do', 'eat', 'shop'];

/**
 * Mapbox GL canvas for the hotel location block (desktop ≥ lg).
 * POI dots are bucket-coloured; name + distance appear on hover (not click).
 * Hovering a {@link PoiHoverTarget} card highlights the matching dot.
 */
export function HotelInteractiveMap({
  accessToken,
  hotelName,
  latitude,
  longitude,
  zoom = 14,
  pois,
  legendLabels,
  mapHref,
  viewMapLabel,
  children,
}: HotelInteractiveMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const poiMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const poiByIdRef = useRef<Map<string, HotelMapPoi>>(new Map());
  const hotelMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const activePoiIdRef = useRef<string | null>(null);
  const poisRef = useRef(pois);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);

  // Keep latest POIs in refs for the long-lived Mapbox event callbacks.
  // Syncing in an effect (not during render) satisfies react-hooks/refs.
  useEffect(() => {
    poisRef.current = pois;
    poiByIdRef.current = new Map(pois.map((poi) => [poi.id, poi]));
  });

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<PoiHoverDetail>).detail;
      setHoveredPoiId(detail?.poiId ?? null);
    };
    window.addEventListener(POI_HOVER_EVENT, handler);
    return () => window.removeEventListener(POI_HOVER_EVENT, handler);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container,
      style: MCH_MAPBOX_STYLE,
      center: [longitude, latitude],
      zoom,
      scrollZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;
    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: '260px',
      className: 'mch-hotel-poi-popup-shell',
    });

    const hidePopup = (): void => {
      popupRef.current?.remove();
      activePoiIdRef.current = null;
    };

    const broadcastHover = (poiId: string | null): void => {
      window.dispatchEvent(new CustomEvent<PoiHoverDetail>(POI_HOVER_EVENT, { detail: { poiId } }));
    };

    const hotelEl = document.createElement('div');
    hotelEl.className = 'mch-hotel-pin';
    hotelEl.innerHTML = buildPinSvg(true);
    hotelMarkerRef.current = new mapboxgl.Marker({ element: hotelEl, anchor: 'bottom' })
      .setLngLat([longitude, latitude])
      .addTo(map);

    const hotelPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: 'mch-hotel-poi-popup-shell',
    }).setHTML(buildPoiMapPopupHtml({ name: hotelName, category: null, distanceLabel: '' }));

    hotelEl.addEventListener('mouseenter', () => {
      hidePopup();
      hotelPopup.setLngLat([longitude, latitude]).addTo(map);
    });
    hotelEl.addEventListener('mouseleave', () => {
      hotelPopup.remove();
    });

    const placePoiMarkers = (): void => {
      for (const marker of poiMarkersRef.current.values()) marker.remove();
      poiMarkersRef.current.clear();

      for (const poi of poisRef.current) {
        const el = buildHotelPoiMarkerElement(poi.bucket);
        el.addEventListener('mouseenter', () => {
          broadcastHover(poi.id);
        });
        el.addEventListener('mouseleave', () => {
          broadcastHover(null);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([poi.longitude, poi.latitude])
          .addTo(map);
        poiMarkersRef.current.set(poi.id, marker);
      }
    };

    map.on('load', () => {
      applyMchMapTheme(map);
      placePoiMarkers();

      const coords: Array<[number, number]> = [[longitude, latitude]];
      for (const poi of poisRef.current) {
        coords.push([poi.longitude, poi.latitude]);
      }

      if (coords.length > 1) {
        const bounds = coords.reduce<mapboxgl.LngLatBounds | null>((acc, coord) => {
          const point = new mapboxgl.LngLat(coord[0], coord[1]);
          if (acc === null) return new mapboxgl.LngLatBounds(point, point);
          return acc.extend(point);
        }, null);
        if (bounds !== null && !bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
        }
      }
    });

    return () => {
      hotelPopup.remove();
      hidePopup();
      popupRef.current = null;
      hotelMarkerRef.current?.remove();
      hotelMarkerRef.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- ref holds a stable Map instance (never reassigned)
      for (const marker of poiMarkersRef.current.values()) marker.remove();
      poiMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, hotelName, latitude, longitude, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    for (const [id, marker] of poiMarkersRef.current.entries()) {
      const el = marker.getElement();
      if (id === hoveredPoiId) el.classList.add('mch-poi-pin--active');
      else el.classList.remove('mch-poi-pin--active');
    }

    if (hoveredPoiId === null) {
      if (activePoiIdRef.current !== null) popupRef.current?.remove();
      return;
    }

    const marker = poiMarkersRef.current.get(hoveredPoiId);
    const poi = poiByIdRef.current.get(hoveredPoiId);
    const popup = popupRef.current;
    if (marker === undefined || poi === undefined || popup === null) return;

    activePoiIdRef.current = hoveredPoiId;
    popup
      .setLngLat(marker.getLngLat())
      .setHTML(
        buildPoiMapPopupHtml({
          name: poi.name,
          category: poi.category,
          distanceLabel: poi.distanceLabel,
        }),
      )
      .addTo(map);
  }, [hoveredPoiId]);

  return (
    <figure className="border-border bg-bg overflow-hidden rounded-lg border">
      <style>{`
        .mch-poi-pin--dot {
          cursor: default;
          padding: 4px;
        }
        .mch-poi-pin__dot {
          display: block;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          border: 2px solid ${MCH_MAP_COLORS.pinCenter};
          box-shadow: 0 1px 3px rgba(43, 39, 34, 0.28);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .mch-poi-pin--active .mch-poi-pin__dot,
        .mch-poi-pin--dot:hover .mch-poi-pin__dot {
          transform: scale(1.35);
          box-shadow: 0 2px 8px rgba(43, 39, 34, 0.32);
        }
        .mch-hotel-poi-popup-shell .mapboxgl-popup-content {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(140, 123, 90, 0.28);
          background: #f6f1e7;
          box-shadow: 0 8px 24px rgba(43, 39, 34, 0.14);
          font-family: inherit;
        }
        .mch-hotel-poi-popup-shell .mapboxgl-popup-tip {
          border-top-color: #f6f1e7;
        }
        .mch-hotel-poi-popup__name {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          color: #2b2722;
        }
        .mch-hotel-poi-popup__meta {
          margin: 4px 0 0;
          font-size: 11px;
          line-height: 1.4;
          color: #6f675b;
        }
      `}</style>
      <div
        ref={containerRef}
        className="border-border aspect-[20/9] w-full border-0"
        role="img"
        aria-label={hotelName}
      />
      <figcaption className="text-muted flex flex-col gap-2 px-3 py-2 text-[0.7rem]">
        <ul
          className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em]"
          aria-label="Légende carte"
        >
          {LEGEND_BUCKETS.map((bucket) => (
            <li key={bucket} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-[#f6f1e7]"
                style={{ backgroundColor: POI_BUCKET_DOT_COLORS[bucket] }}
                aria-hidden
              />
              <span>{legendLabels[bucket]}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{children}</span>
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fg underline"
          >
            {viewMapLabel}
          </a>
        </div>
      </figcaption>
    </figure>
  );
}
