import type { ReactElement, ReactNode } from 'react';
import type { AlgoliaHotelRecord } from '@mch/integrations/algolia-hotel-catalog';

import { HotelCard } from '@/components/shared/hotel-card';

/**
 * `<SearchHotelCard>` — result tile for `/recherche`, a thin adapter over the
 * unified `<HotelCard>` (row variant, like the annuaire). It maps an Algolia
 * catalog hit to the card model.
 *
 * Honest-data only: the Algolia record carries no photo, so an elegant
 * monogram placeholder keeps the row height stable; no price or score is
 * fabricated. The optional `footer` slot below the card hosts the dev-fake
 * "reserve" affordance without nesting an interactive form inside the card
 * link.
 */
interface SearchHotelCardProps {
  readonly hit: AlgoliaHotelRecord;
  readonly palaceLabel: string;
  /** Star glyph suffix, e.g. "★". */
  readonly starsSuffix: string;
  readonly viewLabel: string;
  /** Optional content rendered under the card (e.g. dev-fake reserve form). */
  readonly footer?: ReactNode;
}

function monogram(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter.length > 0 ? letter : 'H';
}

function buildLocation(hit: AlgoliaHotelRecord): string {
  const secondary = hit.district ?? hit.region ?? '';
  return [hit.city ?? '', secondary]
    .map((part) => part.trim())
    .filter((part, index, all) => part.length > 0 && all.indexOf(part) === index)
    .join(' · ');
}

export function SearchHotelCard({
  hit,
  palaceLabel,
  starsSuffix,
  viewLabel,
  footer,
}: SearchHotelCardProps): ReactElement {
  const media = (
    <div
      role="img"
      aria-label={hit.name}
      className="from-surface-container to-surface-container-high flex h-full w-full items-center justify-center bg-gradient-to-br"
    >
      <span className="text-muted/40 font-serif text-4xl">{monogram(hit.name)}</span>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <HotelCard
        href={{ pathname: '/hotel/[slug]', params: { slug: hit.slug } }}
        variant="row"
        name={hit.name}
        location={buildLocation(hit)}
        distinction={{
          label: hit.is_palace ? palaceLabel : `${hit.stars}${starsSuffix}`,
          isPalace: hit.is_palace,
        }}
        excerpt={hit.description_excerpt.length > 0 ? hit.description_excerpt : null}
        ctaLabel={viewLabel}
        media={media}
        dataAttrs={{
          'data-hotel-id': hit.objectID,
          'data-stars': hit.stars,
          'data-palace': hit.is_palace ? '1' : '0',
          'data-city': hit.city ?? '',
          'data-name': hit.name,
        }}
      />
      {footer != null ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
