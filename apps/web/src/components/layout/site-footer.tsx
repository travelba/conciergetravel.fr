import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ConsentManageLink } from '@/components/consent';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { isHotelHeritageRoute, readBarePathname } from '@/lib/layout/bare-pathname';

import {
  HERO_REGION_NAV_ENTRIES,
  pickEntryLabel,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_RANKING_NAV_ENTRIES,
} from './nav-data';

/**
 * Site-wide footer — refonte ADR-0014 (fat-footer 5 colonnes).
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ Col 1: Brand + Trust signals + Engagements → /mentions-legales │
 *   │ Col 2: Explorer (toutes destinations + top 8 villes)            │
 *   │ Col 3: Catalogue (6 catégories + marques + top 6 classements)   │
 *   │ Col 4: Services (compte, fidélité, hôteliers, MICE, presse…)    │
 *   │        + Éditorial Concierge (Conseil, Méthode, Itinéraires,    │
 *   │           newsletter)                                            │
 *   │ Col 5: Légal + Surface agentique (llms.txt, agent-skills.json)  │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │ Régions héros (7 liens vers /classements/lieu/[valeur])         │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │ © {year}                                  [Manage cookies]      │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Why this density (audit 2026-05-25):
 * - Every public page now emits ~55 internal links (was ~38 before
 *   widening the slices and adding the Concierge editorial sub-column).
 *   That's the "fat footer" pattern from skill `seo-technical`
 *   §Anti-cannibalisation — boosts internal PageRank distribution
 *   without diluting Algolia search relevance.
 * - The **Éditorial Concierge** sub-column makes the 4 EEAT-critical
 *   pages (Conseil du Concierge, Méthode éditoriale, Itinéraires,
 *   Newsletter) reachable from every page. Previously they were only
 *   linked from the mega-menu, which is invisible to ~30 % of mobile
 *   sessions per GA4 (the mega-menu trigger is two taps away).
 * - **Surface agentique** (Col 5) declares the LLM-actionable endpoints
 *   (`llms.txt`, `agent-skills.json`) publicly. Standard pattern from
 *   skill `geo-llm-optimization` — LLM crawlers prefer sites that
 *   surface their machine-readable contracts in the DOM.
 * - The trailing "Régions héros" strip points to
 *   `/classements/lieu/[valeur]` (NOT `/destination/[citySlug]` — those
 *   slugs are region keys, not city slugs; routing them to
 *   `/destination/...` was emitting 7 dead links per page until this
 *   audit, same bug previously fixed in `site-header.tsx` and
 *   `mobile-nav.tsx`).
 *
 * Renders as a Server Component (no useState/useEffect). The
 * `ConsentManageLink` is a Client island (it opens the consent
 * banner).
 */
