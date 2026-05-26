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
import { RegionHubFallback } from '@/components/destinations/region-hub-fallback';
import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, hreflangKey, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';
import { getRegionHubContent, hasLieuHubFallback } from '@/server/destinations/region-hubs';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';
function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

// `saison` was declared in `axes.ts` (Saison = ete/hiver/printemps/automne/
// toute-annee) and surfaced by `SAISON_NAV_ENTRIES` + the `/inspiration`
// hub, but was missing from `ALLOWED_AXES` here — every menu link
// `/classements/saison/<value>` 404'd as a result. Adding `'saison'`
// closes the loop with the menu and the matrice.
const ALLOWED_AXES = new Set(['type', 'lieu', 'theme', 'occasion', 'saison'] as const);
type Axe = 'type' | 'lieu' | 'theme' | 'occasion' | 'saison';

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
  saison: { fr: 'par saison', en: 'by season' },
};

interface RelatedAxisValue {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Counts how many published rankings each *other* value on the same
 * axis carries, then returns the top 8. Used to populate the
 * "related axis values" cross-link block when a known taxonomy
 * (theme/occasion/saison) has no published ranking yet.
 *
 * Pure function over the rankings list — testable in isolation and
 * does not hit Supabase. The caller is responsible for passing the
 * already-fetched `listPublishedRankings()` result.
 */
function buildRelatedAxisValues(
  axe: 'theme' | 'occasion' | 'saison',
  currentValue: string,
  rankings: readonly Awaited<ReturnType<typeof listPublishedRankings>>[number][],
): readonly RelatedAxisValue[] {
  const tally = new Map<string, number>();
  for (const r of rankings) {
    if (axe === 'theme') {
      for (const t of r.axes.themes) {
        if (t !== currentValue) tally.set(t, (tally.get(t) ?? 0) + 1);
      }
    } else if (axe === 'occasion') {
      for (const o of r.axes.occasions) {
        if (o !== currentValue) tally.set(o, (tally.get(o) ?? 0) + 1);
      }
    } else if (axe === 'saison') {
      const s = r.axes.saison;
      if (s !== undefined && s.length > 0 && s !== currentValue) {
        tally.set(s, (tally.get(s) ?? 0) + 1);
      }
    }
  }
  return Array.from(tally.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([value, count]) => ({
      value,
      label: humaniseTaxonomyValue(value),
      count,
    }));
}

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
    case 'saison':
      // `saison` is single-valued on the row (string?), unlike themes
      // / occasions / types which are arrays. Mirror the column shape
      // declared in `editorial_rankings.axes.saison` (migration 0029).
      return rk.axes.saison === value;
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
      if (r.axes.saison !== undefined && r.axes.saison.length > 0) {
        push('saison', r.axes.saison);
      }
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

  // When the page lands on an empty `lieu` taxonomy for one of the
  // hero regions or top-destination cities we ship editorial guides
  // + itineraries for (champagne, provence, bordeaux, pays-basque,
  // cannes, aix-en-provence, reims, biarritz), surface that content
  // instead of letting the user bounce on the generic empty CTAs.
  // Cf. `apps/web/src/server/destinations/region-hubs.ts`.
  const regionHubContent =
    isEmpty && axe === 'lieu' && hasLieuHubFallback(valeur)
      ? await getRegionHubContent(
          // We narrow at runtime via hasLieuHubFallback — the runtime
          // check is the source of truth here, the cast is type-only.
          valeur as Parameters<typeof getRegionHubContent>[0],
          locale,
        )
      : null;

  // For non-lieu empty taxonomies (theme=rooftop, theme=sport-golf,
  // saison=printemps in the 2026-05-25 audit), surface up to 8 of
  // the most-populated values on the same axis so the user has a
  // cross-link instead of a dead-end. Skip for `lieu` (covered above)
  // and `type` (mostly populated, less leverage). This is purely
  // navigational — no JSON-LD emitted.
  const relatedAxisValues: readonly RelatedAxisValue[] =
    isEmpty && (axe === 'theme' || axe === 'occasion' || axe === 'saison')
      ? buildRelatedAxisValues(axe, valeur, await listPublishedRankings())
      : [];

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

      {!isEmpty ? (
        <HubAeoSection
          question={pickByLocale(
            locale,
            `Combien de classements ${axeLabel} : ${label} sur MyConciergeHotel ?`,
            `How many ${axeLabel.replace(/^by /u, '')} rankings on ${label} via MyConciergeHotel?`,
          )}
          answer={pickByLocale(
            locale,
            `MyConciergeHotel publie ${matches.length} classement${matches.length > 1 ? 's' : ''} éditori${matches.length > 1 ? 'aux' : 'al'} ${axeLabel} ${label}, rédigé${matches.length > 1 ? 's' : ''} par notre conciergerie IATA et révisé${matches.length > 1 ? 's' : ''} chaque trimestre. Chaque classement assemble une méthodologie transparente, des hôtels vérifiés (Palace, 5★), des justifications éditoriales et un tableau comparatif quand pertinent. Réservation au tarif net Amadeus, sans intermédiaire commissionné.`,
            `MyConciergeHotel publishes ${matches.length} editorial ranking${matches.length > 1 ? 's' : ''} ${axeLabel} ${label}, written by our IATA concierge desk and reviewed quarterly. Each ranking assembles a transparent methodology, verified hotels (Palace, 5★), editorial justifications and a comparison table when relevant. Booking at Amadeus net rate, no commission intermediary.`,
          )}
          headingId="taxonomy-aeo-title"
          emitJsonLd={false}
        />
      ) : null}

      {isEmpty && regionHubContent !== null ? (
        <RegionHubFallback locale={locale} content={regionHubContent} />
      ) : null}

      {isEmpty && relatedAxisValues.length > 0 ? (
        <section
          aria-labelledby="related-axis-title"
          className="border-border bg-muted/5 mb-10 rounded-lg border p-6 md:p-8"
        >
          <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">
            {pickByLocale(locale, 'Sur le même axe', 'Same axis')}
          </p>
          <h2 id="related-axis-title" className="text-fg font-serif text-2xl sm:text-3xl">
            {pickByLocale(
              locale,
              `Autres ${axeLabel.replace(/^par /u, '')} disponibles`,
              `Other ${axeLabel.replace(/^by /u, '')}s available`,
            )}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {pickByLocale(
              locale,
              `Le filtre « ${label} » n'a pas encore de classement publié. En attendant, voici les classements les plus garnis sur le même axe.`,
              `The "${label}" filter does not have a published ranking yet. In the meantime, here are the most populated rankings on the same axis.`,
            )}
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {relatedAxisValues.map((v) => (
              <li key={v.value}>
                <Link
                  href={{
                    pathname: '/classements/[axe]/[valeur]',
                    params: { axe, valeur: v.value },
                  }}
                  className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-3 transition focus-visible:outline-none focus-visible:ring-2"
                >
                  <p className="text-fg text-sm font-medium">{v.label}</p>
                  <p className="text-muted mt-1 text-xs">
                    {v.count === 1
                      ? pickByLocale(locale, '1 classement', '1 ranking')
                      : pickByLocale(locale, `${v.count} classements`, `${v.count} rankings`)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
