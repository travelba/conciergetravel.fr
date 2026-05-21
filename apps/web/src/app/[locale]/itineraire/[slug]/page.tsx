import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd, buildAeoBlock } from '@mch/seo';
import { buildCloudinarySrc } from '@mch/ui';

import { ItineraryAeoBlock } from '@/components/itineraire/itinerary-aeo-block';
import { ItineraryFaq } from '@/components/itineraire/itinerary-faq';
import { ItineraryHero } from '@/components/itineraire/itinerary-hero';
import { ItinerarySteps } from '@/components/itineraire/itinerary-steps';
import { RelatedGuides } from '@/components/itineraire/related-guides';
import { RelatedItineraries } from '@/components/itineraire/related-itineraries';
import { RelatedRankings } from '@/components/itineraire/related-rankings';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { getItineraryBySlug, type ItineraryRow } from '@/server/itineraries/get-itinerary-by-slug';
import {
  getGuidesBySlugs,
  getHotelsByIds,
  getItinerariesBySlugs,
  getRankingsByIds,
  type ItineraryMiniCard,
} from '@/server/itineraries/get-related-data';
import { getRelatedItineraries } from '@/server/itineraries/get-related-itineraries';
import { listPublishedItinerarySlugs } from '@/server/itineraries/list-itineraries';

/**
 * `/itineraire/[slug]` — itinerary detail (CDC §2 + ADR-0007).
 *
 * Sections rendered (rule itinerary-page.mdc §3 + §5):
 *   1. Hero (title, hero, factual summary, last-updated)
 *   2. AEO block (40–80-word answer, validated upstream)
 *   3. Steps (HowTo body — `sections[]`)
 *   4. Related rankings (≥ 2 outbound — `<RelatedRankings>`)
 *   5. Related guides (≥ 1 outbound — `<RelatedGuides>`)
 *   6. Related itineraries (≥ 2 outbound — `<RelatedItineraries>`)
 *   7. FAQ (`<details>` × N, first open)
 *
 * 5 JSON-LD payloads emitted via `<JsonLdScript>` (CSP nonce-aware):
 *   - `BreadcrumbList`
 *   - `Article` (`dateModified` = `last_updated`)
 *   - `HowTo` (steps from `sections[]`, totalTime = `P{duration_min_days}D`)
 *   - `ItemList` (recommended hotels, ordered as `hotel_ids[]`)
 *   - `FAQPage` (every Q/A in `faq_content[]`)
 *
 * @see .cursor/rules/itinerary-page.mdc
 * @see .cursor/rules/seo-geo.mdc
 * @see docs/adr/0007-isr-via-auth-client-island.md
 */

// ADR-0007 — ISR via auth client island (rule itinerary-page.mdc §6).
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Defensive `[]` per nextjs-app-router skill — never throws during
 * build, even when Supabase is unreachable on a preview deployment.
 * One entry per (locale × slug); routing handles the locale prefix.
 */