export async function SiteFooter(): Promise<ReactElement> {
  const t = await getTranslations('footer');
  const locale = (await getLocale()) as Locale;
  const year = new Date().getFullYear();
  const { bare } = await readBarePathname();

  if (isHotelHeritageRoute(bare)) {
    return <HeritageHotelFooter t={t} year={year} />;
  }

  return (
    <footer className="border-border bg-bg mt-16 border-t">
      <div className="container mx-auto max-w-screen-xl px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Col 1 — Brand + trust signals
              Audit 2026-05-25: added the `engagements` line that points
              to /mentions-legales. It states the regulatory framework
              (IATA / Atout France / APST) without inventing specific
              accreditation numbers — those live on the legal page,
              which is currently `noindex, follow` until counsel signs
              off (see `mentions-legales/page.tsx` IS_DRAFT). */}
          <div className="lg:col-span-1">
            <p className="text-fg font-serif text-lg">{t('company')}</p>
            <p className="text-muted mt-2 text-sm">{t('tagline')}</p>
            <ul className="mt-4 flex flex-col gap-1.5 text-xs">
              <li className="text-muted flex items-start gap-1.5">
                <span aria-hidden className="text-amber-700">
                  ★
                </span>
                <span>{t('trust.iata')}</span>
              </li>
              <li className="text-muted flex items-start gap-1.5">
                <span aria-hidden className="text-amber-700">
                  ★
                </span>
                <span>{t('trust.concierge')}</span>
              </li>
              <li className="text-muted flex items-start gap-1.5">
                <span aria-hidden className="text-amber-700">
                  ★
                </span>
                <span>{t('trust.loyalty')}</span>
              </li>
            </ul>
            <p className="text-muted mt-4 text-xs leading-relaxed">
              {t('trust.engagements')}{' '}
              <Link href="/mentions-legales" className="text-fg hover:underline">
                {t('trust.engagementsCta')} →
              </Link>
            </p>
          </div>

          {/* Col 2 — Explorer */}
          <nav aria-label={t('headings.explore')}>
            <h2 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
              {t('headings.explore')}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/destination" className="text-fg hover:underline">
                  {t('links.destinations')}
                </Link>
              </li>
              <li>
                <Link href="/hotels" className="text-fg hover:underline">
                  {t('links.hotels')}
                </Link>
              </li>
              <li>
                <Link href="/classements" className="text-fg hover:underline">
                  {t('links.rankings')}
                </Link>
              </li>
              <li>
                <Link href="/inspiration" className="text-fg hover:underline">
                  {t('links.inspiration')}
                </Link>
              </li>
              <li>
                <Link href="/guides" className="text-fg hover:underline">
                  {t('links.guides')}
                </Link>
              </li>
              <li>
                <Link href="/recherche" className="text-fg hover:underline">
                  {t('links.search')}
                </Link>
              </li>
            </ul>

            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('links.topDestinations')}
            </h3>
            <ul className="flex flex-col gap-1 text-xs">
              {TOP_DESTINATION_NAV_ENTRIES.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={{
                      pathname: '/destination/[citySlug]',
                      params: { citySlug: entry.slug },
                    }}
                    className="text-muted hover:text-fg hover:underline"
                  >
                    {pickEntryLabel(entry, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 3 — Catalogue (types + brands + top rankings) */}
          <nav aria-label={t('headings.browse')}>
            <h2 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
              {t('headings.browse')}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'palaces-france' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.palaces')}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'hotels-5-etoiles' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.fiveStars')}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'boutique-hotels' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.boutique')}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'chateaux-hotels' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.chateaux')}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'chalets-luxe' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.chalets')}
                </Link>
              </li>
              <li>
                <Link
                  href={{
                    pathname: '/categorie/[categorySlug]',
                    params: { categorySlug: 'villas' },
                  }}
                  className="text-fg hover:underline"
                >
                  {t('links.villas')}
                </Link>
              </li>
              <li>
                <Link href="/marques" className="text-fg hover:underline">
                  {t('links.allBrands')}
                </Link>
              </li>
            </ul>

            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('links.topRankings')}
            </h3>
            <ul className="flex flex-col gap-1 text-xs">
              {TOP_RANKING_NAV_ENTRIES.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={{
                      pathname: '/classement/[slug]',
                      params: { slug: entry.slug },
                    }}
                    className="text-muted hover:text-fg hover:underline"
                  >
                    {pickEntryLabel(entry, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 4 — Services + Concierge editorial surface
              Audit 2026-05-25: added the four Concierge editorial
              entry points (Conseil, Méthode, About, Itinéraires) so
              every page emits these EEAT links — they were previously
              only reachable via the mega-menu. */}
          <nav aria-label={t('headings.services')}>
            <h2 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
              {t('headings.services')}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/compte" className="text-fg hover:underline">
                  {t('links.account')}
                </Link>
              </li>
              {/* Le Concierge Club — programme landing (ADR-0019). Footer
                  surfaces it from every page so the funnel is reachable
                  without the mega-menu. The legacy `/le-concierge/fidelite`
                  page stays alive for inbound links but the canonical CTA
                  now lives here. */}
              <li>
                <Link href="/le-concierge-club" className="text-fg hover:underline">
                  {t('links.club')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge-club/prestige" className="text-fg hover:underline">
                  {t('links.clubPrestige')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/fidelite" className="text-fg hover:underline">
                  {t('links.loyalty')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/faq" className="text-fg hover:underline">
                  {t('links.support')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/pour-les-hoteliers" className="text-fg hover:underline">
                  {t('links.hoteliers')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/mice-et-seminaires" className="text-fg hover:underline">
                  {t('links.mice')}
                </Link>
              </li>
              <li>
                <Link
                  href="/le-concierge/presse-et-partenaires"
                  className="text-fg hover:underline"
                >
                  {t('links.press')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/contact" className="text-fg hover:underline">
                  {t('links.concierge')}
                </Link>
              </li>
            </ul>

            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('headings.editorial')}
            </h3>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/le-conseil-du-concierge" className="text-fg hover:underline">
                  {t('links.conciergeTip')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/methode-editoriale" className="text-fg hover:underline">
                  {t('links.editorialMethod')}
                </Link>
              </li>
              <li>
                <Link href="/itineraires" className="text-fg hover:underline">
                  {t('links.itineraries')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge/newsletter" className="text-fg hover:underline">
                  {t('links.newsletterCta')}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Col 5 — Legal + Agentic */}
          <div>
            <nav aria-label={t('headings.legal')}>
              <h2 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
                {t('headings.legal')}
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                <li>
                  <Link href="/mentions-legales" className="text-fg hover:underline">
                    {t('links.legalNotice')}
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="text-fg hover:underline">
                    {t('links.privacy')}
                  </Link>
                </li>
                <li>
                  <Link href="/cgv" className="text-fg hover:underline">
                    {t('links.terms')}
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-fg hover:underline">
                    {t('links.cookies')}
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label={t('headings.agentic')} className="mt-6">
              <h2 className="text-muted mb-2 text-[10px] font-medium uppercase tracking-wider">
                {t('headings.agentic')}
              </h2>
              <ul className="flex flex-col gap-1.5 text-xs">
                <li>
                  {/*
                    Plain `<a>` (no `<Link>`) — these are absolute file
                    paths served by route handlers outside the locale
                    tree. Skill `geo-llm-optimization` §LLM-actionable
                    surfaces.
                  */}
                  <a href="/sitemap.xml" className="text-muted hover:text-fg hover:underline">
                    {t('links.sitemap')}
                  </a>
                </li>
                <li>
                  <a href="/llms.txt" className="text-muted hover:text-fg hover:underline">
                    {t('links.llmsTxt')}
                  </a>
                </li>
                <li>
                  <a
                    href="/.well-known/agent-skills.json"
                    className="text-muted hover:text-fg hover:underline"
                  >
                    {t('links.agentSkills')}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Hero region row — additional internal linking on every page.
            Audit 2026-05-25: HERO_REGION slugs (`cote-d-azur`, `provence`,
            `alpes`, `champagne`, `corse`, `pays-basque`, `loire`) are
            region taxonomy keys, not city slugs — routing them to
            `/destination/[citySlug]` was emitting 7 dead links per page.
            Now wired to `/classements/[axe]/[valeur]` with `axe=lieu`,
            same fix as `site-header.tsx` (line ~349) and `mobile-nav.tsx`
            (AxisLinkList with `axe="lieu"`). The taxonomy page renders
            published rankings when present, or a graceful noindex empty
            state when the editorial hub is still in draft (Phase 2). */}
        <nav aria-label={t('headings.regions')} className="border-border mt-10 border-t pt-6">
          <h2 className="text-muted mb-3 text-[10px] font-medium uppercase tracking-wider">
            {t('headings.regions')}
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {HERO_REGION_NAV_ENTRIES.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={{
                    pathname: '/classements/[axe]/[valeur]',
                    params: { axe: 'lieu', valeur: entry.slug },
                  }}
                  className="text-muted hover:text-fg hover:underline"
                >
                  {pickEntryLabel(entry, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-border text-muted mt-6 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{t('rights', { year })}</p>
          <ConsentManageLink />
        </div>
      </div>
    </footer>
  );
}

type FooterT = Awaited<ReturnType<typeof getTranslations<'footer'>>>;

function HeritageHotelFooter({
  t,
  year,
}: {
  readonly t: FooterT;
  readonly year: number;
}): ReactElement {
  return (
    <footer className="border-outline-variant bg-surface-container-lowest border-t">
      <div className="px-margin-mobile md:px-margin-desktop mx-auto grid max-w-[1280px] grid-cols-12 gap-6 py-16 md:gap-8 md:py-[120px]">
        <div className="col-span-12 md:col-span-4">
          <p className="text-primary-heritage text-headline-md mb-6 font-serif">{t('company')}</p>
          <p className="text-on-surface-variant text-body-lg leading-relaxed">{t('tagline')}</p>
          <p className="text-on-surface-variant mt-6 text-sm">{t('rights', { year })}</p>
        </div>
        <div className="col-span-12 grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-3">
          <nav aria-label={t('headings.legal')} className="flex flex-col gap-4">
            <h2 className="text-primary-heritage text-label-caps tracking-caps mb-2 uppercase">
              {t('headings.legal')}
            </h2>
            <Link
              href="/mentions-legales"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.legalNotice')}
            </Link>
            <Link
              href="/confidentialite"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.privacy')}
            </Link>
            <Link
              href="/cgv"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.terms')}
            </Link>
            <Link
              href="/cookies"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.cookies')}
            </Link>
          </nav>
          <nav aria-label={t('headings.services')} className="flex flex-col gap-4">
            <h2 className="text-primary-heritage text-label-caps tracking-caps mb-2 uppercase">
              {t('headings.services')}
            </h2>
            <Link
              href="/le-concierge-club"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.club')}
            </Link>
            <Link
              href="/le-concierge/pour-les-hoteliers"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.hoteliers')}
            </Link>
            <Link
              href="/le-concierge/presse-et-partenaires"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.press')}
            </Link>
            <Link
              href="/le-concierge/contact"
              className="text-on-surface-variant hover:text-primary-heritage text-body-lg underline-offset-4 hover:underline"
            >
              {t('links.contact')}
            </Link>
          </nav>
          <div className="col-span-2 flex flex-col justify-end md:col-span-1">
            <ConsentManageLink />
          </div>
        </div>
      </div>
    </footer>
  );
}
