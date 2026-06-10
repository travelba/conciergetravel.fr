import 'server-only';

import { JsonLd } from '@mch/seo';

import { buildCloudinarySrc } from '@mch/ui';

import { getPathname } from '@/i18n/navigation';
import { env } from '@/lib/env';
import {
  filterPublicHotelGalleryImages,
  readAffiliations,
  readAwards,
  readGallery,
  readHeroImage,
  readInventoryCounts,
  readPhoneE164,
  readPolicies,
  type GalleryLicence,
} from '@/server/hotels/get-hotel-by-slug';

import { pickHotelJsonLdFaqEntries } from '@/lib/seo/hotel-page-seo';
import { buildHotelCountryHubPath } from '@/server/hotels/country-hub-path';
import { buildHotelKnowledgeGraphJsonLdFields } from '@/server/hotels/hotel-json-ld-fields';
import { readExternalIds } from '@/server/hotels/get-hotel-by-slug';
import { buildOfferJsonLdInput } from '@/server/booking/prepare-hotel-booking-rail';
import type { HotelBookingRailContext } from '@/server/booking/prepare-hotel-booking-rail';

import type { HotelKitModel } from './prepare-hotel-kit-model';

export { buildHotelKitMetadata, buildHotelKitMetadataFromModel } from './build-hotel-kit-metadata';

function siteOrigin(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? 'https://myconciergehotel.com';
  return raw.replace(/\/$/, '');
}

