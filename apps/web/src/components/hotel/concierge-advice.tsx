import { getTranslations } from 'next-intl/server';

import type { LocalisedConciergeAdvice } from '@/server/hotels/get-hotel-by-slug';

interface Props {
  readonly locale: 'fr' | 'en';
  readonly advice: LocalisedConciergeAdvice | null;
}

/**
 * « Le Conseil du Concierge » — bloc canonique en bas de fiche hôtel,
 * juste avant la FAQ (CDC §2 + ADR-0011 + EDITORIAL_VOICE.md §4 bloc 8).
 *
 * Le bloc est **obligatoire** sur tout hôtel publié (60-90 mots FR/EN,
 * voix Concierge complice, contient un secret opérationnel : chambre,
 * timing, accès, table, service ou wellness).
 *
 * Distinction visuelle du `EditorialCallout concierge_tip` (callouts
 * éditoriaux dispersés dans guides/rankings) : ici on a un **seul** bloc
 * canonique par fiche, plus emphatique (eyebrow étoile, fond sablé,
 * border-left ambrée plus marquée), traité comme une donnée structurée
 * du produit pas comme un encart libre.
 *
 * Skill: editorial-long-read-rendering, accessibility, responsive-ui-architecture.
 */
export async function ConciergeAdvice({
  locale,
  advice,
}: Props): Promise<React.ReactElement | null> {
  if (advice === null) return null;
  if (advice.body.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const eyebrow = t('conciergeAdvice.eyebrow');
  const defaultTitle = t('conciergeAdvice.defaultTitle');
  const title = advice.title.length > 0 ? advice.title : defaultTitle;

  return (
    <section
      id="concierge-advice"
      aria-labelledby="concierge-advice-title"
      className="mb-12 scroll-mt-24"
    >
      <aside
        className="border-l-4 border-l-amber-600/70 bg-amber-50/50 px-6 py-5 sm:rounded-r-lg dark:border-l-amber-500/70 dark:bg-amber-950/20"
        role="note"
        aria-label={eyebrow}
      >
        <p className="text-fg/60 mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
          <span aria-hidden className="text-amber-600 dark:text-amber-400">
            ★
          </span>
          {eyebrow}
        </p>
        <h2 id="concierge-advice-title" className="text-fg mb-2 font-serif text-xl leading-tight">
          {title}
        </h2>
        <p className="text-fg/90 text-[15px] leading-relaxed">{advice.body}</p>
      </aside>
    </section>
  );
}
