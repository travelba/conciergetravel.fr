import Image from 'next/image';
import { HotelCard, PriceSlot } from '@mch/ui-v2';

import type { DemoHotel } from '@/lib/demo-data';

type HotelCardListingProps = {
  hotel: DemoHotel;
};

export function HotelCardListing({ hotel }: HotelCardListingProps) {
  return (
    <HotelCard
      name={hotel.name}
      stars={hotel.stars}
      district={hotel.district}
      distanceLabel={hotel.distanceLabel}
      highlights={hotel.highlights}
      ratingScoreOutOfTen={hotel.ratingScoreOutOfTen}
      reviewCount={hotel.reviewCount}
      href={`/hotel/${hotel.slug}`}
      {...(hotel.editorialBadge !== undefined ? { editorialBadge: hotel.editorialBadge } : {})}
      image={
        <Image
          src={hotel.heroImage}
          alt={hotel.name}
          fill
          sizes="(max-width: 768px) 100vw, 280px"
          className="object-cover"
        />
      }
      priceSlot={
        <PriceSlot
          mode="live"
          publicPriceMinor={hotel.publicPriceMinor}
          currency="EUR"
          memberPriceMinor={hotel.memberPriceMinor}
          isMemberAuthenticated={false}
        />
      }
    />
  );
}
