import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { CatalogSearchForm } from '@/components/search/catalog-search-form';
import type { Locale } from '@/i18n/routing';
import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';
import { resolveHomeHeroMedia } from '@/lib/home/hero-media';

import { HomeHeroVideo } from './home-hero-video';

/**
 * Format a catalogue stat with locale-aware thousands separators.
 *
 * Server-side `Intl.NumberFormat` is locale-safe; the function is pure
 * and ships a stable string into the hero so the LCP text is identical
 * between SSR and the (absent) client hydration of this Server
 * Component. Avoids the "2,193 → 2 193" hydration mismatch trap.
 */
function formatStat(n: number, locale: Locale): string {
  const tag = locale === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.NumberFormat(tag).format(n);
}

/**
 * `<HomeHero>` — editorial hero block with optional Cloudinary video
 * background and a search Booking-style form preview.
 *
 * - Server Component. The hero copy (eyebrow, H1, subtitle, trust
 *   pills) renders SSR so LCP is met on a cold cache.
 * - The video background is delegated to `<HomeHeroVideo>`, a client
 *   island that respects `prefers-reduced-motion` and pauses on tab
 *   visibility loss.
 * - Falls back to a sober dark gradient when Cloudinary is not
 *   configured (preview environments, local dev without env vars).
 * - The search form posts only `destination` — Phase 1 keeps Amadeus
 *   gated (AGENTS.md §4ter). The visual `dates` / `guests` placeholders
 *   are disabled and carry no `name`.
 */
export async function HomeHero({
  locale,
  cloudName,
}: {
  readonly locale: Locale;
  readonly cloudName?: string;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const tHero = await getTranslations({ locale, namespace: 'homepage.hero' });
  const media = resolveHomeHeroMedia(cloudName);

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate flex min-h-[640px] items-center overflow-hidden bg-[#0e0e10] text-white lg:min-h-[80vh]"
    >
      {/* Background layer — video if Cloudinary configured, sober
          gradient otherwise. Both layers carry `aria-hidden` because
          the brand copy is the accessible label. */}
      <div className="absolute inset-0 -z-10">
        {media !== null ? (
          <HomeHeroVideo
            videoUrl={media.videoUrl}
            posterUrl={media.posterUrl}
            posterAlt={tHero('posterAlt')}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#1c1c20] via-[#0e0e10] to-[#000000]"
          />
        )}
        {/* Directional overlay: darker at the bottom (legibility under the
            copy + search form), lighter at the top — more cinematic than a
            flat scrim. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25"
        />
        {/* Elegant fade into the page background so the dark hero doesn't
            cut off with a hard edge. */}
        <div
          aria-hidden
          className="from-bg absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t to-transparent"
        />
      </div>

      <div className="container mx-auto max-w-screen-xl px-4 py-20 sm:py-28 lg:py-32">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
            <span aria-hidden className="bg-gold h-px w-8" />
            {t('eyebrow')}
          </p>
          <h1
            id="home-hero-title"
            className="font-serif text-4xl text-white sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {t('title')}
          </h1>
          <p className="-mt-2 font-serif text-base italic text-white/80 sm:text-lg">
            {t('stats', {
              countries: formatStat(CATALOGUE_COUNTRIES, locale),
              hotels: formatStat(CATALOGUE_PUBLISHED, locale),
            })}
          </p>
          <p className="max-w-prose text-lg text-white/90 sm:text-xl">
            {t('subtitle')}
            <br />
            {t('subtitleSecondary')}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-white/75">
            <span className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
              {t('trust.iata')}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
              {t('trust.aspst')}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
              {t('trust.amadeus')}
            </span>
          </div>

          <div className="mt-4">
            <CatalogSearchForm locale={locale} variant="hero" previewExtras />
          </div>
        </div>
      </div>
    </section>
  );
}
