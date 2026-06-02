import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedSpa } from '@/server/hotels/get-hotel-by-slug';

import { PracticalInfo } from './practical-info';

interface HotelSpaProps {
  readonly locale: SupportedLocale;
  readonly spa: LocalisedSpa;
}

/**
 * Spa/wellness section for the hotel detail page.
 *
 * Renders the spa name, surface area, number of treatment rooms, a localized
 * feature list, a short editorial description and the "Concierge dossier"
 * practical block (hours · indicative price · booking channel · tip) shared
 * with `<HotelRestaurants>` / `<HotelLocation>`. Source: `hotels.spa_info`
 * jsonb, parsed by `readSpa` and exposed via `LocalisedSpa`. Pure RSC.
 */
export async function HotelSpa({ locale, spa }: HotelSpaProps): Promise<React.ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <section
      aria-labelledby="spa-title"
      className="mb-12"
      itemScope
      itemType="https://schema.org/HealthClub"
    >
      <h2 id="spa-title" className="text-fg mb-3 font-serif text-2xl">
        {t('sections.spa')}
      </h2>

      <div className="border-border bg-bg/40 rounded-lg border p-5">
        <h3 className="text-fg text-lg font-medium" itemProp="name">
          {spa.name}
        </h3>

        {spa.surfaceSqm !== null || spa.treatmentRooms !== null ? (
          <ul className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {spa.surfaceSqm !== null ? (
              <li>{t('spa.surface', { value: spa.surfaceSqm })}</li>
            ) : null}
            {spa.treatmentRooms !== null ? (
              <li>{t('spa.treatmentRooms', { count: spa.treatmentRooms })}</li>
            ) : null}
          </ul>
        ) : null}

        {spa.description !== null ? (
          <p className="text-fg/90 mt-3 text-sm leading-relaxed" itemProp="description">
            {spa.description}
          </p>
        ) : null}

        {spa.features.length > 0 ? (
          <div className="mt-4">
            <p className="text-muted text-xs uppercase tracking-wide">{t('spa.featuresLabel')}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {spa.features.map((feature) => (
                <li
                  key={feature}
                  className="text-fg before:text-muted relative pl-4 text-sm before:absolute before:left-0 before:content-['•']"
                >
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <PracticalInfo
          hours={spa.hours}
          priceNote={spa.priceNote}
          phone={spa.phone}
          website={spa.website}
          reservationUrl={spa.reservationUrl}
          tip={spa.tip}
          labels={{
            title: t('practical.title'),
            hoursLabel: t('practical.hoursLabel'),
            priceLabel: t('practical.priceLabel'),
            phoneLabel: t('practical.phoneLabel'),
            addressLabel: t('practical.addressLabel'),
            website: t('practical.website'),
            reserve: t('practical.reserve'),
            conciergeTip: t('practical.conciergeTip'),
          }}
        />
      </div>
    </section>
  );
}
