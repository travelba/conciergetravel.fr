import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedHotelStorySection } from '@/server/hotels/get-hotel-by-slug';

import { ConciergeQuote } from './concierge-quote';
import { HotelStoryMore } from './hotel-story-more';

interface HotelStoryProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly conciergeHook: string | null;
  readonly sections: readonly LocalisedHotelStorySection[];
  readonly heroParagraphs: readonly string[] | null;
  /**
   * Golden template (PO request 2026-06-02): keep the "À propos" intro
   * paragraphs visible and collapse the detailed `<h3>` sections behind a
   * sober "En savoir plus" disclosure. Off by default — prod fiches keep
   * the full long read expanded.
   */
  readonly collapsibleSections?: boolean;
  /**
   * Kit layout (`les-airelles-gordes.html` § #apropos): `.htl-section`,
   * eyebrow, concierge H2, `.concierge-quote`, `.read-more` + `.htl-prose`.
   */
  readonly useKitLayout?: boolean;
}

export async function HotelStory({
  locale,
  hotelName,
  conciergeHook,
  sections,
  heroParagraphs,
  collapsibleSections = false,
  useKitLayout = false,
}: HotelStoryProps): Promise<React.ReactElement | null> {
  const hasSections = sections.length > 0;
  const hasHero = heroParagraphs !== null && heroParagraphs.length > 0;
  if (!hasSections && !hasHero && conciergeHook === null) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const heroProse =
    hasHero && heroParagraphs !== null ? (
      <>
        {heroParagraphs.map((paragraph, idx) => (
          <p key={idx} className="htl-prose">
            {paragraph}
          </p>
        ))}
      </>
    ) : null;

  const detailedSections = hasSections ? (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr]">
      <nav
        aria-label={t('story.tocLabel')}
        className="border-border bg-bg rounded-lg border p-4 lg:sticky lg:top-24 lg:self-start"
      >
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('story.tocTitle')}</p>
        <ol className="flex flex-col gap-1.5 text-sm">
          {sections.map((section, idx) => (
            <li key={section.anchor}>
              <a
                href={`#${section.anchor}`}
                className="text-fg/90 hover:text-fg flex gap-2 underline-offset-2 hover:underline"
              >
                <span className="text-muted tabular-nums" aria-hidden>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span>{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="prose text-fg/90 max-w-prose text-base">
        {sections.map((section) => (
          <section key={section.anchor} aria-labelledby={section.anchor} className="mb-8 last:mb-0">
            <h3 id={section.anchor} className="text-fg mb-3 mt-0 scroll-mt-24 font-serif text-xl">
              {section.title}
            </h3>
            {section.paragraphs.map((paragraph, idx) => (
              <p key={idx} className="mb-3 last:mb-0">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  ) : null;

  if (useKitLayout) {
    return (
      <section
        id="apropos"
        aria-labelledby="about-title"
        className="mch-kit htl-section scroll-mt-28"
      >
        <span className="eyebrow left">{t('conciergeEyebrow')}</span>
        <h2 id="about-title">{t('sections.conciergeWord', { hotel: hotelName })}</h2>

        {conciergeHook !== null ? (
          <ConciergeQuote text={conciergeHook} signature={t('hero.conciergeSignature')} />
        ) : null}

        {heroProse !== null ? (
          <HotelStoryMore
            variant="kit"
            labels={{
              more: t('story.readMoreFull'),
              less: t('story.readLess'),
            }}
          >
            {heroProse}
          </HotelStoryMore>
        ) : null}

        {detailedSections !== null && collapsibleSections ? (
          <HotelStoryMore labels={{ more: t('story.readMore'), less: t('story.readLess') }}>
            {detailedSections}
          </HotelStoryMore>
        ) : (
          detailedSections
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="about-title" className="mb-12">
      <h2 id="about-title" className="text-fg mb-3 font-serif text-2xl">
        {t('sections.about')}
      </h2>

      {conciergeHook !== null ? (
        <ConciergeQuote text={conciergeHook} signature={t('hero.conciergeSignature')} />
      ) : null}

      {hasHero && heroParagraphs !== null ? (
        <div className="prose text-fg/90 mb-6 max-w-prose text-base">
          {heroParagraphs.map((paragraph, idx) => (
            <p key={idx} className="mb-3 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {detailedSections !== null && collapsibleSections ? (
        <HotelStoryMore labels={{ more: t('story.readMore'), less: t('story.readLess') }}>
          {detailedSections}
        </HotelStoryMore>
      ) : (
        detailedSections
      )}
    </section>
  );
}
