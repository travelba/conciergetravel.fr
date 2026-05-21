import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ConsentManageLink } from '@/components/consent';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

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
 *   │ Col 1: Brand + Trust signals (IATA, Conseil du Concierge…)      │
 *   │ Col 2: Explorer (toutes destinations / hôtels / classements…)   │
 *   │ Col 3: Catalogue (Palaces, 5★, boutique, châteaux, marques…)    │
 *   │ Col 4: Services (compte, fidélité, hôteliers, MICE…)            │
 *   │ Col 5: Légal + Surface agentique (llms.txt, agent-skills.json)  │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │ © {year}                                  [Manage cookies]      │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Why 5 cols (vs 3):
 * - Boosts internal linking depth — every public page sees the top 8
 *   destinations + top 6 rankings + 6 hotel types + 5 brand groups.
 * - **Surface agentique** (Col 5) declares the LLM-actionable endpoints
 *   (`llms.txt`, `agent-skills.json`) publicly. Standard pattern from
 *   skill `geo-llm-optimization` — LLM crawlers prefer sites that
 *   surface their machine-readable contracts in the DOM.
 *
 * Renders as a Server Component (no useState/useEffect). The
 * `ConsentManageLink` is a Client island (it opens the consent
 * banner).
 */
export async function SiteFooter(): Promise<ReactElement> {
  const t = await getTranslations('footer');
  const locale = (await getLocale()) as Locale;
  const year = new Date().getFullYear();

  return (
    <footer className="border-border bg-bg mt-16 border-t">
      <div className="container mx-auto max-w-screen-xl px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Col 1 — Brand + trust signals */}
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
              {TOP_DESTINATION_NAV_ENTRIES.slice(0, 6).map((entry) => (
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
              {TOP_RANKING_NAV_ENTRIES.slice(0, 5).map((entry) => (
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

          {/* Col 4 — Services */}
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
              <li>
                <Link href="/le-concierge" className="text-fg hover:underline">
                  {t('links.loyalty')}
                </Link>
              </li>
              <li>
                <Link href="/le-concierge" className="text-fg hover:underline">
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
                <Link href="/le-concierge" className="text-fg hover:underline">
                  {t('links.concierge')}
                </Link>
              </li>
            </ul>

            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('links.newsletter')}
            </h3>
            {/* Newsletter signup — wire to Brevo in PR-5 (skill: email-workflow-automation). */}
            <p className="text-muted text-xs">
              <Link href="/le-concierge" className="text-fg hover:underline">
                {t('links.newsletterCta')} →
              </Link>
            </p>
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

        {/* Hero region row — additional internal linking on every page */}
        <nav aria-label={t('headings.browse')} className="border-border mt-10 border-t pt-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {HERO_REGION_NAV_ENTRIES.map((entry) => (
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

        <div className="border-border text-muted mt-6 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{t('rights', { year })}</p>
          <ConsentManageLink />
        </div>
      </div>
    </footer>
  );
}
