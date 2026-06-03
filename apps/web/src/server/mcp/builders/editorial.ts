import 'server-only';

import { getItineraryBySlug } from '@/server/itineraries/get-itinerary-by-slug';
import { listItineraries } from '@/server/itineraries/list-itineraries';
import {
  getRankingBySlug,
  getRankingEntries,
  listPublishedRankings,
} from '@/server/rankings/get-ranking-by-slug';

import { type AgentLocale, type BuilderResponse, errorResponse, okResponse } from './types';

/**
 * Editorial-domain result builders (rankings, itineraries, country
 * guides) shared by `/api/agent/*` routes and the MCP tools (Lot 4,
 * ADR-0029).
 */

const LIST_CACHE = 'public, max-age=600, s-maxage=3600';
const DETAIL_CACHE = 'private, max-age=1800, stale-while-revalidate=3600';
const GUIDE_CACHE = 'public, max-age=3600, s-maxage=86400';

export type RankingAxe = 'type' | 'lieu' | 'theme' | 'occasion' | 'saison';

export interface RankingsListParams {
  readonly axe?: RankingAxe;
  readonly valeur?: string;
  readonly locale: AgentLocale;
}

export async function buildRankingsListResult(
  params: RankingsListParams,
): Promise<BuilderResponse> {
  const { axe, valeur, locale } = params;
  const all = await listPublishedRankings().catch(() => []);

  const filtered =
    axe === undefined || valeur === undefined
      ? all
      : all.filter((r) => {
          switch (axe) {
            case 'type':
              return r.axes.types.includes(valeur);
            case 'theme':
              return r.axes.themes.includes(valeur);
            case 'occasion':
              return r.axes.occasions.includes(valeur);
            case 'lieu':
              return r.axes.lieu?.slug === valeur;
            case 'saison':
              return r.axes.saison === valeur;
            default:
              return false;
          }
        });

  return okResponse(
    {
      filter: axe !== undefined ? { axe, valeur } : null,
      count: filtered.length,
      rankings: filtered.map((r) => ({
        slug: r.slug,
        title: locale === 'en' ? (r.titleEn ?? r.titleFr) : r.titleFr,
        factualSummary:
          locale === 'en' ? (r.factualSummaryEn ?? r.factualSummaryFr) : r.factualSummaryFr,
        entryCount: r.entryCount,
        kind: r.kind,
        axes: r.axes,
        updatedAt: r.updatedAt,
        canonicalUrl: locale === 'en' ? `/en/classement/${r.slug}` : `/fr/classement/${r.slug}`,
      })),
    },
    LIST_CACHE,
  );
}

export interface RankingParams {
  readonly slug: string;
  readonly locale: AgentLocale;
}

export async function buildRankingResult(params: RankingParams): Promise<BuilderResponse> {
  const { slug, locale } = params;
  const row = await getRankingBySlug(slug).catch(() => null);
  if (row === null) {
    return errorResponse(404, { error: 'not_found', slug });
  }

  const entries = await getRankingEntries(row.id).catch(() => []);
  const pick = <T>(fr: T, en: T | null): T => (locale === 'en' && en !== null ? en : fr);

  return okResponse(
    {
      ranking: {
        slug: row.slug,
        title: pick(row.title_fr, row.title_en),
        kind: row.kind,
        axes: row.axes,
        factualSummary: pick(row.factual_summary_fr ?? null, row.factual_summary_en ?? null),
        intro: pick(row.intro_fr, row.intro_en),
        outro: pick(row.outro_fr, row.outro_en),
        author: row.author_name !== null ? { name: row.author_name, url: row.author_url } : null,
        entries: entries.map((e) => ({
          rank: e.rank,
          hotelSlug: e.hotel_slug,
          hotelName: pick(e.hotel_name, e.hotel_name_en),
          city: e.hotel_city,
          stars: e.hotel_stars,
          isPalace: e.hotel_is_palace,
          justification: pick(e.justification_fr, e.justification_en),
          badge: pick(e.badge_fr ?? null, e.badge_en ?? null),
          canonicalUrl:
            locale === 'en'
              ? `/en/hotel/${e.hotel_slug_en ?? e.hotel_slug}`
              : `/fr/hotel/${e.hotel_slug}`,
        })),
        faq: row.faq.map((f) => ({
          question: pick(f.question_fr, f.question_en),
          answer: pick(f.answer_fr, f.answer_en),
        })),
        externalSources: row.external_sources.map((s) => ({
          type: s.type,
          label: pick(s.label_fr, s.label_en),
          url: s.url,
        })),
        reviewedAt: row.reviewed_at,
        updatedAt: row.updated_at,
        canonicalUrl: locale === 'en' ? `/en/classement/${row.slug}` : `/fr/classement/${row.slug}`,
      },
    },
    DETAIL_CACHE,
  );
}

