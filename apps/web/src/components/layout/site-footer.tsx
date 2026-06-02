import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ConsentManageLink } from '@/components/consent';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import {
  HERO_REGION_NAV_ENTRIES,
  LABEL_NAV_ENTRIES,
  pickEntryLabel,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_INTL_DESTINATION_NAV_ENTRIES,
  TOP_RANKING_NAV_ENTRIES,
} from './nav-data';

/**
 * Footer top-international subset — kept in sync with the curated mega-
 * menu cities (PR-C, ADR-0021 Vague 4) so the footer surface mirrors
 * the header without duplicating slug definitions. Only 4 cities — the
 * footer column is dense enough already.
 */
const FOOTER_TOP_INTL_SLUGS = ['new-york', 'tokyo', 'dubai', 'marrakech'] as const;

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
              {/* PR-C drop — `/guides` index removed from the footer.
                  ADR-0015 step 1 inlined city long-reads into
                  `/destination/[citySlug]`, leaving `/guides` as a
                  shrinking listing kept alive for the 8 country
                  guides only. The "Top destinations" sub-list below
                  is the new discoverability path. */}
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

            {/* Worldwide cities — exposes the catalogue's global
                footprint from every footer (ADR-0021 Vague 4). The
                4 picked cities all have a long-read editorial body
                rendered inline on `/destination/[citySlug]` (PR-A). */}
            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('links.topIntlDestinations')}
            </h3>
            <ul className="flex flex-col gap-1 text-xs">
              {FOOTER_TOP_INTL_SLUGS.map((citySlug) => {
                const entry = TOP_INTL_DESTINATION_NAV_ENTRIES.find((e) => e.slug === citySlug);
                if (entry === undefined) return null;
                return (
                  <li key={citySlug}>
                    <Link
                      href={{
                        pathname: '/destination/[citySlug]',
                        params: { citySlug },
                      }}
                      className="text-muted hover:text-fg hover:underline"
                    >
                      {pickEntryLabel(entry, locale)}
                    </Link>
                  </li>
                );
              })}
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

            {/* ── Editorial distinctions (2026-05-29) ─────────────────────
                Surfaces the 9 verified label/ranking facets backfilled by
                migration 0063. Footer is the long-tail entry point — the
                mega-menu chip row only carries the 6 most prestigious. */}
            <h3 className="text-muted mb-2 mt-6 text-[10px] font-medium uppercase tracking-wider">
              {t('links.editorialLabels')}
            </h3>
            <ul className="flex flex-col gap-1 text-xs">
              {LABEL_NAV_ENTRIES.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={{
                      pathname: '/label/[facetSlug]',
                      params: { facetSlug: entry.slug },
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
                  now lives here.

                  PR-C — `/le-concierge/fidelite` link removed from
                  the footer (alias of `/le-concierge-club` since the
                  2026-05-26 PO consolidation; keeping both paths in a
                  single column was duplicative). The fidelite page
                  itself stays alive for SEO inbound links. */}
              <li>
                <Link href="/le-concierge-club" className="text-fg hover:underline">
                  {t('links.club')}
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
              {/* Ouvertures & visites du Concierge — flux
                  chronologique des dernières adresses inspectées.
                  Footer-link audit 2026-05-28: la page existait depuis
                  Vague 1 mais n'était surfacée que depuis la home
                  strip — la rendre joignable depuis chaque page
                  consolide l'EEAT + le maillage interne. */}
              <li>
                <Link href="/ouvertures" className="text-fg hover:underline">
                  {t('links.openings')}
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

            {/*
              Surface agentique — déclarée dans le DOM pour les crawlers LLM
              (skill `geo-llm-optimization` §LLM-actionable surfaces), mais
              rendue volontairement discrète pour les visiteurs humains :
              libellés = nom de fichier brut, taille réduite, teinte atténuée.
            */}
            <nav aria-label={t('headings.agentic')} className="mt-6">
              <h2 className="text-muted/70 mb-2 text-[10px] font-medium uppercase tracking-wider">
                {t('headings.agentic')}
              </h2>
              <ul className="text-muted/60 flex flex-col gap-1 text-[10px]">
                <li>
                  {/*
                    Plain `<a>` (no `<Link>`) — these are absolute file
                    paths served by route handlers outside the locale
                    tree. Skill `geo-llm-optimization` §LLM-actionable
                    surfaces.
                  */}
                  <a href="/sitemap.xml" className="hover:text-fg hover:underline">
                    {t('links.sitemap')}
                  </a>
                </li>
                <li>
                  <a href="/llms.txt" className="hover:text-fg hover:underline">
                    {t('links.llmsTxt')}
                  </a>
                </li>
                <li>
                  <a
                    href="/.well-known/agent-skills.json"
                    className="hover:text-fg hover:underline"
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
