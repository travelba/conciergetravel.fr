'use client';

import { useEffect, useState, type ReactElement } from 'react';

export interface HotelTocItem {
  readonly anchor: string;
  readonly label: string;
}

interface HotelTocProps {
  readonly heading: string;
  readonly items: readonly HotelTocItem[];
}

/**
 * Sticky table of contents for the hotel fiche (fiche-reorganisation
 * plan, A1). Mirrors the editorial long-read `<TocSidebar>` scroll-spy
 * pattern but is fed server-rendered, already-localised items (page.tsx
 * knows which clusters render, so absent sections never appear).
 *
 * Desktop-only (`hidden lg:block`) — it lives in the right rail above the
 * conversion slot. On mobile the rail stacks at the bottom of the page,
 * where a TOC would be useless, so we hide it there.
 *
 * The anchors resolve against the lightweight `<span id …>` markers placed
 * before each cluster in the fiche, so deep-links (`#avis`, `#faq`, …) and
 * LLM agents land on a stable, offset-corrected target.
 */
export function HotelToc({ heading, items }: HotelTocProps): ReactElement | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;
    const targets: HTMLElement[] = [];
    for (const item of items) {
      const el = document.getElementById(item.anchor);
      if (el !== null) targets.push(el);
    }
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop,
          );
        const first = visible[0];
        if (first) {
          setActiveId(first.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={heading}
      className="border-outline-variant bg-surface-container-lowest hidden border p-4 lg:block"
    >
      <p className="text-on-surface-variant text-label-caps tracking-caps mb-3 uppercase">
        {heading}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((item) => {
          const isActive = activeId === item.anchor;
          return (
            <li key={item.anchor}>
              <a
                href={`#${item.anchor}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block border-l-2 py-1 pl-3 transition-colors ${
                  isActive
                    ? 'border-l-primary-heritage text-on-surface font-medium'
                    : 'text-on-surface-variant hover:border-l-on-surface-variant/40 hover:text-on-surface border-l-transparent'
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
