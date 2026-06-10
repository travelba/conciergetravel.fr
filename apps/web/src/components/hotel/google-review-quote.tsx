'use client';

import { useCallback, useId, useState } from 'react';

const DEFAULT_MAX_CHARS = 220;

function truncateReviewText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s,;.:!?-]+$/u, '')}…`;
}

export interface GoogleReviewQuoteLabels {
  readonly seeMore: string;
  readonly seeLess: string;
}

export interface GoogleReviewQuoteProps {
  readonly text: string;
  readonly publishDate: string | null;
  readonly labels: GoogleReviewQuoteLabels;
  readonly maxChars?: number;
  readonly variant?: 'default' | 'kit';
}

/**
 * Truncated Google review quote with accessible expand/collapse.
 */
export function GoogleReviewQuote({
  text,
  publishDate,
  labels,
  maxChars = DEFAULT_MAX_CHARS,
  variant = 'default',
}: GoogleReviewQuoteProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const needsTruncate = text.length > maxChars;
  const displayText = !needsTruncate || expanded ? text : truncateReviewText(text, maxChars);

  const onToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  if (variant === 'kit') {
    return (
      <>
        {publishDate !== null ? (
          <time className="rv-date" dateTime={publishDate}>
            {publishDate}
          </time>
        ) : null}
        <p
          id={textId}
          className={needsTruncate && !expanded ? 'review-text is-clamped' : 'review-text'}
        >
          « {displayText} »
        </p>
        {needsTruncate ? (
          <button
            type="button"
            className="review-toggle btn-ligne"
            aria-expanded={expanded}
            aria-controls={textId}
            data-more={labels.seeMore}
            data-less={labels.seeLess}
            onClick={onToggle}
            onKeyDown={onKeyDown}
          >
            {expanded ? labels.seeLess : labels.seeMore}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      {publishDate !== null ? (
        <time className="text-muted mb-2 block text-xs" dateTime={publishDate}>
          {publishDate}
        </time>
      ) : null}
      <p id={textId} className="text-fg/90 text-sm leading-relaxed">
        {displayText}
      </p>
      {needsTruncate ? (
        <button
          type="button"
          className="text-muted hover:text-fg mt-2 cursor-pointer text-xs underline underline-offset-2"
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={onToggle}
          onKeyDown={onKeyDown}
        >
          {expanded ? labels.seeLess : labels.seeMore}
        </button>
      ) : null}
    </>
  );
}
