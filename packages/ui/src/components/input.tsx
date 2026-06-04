import * as React from 'react';
import { cn } from '../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Token-driven text input. Pairs with `<Label>` and the field-error pattern
 * (`aria-invalid` flips the border to the danger token).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'border-border bg-surface-container-lowest text-fg shadow-xs duration-fast flex h-11 w-full rounded-md border px-3 text-base transition-colors',
        'placeholder:text-muted/70',
        'focus-visible:border-ring focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
