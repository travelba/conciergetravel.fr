'use client';

import { useState, type ReactElement } from 'react';

/**
 * `BadgeEmbedSnippet` — client island for the `/le-concierge/badge` page.
 *
 * Renders the copyable HTML embed snippet in a `<pre>` block with a
 * copy-to-clipboard button. The snippet string is computed server-side
 * (real origin + documented slug placeholder) and passed down as a prop,
 * so this island carries no business logic — only the clipboard
 * interaction that genuinely requires the browser.
 *
 * Falls back gracefully: if the Clipboard API is unavailable (older
 * browsers, insecure context) the `<pre>` remains manually selectable,
 * so the snippet is always copyable.
 */
export function BadgeEmbedSnippet({
  snippet,
  copyLabel,
  copiedLabel,
}: {
  readonly snippet: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the <pre> is still selectable by hand.
      setCopied(false);
    }
  }

  return (
    <div className="border-border bg-fg/[0.03] relative rounded-lg border">
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        className="border-border bg-bg text-fg hover:bg-muted/10 focus-visible:ring-ring absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2"
        aria-live="polite"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {copied ? (
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
              <path
                d="M10.5 5.5V4a1.2 1.2 0 0 0-1.2-1.2H4a1.2 1.2 0 0 0-1.2 1.2v5.3A1.2 1.2 0 0 0 4 10.5h1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
        {copied ? copiedLabel : copyLabel}
      </button>
      <pre className="text-fg overflow-x-auto p-4 pt-14 text-xs leading-relaxed">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
