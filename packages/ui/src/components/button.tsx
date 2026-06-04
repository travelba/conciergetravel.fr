import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-base ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-fg text-bg hover:bg-fg/90',
        accent: 'bg-gold text-charcoal hover:bg-gold-600',
        outline: 'border border-border bg-bg text-fg hover:bg-muted/10',
        ghost: 'text-fg hover:bg-muted/10',
        link: 'text-fg underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm min-h-[44px] sm:min-h-0',
        md: 'h-11 px-5 text-base min-h-[44px]',
        lg: 'h-13 px-7 text-lg min-h-[44px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element instead of a `<button>` (e.g. wrap a Next `<Link>`). */
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
