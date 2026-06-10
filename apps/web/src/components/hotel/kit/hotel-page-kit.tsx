import { headers } from 'next/headers';

import { HotelExternalSourcesFooter } from '@/components/hotel/hotel-external-sources-footer';
import { HotelGallery } from '@/components/hotel/hotel-gallery';
import { SeoJsonLd } from '@/components/seo/json-ld';
import { TrackPageView } from '@/lib/analytics/hooks';
import type { Locale } from '@/i18n/routing';
import type { AmadeusHotelSentiment } from '@/server/hotels/get-amadeus-sentiment';
import type { HotelDetail } from '@/server/hotels/get-hotel-by-slug';
import { buildHotelKitJsonLd } from '@/server/hotels/kit/build-hotel-kit-json-ld';
import { prepareHotelKitModel } from '@/server/hotels/kit/prepare-hotel-kit-model';
import { assembleHotelKitShell } from '@/server/hotels/kit/render-hotel-kit-html';

import { BookingSlot } from '../booking-slot';
import { PriceComparator } from '../../price-comparator';
import { HotelKitInteractions } from './hotel-kit-interactions';

interface HotelPageKitProps {
  readonly locale: Locale;
  readonly detail: HotelDetail;
  readonly amadeusSentiment: AmadeusHotelSentiment;
}

/**
 * DA-first hotel fiche — markup calé sur `DA/les-airelles-gordes.html`
 * (classes kit : `.htl-gallery`, `.htl-section`, `.room-v2`, …) avec le
 * contenu injecté depuis Supabase (readers + overrides). L’aside résa /
 * comparateur reste React (widgets live).
 */
export async function HotelPageKit({
  locale,
  detail,
  amadeusSentiment,
}: HotelPageKitProps): Promise<React.ReactElement> {
  const model = await prepareHotelKitModel(locale, detail, amadeusSentiment);
  const { prefixHtml, mainHtml } = assembleHotelKitShell(model);
  const jsonLdNodes = buildHotelKitJsonLd(model);
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { row } = detail;

  return (
    <>
      <SeoJsonLd nonce={nonce} nodes={jsonLdNodes} />

      <div className="mch-kit hotel-page">
        <div dangerouslySetInnerHTML={{ __html: prefixHtml }} />

        {model.galleryHeroDescriptor !== null || model.galleryGridImages.length > 0 ? (
          <div className="wrap mt-3.5">
            <HotelGallery
              locale={model.locale}
              cloudName={model.cloudName}
              hero={model.galleryHeroDescriptor}
              images={model.galleryGridImages}
              hotelName={model.name}
            />
          </div>
        ) : null}

        <div className="htl-body wrap">
          <main className="htl-main" dangerouslySetInnerHTML={{ __html: mainHtml }} />

          <aside aria-label="Réservation" className="htl-aside" id="resa">
            <BookingSlot
              locale={model.locale}
              hotelName={model.name}
              surface="rail"
              slug={row.slug}
              bookingMode={row.booking_mode}
              priceFrom={model.railIndicativeFrom}
              embeddedInKitAside
            />
            <PriceComparator
              locale={model.locale}
              hotelId={row.id}
              priceConciergeMinor={null}
              surface="kit"
            />
          </aside>
        </div>

        {model.externalSourcesProvenance !== null ? (
          <div className="wrap">
            <HotelExternalSourcesFooter
              locale={model.locale}
              provenance={model.externalSourcesProvenance}
            />
          </div>
        ) : null}
      </div>

      <HotelKitInteractions />

      <BookingSlot
        locale={model.locale}
        hotelName={model.name}
        surface="mobilebar"
        slug={row.slug}
        bookingMode={row.booking_mode}
        priceFrom={model.railIndicativeFrom}
      />

      <TrackPageView
        event={{
          name: 'view_hotel',
          hotelId: row.id,
          slug: row.slug,
          locale: model.locale,
          bookingMode: row.booking_mode,
          isPalace: row.is_palace,
          stars: row.stars as 1 | 2 | 3 | 4 | 5,
          hasPriceFrom: model.railIndicativeFrom !== null,
        }}
      />
    </>
  );
}
