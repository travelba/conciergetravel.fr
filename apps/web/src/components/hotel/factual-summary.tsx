import type { ReactElement } from 'react';

import type { HotelFactualSummary } from '@/server/hotels/get-hotel-by-slug';

interface FactualSummaryProps {
  readonly summary: HotelFactualSummary | null;
  /** Optional fallback rendered when no summary is set in DB. */
  readonly fallback: string | null;
}

/**
 * CDC §2.3 bloc — IA-ready factual summary surfaced right under the
 * H1 of the hotel detail page.
 *
 * Format owned by the editorial pipeline:
 *   `[Type] [étoiles] situé [quartier/ville], à [distance] de [POI],
 *    avec [3 USP].`
 *
 * Length target: 130-150 chars (CDC §2.3). The reader (`readFactualSummary`
 * in `apps/web/src/server/hotels/get-hotel-by-slug.ts`) flags out-of-
 * envelope entries via `isWithinTarget`; this component renders a
 * subtle dev-only warning when the flag is `false`.
 *
 * GEO contract:
 *   - Anchored via `id="factual-summary"` so the Hotel JSON-LD's
 *     `speakable.cssSelector` can target it (B10).
 *   - Marked with `data-aeo="factual-summary"` so AEO-aware crawlers
 *     and editorial QA scripts can extract it without parsing the
 *     full DOM.
 *
 * Fallback ladder when DB column is empty:
 *   1. `summary.text` (canonical)
 *   2. `fallback` prop (caller decides — usually the truncated
 *      description so the page never renders an empty slot)
 *   3. component returns `null` — no slot rendered.
 *
 * Pure RSC, no client JS.
 */
export function FactualSummary({ summary, fallback }: FactualSummaryProps): ReactElement | null {
  const text = summary?.text ?? fallback;
  if (text === null || text.length === 0) return null;

  return (
    <p
      id="factual-summary"
      data-aeo="factual-summary"
      data-llm-summary
      {...(summary !== null ? { 'data-source': 'editorial' } : { 'data-source': 'fallback' })}
      {...(summary !== null && !summary.isWithinTarget ? { 'data-length-warning': 'true' } : {})}
      className="text-fg mt-4 max-w-prose text-lg leading-snug sm:text-xl"
    >
      {text}
    </p>
  );
}
