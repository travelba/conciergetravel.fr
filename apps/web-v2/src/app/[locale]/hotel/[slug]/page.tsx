import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Badge,
  PhotoMosaic,
  PriceSlot,
  RatingBadge,
  RoomTable,
  StickyBookingBox,
} from '@mch/ui-v2';

import { SeoJsonLd } from '@/components/seo/json-ld-script';
import { getHotelV2 } from '@/server/hotels/get-hotel-v2';
import { buildHotelV2JsonLdNodes, defaultHotelFaq } from '@/lib/seo/jsonld-hotel-v2';
import {
  HOTEL_DETAIL_ANCHORS,
  hotelDealsSectionTitle,
  hotelDetailSeo,
  hotelRatesSectionTitle,
} from '@/lib/seo/keyword-templates';

export const dynamic = 'force-dynamic';

// Famille de requêtes de la fiche : « Hôtel {Nom} (tarif|promo) » — ADR-0034.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale === 'en' ? 'en' : 'fr';
  const result = await getHotelV2({ slug, locale: resolvedLocale });
  if (result === null) return {};

  const seo = hotelDetailSeo({
    name: result.hotel.name,
    city: result.hotel.city,
    locale: resolvedLocale,
  });
  return { title: seo.title, description: seo.description };
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('hotel');

  const resolvedLocale = locale === 'en' ? 'en' : 'fr';
  const result = await getHotelV2({ slug, locale: resolvedLocale });
  if (result === null) notFound();

  const hotel = result.hotel;

  const seo = hotelDetailSeo({
    name: hotel.name,
    city: hotel.city,
    locale: resolvedLocale,
  });

  const faqEntries = hotel.faq.length > 0 ? hotel.faq : defaultHotelFaq(hotel, resolvedLocale);

  const jsonLdNodes = buildHotelV2JsonLdNodes({
    hotel,
    locale: resolvedLocale,
    faq: faqEntries,
  });

  const priceSlot = (
    <PriceSlot
      mode="live"
      publicPriceMinor={hotel.publicPriceMinor}
      currency="EUR"
      memberPriceMinor={hotel.memberPriceMinor}
      isMemberAuthenticated={false}
    />
  );

  return (
    <>
      <SeoJsonLd nodes={jsonLdNodes} />
      <div className="pb-12">
        <div className="ui-v2-container py-4 md:py-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {hotel.editorialBadge !== undefined ? (
                  <Badge variant="gold">{hotel.editorialBadge}</Badge>
                ) : null}
                <RatingBadge
                  scoreOutOfTen={hotel.ratingScoreOutOfTen}
                  reviewCount={hotel.reviewCount}
                />
              </div>
              <h1>{seo.h1}</h1>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {hotel.district}
                {hotel.distanceLabel.length > 0 ? ` · ${hotel.distanceLabel}` : ''}
              </p>
            </div>
          </div>

          <PhotoMosaic photos={hotel.photos} className="mb-8" />
        </div>

        <div className="ui-v2-container">
          <div className="grid gap-8 lg:grid-cols-[1fr_var(--sticky-booking-width)] lg:items-start">
            <div className="min-w-0 space-y-10">
              <section>
                <h2>{t('aboutTitle')}</h2>
                <p className="mt-4 leading-relaxed text-[var(--color-fg)]">{hotel.description}</p>
              </section>

              {hotel.conciergeAdvice.length > 0 ? (
                <section className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
                  <h2 className="text-base font-semibold">{t('conciergeTip')}</h2>
                  <p className="mt-3 text-sm leading-relaxed">{hotel.conciergeAdvice}</p>
                </section>
              ) : null}

              {hotel.editorialSections.length > 0 ? (
                <section>
                  <h2 className="mb-6">{t('editorialTitle')}</h2>
                  <div className="flex flex-col gap-8">
                    {hotel.editorialSections.map((section) => (
                      <article key={section.anchor} id={section.anchor} className="scroll-mt-24">
                        <h3 className="font-serif text-xl">{section.title}</h3>
                        <div className="mt-3 space-y-4 leading-relaxed text-[var(--color-fg)]">
                          {section.paragraphs.map((paragraph, index) => (
                            <p key={`${section.anchor}-${index}`}>{paragraph}</p>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {hotel.faq.length > 0 ? (
                <section id="faq" className="scroll-mt-24">
                  <h2 className="mb-6">{t('faqTitle')}</h2>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {hotel.faq.map((item, index) => (
                      <li key={`faq-${index}`} className="py-4">
                        <details className="group" {...(index === 0 ? { open: true } : {})}>
                          <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                            <span
                              className="mr-2 inline-block transition-transform group-open:rotate-90"
                              aria-hidden
                            >
                              ›
                            </span>
                            {item.question}
                          </summary>
                          <p className="mt-3 pl-5 text-sm leading-relaxed text-[var(--color-muted)]">
                            {item.answer}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Ancre #tarifs — capte « Hôtel {Nom} tarif » (ADR-0034 §1). */}
              {hotel.rooms.length > 0 ? (
                <section id={HOTEL_DETAIL_ANCHORS.rates} className="scroll-mt-24">
                  <h2 className="mb-4">{hotelRatesSectionTitle(hotel.name, resolvedLocale)}</h2>
                  <RoomTable
                    rows={hotel.rooms.map((room) => ({
                      id: room.id,
                      name: room.name,
                      maxOccupants: room.maxOccupants,
                      sizeSqm: room.sizeSqm,
                      bedDescription: room.bedDescription,
                      conditionsLabel: room.conditionsLabel,
                      priceSlot: (
                        <PriceSlot
                          mode="live"
                          publicPriceMinor={room.publicPriceMinor}
                          currency="EUR"
                          memberPriceMinor={Math.round(room.publicPriceMinor * 0.8)}
                          isMemberAuthenticated={false}
                        />
                      ),
                    }))}
                  />
                </section>
              ) : null}

              {/* Ancre #promos — capte « Hôtel {Nom} promo » (ADR-0034 §1). */}
              <section
                id={HOTEL_DETAIL_ANCHORS.deals}
                className="scroll-mt-24 rounded-sm border border-[var(--color-gold-300,#d9c58a)] bg-[var(--color-gold-100,#faf5e6)] p-6"
              >
                <h2 className="text-base font-semibold">
                  {hotelDealsSectionTitle(hotel.name, resolvedLocale)}
                </h2>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                  <li>
                    <strong>{resolvedLocale === 'fr' ? 'Tarif membre' : 'Member rate'}</strong>
                    {' — '}
                    {resolvedLocale === 'fr'
                      ? `jusqu'à -20 % sur le prix public (${(hotel.memberPriceMinor / 100).toLocaleString('fr-FR')} € au lieu de ${(hotel.publicPriceMinor / 100).toLocaleString('fr-FR')} € TTC / nuit).`
                      : `up to -20% off the public rate (€${(hotel.memberPriceMinor / 100).toLocaleString('en-GB')} instead of €${(hotel.publicPriceMinor / 100).toLocaleString('en-GB')} per night, taxes included).`}
                  </li>
                  <li>
                    {resolvedLocale === 'fr'
                      ? 'Avantages Concierge : surclassement selon disponibilité, petit-déjeuner offert sur une sélection de dates.'
                      : 'Concierge perks: upgrade on availability, complimentary breakfast on selected dates.'}
                  </li>
                </ul>
              </section>
            </div>

            <div className="lg:sticky lg:top-4">
              <StickyBookingBox
                datesLabel="15 – 18 oct. 2026"
                guestsLabel="2 adultes · 1 chambre"
                priceSlot={priceSlot}
                submitLabel={t('bookCta')}
                memberBenefitsSlot={
                  <p className="text-xs text-[var(--color-muted)]">{t('memberBenefits')}</p>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
