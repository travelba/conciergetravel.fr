import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import {
  HOTEL_TYPE_NAV_ENTRIES,
  OCCASION_NAV_ENTRIES,
  TOP_DESTINATION_NAV_ENTRIES,
  HERO_REGION_NAV_ENTRIES,
  THEME_NAV_ENTRIES,
} from '@/components/layout/nav-data';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, hreflangKey, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';
function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const ALLOWED_AXES = new Set(['type', 'lieu', 'theme', 'occasion'] as const);
type Axe = 'type' | 'lieu' | 'theme' | 'occasion';

function isAxe(s: string): s is Axe {
  return (ALLOWED_AXES as Set<string>).has(s);
}

/**
 * Recognised taxonomy values per axis — extracted from `nav-data.ts`
 * (the menu's source of truth). When a deep link lands on
 * `/classements/<axe>/<valeur>` with a `valeur` from this set, we know
 * the axis value is **a legitimate taxonomy member** even if no
 * published ranking matches it yet. We then render a `noindex` empty
 * state instead of `notFound()`, avoiding soft-404s on menu-exposed
 * URLs while the catalogue is being seeded (skill `seo-technical`
 * §Indexability per segment).
 *
 * Off-menu values (e.g. `/classements/theme/zombiecore`) still 404 to
 * preserve crawl budget and to surface broken inbound links honestly.
 *
 * For `type`, we mirror the menu's URL contract — `nav-data` exposes
 * slugs prefixed with `hotels-` for stars while `axes.ts` uses the
 * bare form. The mapping is committed separately in the menu fix PR;
 * here we accept both shapes so this PR stays self-contained.
 */
const KNOWN_TYPE_VALUES = new Set<string>([
  // axes.ts canonical
  'palace',
  '5-etoiles',
  '4-etoiles',
  'boutique-hotel',
  'chateau',
  'chalet',
  'villa',
  'maison-hotes',
  'resort',
  'ecolodge',
  'insolite',
  'all',
  // nav-data current emissions (until the menu-fix PR lands)
  ...HOTEL_TYPE_NAV_ENTRIES.map((e) => e.slug),
]);
const KNOWN_THEME_VALUES = new Set<string>(THEME_NAV_ENTRIES.map((e) => e.slug));
const KNOWN_OCCASION_VALUES = new Set<string>(OCCASION_NAV_ENTRIES.map((e) => e.slug));
const KNOWN_LIEU_VALUES = new Set<string>([
  ...TOP_DESTINATION_NAV_ENTRIES.map((e) => e.slug),
  ...HERO_REGION_NAV_ENTRIES.map((e) => e.slug),
]);

function isKnownTaxonomyValue(axe: Axe, valeur: string): boolean {
  switch (axe) {
    case 'type':
      return KNOWN_TYPE_VALUES.has(valeur);
    case 'theme':
      return KNOWN_THEME_VALUES.has(valeur);
    case 'occasion':
      return KNOWN_OCCASION_VALUES.has(valeur);
    case 'lieu':
      return KNOWN_LIEU_VALUES.has(valeur);
    default:
      return false;
  }
}

/** Pretty-print a taxonomy slug for display in headings / metadata. */
function humaniseTaxonomyValue(valeur: string): string {
  return valeur.replace(/-/g, ' ').replace(/^\w/u, (c) => c.toUpperCase());
}

const T = {
  fr: {
    home: 'Accueil',
    rankings: 'Classements',
    eyebrow: 'Sous-hub',
    metaTitleTpl: (axe: string, label: string) => `Classements ${axe} ${label} — MyConciergeHotel`,
    metaDescTpl: (label: string, n: number) =>
      `${n} classements éditoriaux Palaces et 5 étoiles autour de ${label}.`,
    backLabel: '← Tous les classements',
    seeRanking: 'Lire le classement',
    entriesCount: (n: number) => (n === 1 ? '1 hôtel' : `${n} hôtels`),
    empty: "Aucun classement pour ce filtre pour l'instant.",
  },
  en: {
    home: 'Home',
    rankings: 'Rankings',
    eyebrow: 'Sub-hub',
    metaTitleTpl: (axe: string, label: string) => `${axe} rankings — ${label} — MyConciergeHotel`,
    metaDescTpl: (label: string, n: number) =>
      `${n} editorial Palace and 5-star rankings around ${label}.`,
    backLabel: '← All rankings',
    seeRanking: 'Read the ranking',
    entriesCount: (n: number) => (n === 1 ? '1 hotel' : `${n} hotels`),
    empty: 'No ranking for this filter yet.',
  },
} as const;

