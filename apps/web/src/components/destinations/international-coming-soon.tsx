import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { listInternationalCountries } from '@/server/destinations/get-international-countries';

interface InternationalComingSoonProps {
  readonly locale: SupportedLocale;
}

const A_UPPER = 65; // 'A'
const Z_UPPER = 90; // 'Z'
const REGIONAL_INDICATOR_A = 0x1f1e6;

/**
 * Builds a unicode flag emoji from an ISO 3166-1 alpha-2 country code.
 * Returns the empty string if the code can't be mapped (defensive — the
 * column has a CHECK on length but a stray lowercase value would
 * otherwise emit an invalid sequence).
 */
function flagFromCountryCode(code: string): string {
  if (code.length !== 2) return '';
  const upper = code.toUpperCase();
  const first = upper.charCodeAt(0);
  const second = upper.charCodeAt(1);
  if (first < A_UPPER || first > Z_UPPER || second < A_UPPER || second > Z_UPPER) {
    return '';
  }
  return (
    String.fromCodePoint(REGIONAL_INDICATOR_A + (first - A_UPPER)) +
    String.fromCodePoint(REGIONAL_INDICATOR_A + (second - A_UPPER))
  );
}

const TOP_COUNTRIES_COUNT = 12;

/**
 * Homepage teaser — "Bientôt à l'international". Renders the top 12
 * countries by hotel count (published + drafts), each as a sober card
 * with flag + name + count badge. Plain text only — no links, since
 * destination guides are not yet published. The visible count itself
 * is the signal of catalog ambition.
 *
 * Server Component: cached at the data layer via `unstable_cache`
 * (`intl-countries` tag, 1 h TTL).
 *
 * Returns `null` when the catalog has zero international hotels — keeps
 * the homepage clean on cold environments (CI, fresh preview).
 */
export async function InternationalComingSoon({
  locale,
}: InternationalComingSoonProps): Promise<ReactElement | null> {
  const countries = await listInternationalCountries();
  if (countries.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'homepage.intlComingSoon' });

  const top = [...countries]
    .sort(
      (a, b) =>
        b.count - a.count ||
        (pickLocalizedText(locale, a.labelFr, a.labelEn) ?? a.code).localeCompare(
          pickLocalizedText(locale, b.labelFr, b.labelEn) ?? b.code,
          locale,
        ),
    )
    .slice(0, TOP_COUNTRIES_COUNT);

  return (
    <section
      data-section="intl-coming-soon"
      aria-labelledby="intl-coming-soon-title"
      className="border-border bg-bg mt-12 w-full max-w-5xl rounded-lg border p-6 sm:p-8"
    >
      <header className="mb-6">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h2 id="intl-coming-soon-title" className="text-fg mt-1 font-serif text-2xl md:text-3xl">
          {t('title')}
        </h2>
        <p className="text-muted mt-2 max-w-prose text-sm">{t('subtitle')}</p>
      </header>

      <ul
        aria-label={t('listAria')}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {top.map((c) => {
          const label = pickLocalizedText(locale, c.labelFr, c.labelEn) ?? c.code;
          const flag = flagFromCountryCode(c.code);
          return (
            <li
              key={c.code}
              className="border-border bg-bg flex flex-col gap-1 rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                {flag.length > 0 ? (
                  <span aria-hidden="true" className="text-xl leading-none">
                    {flag}
                  </span>
                ) : null}
                <span className="text-fg font-medium">{label}</span>
              </div>
              <p className="text-muted text-xs">{t('countLabel', { count: c.count })}</p>
              <p className="text-muted text-[0.7rem] uppercase tracking-wide">
                {t('guideComingSoon')}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
