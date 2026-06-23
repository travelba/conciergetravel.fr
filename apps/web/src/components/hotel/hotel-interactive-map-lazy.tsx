'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import type { HotelMapLegendLabels, HotelMapPoi } from './hotel-interactive-map';

/**
 * Skeleton that reserves the exact box of the real {@link HotelInteractiveMap}
 * figure (rounded bordered card + 20/9 map area + two-line caption). Rendered
 * while the map chunk loads AND before the wrapper decides to mount, so the
 * lazy mount never introduces layout shift (CLS).
 */
function HotelInteractiveMapPlaceholder(): ReactElement {
  return (
    <figure className="border-border bg-bg overflow-hidden rounded-lg border" aria-hidden="true">
      <div className="bg-fg/5 aspect-[20/9] w-full animate-pulse" />
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="bg-fg/10 h-3 w-2/3 rounded-full" />
        <div className="bg-fg/10 h-3 w-1/3 rounded-full" />
      </div>
    </figure>
  );
}

/**
 * The heavy Mapbox GL client component is code-split into its own chunk via
 * `next/dynamic({ ssr: false })`. This keeps `mapbox-gl` (~469 KB) AND
 * `mapbox-gl/dist/mapbox-gl.css` out of the route's first-load JS — they are
 * fetched on demand only when {@link HotelInteractiveMapLazy} decides to mount.
 */
const HotelInteractiveMap = dynamic(
  () => import('./hotel-interactive-map').then((mod) => mod.HotelInteractiveMap),
  {
    ssr: false,
    loading: () => <HotelInteractiveMapPlaceholder />,
  },
);

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

interface HotelInteractiveMapLazyProps {
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

/**
 * Lightweight, mapbox-free wrapper that gates the interactive Mapbox GL canvas
 * behind two conditions, so mobile users never download the map engine:
 *
 *   1. **Desktop only** — the wrapper lives inside a `hidden lg:block` container
 *      and additionally re-checks `matchMedia('(min-width: 1024px)')` before
 *      mounting. On mobile the parent is `display:none`, so the
 *      IntersectionObserver never reports the element as intersecting.
 *   2. **Near the viewport** — an `IntersectionObserver` (`rootMargin: 200px`)
 *      defers the chunk download until the location block is about to scroll
 *      into view.
 *
 * Until both conditions hold, it renders {@link HotelInteractiveMapPlaceholder}
 * which reserves the same box → no layout shift when the map mounts.
 */
export function HotelInteractiveMapLazy(props: HotelInteractiveMapLazyProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (shouldMount) return undefined;
    const el = ref.current;
    if (el === null) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // The element only ever intersects when its `lg:block` container is
          // visible (desktop); the matchMedia guard is a belt-and-suspenders
          // re-check so a future markup change can't leak mapbox to mobile.
          if (entry.isIntersecting && window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
            setShouldMount(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldMount]);

  return (
    <div ref={ref}>
      {shouldMount ? <HotelInteractiveMap {...props} /> : <HotelInteractiveMapPlaceholder />}
    </div>
  );
}
