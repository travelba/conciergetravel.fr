'use client';

import { readConsentClient } from '@/lib/consent/client';

import type { AnalyticsEvent } from './events';

/**
 * Consent-gated analytics dispatcher.
 *
 * Behaviour:
 *  - **No consent decision yet** → drops the event silently.
 *  - **Consent rejected** → drops the event silently.
 *  - **Consent granted** → dispatches a `mch:analytics-event` custom event
 *    on `window` (consumed by any sink: Vercel Analytics custom, GA4 via
 *    gtag, PostHog, Segment, …). Also pushes onto `window.dataLayer`
 *    when present (GTM-compatible).
 *
 * Server-side calls are no-ops (SSR safety).
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const consent = readConsentClient();
  if (consent === null || !consent.analytics) return;

  try {
    window.dispatchEvent(new CustomEvent('mch:analytics-event', { detail: event }));
  } catch {
    // Silently drop — analytics must never throw in user code.
  }

  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event: event.name, ...event });
  }
}
