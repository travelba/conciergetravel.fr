import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd, buildAeoBlock } from '@mch/seo';

import { buildCloudinarySrc } from '@mch/ui';

import { BookingWidget } from '@/components/hotel/booking-widget';
import { BookingWidgetMobileBar } from '@/components/hotel/booking-widget-mobile-bar';
import { BookingWidgetUrlHydrator } from '@/components/hotel/booking-widget-url-hydrator';
import { ConciergeAdvice } from '@/components/hotel/concierge-advice';
import { HotelHero } from '@/components/hotel/hotel-hero';
import { HotelAmenities } from '@/components/hotel/hotel-amenities';
import { LocalGuideTeaser } from '@/components/hotel/local-guide-teaser';
import { TrackPageView } from '@/lib/analytics/hooks';
import { HotelAwards } from '@/components/hotel/hotel-awards';
import { HotelFactSheet } from '@/components/hotel/hotel-fact-sheet';
import { HotelFaq } from '@/components/hotel/hotel-faq';
import { TopConciergeFaq } from '@/components/hotel/top-concierge-faq';
import { HotelFeaturedInRankings } from '@/components/hotel/hotel-featured-in-rankings';
import { HotelFeaturedReviews } from '@/components/hotel/hotel-featured-reviews';
import { HotelGallery } from '@/components/hotel/hotel-gallery';
import HotelEvents from '@/components/hotel/hotel-events';
import { HotelLocation } from '@/components/hotel/hotel-location';
import { HotelMiceEvents } from '@/components/hotel/hotel-mice-events';
import { HotelPolicies } from '@/components/hotel/hotel-policies';
import { HotelReassurance } from '@/components/hotel/hotel-reassurance';
import { HotelRestaurants } from '@/components/hotel/hotel-restaurants';
import { HotelSignatureExperiences } from '@/components/hotel/hotel-signature-experiences';
import { HotelSpa } from '@/components/hotel/hotel-spa';
import { HotelStory } from '@/components/hotel/hotel-story';
import { HotelTldr } from '@/components/hotel/hotel-tldr';
import { HotelVirtualTour } from '@/components/hotel/hotel-virtual-tour';
import { RelatedHotels } from '@/components/hotel/related-hotels';
import { PriceComparator } from '@/components/price-comparator';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname, Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { computeHotelPriceRange, formatIndicativePriceParts } from '@/lib/format-indicative-price';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';
import { citySlug } from '@/server/destinations/cities';
import { getGuideTeaserForCity } from '@/server/guides/get-guide-teaser';
import {
  getAmadeusHotelSentiment,
  type AmadeusHotelSentiment,
} from '@/server/hotels/get-amadeus-sentiment';
import { getBestOfferForHotel } from '@/server/hotels/get-best-offer';
import {
  getHotelBySlug,
  listPublishedHotelSlugs,
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
  readFactualSummary,
  readRestaurants,
  readSignatureExperiences,
  readSpa,
  readVirtualTour,
  type HotelDetail,
  type HotelDetailRow,
  type SupportedLocale,
} from '@/server/hotels/get-hotel-by-slug';
import { getRelatedHotels } from '@/server/hotels/get-related-hotels';
import { getRankingsForHotel } from '@/server/rankings/get-rankings-for-hotel';

