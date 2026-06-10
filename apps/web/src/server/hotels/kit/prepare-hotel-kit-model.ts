import 'server-only';

import { getTranslations } from 'next-intl/server';

import { AIRELLES_CONCIERGE_QUESTIONS_KIT } from '@mch/domain/editorial';
import { buildCloudinarySrc } from '@mch/ui';

import type { Locale } from '@/i18n/routing';
import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { formatIndicativePriceParts } from '@/lib/format-indicative-price';
import { citySlug } from '@/server/destinations/cities';
import { getAggregatedRoomPrices } from '@/server/booking/aggregated-room-prices';
import { getTravelportLiveRoomPrices } from '@/server/booking/travelport-offer';
import type { HotelRoomCardVM } from '@/components/hotel/hotel-rooms-grid';
import { getPathname } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { isTravelportSandboxEnabled } from '@/lib/travelport';
import type { HotelDetail } from '@/server/hotels/get-hotel-by-slug';
import {
  readAmenities,
  readAmenitiesByCategory,
  readAwards,
  readConciergeAdvice,
  readConciergeHook,
  readConciergePick,
  readExternalIds,
  readGoogleAccess,
  readGoogleReviews,
  readExternalSourcesProvenance,
  readFactualSummary,
  readFaq,
  readFaqByCategory,
  readFaqDisplayGroups,
  readFeaturedReviews,
  filterPublicHotelGalleryImages,
  readGallery,
  readHeroImage,
  readHighlights,
  readHotelHistoryDates,
  readHotelStory,
  readInstagram,
  readInventoryCounts,
  readLocationByBucket,
  readPhoneE164,
  readPolicies,
  readPostalCode,
  readRestaurants,
  readSignatureExperiences,
  readSpa,
  readTopConciergeFaq,
  readUpcomingEvents,
  type HotelDetailRow,
  type HotelFactualSummary,
  type LocalisedGalleryImage,
  type LocalisedFaqGroup,
  type LocalisedSignatureExperience,
  type LocalisedTransport,
} from '@/server/hotels/get-hotel-by-slug';
import type { AmenityCategory } from '@/server/hotels/amenity-taxonomy';
import { intlLocaleTag } from '@/i18n/runtime';
import type { AmadeusHotelSentiment } from '@/server/hotels/get-amadeus-sentiment';
import { getRelatedHotels, type RelatedHotelsBundle } from '@/server/hotels/get-related-hotels';
import {
  getRankingsForHotel,
  type HotelRankingMention,
} from '@/server/rankings/get-rankings-for-hotel';

import { dropCannibalizingSections, resolvePopulatedBlocks } from '@mch/domain/editorial';

import { createKitMediaResolver, type KitMediaResolver } from './kit-media-resolver';
import { isHotelKitSlug } from './is-hotel-kit-slug';
import { patchKitGoldenRow } from './patch-kit-golden-row';
import {
  enrichAirellesKitRoomCards,
  orderAirellesKitRoomCards,
  resolveAirellesKitRoomImages,
} from './kit-airelles-display';

function pickName(row: HotelDetailRow, locale: SupportedLocale): string {
  const enName = row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name;
  return pickByLocale(locale, row.name, enName);
}

/** Long-read sections minus those that duplicate populated structured blocks (CDC anti-cannibalisation). */
function readKitStorySections(row: HotelDetailRow, locale: SupportedLocale) {
  const filteredSections = dropCannibalizingSections(
    row.long_description_sections,
    resolvePopulatedBlocks({
      restaurantInfo: row.restaurant_info,
      spaInfo: row.spa_info,
      pointsOfInterest: row.points_of_interest,
    }),
  );
  return readHotelStory({ ...row, long_description_sections: filteredSections }, locale);
}

function pickDescription(row: HotelDetailRow, locale: SupportedLocale): string | null {
  return pickLocalizedText(locale, row.description_fr, row.description_en);
}

function formatIndicativePriceLabel(
  price: {
    readonly fromMinor: number;
    readonly toMinor: number | null;
    readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  } | null,
  locale: Locale,
  t: (key: string, values?: Record<string, string | number>) => string,
): string | null {
  if (price === null) return null;
  const parts = formatIndicativePriceParts(price, locale);
  return parts.to !== null
    ? t('rooms.indicativePriceRange', { from: parts.from, to: parts.to })
    : t('rooms.indicativePriceFrom', { from: parts.from });
}

