import type { PoiBucket } from '@mch/domain/pois';

import { MCH_MAP_COLORS } from './mapbox-theme';

/** Bucket tint — editorial taupe palette. */
export const POI_BUCKET_DOT_COLORS: Readonly<Record<PoiBucket, string>> = {
  visit: MCH_MAP_COLORS.accent,
  do: MCH_MAP_COLORS.noir,
  eat: '#6b5344',
  shop: MCH_MAP_COLORS.textMuted,
};

/**
 * Minimal map dot — bucket colour + crème ring. Typology stays on the POI
 * cards and in the hover tooltip, not baked into the pin glyph.
 */
export function buildHotelPoiMarkerElement(bucket: PoiBucket): HTMLDivElement {
  const color = POI_BUCKET_DOT_COLORS[bucket];
  const wrapper = document.createElement('div');
  wrapper.className = 'mch-poi-pin mch-poi-pin--dot';
  wrapper.innerHTML = `<span class="mch-poi-pin__dot" style="background:${color}"></span>`;
  return wrapper;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface PoiMapPopupInput {
  readonly name: string;
  readonly category: string | null;
  readonly distanceLabel: string;
}

export function buildPoiMapPopupHtml(input: PoiMapPopupInput): string {
  const meta = [input.category, input.distanceLabel].filter(
    (part): part is string => part !== null && part.trim() !== '',
  );
  const metaHtml =
    meta.length > 0
      ? `<p class="mch-hotel-poi-popup__meta">${meta.map((part) => escapeHtml(part)).join(' · ')}</p>`
      : '';
  return `<div class="mch-hotel-poi-popup"><p class="mch-hotel-poi-popup__name">${escapeHtml(input.name)}</p>${metaHtml}</div>`;
}