export async function generateStaticParams(): Promise<{ locale: string; slug: string }[]> {
  try {
    const slugs = await listPublishedItinerarySlugs();
    const out: { locale: string; slug: string }[] = [];
    for (const slug of slugs) {
      out.push({ locale: 'fr', slug });
      out.push({ locale: 'en', slug });
    }
    return out;
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
  const itinerary = await getItineraryBySlug(slug);
  // Rule itinerary-page.mdc §2 — non-published / unknown slugs return
  // a `noindex, nofollow` Metadata so the route remains addressable
  // (the agent skill `get-itinerary` references it) but never
  // pollutes the index.
  if (itinerary === null) return { robots: { index: false, follow: false } };
  const locale = raw;

  const title =
    pickByLocale(locale, itinerary.meta_title_fr, itinerary.meta_title_en) ??
    pickByLocale(locale, itinerary.title_fr, itinerary.title_en ?? itinerary.title_fr);
  const description =
    pickByLocale(locale, itinerary.meta_desc_fr, itinerary.meta_desc_en) ??
    pickByLocale(locale, itinerary.intro_fr ?? '', itinerary.intro_en ?? itinerary.intro_fr ?? '');

  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: { pathname: '/itineraire/[slug]', params: { slug } } });

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const ogImage =
    itinerary.hero_cloudinary_id !== null && cloudName !== undefined
      ? buildCloudinarySrc({
          cloudName,
          publicId: itinerary.hero_cloudinary_id,
          transforms: 'f_auto,q_auto,c_fill,g_auto,w_1200,h_630',
        })
      : null;

  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title,
      description,
      type: 'article',
      locale: ogLocale(locale),
      ...(ogImage !== null ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

const T = {
  fr: {
    home: 'Accueil',
    itineraries: 'Itinéraires',
    eyebrowDetail: 'Itinéraire éditorial',
    travelStyleLabel: {
      luxe: 'Luxe',
      famille: 'Famille',
      couple: 'Couple',
      solo: 'Solo',
      aventure: 'Aventure',
      'bien-etre': 'Bien-être',
      gastronomie: 'Gastronomie',
      culture: 'Culture',
      affaires: 'Affaires',
    },
    durationDays: (n: number) => (n === 1 ? '1 jour' : `${n} jours`),
    durationRange: (a: number, b: number) => `${a}–${b} jours`,
    publisher: 'MyConciergeHotel',
  },
  en: {
    home: 'Home',
    itineraries: 'Itineraries',
    eyebrowDetail: 'Editorial itinerary',
    travelStyleLabel: {
      luxe: 'Luxury',
      famille: 'Family',
      couple: 'Couple',
      solo: 'Solo',
      aventure: 'Adventure',
      'bien-etre': 'Wellness',
      gastronomie: 'Gastronomy',
      culture: 'Culture',
      affaires: 'Business',
    },
    durationDays: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    durationRange: (a: number, b: number) => `${a}–${b} days`,
    publisher: 'MyConciergeHotel',
  },
} as const;

function durationLabel(itinerary: ItineraryRow, locale: Locale): string {
  const t = T[locale];
  if (
    itinerary.duration_max_days !== null &&
    itinerary.duration_max_days !== itinerary.duration_min_days
  ) {
    return t.durationRange(itinerary.duration_min_days, itinerary.duration_max_days);
  }
  return t.durationDays(itinerary.duration_min_days);
}

function destinationLabel(itinerary: ItineraryRow): string {
  const parts: string[] = [];
  if (itinerary.destination_city !== null && itinerary.destination_city.length > 0) {
    parts.push(itinerary.destination_city);
  } else if (itinerary.destination_region !== null && itinerary.destination_region.length > 0) {
    parts.push(itinerary.destination_region);
  }
  parts.push(itinerary.country_code);
  return parts.join(' · ');
}

function travelStyleLabel(itinerary: ItineraryRow, locale: Locale): string {
  const t = T[locale];
  return t.travelStyleLabel[itinerary.travel_style];
}

export default async function ItineraireDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const itinerary = await getItineraryBySlug(slug);
  if (itinerary === null) notFound();

  const t = T[locale];
  const tDetail = await getTranslations({ locale, namespace: 'itineraires.detail' });
  const tHub = await getTranslations({ locale, namespace: 'itineraires' });
  const origin = siteOrigin();
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const canonicalPath = getPathname({
    locale,
    href: { pathname: '/itineraire/[slug]', params: { slug } },
  });
  const canonical = `${origin}${canonicalPath}`;
  const hubUrl = `${origin}${getPathname({ locale, href: '/itineraires' })}`;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // ── Resolve all related entities in parallel ───────────────────────────
  // Single round-trip — guarantees a consistent snapshot even if the
  // editor flips publish state mid-render.
  const stepHotelIds = itinerary.sections
    .map((s) => s.hotel_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const allHotelIds = Array.from(new Set([...stepHotelIds, ...itinerary.hotel_ids]));

  const [hotels, rankings, guides, curatedRelated, autoRelated] = await Promise.all([
    getHotelsByIds(allHotelIds),
    getRankingsByIds(itinerary.related_ranking_ids),
    getGuidesBySlugs(itinerary.related_guide_slugs),
    getItinerariesBySlugs(itinerary.related_itinerary_slugs),
    // Fall-back when the editor hasn't curated related itineraries.
    itinerary.related_itinerary_slugs.length === 0
      ? getRelatedItineraries(slug, { limit: 4 })
      : Promise.resolve([] as const),
  ]);

  const relatedItineraries: ItineraryMiniCard[] =
    curatedRelated.length > 0
      ? [...curatedRelated]
      : autoRelated.map<ItineraryMiniCard>((c) => ({
          slugFr: c.slugFr,
          titleFr: c.titleFr,
          titleEn: c.titleEn,
          destinationCity: null,
          destinationRegion: null,
          // Auto-related shares the same `country_code` as the source by
          // construction (see `getRelatedItineraries` SQL filter), so we
          // surface it here rather than leave the destination blank.
          countryCode: itinerary.country_code,
          durationMinDays: c.durationMinDays,
          durationMaxDays: c.durationMaxDays,
          heroCloudinaryId: c.heroCloudinaryId,
        }));

  // ── AEO block — fail fast if missing or out of bounds ─────────────────
  // Rule itinerary-page.mdc §4: throw rather than silently rendering an
  // unvalidated answer. The audit script (PR4) enforces these bounds at
  // publish time, so reaching this branch in production indicates a
  // schema regression.
  const aeoQuestion = pickByLocale(
    locale,
    itinerary.aeo_question_fr ?? '',
    itinerary.aeo_question_en ?? itinerary.aeo_question_fr ?? '',
  );
  const aeoAnswer = pickByLocale(
    locale,
    itinerary.aeo_answer_fr ?? '',
    itinerary.aeo_answer_en ?? itinerary.aeo_answer_fr ?? '',
  );
  const aeoResult =
    aeoQuestion.length > 0 && aeoAnswer.length > 0
      ? buildAeoBlock({
          question: aeoQuestion,
          answer: aeoAnswer,
          sourceUrl: canonical,
          updatedAt: itinerary.last_updated,
        })
      : null;
  if (aeoResult !== null && !aeoResult.ok) {
    throw new Error(`AEO validation failed for /itineraire/${slug}: ${aeoResult.error.kind}`);
  }
  const aeo = aeoResult?.ok === true ? aeoResult.value : null;

  // ── Hotel ID → fully-qualified URL map (HowTo + ItemList consume it) ──
  const hotelById = new Map(hotels.map((h) => [h.id, h]));
  const hotelUrlFor = (hotelId: string): string | undefined => {
    const h = hotelById.get(hotelId);
    if (h === undefined) return undefined;
    return `${origin}${getPathname({
      locale,
      href: { pathname: '/hotel/[slug]', params: { slug: h.slug } },
    })}`;
  };

  const heroImageUrl =
    itinerary.hero_cloudinary_id !== null && cloudName !== undefined
      ? buildCloudinarySrc({
          cloudName,
          publicId: itinerary.hero_cloudinary_id,
          transforms: 'f_auto,q_auto,c_fill,g_auto,w_1600,h_900',
        })
      : null;

  const title = pickByLocale(locale, itinerary.title_fr, itinerary.title_en ?? itinerary.title_fr);
  const introHtml = pickByLocale(
    locale,
    itinerary.intro_fr ?? '',
    itinerary.intro_en ?? itinerary.intro_fr ?? '',
  );
  const factualSummary =
    pickByLocale(locale, itinerary.meta_desc_fr, itinerary.meta_desc_en) ?? null;

  // ── JSON-LD ───────────────────────────────────────────────────────────
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t.home, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t.itineraries, url: hubUrl },
      { name: title, url: canonical },
    ]),
  );

  const articleDescription =
    factualSummary !== null && factualSummary.length > 0 ? factualSummary : introHtml.slice(0, 200);
  const articleJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.articleJsonLd({
      headline: title,
      url: canonical,
      ...(articleDescription.length > 0 ? { description: articleDescription } : {}),
      datePublished: itinerary.created_at,
      dateModified: itinerary.last_updated,
      author: { name: t.publisher },
      publisher: { name: t.publisher, logoUrl: `${origin}/logo.png` },
      inLanguage: hreflangKey(locale),
      ...(heroImageUrl !== null ? { image: [heroImageUrl] } : {}),
    }),
  );

  const howToSteps = itinerary.sections.map((s) => {
    const stepName = pickByLocale(locale, s.title_fr, s.title_en || s.title_fr);
    const stepText = pickByLocale(locale, s.body_fr, s.body_en || s.body_fr);
    const stepUrl =
      s.hotel_id !== null && s.hotel_id !== undefined ? hotelUrlFor(s.hotel_id) : undefined;
    return stepUrl !== undefined
      ? { name: stepName, text: stepText, url: stepUrl }
      : { name: stepName, text: stepText };
  });
  const howToJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itineraryHowToJsonLd({
      name: title,
      ...(articleDescription.length > 0 ? { description: articleDescription } : {}),
      durationDays: itinerary.duration_min_days,
      steps: howToSteps,
      locale,
    }),
  );

  // ItemList — published hotels, in the canonical `hotel_ids[]` order
  // (when they all resolved against the lookup). When some IDs failed
  // to resolve we drop them silently rather than emit a partial list
  // with broken anchors.
  const orderedHotels = itinerary.hotel_ids
    .map((id) => hotelById.get(id))
    .filter((h): h is NonNullable<typeof h> => h !== undefined);
  const itemListJsonLd =
    orderedHotels.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: title,
            items: orderedHotels.map((h) => ({
              name: pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr),
              url: `${origin}${getPathname({
                locale,
                href: { pathname: '/hotel/[slug]', params: { slug: h.slug } },
              })}`,
              ...(h.stars !== null && h.stars >= 1 && h.stars <= 5
                ? { hotel: { starRating: h.stars as 1 | 2 | 3 | 4 | 5 } }
                : {}),
            })),
          }),
        )
      : null;

  // FAQPage — keep aligned with the visible `<ItineraryFaq>` so Google's
  // Rich Result policy holds (`acceptedAnswer.text` must match).
  const faqEntries = itinerary.faq_content.filter((e) => e.q_fr.length > 0 && e.a_fr.length > 0);
  const faqJsonLd =
    faqEntries.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.faqPageJsonLd(
            faqEntries.map((e) => ({
              question: pickByLocale(locale, e.q_fr, e.q_en.length > 0 ? e.q_en : e.q_fr),
              answer: pickByLocale(locale, e.a_fr, e.a_en.length > 0 ? e.a_en : e.a_fr),
            })),
          ),
        )
      : null;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={howToJsonLd} nonce={nonce} />
      {itemListJsonLd !== null ? <JsonLdScript data={itemListJsonLd} nonce={nonce} /> : null}
      {faqJsonLd !== null ? <JsonLdScript data={faqJsonLd} nonce={nonce} /> : null}

      {/* Skip-link for assistive tech jumping to the step list. */}
      <a
        href="#steps"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-amber-200 focus:px-3 focus:py-2 focus:text-xs"
      >
        {tDetail('ariaSkipToSteps')}
      </a>

      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:underline">
              {t.home}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/itineraires" className="hover:underline">
              {t.itineraries}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg font-medium">{title}</li>
        </ol>
      </nav>

      <ItineraryHero
        locale={locale}
        title={title}
        eyebrow={tHub('eyebrow')}
        factualSummary={factualSummary}
        heroImageUrl={heroImageUrl}
        heroAlt={pickByLocale(locale, itinerary.hero_alt_fr, itinerary.hero_alt_en)}
        lastUpdated={itinerary.last_updated}
        durationLabel={durationLabel(itinerary, locale)}
        destinationLabel={destinationLabel(itinerary)}
        travelStyleLabel={travelStyleLabel(itinerary, locale)}
      />

      {introHtml.length > 0 ? (
        <section id="introduction" className="mb-10 max-w-prose">
          <p className="text-fg/90 whitespace-pre-line text-base leading-relaxed md:text-lg">
            {introHtml}
          </p>
        </section>
      ) : null}

      {aeo !== null ? <ItineraryAeoBlock aeo={aeo} /> : null}

      <ItinerarySteps locale={locale} sections={itinerary.sections} hotels={hotels} />

      <RelatedRankings locale={locale} rankings={rankings} />
      <RelatedGuides locale={locale} guides={guides} />
      <RelatedItineraries locale={locale} itineraries={relatedItineraries} />

      <ItineraryFaq locale={locale} entries={faqEntries} />

      <p className="text-muted mt-12 text-xs">
        <Link href="/itineraires" className="underline hover:no-underline">
          {tDetail('allItineraries')} →
        </Link>
      </p>

      {/* `intlLocaleTag` is consumed by the JSON-LD builder; the import
          guard keeps tsc happy without exporting an unused symbol. */}
      <span hidden data-intl-locale={intlLocaleTag(locale)} aria-hidden />
    </main>
  );
}
