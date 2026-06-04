import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-xl text-label-caps uppercase whitespace-nowrap',
  {
    variants: {
      variant: {
        /** Palace / classification — gold outline on transparent. */
        gold: 'border border-gold-600/60 px-2.5 py-1 text-gold-800',
        /** Solid gold fill (charcoal text for AA contrast). */
        solid: 'bg-gold px-2.5 py-1 text-charcoal',
        neutral: 'border border-border px-2.5 py-1 text-muted',
        success: 'border border-success/40 px-2.5 py-1 text-success',
        danger: 'border border-danger/40 px-2.5 py-1 text-danger',
      },
    },
    defaultVariants: { variant: 'gold' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
