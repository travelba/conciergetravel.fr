import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { SupportedLocale } from '@/i18n/supported-locale';

interface ConciergeAdviceTeaserProps {
  readonly locale: SupportedLocale;
}

/**
 * ATF nudge towards the full `<ConciergeAdvice>` block (rendered lower
 * on the page, ADR-0011 / `editorial-voice.mdc`).
 *
 * Why: the Concierge voice is the strongest brand differentiator vs
 * Booking / Mr & Mrs Smith. Surfacing a teaser ATF without
 * duplicating the body avoids cannibalisation (the block remains
 * canonical for the `concierge_advice` JSON content) while ensuring
 * the user notices it exists before scrolling past.
 *
 * Anchor: `#concierge-advice` — owned by the full `<ConciergeAdvice>`
 * component. Smooth scroll managed by the browser default.
 */
export async function ConciergeAdviceTeaser({
  locale,
}: ConciergeAdviceTeaserProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage.heroAdviceTeaser' });
  return (
    <p className="text-muted mt-3 inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden>⭐</span>
      <a href="#concierge-advice" className="text-fg underline-offset-2 hover:underline">
        {t('cta')}
      </a>
    </p>
  );
}
