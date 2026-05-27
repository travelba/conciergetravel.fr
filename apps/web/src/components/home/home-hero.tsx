import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { CatalogSearchForm } from '@/components/search/catalog-search-form';
import type { Locale } from '@/i18n/routing';
import { resolveHomeHeroMedia } from '@/lib/home/hero-media';

import { HomeHeroVideo } from './home-hero-video';

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
      className="relative isolate overflow-hidden bg-[#0e0e10] text-white"
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
        {/* Dark overlay for legibility on top of the video. */}
        <div aria-hidden className="absolute inset-0 bg-black/45" />
      </div>

      <div className="container mx-auto max-w-screen-xl px-4 py-20 sm:py-28 lg:py-36">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">
            {t('eyebrow')}
          </p>
          <h1
            id="home-hero-title"
            className="font-serif text-4xl text-white sm:text-5xl md:text-6xl"
          >
            {t('title')}
          </h1>
          <p className="-mt-2 font-serif text-base italic text-white/80 sm:text-lg">
            {t('intlBadge')}
          </p>
          <p className="max-w-prose text-lg text-white/90 sm:text-xl">{t('subtitle')}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/70">
            <span className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5">
              {t('trust.iata')}
            </span>
            <span className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5">
              {t('trust.aspst')}
            </span>
            <span className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5">
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
