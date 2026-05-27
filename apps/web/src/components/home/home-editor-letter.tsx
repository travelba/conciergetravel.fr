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
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h2 id="home-editor-letter-title" className="text-fg mt-3 font-serif text-3xl sm:text-4xl">
          {t('title')}
        </h2>
        <div className="text-fg/90 mt-6 space-y-5 font-serif text-lg leading-relaxed sm:text-xl">
          <p>{t('paragraph1')}</p>
          <p>{t('paragraph2')}</p>
          <p>{t('paragraph3')}</p>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <span aria-hidden className="text-muted font-serif text-2xl italic">
            —
          </span>
          <div>
            <p className="text-fg font-medium">{t('signatureName')}</p>
            <p className="text-muted text-xs">{t('signatureRole')}</p>
          </div>
        </div>
        <Link
          href="/le-concierge/methode-editoriale"
          className="text-fg mt-6 inline-flex text-sm font-medium underline-offset-2 hover:underline"
        >
          {t('cta')} →
        </Link>
      </div>
    </section>
  );
}
