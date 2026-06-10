/**
 * Mapbox palette — mirrors `kit.css` `:root` tokens so map pins, popups and
 * basemap tweaks stay on-brand (crème lumineuse · accent taupe).
 */
export const MCH_MAP_COLORS = {
  accent: '#8c7b5a',
  noir: '#3a352d',
  creme: '#f6f1e7',
  creme2: '#efe8da',
  text: '#2b2722',
  textMuted: '#6f675b',
  palacePin: '#8c7b5a',
  hotelPin: '#3a352d',
  pinCenter: '#f6f1e7',
} as const;

/** Light basemap — tinted at runtime via `applyMchMapTheme`. */
export const MCH_MAPBOX_STYLE = 'mapbox://styles/mapbox/light-v11';

export function buildPinSvg(isPalace: boolean): string {
  const fill = isPalace ? MCH_MAP_COLORS.palacePin : MCH_MAP_COLORS.hotelPin;
  return `<svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true" focusable="false" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))"><path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 20 12 20s12-12 12-20C24 5.4 18.6 0 12 0Z" fill="${fill}"/><circle cx="12" cy="12" r="4.25" fill="${MCH_MAP_COLORS.pinCenter}"/></svg>`;
}

export interface MapboxMapLike {
  getStyle(): { layers?: ReadonlyArray<{ id: string; type: string }> } | null | undefined;
  setPaintProperty(layerId: string, name: string, value: string): void;
}

/** Warm the Mapbox Light basemap toward the editorial crème shell. */
export function applyMchMapTheme(map: MapboxMapLike): void {
  const layers = map.getStyle()?.layers;
  if (layers === undefined) return;
  for (const layer of layers) {
    if (layer.id === 'background' && layer.type === 'background') {
      map.setPaintProperty('background', 'background-color', MCH_MAP_COLORS.creme);
    }
  }
}