export interface HotelKitGalleryTile {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface HotelKitResolvedRating {
  readonly ratingValue: number;
  readonly reviewCount: number;
  readonly bestRating: 5;
  readonly source: 'google' | 'amadeus' | 'booking';
}

export interface HotelKitEnBrefFact {
  readonly label: string;
  readonly value: string;
}

export interface HotelKitNavItem {
  readonly anchor: string;
  readonly label: string;
  readonly shortLabel: string;
  /** Hidden on ≤680px — secondary GEO / footer anchors. */
  readonly mobileHidden?: boolean;
}

export interface HotelKitConciergeQuestionGroup {
  readonly label: string;
  readonly items: readonly { question: string; reply: string }[];
}

function readAirellesConciergeQuestionGroups(
  slug: string,
  locale: SupportedLocale,
): readonly HotelKitConciergeQuestionGroup[] {
  if (!isHotelKitSlug(slug)) return [];
  const groups: HotelKitConciergeQuestionGroup[] = [];
  const indexByLabel = new Map<string, number>();
  for (const item of AIRELLES_CONCIERGE_QUESTIONS_KIT) {
    const label = pickLocalizedText(locale, item.category_fr, item.category_en) ?? item.category_fr;
    const question = item.question_fr;
    const reply = item.reply_fr;
    const existing = indexByLabel.get(label);
    const entry = { question, reply };
    if (existing === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, items: [entry] });
    } else {
      const group = groups[existing];
      if (group !== undefined) {
        groups[existing] = { label: group.label, items: [...group.items, entry] };
      }
    }
  }
  return groups;
}

export interface HotelKitEnBref {
  readonly eyebrow: string;
  readonly synthesis: string;
  readonly facts: readonly HotelKitEnBrefFact[];
  readonly lastUpdatedLabel: string | null;
  readonly lastUpdatedIso: string | null;
  readonly detailsSummary: string;
  readonly updatedAtLabel: string;
}

export interface HotelKitModel {
  readonly locale: 'fr' | 'en';
  readonly slugFr: string;
  readonly slugEn: string;
  readonly slugForLocale: string;
  readonly canonicalPath: string;
  readonly canonicalUrl: string;
  readonly cloudName: string;
  readonly name: string;
  readonly description: string | null;
  readonly city: string;
  readonly region: string;
  readonly district: string;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly countryLabel: string;
  readonly cityHubSlug: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly row: HotelDetail['row'];
  readonly highlights: readonly string[];
  readonly conciergeHook: string | null;
  readonly descriptionParagraphs: readonly string[];
  readonly storySections: ReturnType<typeof readHotelStory>;
  readonly factualSummary: HotelFactualSummary | null;
  readonly galleryHero: HotelKitGalleryTile | null;
  readonly galleryThumbs: readonly HotelKitGalleryTile[];
  readonly galleryOverflowCount: number;
  readonly galleryHeroDescriptor: {
    readonly publicId: string;
    readonly alt: string;
    readonly caption: string | null;
  } | null;
  readonly galleryGridImages: readonly LocalisedGalleryImage[];
  readonly resolvedRating: HotelKitResolvedRating | null;
  readonly roomCards: readonly HotelRoomCardVM[];
  readonly roomCount: number;
  readonly amenityGroups: ReturnType<typeof readAmenitiesByCategory>;
  readonly amenitiesFlat: readonly string[];
  readonly signatureExperiences: readonly LocalisedSignatureExperience[];
  readonly restaurants: ReturnType<typeof readRestaurants>;
  readonly spa: ReturnType<typeof readSpa>;
  readonly locationBuckets: ReturnType<typeof readLocationByBucket>;
  readonly transports: readonly LocalisedTransport[];
  readonly phone: string | null;
  readonly emailReservations: string | null;
  readonly officialWebsiteUrl: string | null;
  readonly googleMapsUrl: string | null;
  readonly googleReviews: ReturnType<typeof readGoogleReviews>;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly architects: readonly string[];
  readonly amenityCategoryLabels: Readonly<Record<AmenityCategory, string>>;
  readonly enBref: HotelKitEnBref;
  readonly policies: ReturnType<typeof readPolicies>;
  readonly featuredReviews: ReturnType<typeof readFeaturedReviews>;
  readonly awards: ReturnType<typeof readAwards>;
  readonly instagramFeed: ReturnType<typeof readInstagram>;
  readonly featuredInRankings: readonly HotelRankingMention[];
  readonly externalSourcesProvenance: ReturnType<typeof readExternalSourcesProvenance>;
  readonly faqGroups: readonly LocalisedFaqGroup[];
  readonly faqDisplayGroups: ReturnType<typeof readFaqDisplayGroups>;
  readonly faqsFlat: ReturnType<typeof readFaq>;
  readonly topConciergeFaq: ReturnType<typeof readTopConciergeFaq>;
  readonly conciergeQuestionGroups: readonly HotelKitConciergeQuestionGroup[];
  readonly conciergeAdvice: ReturnType<typeof readConciergeAdvice>;
  readonly relatedHotels: RelatedHotelsBundle;
  readonly upcomingEvents: ReturnType<typeof readUpcomingEvents>;
  readonly inventory: ReturnType<typeof readInventoryCounts>;
  readonly historyDates: ReturnType<typeof readHotelHistoryDates>;
  readonly railIndicativeFrom: string | null;
  readonly travelportRoomsHref: string;
  readonly reservationBasePath: string;
  readonly media: KitMediaResolver;
  readonly navItems: readonly HotelKitNavItem[];
  readonly labels: {
    readonly roomsSectionTitle: string;
    readonly roomsLede: string;
    readonly roomsMore: string;
    readonly conciergePick: string;
    readonly briefHotel: string;
    readonly press: string;
    readonly access: string;
    readonly around: string;
    readonly faq: string;
    readonly faqLede: string;
    readonly conciergeQuestions: string;
    readonly conciergeQuestionsLede: string;
    readonly proximity: string;
    readonly proximityLede: string;
    readonly exploreRegion: string;
    readonly ratingLabel: string;
    readonly ratingSuffix: string;
    readonly faqCategoryBefore: string;
    readonly faqCategoryDuring: string;
    readonly faqCategoryAfter: string;
    readonly faqCategoryAgency: string;
    readonly selectRoom: string;
    readonly fromPriceUnit: string;
    readonly accessCoordsTitle: string;
    readonly accessPoliciesTitle: string;
    readonly accessTransportTitle: string;
    readonly travelerReviewsTitle: string;
    readonly officialWebsite: string;
    readonly googleListing: string;
    readonly staticMapAlt: string;
    readonly staticMapAria: string;
    readonly mapAttributionHtml: string;
    readonly enBrefSectionTitle: string;
    readonly navHeading: string;
  };
}

