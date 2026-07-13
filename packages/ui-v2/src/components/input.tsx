import * as React from 'react';

import { cn } from '../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-xs)] transition-colors duration-[var(--motion-fast)]',
        'placeholder:text-[var(--color-muted)]/80',
        'focus-visible:border-[var(--color-ring)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:outline-[var(--color-danger)]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