export interface ItinerariesListParams {
  readonly country_code?: string;
  readonly destination_region?: string;
  readonly destination_city?: string;
  readonly theme?: string;
  readonly travel_style?: string;
  readonly duration_min_days?: number;
  readonly duration_max_days?: number;
  readonly locale: AgentLocale;
}

export async function buildItinerariesListResult(
  params: ItinerariesListParams,
): Promise<BuilderResponse> {
  const { theme, locale, country_code, destination_region, destination_city, travel_style } =
    params;

  type ItinerariesFilter = NonNullable<Parameters<typeof listItineraries>[0]>;
  const filters: ItinerariesFilter = {
    ...(country_code !== undefined ? { country_code } : {}),
    ...(destination_region !== undefined ? { destination_region } : {}),
    ...(destination_city !== undefined ? { destination_city } : {}),
    ...(travel_style !== undefined
      ? { travel_style: travel_style as ItinerariesFilter['travel_style'] }
      : {}),
    ...(params.duration_min_days !== undefined
      ? { duration_min_days: params.duration_min_days }
      : {}),
    ...(params.duration_max_days !== undefined
      ? { duration_max_days: params.duration_max_days }
      : {}),
    ...(theme !== undefined ? { themes: [theme] } : {}),
  };

  const cards = await listItineraries(filters).catch(() => []);

  return okResponse(
    {
      filter: {
        countryCode: country_code ?? null,
        destinationRegion: destination_region ?? null,
        destinationCity: destination_city ?? null,
        theme: theme ?? null,
        travelStyle: travel_style ?? null,
        durationMinDays: params.duration_min_days ?? null,
        durationMaxDays: params.duration_max_days ?? null,
      },
      count: cards.length,
      itineraries: cards.map((c) => ({
        slug: c.slugFr,
        title: locale === 'en' && c.titleEn !== null ? c.titleEn : c.titleFr,
        metaDescription: locale === 'en' && c.metaDescEn !== null ? c.metaDescEn : c.metaDescFr,
        countryCode: c.countryCode,
        destinationRegion: c.destinationRegion,
        destinationCity: c.destinationCity,
        themes: c.themes,
        travelStyle: c.travelStyle,
        season: c.season,
        durationMinDays: c.durationMinDays,
        durationMaxDays: c.durationMaxDays,
        hotelCount: c.hotelCount,
        priority: c.priority,
        lastUpdated: c.lastUpdated,
        canonicalUrl:
          locale === 'en' ? `/en/itineraire/${c.slugEn ?? c.slugFr}` : `/fr/itineraire/${c.slugFr}`,
      })),
    },
    LIST_CACHE,
  );
}

export interface ItineraryParams {
  readonly slug: string;
  readonly locale: AgentLocale;
}