const AXE_LABEL: Record<Axe, { fr: string; en: string }> = {
  type: { fr: 'par type', en: 'by type' },
  lieu: { fr: 'par destination', en: 'by destination' },
  theme: { fr: 'par thématique', en: 'by theme' },
  occasion: { fr: 'par occasion', en: 'by occasion' },
};

function rankingMatches(
  axe: Axe,
  value: string,
  rk: Awaited<ReturnType<typeof listPublishedRankings>>[number],
): boolean {
  switch (axe) {
    case 'type':
      return rk.axes.types.includes(value);
    case 'lieu':
      return rk.axes.lieu?.slug === value;
    case 'theme':
      return rk.axes.themes.includes(value);
    case 'occasion':
      return rk.axes.occasions.includes(value);
    default:
      return false;
  }
}

/**
 * Defensive — never throws during build (nextjs-app-router skill).
 * Enumerates every (axe × value) pair seen in the published axes
 * payloads. The result is bilingual and stable across rebuilds.
 */
export async function generateStaticParams(): Promise<
  { locale: string; axe: string; valeur: string }[]
> {
  try {
    const rankings = await listPublishedRankings();
    const seen = new Set<string>();
    const out: { locale: string; axe: string; valeur: string }[] = [];
    const push = (axe: Axe, valeur: string): void => {
      const key = `${axe}/${valeur}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ locale: 'fr', axe, valeur });
      out.push({ locale: 'en', axe, valeur });
    };
    for (const r of rankings) {
      for (const ty of r.axes.types) push('type', ty);
      for (const th of r.axes.themes) push('theme', th);
      for (const o of r.axes.occasions) push('occasion', o);
      if (r.axes.lieu !== undefined) push('lieu', r.axes.lieu.slug);
    }
    return out;
  } catch {
    return [];
  }
}

interface PageParams {
  readonly locale: string;
  readonly axe: string;
  readonly valeur: string;
}

async function resolveAxeValue(
  axe: Axe,
  valeur: string,
): Promise<{
  matches: Awaited<ReturnType<typeof listPublishedRankings>>;
  label: string;
} | null> {
  const all = await listPublishedRankings();
  const matches = all.filter((r) => rankingMatches(axe, valeur, r));
  if (matches.length === 0) return null;
  // Resolve a human label — for `lieu` we prefer the carried label;
  // for the others we synthesise from the slug.
  let label = valeur.replace(/-/g, ' ');
  if (axe === 'lieu') {
    const fromAxes = matches.find((m) => m.axes.lieu?.slug === valeur)?.axes.lieu?.label;
    if (fromAxes !== undefined) label = fromAxes;
  } else {
    label = label.replace(/^\w/u, (c) => c.toUpperCase());
  }
  return { matches, label };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale: raw, axe, valeur } = await params;
  if (!isRoutingLocale(raw)) return {};
  if (!isAxe(axe)) return {};
  const resolved = await resolveAxeValue(axe, valeur);
  // Off-menu deep link with no published ranking AND no taxonomy
  // membership → hard 404 surface (returning empty metadata triggers
  // Next.js default behaviour). On-menu link with no ranking yet →
  // noindex,follow empty-state metadata so the URL stays resolvable.
  if (resolved === null && !isKnownTaxonomyValue(axe, valeur)) {
    return { robots: { index: false, follow: false } };
  }
  const locale = raw;
  const t = T[locale];
  const axeLabel = AXE_LABEL[axe][locale];
  const label = resolved?.label ?? humaniseTaxonomyValue(valeur);
  const matchCount = resolved?.matches.length ?? 0;
  const title = t.metaTitleTpl(axeLabel, label);
  const description = t.metaDescTpl(label, matchCount);
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/classements/[axe]/[valeur]', params: { axe, valeur } },
    });
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
      type: 'website',
      locale: ogLocale(locale),
    },
    // Known taxonomy value but zero rankings → `noindex, follow`. The
    // page renders so the menu link resolves, but Google does not index
    // it until the catalogue ships a matching ranking.
    ...(matchCount === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RankingSubHubPage({ params }: { params: Promise<PageParams> }) {
  const { locale: raw, axe, valeur } = await params;
  if (!isRoutingLocale(raw)) notFound();
  if (!isAxe(axe)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const resolved = await resolveAxeValue(axe, valeur);
  // Off-menu valeur with no ranking → 404. On-menu valeur with no
  // ranking → render an empty state under `noindex, follow` so the URL
  // resolves and the menu links never 404 while the catalogue grows.
  if (resolved === null && !isKnownTaxonomyValue(axe, valeur)) {
    notFound();
  }
  const matches = resolved?.matches ?? [];
  const label = resolved?.label ?? humaniseTaxonomyValue(valeur);
  const isEmpty = matches.length === 0;

  const t = T[locale];
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const canonical = `${origin}${getPathname({
    locale,
    href: { pathname: '/classements/[axe]/[valeur]', params: { axe, valeur } },
  })}`;
  const axeLabel = AXE_LABEL[axe][locale];
  // TODO i18n Phase 1c-β: migrate heading templates to next-intl. V2
  // locales fall back to the FR phrasing for now.
  const heading = pickByLocale(
    locale,
    `Classements ${axeLabel} : ${label}`,
    `${axeLabel.replace(/^by /u, '')} rankings: ${label}`,
  );

  const latestUpdate = matches.reduce<string | null>((acc, r) => {
    if (r.updatedAt === null) return acc;
    if (acc === null) return r.updatedAt;
    return r.updatedAt > acc ? r.updatedAt : acc;
  }, null);

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t.home, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t.rankings, url: `${origin}${getPathname({ locale, href: '/classements' })}` },
      { name: label, url: canonical },
    ]),
  );

  // Skip CollectionPage JSON-LD when empty: a zero-item ItemList
  // dilutes the structured-data signal. The page still emits the
  // BreadcrumbList so navigational context is preserved for crawlers.
  const collectionJsonLd = isEmpty
    ? null
    : JsonLd.withSchemaOrgContext(
        JsonLd.collectionPageJsonLd({
          name: heading,
          url: canonical,
          description: t.metaDescTpl(label, matches.length),
          ...(latestUpdate !== null ? { dateModified: latestUpdate } : {}),
          itemList: {
            name: heading,
            items: matches.map((r) => ({
              // Title selection stays locale-aware (data layer) — see ADR-0012.
              // V2 locales fall back to FR until migration 0034.
              name: pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr),
              url: `${origin}${getPathname({
                locale,
                href: { pathname: '/classement/[slug]', params: { slug: r.slug } },
              })}`,
            })),
          },
          inLanguage: hreflangKey(locale),
        }),
      );

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {collectionJsonLd !== null ? <JsonLdScript data={collectionJsonLd} nonce={nonce} /> : null}

      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-xs">
        <Link href="/classements" className="hover:underline">
          {t.backLabel}
        </Link>
      </nav>

      <header className="mb-8 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{heading}</h1>
        <LastUpdatedBadge isoDate={latestUpdate} locale={locale} variant="inline" />
      </header>

      {isEmpty ? (
        <section
          aria-labelledby="empty-state-title"
          className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
        >
          <h2 id="empty-state-title" className="text-fg font-serif text-xl">
            {pickByLocale(
              locale,
              'Aucun classement publié pour ce filtre',
              'No ranking published for this filter',
            )}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {pickByLocale(
              locale,
              `Notre conciergerie publie régulièrement de nouveaux classements éditoriaux. Pour ${label}, la sélection est en cours — explorez nos classements en ligne en attendant.`,
              `Our concierge desk publishes new editorial rankings regularly. For ${label}, the selection is in progress — browse our live rankings in the meantime.`,
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/classements"
              className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Tous les classements', 'All rankings')} →
            </Link>
            <Link
              href="/inspiration"
              className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Explorer par inspiration', 'Browse by inspiration')} →
            </Link>
          </div>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((r) => {
            const title = pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr);
            const summary = pickLocalizedText(locale, r.factualSummaryFr, r.factualSummaryEn);
            return (
              <li
                key={r.slug}
                className="border-border bg-bg/60 rounded-lg border p-5 transition hover:shadow-md"
              >
                <Link
                  href={{ pathname: '/classement/[slug]', params: { slug: r.slug } }}
                  className="block"
                >
                  <p className="text-muted mb-1 text-xs uppercase tracking-wide">
                    {t.entriesCount(r.entryCount)}
                    {r.axes.lieu !== undefined ? ` · ${r.axes.lieu.label}` : ''}
                  </p>
                  <h2 className="text-fg font-medium">{title}</h2>
                  {summary !== null ? (
                    <p className="text-fg/75 mt-2 line-clamp-3 text-xs">{summary}</p>
                  ) : null}
                  <p className="text-fg/70 mt-3 text-xs underline">{t.seeRanking} →</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
