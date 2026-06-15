import {
  resolvePoiIconKind,
  type DoKind,
  type PoiBucket,
  type PoiIconKind,
  type ShopKind,
  type VisitKind,
} from '@mch/domain/pois';

import { MCH_MAP_COLORS } from './mapbox-theme';

/** Bucket tint — editorial taupe palette, not traffic-light colours. */
const BUCKET_PIN_COLORS: Readonly<Record<PoiBucket, string>> = {
  visit: MCH_MAP_COLORS.accent,
  do: MCH_MAP_COLORS.noir,
  eat: '#6b5344',
  shop: MCH_MAP_COLORS.textMuted,
};

const VISIT_ICON_PATHS: Readonly<Record<VisitKind, readonly string[]>> = {
  castle: ['M4 21V9l2 1V7l2 1V7l2-1v3l2-1V7l2 1V7l2-1v3l2-1v12', 'M4 21h16', 'M9 21v-4h6v4'],
  religious: ['M12 2v4', 'M10 4h4', 'M6 22V11l6-4 6 4v11', 'M6 22h12', 'M10 22v-5h4v5'],
  museum: ['M3 9l9-5 9 5', 'M3 9h18', 'M5 9v9', 'M9 9v9', 'M15 9v9', 'M19 9v9', 'M3 21h18'],
  monument: ['M6 21V11a6 6 0 0 1 12 0v10', 'M6 21h12', 'M10 21v-7a2 2 0 0 1 4 0v7'],
  garden: ['M12 3c-3 0-5 3-4 6-2 .6-3 4 0 5h8c3-1 2-4.4 0-5 1-3-1-6-4-6z', 'M12 14v7', 'M9 18h6'],
  viewpoint: ['M3 18l6-8 4 5 2-3 6 6', 'M3 18h18', 'M16 6a2 2 0 1 0 .01 0'],
  nature: ['M3 20l6-11 4 6 2-3 6 8z', 'M3 20h18'],
  water: [
    'M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
    'M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
    'M15 7a2.5 2.5 0 1 0 .01 0',
  ],
  landmark: ['M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z', 'M12 10a2 2 0 1 0 .01 0'],
};

const DO_ICON_PATHS: Readonly<Record<DoKind, readonly string[]>> = {
  dining: ['M6 3v18', 'M4 3v6a2 2 0 0 0 4 0V3', 'M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9v18'],
  tasting: ['M8 3h8l-1 6a3 3 0 0 1-6 0z', 'M12 15v6', 'M9 21h6'],
  hiking: ['M5 21V4l10 2.5L5 9', 'M3 21h8'],
  cycling: [
    'M6 18.5a3 3 0 1 0 .01 0',
    'M18 18.5a3 3 0 1 0 .01 0',
    'M6 18.5l4-7h4l-2.5 7M10 11.5 8.5 8H6.5M14 11.5 17 18.5M13.5 8H16',
  ],
  ballooning: [
    'M12 3a6 6 0 0 0-6 6c0 3.5 4 7 6 7s6-3.5 6-7a6 6 0 0 0-6-6z',
    'M10 16h4l-.6 4h-2.8z',
  ],
  market: [
    'M4 9l1-4h14l1 4',
    'M4 9h16',
    'M4 9v11h16V9',
    'M4 9c0 1.5 1 2.5 2.7 2.5S9.3 10.5 9.3 9M9.3 9c0 1.5 1.2 2.5 2.7 2.5S14.7 10.5 14.7 9M14.7 9c0 1.5 1 2.5 2.7 2.5S20 10.5 20 9',
  ],
  swimming: ['M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M7 11a2 2 0 1 0 .01 0', 'M9.5 12.5l4-2.5 3.5 3'],
  sport: [
    'M7 4h10v3a5 5 0 0 1-10 0z',
    'M7 5H4v1a3 3 0 0 0 3 3',
    'M17 5h3v1a3 3 0 0 1-3 3',
    'M9 14h6',
    'M10 18h4',
    'M9 21h6',
  ],
  activity: ['M12 12a9 9 0 1 0 .01 0', 'M15.5 8.5l-2 5-5 2 2-5z'],
};

const EAT_ICON_PATHS: readonly string[] = [
  'M7 3v8',
  'M5 3v4a2 2 0 0 0 4 0V3',
  'M7 11v10',
  'M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5z',
  'M17 12v9',
];

