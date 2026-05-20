'use client';

import { useEffect } from 'react';

import type { AnalyticsEvent } from './events';
import { trackEvent } from './track';

/**
 * Fire-once hook for `view_*` events. Use in Server-Component-aware
 * trees by wrapping in a small `'use client'` shell.
 *
 * Important: the dependency array deliberately includes the entire
 * event payload — the hook should re-fire if the user navigates
 * across hotels client-side (rare, but possible with `next/link`).
 */
export function useTrackPageView(event: AnalyticsEvent): void {
  useEffect(() => {
    trackEvent(event);
    // We trust the caller to pass a stable reference per hotel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.name, JSON.stringify(event)]);
}

/**
 * Server-Component-friendly declarative tracker. Renders a tiny
 * client island that fires the event once after hydration. Use for
 * `view_hotel` (one per page mount).
 */
export function TrackPageView({ event }: { readonly event: AnalyticsEvent }): null {
  useTrackPageView(event);
  return null;
}
