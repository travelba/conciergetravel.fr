import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HotelCard, PriceSlot, RatingBadge } from '@mch/ui-v2';

import { Link } from '@/i18n/navigation';
import { getDemoHotel } from '@/lib/demo-data';
import { detectRankingPattern, rankingSeo } from '@/lib/seo/keyword-templates';
import { getHotelV2 } from '@/server/hotels/get-hotel-v2';
import { getRankingV2 } from '@/server/rankings/get-ranking-v2';

export const dynamic = 'force-dynamic';

// Famille superlatifs — exclusive au gabarit classement (ADR-0034 §3).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = locale === 'en' ? 'en' : 'fr';

  const pattern = detectRankingPattern(slug);
  if (pattern !== null) {
    // Zone extraite du slug canonique (ex. meilleur-hotel-luxe-paris → Paris).
    const zoneSlug = slug
      .replace(/^meilleur-hotel-luxe-/, '')
      .replace(/^meilleur-hotel-5-etoiles-/, '')
      .replace(/^plus-beaux-hotels-/, '');
    const zoneLabel = zoneSlug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const seo = rankingSeo({ pattern, zoneLabel, locale: resolvedLocale });
    return { title: seo.title, description: seo.description };
  }

  // Slug hors patron canonique : title éditorial du classement.
  const result = await getRankingV2({ slug, locale: resolvedLocale });
  if (result === null) return {};
  return { title: result.ranking.title, description: result.ranking.intro };
}

export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ranking');

  const resolvedLocale = locale === 'en' ? 'en' : 'fr';
  const result = await getRankingV2({ slug, locale: resolvedLocale });
  if (result === null) notFound();

  const ranking = result.ranking;

  return (
    <div className="ui-v2-container py-8">
      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {t('title')}
        </p>
        <h1 className="mt-2">{ranking.title}</h1>
        <p className="mt-4 leading-relaxed text-[var(--color-muted)]">{ranking.intro}</p>
      </header>

      <section>
        <h2 className="mb-6">{t('entriesTitle')}</h2>
        <ol className="flex flex-col gap-6">
          {ranking.entries.map((entry) => (
            <RankingEntryRow key={entry.rank} entry={entry} locale={resolvedLocale} />
          ))}
        </ol>
      </section>
    </div>
  );
}

async function RankingEntryRow({
  entry,
  locale,
}: {
  entry: {
    rank: number;
    hotelSlug: string;
    hotelName: string;
    city: string;
    teaser: string;
  };
  locale: 'fr' | 'en';
}) {
  const liveHotel = await getHotelV2({ slug: entry.hotelSlug, locale });
  const hotel = liveHotel?.hotel ?? getDemoHotel(entry.hotelSlug);

  return (
    <li className="flex flex-col gap-4 md:flex-row md:items-start">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-[var(--color-gold-100)] font-serif text-lg text-[var(--color-gold-800)]">
        {entry.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link
            href={{ pathname: '/hotel/[slug]', params: { slug: entry.hotelSlug } }}
            className="font-serif text-xl hover:underline"
          >
            {entry.hotelName}
          </Link>
          {hotel !== undefined ? (
            <RatingBadge scoreOutOfTen={hotel.ratingScoreOutOfTen} size="sm" />
          ) : null}
        </div>
        <p className="text-sm text-[var(--color-muted)]">{entry.city}</p>
        <p className="mt-2 text-sm leading-relaxed">{entry.teaser}</p>
        {hotel !== undefined ? (
          <div className="mt-4">
            <HotelCard
              name={hotel.name}
              stars={hotel.stars}
              district={hotel.district}
              highlights={hotel.highlights.slice(0, 2)}
              href={`/hotel/${hotel.slug}`}
              image={
                <Image
                  src={hotel.heroImage}
                  alt={hotel.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 240px"
                  className="object-cover"
                />
              }
              priceSlot={<PriceSlot mode="concierge" memberTeaser="Tarif membre sur demande" />}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
