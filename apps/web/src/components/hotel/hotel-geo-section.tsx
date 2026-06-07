import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';
import type { GeoQaBlock } from '@/server/hotels/get-hotel-by-slug';

interface HotelGeoSectionProps {
  readonly locale: Locale;
  readonly hotelName: string;
  /** Localised GEO/AEO blocks (from `readGeoQa`). The caller renders this
   * component only when the array is non-empty. */
  readonly blocks: readonly GeoQaBlock[];
}

/**
 * GEO / AEO question blocks — data-driven (migration 0072 `hotels.geo_qa`).
 * Three short H2-led answers built for AI Overviews / answer engines: each
 * question mirrors a real long-tail query and is answered in 2-3 ≤ 25-word
 * sentences (concierge-voice skill).
 *
 * Factual integrity is the authoring concern (no fabricated distinction): the
 * copy lives in the DB column, sourced + validated per fiche, not in this
 * component. Originally hard-coded for the Airelles Gordes fiche (ACTION 5,
 * branch `seo/fix-airelles-gordes-test`); generalised so any golden fiche
 * (Prince de Galles, …) surfaces its own block.
 *
 * Pure RSC, no client JS. Self-elides via the caller when no blocks exist.
 */
export function HotelGeoSection({
  locale,
  hotelName,
  blocks,
}: HotelGeoSectionProps): ReactElement | null {
  if (blocks.length === 0) return null;
  return (
    <section
      aria-label={
        locale === 'en' ? `Key questions about ${hotelName}` : `Questions clés sur ${hotelName}`
      }
      data-geo="hotel-qa"
      className="mb-12 flex flex-col gap-8"
    >
      {blocks.map((block) => (
        <div key={block.id} id={block.id} className="scroll-mt-28">
          <h2 className="text-fg mb-3 font-serif text-2xl">{block.question}</h2>
          {block.paragraphs.map((p, i) => (
            <p key={i} className="text-muted max-w-prose leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
