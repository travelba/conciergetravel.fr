export interface OpenStreetMapEmbedOptions {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom?: number;
}

/**
 * Approximate bounding box for the OSM embed widget at a given zoom.
 * Tuned for hotel-neighbourhood scale (~1–2 km).
 */
function embedBoundingBox(
  latitude: number,
  longitude: number,
  zoom: number,
): {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
} {
  const scale = 16 / zoom;
  const latDelta = 0.012 * scale;
  const lonDelta = 0.018 * scale;
  return {
    west: longitude - lonDelta,
    south: latitude - latDelta,
    east: longitude + lonDelta,
    north: latitude + latDelta,
  };
}

/**
 * Official OpenStreetMap embed URL — allowed on third-party sites (unlike
 * Wikimedia Maps tile hotlinking, which returns 403 off WMF domains).
 */
export function buildOpenStreetMapEmbedUrl({
  latitude,
  longitude,
  zoom = 15,
}: OpenStreetMapEmbedOptions): string {
  const { west, south, east, north } = embedBoundingBox(latitude, longitude, zoom);
  const bbox = `${west.toFixed(6)},${south.toFixed(6)},${east.toFixed(6)},${north.toFixed(6)}`;
  const marker = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const params = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
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