function siteOrigin(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? 'https://myconciergehotel.com';
  return raw.replace(/\/$/, '');
}

const GALLERY_MAIN_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_1200,h_900';
const GALLERY_THUMB_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_600,h_450';
const ROOM_IMG_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_700,h_525';

function buildCloudinaryRoomImage(
  cloudName: string,
  publicId: string,
  alt: string,
): { readonly src: string; readonly alt: string } {
  return {
    src: buildCloudinarySrc({ cloudName, publicId, transforms: ROOM_IMG_TRANSFORMS }),
    alt,
  };
}

/** Kit room card — one official hero photo per category (no carousel on the grid). */
function buildKitRoomImages(
  room: {
    readonly slug: string;
    readonly room_code: string;
    readonly galleryImages: readonly { readonly publicId: string; readonly alt: string }[];
  },
  cloudName: string,
  hotelGallery: readonly LocalisedGalleryImage[],
  roomName: string,
): readonly { readonly src: string; readonly alt: string }[] {
  const curated = resolveAirellesKitRoomImages(room.slug, room.room_code);

  const altForPublicId = (publicId: string): string =>
    hotelGallery.find((g) => g.publicId === publicId)?.alt ??
    room.galleryImages.find((g) => g.publicId === publicId)?.alt ??
    roomName;

  const toImages = (entries: readonly { readonly publicId: string; readonly alt: string }[]) =>
    entries.map((g) => buildCloudinaryRoomImage(cloudName, g.publicId, g.alt));

  const dedupeByPublicId = (
    entries: readonly { readonly publicId: string; readonly alt: string }[],
  ): { publicId: string; alt: string }[] => {
    const seen = new Set<string>();
    const out: { publicId: string; alt: string }[] = [];
    for (const entry of entries) {
      if (seen.has(entry.publicId)) continue;
      seen.add(entry.publicId);
      out.push(entry);
    }
    return out;
  };

  if (curated !== undefined) {
    const entries: { publicId: string; alt: string }[] = [
      { publicId: curated.hero, alt: altForPublicId(curated.hero) },
    ];
    return toImages(dedupeByPublicId(entries));
  }

  if (room.galleryImages.length > 0) {
    const entries = dedupeByPublicId(room.galleryImages);
    return toImages(entries.slice(0, 1));
  }

  return [];
}

