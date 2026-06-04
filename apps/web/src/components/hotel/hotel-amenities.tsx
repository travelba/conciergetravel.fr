import { getTranslations } from 'next-intl/server';

import { AmenityCategoryIcon } from '@/components/hotel/amenity-category-icon';
import type { SupportedLocale } from '@/i18n/supported-locale';
import type { AmenityCategory } from '@/server/hotels/amenity-taxonomy';
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
        {/*
          Richer category cards (2026-06-03): each canonical amenity group is
          a bordered card with an amber medallion + category glyph, the
          localised title, an entry counter, and the chip list. Same visual
          language as the events / POI / distinction blocks. Long categories
          (> AMENITY_COLLAPSE_THRESHOLD) keep their per-card <details> so the
          grid stays compact while the chips remain in the DOM for SEO/GEO +
          the JSON-LD `amenityFeature`.
        */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const list = (
              <ul className="flex flex-wrap gap-1.5">
                {group.entries.map((entry) => (
                  <li
                    key={entry.key}
                    className={
                      entry.isPremium
                        ? 'border-gold-200 bg-gold-50/60 text-gold-900 rounded-md border px-2.5 py-1 text-xs'
                        : 'border-border bg-bg text-fg/90 rounded-md border px-2.5 py-1 text-xs'
                    }
                  >
                    {entry.label}
                  </li>
                ))}
              </ul>
            );

            const title = t(`amenityCategories.${group.category}`);

            if (group.entries.length > AMENITY_COLLAPSE_THRESHOLD) {
              return (
                <details
                  key={group.category}
                  className="group/amenity border-border bg-bg/40 rounded-xl border p-4"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <AmenityMedallion category={group.category} />
                    <h3 className="text-fg flex-1 text-sm font-medium">{title}</h3>
                    <span className="text-muted text-xs tabular-nums">{group.entries.length}</span>
                    <ChevronDownIcon className="text-muted h-4 w-4 shrink-0 transition-transform duration-200 group-open/amenity:rotate-180" />
                  </summary>
                  <div className="mt-3">{list}</div>
                </details>
              );
            }

            return (
              <div
                key={group.category}
                className="border-border bg-bg/40 flex flex-col rounded-xl border p-4"
              >
                <div className="mb-3 flex items-center gap-3">
                  <AmenityMedallion category={group.category} />
                  <h3 className="text-fg flex-1 text-sm font-medium">{title}</h3>
                  <span className="text-muted text-xs tabular-nums">{group.entries.length}</span>
                </div>
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

/**
 * Amber medallion holding the category glyph — same visual language as the
 * events / POI / distinction blocks. Decorative (`aria-hidden` on the inner
 * SVG); the adjacent `<h3>` carries the category name for assistive tech.
 */
function AmenityMedallion({
  category,
}: {
  readonly category: AmenityCategory;
}): React.ReactElement {
  return (
    <span
      aria-hidden
      className="border-accent/30 bg-accent/10 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
    >
      <AmenityCategoryIcon category={category} className="h-5 w-5 shrink-0" />
    </span>
  );
}

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
