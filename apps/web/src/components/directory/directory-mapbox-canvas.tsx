'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, type ReactElement } from 'react';

import { getMapboxAccessToken } from '@/lib/maps/mapbox-access';
import { MCH_MAPBOX_STYLE, applyMchMapTheme, buildPinSvg } from '@/lib/maps/mapbox-theme';

import type { DirectoryMapPoint } from './directory-map-layout';

export interface DirectoryMapboxApi {
  replot(visibleIds: ReadonlySet<string>): void;
  invalidateSize(): void;
}

interface DirectoryMapboxCanvasProps {
  readonly points: readonly DirectoryMapPoint[];
  readonly cluster: boolean;
  readonly popupViewLabel: string;
  readonly onReady: (api: DirectoryMapboxApi) => void;
  readonly onMarkerFocus: (id: string, scroll: boolean) => void;
  readonly onMarkerBlur: (id: string) => void;
}

const HOTELS_SOURCE = 'mch-hotels';
const CLUSTER_LAYER = 'mch-clusters';
const CLUSTER_COUNT_LAYER = 'mch-cluster-count';
const UNCLUSTERED_LAYER = 'mch-unclustered';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function percentileBounds(
  coords: ReadonlyArray<readonly [number, number]>,
  lo: number,
  hi: number,
): mapboxgl.LngLatBounds | null {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c[0]).sort((a, b) => a - b);
  const lngs = coords.map((c) => c[1]).sort((a, b) => a - b);
  const at = (arr: readonly number[], q: number): number => {
    if (arr.length === 0) return 0;
    const idx = Math.min(arr.length - 1, Math.max(0, Math.floor(q * (arr.length - 1))));
    return arr[idx] ?? arr[0] ?? 0;
  };
  return new mapboxgl.LngLatBounds([at(lngs, lo), at(lats, lo)], [at(lngs, hi), at(lats, hi)]);
}

function fitToCoords(
  map: mapboxgl.Map,
  coords: ReadonlyArray<readonly [number, number]>,
  cluster: boolean,
): void {
  if (coords.length === 0) return;
  const lngLatCoords = coords.map((c) => [c[1], c[0]] as const);
  const exact = lngLatCoords.reduce<mapboxgl.LngLatBounds | null>((bounds, coord) => {
    const point = new mapboxgl.LngLat(coord[0], coord[1]);
    if (bounds === null) return new mapboxgl.LngLatBounds(point, point);
    return bounds.extend(point);
  }, null);
  if (exact === null || exact.isEmpty()) return;
  const focus = cluster && coords.length >= 12 ? percentileBounds(coords, 0.05, 0.95) : null;
  const target = focus !== null && !focus.isEmpty() ? focus : exact;
  map.fitBounds(target, { padding: 32, maxZoom: 14, duration: 0 });
}

