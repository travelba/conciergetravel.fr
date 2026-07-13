import { JsonLd } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import type { DemoHotel } from '@/lib/demo-data';
import { siteOrigin } from '@/lib/site-origin';

export type HotelFaqEntry = {
  readonly question: string;
  readonly answer: string;
};

export type HotelV2JsonLdInput = {
  hotel: DemoHotel;
  locale: Locale;
  faq?: ReadonlyArray<HotelFaqEntry>;
};

/** Converts UI /10 score to JSON-LD /5 scale (ADR-0032). */
export function ratingOutOfFiveFromTen(scoreOutOfTen: number): number {
  const clamped = Math.min(10, Math.max(0, scoreOutOfTen));
  return Math.round((clamped / 2) * 10) / 10;
}

function hotelPageUrl(locale: Locale, slug: string): string {
  const origin = siteOrigin();
  const path = getPathname({
    locale,
    href: { pathname: '/hotel/[slug]', params: { slug } },
  });
  return `${origin}${path}`;
}

function isHotelStarRating(value: number): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Hotel + FAQPage JSON-LD for v2 fiches.
 * UI shows /10 (ADR-0032); AggregateRating stays /5 with bestRating 5.
 */
export function buildHotelV2JsonLdNodes(input: HotelV2JsonLdInput): ReadonlyArray<object> {
  const { hotel, locale, faq = [] } = input;
  const url = hotelPageUrl(locale, hotel.slug);
  const ratingOutOfFive = ratingOutOfFiveFromTen(hotel.ratingScoreOutOfTen);
  const isPalace = hotel.editorialBadge?.toLowerCase().includes('palace') ?? false;

  const hotelBase = {
    name: hotel.name,
    url,
    description: hotel.description,
    isPalace,
    images: hotel.photos.map((p) => p.src),
    aggregateRating: {
      ratingValue: ratingOutOfFive,
      reviewCount: hotel.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    containedInPlace: {
      name: hotel.city,
      url: `${siteOrigin()}${getPathname({
        locale,
        href: {
          pathname: '/hotels/[pays]/[ville]',
          params: { pays: hotel.countrySlug, ville: hotel.citySlug },
        },
      })}`,
    },
    ...(isHotelStarRating(hotel.stars) ? { starRating: hotel.stars } : {}),
    ...(hotel.editorialBadge !== undefined ? { awards: [hotel.editorialBadge] as const } : {}),
  };

  const hotelNode = JsonLd.withSchemaOrgContext(JsonLd.hotelJsonLd(hotelBase));

  const nodes: object[] = [hotelNode];

  if (faq.length > 0) {
    nodes.push(JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(faq)));
  }

  return nodes;
}

/** Default FAQ stubs for demo fiches — replace with read-model FAQ kit. */
export function defaultHotelFaq(hotel: DemoHotel, locale: Locale): ReadonlyArray<HotelFaqEntry> {
  if (locale === 'en') {
    return [
      {
        question: `Where is ${hotel.name} located?`,
        answer: `${hotel.name} is in ${hotel.district}, ${hotel.city} (${hotel.distanceLabel}).`,
      },
      {
        question: `What is the Concierge tip for ${hotel.name}?`,
        answer: hotel.conciergeAdvice,
      },
    ];
  }
  return [
    {
      question: `Où se situe ${hotel.name} ?`,
      answer: `${hotel.name} est situé ${hotel.district}, ${hotel.city} (${hotel.distanceLabel}).`,
    },
    {
      question: `Quel est le conseil du Concierge pour ${hotel.name} ?`,
      answer: hotel.conciergeAdvice,
    },
  ];
}
