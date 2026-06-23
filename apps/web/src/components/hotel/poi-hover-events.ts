/**
 * Shared POI-hover event contract between the (eagerly rendered) POI cards and
 * the (lazily loaded) interactive Mapbox canvas.
 *
 * This lives in its own mapbox-free module on purpose: `poi-hover-target.tsx`
 * and `hotel-kit-interactions.tsx` are part of the hotel page's first-load
 * client bundle. Importing this constant from `hotel-interactive-map.tsx`
 * (which statically imports `mapbox-gl` + its CSS) would drag the ~469 KB
 * gzipped Mapbox engine into first-load — defeating the lazy boundary in
 * {@link HotelInteractiveMapLazy}. Keep this file dependency-free.
 */
export const POI_HOVER_EVENT = 'mch:poi-hover';

export interface PoiHoverDetail {
  readonly poiId: string | null;
}
