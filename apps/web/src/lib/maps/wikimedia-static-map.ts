export interface WikimediaStaticMapOptions {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Wikimedia Maps static tile URL (same contract as `HotelStaticMap`). */
export function buildWikimediaStaticMapTileUrl({
  latitude,
  longitude,
  zoom = 15,
  width = 800,
  height = 360,
}: WikimediaStaticMapOptions): string {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return `https://maps.wikimedia.org/img/osm-intl,${zoom},${lat},${lon},${width}x${height}@2x.png`;
}

export function buildOpenStreetMapHotelHref(
  latitude: number,
  longitude: number,
  zoom = 15,
): string {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=${zoom}`;
}
