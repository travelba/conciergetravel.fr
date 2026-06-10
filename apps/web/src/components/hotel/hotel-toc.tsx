'use client';

import { useEffect, useState, type ReactElement } from 'react';

export interface HotelTocItem {
  readonly anchor: string;
  readonly label: string;
}

interface HotelTocProps {
  readonly heading: string;
  readonly items: readonly HotelTocItem[];
  /**
   * `rail` (default) — boxed nav inside the sticky right column.
   * `floating` — collapsible widget pinned bottom-right of the viewport,
   * used when the fiche runs a single full-width column (golden template).
   */
  readonly variant?: 'rail' | 'floating';
  /** aria-labels for the floating toggle (ignored in `rail`). */
  readonly expandLabel?: string;
  readonly collapseLabel?: string;
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
export function HotelToc({
  heading,
  items,
  variant = 'rail',
  expandLabel,
  collapseLabel,
}: HotelTocProps): ReactElement | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  const list = (
    <ul className="space-y-1 text-sm">
      {items.map((item) => {
        const isActive = activeId === item.anchor;
        return (
          <li key={item.anchor}>
            <a
              href={`#${item.anchor}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={variant === 'floating' ? () => setOpen(false) : undefined}
              className={`block cursor-pointer border-l-2 py-1 pl-3 transition-colors ${
                isActive
                  ? 'text-fg border-l-gold-600 font-medium'
                  : 'text-muted hover:border-l-muted/40 hover:text-fg border-l-transparent'
              }`}
            >
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-6 right-6 z-40 hidden lg:block print:hidden">
        {open ? (
          <nav
            aria-label={heading}
            className="border-border bg-bg/95 max-h-[70vh] w-64 overflow-y-auto rounded-xl border p-4 shadow-2xl ring-1 ring-black/5 backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-muted text-xs font-medium uppercase tracking-wider">{heading}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={collapseLabel ?? heading}
                className="text-muted hover:text-fg -mr-1 cursor-pointer rounded p-1"
              >
                <svg aria-hidden viewBox="0 0 16 16" width="16" height="16">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {list}
          </nav>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={expandLabel ?? heading}
            className="border-border bg-bg/95 text-fg hover:bg-muted/10 flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-2xl ring-1 ring-black/5 backdrop-blur"
          >
            <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" className="shrink-0">
              <path
                d="M2 4h12M2 8h12M2 12h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>{heading}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <nav
      aria-label={heading}
      className="border-border bg-muted/5 hidden rounded-lg border p-4 lg:block"
    >
      <p className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">{heading}</p>
      {list}
    </nav>
  );
}
