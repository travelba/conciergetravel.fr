'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const KIT_MAP_SLOT_ID = 'hotel-kit-map-slot';

/**
 * Mounts the React location map inside `#acces` on kit fiches — the shell
 * HTML leaves an empty slot; this portal fills it after hydration (same
 * pattern as the gallery React island above the fold).
 */
export function HotelKitMapPortal({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(KIT_MAP_SLOT_ID);
    if (el instanceof HTMLElement) {
      el.removeAttribute('aria-hidden');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capture the portal slot element after hydration
      setSlot(el);
    }
  }, []);

  if (slot === null) return null;
  return createPortal(children, slot);
}