function toGalleryTile(
  cloudName: string,
  img: LocalisedGalleryImage,
  transforms: string,
  width: number,
  height: number,
): HotelKitGalleryTile {
  return {
    src: buildCloudinarySrc({ cloudName, publicId: img.publicId, transforms }),
    alt: img.alt,
    width,
    height,
  };
}

export async function prepareHotelKitModel(
  locale: Locale,
  detail: HotelDetail,
  amadeusSentiment: AmadeusHotelSentiment,
): Promise<HotelKitModel> {
  if (locale !== 'fr' && locale !== 'en') {
    throw new Error(`Hotel kit pilot supports fr/en only, got ${locale}`);
  }

  const kitLocale = locale;
  const t = await getTranslations({ locale: kitLocale, namespace: 'hotelPage' });
  const tRelated = await getTranslations({ locale: kitLocale, namespace: 'relatedHotels' });
  const tTldr = await getTranslations({ locale: kitLocale, namespace: 'hotelTldr' });
  const tCard = await getTranslations({ locale: kitLocale, namespace: 'reservationRooms.card' });
  const { rooms } = detail;
  const row = patchKitGoldenRow(detail.row);
  const externalIds = readExternalIds(row);
  const googleAccess = readGoogleAccess(row);
  const locationBuckets = readLocationByBucket(row, kitLocale);
  const policies = readPolicies(row, kitLocale);
  const inventory = readInventoryCounts(row);
  const historyDates = readHotelHistoryDates(row);

  const amadeusRating = amadeusSentiment.aggregate;
  const resolvedRating: HotelKitResolvedRating | null =
    row.google_rating !== null && row.google_reviews_count !== null && row.google_reviews_count > 0
      ? {
          ratingValue: row.google_rating,
          reviewCount: row.google_reviews_count,
          bestRating: 5,
          source: 'google',
        }
      : row.aggregate_rating_value !== null
        ? {
            ratingValue:
              row.aggregate_rating_value > 5
                ? Math.round((row.aggregate_rating_value / 2) * 100) / 100
                : row.aggregate_rating_value,
            reviewCount: row.aggregate_rating_count ?? 0,
            bestRating: 5,
            source: 'booking',
          }
        : amadeusRating !== null
          ? {
              ratingValue: amadeusRating.ratingValue,
              reviewCount: amadeusRating.reviewCount,
              bestRating: 5,
              source: 'amadeus',
            }
          : null;

  const name = pickName(row, kitLocale);
  const description = pickDescription(row, kitLocale);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const heroPublicId = readHeroImage(row);
  const galleryImages = filterPublicHotelGalleryImages(readGallery(row, kitLocale, name));
  const heroGalleryMatch =
    heroPublicId !== null ? galleryImages.find((g) => g.publicId === heroPublicId) : undefined;
  const galleryTiles =
    heroPublicId !== null
      ? galleryImages.filter((g) => g.publicId !== heroPublicId)
      : galleryImages;

  const heroInGallery = heroGalleryMatch !== undefined;
  const mosaicHero =
    heroGalleryMatch !== undefined
      ? toGalleryTile(cloudName, heroGalleryMatch, GALLERY_MAIN_TRANSFORMS, 1200, 900)
      : heroPublicId !== null
        ? {
            src: buildCloudinarySrc({
              cloudName,
              publicId: heroPublicId,
              transforms: GALLERY_MAIN_TRANSFORMS,
            }),
            alt: name,
            width: 1200,
            height: 900,
          }
        : galleryImages[0] !== undefined
          ? toGalleryTile(cloudName, galleryImages[0], GALLERY_MAIN_TRANSFORMS, 1200, 900)
          : null;

  const mosaicThumbCandidates =
    heroPublicId !== null && heroInGallery
      ? galleryTiles
      : heroPublicId !== null
        ? galleryImages
        : galleryImages.length > 1
          ? galleryImages.slice(1)
          : [];

  const mosaicThumbs = mosaicThumbCandidates
    .slice(0, 4)
    .map((img) => toGalleryTile(cloudName, img, GALLERY_THUMB_TRANSFORMS, 600, 450));

  const galleryOverflowCount = Math.max(0, galleryImages.length - (1 + mosaicThumbs.length));

  const galleryHeroDescriptor =
    heroGalleryMatch !== undefined
      ? {
          publicId: heroGalleryMatch.publicId,
          alt: heroGalleryMatch.alt,
          caption: heroGalleryMatch.caption,
        }
      : heroPublicId !== null
        ? {
            publicId: heroPublicId,
            alt: name,
            caption: null,
          }
        : galleryImages[0] !== undefined
          ? {
              publicId: galleryImages[0].publicId,
              alt: galleryImages[0].alt,
              caption: galleryImages[0].caption,
            }
          : null;

  const galleryGridImages =
    heroPublicId !== null
      ? galleryImages.filter((g) => g.publicId !== heroPublicId)
      : galleryImages;

  const slugFr = row.slug;
  const slugEn = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;
  const slugForLocale = pickByLocale(kitLocale, slugFr, slugEn);
  const canonicalPath = getPathname({
    locale: kitLocale,
    href: { pathname: '/hotel/[slug]', params: { slug: slugForLocale } },
  });
  const origin = siteOrigin();
  const canonicalUrl = `${origin}${canonicalPath}`;
  const cityHubSlug = citySlug(row.city);
  const countryLabel = pickByLocale(kitLocale, 'France', 'France');

  const travelportLiveRooms =
    row.booking_mode === 'travelport'
      ? await getTravelportLiveRoomPrices({ slug: row.slug, locale: kitLocale, rooms })
      : null;
  const aggregatedRoomPrices = await getAggregatedRoomPrices({
    hotelId: row.id,
    stay: {
      checkIn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10),
      adults: 1,
    },
  });

  const fmtLiveEur = (minor: number): string =>
    new Intl.NumberFormat(kitLocale === 'en' ? 'en-GB' : 'fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(minor / 100);

  const conciergePick = readConciergePick(row, kitLocale);

  const roomCards: HotelRoomCardVM[] = rooms.map((room, index) => {
    const fallbackTile =
      galleryTiles.length > 0 ? galleryTiles[index % galleryTiles.length] : undefined;
    const roomName = room.name ?? room.room_code;
    const isConciergePick = conciergePick !== null && room.slug === conciergePick.slug;
    const liveFromMinor =
      aggregatedRoomPrices?.fromByRoomId.get(room.id) ??
      travelportLiveRooms?.fromByRoomId.get(room.id);
    let livePriceText: string | null = null;
    let bookAria: string | null = null;
    if (liveFromMinor !== undefined) {
      const priceText = fmtLiveEur(liveFromMinor);
      livePriceText = tCard('from', { price: priceText });
      bookAria = tCard('bookAria', { room: roomName, price: priceText });
    }
    const roomImages = buildKitRoomImages(room, cloudName, galleryImages, roomName);
    const facts: string[] = [];
    if (room.size_sqm !== null) facts.push(t('rooms.size', { count: room.size_sqm }));
    if (room.bed_type !== null && room.bed_type !== '') facts.push(room.bed_type);
    if (room.max_occupancy !== null)
      facts.push(t('rooms.occupancy', { count: room.max_occupancy }));
    return {
      id: room.id,
      slug: room.slug,
      name: roomName,
      description: room.description,
      isSignature: room.isSignature,
      isConciergePick,
      conciergeNote: isConciergePick ? conciergePick.note : null,
      occupancy:
        room.max_occupancy !== null ? t('rooms.occupancy', { count: room.max_occupancy }) : null,
      priceLabel: formatIndicativePriceLabel(room.indicativePrice, kitLocale, t),
      images: roomImages,
      imageAlt: roomImages[0]?.alt ?? room.cardImageAlt ?? fallbackTile?.alt ?? roomName,
      facts,
      livePriceText,
      bookAria,
    };
  });

  const orderedRoomCards = enrichAirellesKitRoomCards(
    orderAirellesKitRoomCards(roomCards),
    kitLocale,
  );

  const priced = rooms
    .map((r) => r.indicativePrice)
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const railIndicativeFrom =
    priced.length > 0
      ? formatIndicativePriceParts(
          priced.reduce((a, b) => (b.fromMinor < a.fromMinor ? b : a)),
          kitLocale,
        ).from
      : null;

  const sandboxRoomsPath = getPathname({
    locale: kitLocale,
    href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug: slugFr } },
  });
  const reservationBasePath =
    row.booking_mode === 'travelport' && isTravelportSandboxEnabled() ? sandboxRoomsPath : '#resa';
  const travelportRoomsHref = sandboxRoomsPath;

  const [relatedHotels, featuredInRankings] = await Promise.all([
    getRelatedHotels({
      currentSlug: row.slug,
      city: row.city,
      region: row.region,
      name,
      department: row.department,
      latitude: row.latitude,
      longitude: row.longitude,
    }),
    getRankingsForHotel(row.id, { limit: 6 }),
  ]);

  const descriptionParagraphs =
    description !== null && description.length > 0
      ? description
          .split(/\n\n+/u)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [];

  const localeFmt = intlLocaleTag(kitLocale);
  const lastUpdatedLabel =
    row.updated_at !== null && row.updated_at !== ''
      ? new Intl.DateTimeFormat(localeFmt, { dateStyle: 'long' }).format(new Date(row.updated_at))
      : null;
  const lastUpdatedIso = row.updated_at !== null && row.updated_at !== '' ? row.updated_at : null;

  const hasRegion = row.region.trim().length > 0;
  const firstSentenceKey = row.is_palace
    ? hasRegion
      ? 'firstSentencePalace'
      : 'firstSentencePalaceNoRegion'
    : hasRegion
      ? 'firstSentenceFiveStar'
      : 'firstSentenceFiveStarNoRegion';
  const firstSentence = hasRegion
    ? tTldr(firstSentenceKey, { name, city: row.city, region: row.region })
    : tTldr(firstSentenceKey, { name, city: row.city });
  const totalRooms = inventory.totalRooms;
  const suites = inventory.suites;
  let inventorySentence: string | null = null;
  if (totalRooms !== null && totalRooms > 0) {
    inventorySentence =
      suites !== null && suites > 0
        ? tTldr('inventoryWithSuites', { rooms: totalRooms, suites })
        : tTldr('inventoryRoomsOnly', { rooms: totalRooms });
  }
  const fs = (key: string, values?: Record<string, string | number>) =>
    t(`factSheet.${key}`, values);

  const addressLineForFacts: string | null =
    row.address !== null
      ? readPostalCode(row) !== null && !row.address.includes(readPostalCode(row) ?? '')
        ? `${row.address}, ${readPostalCode(row)} ${row.city}`
        : row.address
      : null;
  const categoryLabel = row.is_palace
    ? fs('categoryPalace')
    : fs('categoryStars', { count: row.stars });
  const roomsLine: string | null =
    totalRooms !== null
      ? suites !== null && suites > 0
        ? fs('roomsWithSuites', { rooms: totalRooms, suites })
        : fs('roomsOnly', { rooms: totalRooms })
      : null;
  const checkInFrom = policies.checkIn !== null ? policies.checkIn.from : null;
  const checkOutUntil = policies.checkOut !== null ? policies.checkOut.until : null;
  const checkInLine: string | null =
    checkInFrom !== null && checkOutUntil !== null
      ? fs('checkInOut', { in: checkInFrom, out: checkOutUntil })
      : checkInFrom !== null
        ? fs('checkInOnly', { in: checkInFrom })
        : checkOutUntil !== null
          ? fs('checkOutOnly', { out: checkOutUntil })
          : null;
  const petsAllowed = policies.pets !== null ? policies.pets.allowed : null;
  const petsLine: string | null =
    petsAllowed === null ? null : petsAllowed ? fs('petsYes') : fs('petsNo');
  const openedYear = historyDates.openedYear;
  const lastRenovatedYear = historyDates.lastRenovatedYear;
  const historyLine: string | null =
    openedYear !== null
      ? lastRenovatedYear !== null && lastRenovatedYear !== openedYear
        ? fs('historyOpenedRenovated', { opened: openedYear, renovated: lastRenovatedYear })
        : fs('historyOpenedOnly', { opened: openedYear })
      : lastRenovatedYear !== null
        ? fs('historyRenovatedOnly', { renovated: lastRenovatedYear })
        : null;
  const architects = externalIds.knowledgeGraph.architects;
  let architectLine: string | null = null;
  if (architects.length === 1 && architects[0] !== undefined) {
    architectLine = tTldr('architectSingle', { name: architects[0] });
  } else if (architects.length >= 2 && architects[0] !== undefined && architects[1] !== undefined) {
    architectLine = tTldr('architectPair', { a: architects[0], b: architects[1] });
  }
  const geoLine: string | null =
    row.latitude !== null && row.longitude !== null
      ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`
      : null;

  const enBrefFacts: HotelKitEnBrefFact[] = [];
  if (addressLineForFacts !== null) {
    enBrefFacts.push({ label: fs('addressLabel'), value: addressLineForFacts });
  }
  if (row.district !== null && row.district !== '') {
    enBrefFacts.push({ label: fs('districtLabel'), value: row.district });
  }
  enBrefFacts.push({ label: fs('categoryLabel'), value: categoryLabel });
  if (roomsLine !== null) enBrefFacts.push({ label: fs('roomsLabel'), value: roomsLine });
  if (checkInLine !== null) enBrefFacts.push({ label: fs('checkInOutLabel'), value: checkInLine });
  if (petsLine !== null) enBrefFacts.push({ label: fs('petsLabel'), value: petsLine });
  if (historyLine !== null) enBrefFacts.push({ label: fs('historyLabel'), value: historyLine });
  if (architectLine !== null) {
    enBrefFacts.push({ label: fs('architectLabel'), value: architectLine });
  }
  if (geoLine !== null) enBrefFacts.push({ label: fs('geoLabel'), value: geoLine });

  const amenityCategoryLabels = {
    wellness: t('amenityCategories.wellness'),
    dining: t('amenityCategories.dining'),
    services: t('amenityCategories.services'),
    family: t('amenityCategories.family'),
    connectivity: t('amenityCategories.connectivity'),
    business: t('amenityCategories.business'),
    accessibility: t('amenityCategories.accessibility'),
    sustainability: t('amenityCategories.sustainability'),
    other: t('amenityCategories.other'),
  } as const;

  const media = createKitMediaResolver(cloudName, galleryImages, name);

  const featuredReviews = readFeaturedReviews(row, kitLocale);
  const awards = readAwards(row, kitLocale);
  const instagramFeed = readInstagram(row, kitLocale);
  const hasPresse =
    featuredReviews.length > 0 ||
    awards.length > 0 ||
    (instagramFeed !== null && instagramFeed.posts.length > 0) ||
    featuredInRankings.length > 0;

  const navItems: HotelKitNavItem[] = [
    { anchor: 'apropos', label: t('toc.recit'), shortLabel: t('tocShort.recit') },
    { anchor: 'chambres', label: t('toc.chambres'), shortLabel: t('tocShort.chambres') },
    { anchor: 'hotel-en-bref', label: t('toc.brefHotel'), shortLabel: t('tocShort.brefHotel') },
    ...(hasPresse
      ? [{ anchor: 'presse', label: t('toc.presse'), shortLabel: t('tocShort.presse') } as const]
      : []),
    { anchor: 'acces', label: t('toc.lieu'), shortLabel: t('tocShort.lieu') },
    { anchor: 'autour', label: t('toc.autour'), shortLabel: t('tocShort.autour') },
    { anchor: 'faq', label: t('toc.faq'), shortLabel: t('tocShort.faq') },
    { anchor: 'proximite', label: t('toc.proximite'), shortLabel: t('tocShort.proximite') },
    {
      anchor: 'en-bref',
      label: t('toc.enBref'),
      shortLabel: t('tocShort.enBref'),
      mobileHidden: true,
    },
  ];

  return {
    locale: kitLocale,
    slugFr,
    slugEn,
    slugForLocale,
    canonicalPath,
    canonicalUrl,
    cloudName,
    name,
    description,
    city: row.city,
    region: row.region,
    district: row.district ?? '',
    address: row.address,
    postalCode: readPostalCode(row),
    countryLabel,
    cityHubSlug,
    isPalace: row.is_palace,
    stars: row.stars as 1 | 2 | 3 | 4 | 5,
    row,
    highlights: readHighlights(row, kitLocale),
    conciergeHook: readConciergeHook(row, kitLocale),
    descriptionParagraphs,
    storySections: readKitStorySections(row, kitLocale),
    factualSummary: readFactualSummary(row, kitLocale),
    galleryHero: mosaicHero,
    galleryThumbs: mosaicThumbs,
    galleryOverflowCount,
    galleryHeroDescriptor,
    galleryGridImages,
    resolvedRating,
    roomCards: orderedRoomCards,
    roomCount: rooms.length,
    amenityGroups: readAmenitiesByCategory(row, kitLocale),
    amenitiesFlat: readAmenities(row, kitLocale),
    signatureExperiences: readSignatureExperiences(row, kitLocale),
    restaurants: readRestaurants(row, kitLocale),
    spa: readSpa(row, kitLocale),
    locationBuckets,
    transports: locationBuckets.transports,
    phone: readPhoneE164(row),
    emailReservations: externalIds.emailReservations,
    officialWebsiteUrl: googleAccess.officialUrl,
    googleMapsUrl: googleAccess.googleMapsUrl,
    googleReviews: readGoogleReviews(row, kitLocale),
    latitude: row.latitude,
    longitude: row.longitude,
    architects,
    amenityCategoryLabels,
    enBref: {
      eyebrow: tTldr('eyebrow'),
      synthesis: `${firstSentence}${inventorySentence !== null ? ` ${inventorySentence}.` : ''}`,
      facts: enBrefFacts,
      lastUpdatedLabel,
      lastUpdatedIso,
      detailsSummary: fs('detailsSummary'),
      updatedAtLabel: fs('updatedAtShort'),
    },
    policies,
    featuredReviews,
    awards,
    instagramFeed,
    featuredInRankings,
    externalSourcesProvenance: readExternalSourcesProvenance(row),
    faqGroups: readFaqByCategory(row, kitLocale),
    faqDisplayGroups: readFaqDisplayGroups(row, kitLocale),
    faqsFlat: readFaq(row, kitLocale),
    topConciergeFaq: readTopConciergeFaq(row, kitLocale),
    conciergeQuestionGroups: readAirellesConciergeQuestionGroups(row.slug, kitLocale),
    conciergeAdvice: readConciergeAdvice(row, kitLocale),
    relatedHotels,
    upcomingEvents: readUpcomingEvents(row, kitLocale),
    inventory,
    historyDates,
    railIndicativeFrom,
    travelportRoomsHref,
    reservationBasePath,
    media,
    navItems,
    labels: {
      roomsSectionTitle: t('sections.rooms'),
      roomsLede: '',
      roomsMore: t('rooms.seeAll', { count: rooms.length }),
      conciergePick: t('rooms.conciergePick'),
      briefHotel: t('sections.briefHotel'),
      press: t('sections.press'),
      access: t('sections.location'),
      around: t('sections.around'),
      faq: t('sections.faq'),
      faqLede:
        kitLocale === 'en'
          ? 'Everything a guest might ask before and during their stay — rooms, dining, spa, family and hotel policies.'
          : "Tout ce qu'un voyageur peut se demander avant et pendant son séjour — adresse, chambres, tables, spa, famille et politiques de la maison.",
      conciergeQuestions:
        kitLocale === 'en'
          ? 'The Concierge answers — Airelles Gordes, La Bastide'
          : 'Le Concierge répond — Airelles Gordes, La Bastide',
      conciergeQuestionsLede:
        kitLocale === 'en'
          ? 'Tables, transfers, spa, excursions or special occasions — how the Concierge replies when you ask.'
          : "Tables, transferts, spa, excursions ou occasions spéciales : voici comment le Concierge formule sa réponse lorsque l'on lui pose la question.",
      proximity: t('sections.nearby'),
      proximityLede: tRelated('sameCitySub'),
      exploreRegion: tRelated('sameRegionTitle', { region: row.region }),
      ratingLabel: '',
      ratingSuffix:
        resolvedRating !== null && resolvedRating.reviewCount > 0
          ? `${t('rating.reviewCountShort', { count: resolvedRating.reviewCount })} · ${kitLocale === 'en' ? 'rated /5' : 'note /5'}`
          : kitLocale === 'en'
            ? 'rated /5'
            : 'note /5',
      accessCoordsTitle: kitLocale === 'en' ? 'Contact details' : 'Coordonnées',
      accessPoliciesTitle: kitLocale === 'en' ? 'Stay conditions' : 'Conditions de séjour',
      accessTransportTitle: kitLocale === 'en' ? 'Getting there' : 'Accès',
      travelerReviewsTitle: kitLocale === 'en' ? 'Guest reviews' : 'Avis des voyageurs',
      officialWebsite: t('location.officialWebsite'),
      googleListing: t('location.googleListing'),
      staticMapAlt: t('location.staticMapAlt', { hotelName: name }),
      staticMapAria: t('location.staticMapAria', { hotelName: name }),
      mapAttributionHtml:
        kitLocale === 'en'
          ? '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
          : '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">Mapbox</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      enBrefSectionTitle: t('toc.enBref'),
      navHeading: t('toc.heading'),
      faqCategoryBefore: t('faq.categoryBefore'),
      faqCategoryDuring: t('faq.categoryDuring'),
      faqCategoryAfter: t('faq.categoryAfter'),
      faqCategoryAgency: t('faq.categoryAgency'),
      selectRoom: t('rooms.viewDetail'),
      fromPriceUnit: kitLocale === 'en' ? 'From / night' : 'À partir de / nuit',
    },
  };
}

// Re-export for type-only consumers
export type { HotelDetail };
