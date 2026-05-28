import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeInspirationGrid>` — « Trouver la bonne adresse selon l'occasion ».
 *
 * Six axes choisis par le PO (2026-05-28) — un mix `theme` (5) +
 * `occasion` (1, lune-de-miel) qui mappe sur la matrice `/classements/
 * [axe]/[valeur]` (cf. `scripts/editorial-pilot/src/rankings/axes.ts`).
 *
 * - `spa-bienetre`, `famille`, `sport-golf`, `gastronomie`, `rooftop`
 *   appartiennent au THEMES enum → axe = `theme`.
 * - `lune-de-miel` appartient au OCCASIONS enum → axe = `occasion`.
 *
 * Le composant est volontairement strict : les `messageKey` sont
 * typés et la table est explicite plutôt que générique, pour éviter le
 * piège « j'ajoute un axe et la copie casse silencieusement ».
 *
 * Pure RSC.
 */

type InspirationCard = {
  readonly messageKey: 'spa' | 'famille' | 'golf' | 'luneDeMiel' | 'gastronomie' | 'rooftop';
  readonly axe: 'theme' | 'occasion';
  readonly valeur: string;
};

const CARDS: readonly InspirationCard[] = [
  { messageKey: 'spa', axe: 'theme', valeur: 'spa-bienetre' },
  { messageKey: 'famille', axe: 'theme', valeur: 'famille' },
  { messageKey: 'golf', axe: 'theme', valeur: 'sport-golf' },
  { messageKey: 'luneDeMiel', axe: 'occasion', valeur: 'lune-de-miel' },
  { messageKey: 'gastronomie', axe: 'theme', valeur: 'gastronomie' },
  { messageKey: 'rooftop', axe: 'theme', valeur: 'rooftop' },
];

export async function HomeInspirationGrid({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.inspiration' });

  return (
    <section
      aria-labelledby="home-inspiration-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-inspiration-title" className="text-fg mt-2 font-serif text-3xl sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Link
          href="/classements"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('seeAll')}
        </Link>
      </div>

      {/*
        Mobile : carrousel snap horizontal (1 card visible + peek).
        Desktop : grille 2-cols (sm) → 3-cols (lg). Voir
        `.cursor/skills/responsive-ui-architecture/SKILL.md` §"Snap
        carousels".
      */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {CARDS.map((card) => (
          <li key={card.messageKey} className="shrink-0 basis-[82%] snap-start sm:basis-auto">
            <Link
              href={{
                pathname: '/classements/[axe]/[valeur]',
                params: { axe: card.axe, valeur: card.valeur },
              }}
              className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <h3 className="text-fg font-serif text-lg">{t(`axes.${card.messageKey}.title`)}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {t(`axes.${card.messageKey}.subtitle`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