export async function buildItineraryResult(params: ItineraryParams): Promise<BuilderResponse> {
  const { slug, locale } = params;
  const row = await getItineraryBySlug(slug).catch(() => null);
  if (row === null) {
    return errorResponse(404, { error: 'not_found', slug });
  }

  const pick = <T>(fr: T, en: T): T => (locale === 'en' ? en : fr);
  const pickNullable = <T>(fr: T, en: T | null): T => (locale === 'en' && en !== null ? en : fr);

  const canonicalSlug =
    locale === 'en' && row.slug_en !== null && row.slug_en.length > 0 ? row.slug_en : row.slug_fr;

  return okResponse(
    {
      itinerary: {
        slug: row.slug_fr,
        title: pickNullable(row.title_fr, row.title_en),
        metaTitle: pickNullable(row.meta_title_fr, row.meta_title_en),
        metaDescription: pickNullable(row.meta_desc_fr, row.meta_desc_en),
        countryCode: row.country_code,
        destinationRegion: row.destination_region,
        destinationCity: row.destination_city,
        themes: row.themes,
        travelStyle: row.travel_style,
        season: row.season,
        durationMinDays: row.duration_min_days,
        durationMaxDays: row.duration_max_days,
        intro: pickNullable(row.intro_fr, row.intro_en),
        aeo:
          row.aeo_question_fr !== null && row.aeo_answer_fr !== null
            ? {
                question: pickNullable(row.aeo_question_fr, row.aeo_question_en),
                answer: pickNullable(row.aeo_answer_fr, row.aeo_answer_en),
              }
            : null,
        steps: row.sections.map((s) => ({
          step: s.step,
          title: pick(s.title_fr, s.title_en),
          body: pick(s.body_fr, s.body_en),
          city: s.city,
          poi: s.poi,
          hotelId: s.hotel_id ?? null,
          durationDays: s.duration_days ?? null,
        })),
        hotelIds: row.hotel_ids,
        faq: row.faq_content.map((f) => ({
          question: pick(f.q_fr, f.q_en),
          answer: pick(f.a_fr, f.a_en),
        })),
        related: {
          itinerarySlugs: row.related_itinerary_slugs,
          guideSlugs: row.related_guide_slugs,
          rankingIds: row.related_ranking_ids,
        },
        hero:
          row.hero_cloudinary_id !== null
            ? {
                cloudinaryId: row.hero_cloudinary_id,
                alt: pickNullable(row.hero_alt_fr, row.hero_alt_en),
              }
            : null,
        priority: row.priority,
        lastUpdated: row.last_updated,
        updatedAt: row.updated_at,
        canonicalUrl:
          locale === 'en' ? `/en/itineraire/${canonicalSlug}` : `/fr/itineraire/${canonicalSlug}`,
      },
    },
    DETAIL_CACHE,
  );
}

// ── Country guides (i18n-backed, 8 slugs) ──────────────────────────
// Single source of truth for the supported country guides — consumed
// by both the HTTP route and the MCP tool.
export const COUNTRY_GUIDES = {
  italie: {
    namespace: 'guideItalie',
    name: 'Italy',
    iso: 'IT',
    alternateName: 'Italia',
    enSlug: 'italy',
  },
  suisse: {
    namespace: 'guideSuisse',
    name: 'Switzerland',
    iso: 'CH',
    alternateName: 'Schweiz',
    enSlug: 'switzerland',
  },
  maroc: {
    namespace: 'guideMaroc',
    name: 'Morocco',
    iso: 'MA',
    alternateName: 'Maroc',
    enSlug: 'morocco',
  },
  maldives: {
    namespace: 'guideMaldives',
    name: 'Maldives',
    iso: 'MV',
    alternateName: 'Maldives',
    enSlug: 'maldives',
  },
  'emirats-arabes-unis': {
    namespace: 'guideEAU',
    name: 'United Arab Emirates',
    iso: 'AE',
    alternateName: 'UAE',
    enSlug: 'uae',
  },
  japon: {
    namespace: 'guideJapon',
    name: 'Japan',
    iso: 'JP',
    alternateName: '日本',
    enSlug: 'japan',
  },
  thailande: {
    namespace: 'guideThailande',
    name: 'Thailand',
    iso: 'TH',
    alternateName: 'ประเทศไทย',
    enSlug: 'thailand',
  },
  'etats-unis': {
    namespace: 'guideEtatsUnis',
    name: 'United States',
    iso: 'US',
    alternateName: 'USA',
    enSlug: 'usa',
  },
} as const;

