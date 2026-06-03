import { getTranslations } from 'next-intl/server';

import type { HotelAffiliation } from '@mch/db';

import { DistinctionEmblem } from '@/components/hotel/distinction-emblem';
import { Link } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';

import { brandHrefSlug, buildTrustSignalsSections } from './hotel-trust-signals-helpers';

interface HotelTrustSignalsProps {
  readonly locale: SupportedLocale;
  readonly affiliations: readonly HotelAffiliation[];
  /**
   * Mirrors `hotels.is_palace` — the regulated Atout France Palace
   * distinction is carried by its own DB column (regulatory boolean,
   * decided by the French Ministry of Tourism) and does **not** require
   * a matching `palace_atout_france` row in `affiliations`. When this
   * flag is true we synthesise a Palace entry in the labels list so the
   * UI matches the JSON-LD `Hotel.award[]` (`hotelJsonLd` emits the
   * Palace string from `isPalace: true` — see
   * `packages/seo/src/jsonld/affiliations.ts`).
   */
  readonly isPalace: boolean;
}

/**
 * `<HotelTrustSignals>` — CDC §2 bloc 13 (Réassurance & autorité —
 * affiliations structurées). Pairs with the JSON-LD `Hotel.brand` +
 * `Hotel.award[]` emitted by `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`
 * (via `mapAffiliationsToBrand` / `mapAffiliationsToAwardStrings` in
 * `@mch/seo/jsonld`).
 *
 * Complementary to `<HotelAwards>` (bloc 11 — legacy editorial jsonb
 * column for one-off mentions like "Magazine of the Year 2023"). The
 * two components coexist:
 *   - `<HotelAwards>`        → editorial / press mentions, manual.
 *   - `<HotelTrustSignals>`  → structured systematic affiliations
 *                              (Palace, Forbes, R&C, brand…).
 *
 * Rendering rules (mirror `.cursor/skills/competitive-pricing-comparison/SKILL.md`):
 *   - text only — no trademark logos.
 *   - sober styling (font-serif heading, muted year metadata).
 *   - no external `dofollow` link towards the source (PageRank leak);
 *     the brand row links **internally** to `/marque/<slug>` when the
 *     page exists, otherwise plain text.
 *   - section self-elides when there is no verified affiliation AND
 *     `isPalace === false`.
 *
 * Pure RSC, no client JS. WCAG 2.2 AA: `<section aria-labelledby>` +
 * `<dl>` semantics, all text content is in the tabbable flow.
 */
export async function HotelTrustSignals({
  locale,
  affiliations,
  isPalace,
}: HotelTrustSignalsProps): Promise<React.ReactElement | null> {
  const sections = buildTrustSignalsSections({ affiliations, isPalace });
  if (!sections.hasAny) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.trustSignals' });
  const tSections = await getTranslations({ locale, namespace: 'hotelPage.sections' });

  const renderSinceYear = (year: number | undefined): string | null =>
    year !== undefined ? t('since', { year }) : null;

  const renderEntry = (entry: HotelAffiliation): React.ReactElement => {
    const sinceLabel = renderSinceYear(entry.since_year);
    return (
      <div key={`${entry.kind}-${entry.source}`} className="flex items-start gap-2.5">
        <DistinctionEmblem label={entry.display_name} size="sm" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-fg text-sm">{entry.display_name}</span>
          {sinceLabel !== null ? <span className="text-muted text-xs">{sinceLabel}</span> : null}
        </div>
      </div>
    );
  };

  return (
    <section aria-labelledby="trust-signals-title" className="mb-12">
      <h2 id="trust-signals-title" className="text-fg mb-4 font-serif text-2xl">
        {tSections('trustSignals')}
      </h2>

      <dl className="border-border bg-bg grid gap-6 rounded-lg border p-4 sm:p-5 md:grid-cols-4 md:gap-8">
        {sections.brand !== null ? (
          <div className="flex flex-col gap-2">
            <dt className="text-muted text-xs font-medium uppercase tracking-wider">
              {t('brand')}
            </dt>
            <dd className="flex items-start gap-2.5">
              <DistinctionEmblem
                label={sections.brand.display_name}
                forceKind="brand"
                size="sm"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                {(() => {
                  const slug = brandHrefSlug(sections.brand);
                  const sinceLabel = renderSinceYear(sections.brand.since_year);
                  return (
                    <>
                      {slug !== null ? (
                        <Link
                          href={{
                            pathname: '/marque/[brandSlug]',
                            params: { brandSlug: slug },
                          }}
                          className="text-fg text-sm underline decoration-dotted underline-offset-4 hover:decoration-solid"
                        >
                          {sections.brand.display_name}
                        </Link>
                      ) : (
                        <span className="text-fg text-sm">{sections.brand.display_name}</span>
                      )}
                      {sinceLabel !== null ? (
                        <span className="text-muted text-xs">{sinceLabel}</span>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </dd>
          </div>
        ) : null}

        {sections.labels.length > 0 ? (
          <div className="flex flex-col gap-2">
            <dt className="text-muted text-xs font-medium uppercase tracking-wider">
              {t('labels')}
            </dt>
            <dd className="flex flex-col gap-2">{sections.labels.map(renderEntry)}</dd>
          </div>
        ) : null}

        {sections.rankings.length > 0 ? (
          <div className="flex flex-col gap-2">
            <dt className="text-muted text-xs font-medium uppercase tracking-wider">
              {t('rankings')}
            </dt>
            <dd className="flex flex-col gap-2">{sections.rankings.map(renderEntry)}</dd>
          </div>
        ) : null}

        {sections.guides.length > 0 ? (
          <div className="flex flex-col gap-2">
            <dt className="text-muted text-xs font-medium uppercase tracking-wider">
              {t('guides')}
            </dt>
            <dd className="flex flex-col gap-2">{sections.guides.map(renderEntry)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
