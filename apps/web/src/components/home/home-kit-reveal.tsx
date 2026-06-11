'use client';

import { useEffect, type ReactElement, type ReactNode } from 'react';

/**
 * Progressive reveal on scroll — port of `design/html-kit/assets/app.js`
 * §reveal. Adds `is-visible` to `.reveal` nodes; falls back to visible
 * when `IntersectionObserver` is unavailable.
 */
export function HomeKitReveal({ children }: { readonly children: ReactNode }): ReactElement {
  useEffect(() => {
    const els = document.querySelectorAll('.mch-kit .reveal');
    if (els.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    els.forEach((el) => io.observe(el));

    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('is-visible'));
    }, 1600);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return <>{children}</>;
}
