import type { ReactElement } from 'react';

/** Stitch mock chevron between breadcrumb segments. */
export function HeritageBreadcrumbChevron(): ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-70">
      <path
        fill="currentColor"
        d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.42 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.71 6.7a1 1 0 0 0-1.42 1.41Z"
      />
    </svg>
  );
}
