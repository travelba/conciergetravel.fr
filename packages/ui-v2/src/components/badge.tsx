import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-xs font-medium leading-none',
  {
    variants: {
      variant: {
        gold: 'border border-[var(--color-gold-600)]/60 bg-transparent px-2 py-0.5 text-[var(--color-gold-800)]',
        solid: 'bg-[var(--color-gold)] px-2 py-0.5 text-[var(--color-charcoal)]',
        member: 'bg-[var(--color-gold-100)] px-2 py-0.5 text-[var(--color-gold-800)]',
        neutral:
          'border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-2 py-0.5 text-[var(--color-muted)]',
        success: 'border border-[var(--color-success)]/40 px-2 py-0.5 text-[var(--color-success)]',
        action: 'bg-[var(--color-action)] px-2 py-0.5 text-[var(--color-action-on)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
