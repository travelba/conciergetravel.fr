import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Loading placeholder. Animation is disabled automatically under
 * `prefers-reduced-motion` (see globals.css). Mark decorative with aria-hidden.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('bg-surface-container-high animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
