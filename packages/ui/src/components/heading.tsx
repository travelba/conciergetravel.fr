import * as React from 'react';
import { cn } from '../lib/cn';

type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Small uppercase kicker above the title (label-caps token). */
  eyebrow?: React.ReactNode;
  /** The title text (rendered as the chosen heading level, serif). */
  title: React.ReactNode;
  /** Optional supporting copy below the title. */
  subtitle?: React.ReactNode;
  /** Heading tag level for document outline (default h2). */
  level?: HeadingLevel;
  align?: 'start' | 'center';
  /** id forwarded to the title element (for aria-labelledby wiring). */
  titleId?: string;
}

const titleSize: Record<HeadingLevel, string> = {
  1: 'text-display-xl',
  2: 'text-headline-lg sm:text-display-xl',
  3: 'text-headline-lg',
  4: 'text-headline-md',
};

/**
 * Editorial heading group (eyebrow + serif title + subtitle). Replaces the
 * ad-hoc `<p class="uppercase tracking-[0.18em]"> + <h2 class="font-serif">`
 * pattern scattered across the surfaces.
 */
export function Heading({
  eyebrow,
  title,
  subtitle,
  level = 2,
  align = 'start',
  titleId,
  className,
  ...props
}: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        align === 'center' && 'items-center text-center',
        className,
      )}
      {...props}
    >
      {eyebrow != null && <p className="text-label-caps text-gold-700 uppercase">{eyebrow}</p>}
      <Tag id={titleId} className={cn('font-serif leading-tight', titleSize[level])}>
        {title}
      </Tag>
      {subtitle != null && <p className="text-body-md text-muted max-w-prose">{subtitle}</p>}
    </div>
  );
}