/**
 * Rendering mode (Sprint 4.1 refactor + Phase 11.8 follow-up):
 *
 *  - The shared layout no longer reads `cookies()` — the auth area
 *    became a client island (`<AuthArea />`), so the layout tree is
 *    static again.
 *  - The page still accepts stay-window `searchParams` (`checkIn`,
 *    `checkOut`, `adults`, `children`) that legitimately change the
 *    booking form + price comparator output for every request.
 *  - It also emits multiple `<JsonLdScript>` blocks that need the
 *    per-request CSP nonce; the page reads it once via
 *    `next/headers#headers()` and forwards it as a prop (see
 *    `components/seo/json-ld.tsx` for the design). The combination of
 *    `searchParams` + `headers()` + a declared `revalidate` value
 *    caused the production build to throw `DYNAMIC_SERVER_USAGE` on
 *    the first cold render, because Next.js cannot pre-cache a route
 *    that touches request-bound data on every render.
 *  - We therefore opt the route into **full dynamic rendering**
 *    (`force-dynamic`). The HTML is still served fast: the page is
 *    a pure Server Component, every upstream call is either cached
 *    in Redis (Amadeus sentiment) or feeds from a `pgrest` row
 *    Supabase already keeps hot. Re-introducing ISR would require a
 *    different CSP strategy (hashes computed at build time instead
 *    of per-request nonces) — out of scope for now.
 *
 * See ADR-0007 (Sprint 4.1) + commit message in this PR for the
 * production reproduction (a11y test build, fake-hotel SSR).
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function defaultStay(): { checkIn: string; checkOut: string } {
  const now = new Date();
  const ci = new Date(now.getTime() + 30 * 86_400_000);
  const co = new Date(now.getTime() + 33 * 86_400_000);
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { checkIn: fmt(ci), checkOut: fmt(co) };
}

function pickIsoDate(value: string | undefined, fallback: string): string {
  return value !== undefined && ISO_DATE_RE.test(value) ? value : fallback;
}

function pickPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
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

/**
 * Build the lock-route URL for the chosen offer. When `offerId` is
 * null (no live Amadeus offer available, hotel not bookable, etc.)
 * we fall back to the `TEST-OFFER-<hotelId>` synthetic id — the lock
 * route only honours it when `isFakeOffersEnabled()` returns true,
 * so in production this fallback simply yields a 400 on submit
 * (form should not be rendered in that case anyway).
 */
function lockActionFor(locale: Locale, hotelId: string, offerId: string | null): string {
  const id = offerId ?? `TEST-OFFER-${hotelId}`;
  return getPathname({
    locale,
    href: { pathname: '/reservation/offer/[offerId]/lock', params: { offerId: id } },
  });
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

  // EEAT guard (Phase photo-ingest, May 2026): a "stub" sheet — i.e.
  // one that does NOT meet the minimum indexability bar — renders
  // server-side so deep links from rankings still work, but emits
  // `noindex, follow` so Google doesn't index thin pages and downgrade
  // the site's overall quality signal.
  //
  // A sheet is indexable when it has **a hero image** AND
  // (**≥ 5 gallery photos** OR **≥ 1 long-form editorial section**).
  //
  // Rationale:
  //   - Hero alone is necessary (no visual = nothing to crawl/share).
  //   - Hero + 5 gallery shots = a credible mini-fiche, sufficient
  //     EEAT for Google Hotels even without a long editorial body.
  //   - Hero + 1 long section = a credible editorial fiche even if
  //     the orchestrator only managed to pull a few photos (rare —
  //     editor manually wrote sections without uploading more shots).
  //
  // As soon as the photo orchestrator hydrates the fiche
  // (`scripts/photos/sync-hotel-photos.ts`), the page becomes
  // indexable on the next request — `dynamic = 'force-dynamic'` so
  // there is no cache to invalidate.
  //
  // `long_description_sections` and `gallery_images` are typed as
  // `unknown` in the row schema (jsonb blobs with their own runtime
  // parsers further down). Narrow them locally so TS strict is
  // satisfied without an `as` cast. Keep this predicate in lockstep
  // with `listIndexableHotelSlugs()` in
  // `apps/web/src/server/hotels/get-hotel-by-slug.ts` — they MUST
  // agree, otherwise the sitemap would list a noindex'd URL.
  const sectionsRaw = row.long_description_sections;
  const hasSections = Array.isArray(sectionsRaw) && sectionsRaw.length > 0;
  const galleryRaw = row.gallery_images;
  const galleryCount = Array.isArray(galleryRaw) ? galleryRaw.length : 0;
  const isIndexable = heroPublicId !== null && (galleryCount >= 5 || hasSections);
  const isStub = !isIndexable;

  return {
    title,
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

interface HotelPageSearchParams {
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adults?: string;
  readonly children?: string;
}

export default async function HotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<HotelPageSearchParams>;
}) {
  const [{ locale: raw, slug }, sp] = await Promise.all([params, searchParams]);
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
  return renderHotelPage(locale, detail, sp, t, amadeusSentiment);
}

