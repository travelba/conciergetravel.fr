'use client';

import { useMemo, useSyncExternalStore } from 'react';

import type { ConsentState } from '@mch/domain/consent';

import { onConsentChanged, readConsentClient } from './client';

export interface ConsentView {
  /** `true` once the user has made an explicit Accept / Reject / Save decision. */
  readonly hasDecision: boolean;
  /** Per-category booleans — `false` for any category when no decision yet. */
  readonly analytics: boolean;
  /** Always `true` — strictly-necessary cookies cannot be refused. */
  readonly essential: true;
}

const NO_DECISION_VIEW: ConsentView = {
  hasDecision: false,
  analytics: false,
  essential: true,
};

function toView(state: ConsentState | null): ConsentView {
  if (state === null) return NO_DECISION_VIEW;
  return { hasDecision: true, analytics: state.analytics, essential: true };
}

// Snapshot cache — `useSyncExternalStore` requires `getSnapshot` to return
// a referentially stable value between consecutive calls when nothing
// changed, otherwise React bails out with an infinite-render warning.
// We invalidate via the document.cookie string, which mutates whenever
// `writeConsentClient` runs (it rewrites the same name+value pair).
let cachedRaw: string | null | undefined;
let cachedState: ConsentState | null = null;

function getConsentSnapshot(): ConsentState | null {
  const raw = typeof document === 'undefined' ? null : document.cookie;
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  cachedState = readConsentClient();
  return cachedState;
}

function getServerSnapshot(): ConsentState | null {
  return null;
}

function subscribe(notify: () => void): () => void {
  return onConsentChanged(() => {
    cachedRaw = undefined;
    notify();
  });
}

/**
 * Reactive consent state — subscribes to `mch:consent-changed` and
 * re-renders dependent islands when the user updates their choices.
 *
 * Critical guarantees (skill: security-engineering §GDPR):
 *  - SSR-safe: returns `NO_DECISION_VIEW` on the server and during the
 *    first client render (via `getServerSnapshot`) so no analytics SDK
 *    ever renders until consent is confirmed.
 *  - Cross-tab updates are picked up on the next mount via the cookie
 *    read (browsers don't broadcast custom events across tabs).
 */
export function useConsent(): ConsentView {
  const state = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  return useMemo(() => toView(state), [state]);
}