export type CountrySlug = keyof typeof COUNTRY_GUIDES;

export function isCountrySlug(s: string): s is CountrySlug {
  return Object.prototype.hasOwnProperty.call(COUNTRY_GUIDES, s);
}

interface RegionItem {
  readonly name: string;
  readonly highlights: string;
  readonly bestFor: string;
  readonly concierge: string;
}
interface PracticalItem {
  readonly title: string;
  readonly body: string;
}
interface FaqItem {
  readonly q: string;
  readonly a: string;
}

async function loadGuide(
  slug: CountrySlug,
  locale: AgentLocale,
): Promise<{
  factualSummary: string;
  title: string;
  lede: string;
  lastReviewed: string;
  aeoQuestion: string;
  aeoAnswerTemplate: string;
  regions: RegionItem[];
  practical: PracticalItem[];
  faq: FaqItem[];
} | null> {
  const ns = COUNTRY_GUIDES[slug].namespace;
  const messagesModule = (await import(`@/i18n/messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  const messages = messagesModule.default;
  const guide = messages[ns];
  if (!guide || typeof guide !== 'object') return null;

  const g = guide as Record<string, unknown>;
  const regionsBlock = g['regions'] as { items?: RegionItem[] } | undefined;
  const practicalBlock = g['practical'] as { items?: PracticalItem[] } | undefined;

  return {
    factualSummary: String(g['factualSummary'] ?? ''),
    title: String(g['title'] ?? ''),
    lede: String(g['lede'] ?? ''),
    lastReviewed: String(g['lastReviewed'] ?? ''),
    aeoQuestion: String(g['aeoQuestion'] ?? ''),
    aeoAnswerTemplate: String(g['aeoAnswer'] ?? ''),
    regions: Array.isArray(regionsBlock?.items) ? regionsBlock.items : [],
    practical: Array.isArray(practicalBlock?.items) ? practicalBlock.items : [],
    faq: Array.isArray(g['faq']) ? (g['faq'] as FaqItem[]) : [],
  };
}

export interface CountryGuideParams {
  readonly slug: string;
  readonly locale: AgentLocale;
}

export async function buildCountryGuideResult(
  params: CountryGuideParams,
): Promise<BuilderResponse> {
  const { slug, locale } = params;
  if (!isCountrySlug(slug)) {
    return errorResponse(404, {
      error: 'not_found',
      slug,
      supportedSlugs: Object.keys(COUNTRY_GUIDES),
    });
  }

  const guide = await loadGuide(slug, locale).catch(() => null);
  if (guide === null) {
    return errorResponse(500, { error: 'guide_payload_unavailable', slug });
  }

  const country = COUNTRY_GUIDES[slug];
  const canonicalSlugEn = country.enSlug;

  const lastReviewedDate = new Date(guide.lastReviewed);
  const isoMonth = lastReviewedDate.toISOString().slice(0, 7);
  const aeoAnswer = guide.aeoAnswerTemplate.replace('{date}', isoMonth);

  return okResponse(
    {
      country: {
        slug,
        name: country.name,
        iso: country.iso,
        alternateName: country.alternateName,
      },
      canonicalUrl: {
        fr: `/fr/guide/${slug}`,
        en: `/en/guide/${canonicalSlugEn}`,
      },
      title: guide.title,
      lede: guide.lede,
      factualSummary: guide.factualSummary,
      aeo: { question: guide.aeoQuestion, answer: aeoAnswer },
      regions: guide.regions.map((r) => ({
        name: r.name,
        highlights: r.highlights,
        bestFor: r.bestFor,
        conciergeTip: r.concierge,
      })),
      practical: guide.practical,
      faq: guide.faq.map((f) => ({ question: f.q, answer: f.a })),
      lastReviewed: guide.lastReviewed,
    },
    GUIDE_CACHE,
  );
}
