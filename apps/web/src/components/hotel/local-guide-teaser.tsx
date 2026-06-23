import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { isHandBuiltCountrySlug } from '@/lib/destinations/hand-built-country-guides';
import type { GuideTeaser } from '@/server/guides/get-guide-teaser';

interface LocalGuideTeaserProps {
  readonly locale: SupportedLocale;
  readonly cityLabel: string;
  readonly guide: GuideTeaser | null;
}

/**
 * CDC §2 bloc 12 — teaser éditorial vers le guide de ville.
 *
 * Anti-cannibalisation contract (`seo-geo.mdc` §Anti-cannibalisation):
 *  - the teaser **must NOT** duplicate the guide body. It carries the
 *    guide title + a short summary + a link only.
 *  - the link uses the canonical `/destination/[citySlug]` pathname
 *    (ADR-0015 guide↔destination merge) so Google consolidates equity
 *    on the canonical URL without a 308 hop. The 8 hand-built country
 *    guides stay canonical at `/guide/<slug>` (static page wins).
 *
 * Renders `null` when no guide is published for the city — the bloc
 * appears automatically the next time the hotel ISR revalidates after
 * the guide goes live (no manual hotel republish needed).
 *
 * The summary is the canonical `editorial_guides.summary_*` value,
 * already authored for the SERP / OG snippet. The teaser surfaces
 * it verbatim (skill: editorial-long-read-rendering — no
 * paraphrasing in transit).
 */
export async function LocalGuideTeaser({
  locale,
  cityLabel,
  guide,
}: LocalGuideTeaserProps): Promise<ReactElement | null> {
  if (guide === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.localGuide' });

  return (
    <section
      aria-labelledby="local-guide-teaser-title"
      className="border-border bg-bg mb-12 rounded-lg border p-5 sm:p-6"
      data-local-guide-teaser
    >
      <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
      <h2 id="local-guide-teaser-title" className="text-fg mt-2 font-serif text-xl sm:text-2xl">
        {t('title', { city: cityLabel })}
      </h2>
      <p className="text-muted mt-3 max-w-prose text-sm">{guide.summary}</p>
      <p className="mt-4">
        <Link
          href={
            isHandBuiltCountrySlug(guide.slug)
              ? { pathname: '/guide/[citySlug]', params: { citySlug: guide.slug } }
              : { pathname: '/destination/[citySlug]', params: { citySlug: guide.slug } }
          }
          className="text-fg inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
          aria-label={t('cta', { name: guide.name })}
        >
          {t('cta', { name: guide.name })}
          <span aria-hidden>→</span>
        </Link>
      </p>
    </section>
  );
}
