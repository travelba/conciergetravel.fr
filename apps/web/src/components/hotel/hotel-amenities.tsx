import { getTranslations } from 'next-intl/server';

import { AmenityCategoryIcon } from '@/components/hotel/amenity-category-icon';
import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedAmenityGroup } from '@/server/hotels/get-hotel-by-slug';

interface HotelAmenitiesProps {
  readonly locale: SupportedLocale;
  readonly groups: readonly LocalisedAmenityGroup[];
  /** Flat list (legacy `readAmenities`) used as fallback when `groups` is empty. */
  readonly flat: readonly string[];
}

/**
 * Amenities section for the hotel detail page — CDC §2 bloc 7.
 *
 * Renders amenities grouped by canonical category (wellness, dining,
 * services, family, …). Empty categories never render — `groups`
 * already filters them out at the reader level.
 *
 * When the row only carries free-form strings (no `key`), the registry
 * cannot categorize them; in that case `flat` is non-empty and `groups`
 * is empty, and we fall back to a single uncategorized chip list.
 *
 * Pure RSC, no client JS. "Premium" amenities (Palace-grade signature
 * services) get a subtle accent treatment.
 */
export async function HotelAmenities({
  locale,
  groups,
  flat,
}: HotelAmenitiesProps): Promise<React.ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  if (groups.length === 0) {
    return (
      <section aria-labelledby="amenities-title" className="mb-12">
        <h2 id="amenities-title" className="text-fg mb-3 font-serif text-2xl">
          {t('sections.amenities')}
        </h2>
        {flat.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {flat.map((a) => (
              <li
                key={a}
                className="border-border bg-bg text-fg rounded-md border px-3 py-1.5 text-sm"
              >
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t('noAmenities')}</p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="amenities-title" className="mb-12">
      {/*
        Progressive disclosure (2026-06-02): collapsed by default, same
        native <details> pattern as <HotelPolicies>. Zero client JS,
        keyboard-operable (a11y skill); the amenity chips stay in the DOM
        when folded so SEO/GEO crawlers and the JSON-LD `amenityFeature`
        still see every entry. The <h2> lives inside <summary> to keep the
        heading outline intact.
      */}
      <details className="group">
        <summary className="flex cursor-pointer select-none list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            className="text-muted shrink-0 transition-transform group-open:rotate-90"
          >
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h2 id="amenities-title" className="text-fg font-serif text-2xl">
            {t('sections.amenities')}
          </h2>
        </summary>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          {groups.map((group) => {
            const list = (
              <ul className="flex flex-wrap gap-1.5">
                {group.entries.map((entry) => (
                  <li
                    key={entry.key}
                    className={
                      entry.isPremium
                        ? 'rounded-md border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-sm text-amber-900'
                        : 'border-border bg-bg text-fg rounded-md border px-3 py-1.5 text-sm'
                    }
                  >
                    {entry.label}
                  </li>
                ))}
              </ul>
            );

            const title = t(`amenityCategories.${group.category}`);

            // Long categories (the "other / autres équipements" catch-all chief
            // among them) collapse behind a native <details> to keep the grid
            // compact. The chips stay in the DOM (details only hides them
            // visually) so SEO / GEO crawlers and the JSON-LD still see every
            // amenity. Short categories render open as plain blocks.
            if (group.entries.length > AMENITY_COLLAPSE_THRESHOLD) {
              return (
                <details
                  key={group.category}
                  className="group/amenity border-border bg-bg/40 flex flex-col gap-2 rounded-lg border px-3 py-2.5"
                >
                  <summary className="text-muted flex cursor-pointer list-none items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] [&::-webkit-details-marker]:hidden">
                    <AmenityCategoryIcon
                      category={group.category}
                      className="text-accent h-3.5 w-3.5 shrink-0"
                    />
                    <span>{title}</span>
                    <span className="text-muted/60 tracking-normal">({group.entries.length})</span>
                    <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-open/amenity:rotate-180" />
                  </summary>
                  <div className="mt-1">{list}</div>
                </details>
              );
            }

            return (
              <div key={group.category} className="flex flex-col gap-2">
                <h3 className="text-muted flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em]">
                  <AmenityCategoryIcon
                    category={group.category}
                    className="text-accent h-3.5 w-3.5 shrink-0"
                  />
                  <span>{title}</span>
                </h3>
                {list}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

/** Categories with more entries than this collapse behind a <details>. */
const AMENITY_COLLAPSE_THRESHOLD = 8;

function ChevronDownIcon({ className }: { readonly className?: string }): React.ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
