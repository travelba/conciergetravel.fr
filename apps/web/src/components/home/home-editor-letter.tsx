import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeEditorLetter>` — « Le mot du Concierge ».
 *
 * Court éditorial signé qui ouvre la séquence après le hero. Inspiration
 * Tablet (editor's note) + Yonder (lede signé). Posture Concierge
 * complice (EDITORIAL_VOICE.md §2) : pas d'individu nommé, on signe la
 * persona « Le Concierge, votre hôtelier de confiance » par souci de
 * cohérence avec ADR-0011 — le bloc reste éditorial, pas promotionnel.
 *
 * Pure RSC. Tous les libellés viennent de `homepage.editorLetter.*`.
 */
export async function HomeEditorLetter({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.editorLetter' });

  return (
    <section
      aria-labelledby="home-editor-letter-title"
      className="container mx-auto max-w-screen-xl px-4 py-14 sm:py-20"
    >
      <div className="border-gold-200/70 bg-gold-50/40 dark:border-gold-900/40 dark:bg-gold-900/10 relative mx-auto max-w-4xl overflow-hidden rounded-3xl border px-6 py-12 sm:px-14 sm:py-16">
        {/* Decorative opening quote mark — sets the "editor's note as
            pull-quote" tone without competing with the copy. */}
        <span
          aria-hidden
          className="text-gold-300/70 dark:text-gold-700/50 pointer-events-none absolute -top-4 left-6 select-none font-serif text-[7rem] leading-none sm:text-[9rem]"
        >
          &ldquo;
        </span>

        <div className="relative">
          <p className="text-gold-700 dark:text-gold-400 text-xs uppercase tracking-[0.2em]">
            {t('eyebrow')}
          </p>
          <h2
            id="home-editor-letter-title"
            className="text-fg mt-3 font-serif text-3xl sm:text-4xl"
          >
            {t('title')}
          </h2>
          <div className="text-fg/90 mt-6 space-y-5 font-serif text-lg leading-relaxed sm:text-xl">
            <p>{t('paragraph1')}</p>
            <p>{t('paragraph2')}</p>
            <p>{t('paragraph3')}</p>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <span aria-hidden className="bg-gold/70 h-px w-12 shrink-0" />
            <div>
              <p className="text-fg font-serif text-xl italic">{t('signatureName')}</p>
              <p className="text-muted mt-0.5 text-xs uppercase tracking-wider">
                {t('signatureRole')}
              </p>
            </div>
          </div>

          <Link
            href="/le-concierge/methode-editoriale"
            className="text-gold-700 hover:text-gold-800 dark:text-gold-400 mt-8 inline-flex text-sm font-medium underline-offset-2 hover:underline"
          >
            {t('cta')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
