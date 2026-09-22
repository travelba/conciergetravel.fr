'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium transition-colors duration-[var(--motion-base)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-action)] text-[var(--color-action-on)] hover:bg-[var(--color-action-hover)]',
        secondary: 'bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-fg)]/90',
        accent:
          'bg-[var(--color-gold)] text-[var(--color-charcoal)] hover:bg-[var(--color-gold-600)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] text-[var(--color-fg)] hover:bg-[var(--color-surface-container-low)]',
        ghost: 'text-[var(--color-fg)] hover:bg-[var(--color-surface-container-low)]',
        link: 'text-[var(--color-action)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm min-h-[var(--space-touch-target)] sm:min-h-9',
        md: 'h-10 px-4 text-sm min-h-[var(--space-touch-target)]',
        lg: 'h-11 px-5 text-base min-h-[var(--space-touch-target)]',
        icon: 'h-10 w-10 min-h-[var(--space-touch-target)] min-w-[var(--space-touch-target)]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
