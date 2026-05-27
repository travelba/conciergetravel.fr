'use client';

import type { ReactElement } from 'react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * `<HomeHeroVideo>` — autoplaying muted loop behind the hero copy.
 *
 * Client island isolated from the rest of the hero (which stays a
 * Server Component for LCP) so that:
 * - the `<video>` element only mounts in the browser, avoiding
 *   blocking the SSR critical path with a 4 MB asset;
 * - reduced-motion users get the poster image instead of the loop;
 * - the video pauses when the page is hidden (Vercel costs).
 *
 * Accessibility — the video is purely decorative. It carries
 * `aria-hidden="true"` and `tabIndex={-1}`; the screen-reader caption
 * lives in the poster `alt`.
 */
export function HomeHeroVideo({
  videoUrl,
  posterUrl,
  posterAlt,
}: {
  readonly videoUrl: string;
  readonly posterUrl: string;
  readonly posterAlt: string;
}): ReactElement {
  const ref = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onVisibility = (): void => {
      const v = ref.current;
      if (v === null) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (reducedMotion) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={posterUrl}
        alt={posterAlt}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      src={videoUrl}
      poster={posterUrl}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}