const SHOP_ICON_PATHS: Readonly<Record<ShopKind, readonly string[]>> = {
  bakery: [
    'M4 14c-1.5-1.5-1.5-4 0-5.5l9-4.5c2-1 4.5 0 5.5 2s0 4.5-2 5.5l-9 4.5c-1.2.6-2.6.4-3.5-.5z',
    'M8 9l8-4',
    'M10 12l8-4',
  ],
  pharmacy: [
    'M12 9a3 3 0 1 0 0 .01',
    'M12 9c0-3-2-5-4-5s-1 4 1 5',
    'M12 9c0-3 2-5 4-5s1 4-1 5',
    'M12 12v8',
    'M9 16h6',
  ],
  oil: ['M8 3h8v4l-1 14H9L8 7z', 'M10 7h4'],
  cheese: ['M4 10h16v10H4z', 'M4 10l4-6h8l4 6', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01'],
  wine: ['M8 3h8l-1 6a3 3 0 0 1-6 0z', 'M12 15v6', 'M9 21h6'],
  grocery: ['M4 9l1-4h14l1 4', 'M4 9h16', 'M5 9v11h14V9', 'M9 20v-5h6v5'],
  greengrocer: [
    'M12 3c-3 0-5 3-4 6-2 .6-3 4 0 5h8c3-1 2-4.4 0-5 1-3-1-6-4-6z',
    'M12 14v7',
    'M9 18h6',
  ],
  butcher: ['M7 4h10v3a5 5 0 0 1-10 0z', 'M9 14h6', 'M10 18h4', 'M9 21h6'],
  florist: ['M12 3c-2 0-3.5 1.5-3.5 3.5S10 10 12 10s3.5-1.5 3.5-3.5S14 3 12 3z', 'M12 10v11'],
  fashion: [
    'M12 4a2 2 0 0 0 0 4c1 0 1.5.8 0 1.6L4 14a1.5 1.5 0 0 0 .8 2.8h14.4A1.5 1.5 0 0 0 20 14l-8-4.4',
  ],
  books: [
    'M12 6c-2-1.2-4.5-1.5-7-1v13c2.5-.5 5-.2 7 1 2-1.2 4.5-1.5 7-1V5c-2.5-.5-5-.2-7 1z',
    'M12 6v13',
  ],
  market: [
    'M4 9l1-4h14l1 4',
    'M4 9h16',
    'M4 9v11h16V9',
    'M4 9c0 1.5 1 2.5 2.7 2.5S9.3 10.5 9.3 9M9.3 9c0 1.5 1.2 2.5 2.7 2.5S14.7 10.5 14.7 9M14.7 9c0 1.5 1 2.5 2.7 2.5S20 10.5 20 9',
  ],
  bank: ['M3 6h18v12H3z', 'M12 12a2.5 2.5 0 1 0 .01 0', 'M6 9v.01', 'M18 15v.01'],
  beauty: ['M6 7a2.5 2.5 0 1 0 .01 0', 'M6 17a2.5 2.5 0 1 0 .01 0', 'M8 8.5 20 17', 'M8 15.5 20 7'],
  other: ['M4 9l1-4h14l1 4', 'M4 9h16', 'M5 9v11h14V9', 'M9 20v-5h6v5'],
};

function iconPathsForKind(icon: PoiIconKind): readonly string[] {
  if (icon.family === 'visit') return VISIT_ICON_PATHS[icon.kind];
  if (icon.family === 'do') return DO_ICON_PATHS[icon.kind];
  if (icon.family === 'eat') return EAT_ICON_PATHS;
  return SHOP_ICON_PATHS[icon.kind];
}

function renderIconPaths(paths: readonly string[]): string {
  return paths
    .map(
      (d) =>
        `<path d="${d}" stroke="${MCH_MAP_COLORS.noir}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    )
    .join('');
}

export interface PoiMarkerInput {
  readonly bucket: PoiBucket;
  readonly type: string;
  readonly category: string | null;
  readonly name: string;
}

/**
 * Luxury Mapbox marker — taupe pin + crème medallion + typology glyph
 * (same families as {@link PoiMedallion} on the POI cards).
 */
export function buildLuxuryPoiMarkerElement(input: PoiMarkerInput): HTMLDivElement {
  const icon = resolvePoiIconKind(input.bucket, input.type, input.category, input.name);
  const pinColor = BUCKET_PIN_COLORS[input.bucket];
  const paths = iconPathsForKind(icon);

  const wrapper = document.createElement('div');
  wrapper.className = 'mch-poi-pin';
  wrapper.innerHTML = `<svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true" focusable="false" style="display:block;filter:drop-shadow(0 2px 4px rgba(43,39,34,0.28))">
    <path d="M14 0C7.4 0 2 5.4 2 12c0 8.5 12 24 12 24s12-15.5 12-24C26 5.4 20.6 0 14 0Z" fill="${pinColor}"/>
    <circle cx="14" cy="12" r="7.5" fill="${MCH_MAP_COLORS.pinCenter}" stroke="${pinColor}" stroke-width="0.75" opacity="0.95"/>
    <g transform="translate(5.5, 4.5) scale(0.58)">${renderIconPaths(paths)}</g>
  </svg>`;
  return wrapper;
}

export function resolvePoiMarkerIconKind(input: PoiMarkerInput): PoiIconKind {
  return resolvePoiIconKind(input.bucket, input.type, input.category, input.name);
}
