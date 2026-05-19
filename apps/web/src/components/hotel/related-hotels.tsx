import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import type { RelatedHotelsBundle, RelatedHotelRow } from '@/server/hotels/get-related-hotels';

/** Normalises `''` → `null` so `pickLocalizedText` falls back correctly. */
function blankToNull(s: string | null | undefined): string | null {
  return s === undefined || s === null || s === '' ? null : s;
}

interface RelatedHotelsProps {
  readonly locale: SupportedLocale;
  readonly bundle: RelatedHotelsBundle;
  /** Region of the current hotel — used in the section heading. */
  readonly currentRegion: string;
  /** City of the current hotel — used in the section heading. */
  readonly currentCity: string;
}

function pickSlug(row: RelatedHotelRow, locale: SupportedLocale): string {
  // Per-locale column selection stays here (data layer — ADR-0012 Phase 1c).
  // V2 policy: FR/DE/ES/IT route via the FR slug; EN prefers slug_en when set.
  return pickLocalizedText(locale, row.slug, blankToNull(row.slug_en)) ?? row.slug;
}

function pickName(row: RelatedHotelRow, locale: SupportedLocale): string {
  return pickLocalizedText(locale, row.name, blankToNull(row.name_en)) ?? row.name;
}

function pickDescription(row: RelatedHotelRow, locale: SupportedLocale): string {
  const raw =
    pickLocalizedText(locale, blankToNull(row.description_fr), blankToNull(row.description_en)) ??
    '';
  if (raw.length <= 140) return raw;
  return raw.slice(0, 137).trimEnd() + '…';
}

/**
 * Maillage interne block (skill: seo-technical §Maillage + content-modeling).
 *
 * Renders up to 3 sections of related-hotel cards under the fiche:
 *   1. Same city  — 3-6 cards (other Palaces in the same locality)
 *   2. Same brand — 3-6 cards (e.g. all Cheval Blanc when applicable)
 *   3. Same region — 3-6 cards (other Palaces across the region)
 *
 * Each card is a fully-qualified `Link` to the related fiche so the
 * server-side renderer emits crawlable `<a href>`s — every internal
 * link participates in the PageRank graph without client-side JS.
 *
 * SEO contract:
 *   - h2 headings carry the cluster name (e.g. "Autres palaces à Paris")
 *     — direct on-page signal for "palaces paris" queries.
 *   - Cards expose `name`, `city`, `stars/palace` and a 140-char teaser.
 *   - `aria-labelledby` wires each section to its h2 for screen readers.
 *   - The block self-elides when the bundle is empty (e.g. for the
 *     unique Cheval Blanc St-Barth which has no same-city sibling).
 *
 * GEO/agentique contract:
 *   - Visible HTML mirrors the JSON-LD `containedRooms` / `sameAs` graph
 *     so LLM crawlers see consistent signals on both surfaces.
 *   - No client-side fetching — content is server-rendered and cached
 *     by the ISR layer (1 h on the hotel route).
 */
export async function RelatedHotels({
  locale,
  bundle,
  currentRegion,
  currentCity,
}: RelatedHotelsProps): Promise<ReactElement | null> {
  const t = await getTranslations({ locale, namespace: 'relatedHotels' });

  const sections: {
    key: string;
    title: string;
    sub: string;
    items: readonly RelatedHotelRow[];
  }[] = [];

  if (bundle.sameCity.length > 0) {
    sections.push({
      key: 'same-city',
      title: t('sameCityTitle', { city: currentCity }),
      sub: t('sameCitySub'),
      items: bundle.sameCity,
    });
  }
  if (bundle.brand !== null && bundle.sameBrand.length > 0) {
    sections.push({
      key: 'same-brand',
      title: t('sameBrandTitle', { brand: bundle.brand.label }),
      sub: t('sameBrandSub'),
      items: bundle.sameBrand,
    });
  }
  if (bundle.sameRegion.length > 0) {
    sections.push({
      key: 'same-region',
      title: t('sameRegionTitle', { region: currentRegion }),
      sub: t('sameRegionSub'),
      items: bundle.sameRegion,
    });
  }

  if (sections.length === 0) return null;

  return (
    <section
      id="related-hotels"
      aria-labelledby="related-hotels-title"
      className="border-t border-neutral-200 bg-neutral-50/60 py-12 md:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <h2 id="related-hotels-title" className="sr-only">
          {t('headingSr')}
        </h2>

        <div className="space-y-12">
          {sections.map((sec) => (
            <div key={sec.key} aria-labelledby={`rh-${sec.key}-title`}>
              <header className="mb-6 md:mb-8">
                <h3
                  id={`rh-${sec.key}-title`}
                  className="text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl"
                >
                  {sec.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">{sec.sub}</p>
              </header>

              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sec.items.map((row) => {
                  const slug = pickSlug(row, locale);
                  const name = pickName(row, locale);
                  const desc = pickDescription(row, locale);
                  return (
                    <li key={row.slug}>
                      <Link
                        href={{ pathname: '/hotel/[slug]', params: { slug } }}
                        className="group block h-full rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        prefetch={false}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                            {row.is_palace ? t('palace') : t('starsBadge', { count: row.stars })}
                          </span>
                          <span className="text-xs text-neutral-500">{row.city}</span>
                        </div>
                        <h4 className="mb-2 text-base font-semibold text-neutral-900 group-hover:text-amber-700 md:text-lg">
                          {name}
                        </h4>
                        {desc.length > 0 ? (
                          <p className="line-clamp-3 text-sm text-neutral-600">{desc}</p>
                        ) : null}
                        <span className="mt-3 inline-block text-xs font-medium text-amber-700 underline-offset-2 group-hover:underline">
                          {t('seeFiche')} →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
