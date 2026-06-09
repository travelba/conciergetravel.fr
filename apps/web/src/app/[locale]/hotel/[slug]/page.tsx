import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { JsonLd, buildAeoBlock } from '@mch/seo';

import { buildCloudinarySrc, HotelImage } from '@mch/ui';

import { BookingSlot } from '@/components/hotel/booking-slot';
import { TravelportLiveRooms } from '@/components/hotel/travelport-live-rooms';
import { getAggregatedRoomPrices } from '@/server/booking/aggregated-room-prices';
import { getTravelportLiveRoomPrices } from '@/server/booking/travelport-offer';
import { ConciergeAdvice } from '@/components/hotel/concierge-advice';
import { FactualSummary } from '@/components/hotel/factual-summary';
import { HotelHero } from '@/components/hotel/hotel-hero';
import { HotelBookingBar } from '@/components/hotel/hotel-booking-bar';
import { HotelHeroOverlay } from '@/components/hotel/hotel-hero-overlay';
import { HotelAmenities } from '@/components/hotel/hotel-amenities';
import { LocalGuideTeaser } from '@/components/hotel/local-guide-teaser';
import { TrackPageView } from '@/lib/analytics/hooks';
import { HotelAwards } from '@/components/hotel/hotel-awards';
import { HotelEnBref } from '@/components/hotel/hotel-en-bref';
import { HotelFaq } from '@/components/hotel/hotel-faq';
import { TopConciergeFaq } from '@/components/hotel/top-concierge-faq';
import { HotelFeaturedInRankings } from '@/components/hotel/hotel-featured-in-rankings';
import { HotelFeaturedReviews } from '@/components/hotel/hotel-featured-reviews';
import { HotelGallery } from '@/components/hotel/hotel-gallery';
import { HotelGeoSection } from '@/components/hotel/hotel-geo-section';
import { HotelInstagram } from '@/components/hotel/hotel-instagram';
import HotelEvents from '@/components/hotel/hotel-events';
import { HotelLocation, HotelNeighbourhoodBuckets } from '@/components/hotel/hotel-location';
import { HotelMiceEvents } from '@/components/hotel/hotel-mice-events';
import { HotelPolicies } from '@/components/hotel/hotel-policies';
import { HotelRestaurants } from '@/components/hotel/hotel-restaurants';
import { HotelRoomsGrid, type HotelRoomCardVM } from '@/components/hotel/hotel-rooms-grid';
import { HotelSignatureExperiences } from '@/components/hotel/hotel-signature-experiences';
import { HotelSpa } from '@/components/hotel/hotel-spa';
import { HotelStory } from '@/components/hotel/hotel-story';
import { HotelToc, type HotelTocItem } from '@/components/hotel/hotel-toc';
import { HotelTrustSignals } from '@/components/hotel/hotel-trust-signals';
import { HotelExternalSourcesFooter } from '@/components/hotel/hotel-external-sources-footer';
import { HotelVirtualTour } from '@/components/hotel/hotel-virtual-tour';
import { RelatedHotels } from '@/components/hotel/related-hotels';
import { SeoJsonLd } from '@/components/seo/json-ld';
import { getPathname, Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { computeHotelPriceRange, formatIndicativePriceParts } from '@/lib/format-indicative-price';
import { citySlug } from '@/server/destinations/cities';
import { getGuideTeaserForCity } from '@/server/guides/get-guide-teaser';
import {
  getAmadeusHotelSentiment,
  type AmadeusHotelSentiment,
} from '@/server/hotels/get-amadeus-sentiment';
import { isHotelIndexable } from '@/server/hotels/indexability';
import {
  getHotelBySlug,
  listPublishedHotelSlugs,
  readAffiliations,
  readAmenities,
  readAmenitiesByCategory,
  readAwards,
  readExternalIds,
  hasAnyPolicy,
  readFaq,
  readFaqByCategory,
  readTopConciergeFaq,
  readFeaturedReviews,
  readGallery,
  readHeroImage,
  readHeroVideo,
  readHighlights,
  readHotelHistoryDates,
  readHotelStory,
  readInventoryCounts,
  readLocation,
  readMiceInfo,
  readUpcomingEvents,
  readPhoneE164,
  readPolicies,
  readPostalCode,
  readConciergeAdvice,
  readExternalSourcesProvenance,
  readFactualSummary,
  readRestaurants,
  readSignatureExperiences,
  readSpa,
  readInstagram,
  readConciergePick,
  readConciergeHook,
  readGeoQa,
  hasGoldenHero,
  readVirtualTour,
  type GalleryLicence,
  type HotelDetail,
  type HotelDetailRow,
  type SupportedLocale,
} from '@/server/hotels/get-hotel-by-slug';
import { getRelatedHotels } from '@/server/hotels/get-related-hotels';
import { getRankingsForHotel } from '@/server/rankings/get-rankings-for-hotel';

/**
 * Rendering mode (Phase 1 — editorial site, booking funnel removed):
 *
 *  - The fiche no longer hosts a booking funnel: the prime conversion
 *    slot is a passive `<BookingSlot>` placeholder until the Amadeus /
 *    Little APIs are wired in Phase 6 (see ADR-0024 + AGENTS.md §4ter).
 *    The page therefore no longer reads stay-window `searchParams`.
 *  - It still emits multiple `<JsonLdScript>` blocks that need the
 *    per-request CSP nonce; the page reads it once via
 *    `next/headers#headers()` and forwards it as a prop (see
 *    `components/seo/json-ld.tsx`). Reading `headers()` forces dynamic
 *    rendering, so a declared `revalidate` would throw
 *    `DYNAMIC_SERVER_USAGE` on cold render.
 *  - We therefore keep **full dynamic rendering** (`force-dynamic`) for
 *    now. The HTML is still served fast: the page is a pure Server
 *    Component and every upstream call is either cached in Redis
 *    (Amadeus sentiment) or feeds from a hot Supabase row. Flipping
 *    back to ISR (`revalidate = 3600`) is tracked as a follow-up once
 *    the CSP strategy moves from per-request nonces to build-time
 *    hashes (see the fiche-reorganisation plan, PR `isr-freshness`).
 *
 * See ADR-0007 (Sprint 4.1) for the original dynamic-rendering rationale.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

function pickName(row: HotelDetailRow, locale: SupportedLocale): string {
  const enName = row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name;
  return pickByLocale(locale, row.name, enName);
}

function pickDescription(row: HotelDetailRow, locale: SupportedLocale): string | null {
  return pickLocalizedText(locale, row.description_fr, row.description_en);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/[\s,;.:!?-]+$/u, '');
  return `${cut}…`;
}

/**
 * Render an indicative room-price range as a single human label.
 *
 * The price is editorial (not the live Amadeus rate), so we render
 * "À partir de 1 200 €" for an open-ended range, "1 200 – 2 800 €"
 * for a closed range, and `null` when no price is set. We always
 * round to whole units (no decimals) — the indicative price block is
 * about anchoring expectations, not selling.
 */
function formatIndicativePrice(
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

export async function generateStaticParams(): Promise<Array<{ locale: string; slug: string }>> {
  try {
    const slugs = await listPublishedHotelSlugs();
    const params: Array<{ locale: string; slug: string }> = [];
    for (const s of slugs) {
      params.push({ locale: 'fr', slug: s.slugFr });
      if (s.slugEn !== null) {
        params.push({ locale: 'en', slug: s.slugEn });
      } else {
        params.push({ locale: 'en', slug: s.slugFr });
      }
    }
    return params;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const detail = await getHotelBySlug(slug, locale);
  if (!detail) return { robots: { index: false, follow: false } };

  const { row } = detail;
  const name = pickName(row, locale);
  const description = pickDescription(row, locale);
  // V2 locales fall back to FR meta until migration 0034 adds the new
  // `meta_title_<locale>` / `meta_desc_<locale>` columns.
  const titleOverride = pickLocalizedText(locale, row.meta_title_fr, row.meta_title_en);
  const descOverride = pickLocalizedText(locale, row.meta_desc_fr, row.meta_desc_en);

  const title =
    titleOverride !== null && titleOverride !== ''
      ? titleOverride
      : t('meta.titleFallback', { name, city: row.city });

  // SEO — golden-fiche title de-duplication. The stored `meta_title_*`
  // already ends with "| MyConciergeHotel" and the root layout template
  // (`app/layout.tsx`: `%s · MyConciergeHotel`) appends a second brand
  // suffix, yielding "… | MyConciergeHotel · MyConciergeHotel". Golden fiches
  // (the curated reference set: Airelles Gordes, Prince de Galles, …) emit a
  // clean `absolute` title that bypasses the template; every other hotel keeps
  // the templated string, so no non-golden page changes. Data-driven via
  // `hasGoldenHero` — no per-slug flag.
  const metadataTitle: NonNullable<Metadata['title']> = hasGoldenHero(row)
    ? {
        absolute: `${name} — ${row.is_palace ? 'Palace' : `Hôtel ${row.stars}★`} ${row.city} | MyConciergeHotel`,
      }
    : title;
  const desc =
    descOverride !== null && descOverride !== ''
      ? descOverride
      : description !== null && description.length > 0
        ? truncate(description, 160)
        : t('meta.descriptionFallback', { name, city: row.city });

  const slugFr = row.slug;
  const slugEn = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;
  // Slug selection stays locale-aware (data-layer concern) until
  // ADR-0012 Phase 3 collapses dual-locale columns into a single
  // `hotel_translations` table — see docs/runbooks/i18n-v2-rollout.md.
  // URL prefix is centralised via getPathname / buildHreflangAlternates.
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/hotel/[slug]', params: { slug: l === 'en' ? slugEn : slugFr } },
    });
  const canonical = buildCanonicalPath(locale);
  const origin = siteOrigin();
  const absoluteUrl = `${origin}${canonical}`;

  // Open Graph / Twitter Card image:
  //   - Use the hotel hero (Cloudinary) when present, served at the
  //     OG-recommended 1200×630 (1.91:1).
  //   - We force `c_fill,g_auto` to keep the focal point centred and
  //     `f_jpg,q_auto` because some social parsers (notably older
  //     LinkedIn crawlers) still choke on WebP — JPEG is the safest
  //     interchange format for share previews.
  //   - Cap the URL string at the documented Facebook limit (no
  //     practical risk with our public_id grammar, but we encode
  //     defensively via `buildCloudinarySrc`).
  //   - Fall back to undefined when no hero is set; Next.js drops the
  //     `og:image` tag rather than emitting an empty one.
  const heroPublicId = readHeroImage(row);
  const ogImageUrl =
    heroPublicId !== null
      ? buildCloudinarySrc({
          cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          publicId: heroPublicId,
          transforms: 'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630',
        })
      : undefined;
  const ogImages =
    ogImageUrl !== undefined
      ? [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: name,
            type: 'image/jpeg' as const,
          },
        ]
      : undefined;

  // EEAT guard (Phase 1, May 2026 — `AGENTS.md §4ter`): a "stub" sheet
  // — i.e. one that does NOT meet the minimum indexability bar —
  // renders server-side so deep links from rankings still work, but
  // emits `noindex, follow` so Google doesn't index thin pages and
  // downgrade the site's overall quality signal.
  //
  // The predicate lives in `apps/web/src/server/hotels/indexability.ts`.
  // Two paths to indexability:
  //   1. Photo-rich (legacy): hero + (≥5 gallery photos OR ≥1 section)
  //   2. Editorial-only (Phase 1): ≥1 section OR full publish-gate set
  //      (description_fr ≥ 600, factual_summary_fr ≥ 100, concierge_advice
  //      non-null, faq_content ≥ 10).
  //
  // Phase 1 sequencing (catalogue editorial first, photos last) means
  // most published rows take path 2 until the photo orchestrator runs
  // (Phase 4). When hero_image lands, path 1 takes over automatically —
  // no DB change needed; ISR will pick it up on the next revalidate.
  //
  // As soon as the photo orchestrator hydrates the fiche
  // (`scripts/photos/sync-hotel-photos.ts`), the page becomes
  // indexable on the next request — `dynamic = 'force-dynamic'` so
  // there is no cache to invalidate.
  //
  // Single source of truth for the predicate is `isHotelIndexable` in
  // `apps/web/src/server/hotels/indexability.ts` — kept in lockstep
  // with `listIndexableHotelSlugs()` (sitemap) and `list-indexable-
  // for-llms.ts` (LLM corpus).
  const isStub = !isHotelIndexable(row);

  return {
    title: metadataTitle,
    description: desc,
    ...(isStub ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical,
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      type: 'website',
      title,
      description: desc,
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
      url: absoluteUrl,
      ...(ogImages !== undefined ? { images: ogImages } : {}),
    },
    twitter: {
      // `summary_large_image` is the only card type Twitter still
      // honours that gives a true hero treatment in DMs and timelines.
      card: 'summary_large_image',
      title,
      description: desc,
      ...(ogImageUrl !== undefined ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default async function HotelPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const detail = await getHotelBySlug(slug, locale);
  if (!detail) notFound();

  // Fetch Amadeus sentiment in parallel with i18n bootstrap. The helper
  // is fully forgiving (returns an `EMPTY` sentinel on missing id /
  // missing env / failure) so it never tanks the route — see
  // `get-amadeus-sentiment.ts`.
  const [t, amadeusSentiment] = await Promise.all([
    getTranslations('hotelPage'),
    getAmadeusHotelSentiment(detail.row.amadeus_hotel_id),
  ]);
  return renderHotelPage(locale, detail, t, amadeusSentiment);
}

async function renderHotelPage(
  locale: Locale,
  detail: HotelDetail,
  t: Awaited<ReturnType<typeof getTranslations<'hotelPage'>>>,
  amadeusSentiment: AmadeusHotelSentiment,
) {
  const amadeusRating = amadeusSentiment.aggregate;
  const amadeusCategories = amadeusSentiment.categories;
  const { row, rooms } = detail;

  // Single source of truth for the public score, on a /5 scale. Priority:
  // Google Places (the operator's canonical public rating) → editorial DB
  // value (normalised from its native scale, e.g. Booking /10 → /5) →
  // Amadeus e-Reputation. The SAME object feeds the visible hero badge AND
  // the JSON-LD `AggregateRating`, so what users see always matches the
  // structured data (Google policy: no markup without an on-page counterpart).
  const resolvedRating: {
    readonly ratingValue: number;
    readonly reviewCount: number;
    readonly bestRating: 5;
    readonly worstRating: 1;
    readonly source: 'google' | 'amadeus' | 'booking';
  } | null =
    row.google_rating !== null && row.google_reviews_count !== null && row.google_reviews_count > 0
      ? {
          ratingValue: row.google_rating,
          reviewCount: row.google_reviews_count,
          bestRating: 5,
          worstRating: 1,
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
            worstRating: 1,
            source: 'booking',
          }
        : amadeusRating !== null
          ? {
              ratingValue: amadeusRating.ratingValue,
              reviewCount: amadeusRating.reviewCount,
              bestRating: 5,
              worstRating: 1,
              source: 'amadeus',
            }
          : null;
  // JSON-LD enrichments + the GEO section below are fully data-driven: the
  // golden layout opts in via `hasGoldenHero` (concierge_hook) and the
  // priceRange / aggregateRating fields are naturally scoped to rows that
  // carry the migration-0066 values — no per-slug flag.
  const name = pickName(row, locale);
  const description = pickDescription(row, locale);
  const highlights = readHighlights(row, locale);
  const amenities = readAmenities(row, locale);
  const amenityGroups = readAmenitiesByCategory(row, locale);
  const restaurants = readRestaurants(row, locale);
  const spa = readSpa(row, locale);
  const instagramFeed = readInstagram(row, locale);
  const location = readLocation(row, locale);
  const policies = readPolicies(row, locale);
  const awards = readAwards(row, locale);
  const affiliations = readAffiliations(row);
  const postalCode = readPostalCode(row);
  const phoneE164 = readPhoneE164(row);
  const inventory = readInventoryCounts(row);
  const historyDates = readHotelHistoryDates(row);
  const storySections = readHotelStory(row, locale);
  const signatureExperiences = readSignatureExperiences(row, locale);
  const conciergeAdvice = readConciergeAdvice(row, locale);
  const externalSourcesProvenance = readExternalSourcesProvenance(row);
  const factualSummary = readFactualSummary(row, locale);
  const featuredReviews = readFeaturedReviews(row, locale);
  const faqs = readFaq(row, locale);
  const faqGroups = readFaqByCategory(row, locale);
  const topConciergeFaq = readTopConciergeFaq(row, locale);
  const heroPublicId = readHeroImage(row);
  const galleryImages = readGallery(row, locale, name);
  const virtualTour = readVirtualTour(row);
  const heroVideo = readHeroVideo(row);
  const miceInfo = readMiceInfo(row, locale);
  const upcomingEvents = readUpcomingEvents(row, locale);
  const externalIds = readExternalIds(row);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // Hero alt: prefer the gallery row whose public_id matches hero_image —
  // never the arbitrary `galleryImages[0]` which is unrelated when the
  // hero was uploaded outside the gallery flow. Falls back to the hotel
  // name (always a safe, descriptive alt) rather than to a stray entry.
  // Fix 2026-05-31 (`photo-quality.mdc` Hard Rule 16 + WCAG 1.1.1).
  const heroGalleryMatch =
    heroPublicId !== null ? galleryImages.find((g) => g.publicId === heroPublicId) : undefined;
  const heroDescriptor =
    heroPublicId !== null
      ? {
          publicId: heroPublicId,
          alt: heroGalleryMatch?.alt ?? name,
          caption: heroGalleryMatch?.caption ?? null,
        }
      : null;

  // The curation pass (`curate-top-photos.ts`) keeps the hero as
  // `gallery_images[0]` so its alt/caption metadata survives and re-curation
  // stays idempotent. The mosaic + lightbox render the hero separately
  // (`heroDescriptor`), so exclude it here to avoid showing it twice.
  const galleryTiles =
    heroPublicId !== null
      ? galleryImages.filter((g) => g.publicId !== heroPublicId)
      : galleryImages;

  // Golden-template (Airelles Gordes, local fixture only): the full-bleed
  // overlay hero already renders `heroDescriptor` edge-to-edge at the top of
  // the page, so the gallery mosaic below would otherwise repeat the exact
  // same shot as its big tile. Promote the first remaining gallery photo to
  // be the mosaic hero and shift the rest into the grid — keeping every
  // image unique. Falls back to the standard descriptor when no tile exists.
  const goldenTemplate = hasGoldenHero(row);
  const conciergePick = readConciergePick(row, locale);
  const conciergeHook = readConciergeHook(row, locale);
  const geoBlocks = readGeoQa(row, locale);
  const firstGalleryTile = galleryTiles[0];
  const galleryHero =
    goldenTemplate && firstGalleryTile !== undefined
      ? {
          publicId: firstGalleryTile.publicId,
          alt: firstGalleryTile.alt,
          caption: firstGalleryTile.caption,
        }
      : heroDescriptor;
  const galleryGridTiles =
    goldenTemplate && firstGalleryTile !== undefined ? galleryTiles.slice(1) : galleryTiles;

  // Total photos the lightbox cycles through (mirrors `<HotelGallery>` → hero
  // + grid tiles) — surfaced as the "Voir les photos (N)" hero header action.
  const galleryPhotoCount = (galleryHero !== null ? 1 : 0) + galleryGridTiles.length;

  // Golden-template rooms showcase: a 3-up card grid (photo + name +
  // description + CTA). The rooms table carries no per-room photo yet
  // (Phase 2), so each card borrows a distinct shot from the hotel
  // gallery (round-robin) to stay visual without fabricating data.
  const goldenRoomCards: readonly HotelRoomCardVM[] = goldenTemplate
    ? rooms.map((room, index) => {
        const tile =
          galleryTiles.length > 0 ? galleryTiles[index % galleryTiles.length] : undefined;
        const roomName = room.name ?? room.room_code;
        const isConciergePick = conciergePick !== null && room.slug === conciergePick.slug;
        return {
          id: room.id,
          slug: room.slug,
          name: roomName,
          description: room.description,
          isSignature: room.isSignature,
          isConciergePick,
          conciergeNote: isConciergePick ? conciergePick.note : null,
          occupancy:
            room.max_occupancy !== null
              ? t('rooms.occupancy', { count: room.max_occupancy })
              : null,
          priceLabel: formatIndicativePrice(room.indicativePrice, locale, t),
          imageSrc:
            tile !== undefined
              ? buildCloudinarySrc({
                  cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
                  publicId: tile.publicId,
                  transforms: 'f_auto,q_auto,c_fill,g_auto,w_640,h_480',
                })
              : null,
          imageAlt: tile?.alt ?? roomName,
        };
      })
    : [];

  // Surface the Concierge's recommended suite first so it leads the section.
  // The full catalogue is passed to the grid: the first row (3 cards) shows
  // by default and a "Voir toutes les chambres (N)" toggle reveals the rest,
  // so every room stays reachable in-page (each card also links to its
  // indexable sub-page).
  const orderedRoomCards: readonly HotelRoomCardVM[] = [
    ...goldenRoomCards.filter((card) => card.isConciergePick),
    ...goldenRoomCards.filter((card) => !card.isConciergePick),
  ];

  const slugFr = row.slug;
  const slugEn = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;
  const origin = siteOrigin();

  // Étape C — prix « à partir de » live Travelport injectés sur les cartes
  // chambres (best-effort, gated pilote ; `null` hors pilote ou en cas d'échec,
  // les cartes restent éditoriales). Voir `getTravelportLiveRoomPrices`.
  const travelportLiveRooms =
    (locale === 'fr' || locale === 'en') && row.booking_mode === 'travelport'
      ? await getTravelportLiveRoomPrices({ slug: row.slug, locale, rooms })
      : null;
  // Multi-supplier deterministic prices (Phase 3/4). Inert unless the
  // kill-switch is on AND supplier connections are seeded for this hotel;
  // when active, these `roomId -> best EUR` prices take precedence over the
  // legacy fuzzy Travelport overlay. See `getAggregatedRoomPrices`.
  const aggregatedRoomPrices =
    locale === 'fr' || locale === 'en'
      ? await getAggregatedRoomPrices({
          hotelId: row.id,
          stay: {
            checkIn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
            checkOut: new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10),
            adults: 1,
          },
        })
      : null;
  const tCard =
    locale === 'fr' || locale === 'en'
      ? await getTranslations({ locale, namespace: 'reservationRooms.card' })
      : null;
  // Entrée unifiée : la carte « Réserver » transporte des dates par défaut
  // cohérentes avec le rail (J+30 → J+31, 1 adulte) ; `/chambres` les réutilise.
  const travelportRoomsHref = {
    pathname: '/reservation/sandbox/[slug]/chambres',
    params: { slug: slugFr },
    query: {
      checkIn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10),
      adults: '1',
    },
  } as const;
  const fmtLiveEur = (minor: number): string =>
    new Intl.NumberFormat(intlLocaleTag(locale), {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  // Slug selection still locale-aware (data layer) — see ADR-0012.
  // V2 locales reuse the FR slug until `hotels.slug_<locale>` columns exist.
  const slugForLocale = pickByLocale(locale, slugFr, slugEn);
  const localePath = getPathname({
    locale,
    href: { pathname: '/hotel/[slug]', params: { slug: slugForLocale } },
  });
  const canonicalUrl = `${origin}${localePath}`;

  // JSON-LD Hotel images (B8 / CDC §2 bloc 2): hero + first 5 gallery
  // shots emitted as rich `ImageObject` nodes when we have captions.
  // The builder accepts a mixed array (strings + ImageObject), so we
  // ship `representativeOfPage: true` on the hero (Google honours it as
  // the canonical SERP thumbnail) and fall back to bare URLs when the
  // gallery row has no editorial alt text yet.
  // Image provenance + Licensable metadata (photo-pipeline SMD → JSON-LD).
  // A Creative-Commons licence resolves to its public licence URL, which
  // lights up Google's "Licensable" badge. Press-kit / all-rights-reserved /
  // fair-use photos emit credit + copyright ONLY — we are not the licensor,
  // so we never claim a Licensable link for a media-kit shot (EEAT integrity).
  const CC_LICENCE_URL: Partial<Record<GalleryLicence, string>> = {
    'cc-by-sa-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'cc-by-4.0': 'https://creativecommons.org/licenses/by/4.0/',
    cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  };
  const imageRights = (src: {
    readonly credit: string | null;
    readonly licence: GalleryLicence | null;
  }): Pick<JsonLd.ImageObjectInput, 'creditText' | 'creator' | 'copyrightNotice' | 'license'> => {
    const credit = src.credit?.trim();
    const hasCredit = credit !== undefined && credit.length > 0;
    const licenceUrl = src.licence !== null ? CC_LICENCE_URL[src.licence] : undefined;
    return {
      ...(hasCredit ? { creditText: credit, creator: credit, copyrightNotice: `© ${credit}` } : {}),
      ...(licenceUrl !== undefined ? { license: licenceUrl } : {}),
    };
  };

  const jsonLdImages: (string | JsonLd.ImageObjectInput)[] = [];
  if (heroPublicId !== null) {
    // Hero caption: prefer the hero gallery row's curated full-sentence
    // caption (LLM-citable), fall back to its alt text, then the hotel name.
    jsonLdImages.push({
      url: buildCloudinarySrc({
        cloudName,
        publicId: heroPublicId,
        transforms: 'f_auto,q_auto,w_1600,h_900,c_fill,g_auto',
      }),
      caption: heroGalleryMatch?.caption ?? heroGalleryMatch?.alt ?? name,
      width: 1600,
      height: 900,
      representativeOfPage: true,
      ...(heroGalleryMatch !== undefined ? imageRights(heroGalleryMatch) : {}),
    });
  }
  // Tiles exclude the hero (already emitted above as `representativeOfPage`)
  // so the 5 ImageObject nodes are hero + 4 distinct mosaic tiles.
  for (const img of galleryTiles.slice(0, 4)) {
    const url = buildCloudinarySrc({
      cloudName,
      publicId: img.publicId,
      transforms: 'f_auto,q_auto,w_1230,h_820,c_fill,g_auto',
    });
    // `caption` is the full sentence the LLMs cite; `alt` is the short
    // keyword string. Either makes the ImageObject rich — prefer caption.
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

  // Award strings for JSON-LD — three independent sources merged here:
  //
  //  1. Editorial `awards` jsonb column (legacy, `readAwards`) — manual
  //     entries from the back-office: "Best Hotel of the Year — Magazine
  //     X, 2023". Self-contained "Name — Issuer, Year" sentence.
  //
  //  2. Structured `affiliations` jsonb (migration 0062 / ADR-0023) —
  //     systematic ingestion of authoritative lists (Forbes 5-Star,
  //     Atout France Palaces, Relais & Châteaux, World's 50 Best, …).
  //     Only `verified: true` non-brand kinds (label / ranking / guide)
  //     are emitted — see Hard Rule 14 in
  //     `.cursor/rules/hotel-detail-page.mdc`.
  //
  //  3. `isPalace: row.is_palace` flag (forwarded to the builder) which
  //     emits the regulated "Distinction Palace — Atout France" string
  //     automatically. We dedupe by dropping any award entry whose
  //     issuer is "Atout France" so the Palace line never appears twice.
  //
  // Final dedup pass is case-insensitive so an editor's manual
  // "Forbes Travel Guide 5 Stars" entry doesn't collide with the
  // ingested "Forbes Travel Guide Five-Star" affiliation string.
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

  // City hub slug + URL — reused by both the Hotel `containedInPlace`
  // (place-hierarchy edge) and the visible/JSON-LD breadcrumb below, so the
  // two never point at different destination URLs for the same city.
  const cityHubSlug = citySlug(row.city);
  const cityHubUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/destination/[citySlug]', params: { citySlug: cityHubSlug } },
  })}`;

  const hotelInput: JsonLd.HotelJsonLdInput = {
    name,
    url: canonicalUrl,
    starRating: row.stars as 1 | 2 | 3 | 4 | 5,
    isPalace: row.is_palace,
    ...(description !== null && description.length > 0
      ? { description: truncate(description, 500) }
      : {}),
    ...(jsonLdImages.length > 0 ? { images: jsonLdImages } : {}),
    ...(amenities.length > 0 ? { amenityFeatures: amenities } : {}),
    ...(jsonLdAwards.length > 0 ? { awards: jsonLdAwards } : {}),
    ...(affiliationBrand !== null ? { brand: affiliationBrand } : {}),
    // Telephone (Phase 10.29 / CDC §2.15). E.164 by default — `readPhoneE164`
    // refuses loose / partial entries so the JSON-LD never carries a half-typed
    // number, and Google Hotels uses it for the SERP card + click-to-call.
    // When the row carries a spaced human-readable `telephone` (e.g.
    // "+33 4 90 72 12 12") we surface it — still valid for schema.org
    // `telephone` — with the E.164 value as fallback. Applies to every fiche.
    ...((): { telephone?: string } => {
      const display = typeof row.telephone === 'string' ? row.telephone.trim() : '';
      const tel = display.length > 0 ? display : phoneE164;
      return tel !== null ? { telephone: tel } : {};
    })(),
    // Inventory counts (Phase 10.8 / CDC §2.15). `numberOfRooms` is
    // omitted when null — Google's rich-result test prefers an absent
    // property to a `null`/0 one.
    ...(inventory.totalRooms !== null ? { numberOfRooms: inventory.totalRooms } : {}),
    // Check-in / check-out (Phase 10.8 / CDC §2.15). Both come from the
    // structured `policies` jsonb already parsed above; we emit only the
    // values that are present so unfinished editorial entries still
    // validate cleanly.
    ...(policies.checkIn !== null ? { checkinTime: policies.checkIn.from } : {}),
    ...(policies.checkOut !== null ? { checkoutTime: policies.checkOut.until } : {}),
    // `petsAllowed` is a boolean: explicit `false` is informative for
    // travellers + Google, so we forward whatever the policy says.
    ...(policies.pets !== null ? { petsAllowed: policies.pets.allowed } : {}),
    // Aggregate `priceRange` derived from the rooms' indicative prices
    // (Phase 10.26 / CDC §2.15). Google Hotels uses this as a coarse
    // pricing anchor in the SERP card; we emit a locale-aware currency
    // range ("€950–€11 000") when at least one priced room is editorial,
    // and skip the field entirely otherwise — silent omission beats an
    // invented "€0" floor.
    // ACTION 2 (SEO) — `priceRange` prefers the editorial DB value
    // (`hotels.price_range`, migration 0066) when set, falling back to the
    // range computed from the rooms' indicative prices. Only fiches with an
    // explicit `price_range` (Airelles → "€€€€") change behaviour.
    ...((): { priceRange?: string } => {
      const dbRange =
        row.price_range !== null && row.price_range.trim() !== '' ? row.price_range.trim() : null;
      const range = dbRange ?? computeHotelPriceRange(rooms, locale);
      return range !== null ? { priceRange: range } : {};
    })(),
    // Featured editorial reviews (Phase 10.14 / CDC §2.10). The builder
    // caps at 5 internally; we forward everything we have and let it
    // decide. Empty array is omitted so the builder doesn't emit
    // `review: []`.
    ...(featuredReviews.length > 0
      ? {
          featuredReviews: featuredReviews.map((r) => ({
            source: r.source,
            quote: r.quote,
            ...(r.sourceUrl !== null ? { sourceUrl: r.sourceUrl } : {}),
            ...(r.author !== null ? { author: r.author } : {}),
            // EEAT / Google review-snippet policy: emit `reviewRating` ONLY
            // when the source genuinely published a score. Editorial press
            // pull-quotes (MICHELIN Guide, Forbes, Condé Nast…) are prose
            // mentions, not star ratings — fabricating a 5/5 here would be a
            // non-transparent, auto-generated rating (forbidden). Such quotes
            // surface as `Review` nodes with author/publisher/reviewBody but
            // no `reviewRating`; the page's only star signal stays the real,
            // attributed `AggregateRating` (Booking, /10 → /5).
            ...(r.rating !== null && r.maxRating !== null
              ? { rating: r.rating, maxRating: r.maxRating }
              : {}),
            ...(r.dateIso !== null ? { date: r.dateIso } : {}),
          })),
        }
      : {}),
    // Freshness signal (Phase 10.16 / CDC §2.15). `row.updated_at` is
    // already an ISO-8601 timestamp from Supabase (`timestamptz`); we
    // forward it as-is so LLM ingestion pipelines and Google can
    // surface "Last updated: …" hints.
    ...(row.updated_at !== null && row.updated_at !== '' ? { dateModified: row.updated_at } : {}),
    // Speakable selectors (fiche-reorganisation plan, F1). The former
    // `#tldr` block is now the consolidated `#en-bref` card, so we
    // override the builder default to keep voice assistants pointing at
    // the dense factual summary first, then the Concierge advice + FAQ.
    speakableSelectors: ['#factual-summary', '#en-bref', '#concierge-advice', '#faq'],
    // Editorial opening year (Phase 11.2 / CDC §2.15). Surfaced as
    // Schema.org `foundingDate` — Google's Hotel rich-result accepts a
    // bare `YYYY` (Organization inheritance) and LLM ingestion pipelines
    // weight this strongly for "How old is X?" / "When was X built?"
    // queries. The reader returns `openedYear` only when the DB value
    // parses cleanly within (1500 .. current_year + 1).
    ...(historyDates.openedYear !== null ? { foundingDate: String(historyDates.openedYear) } : {}),
    // Virtual / 360° tour (Phase 11.4 / CDC §2.15). Surfaced as
    // Schema.org `LodgingBusiness.tourBookingPage` — the canonical
    // property Google's hotel rich-result documentation accepts for
    // "page providing a virtual tour of the place". The reader
    // already restricts the host to the CSP-whitelisted providers,
    // so any value reaching this builder is safe to emit verbatim.
    ...(virtualTour !== null ? { tourBookingPage: virtualTour.url } : {}),
    // Editorial room sub-pages exposed as `Hotel.containsPlace[]`
    // (Phase 10.27 / CDC §2.15). Each entry points at the indexable
    // room sub-page URL so search engines and LLM ingestion pipelines
    // can follow the relationship without re-crawling the parent
    // fiche. The full room JSON-LD (`HotelRoom` + `floorSize` + `bed`
    // + `containedInPlace` back to the hotel) lives at the sub-page
    // itself — see `chambres/[roomSlug]/page.tsx`.
    ...(rooms.length > 0
      ? {
          containedRooms: rooms.map((r) => ({
            name: r.name ?? r.room_code,
            url: `${origin}${getPathname({
              locale,
              href: {
                pathname: '/hotel/[slug]/chambres/[roomSlug]',
                params: { slug: slugForLocale, roomSlug: r.slug },
              },
            })}`,
          })),
        }
      : {}),
    // MICE event spaces exposed as `Hotel.containsPlace[]` with
    // `@type: MeetingRoom` (Phase 11.6 / CDC §2.14). The MICE
    // section on the public page is the human-readable surface for
    // this data; the JSON-LD mirrors it so search engines and LLM
    // ingestion pipelines can answer "largest meeting room at X?"
    // and faceted "Paris hotel with a 300 m² ballroom?" queries.
    //
    // The reader (`readMiceInfo`) Zod-validates positive surface /
    // seat counts upstream, so we forward the localised structure
    // without re-validating. The localised `notes` becomes the
    // `description` on the MeetingRoom node.
    ...(miceInfo !== null && miceInfo.spaces.length > 0
      ? {
          eventSpaces: miceInfo.spaces.map((s) => ({
            name: s.name,
            surfaceSqm: s.surfaceSqm,
            maxSeated: s.maxSeated,
            ...(s.notes !== null ? { description: s.notes } : {}),
          })),
        }
      : {}),
    // Nearby attractions (Phase 10.16 / CDC §2.7+§2.15 / WS5 phase 1
    // enrichment). The builder caps at 24 entries (3 buckets × ~8); we
    // forward the top points of interest as already sorted by
    // `readLocation()` (distance asc). Coordinates, the LLM-generated
    // 1-2 sentence description, the explicit `schema_type` URL and the
    // raw OSM `opening_hours` tag are all forwarded — every optional
    // field tightens the JSON-LD signal Google + LLM pipelines weigh
    // for "things to do near <hotel>" answers. The builder already
    // tolerates missing values, so legacy POIs without enrichment
    // still emit a clean bare `Place` node.
    ...(location.pointsOfInterest.length > 0
      ? {
          nearbyAttractions: location.pointsOfInterest.map((p) => ({
            name: p.name,
            type: p.type,
            ...(p.latitude !== null && p.longitude !== null
              ? { latitude: p.latitude, longitude: p.longitude }
              : {}),
            ...(p.description !== null && p.description.length > 0
              ? { description: p.description }
              : {}),
            ...(p.schemaType !== null && p.schemaType.length > 0
              ? { schemaTypeUrl: p.schemaType }
              : {}),
            ...(p.openingHours !== null && p.openingHours.length > 0
              ? { openingHours: p.openingHours }
              : {}),
          })),
        }
      : {}),
    ...(row.latitude !== null && row.longitude !== null
      ? { geo: { latitude: row.latitude, longitude: row.longitude } }
      : {}),
    // Google Rich Results require a non-empty `postalCode` to validate the
    // PostalAddress block; we therefore only emit the address when both
    // `address` and `postalCode` are present. Editorial entries without a
    // postal code (legacy rows pre-migration 0014) fall back to no address
    // node — better than emitting an invalid one and being silently
    // dropped by the indexer.
    ...(row.address !== null && row.address !== '' && postalCode !== null
      ? {
          address: {
            streetAddress: row.address,
            addressLocality: row.city,
            postalCode,
            addressCountry: row.country_code,
            ...(row.region !== '' ? { addressRegion: row.region } : {}),
          },
        }
      : {}),
    // `containedInPlace` — explicit Hotel → City place-hierarchy edge, linking
    // the fiche to its destination hub. Complements the flat
    // `address.addressLocality` string for "hotels in <city>" entity retrieval.
    ...(row.city !== '' ? { containedInPlace: { name: row.city, url: cityHubUrl } } : {}),
    // Knowledge-graph anchors (Phase 12.1). Pulled from migration 0025
    // columns + the Wikidata enrichment cron. Surfaces as:
    //   - additionalType → unambiguous Wikidata QID disambiguation
    //   - sameAs[]       → 5-25 canonical URLs (Wikipedia, official,
    //                      TripAdvisor, Commons, social, Mérimée…)
    //   - subjectOf[]    → Wikipedia article(s) + Commons gallery
    //                      (Article schema, strong EEAT signal)
    //   - founder[]      → architects (Schema.org Person nodes)
    //   - email          → reservation email (booking_mode=email)
    // Each field is omitted when null so a partially enriched row
    // emits a clean, lint-free payload.
    ...(externalIds.wikidataId !== null ? { wikidataId: externalIds.wikidataId } : {}),
    // ACTION 3 (SEO) — `sameAs[]` is read from the DB knowledge-graph anchors
    // (`external_sameas` socials + `official_url` + Wikidata/Wikipedia/…). When
    // enrichment hasn't run yet we fall back to the row's own `official_url`
    // (generic, no hard-coded per-fiche URL) so the array is never empty.
    ...((): { sameAs?: readonly string[] } => {
      if (externalIds.sameAs.length > 0) return { sameAs: externalIds.sameAs };
      const fallbackOfficial = typeof row.official_url === 'string' ? row.official_url.trim() : '';
      if (fallbackOfficial.startsWith('https://')) {
        return { sameAs: [fallbackOfficial] };
      }
      return {};
    })(),
    ...((): { subjectOf?: { url: string; name?: string; inLanguage?: 'fr' | 'en' }[] } => {
      const list: { url: string; name?: string; inLanguage?: 'fr' | 'en' }[] = [];
      if (externalIds.wikipediaUrlFr !== null) {
        list.push({
          url: externalIds.wikipediaUrlFr,
          name: `${name} — Wikipédia`,
          inLanguage: 'fr',
        });
      }
      if (externalIds.wikipediaUrlEn !== null) {
        list.push({
          url: externalIds.wikipediaUrlEn,
          name: `${name} — Wikipedia`,
          inLanguage: 'en',
        });
      }
      if (externalIds.commonsGalleryUrl !== null) {
        list.push({ url: externalIds.commonsGalleryUrl, name: `${name} — Wikimedia Commons` });
      }
      return list.length > 0 ? { subjectOf: list } : {};
    })(),
    ...(externalIds.emailReservations !== null && row.booking_mode === 'email'
      ? { email: externalIds.emailReservations }
      : {}),
    ...(externalIds.knowledgeGraph.architects.length > 0
      ? { architects: externalIds.knowledgeGraph.architects }
      : {}),
    // Aggregate rating priority — editorial DB value first (migration 0066,
    // ACTION 2), then Amadeus, then the Google Places snapshot. Only fiches
    // with a populated `aggregate_rating_value` use this branch. The Amadeus
    // mapper already returns `null` for hotels with zero reviews (Google
    // rich-results forbid synthesised ratings), so any value we get here is
    // publishable as-is.
    // Hard Rule 11 (AGENTS.md §4) + skill structured-data-schema-org: the
    // `AggregateRating` mirrors the resolved public score (see `resolvedRating`
    // above). It is always emitted on a /5 scale (`bestRating: 5`, `worstRating:
    // 1`) — Google's hotel rich result renders /5 regardless of the source's
    // native scale — and is sourced identically to the visible hero badge so
    // markup and on-page rating can never diverge.
    ...(resolvedRating !== null
      ? {
          aggregateRating: {
            ratingValue: resolvedRating.ratingValue,
            reviewCount: resolvedRating.reviewCount,
            bestRating: resolvedRating.bestRating,
            worstRating: resolvedRating.worstRating,
          },
        }
      : {}),
  };
  const hotelJsonLd = JsonLd.withSchemaOrgContext(JsonLd.hotelJsonLd(hotelInput));

  // Country label for the breadcrumb — same source as the visible `<nav>`
  // below (computed once here to avoid duplication). Falls back to "France"
  // when the row carries no localised country label.
  const countryLabel = pickByLocale(
    locale,
    row.country_label_fr !== null && row.country_label_fr !== '' ? row.country_label_fr : 'France',
    row.country_label_en !== null && row.country_label_en !== '' ? row.country_label_en : 'France',
  );

  // BreadcrumbList JSON-LD — Accueil → Pays (destination index) → Ville (city
  // hub) → fiche. Mirrors the on-page breadcrumb (`<nav>` further down) per
  // Google's guideline that the structured breadcrumb match the visible one,
  // and replaces the former `/recherche` "Hôtels" level that contradicted the
  // visible nav. No "Région" level is emitted: the site exposes no region hub
  // route (only `/destination` + `/destination/[citySlug]`), and a breadcrumb
  // item must point at a real URL — never a 404.
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: countryLabel, url: `${origin}${getPathname({ locale, href: '/destination' })}` },
      { name: row.city, url: cityHubUrl },
      { name, url: canonicalUrl },
    ]),
  );

  const localeFmt = intlLocaleTag(locale);
  const lastUpdated =
    row.updated_at !== null && row.updated_at !== ''
      ? new Intl.DateTimeFormat(localeFmt, { dateStyle: 'long' }).format(new Date(row.updated_at))
      : null;
  const aeoFreshness =
    lastUpdated ??
    new Intl.DateTimeFormat(localeFmt, {
      dateStyle: 'long',
    }).format(new Date());

  // AEO block (skill: geo-llm-optimization). The leading question we
  // surface is editorial — "Pourquoi choisir {name} ?" — and the answer
  // is a 40-80 word verbatim chunk that LLMs can quote without
  // paraphrasing. Booking/stay intent was removed in Phase 1 (editorial
  // site, ADR-0024); the answer no longer references rates or dates. We
  // collapse it into the same FAQPage payload as the editorial FAQ so we
  // ship a single rich-results signal per page.
  const aeoQuestion = t('aeo.question', { name });
  // International hotels (migration 0033) carry an empty `region` —
  // swap to the `NoRegion` template so the AEO answer doesn't render
  // "à {city} ()". Both keys stay in sync via the i18n bundle.
  const hasRegion = row.region.trim().length > 0;
  const aeoAnswerRaw = hasRegion
    ? t('aeo.answer', {
        name,
        city: row.city,
        region: row.region,
        date: aeoFreshness,
      })
    : t('aeo.answerNoRegion', {
        name,
        city: row.city,
        date: aeoFreshness,
      });

  // B4 — validate the answer against the AEO 40-80 word envelope at
  // render time. We never block the page: an out-of-envelope answer
  // surfaces a dev-only console warning + a `data-aeo-warning` flag
  // on the section so QA scripts can pick it up post-deploy. The CI
  // lint suite (Vitest unit `apps/web/src/i18n/messages/*.test.ts`)
  // catches regressions at PR time.
  const aeoBlockResult = buildAeoBlock({
    question: aeoQuestion,
    answer: aeoAnswerRaw,
    updatedAt: aeoFreshness,
  });
  const aeoAnswer = aeoBlockResult.ok ? aeoBlockResult.value.answer : aeoAnswerRaw;
  if (!aeoBlockResult.ok && process.env['NODE_ENV'] !== 'production') {
    console.warn(
      `[aeo] hotel ${row.slug} / ${locale}: AEO answer rejected — ${JSON.stringify(
        aeoBlockResult.error,
      )}`,
    );
  }

  const faqPayload: Array<{ question: string; answer: string }> = [
    { question: aeoQuestion, answer: aeoAnswer },
    ...faqs.map((f) => ({ question: f.question, answer: f.answer })),
  ];
  const faqJsonLd = JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(faqPayload));

  // Event[] JSON-LD — one standalone node per upcoming event (CDC §2 "À
  // proximité"). Google's "Events" rich result requires top-level Event
  // nodes; nesting them in an ItemList drops the eligibility. We cap at
  // 5 per the reader (`readUpcomingEvents`).
  const eventJsonLdList = upcomingEvents.map((e) =>
    JsonLd.withSchemaOrgContext(
      JsonLd.eventJsonLd({
        name: e.name,
        category: e.category,
        startDate: e.startDate,
        ...(e.endDate !== null ? { endDate: e.endDate } : {}),
        venueName: e.venueName,
        venueAddress: e.venueAddress,
        latitude: e.latitude,
        longitude: e.longitude,
        // Strengthen `location.address` (Google-recommended). The commune is
        // the event venue name; the region is the hotel's — events surface
        // only when nearby, so they share the hotel's administrative region.
        ...(e.venueName !== null && e.venueName !== '' ? { addressLocality: e.venueName } : {}),
        ...(row.region !== '' ? { addressRegion: row.region } : {}),
        ...(e.description !== null ? { description: e.description } : {}),
        ...(e.url !== null ? { officialUrl: e.url } : {}),
        // Google-recommended `Event.image` — only when the source carries a
        // genuine event image (never a borrowed/hotel photo). Builder
        // re-validates HTTPS and drops anything malformed.
        ...(e.imageUrl !== null ? { imageUrl: e.imageUrl } : {}),
        ...(e.dtUuid !== null ? { sameAs: `https://data.datatourisme.fr/poi/${e.dtUuid}` } : {}),
        ...(e.pricing !== null
          ? {
              pricing: {
                type: e.pricing.type,
                amountEur: e.pricing.amountEur,
              },
            }
          : {}),
      }),
    ),
  );

  // POI `visit` bucket → ItemList JSON-LD (WS5 phase 1). The `visit`
  // bucket is the most SEO-rentable surface ("Top X things to visit
  // near <hotel>") and the one AI Overviews + Bing copilots tend to
  // cite verbatim. We emit the list **in addition to** the existing
  // `nearbyAttractions` payload on the `Hotel` node — both signals
  // complement each other (rich-result vs LLM ingestion). Capped at 8
  // entries by the builder; emits nothing when the bucket is empty.
  const visitPois = location.pointsOfInterest.filter((p) => p.bucket === 'visit');
  const visitItemListJsonLd =
    visitPois.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.poiItemListJsonLd({
            name: t('location.buckets.visit.title'),
            description: t('location.buckets.visit.lead'),
            items: visitPois.map((p) => ({
              name: p.name,
              schemaType: JsonLd.osmToSchemaClass(p.type),
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
          }),
        )
      : null;

  // Maillage interne + Decision Layer fetches (Phase 12.4 / skill seo-technical
  // §Maillage). Parallel-fetch:
  //   1. related hotels (existing — internal linking)
  //   2. rankings featuring this hotel (existing — "Cet hôtel apparaît dans…")
  //   3. local guide teaser for the city (B2). Returns null when no guide
  //      is published — bloc 12 of CDC §2.
  //
  // No live offer fetch in Phase 1 (editorial site, ADR-0024). The
  // booking funnel — and with it the `Offer` JSON-LD + `priceValidUntil`
  // — returns in Phase 6 when the Amadeus / Little adapters are wired.
  const [relatedHotels, featuredInRankings, guideTeaser] = await Promise.all([
    getRelatedHotels({
      currentSlug: row.slug,
      city: row.city,
      region: row.region,
      name,
    }),
    getRankingsForHotel(row.id, { limit: 6 }),
    getGuideTeaserForCity(cityHubSlug, locale),
  ]);

  // VideoObject JSON-LD (B8 / CDC §2 bloc 2). Emitted only when the
  // editorial team has published a hero video — the builder returns
  // `null` on missing required fields (name/description/upload date/
  // contentUrl|embedUrl) so a half-typed Payload entry never ships a
  // malformed envelope.
  const videoObjectNode = heroVideo !== null ? JsonLd.videoObjectJsonLd(heroVideo) : null;
  const videoObjectJsonLd: Record<string, unknown> | null =
    videoObjectNode !== null
      ? (JsonLd.withSchemaOrgContext(videoObjectNode) as unknown as Record<string, unknown>)
      : null;

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Sticky table of contents (fiche-reorganisation plan, A1). Built
  // server-side so absent clusters (no reviews, no Concierge advice)
  // never produce a dead anchor. Anchors resolve against the lightweight
  // `<span id …>` markers placed before each cluster below.
  const reviewsAnchor =
    featuredReviews.length > 0 || amadeusCategories.length > 0
      ? [{ anchor: 'avis', label: t('toc.avis') }]
      : [];
  const conseilAnchor =
    conciergeAdvice !== null ? [{ anchor: 'conseil', label: t('toc.conseil') }] : [];
  // Golden template (Airelles, local fixture) follows the reordered section
  // chronology (PO request 2026-06-02): En bref → À propos → Services →
  // Chambres → Avis → Emplacement → Conseil → FAQ. Every other fiche keeps
  // the historical order + the Phase-6 booking anchor.
  const tocItems: HotelTocItem[] = goldenTemplate
    ? [
        { anchor: 'recit', label: t('toc.recit') },
        { anchor: 'chambres', label: t('toc.chambres') },
        { anchor: 'services', label: t('toc.services') },
        ...reviewsAnchor,
        { anchor: 'lieu', label: t('toc.lieu') },
        ...conseilAnchor,
        { anchor: 'faq', label: t('toc.faq') },
        { anchor: 'en-bref', label: t('toc.enBref') },
      ]
    : [
        { anchor: 'recit', label: t('toc.recit') },
        { anchor: 'chambres', label: t('toc.chambres') },
        ...reviewsAnchor,
        { anchor: 'services', label: t('toc.services') },
        { anchor: 'lieu', label: t('toc.lieu') },
        ...conseilAnchor,
        { anchor: 'faq', label: t('toc.faq') },
        { anchor: 'en-bref', label: t('toc.enBref') },
        { anchor: 'booking', label: t('toc.booking') },
      ];

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <SeoJsonLd
        nonce={nonce}
        nodes={[
          hotelJsonLd,
          breadcrumbJsonLd,
          faqJsonLd,
          videoObjectJsonLd,
          ...eventJsonLdList,
          visitItemListJsonLd,
        ]}
      />

      {goldenTemplate ? (
        <HotelHeroOverlay
          locale={locale}
          hotelId={row.id}
          name={name}
          city={row.city}
          district={row.district !== '' ? row.district : null}
          region={row.region}
          address={row.address}
          postalCode={postalCode}
          isPalace={row.is_palace}
          stars={row.stars as 1 | 2 | 3 | 4 | 5}
          canonicalUrl={canonicalUrl}
          localePath={localePath}
          description={description}
          cloudName={cloudName}
          heroPublicId={heroPublicId}
          heroAlt={heroDescriptor?.alt ?? name}
          countryLabel={countryLabel}
          cityHubSlug={cityHubSlug}
          photoCount={galleryPhotoCount}
        />
      ) : (
        <>
          <nav aria-label={t('breadcrumb.hotels')} className="mch-kit">
            <div className="breadcrumb">
              <Link href="/destination">{countryLabel}</Link>
              <span aria-hidden className="sep">
                ›
              </span>
              <Link
                href={{
                  pathname: '/destination/[citySlug]',
                  params: { citySlug: cityHubSlug },
                }}
              >
                {row.city}
              </Link>
              <span aria-hidden className="sep">
                ›
              </span>
              <span className="bc-current" aria-current="page">
                {name}
              </span>
            </div>
          </nav>

          <HotelHero
            locale={locale}
            hotelId={row.id}
            name={name}
            city={row.city}
            district={row.district !== '' ? row.district : null}
            region={row.region}
            address={row.address}
            postalCode={postalCode}
            isPalace={row.is_palace}
            stars={row.stars as 1 | 2 | 3 | 4 | 5}
            canonicalUrl={canonicalUrl}
            localePath={localePath}
            description={description}
            aggregateRating={
              resolvedRating !== null
                ? {
                    ratingValue: resolvedRating.ratingValue,
                    reviewCount: resolvedRating.reviewCount,
                    bestRating: resolvedRating.bestRating,
                    source: resolvedRating.source,
                  }
                : null
            }
          />
        </>
      )}

      {/*
        Golden template: sticky rectangular search/booking bar. Lives here (a
        page-level sibling of the hero) so its sticky context is the whole
        `<main>` — it stays pinned below the site header for the full scroll.
      */}
      {goldenTemplate ? (
        <HotelBookingBar locale={locale} name={name} city={row.city} countryLabel={countryLabel} />
      ) : null}

      {goldenTemplate ? (
        <>
          {/*
            Golden template (PO request 2026-06-02): a single Concierge-voice
            selling accroche replaces the visible factual summary. The CDC
            §2.3 factual summary is kept in the DOM as an sr-only `heritage`
            block so the JSON-LD `speakable`, `data-aeo` and `Hotel.description`
            GEO contracts are untouched.
          */}
          <figure className="border-gold-400/80 mb-12 mt-6 border-l-2 pl-5 sm:mb-16 sm:pl-7">
            <blockquote className="text-fg font-serif text-2xl italic leading-snug sm:text-[1.7rem] sm:leading-snug">
              {locale === 'fr' ? '«\u00A0' : '\u201C'}
              {conciergeHook}
              {locale === 'fr' ? '\u00A0»' : '\u201D'}
            </blockquote>
            <figcaption className="text-muted mt-4 text-xs font-semibold uppercase tracking-[0.22em]">
              — {t('hero.conciergeSignature')}
            </figcaption>
          </figure>
          <FactualSummary
            summary={factualSummary}
            fallback={
              description !== null && description.length > 0 ? truncate(description, 280) : null
            }
            variant="heritage"
          />
        </>
      ) : (
        <FactualSummary
          summary={factualSummary}
          fallback={
            description !== null && description.length > 0 ? truncate(description, 280) : null
          }
        />
      )}

      <HotelGallery
        locale={locale}
        cloudName={cloudName}
        hero={galleryHero}
        images={galleryGridTiles}
        hotelName={name}
        hideGrid={goldenTemplate}
      />

      {/*
        GEO/AEO — answer-engine H2 blocks, data-driven from `hotels.geo_qa`
        (migration 0072). Rendered here (common to both layout branches) for any
        fiche carrying Q&A; self-elides when the array is empty. Replaces the
        former Airelles-only hard-coded gate.
      */}
      {geoBlocks.length > 0 ? (
        <HotelGeoSection locale={locale} hotelName={name} blocks={geoBlocks} />
      ) : null}

      {/*
        Two-column shell (fiche-reorganisation plan, PR `layout-shell`).
        Desktop: editorial content left, sticky right rail reserving the
        prime conversion slot for the future booking funnel (Phase 6,
        ADR-0024). Mobile: single column, the rail stacks after the
        content as a passive placeholder.
      */}
      <div
        className={
          goldenTemplate
            ? ''
            : 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10'
        }
      >
        <div className="mch-htl-body min-w-0">
          {goldenTemplate ? (
            <>
              {/*
                Golden template — chronologie des sections (demande PO,
                2026-06-02). Les composants sont ré-invoqués ici dans le nouvel
                ordre ; les fiches prod conservent l'ordre historique intact
                (branche `else` ci-dessous). Ordre : L'essentiel du Concierge →
                À propos → (visite virtuelle) → Services → Chambres → Avis →
                Conditions → Expériences → Restaurants → Spa → Pourquoi choisir →
                Emplacement → Séminaires → Conseil du Concierge (+ guide local,
                événements, AEO, FAQ Concierge) → Questions fréquentes →
                Distinctions → Instagram → maillage interne.
              */}

              {/* 1 — À propos */}
              <span id="recit" aria-hidden className="block scroll-mt-28" />
              <HotelStory
                locale={locale}
                sections={storySections}
                collapsibleSections
                heroParagraphs={
                  description !== null && description.length > 0
                    ? description
                        .split(/\n\n+/u)
                        .map((p) => p.trim())
                        .filter((p) => p.length > 0)
                    : null
                }
              />

              {/* Visite virtuelle (média, conservée) */}
              <HotelVirtualTour locale={locale} hotelName={name} tour={virtualTour} />

              {/* 3 — Chambres & suites */}
              <span id="chambres" aria-hidden className="block scroll-mt-28" />
              <section aria-labelledby="rooms-title-golden" className="mb-12">
                <h2 id="rooms-title-golden" className="text-fg mb-4 font-serif text-2xl">
                  {t('sections.rooms')}
                </h2>
                {orderedRoomCards.length > 0 ? (
                  <HotelRoomsGrid
                    slug={slugFr}
                    rooms={orderedRoomCards}
                    defaultVisible={3}
                    labels={{
                      viewDetail: t('rooms.viewDetail'),
                      signatureBadge: t('rooms.signatureBadge'),
                      signatureAria: t('rooms.signatureAria'),
                      conciergePick: t('rooms.conciergePick'),
                      showAll: t('rooms.showAll', {
                        count: Math.max(0, orderedRoomCards.length - 3),
                      }),
                      showLess: t('rooms.showLess'),
                    }}
                  />
                ) : (
                  <p className="text-muted text-sm">{t('noRooms')}</p>
                )}
              </section>

              {/* 4 — Services & équipements */}
              <span id="services" aria-hidden className="block scroll-mt-28" />
              <HotelAmenities locale={locale} groups={amenityGroups} flat={amenities} />

              {/* 5 — Avis voyageurs (preuve sociale, juste après les chambres) */}
              <span id="avis" aria-hidden className="block scroll-mt-28" />
              <HotelFeaturedReviews locale={locale} reviews={featuredReviews} />
              {amadeusCategories.length > 0 ? (
                <section
                  aria-labelledby="reviews-breakdown-title-golden"
                  className="mb-12"
                  data-testid="hotel-review-breakdown-golden"
                >
                  <h2
                    id="reviews-breakdown-title-golden"
                    className="text-fg mb-3 font-serif text-2xl"
                  >
                    {t('sections.reviewBreakdown')}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {amadeusCategories.map((cat) => (
                      <li key={cat.key} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-fg">{t(`reviewCategories.${cat.key}`)}</span>
                          <span className="text-fg font-medium tabular-nums" aria-hidden>
                            {t('reviewCategories.scoreOf', { score: cat.score })}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={cat.score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('reviewCategories.scoreAria', {
                            category: t(`reviewCategories.${cat.key}`),
                            score: cat.score,
                          })}
                          className="border-border bg-bg h-2 overflow-hidden rounded-full border"
                        >
                          <div className="bg-fg/80 h-full" style={{ width: `${cat.score}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted mt-3 text-xs">{t('reviewCategories.source')}</p>
                </section>
              ) : null}

              {/* 6 — Conditions de séjour */}
              {hasAnyPolicy(policies) ? (
                <HotelPolicies locale={locale} policies={policies} />
              ) : null}

              {/* 7 — Expériences signature */}
              <HotelSignatureExperiences
                locale={locale}
                cloudName={cloudName}
                experiences={signatureExperiences}
              />

              {/* 8 — Restaurants & bars */}
              {restaurants !== null && restaurants.venues.length > 0 ? (
                <HotelRestaurants locale={locale} restaurants={restaurants} />
              ) : null}

              {/* 9 — Spa & bien-être */}
              {spa !== null ? <HotelSpa locale={locale} spa={spa} /> : null}

              {/*
                10 — Pourquoi choisir cet hôtel ? Ce bloc héberge la réponse
                AEO citable (`data-aeo`, indexée par les LLMs) + les points
                forts. Un seul H2 — l'ancien bloc AEO autonome du cluster
                Concierge est retiré pour éviter le doublon de titre.
              */}
              <section
                id="aeo"
                data-aeo
                {...(!aeoBlockResult.ok ? { 'data-aeo-warning': aeoBlockResult.error.kind } : {})}
                data-aeo-word-count={aeoBlockResult.ok ? aeoBlockResult.value.wordCount : undefined}
                aria-labelledby="why-choose-title"
                className="border-border bg-muted/5 mb-16 rounded-lg border p-6"
              >
                <h2 id="why-choose-title" className="text-fg font-serif text-2xl font-semibold">
                  {aeoQuestion}
                </h2>
                <p className="text-muted mt-3 leading-relaxed">{aeoAnswer}</p>
                {highlights.length > 0 ? (
                  <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {highlights.map((h) => (
                      <li
                        key={h}
                        className="border-border bg-bg text-fg rounded-lg border px-4 py-3 text-sm"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {/* 11 — Emplacement & accès (golden : carte + accès seuls — les
                  POIs sont relocalisés sous « Le conseil du Concierge ») */}
              <span id="lieu" aria-hidden className="block scroll-mt-28" />
              <HotelLocation
                locale={locale}
                hotelName={name}
                city={row.city}
                address={row.address}
                postalCode={postalCode}
                latitude={row.latitude}
                longitude={row.longitude}
                location={location}
                omitPois
              />

              {/* 12 — Séminaires & événements pro */}
              <HotelMiceEvents locale={locale} hotelName={name} mice={miceInfo} />

              {/* 13 — Le conseil du Concierge (cluster) :
                  conseil signature → quartier (visite / activités / commerces)
                  → guide local → événements → FAQ Concierge. */}
              <span id="conseil" aria-hidden className="block scroll-mt-28" />
              <ConciergeAdvice locale={locale} advice={conciergeAdvice} />
              <HotelNeighbourhoodBuckets locale={locale} location={location} />
              <LocalGuideTeaser locale={locale} cityLabel={row.city} guide={guideTeaser} />
              <HotelEvents
                locale={locale}
                hotelName={name}
                city={row.city}
                events={upcomingEvents}
              />
              <TopConciergeFaq locale={locale} items={topConciergeFaq} />

              {/* 14 — Questions fréquentes */}
              {faqGroups.length > 0 ? (
                <HotelFaq locale={locale} groups={faqGroups} />
              ) : (
                <section id="faq" aria-labelledby="faq-title-golden" className="mb-12 scroll-mt-24">
                  <h2 id="faq-title-golden" className="text-fg mb-3 font-serif text-2xl">
                    {t('sections.faq')}
                  </h2>
                  <p className="text-muted text-sm">{t('noFaq')}</p>
                </section>
              )}

              {/* 15 — Distinctions, affiliations & sources (autorité / EEAT) */}
              <HotelAwards locale={locale} awards={awards} />
              <HotelTrustSignals
                locale={locale}
                affiliations={affiliations}
                isPalace={row.is_palace}
              />
              <HotelExternalSourcesFooter locale={locale} provenance={externalSourcesProvenance} />

              {/* 16 — Sur Instagram */}
              <HotelInstagram locale={locale} cloudName={cloudName} feed={instagramFeed} />

              {/* 17 — Maillage interne : classements + hôtels similaires */}
              <HotelFeaturedInRankings mentions={featuredInRankings} locale={locale} />
              <RelatedHotels
                locale={locale}
                bundle={relatedHotels}
                currentRegion={row.region}
                currentCity={row.city}
              />

              {/*
                18 — L'essentiel du Concierge (fact-sheet AEO). Déplacé en fin de
                fiche (demande PO 2026-06-02) : il clôt la page avec les faits
                bruts (adresse, catégorie, coordonnées, badge fraîcheur) au lieu
                de concurrencer le récit en tête. Toujours `data-aeo` +
                `data-llm-summary`, toujours `#en-bref` (sélecteur speakable,
                indépendant de la position — GEO/agentique intacts).
              */}
              <HotelEnBref
                locale={locale}
                name={name}
                city={row.city}
                region={row.region}
                isPalace={row.is_palace}
                stars={row.stars as 1 | 2 | 3 | 4 | 5}
                address={row.address}
                postalCode={postalCode}
                district={row.district}
                latitude={row.latitude}
                longitude={row.longitude}
                totalRooms={inventory.totalRooms}
                suites={inventory.suites}
                checkInFrom={policies.checkIn !== null ? policies.checkIn.from : null}
                checkOutUntil={policies.checkOut !== null ? policies.checkOut.until : null}
                petsAllowed={policies.pets !== null ? policies.pets.allowed : null}
                openedYear={historyDates.openedYear}
                lastRenovatedYear={historyDates.lastRenovatedYear}
                architects={externalIds.knowledgeGraph.architects}
                lastUpdatedLabel={lastUpdated}
                lastUpdatedIso={
                  row.updated_at !== null && row.updated_at !== '' ? row.updated_at : null
                }
              />
            </>
          ) : (
            <>
              {/*
            Cluster 1 — Visite virtuelle. The "En bref" fact-sheet recap moved
            to the end of the editorial content (2026-06-02, PO request) so the
            top of the page leads with the narrative rather than a data table.
            SEO/GEO-safe: the early citable answer stays in `#factual-summary`
            under the H1, `#en-bref` is still referenced by `speakableSelectors`
            (selector-based, position-independent), and the facts remain in the
            Hotel JSON-LD.
          */}
              <HotelVirtualTour locale={locale} hotelName={name} tour={virtualTour} />

              <span id="recit" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 2 — Récit : narration, expériences signature, points forts. */}
              <HotelStory
                locale={locale}
                sections={storySections}
                heroParagraphs={
                  description !== null && description.length > 0
                    ? description
                        .split(/\n\n+/u)
                        .map((p) => p.trim())
                        .filter((p) => p.length > 0)
                    : null
                }
              />

              <HotelSignatureExperiences
                locale={locale}
                cloudName={cloudName}
                experiences={signatureExperiences}
              />

              <section aria-labelledby="highlights-title" className="mb-12">
                <h2 id="highlights-title" className="text-fg mb-3 font-serif text-2xl">
                  {t('sections.highlights')}
                </h2>
                {highlights.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {highlights.map((h) => (
                      <li
                        key={h}
                        className="border-border bg-muted/5 text-fg rounded-lg border px-4 py-3 text-sm"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted text-sm">{t('noHighlights')}</p>
                )}
              </section>

              <span id="chambres" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 3 — Chambres (cœur commercial, juste après le récit). */}
              <section aria-labelledby="rooms-title" className="mb-12">
                <h2 id="rooms-title" className="text-fg mb-4 font-serif text-2xl">
                  {t('sections.rooms')}
                </h2>
                {rooms.length > 0 ? (
                  <ul className="flex flex-col gap-5">
                    {rooms.map((room) => {
                      const roomHref = {
                        pathname: '/hotel/[slug]/chambres/[roomSlug]',
                        params: { slug: slugFr, roomSlug: room.slug },
                      } as const;
                      const priceLabel = formatIndicativePrice(room.indicativePrice, locale, t);
                      return (
                        <li key={room.id}>
                          <article className="border-border bg-bg shadow-card overflow-hidden rounded-2xl border sm:flex sm:items-stretch">
                            {room.cardImagePublicId !== null ? (
                              <Link
                                href={roomHref}
                                className="focus-visible:outline-ring relative block aspect-[16/10] shrink-0 overflow-hidden sm:aspect-auto sm:w-64 lg:w-72"
                                aria-label={room.name ?? room.room_code}
                              >
                                <HotelImage
                                  cloudName={cloudName}
                                  publicId={room.cardImagePublicId}
                                  alt={room.cardImageAlt ?? room.name ?? room.room_code}
                                  variant="card"
                                  width={576}
                                  height={384}
                                  sizes="(max-width: 640px) 100vw, 18rem"
                                  className="h-full w-full transition-transform duration-500 hover:scale-[1.03]"
                                />
                              </Link>
                            ) : null}
                            <div className="flex min-w-0 flex-1 flex-col p-5">
                              <header className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="text-fg flex items-center gap-2 font-serif text-lg">
                                  <Link href={roomHref} className="hover:underline">
                                    {room.name ?? room.room_code}
                                  </Link>
                                  {room.isSignature ? (
                                    <span
                                      className="border-gold-200 bg-gold-50 text-gold-900 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.12em]"
                                      aria-label={t('rooms.signatureAria')}
                                    >
                                      {t('rooms.signatureBadge')}
                                    </span>
                                  ) : null}
                                </h3>
                                <p className="text-muted text-xs">
                                  {room.max_occupancy !== null
                                    ? t('rooms.occupancy', { count: room.max_occupancy })
                                    : null}
                                  {room.size_sqm !== null
                                    ? ` · ${t('rooms.size', { count: room.size_sqm })}`
                                    : ''}
                                  {room.bed_type !== null && room.bed_type !== ''
                                    ? ` · ${room.bed_type}`
                                    : ''}
                                </p>
                              </header>
                              {room.description !== null && room.description !== '' ? (
                                <p className="text-muted mt-2 text-sm leading-relaxed">
                                  {room.description}
                                </p>
                              ) : null}
                              {room.amenities.length > 0 ? (
                                <ul className="mt-3 flex flex-wrap gap-1.5">
                                  {room.amenities.map((amenity) => (
                                    <li
                                      key={amenity}
                                      className="border-border text-muted rounded-md border px-2 py-0.5 text-xs"
                                    >
                                      {amenity}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <div className="border-border mt-auto flex flex-wrap items-end justify-between gap-2 border-t pt-3 sm:pt-4">
                                <p className="text-sm">
                                  <Link
                                    href={roomHref}
                                    className="text-gold-700 hover:text-gold-800 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                                  >
                                    {t('rooms.viewDetail')}
                                    <span aria-hidden>→</span>
                                  </Link>
                                </p>
                                {(() => {
                                  const liveFromMinor =
                                    aggregatedRoomPrices?.fromByRoomId.get(room.id) ??
                                    travelportLiveRooms?.fromByRoomId.get(room.id);
                                  if (liveFromMinor !== undefined && tCard !== null) {
                                    const priceText = fmtLiveEur(liveFromMinor);
                                    return (
                                      <span className="flex items-baseline gap-2 text-xs">
                                        <span className="text-muted" data-room-price-live>
                                          {tCard('from', { price: priceText })}
                                        </span>
                                        <Link
                                          href={travelportRoomsHref}
                                          aria-label={tCard('bookAria', {
                                            room: room.name ?? room.room_code,
                                            price: priceText,
                                          })}
                                          className="bg-gold text-charcoal hover:bg-gold-600 rounded-md px-3 py-1.5 font-semibold transition-colors"
                                        >
                                          {tCard('book')}
                                        </Link>
                                      </span>
                                    );
                                  }
                                  return priceLabel !== null ? (
                                    <p className="text-fg text-sm font-medium" data-room-price>
                                      {priceLabel}
                                    </p>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                ) : (locale === 'fr' || locale === 'en') && row.booking_mode === 'travelport' ? (
                  // Fiche sans chambres éditoriales (cas pilote) : la liste live
                  // Travelport est récupérée dans une frontière Suspense pour ne
                  // pas bloquer le rendu de la fiche sur l'appel amont.
                  <Suspense
                    fallback={
                      <ul className="flex flex-col gap-4" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <li
                            key={i}
                            className="border-border bg-bg h-28 animate-pulse rounded-lg border"
                          />
                        ))}
                      </ul>
                    }
                  >
                    <TravelportLiveRooms slug={row.slug} locale={locale} />
                  </Suspense>
                ) : (
                  <p className="text-muted text-sm">{t('noRooms')}</p>
                )}
              </section>

              <span id="avis" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 4 — Avis & sous-notes (preuve sociale, juste après les chambres). */}
              <HotelFeaturedReviews locale={locale} reviews={featuredReviews} />

              {amadeusCategories.length > 0 ? (
                <section
                  aria-labelledby="reviews-breakdown-title"
                  className="mb-12"
                  data-testid="hotel-review-breakdown"
                >
                  <h2 id="reviews-breakdown-title" className="text-fg mb-3 font-serif text-2xl">
                    {t('sections.reviewBreakdown')}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {amadeusCategories.map((cat) => (
                      <li key={cat.key} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-fg">{t(`reviewCategories.${cat.key}`)}</span>
                          <span className="text-fg font-medium tabular-nums" aria-hidden>
                            {t('reviewCategories.scoreOf', { score: cat.score })}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={cat.score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('reviewCategories.scoreAria', {
                            category: t(`reviewCategories.${cat.key}`),
                            score: cat.score,
                          })}
                          className="border-border bg-bg h-2 overflow-hidden rounded-full border"
                        >
                          <div className="bg-fg/80 h-full" style={{ width: `${cat.score}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted mt-3 text-xs">{t('reviewCategories.source')}</p>
                </section>
              ) : null}

              <span id="services" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 5 — Services : équipements, restauration, spa. */}
              <HotelAmenities locale={locale} groups={amenityGroups} flat={amenities} />

              {restaurants !== null && restaurants.venues.length > 0 ? (
                <HotelRestaurants locale={locale} restaurants={restaurants} />
              ) : null}

              {spa !== null ? <HotelSpa locale={locale} spa={spa} /> : null}

              <span id="lieu" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 6 — Lieu : localisation, politiques, guide local, événements, MICE. */}
              <HotelLocation
                locale={locale}
                hotelName={name}
                city={row.city}
                address={row.address}
                postalCode={postalCode}
                latitude={row.latitude}
                longitude={row.longitude}
                location={location}
              />

              {hasAnyPolicy(policies) ? (
                <HotelPolicies locale={locale} policies={policies} />
              ) : null}

              <LocalGuideTeaser locale={locale} cityLabel={row.city} guide={guideTeaser} />

              <HotelEvents
                locale={locale}
                hotelName={name}
                city={row.city}
                events={upcomingEvents}
              />

              <HotelMiceEvents locale={locale} hotelName={name} mice={miceInfo} />

              <HotelAwards locale={locale} awards={awards} />

              {/*
          CDC §2 bloc 13 — Trust signals (structured affiliations).
          Mirrors the JSON-LD `Hotel.brand` + `Hotel.award[]` already
          emitted above by `mapAffiliationsToBrand` /
          `mapAffiliationsToAwardStrings`. Self-elides when there is
          no verified affiliation AND `isPalace === false`. See
          `apps/web/src/components/hotel/hotel-trust-signals.tsx`.
        */}
              <HotelTrustSignals
                locale={locale}
                affiliations={affiliations}
                isPalace={row.is_palace}
              />

              {/*
          CDC §2 bloc 13bis — EEAT external sources provenance.
          Renders the structured `external_sources` JSONB column hydrated by
          the Phase 1.5 backfill. Self-elides when the column carries no
          publicly useful entries (~38 % of catalogue at Phase 1.5 close).
          See `apps/web/src/components/hotel/hotel-external-sources-footer.tsx`.
        */}
              <HotelExternalSourcesFooter locale={locale} provenance={externalSourcesProvenance} />

              <span id="conseil" aria-hidden className="block scroll-mt-28" />
              {/* Cluster 7 — Le Conseil du Concierge + réponse AEO en tête de la FAQ unifiée. */}
              <ConciergeAdvice locale={locale} advice={conciergeAdvice} />

              <section
                id="aeo"
                data-aeo
                {...(!aeoBlockResult.ok ? { 'data-aeo-warning': aeoBlockResult.error.kind } : {})}
                data-aeo-word-count={aeoBlockResult.ok ? aeoBlockResult.value.wordCount : undefined}
                aria-labelledby="hotel-aeo-title"
                className="border-border bg-muted/5 mb-16 rounded-lg border p-6"
              >
                <h2 id="hotel-aeo-title" className="text-fg font-serif text-2xl font-semibold">
                  {aeoQuestion}
                </h2>
                <p className="text-muted mt-3 leading-relaxed">{aeoAnswer}</p>
              </section>

              <TopConciergeFaq locale={locale} items={topConciergeFaq} />

              {faqGroups.length > 0 ? (
                <HotelFaq locale={locale} groups={faqGroups} />
              ) : (
                <section id="faq" aria-labelledby="faq-title" className="mb-12 scroll-mt-24">
                  <h2 id="faq-title" className="text-fg mb-3 font-serif text-2xl">
                    {t('sections.faq')}
                  </h2>
                  <p className="text-muted text-sm">{t('noFaq')}</p>
                </section>
              )}

              {/* Social proof — latest Instagram posts + follow CTA. */}
              <HotelInstagram locale={locale} cloudName={cloudName} feed={instagramFeed} />

              {/* Cluster 9 — Maillage interne : classements, hôtels similaires. */}
              <HotelFeaturedInRankings mentions={featuredInRankings} locale={locale} />

              <RelatedHotels
                locale={locale}
                bundle={relatedHotels}
                currentRegion={row.region}
                currentCity={row.city}
              />

              {/*
            "En bref" fact-sheet recap — moved here (end of editorial content)
            on 2026-06-02. It closes the fiche with the ground-truth essentials
            (address, category, coordinates, freshness badge) rather than
            competing with the narrative at the top. Still `data-aeo` +
            `data-llm-summary`, still `#en-bref` (speakable selector).
          */}
              <HotelEnBref
                locale={locale}
                name={name}
                city={row.city}
                region={row.region}
                isPalace={row.is_palace}
                stars={row.stars as 1 | 2 | 3 | 4 | 5}
                address={row.address}
                postalCode={postalCode}
                district={row.district}
                latitude={row.latitude}
                longitude={row.longitude}
                totalRooms={inventory.totalRooms}
                suites={inventory.suites}
                checkInFrom={policies.checkIn !== null ? policies.checkIn.from : null}
                checkOutUntil={policies.checkOut !== null ? policies.checkOut.until : null}
                petsAllowed={policies.pets !== null ? policies.pets.allowed : null}
                openedYear={historyDates.openedYear}
                lastRenovatedYear={historyDates.lastRenovatedYear}
                architects={externalIds.knowledgeGraph.architects}
                lastUpdatedLabel={lastUpdated}
                lastUpdatedIso={
                  row.updated_at !== null && row.updated_at !== '' ? row.updated_at : null
                }
              />
            </>
          )}
        </div>

        {/*
          Golden template (Airelles, local fixture): no right column. The
          fiche runs a single full-width column and the table of contents
          becomes a collapsible floating widget (rendered below). Every other
          fiche keeps the two-column rail with the sticky TOC and the Phase-6
          booking seam (ADR-0024/0025).
        */}
        {goldenTemplate ? null : (
          <aside aria-label={t('sections.booking')} className="mt-12 lg:mt-0">
            <div className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
              <HotelToc heading={t('toc.heading')} items={tocItems} />
              <BookingSlot
                locale={locale}
                hotelName={name}
                surface="rail"
                slug={row.slug}
                bookingMode={row.booking_mode}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Golden template: floating, collapsible "Sur cette page" widget. */}
      {goldenTemplate ? (
        <HotelToc
          heading={t('toc.heading')}
          items={tocItems}
          variant="floating"
          expandLabel={t('toc.expand')}
          collapseLabel={t('toc.collapse')}
        />
      ) : null}

      {/* Reserved for the Phase 6 fixed mobile booking bar — inert today. */}
      {goldenTemplate ? null : <BookingSlot locale={locale} hotelName={name} surface="mobilebar" />}

      <TrackPageView
        event={{
          name: 'view_hotel',
          hotelId: row.id,
          slug: row.slug,
          locale: locale === 'fr' || locale === 'en' ? locale : 'fr',
          bookingMode: row.booking_mode,
          isPalace: row.is_palace,
          stars: row.stars as 1 | 2 | 3 | 4 | 5,
          hasPriceFrom: false,
        }}
      />

      {/*
        Freshness signal is rendered once, in the `<HotelEnBref>` badge
        (fiche-reorganisation plan — dedup. The former footer duplicate
        was removed; the JSON-LD `Hotel.dateModified` still mirrors it).
      */}
    </main>
  );
}
