import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const sectionVariants = cva('', {
  variants: {
    /** Vertical rhythm between editorial sections. */
    spacing: {
      none: '',
      sm: 'py-10 sm:py-12',
      md: 'py-14 sm:py-20',
      lg: 'py-20 sm:py-section',
    },
    /** Constrain the inner width to the editorial column. */
    bleed: {
      full: '',
      editorial:
        '[&>*]:mx-auto [&>*]:max-w-editorial [&>*]:px-margin-mobile md:[&>*]:px-margin-desktop',
    },
  },
  defaultVariants: { spacing: 'md', bleed: 'full' },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {
  /** Override the rendered element (defaults to `<section>`). */
  as?: 'section' | 'div' | 'article' | 'aside';
}

/**
 * Editorial layout primitive — owns vertical rhythm so call sites stop
 * hand-rolling `py-14 sm:py-20`. Compose with `<Heading>` for the header.
 */
export function Section({
  as: Tag = 'section',
  spacing,
  bleed,
  className,
  ...props
}: SectionProps) {
  return <Tag className={cn(sectionVariants({ spacing, bleed }), className)} {...props} />;
}
Section.displayName = 'Section';

export { sectionVariants };