function pointsToGeoJson(
  points: readonly DirectoryMapPoint[],
  visibleIds: ReadonlySet<string>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const point of points) {
    if (!visibleIds.has(point.id)) continue;
    features.push({
      type: 'Feature',
      id: point.id,
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        name: point.name,
        url: point.url,
        isPalace: point.isPalace,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Mapbox GL canvas for the hotel directory — replaces the former Leaflet +
 * Wikimedia tile stack. Pins reuse the editorial taupe / anthracite palette.
 */
export function DirectoryMapboxCanvas({
  points,
  cluster,
  popupViewLabel,
  onReady,
  onMarkerFocus,
  onMarkerBlur,
}: DirectoryMapboxCanvasProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const modeRef = useRef<'markers' | 'cluster'>(cluster ? 'cluster' : 'markers');
  const pointsRef = useRef(points);
  const popupLabelRef = useRef(popupViewLabel);

  pointsRef.current = points;
  popupLabelRef.current = popupViewLabel;
  modeRef.current = cluster ? 'cluster' : 'markers';

  useEffect(() => {
    const token = getMapboxAccessToken();
    const container = containerRef.current;
    if (token === null || container === null || points.length === 0) return;

    mapboxgl.accessToken = token;
    mapboxgl.config.EVENTS_URL = '';

    let cancelled = false;
    const markers = markersRef.current;

    const map = new mapboxgl.Map({
      container,
      style: MCH_MAPBOX_STYLE,
      center: [points[0]?.lng ?? 2.35, points[0]?.lat ?? 48.85],
      zoom: 10,
      scrollZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;
    popupRef.current = new mapboxgl.Popup({ closeButton: false, maxWidth: '240px' });

    const clearMarkers = (): void => {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };

    const bindPopup = (point: DirectoryMapPoint): string => {
      return `<div class="mch-directory-popup"><strong>${escapeHtml(
        point.name,
      )}</strong><br/><a href="${escapeHtml(point.url)}" class="mch-directory-popup__link">${escapeHtml(
        popupLabelRef.current,
      )} &rarr;</a></div>`;
    };

    const setupMarkersMode = (): void => {
      clearMarkers();
      const visibleIds = new Set(pointsRef.current.map((p) => p.id));
      for (const point of pointsRef.current) {
        if (!visibleIds.has(point.id)) continue;
        const el = document.createElement('div');
        el.className = 'mch-directory-pin';
        el.dataset['hotelId'] = point.id;
        el.innerHTML = buildPinSvg(point.isPalace);
        el.addEventListener('mouseenter', () => onMarkerFocus(point.id, false));
        el.addEventListener('mouseleave', () => onMarkerBlur(point.id));
        el.addEventListener('click', () => onMarkerFocus(point.id, true));

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([point.lng, point.lat])
          .setPopup(
            new mapboxgl.Popup({ closeButton: false, maxWidth: '240px' }).setHTML(bindPopup(point)),
          )
          .addTo(map);
        markers.set(point.id, marker);
      }
      fitToCoords(
        map,
        pointsRef.current.map((p) => [p.lat, p.lng] as const),
        false,
      );
    };

    const setupClusterMode = (): void => {
      clearMarkers();
      if (map.getLayer(UNCLUSTERED_LAYER)) map.removeLayer(UNCLUSTERED_LAYER);
      if (map.getLayer(CLUSTER_COUNT_LAYER)) map.removeLayer(CLUSTER_COUNT_LAYER);
      if (map.getLayer(CLUSTER_LAYER)) map.removeLayer(CLUSTER_LAYER);
      if (map.getSource(HOTELS_SOURCE)) map.removeSource(HOTELS_SOURCE);

      const visibleIds = new Set(pointsRef.current.map((p) => p.id));
      map.addSource(HOTELS_SOURCE, {
        type: 'geojson',
        data: pointsToGeoJson(pointsRef.current, visibleIds),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });

      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: HOTELS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#8c7b5a',
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
          'circle-opacity': 0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#f6f1e7',
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: HOTELS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#f6f1e7',
        },
      });

      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: 'circle',
        source: HOTELS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['boolean', ['get', 'isPalace'], false], '#8c7b5a', '#3a352d'],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#f6f1e7',
        },
      });

      fitToCoords(
        map,
        pointsRef.current.map((p) => [p.lat, p.lng] as const),
        true,
      );
    };

    const replot = (visibleIds: ReadonlySet<string>): void => {
      if (cancelled) return;
      if (modeRef.current === 'markers') {
        clearMarkers();
        const coords: Array<readonly [number, number]> = [];
        for (const point of pointsRef.current) {
          if (!visibleIds.has(point.id)) continue;
          coords.push([point.lat, point.lng]);
          const el = document.createElement('div');
          el.className = 'mch-directory-pin';
          el.dataset['hotelId'] = point.id;
          el.innerHTML = buildPinSvg(point.isPalace);
          el.addEventListener('mouseenter', () => onMarkerFocus(point.id, false));
          el.addEventListener('mouseleave', () => onMarkerBlur(point.id));
          el.addEventListener('click', () => onMarkerFocus(point.id, true));
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([point.lng, point.lat])
            .setPopup(
              new mapboxgl.Popup({ closeButton: false, maxWidth: '240px' }).setHTML(
                bindPopup(point),
              ),
            )
            .addTo(map);
          markers.set(point.id, marker);
        }
        if (coords.length > 0) fitToCoords(map, coords, false);
        return;
      }

      const source = map.getSource(HOTELS_SOURCE);
      if (source !== undefined && 'setData' in source) {
        source.setData(pointsToGeoJson(pointsRef.current, visibleIds));
        const coords: Array<readonly [number, number]> = [];
        for (const point of pointsRef.current) {
          if (!visibleIds.has(point.id)) continue;
          coords.push([point.lat, point.lng]);
        }
        if (coords.length > 0) fitToCoords(map, coords, true);
      }
    };

    map.on('load', () => {
      if (cancelled) return;
      applyMchMapTheme(map);
      if (modeRef.current === 'cluster') {
        setupClusterMode();
      } else {
        setupMarkersMode();
      }
      onReady({ replot, invalidateSize: () => map.resize() });
    });

    if (modeRef.current === 'cluster') {
      map.on('click', CLUSTER_LAYER, (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER] });
        const feature = features[0];
        if (feature === undefined) return;
        const clusterId = feature.properties?.['cluster_id'];
        const source = map.getSource(HOTELS_SOURCE);
        if (
          source === undefined ||
          !('getClusterExpansionZoom' in source) ||
          typeof clusterId !== 'number'
        ) {
          return;
        }
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err !== null && err !== undefined) return;
          const geometry = feature.geometry;
          if (geometry.type !== 'Point') return;
          const [lng, lat] = geometry.coordinates;
          if (lng === undefined || lat === undefined) return;
          map.easeTo({ center: [lng, lat], zoom: zoom ?? map.getZoom() });
        });
      });

      map.on('click', UNCLUSTERED_LAYER, (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: [UNCLUSTERED_LAYER] });
        const feature = features[0];
        if (feature === undefined) return;
        const id = feature.properties?.['id'];
        if (typeof id !== 'string') return;
        onMarkerFocus(id, true);
        const name = feature.properties?.['name'];
        const url = feature.properties?.['url'];
        if (typeof name === 'string' && typeof url === 'string') {
          popupRef.current
            ?.setLngLat(event.lngLat)
            .setHTML(
              `<div class="mch-directory-popup"><strong>${escapeHtml(
                name,
              )}</strong><br/><a href="${escapeHtml(url)}" class="mch-directory-popup__link">${escapeHtml(
                popupLabelRef.current,
              )} &rarr;</a></div>`,
            )
            .addTo(map);
        }
      });

      map.on('mouseenter', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    return () => {
      cancelled = true;
      clearMarkers();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [points, cluster, onReady, onMarkerFocus, onMarkerBlur]);

  const token = getMapboxAccessToken();
  if (token === null || points.length === 0) {
    return (
      <div className="text-muted flex h-full min-h-[280px] w-full items-center justify-center px-6 text-center text-sm">
        {token === null ? 'Mapbox token missing — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.' : null}
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[280px] w-full" />;
}
