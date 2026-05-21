import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/country-guide/[slug] — country guide envelope for
 * an agent.
 *
 * Mirrors the `/guide/<countrySlug>` HTML pages shipped in PRs
 * #91 + #92 (Vague 6). Lets LLM agents that detect the user's
 * intent ("luxury hotels in Italy?") quote the guide's structured
 * answer directly without redirecting to the HTML page.
 *
 * The 8 supported country slugs match `INTL_DESTINATION_NAV_ENTRIES`
 * + the typed `routing.ts` pathnames. Adding a 9th country requires:
 *   1. Adding its route to `routing.ts`
 *   2. Adding its i18n namespace
 *   3. Adding its `page.tsx`
 *   4. Adding its entry to `COUNTRY_GUIDES` below
 *
 * Response shape:
 *   { ok: true, country: { slug, name, iso, alternateName },
 *     canonicalUrl: { fr, en },
 *     regions: [ { name, highlights, bestFor, conciergeTip } ],
 *     practical: [ { title, body } ],
 *     faq: [ { question, answer } ],
 *     lastReviewed: '2026-05-15' }
 *
 * The full content is shipped pre-translated from the i18n payload
 * via the helper `loadCountryGuide(slug, locale)`. Cache: 1h public
 * + 24h CDN — the guides change slowly (quarterly editorial review).
 *
 * Skill: api-integration, geo-llm-optimization §AEO + §FAQ.
 */
const QuerySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

/**
 * Country slug → i18n namespace + identity tuple. Single source of
 * truth for the supported country guides — the agent endpoint, the
 * forthcoming agent-skills declaration, and the upcoming CI guard
 * all consume this table.
 */
const COUNTRY_GUIDES = {
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

type CountrySlug = keyof typeof COUNTRY_GUIDES;

function isCountrySlug(s: string): s is CountrySlug {
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

/**
 * Loads the guide payload from the i18n JSON for the given country
 * + locale. Read directly from the messages file (no next-intl
 * runtime needed — the API route doesn't have a locale context).
 */
async function loadGuide(
  slug: CountrySlug,
  locale: 'fr' | 'en',
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
  // Dynamic import — Next.js bundles the JSON at build time.
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
  });
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_query' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const { slug } = await params;
  if (typeof slug !== 'string' || !isCountrySlug(slug)) {
    return agentJson(
      {
        ok: false,
        error: 'not_found',
        slug,
        supportedSlugs: Object.keys(COUNTRY_GUIDES),
      },
      { status: 404, cacheControl: 'no-store' },
    );
  }

  const guide = await loadGuide(slug, locale).catch(() => null);
  if (guide === null) {
    return agentJson(
      { ok: false, error: 'guide_payload_unavailable', slug },
      { status: 500, cacheControl: 'no-store' },
    );
  }

  const country = COUNTRY_GUIDES[slug];
  const canonicalSlugEn = country.enSlug;

  // The AEO answer template carries a `{date}` placeholder — fill it
  // with the lastReviewed month-year for consistency with the HTML
  // rendering. Locale-aware formatting kept simple here (no Intl
  // dependency in the agent shell).
  const lastReviewedDate = new Date(guide.lastReviewed);
  const isoMonth = lastReviewedDate.toISOString().slice(0, 7);
  const aeoAnswer = guide.aeoAnswerTemplate.replace('{date}', isoMonth);

  return agentJson(
    {
      ok: true,
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
    {
      cacheControl: 'public, max-age=3600, s-maxage=86400',
    },
  );
}
