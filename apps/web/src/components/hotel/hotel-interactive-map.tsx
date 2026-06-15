'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { buildLuxuryPoiMarkerElement } from '@/lib/maps/poi-marker-element';
import { applyMchMapTheme, buildPinSvg, MCH_MAPBOX_STYLE } from '@/lib/maps/mapbox-theme';

import type { PoiBucket } from '@/server/hotels/get-hotel-by-slug';

export const POI_HOVER_EVENT = 'mch:poi-hover';

export interface PoiHoverDetail {
  readonly poiId: string | null;
}

export interface HotelMapPoi {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly category: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly bucket: PoiBucket;
}

interface HotelInteractiveMapProps {
  readonly accessToken: string;
  readonly hotelName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
  readonly pois: readonly HotelMapPoi[];
  readonly mapHref: string;
  readonly viewMapLabel: string;
  readonly children: ReactNode;
}

/**
 * Mapbox GL canvas for the hotel location block (desktop ≥ lg).
 * POI pins carry typology glyphs (castle, museum, fork…) on a taupe
 * editorial pin; hovering a {@link PoiHoverTarget} card pulses the pin.
 */
export function HotelInteractiveMap({
  accessToken,
  hotelName,
  latitude,
  longitude,
  zoom = 14,
  pois,
  mapHref,
  viewMapLabel,
  children,
}: HotelInteractiveMapProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const poiMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const hotelMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const poisRef = useRef(pois);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);

  poisRef.current = pois;

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

    const hotelEl = document.createElement('div');
    hotelEl.innerHTML = buildPinSvg(true);
    hotelMarkerRef.current = new mapboxgl.Marker({ element: hotelEl, anchor: 'bottom' })
      .setLngLat([longitude, latitude])
      .setPopup(new mapboxgl.Popup({ closeButton: false, offset: 16 }).setText(hotelName))
      .addTo(map);

    const placePoiMarkers = (): void => {
      for (const marker of poiMarkersRef.current.values()) marker.remove();
      poiMarkersRef.current.clear();

      for (const poi of poisRef.current) {
        const el = buildLuxuryPoiMarkerElement({
          bucket: poi.bucket,
          type: poi.type,
          category: poi.category,
          name: poi.name,
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([poi.longitude, poi.latitude])
          .setPopup(new mapboxgl.Popup({ closeButton: false, offset: 14 }).setText(poi.name))
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
      hotelMarkerRef.current?.remove();
      hotelMarkerRef.current = null;
      for (const marker of poiMarkersRef.current.values()) marker.remove();
      poiMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, hotelName, latitude, longitude, zoom]);

  useEffect(() => {
    for (const [id, marker] of poiMarkersRef.current.entries()) {
      const el = marker.getElement();
      if (id === hoveredPoiId) el.classList.add('mch-poi-pin--pulse');
      else el.classList.remove('mch-poi-pin--pulse');
    }
  }, [hoveredPoiId]);

  return (
    <figure className="border-border bg-bg overflow-hidden rounded-lg border">
      <style>{`
        @keyframes mch-poi-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.92; }
        }
        .mch-poi-pin--pulse {
          animation: mch-poi-pulse 1.1s ease-in-out infinite;
          transform-origin: center bottom;
        }
      `}</style>
      <div
        ref={containerRef}
        className="border-border aspect-[20/9] w-full border-0"
        role="img"
        aria-label={hotelName}
      />
      <figcaption className="text-muted flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[0.7rem]">
        <span>{children}</span>
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg underline"
        >
          {viewMapLabel}
        </a>
      </figcaption>
    </figure>
  );
}