async function renderHotelPage(
  locale: Locale,
  detail: HotelDetail,
  sp: HotelPageSearchParams,
  t: Awaited<ReturnType<typeof getTranslations<'hotelPage'>>>,
  amadeusSentiment: AmadeusHotelSentiment,
) {
  const amadeusRating = amadeusSentiment.aggregate;
  const amadeusCategories = amadeusSentiment.categories;
  const { row, rooms } = detail;
  const name = pickName(row, locale);
  const description = pickDescription(row, locale);
  const highlights = readHighlights(row, locale);
  const amenities = readAmenities(row, locale);
  const amenityGroups = readAmenitiesByCategory(row, locale);
  const restaurants = readRestaurants(row, locale);
  const spa = readSpa(row, locale);
  const location = readLocation(row, locale);
  const policies = readPolicies(row, locale);
  const awards = readAwards(row, locale);
  const postalCode = readPostalCode(row);
  const phoneE164 = readPhoneE164(row);
  const inventory = readInventoryCounts(row);
  const historyDates = readHotelHistoryDates(row);
  const storySections = readHotelStory(row, locale);
  const signatureExperiences = readSignatureExperiences(row, locale);
  const conciergeAdvice = readConciergeAdvice(row, locale);
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
  const heroDescriptor =
    heroPublicId !== null ? { publicId: heroPublicId, alt: galleryImages[0]?.alt ?? name } : null;

  const defaults = defaultStay();
  const checkIn = pickIsoDate(sp.checkIn, defaults.checkIn);
  const checkOut = pickIsoDate(sp.checkOut, defaults.checkOut);
  const adults = Math.max(1, pickPositiveInt(sp.adults, 2));
  const children = pickPositiveInt(sp.children, 0);

  const bookable = row.booking_mode === 'amadeus' || row.booking_mode === 'little';
  const fakeEnabled = isFakeOffersEnabled();

  const slugFr = row.slug;
  const slugEn = row.slug_en !== null && row.slug_en !== '' ? row.slug_en : row.slug;
  const origin = siteOrigin();
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
  const jsonLdImages: (string | JsonLd.ImageObjectInput)[] = [];
  if (heroPublicId !== null) {
    jsonLdImages.push({
      url: buildCloudinarySrc({
        cloudName,
        publicId: heroPublicId,
        transforms: 'f_auto,q_auto,w_1600,h_900,c_fill,g_auto',
      }),
      caption: galleryImages[0]?.alt ?? name,
      width: 1600,
      height: 900,
      representativeOfPage: true,
    });
  }
  for (const img of galleryImages.slice(0, 5)) {
    const url = buildCloudinarySrc({
      cloudName,
      publicId: img.publicId,
      transforms: 'f_auto,q_auto,w_1230,h_820,c_fill,g_auto',
    });
    if (img.alt !== undefined && img.alt.length > 0) {
      jsonLdImages.push({ url, caption: img.alt, width: 1230, height: 820 });
    } else {
      jsonLdImages.push(url);
    }
  }

  // Award strings for JSON-LD: prefer "Name — Issuer, Year" to give Google /
  // LLMs a self-contained sentence. The regulated *Palace* distinction is
  // already emitted by `hotelJsonLd` when `isPalace === true`, so we only
  // forward the editorial entries here. We also drop the duplicate Palace
  // entry from the seed array (matched on issuer "Atout France") to avoid
  // emitting it twice.
  const jsonLdAwards: string[] = awards
    .filter((a) => a.issuer.toLowerCase() !== 'atout france')
    .map((a) =>
      a.year !== null ? `${a.name} — ${a.issuer}, ${a.year}` : `${a.name} — ${a.issuer}`,
    );

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
    // Telephone (Phase 10.29 / CDC §2.15). E.164 format only — `readPhoneE164`
    // refuses loose / partial entries so the JSON-LD never carries a half-typed
    // number. Google Hotels uses this for both the SERP card and click-to-call.
    ...(phoneE164 !== null ? { telephone: phoneE164 } : {}),
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
    ...((): { priceRange?: string } => {
      const range = computeHotelPriceRange(rooms, locale);
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
    ...(externalIds.sameAs.length > 0 ? { sameAs: externalIds.sameAs } : {}),
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
    // Aggregate rating priority — Amadeus first, Google second. The
    // Amadeus mapper already returns `null` for hotels with zero reviews
    // (Google rich-results forbid synthesised ratings), so any value we
    // get here is publishable as-is. We fall back to the Google Places
    // snapshot stored on the row when Amadeus has nothing.
    ...(amadeusRating !== null
      ? {
          aggregateRating: {
            ratingValue: amadeusRating.ratingValue,
            reviewCount: amadeusRating.reviewCount,
            bestRating: amadeusRating.bestRating,
            worstRating: amadeusRating.worstRating,
          },
        }
      : row.google_rating !== null &&
          row.google_reviews_count !== null &&
          row.google_reviews_count > 0
        ? {
            aggregateRating: {
              ratingValue: row.google_rating,
              reviewCount: row.google_reviews_count,
              bestRating: 5,
            },
          }
        : {}),
  };
  const hotelJsonLd = JsonLd.withSchemaOrgContext(JsonLd.hotelJsonLd(hotelInput));

  const cityHubSlug = citySlug(row.city);
  const cityHubUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/destination/[citySlug]', params: { citySlug: cityHubSlug } },
  })}`;

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      {
        name: t('breadcrumb.hotels'),
        url: `${origin}${getPathname({ locale, href: '/recherche' })}`,
      },
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
  // surface is "How do I book {name}?" — the answer is a 40-80 word
  // verbatim chunk that LLMs can quote without paraphrasing. We collapse
  // it into the same FAQPage payload as the editorial FAQ so we ship a
  // single rich-results signal per page.
  const aeoQuestion = t('aeo.question', { name });
  // International hotels (migration 0033) carry an empty `region` —
  // swap to a `*NoRegion` template so the AEO answer doesn't render
  // "in {city} ()". The four keys (answer / answerNoStay × region /
  // no-region) stay in sync via the i18n bundle.
  const hasStay = sp.checkIn !== undefined && sp.checkOut !== undefined;
  const hasRegion = row.region.trim().length > 0;
  const aeoAnswerKey = hasStay
    ? hasRegion
      ? 'aeo.answer'
      : 'aeo.answerNoRegion'
    : hasRegion
      ? 'aeo.answerNoStay'
      : 'aeo.answerNoStayNoRegion';
  const aeoAnswerRaw = hasRegion
    ? t(aeoAnswerKey, {
        city: row.city,
        region: row.region,
        date: aeoFreshness,
      })
    : t(aeoAnswerKey, {
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

  // HowTo JSON-LD (skill: structured-data-schema-org §HowTo).
  // Two recipes: "How to book at X" + "How to cancel at X". Strong
  // signal for AI voice assistants (Google Assistant, Siri, Alexa)
  // answering procedural booking queries.
  const hotelCanonicalUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/hotel/[slug]', params: { slug: row.slug } },
  })}`;
  const bookingHowToJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.bookingHowToJsonLd({
      hotelName: name,
      hotelUrl: hotelCanonicalUrl,
      locale,
    }),
  );
  const cancellationHowToJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.cancellationHowToJsonLd({
      hotelName: name,
      hotelUrl: hotelCanonicalUrl,
      locale,
    }),
  );

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
        ...(e.description !== null ? { description: e.description } : {}),
        ...(e.url !== null ? { officialUrl: e.url } : {}),
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
  //   3. best Amadeus offer for the current stay window (A3/A4 — used by
  //      BookingWidget for `from` price + real offerId in the lock URL).
  //      Returns EMPTY when the hotel isn't bookable / no offer / Amadeus
  //      unreachable — never throws.
  //   4. local guide teaser for the city (B2). Returns null when no guide
  //      is published — bloc 12 of CDC §2.
  const [relatedHotels, featuredInRankings, bestOffer, guideTeaser] = await Promise.all([
    getRelatedHotels({
      currentSlug: row.slug,
      city: row.city,
      region: row.region,
      name,
    }),
    getRankingsForHotel(row.id, { limit: 6 }),
    bookable
      ? getBestOfferForHotel({
          hotelId: row.id,
          amadeusHotelId: row.amadeus_hotel_id !== '' ? row.amadeus_hotel_id : null,
          checkIn,
          checkOut,
          adults,
          childAges: [],
        })
      : Promise.resolve({
          offerId: null,
          priceFrom: null,
          limitedAvailability: null,
          availabilityState: 'unknown' as const,
        }),
    getGuideTeaserForCity(cityHubSlug, locale),
  ]);

  // Offer JSON-LD (B3 / CDC §2.8). Emitted only when we have a live
  // Amadeus rate — never fabricated. `priceValidUntil` is required by
  // Google Hotels rich-results and DSA art. 25 (no stale offers).
  // Default cap = today + 7 days (cache lives 5 minutes, so the offer
  // will revalidate well before the date Google sees as the expiry).
  const offerJsonLd: Record<string, unknown> | null =
    bestOffer.priceFrom !== null && bestOffer.offerId !== null
      ? (JsonLd.withSchemaOrgContext(
          JsonLd.offerJsonLd({
            priceFromEUR: bestOffer.priceFrom.amount.fromMinor / 100,
            url: canonicalUrl,
            priceValidUntil: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
            availability:
              bestOffer.limitedAvailability !== null ? 'LimitedAvailability' : 'InStock',
          }),
        ) as unknown as Record<string, unknown>)
      : null;

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

  // Mobile bar labels (A1 / mobile bottom bar). We pre-compute the
  // strings on the server so the client island stays serialisable.
  const mobileBarT = await getTranslations({
    locale,
    namespace: 'hotelPage.widget.mobileBar',
  });
  const mobileBarCta = bookable ? mobileBarT('ctaSeePrices') : mobileBarT('ctaBook');
  const mobileBarAria = bookable
    ? mobileBarT('ctaAriaSeePrices', { name })
    : mobileBarT('ctaAriaBook', { name });
  const mobileBarTrust = mobileBarT('trustChip');
  const mobileBarPriceLabel =
    bestOffer.priceFrom !== null
      ? `${(bestOffer.priceFrom.amount.fromMinor / 100).toLocaleString(localeFmt, {
          style: 'currency',
          currency: bestOffer.priceFrom.amount.currency,
          maximumFractionDigits: 0,
        })}`
      : '';

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={hotelJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={faqJsonLd} nonce={nonce} />
      <JsonLdScript data={bookingHowToJsonLd} nonce={nonce} />
      <JsonLdScript data={cancellationHowToJsonLd} nonce={nonce} />
      {offerJsonLd !== null ? <JsonLdScript data={offerJsonLd} nonce={nonce} /> : null}
      {videoObjectJsonLd !== null ? <JsonLdScript data={videoObjectJsonLd} nonce={nonce} /> : null}
      {eventJsonLdList.map((data, i) => (
        <JsonLdScript
          key={`event-${i}`}
          data={data as unknown as Record<string, unknown>}
          nonce={nonce}
        />
      ))}
      {visitItemListJsonLd !== null ? (
        <JsonLdScript
          data={visitItemListJsonLd as unknown as Record<string, unknown>}
          nonce={nonce}
        />
      ) : null}

      <nav aria-label={t('breadcrumb.hotels')} className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/recherche" className="hover:underline">
              {t('breadcrumb.hotels')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link
              href={{
                pathname: '/destination/[citySlug]',
                params: { citySlug: cityHubSlug },
              }}
              className="hover:underline"
            >
              {row.city}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <HotelHero
        locale={locale}
        hotelId={row.id}
        name={name}
        city={row.city}
        district={row.district !== '' ? row.district : null}
        region={row.region}
        isPalace={row.is_palace}
        stars={row.stars as 1 | 2 | 3 | 4 | 5}
        canonicalUrl={canonicalUrl}
        localePath={localePath}
        description={description}
        factualSummary={factualSummary}
        fallbackSummary={
          description !== null && description.length > 0 ? truncate(description, 280) : null
        }
        amadeusRating={
          amadeusRating !== null
            ? {
                ratingValue: amadeusRating.ratingValue,
                reviewCount: amadeusRating.reviewCount,
                bestRating: amadeusRating.bestRating,
              }
            : null
        }
        hasConciergeAdvice={conciergeAdvice !== null}
        hasMapLink={
          row.latitude !== null && row.longitude !== null && location.pointsOfInterest.length === 0
        }
        mapLink={
          row.latitude !== null && row.longitude !== null
            ? `https://www.openstreetmap.org/?mlat=${row.latitude}&mlon=${row.longitude}&zoom=15`
            : null
        }
      />

      <HotelTldr
        locale={locale}
        name={name}
        city={row.city}
        region={row.region}
        isPalace={row.is_palace}
        totalRooms={inventory.totalRooms}
        suites={inventory.suites}
        openedYear={historyDates.openedYear}
        architects={externalIds.knowledgeGraph.architects}
        bookingMode={row.booking_mode}
        dateModified={row.updated_at !== null && row.updated_at !== '' ? row.updated_at : null}
      />

      <HotelGallery
        locale={locale}
        cloudName={cloudName}
        hero={heroDescriptor}
        images={galleryImages}
        hotelName={name}
      />

      <HotelVirtualTour locale={locale} hotelName={name} tour={virtualTour} />

      <HotelFactSheet
        locale={locale}
        hotelName={name}
        address={row.address}
        postalCode={postalCode}
        city={row.city}
        district={row.district}
        stars={row.stars as 1 | 2 | 3 | 4 | 5}
        isPalace={row.is_palace}
        latitude={row.latitude}
        longitude={row.longitude}
        totalRooms={inventory.totalRooms}
        suites={inventory.suites}
        checkInFrom={policies.checkIn !== null ? policies.checkIn.from : null}
        checkOutUntil={policies.checkOut !== null ? policies.checkOut.until : null}
        petsAllowed={policies.pets !== null ? policies.pets.allowed : null}
        openedYear={historyDates.openedYear}
        lastRenovatedYear={historyDates.lastRenovatedYear}
        lastUpdatedLabel={lastUpdated}
        lastUpdatedIso={row.updated_at !== null && row.updated_at !== '' ? row.updated_at : null}
      />

      <section
        id="aeo"
        data-aeo
        {...(!aeoBlockResult.ok ? { 'data-aeo-warning': aeoBlockResult.error.kind } : {})}
        data-aeo-word-count={aeoBlockResult.ok ? aeoBlockResult.value.wordCount : undefined}
        aria-labelledby="hotel-aeo-title"
        className="border-border bg-bg mb-10 rounded-lg border p-5"
      >
        <h2 id="hotel-aeo-title" className="text-fg font-serif text-lg">
          {aeoQuestion}
        </h2>
        <p className="text-muted mt-2 text-sm">{aeoAnswer}</p>
      </section>

      <BookingWidget
        locale={locale}
        hotelId={row.id}
        hotelName={name}
        bookingMode={row.booking_mode}
        defaultStay={{ checkIn, checkOut, adults, children }}
        lockActionUrl={bookable ? lockActionFor(locale, row.id, bestOffer.offerId) : null}
        fakeEnabled={fakeEnabled}
        priceFrom={bestOffer.priceFrom}
        limitedAvailability={bestOffer.limitedAvailability}
        availabilityState={bestOffer.availabilityState}
        surface="inline_section"
      />
      {/*
        C1 / ADR-0013 — URL hydrator client island.
        Re-fills the dates/occupants inputs from `?checkIn=…` on the
        client after hydration so deep-links from /recherche or e-mails
        still land with the right stay window pre-selected even when
        the page is served from the ISR cache.
      */}
      <BookingWidgetUrlHydrator />

      {/*
        Price comparator (skill: competitive-pricing-comparison).
        - server shell + lazy client island → does not delay LCP
        - no logos, no clickable competitor links, prices TTC EUR
        - hides when dates aren't selected
      */}
      <div className="mb-12">
        <PriceComparator
          locale={locale}
          hotelId={row.id}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          priceConciergeMinor={null}
        />
      </div>

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
                className="border-border bg-bg text-fg rounded-md border px-3 py-2 text-sm"
              >
                {h}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t('noHighlights')}</p>
        )}
      </section>

      <HotelAwards locale={locale} awards={awards} />

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

      <HotelAmenities locale={locale} groups={amenityGroups} flat={amenities} />

      {restaurants !== null && restaurants.venues.length > 0 ? (
        <HotelRestaurants locale={locale} restaurants={restaurants} />
      ) : null}

      {spa !== null ? <HotelSpa locale={locale} spa={spa} /> : null}

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

      <HotelEvents locale={locale} hotelName={name} city={row.city} events={upcomingEvents} />

      <HotelMiceEvents locale={locale} hotelName={name} mice={miceInfo} />

      <section aria-labelledby="rooms-title" className="mb-12">
        <h2 id="rooms-title" className="text-fg mb-4 font-serif text-2xl">
          {t('sections.rooms')}
        </h2>
        {rooms.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {rooms.map((room) => {
              const roomHref = {
                pathname: '/hotel/[slug]/chambres/[roomSlug]',
                params: { slug: slugFr, roomSlug: room.slug },
              } as const;
              const priceLabel = formatIndicativePrice(room.indicativePrice, locale, t);
              return (
                <li key={room.id}>
                  <article className="border-border bg-bg rounded-lg border p-4 sm:p-5">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-fg flex items-center gap-2 font-serif text-lg">
                        <Link href={roomHref} className="hover:underline">
                          {room.name ?? room.room_code}
                        </Link>
                        {room.isSignature ? (
                          <span
                            className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-amber-900"
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
                      <p className="text-muted mt-2 text-sm">{room.description}</p>
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
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <Link
                          href={roomHref}
                          className="text-fg hover:text-fg/80 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                        >
                          {t('rooms.viewDetail')}
                          <span aria-hidden>→</span>
                        </Link>
                      </p>
                      {priceLabel !== null ? (
                        <p className="text-muted text-xs" data-room-price>
                          {priceLabel}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t('noRooms')}</p>
        )}
      </section>

      {hasAnyPolicy(policies) ? <HotelPolicies locale={locale} policies={policies} /> : null}

      <ConciergeAdvice locale={locale} advice={conciergeAdvice} />

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

      <LocalGuideTeaser locale={locale} cityLabel={row.city} guide={guideTeaser} />

      <HotelReassurance locale={locale} />

      <HotelFeaturedInRankings mentions={featuredInRankings} locale={locale} />

      <RelatedHotels
        locale={locale}
        bundle={relatedHotels}
        currentRegion={row.region}
        currentCity={row.city}
      />

      <BookingWidgetMobileBar
        hotelId={row.id}
        bookingMode={row.booking_mode}
        priceFromLabel={bestOffer.priceFrom !== null ? mobileBarPriceLabel : null}
        ctaLabel={mobileBarCta}
        ctaAriaLabel={mobileBarAria}
        trustLabel={mobileBarTrust}
      />

      <TrackPageView
        event={{
          name: 'view_hotel',
          hotelId: row.id,
          slug: row.slug,
          locale: locale === 'fr' || locale === 'en' ? locale : 'fr',
          bookingMode: row.booking_mode,
          isPalace: row.is_palace,
          stars: row.stars as 1 | 2 | 3 | 4 | 5,
          hasPriceFrom: bestOffer.priceFrom !== null,
        }}
      />

      <footer className="text-muted mt-10 flex flex-col gap-2 text-xs">
        <p>{t('loyaltyHint')}</p>
        {lastUpdated !== null ? <p>{t('lastUpdated', { date: lastUpdated })}</p> : null}
      </footer>
    </main>
  );
}