const CC_LICENCE_URL: Partial<Record<GalleryLicence, string>> = {
  'cc-by-sa-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'cc-by-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

function imageRights(src: {
  readonly credit: string | null;
  readonly licence: GalleryLicence | null;
}): Pick<JsonLd.ImageObjectInput, 'creditText' | 'creator' | 'copyrightNotice' | 'license'> {
  const credit = src.credit?.trim();
  const hasCredit = credit !== undefined && credit.length > 0;
  const licenceUrl = src.licence !== null ? CC_LICENCE_URL[src.licence] : undefined;
  return {
    ...(hasCredit ? { creditText: credit, creator: credit, copyrightNotice: `© ${credit}` } : {}),
    ...(licenceUrl !== undefined ? { license: licenceUrl } : {}),
  };
}

function buildKitJsonLdImages(model: HotelKitModel): (string | JsonLd.ImageObjectInput)[] {
  const heroPublicId = readHeroImage(model.row);
  const galleryImages = filterPublicHotelGalleryImages(
    readGallery(model.row, model.locale, model.name),
  );
  const heroGalleryMatch =
    heroPublicId !== null ? galleryImages.find((g) => g.publicId === heroPublicId) : undefined;

  const jsonLdImages: (string | JsonLd.ImageObjectInput)[] = [];
  if (heroPublicId !== null) {
    jsonLdImages.push({
      url: buildCloudinarySrc({
        cloudName: model.cloudName,
        publicId: heroPublicId,
        transforms: 'f_auto,q_auto,w_1600,h_900,c_fill,g_auto',
      }),
      caption: heroGalleryMatch?.caption ?? heroGalleryMatch?.alt ?? model.name,
      width: 1600,
      height: 900,
      representativeOfPage: true,
      ...(heroGalleryMatch !== undefined ? imageRights(heroGalleryMatch) : {}),
    });
  }
  const thumbCandidates =
    heroPublicId !== null
      ? galleryImages.filter((g) => g.publicId !== heroPublicId)
      : galleryImages;
  for (const img of thumbCandidates.slice(0, 4)) {
    const url = buildCloudinarySrc({
      cloudName: model.cloudName,
      publicId: img.publicId,
      transforms: 'f_auto,q_auto,w_1230,h_820,c_fill,g_auto',
    });
    const caption = img.caption ?? (img.alt.length > 0 ? img.alt : null);
    const rights = imageRights(img);
    const hasRights = Object.keys(rights).length > 0;
    if (caption !== null) {
      jsonLdImages.push({ url, caption, width: 1230, height: 820, ...rights });
    } else if (hasRights) {
      jsonLdImages.push({ url, width: 1230, height: 820, ...rights });
    } else {
      jsonLdImages.push(url);
    }
  }
  return jsonLdImages;
}

/** JSON-LD for kit pilot fiches — parity with legacy hotel page builder. */
export function buildHotelKitJsonLd(
  model: HotelKitModel,
  railContext?: HotelBookingRailContext,
): Record<string, unknown>[] {
  const origin = siteOrigin();
  const jsonLdImages = buildKitJsonLdImages(model);
  const awards = readAwards(model.row, model.locale);
  const affiliations = readAffiliations(model.row);
  const policies = readPolicies(model.row, model.locale);
  const inventory = readInventoryCounts(model.row);
  const phoneE164 = readPhoneE164(model.row);

  const editorialAwards: string[] = awards
    .filter((a) => a.issuer.toLowerCase() !== 'atout france')
    .map((a) =>
      a.year !== null ? `${a.name} — ${a.issuer}, ${a.year}` : `${a.name} — ${a.issuer}`,
    );
  const affiliationAwards = JsonLd.mapAffiliationsToAwardStrings(affiliations);
  const affiliationBrand = JsonLd.mapAffiliationsToBrand(affiliations);
  const jsonLdAwardSeen = new Set<string>();
  const jsonLdAwards: string[] = [];
  for (const a of [...editorialAwards, ...affiliationAwards]) {
    const key = a.trim().toLowerCase();
    if (key.length === 0 || jsonLdAwardSeen.has(key)) continue;
    jsonLdAwardSeen.add(key);
    jsonLdAwards.push(a.trim());
  }

  const cityHubUrl = `${origin}${getPathname({
    locale: model.locale,
    href: { pathname: '/destination/[citySlug]', params: { citySlug: model.cityHubSlug } },
  })}`;

  const schemaDescription =
    model.factualSummary?.text ??
    (model.description !== null && model.description.length > 0
      ? model.description.slice(0, 500)
      : null);

  const visitPois = model.locationBuckets.visit;
  const allPois = [
    ...model.locationBuckets.visit,
    ...model.locationBuckets.do,
    ...model.locationBuckets.eat,
    ...model.locationBuckets.shop,
  ];

  const liveOffer =
    railContext !== undefined ? buildOfferJsonLdInput(railContext, model.canonicalUrl) : null;

  const externalIds = readExternalIds(model.row);
  const knowledgeGraph = buildHotelKnowledgeGraphJsonLdFields({
    externalIds,
    name: model.name,
    bookingMode: model.row.booking_mode,
    emailReservations: model.emailReservations,
    googleMapsUrl: model.googleMapsUrl,
    latitude: model.latitude,
    longitude: model.longitude,
    officialUrlFallback: model.officialWebsiteUrl,
  });

  const countryHubPath = buildHotelCountryHubPath(model.row, model.locale);
  const countryHubUrl = `${origin}${countryHubPath}`;

  const hotelNode = JsonLd.withSchemaOrgContext(
    JsonLd.hotelJsonLd({
      name: model.name,
      url: model.canonicalUrl,
      starRating: model.stars,
      isPalace: model.isPalace,
      ...(schemaDescription !== null && schemaDescription.length > 0
        ? { description: schemaDescription.slice(0, 500) }
        : {}),
      ...(jsonLdImages.length > 0 ? { images: jsonLdImages } : {}),
      ...(model.amenitiesFlat.length > 0 ? { amenityFeatures: [...model.amenitiesFlat] } : {}),
      ...(jsonLdAwards.length > 0 ? { awards: jsonLdAwards } : {}),
      ...(affiliationBrand !== null ? { brand: affiliationBrand } : {}),
      ...((): { telephone?: string } => {
        const display = typeof model.row.telephone === 'string' ? model.row.telephone.trim() : '';
        const tel = display.length > 0 ? display : phoneE164;
        return tel !== null ? { telephone: tel } : {};
      })(),
      ...(inventory.totalRooms !== null ? { numberOfRooms: inventory.totalRooms } : {}),
      ...(policies.checkIn !== null ? { checkinTime: policies.checkIn.from } : {}),
      ...(policies.checkOut !== null ? { checkoutTime: policies.checkOut.until } : {}),
      ...(policies.pets !== null ? { petsAllowed: policies.pets.allowed } : {}),
      ...(model.row.price_range !== null && model.row.price_range.trim() !== ''
        ? { priceRange: model.row.price_range.trim() }
        : {}),
      ...(model.featuredReviews.length > 0
        ? {
            featuredReviews: model.featuredReviews.map((r) => ({
              source: r.source,
              quote: r.quote,
              ...(r.sourceUrl !== null ? { sourceUrl: r.sourceUrl } : {}),
              ...(r.author !== null ? { author: r.author } : {}),
              ...(r.rating !== null && r.maxRating !== null
                ? { rating: r.rating, maxRating: r.maxRating }
                : {}),
              ...(r.dateIso !== null ? { date: r.dateIso } : {}),
            })),
          }
        : {}),
      ...(model.row.updated_at !== null && model.row.updated_at !== ''
        ? {
            dateModified: model.row.updated_at,
            lastReviewed: model.row.updated_at.slice(0, 10),
          }
        : {}),
      speakableSelectors: ['#factual-summary', '#en-bref', '#concierge-advice', '#faq'],
      ...(model.historyDates.openedYear !== null
        ? { foundingDate: String(model.historyDates.openedYear) }
        : {}),
      ...(model.restaurants !== null && model.restaurants.venues.length > 0
        ? {
            restaurants: model.restaurants.venues.map((v) => {
              const url = v.website ?? v.reservationUrl;
              const description = v.tip ?? v.mustOrder ?? null;
              return {
                name: v.name,
                ...(v.type !== null && v.type.length > 0 ? { servesCuisine: v.type } : {}),
                ...(v.michelinStars !== null && v.michelinStars > 0
                  ? { michelinStars: v.michelinStars }
                  : {}),
                ...(url !== null ? { url } : {}),
                ...(v.phone !== null ? { telephone: v.phone } : {}),
                ...(description !== null ? { description } : {}),
              };
            }),
          }
        : {}),
      ...(allPois.length > 0
        ? {
            nearbyAttractions: allPois.map((p) => ({
              name: p.name,
              type: p.type,
              ...(p.latitude !== null && p.longitude !== null
                ? { latitude: p.latitude, longitude: p.longitude }
                : {}),
              ...(p.description !== null && p.description.length > 0
                ? { description: p.description }
                : {}),
              ...(p.openingHours !== null && p.openingHours.length > 0
                ? { openingHours: p.openingHours }
                : {}),
              ...(p.schemaType !== null && p.schemaType.length > 0
                ? { schemaTypeUrl: p.schemaType }
                : {}),
            })),
          }
        : {}),
      ...(model.resolvedRating !== null
        ? {
            aggregateRating: {
              ratingValue: model.resolvedRating.ratingValue,
              reviewCount: model.resolvedRating.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
      geo: {
        latitude: model.row.latitude ?? 0,
        longitude: model.row.longitude ?? 0,
      },
      address: {
        streetAddress: model.address ?? '',
        addressLocality: model.city,
        postalCode: model.postalCode ?? '',
        addressCountry: 'FR',
        addressRegion: model.region,
      },
      containedInPlace: {
        name: model.city,
        url: cityHubUrl,
      },
      ...knowledgeGraph,
      ...(liveOffer !== null ? { offer: liveOffer } : {}),
    }),
  );

  const breadcrumbNode = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: model.locale === 'en' ? 'Home' : 'Accueil',
        url: `${origin}${getPathname({ locale: model.locale, href: '/' })}`,
      },
      {
        name: model.countryLabel,
        url: countryHubUrl,
      },
      {
        name: model.city,
        url: cityHubUrl,
      },
      { name: model.name, url: model.canonicalUrl },
    ]),
  );

  // JSON-LD FAQPage — promote subset only (10–15 CDC items), not the 40–60 kit DOM.
  // Skill: hotel-faq-perplexity-enrichment §Rule 3 + readFaqPromote in get-hotel-by-slug.
  const faqItems = pickHotelJsonLdFaqEntries(
    model.faqsPromote.map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
  );
  const faqNode =
    faqItems.length > 0 ? JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(faqItems)) : null;

  const visitItemListJsonLd =
    visitPois.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.poiItemListJsonLd({
            name:
              model.locale === 'en'
                ? 'What to visit near the hotel'
                : 'Ce qu’on visite dans le quartier',
            description:
              model.locale === 'en'
                ? 'Heritage sites and villages within easy reach of the hotel.'
                : 'Sites patrimoniaux et villages à portée de l’hôtel.',
            items: visitPois.map((p) => ({
              name: p.name,
              schemaType: JsonLd.osmToSchemaClass(p.type),
              ...(p.latitude !== null && p.longitude !== null
                ? { latitude: p.latitude, longitude: p.longitude }
                : {}),
              ...(p.description !== null && p.description.length > 0
                ? { description: p.description }
                : {}),
            })),
          }),
        )
      : null;

  return [
    hotelNode,
    breadcrumbNode,
    ...(faqNode !== null ? [faqNode] : []),
    ...(visitItemListJsonLd !== null ? [visitItemListJsonLd] : []),
  ] as unknown as Record<string, unknown>[];
}
