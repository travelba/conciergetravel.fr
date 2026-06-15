'use client';

import type { ReactElement, ReactNode } from 'react';

import { POI_HOVER_EVENT, type PoiHoverDetail } from './hotel-interactive-map';

interface PoiHoverTargetProps {
  readonly poiId: string;
  readonly className: string;
  readonly children: ReactNode;
}

/** Bridges POI card hover (RSC list) to the interactive Mapbox canvas. */
export function PoiHoverTarget({ poiId, className, children }: PoiHoverTargetProps): ReactElement {
  const dispatchHover = (id: string | null): void => {
    window.dispatchEvent(
      new CustomEvent<PoiHoverDetail>(POI_HOVER_EVENT, { detail: { poiId: id } }),
    );
  };

  return (
    <li
      className={className}
      onMouseEnter={() => dispatchHover(poiId)}
      onMouseLeave={() => dispatchHover(null)}
      onFocus={() => dispatchHover(poiId)}
      onBlur={() => dispatchHover(null)}
    >
      {children}
    </li>
  );
}
