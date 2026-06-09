'use client';

import { useId, useState } from 'react';

interface HotelStoryMoreProps {
  /**
   * Server-rendered detailed sections (TOC + article). Passed as children
   * so the markup stays in the initial HTML — the toggle only flips a
   * `hidden` class, it never unmounts the content. This keeps the long-form
   * body crawlable for SEO/GEO even while collapsed (CDC §6 anti-cloaking).
   */
  readonly children: React.ReactNode;
  readonly labels: {
    readonly more: string;
    readonly less: string;
  };
  /**
   * `kit` — DA `.read-more` / `.rm-clip` / `.rm-toggle` (gradient fade,
   * max-height expand). Content stays in the DOM when collapsed (overflow
   * hidden), matching `les-airelles-gordes.html`.
   */
  readonly variant?: 'default' | 'kit';
}

/**
 * "En savoir plus" / "Lire la description complète" disclosure for the
 * hotel "À propos" block (golden template).
 */
export function HotelStoryMore({
  children,
  labels,
  variant = 'default',
}: HotelStoryMoreProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const regionId = useId();

  if (variant === 'kit') {
    return (
      <div className={`mch-kit read-more${open ? 'open' : ''}`}>
        <div className="rm-clip">{children}</div>
        <button
          type="button"
          className="rm-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={regionId}
        >
          <span>{open ? labels.less : labels.more}</span>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={regionId}
        className="border-border text-fg hover:border-fg/40 hover:bg-fg/[0.03] focus-visible:ring-fg/40 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <span>{open ? labels.less : labels.more}</span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <div id={regionId} hidden={!open} className="mt-8">
        {children}
      </div>
    </div>
  );
}
