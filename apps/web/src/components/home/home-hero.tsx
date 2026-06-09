import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelSearchBar } from '@/components/search/HotelSearchBar';
import type { Locale } from '@/i18n/routing';
import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';

/**
 * Format a catalogue stat with locale-aware thousands separators.
 *
 * Server-side `Intl.NumberFormat` is locale-safe; the function is pure
 * and ships a stable string into the hero so the LCP text is identical
 * between SSR and the (absent) client hydration of this Server Component.
 */
function formatStat(n: number, locale: Locale): string {
  const tag = locale === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.NumberFormat(tag).format(n);
}

/**
 * `<HomeHero>` — editorial hero ported from the HTML kit
 * (design/html-kit/index.html §hero). Full-bleed painted "Concierge"
 * photo with a left-anchored dark scrim, eyebrow, H1, signature stats,
 * lede, réassurance pills and an integrated Booking-style search bar.
 *
 * Server Component — the hero copy renders SSR so LCP is met on a cold
 * cache. The search bar posts only `destination` to the locale-aware
 * `/recherche` (Phase 1 keeps Amadeus gated — AGENTS.md §4ter); the
 * dates / guests cells are sober disabled placeholders carrying no
 * `name`, matching the layout users expect without wiring the funnel.
 *
 * `cloudName` is accepted for API compatibility with the previous video
 * hero but is no longer used — the kit ships a fixed painted backdrop.
 */
export async function HomeHero({
  locale,
}: {
  readonly locale: Locale;
  readonly cloudName?: string;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const tHero = await getTranslations({ locale, namespace: 'homepage.hero' });
  const tTrust = await getTranslations({ locale, namespace: 'homepage.trust' });

  return (
    <div className="mch-kit">
      <section aria-labelledby="home-hero-title" className="hero">
        {/* Painted "Concierge" hero — decorative; the copy below is the
            accessible label. Plain <img> + fetchPriority for LCP. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-bg"
          src="/kit/img/hero.jpg"
          alt={tHero('posterAlt')}
          fetchPriority="high"
        />
        <div aria-hidden className="hero-overlay" />

        <div className="wrap hero-grid">
          <div className="hero-content">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1 id="home-hero-title">{t('title')}</h1>
            <p className="hero-sub">
              {t('stats', {
                countries: formatStat(CATALOGUE_COUNTRIES, locale),
                hotels: formatStat(CATALOGUE_PUBLISHED, locale),
              })}
            </p>
            <p className="hero-para">
              {t('subtitle')} {t('subtitleSecondary')}
            </p>

            <div className="hero-trust">
              <span className="trust-pill">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {tTrust('iata')}
              </span>
              <span className="trust-pill">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M3 10h18" />
                </svg>
                {tTrust('aspst')}
              </span>
              <span className="trust-pill">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                {tTrust('amadeus')}
              </span>
            </div>

            <HotelSearchBar locale={locale} />
          </div>
        </div>
      </section>
    </div>
  );
}
