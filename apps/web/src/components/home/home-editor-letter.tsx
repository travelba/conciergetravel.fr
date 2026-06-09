import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * `<HomeEditorLetter>` — « Le mot du Concierge » ported from the HTML kit
 * (design/html-kit/index.html §concierge-band). Editorial pull-quote on a
 * cream gradient with a round watercolour portrait, signed by the
 * Concierge persona (ADR-0011, posture complice — no named individual is
 * invented beyond the editorial signature already shipped in i18n).
 *
 * Pure RSC. Copy comes from `homepage.editorLetter.*`.
 */
export async function HomeEditorLetter({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.editorLetter' });

  return (
    <div className="mch-kit">
      <section className="concierge-band" aria-labelledby="home-editor-letter-title">
        <div className="wrap cb-inner">
          <div className="cb-quote">
            <span className="cb-mark" aria-hidden>
              &ldquo;
            </span>
            <div id="home-editor-letter-title" className="cb-title">
              {t('title')}
            </div>
            <p className="cb-text">{t('paragraph1')}</p>
          </div>
          <div className="cb-sign">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cb-portrait"
              src="/kit/img/concierge.jpg"
              alt={t('signatureName')}
              loading="lazy"
            />
            <div className="cb-name">{t('signatureName')}</div>
            <div className="cb-role">{t('signatureRole')}</div>
            <div className="cb-brand">MyConciergeHotel</div>
          </div>
        </div>
      </section>
    </div>
  );
}
