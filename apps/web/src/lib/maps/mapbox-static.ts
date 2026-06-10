import { MCH_MAPBOX_STYLE, MCH_MAP_COLORS } from './mapbox-theme';

export interface MapboxStaticImageOptions {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
  readonly width?: number;
  readonly height?: number;
  readonly accessToken: string;
}

const STYLE_PATH = MCH_MAPBOX_STYLE.replace('mapbox://styles/', '');

/**
 * Mapbox Static Images API — server-safe preview for hotel location blocks.
 * Marker colour matches `--accent` / `--or` (#8c7b5a).
 */
export function buildMapboxStaticImageUrl({
  latitude,
  longitude,
  zoom = 15,
  width = 800,
  height = 360,
  accessToken,
}: MapboxStaticImageOptions): string {
  const markerColor = MCH_MAP_COLORS.accent.replace('#', '');
  const lon = longitude.toFixed(5);
  const lat = latitude.toFixed(5);
  const overlay = `pin-l+${markerColor}(${lon},${lat})`;
  const center = `${lon},${lat},${zoom}`;
  const size = `${width}x${height}@2x`;
  const params = new URLSearchParams({ access_token: accessToken });
  return `https://api.mapbox.com/styles/v1/${STYLE_PATH}/static/${overlay}/${center}/${size}?${params.toString()}`;
}

/** External deep-link — opens Mapbox-hosted directions UI at the hotel pin. */
export function buildMapboxExternalMapHref(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return `https://www.mapbox.com/directions/?destination=${lon},${lat}`;
}
